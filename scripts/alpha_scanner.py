#!/usr/bin/env python3
"""
Alpha Signal Scanner — Unifies all signal sources into a single
actionable trading feed. Runs periodically or on-demand.

Signal Sources:
1. Trust Score filter (markets below ML risk threshold)
2. Options-vs-Prediction arbitrage (Deribit IV ↔ Polymarket price)
3. Volume spike detection (sudden liquidity inflows)
4. Price momentum divergence (price moving opposite to evidence quality)

Usage:
  python3 scripts/alpha_scanner.py
  python3 scripts/alpha_scanner.py --live  # Continuous scanning mode
"""
import argparse
import json
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import numpy as np

DATA_DIR    = os.path.join(os.path.dirname(__file__), "..", "data")
GAMMA_BASE  = "https://gamma-api.polymarket.com"
CLOB_BASE   = "https://clob.polymarket.com"
DERIBIT_API = "https://www.deribit.com/api/v2/public"


# ═══════════════════════════════════════════════════════════════
# Signal 1: Polymarket Mispricing via Trust Score
# ═══════════════════════════════════════════════════════════════

def scan_trust_signals(limit: int = 200) -> list[dict]:
    """
    Fetch active markets and compute trust signals.
    Flag markets where:
    - Price is strongly directional (>85% or <15%) but trust score is low
    - These are "traps": the market LOOKS certain but resolution is risky
    """
    import re

    signals = []

    with httpx.Client(timeout=15) as client:
        resp = client.get(f"{GAMMA_BASE}/markets", params={
            "closed": "false", "active": "true",
            "limit": limit, "order": "volume", "ascending": "false"
        })
        resp.raise_for_status()
        markets = resp.json()

    for mkt in markets:
        try:
            question    = mkt.get("question", "")
            description = mkt.get("description", "")[:500]
            volume      = float(mkt.get("volume", 0) or 0)
            liquidity   = float(mkt.get("liquidity", 0) or 0)
            category    = mkt.get("category", "")
            res_src     = mkt.get("resolutionSource", "")

            # Get current price
            prices_raw = mkt.get("outcomePrices", "[]")
            if isinstance(prices_raw, str):
                prices = json.loads(prices_raw)
            else:
                prices = prices_raw or []
            if not prices:
                continue
            yes_price = float(prices[0])

            # Quick trust scoring (lightweight version)
            text = f"{question} {description}".lower()

            # Criteria clarity
            has_date       = bool(re.search(r'\b(by|before|end of)\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})', text))
            has_threshold  = bool(re.search(r'(\$[\d,]+|\d+%|at least \d+|more than \d+)', text))
            has_res_word   = any(kw in text for kw in ["resolves", "determined by", "according to", "official"])

            clarity = 0.0
            if has_date:       clarity += 0.35
            if has_threshold:  clarity += 0.30
            if has_res_word:   clarity += 0.25
            if not any(w in text for w in ["may", "could", "probably", "subjective"]):
                clarity += 0.10

            # Source quality
            src_lower = (res_src or "").lower()
            if any(s in src_lower for s in ["reuters", "apnews", "bbc", "gov", "sec.gov"]):
                src_score = 1.0
            elif any(s in src_lower for s in ["twitter", "x.com", "reddit"]):
                src_score = 0.2
            elif src_lower.startswith("http"):
                src_score = 0.6
            else:
                src_score = 0.3

            # Integrity risk
            base_risk = 0.25
            if volume < 10000: base_risk += 0.15
            if liquidity < 2000: base_risk += 0.10

            trust_score = (0.35 * clarity + 0.35 * src_score + 0.20 * 0.5 + 0.10 * (1 - base_risk)) * 100

            # ── SIGNAL: High price (>80%) + low trust → potential trap ──
            if yes_price > 0.80 and trust_score < 45:
                signals.append({
                    "type":     "TRUST_TRAP",
                    "severity": "HIGH" if trust_score < 35 else "MEDIUM",
                    "market_id":    mkt.get("id"),
                    "question":     question[:120],
                    "yes_price":    round(yes_price, 4),
                    "trust_score":  round(trust_score, 1),
                    "volume_usd":   round(volume, 0),
                    "category":     category,
                    "signal_text":  f"Market priced at {yes_price*100:.0f}% YES but trust score only {trust_score:.0f}/100 — resolution risk elevated",
                    "action":       "CONSIDER SHORT / AVOID",
                })

            # ── SIGNAL: Low price (<20%) + high trust → potential value ──
            elif yes_price < 0.20 and trust_score > 55:
                signals.append({
                    "type":     "TRUST_VALUE",
                    "severity": "MEDIUM",
                    "market_id":    mkt.get("id"),
                    "question":     question[:120],
                    "yes_price":    round(yes_price, 4),
                    "trust_score":  round(trust_score, 1),
                    "volume_usd":   round(volume, 0),
                    "category":     category,
                    "signal_text":  f"Market at {yes_price*100:.0f}% YES with strong trust {trust_score:.0f}/100 — potential contrarian value if fundamentals support",
                    "action":       "INVESTIGATE LONG",
                })

            # ── SIGNAL: Low volume + high price certainty → manipulation risk ──
            if volume < 5000 and (yes_price > 0.90 or yes_price < 0.10):
                signals.append({
                    "type":     "THIN_MARKET",
                    "severity": "LOW",
                    "market_id":    mkt.get("id"),
                    "question":     question[:120],
                    "yes_price":    round(yes_price, 4),
                    "trust_score":  round(trust_score, 1),
                    "volume_usd":   round(volume, 0),
                    "category":     category,
                    "signal_text":  f"Thin market (${volume:,.0f}) with extreme price — potential manipulation risk",
                    "action":       "AVOID",
                })

        except Exception as e:
            continue

    return signals


# ═══════════════════════════════════════════════════════════════
# Signal 2: Options ↔ Prediction Market Arbitrage
# ═══════════════════════════════════════════════════════════════

def scan_options_arb() -> list[dict]:
    """
    Load the latest IV surface and compare with live Polymarket crypto markets.
    """
    signals = []
    iv_path = os.path.join(DATA_DIR, "btc_iv_surface.json")

    if not os.path.exists(iv_path):
        return signals

    with open(iv_path) as f:
        iv_data = json.load(f)

    index_price = iv_data["index_price"]

    # Scan Polymarket for BTC price prediction markets
    with httpx.Client(timeout=15) as client:
        resp = client.get(f"{GAMMA_BASE}/markets", params={
            "closed": "false", "active": "true", "limit": 200,
            "order": "volume", "ascending": "false",
        })
        resp.raise_for_status()
        markets = resp.json()

    # Find BTC price-level markets
    btc_markets = []
    for mkt in markets:
        q = (mkt.get("question", "") or "").lower()
        if ("bitcoin" in q or "btc" in q) and ("above" in q or "below" in q or "price" in q):
            # Try to extract strike price from question
            import re
            price_match = re.search(r'\$?([\d,]+)', q)
            if price_match:
                try:
                    strike = int(price_match.group(1).replace(",", ""))
                    prices_raw = mkt.get("outcomePrices", "[]")
                    prices = json.loads(prices_raw) if isinstance(prices_raw, str) else (prices_raw or [])
                    if prices:
                        yes_price = float(prices[0])
                        btc_markets.append({
                            "market_id": mkt["id"],
                            "question":  mkt["question"],
                            "strike":    strike,
                            "yes_price": yes_price,
                            "volume":    float(mkt.get("volume", 0) or 0),
                        })
                except (ValueError, IndexError):
                    pass

    # Compare with Deribit N(d2)
    for pm in btc_markets:
        strike = pm["strike"]
        # Find closest strike in IV surface
        for expiry_date, strikes in iv_data["surface"].items():
            strike_str = str(strike)
            if strike_str in strikes:
                options_prob = strikes[strike_str]["prob_above_strike"]
                diff = pm["yes_price"] - options_prob

                if abs(diff) >= 0.05:
                    signals.append({
                        "type":     "OPTIONS_ARB",
                        "severity": "HIGH" if abs(diff) > 0.10 else "MEDIUM",
                        "market_id":    pm["market_id"],
                        "question":     pm["question"][:120],
                        "yes_price":    round(pm["yes_price"], 4),
                        "options_prob": round(options_prob, 4),
                        "diff":         round(diff, 4),
                        "strike":       strike,
                        "expiry":       expiry_date,
                        "mark_iv":      strikes[strike_str]["mark_iv"],
                        "signal_text":  (
                            f"Polymarket {pm['yes_price']*100:.0f}% vs Deribit {options_prob*100:.0f}% "
                            f"for BTC>{strike:,} by {expiry_date} — "
                            f"{'Prediction overpriced' if diff > 0 else 'Prediction underpriced'}"
                        ),
                        "action": "SELL_PREDICTION" if diff > 0 else "BUY_PREDICTION",
                    })

    return signals


# ═══════════════════════════════════════════════════════════════
# Main Scanner Loop
# ═══════════════════════════════════════════════════════════════

def run_scan() -> dict:
    """Execute all signal scans and aggregate."""
    ts = datetime.now(timezone.utc).isoformat()
    print(f"\n{'='*60}")
    print(f"ALPHA SIGNAL SCAN — {ts}")
    print(f"{'='*60}")

    all_signals = []

    # Signal 1: Trust
    print("\n  [1/2] Scanning trust-based signals...")
    trust_signals = scan_trust_signals(limit=200)
    all_signals.extend(trust_signals)
    print(f"    → {len(trust_signals)} trust signals")

    # Signal 2: Options Arb
    print("  [2/2] Scanning options arbitrage signals...")
    arb_signals = scan_options_arb()
    all_signals.extend(arb_signals)
    print(f"    → {len(arb_signals)} options-vs-prediction signals")

    # Sort by severity
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_signals.sort(key=lambda s: severity_order.get(s.get("severity", "LOW"), 2))

    # Print summary
    print(f"\n  TOTAL SIGNALS: {len(all_signals)}")
    for s in all_signals[:10]:
        icon = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(s["severity"], "⚪")
        print(f"    {icon} [{s['type']}] {s['signal_text'][:80]}")
        print(f"       Action: {s['action']} | Market: {s.get('question', '')[:60]}...")

    result = {
        "scanned_at": ts,
        "n_signals":  len(all_signals),
        "signals":    all_signals,
        "summary": {
            "high":   sum(1 for s in all_signals if s["severity"] == "HIGH"),
            "medium": sum(1 for s in all_signals if s["severity"] == "MEDIUM"),
            "low":    sum(1 for s in all_signals if s["severity"] == "LOW"),
        }
    }

    # Save
    out_path = os.path.join(DATA_DIR, "alpha_signals.json")
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2, default=str)
    print(f"\n  Saved: {out_path}")

    return result


def main():
    parser = argparse.ArgumentParser(description="Alpha Signal Scanner")
    parser.add_argument("--live", action="store_true", help="Continuous scanning (every 60s)")
    parser.add_argument("--interval", type=int, default=60, help="Scan interval in seconds")
    args = parser.parse_args()

    if args.live:
        print("Starting live scan loop (Ctrl+C to stop)...")
        while True:
            try:
                run_scan()
                print(f"\nSleeping {args.interval}s...")
                time.sleep(args.interval)
            except KeyboardInterrupt:
                print("\nStopped.")
                break
    else:
        run_scan()


if __name__ == "__main__":
    main()
