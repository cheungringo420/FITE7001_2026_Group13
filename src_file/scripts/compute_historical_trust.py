#!/usr/bin/env python3
"""
Step 2: Compute historical trust scores for all markets in markets_history.parquet
Uses the SAME scoring logic as src/lib/trust/scoring.ts (Python port)
to avoid look-ahead bias — scores computed AS OF T-7d before resolution.

Usage:
  python3 src_file/scripts/compute_historical_trust.py
  python3 src_file/scripts/compute_historical_trust.py --push-supabase
"""
import argparse
import os
import re
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd

REPO_ROOT   = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR   = os.path.join(REPO_ROOT, "data")
INPUT_FILE  = os.path.join(DATA_DIR, "markets_history.parquet")
OUTPUT_FILE = os.path.join(DATA_DIR, "trust_scores_historical.parquet")

METHODOLOGY_VER = "v1.0"


# ── Resolution Source Quality ─────────────────────────────────
STRONG_SOURCES = [
    "reuters.com", "apnews.com", "bbc.com", "nytimes.com",
    "wsj.com", "ft.com", "federalreserve.gov", "bls.gov",
    "cdc.gov", "who.int", "sec.gov", "nasdaq.com", "cmegroup.com",
]
WEAK_SOURCES = [
    "twitter.com", "x.com", "reddit.com", "t.me", "facebook.com",
    "youtube.com", "tiktok.com",
]

def score_resolution_source(resolution_src: str) -> tuple[str, float]:
    """Rate the quality of the resolution source. Returns (quality_label, score 0-1)."""
    if not resolution_src or resolution_src.strip() == "":
        return ("unknown", 0.3)
    
    src_lower = resolution_src.lower()
    
    if any(s in src_lower for s in STRONG_SOURCES):
        return ("strong", 1.0)
    elif any(s in src_lower for s in WEAK_SOURCES):
        return ("weak", 0.2)
    elif src_lower.startswith("http"):
        return ("medium", 0.6)  # Known URL but unlisted source
    else:
        return ("medium", 0.5)  # Free-text description


# ── Criteria Clarity Scorer ───────────────────────────────────
EXPLICIT_DATE_PATTERNS = [
    r'\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}',
    r'\bbefore\s+\d{4}',
    r'\bby\s+\d{1,2}/\d{1,2}/\d{2,4}',
    r'\bq[1-4]\s+20\d{2}\b',
    r'\bend\s+of\s+(20\d{2}|the\s+year)',
    r'\bby\s+end\s+of\s+\w+\s+(20\d{2}|\d{1,2})',
]

OBJECTIVE_THRESHOLD_PATTERNS = [
    r'\$[\d,]+',              # Dollar amounts
    r'\d+%',                  # Percentages
    r'\bat\s+least\s+\d+',
    r'\bmore\s+than\s+\d+',
    r'\bless\s+than\s+\d+',
    r'\babove\s+\d+',
    r'\bbelow\s+\d+',
    r'\bexceed[s]?\s+\d+',
]

RESOLUTION_WORDING = [
    "resolves yes", "resolves no", "will resolve",
    "resolved based on", "determined by", "as reported by",
    "according to", "official", "per ",
]

AMBIGUITY_TERMS = [
    "or more", "at least one", "any of", "likely", "probably",
    "may", "could", "might", "subjective", "at discretion",
    "as determined", "if applicable",
]

def score_criteria_clarity(question: str, description: str) -> tuple[float, list[str], bool, bool, bool]:
    """
    Returns: (clarity_score 0-1, ambiguity_flags, has_explicit_date,
               has_objective_threshold, has_resolution_wording)
    """
    text = f"{question} {description}".lower()
    flags = []
    
    has_explicit_date = any(re.search(p, text) for p in EXPLICIT_DATE_PATTERNS)
    has_objective_threshold = any(re.search(p, text) for p in OBJECTIVE_THRESHOLD_PATTERNS)
    has_resolution_wording = any(kw in text for kw in RESOLUTION_WORDING)
    
    # Collect ambiguity signals
    for term in AMBIGUITY_TERMS:
        if term in text:
            flags.append(term)
    
    # Score: each positive criterion adds points, ambiguity deducts
    score = 0.0
    if has_explicit_date:          score += 0.35
    if has_objective_threshold:    score += 0.30
    if has_resolution_wording:     score += 0.25
    if not flags:                  score += 0.10  # Bonus for clean language
    
    # Penalty for ambiguity (max -0.30)
    penalty = min(len(flags) * 0.08, 0.30)
    score = max(0.0, min(1.0, score - penalty))
    
    return score, flags, has_explicit_date, has_objective_threshold, has_resolution_wording


# ── Integrity Risk by Category ─────────────────────────────────
# Base dispute rates by category (estimated from historical patterns)
CATEGORY_BASE_RISK: dict[str, float] = {
    "politics":       0.35,
    "elections":      0.30,
    "sports":         0.15,
    "crypto":         0.25,
    "finance":        0.20,
    "science":        0.15,
    "entertainment":  0.10,
    "geopolitics":    0.40,
    "economics":      0.20,
    "":               0.25,  # unknown
}

def score_integrity_risk(category: str, volume: float, liquidity: float) -> float:
    """Compute integrity risk score (0-1, higher = more risky)."""
    base = CATEGORY_BASE_RISK.get((category or "").lower(), 0.25)
    
    # Low volume & liquidity → higher risk
    vol_risk = 0.0
    if volume < 1_000:     vol_risk = 0.25
    elif volume < 10_000:  vol_risk = 0.15
    elif volume < 100_000: vol_risk = 0.05
    
    liq_risk = 0.0
    if liquidity < 500:    liq_risk = 0.20
    elif liquidity < 2000: liq_risk = 0.10
    
    return min(1.0, base + vol_risk + liq_risk)


# ── Composite Trust Score (mirrors scoring.ts) ─────────────────
def compute_composite_score(
    criteria_clarity: float,      # 0-1
    evidence_consensus: float,    # 0-1  (proxy: source quality)
    integrity_risk: float,        # 0-1
    agreement_score: float = 0.5, # 0-1  (cross-platform, not available for historical)
) -> float:
    """Weighted composite — must match src/lib/trust/scoring.ts weights."""
    trust = (
        0.35 * criteria_clarity +
        0.35 * evidence_consensus +
        0.20 * agreement_score +
        0.10 * (1 - integrity_risk)
    )
    return round(min(100, max(0, trust * 100)), 1)


# ── Main ──────────────────────────────────────────────────────
def process_market(row: pd.Series) -> Optional[dict]:
    try:
        clarity, flags, has_date, has_threshold, has_wording = score_criteria_clarity(
            row.get("question", ""),
            row.get("description", ""),
        )
        src_quality_label, src_quality_score = score_resolution_source(
            row.get("resolution_src", "")
        )
        integrity_risk = score_integrity_risk(
            row.get("category", ""),
            float(row.get("volume_usd", 0) or 0),
            float(row.get("liquidity_usd", 0) or 0),
        )
        
        composite = compute_composite_score(
            criteria_clarity=clarity,
            evidence_consensus=src_quality_score,
            integrity_risk=integrity_risk,
        )
        
        # Compute "as of" timestamp (T-7d before resolution)
        resolved_at = row.get("resolved_at")
        if resolved_at:
            try:
                resolved_dt = pd.to_datetime(resolved_at, utc=True)
                computed_at = (resolved_dt - timedelta(days=7)).isoformat()
            except Exception:
                computed_at = datetime.now(timezone.utc).isoformat()
        else:
            computed_at = datetime.now(timezone.utc).isoformat()

        return {
            "market_id":                row["id"],
            "computed_at":              computed_at,
            "criteria_clarity":         round(clarity * 100, 1),
            "evidence_consensus":       round(src_quality_score * 100, 1),
            "integrity_risk":           round(integrity_risk * 100, 1),
            "agreement_score":          50.0,   # no cross-platform data for historical
            "composite_score":          composite,
            "methodology_ver":          METHODOLOGY_VER,
            "ambiguity_flags":          flags,
            "has_explicit_date":        has_date,
            "has_objective_threshold":  has_threshold,
            "resolution_source_quality": src_quality_label,
        }
    except Exception as e:
        print(f"  Warning: failed to score market {row.get('id')}: {e}")
        return None


def push_to_supabase(df: pd.DataFrame) -> None:
    from supabase import create_client
    import json

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    records = df.where(df.notna(), None).to_dict(orient="records")
    # Convert list fields to JSON-compatible
    for r in records:
        if isinstance(r.get("ambiguity_flags"), list):
            r["ambiguity_flags"] = r["ambiguity_flags"] or []

    batch_size = 500
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        client.table("trust_scores_historical").upsert(
            batch, on_conflict="market_id,methodology_ver"
        ).execute()
        print(f"  Pushed {min(i+batch_size, len(records))}/{len(records)} scores to Supabase")


def main():
    parser = argparse.ArgumentParser(description="Compute historical trust scores")
    parser.add_argument("--push-supabase", action="store_true")
    parser.add_argument("--input",  default=INPUT_FILE)
    parser.add_argument("--output", default=OUTPUT_FILE)
    args = parser.parse_args()

    print(f"Loading markets from {args.input}...")
    df = pd.read_parquet(args.input)
    print(f"  {len(df)} markets loaded")

    print("Computing trust scores (this may take a few minutes)...")
    scores = []
    for _, row in df.iterrows():
        result = process_market(row)
        if result:
            scores.append(result)

    scores_df = pd.DataFrame(scores)
    print(f"\nScored {len(scores_df)}/{len(df)} markets")
    print(f"  Mean composite score: {scores_df['composite_score'].mean():.1f}")
    print(f"  Score distribution:")
    for bucket in [(0,30),(30,50),(50,70),(70,90),(90,100)]:
        n = ((scores_df['composite_score'] >= bucket[0]) & (scores_df['composite_score'] < bucket[1])).sum()
        print(f"    [{bucket[0]:3d}–{bucket[1]:3d}): {n:5d} markets")

    scores_df.to_parquet(args.output, index=False)
    print(f"\nSaved to: {args.output}")

    if args.push_supabase:
        print("Pushing to Supabase...")
        from dotenv import load_dotenv
        load_dotenv()
        push_to_supabase(scores_df)


if __name__ == "__main__":
    main()
