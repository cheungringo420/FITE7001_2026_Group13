#!/usr/bin/env python3
"""
Deribit Options Data Fetcher — builds an implied volatility surface
for BTC and ETH options, then computes N(d2) probabilities
that can be cross-referenced with Polymarket prediction prices.

This finds arbitrage between:
  - Deribit: "BTC will be above $X by date Y" → options-implied probability
  - Polymarket: "Bitcoin above $X" → prediction market price

If prediction_price << N(d2) → BUY prediction market (underpriced vs options)
If prediction_price >> N(d2) → SELL prediction market (overpriced vs options)

Usage:
  python3 src_file/scripts/deribit_iv_surface.py
  python3 src_file/scripts/deribit_iv_surface.py --currency ETH --output data/eth_iv.json
"""
import argparse
import json
import os
import time
from datetime import datetime, timezone

import httpx
import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(REPO_ROOT, "data")

DERIBIT_API = "https://www.deribit.com/api/v2/public"


# ── Standard Normal CDF (matches iv-calculator.ts) ────────────
def norm_cdf(x: float) -> float:
    """Standard normal CDF — Abramowitz and Stegun approximation."""
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    sign = -1 if x < 0 else 1
    x = abs(x) / np.sqrt(2)
    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1) * t * np.exp(-x*x)
    return 0.5 * (1.0 + sign * y)


def black_scholes_binary_prob(S: float, K: float, T: float, sigma: float, r: float = 0.045) -> float:
    """Probability that S > K at expiry: N(d2)."""
    if T <= 0 or sigma <= 0:
        return 1.0 if S > K else 0.0
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return float(norm_cdf(d2))


# ── Deribit API Calls ─────────────────────────────────────────

def fetch_instruments(currency: str = "BTC", kind: str = "option") -> list[dict]:
    """Fetch all option instruments for a given currency."""
    resp = httpx.get(f"{DERIBIT_API}/get_instruments", params={
        "currency": currency, "kind": kind, "expired": "false"
    }, timeout=15)
    resp.raise_for_status()
    return resp.json()["result"]


def fetch_orderbook(instrument_name: str) -> dict:
    """Fetch order book and Greeks for a single instrument."""
    resp = httpx.get(f"{DERIBIT_API}/get_order_book", params={
        "instrument_name": instrument_name
    }, timeout=15)
    resp.raise_for_status()
    return resp.json()["result"]


def fetch_index_price(currency: str = "BTC") -> float:
    """Get current index price via Deribit API v2."""
    resp = httpx.get(f"{DERIBIT_API}/get_index_price", params={
        "index_name": f"{currency.lower()}_usd"
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()["result"]
    return data.get("index_price", 60000)


def build_iv_surface(currency: str = "BTC", max_instruments: int = 200) -> dict:
    """
    Build an IV surface from live Deribit data.
    Returns strike → expiry → (IV, mark_price, greeks, prob_above_strike).
    """
    print(f"  Fetching {currency} index price...")
    index_price = fetch_index_price(currency)
    print(f"  {currency} index: ${index_price:,.2f}")

    print(f"  Fetching {currency} option instruments...")
    instruments = fetch_instruments(currency, "option")
    print(f"  {len(instruments)} instruments found")

    # Filter to calls, reasonable strikes (0.5x to 2x spot), and near-term maturities
    calls = [
        inst for inst in instruments
        if inst.get("option_type") == "call"
        and inst.get("strike", 0) >= index_price * 0.5
        and inst.get("strike", 0) <= index_price * 2.0
    ]
    calls.sort(key=lambda x: (x.get("expiration_timestamp", 0), x.get("strike", 0)))
    calls = calls[:max_instruments]
    print(f"  {len(calls)} calls after filtering")

    surface = {}
    opportunities = []

    for i, inst in enumerate(calls):
        name   = inst["instrument_name"]
        strike = inst.get("strike", 0)
        exp_ts = inst.get("expiration_timestamp", 0) / 1000
        expiry = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
        T      = max((expiry - datetime.now(timezone.utc)).total_seconds() / (365.25 * 86400), 0.001)

        try:
            book = fetch_orderbook(name)
            iv   = book.get("mark_iv", 0) / 100  # Deribit returns IV in % form
            mark = book.get("mark_price", 0) * index_price  # mark in USD
            bid  = book.get("best_bid_price", 0) * index_price
            ask  = book.get("best_ask_price", 0) * index_price
            greeks = book.get("greeks", {})

            # Compute N(d2) — options-implied probability that BTC > strike at expiry
            prob = black_scholes_binary_prob(index_price, strike, T, iv if iv > 0 else 0.5)

            entry = {
                "instrument":       name,
                "strike":           strike,
                "expiry":           expiry.isoformat(),
                "days_to_expiry":   round(T * 365.25, 1),
                "mark_iv":          round(iv, 4),
                "mark_price_usd":   round(mark, 2),
                "bid_usd":          round(bid, 2),
                "ask_usd":          round(ask, 2),
                "prob_above_strike": round(prob, 4),
                "delta":            greeks.get("delta"),
                "gamma":            greeks.get("gamma"),
                "vega":             greeks.get("vega"),
                "theta":            greeks.get("theta"),
            }

            exp_key = expiry.strftime("%Y-%m-%d")
            if exp_key not in surface:
                surface[exp_key] = {}
            surface[exp_key][str(int(strike))] = entry

            if (i + 1) % 20 == 0:
                print(f"    Processed {i+1}/{len(calls)} instruments...")

            time.sleep(0.05)  # Rate limiting
        except Exception as e:
            continue

    result = {
        "currency":     currency,
        "index_price":  index_price,
        "fetched_at":   datetime.now(timezone.utc).isoformat(),
        "n_instruments": len(calls),
        "surface":      surface,
    }

    return result


def find_prediction_market_opportunities(
    iv_surface: dict,
    polymarket_prices: dict[str, float] = None,
) -> list[dict]:
    """
    Cross-reference IV surface probabilities with Polymarket prices.
    
    polymarket_prices: dict of {strike_label: yes_price}
    e.g., {"100000": 0.35, "120000": 0.15}
    """
    if polymarket_prices is None:
        return []

    opportunities = []
    currency     = iv_surface["currency"]
    index_price  = iv_surface["index_price"]

    for expiry_date, strikes in iv_surface["surface"].items():
        for strike_str, data in strikes.items():
            if strike_str in polymarket_prices:
                pred_price   = polymarket_prices[strike_str]
                options_prob = data["prob_above_strike"]
                diff         = pred_price - options_prob
                pct_diff     = diff / max(options_prob, 0.01)

                opp = {
                    "currency":         currency,
                    "strike":           int(strike_str),
                    "expiry":           expiry_date,
                    "prediction_price": round(pred_price, 4),
                    "options_prob":     round(options_prob, 4),
                    "diff":             round(diff, 4),
                    "pct_diff":         round(pct_diff * 100, 2),
                    "mark_iv":          data["mark_iv"],
                    "signal": (
                        "BUY_PREDICTION" if diff < -0.05 else
                        "SELL_PREDICTION" if diff > 0.05 else
                        "NEUTRAL"
                    ),
                }
                if abs(diff) >= 0.05:
                    opportunities.append(opp)

    return sorted(opportunities, key=lambda x: abs(x["diff"]), reverse=True)


def main():
    parser = argparse.ArgumentParser(description="Deribit IV Surface Builder")
    parser.add_argument("--currency", default="BTC", choices=["BTC", "ETH"])
    parser.add_argument("--max-instruments", type=int, default=100)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)
    out_path = args.output or os.path.join(DATA_DIR, f"{args.currency.lower()}_iv_surface.json")

    print(f"Building {args.currency} IV surface from Deribit...")
    surface = build_iv_surface(args.currency, args.max_instruments)

    with open(out_path, "w") as f:
        json.dump(surface, f, indent=2, default=str)
    print(f"\nSaved IV surface: {out_path}")

    # Print summary
    total_entries = sum(len(s) for s in surface["surface"].values())
    print(f"\n  Currency:    {surface['currency']}")
    print(f"  Index Price: ${surface['index_price']:,.2f}")
    print(f"  Expiries:    {len(surface['surface'])}")
    print(f"  Total entries: {total_entries}")

    # Show sample entries
    for expiry, strikes in list(surface["surface"].items())[:2]:
        print(f"\n  Expiry: {expiry}")
        for strike, data in list(strikes.items())[:5]:
            print(f"    Strike ${strike:>8}: IV={data['mark_iv']:.2%}, "
                  f"P(>{strike})={data['prob_above_strike']:.2%}, "
                  f"Mark=${data['mark_price_usd']:,.2f}")


if __name__ == "__main__":
    main()
