#!/usr/bin/env python3
"""
Step 1: Fetch all resolved markets from Polymarket Gamma API.
Writes to: data/markets_history.parquet (and Supabase if configured)

Usage:
  python3 scripts/fetch_historical_markets.py
  python3 scripts/fetch_historical_markets.py --limit 500 --push-supabase
"""
import argparse
import json
import time
import os
from datetime import datetime, timezone
from typing import Generator

import httpx
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

GAMMA_BASE = "https://gamma-api.polymarket.com"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
BATCH_SIZE = 100


def fetch_closed_markets(limit: int = 10_000) -> Generator[dict, None, None]:
    """Paginate through all closed (resolved) markets."""
    offset = 0
    fetched = 0
    
    with httpx.Client(timeout=30) as client:
        while fetched < limit:
            batch = min(BATCH_SIZE, limit - fetched)
            params = {
                "closed": "true",
                "limit": batch,
                "offset": offset,
                "order": "volume",
                "ascending": "false",
            }
            resp = client.get(f"{GAMMA_BASE}/markets", params=params)
            resp.raise_for_status()
            data = resp.json()
            
            if not data:
                print(f"  No more data at offset {offset}. Done.")
                break
            
            for market in data:
                yield market
                fetched += 1
            
            print(f"  Fetched {fetched} markets so far...")
            offset += len(data)
            time.sleep(0.3)   # Respect rate limits


def parse_market(raw: dict) -> dict:
    """Normalise raw Gamma API market object to our schema."""
    resolved_at = raw.get("endDate") or raw.get("resolutionDate")
    
    # Determine resolution state
    if raw.get("disputed"):
        resolution_state = "DISPUTED"
    elif raw.get("resolutionState") == "RESOLVED":
        resolution_state = "RESOLVED"
    elif raw.get("cyom") or raw.get("cancelled"):
        resolution_state = "CANCELLED"
    else:
        resolution_state = "RESOLVED"  # default for closed markets
    
    # Final price (yes probability at settlement)
    final_price = None
    if raw.get("outcomePrices"):
        try:
            prices = json.loads(raw["outcomePrices"]) if isinstance(raw["outcomePrices"], str) else raw["outcomePrices"]
            if prices:
                final_price = float(prices[0])
        except (ValueError, IndexError):
            pass
    
    return {
        "id":               raw.get("id", ""),
        "question":         raw.get("question", ""),
        "description":      raw.get("description", "")[:2000],  # trim for storage
        "platform":         "polymarket",
        "category":         raw.get("category", ""),
        "resolution_src":   raw.get("resolutionSource", ""),
        "resolved_at":      resolved_at,
        "resolution_state": resolution_state,
        "volume_usd":       float(raw.get("volume", 0) or 0),
        "liquidity_usd":    float(raw.get("liquidity", 0) or 0),
        "final_price":      final_price,
        "outcome":          raw.get("winnerOutcome", ""),
        "fetched_at":       datetime.now(timezone.utc).isoformat(),
    }


def push_to_supabase(df: pd.DataFrame) -> None:
    """Upsert rows into Supabase markets_history table."""
    from supabase import create_client
    
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)
    
    records = df.where(df.notna(), None).to_dict(orient="records")
    batch_size = 500
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        client.table("markets_history").upsert(batch, on_conflict="id").execute()
        print(f"  Pushed {min(i+batch_size, len(records))}/{len(records)} rows to Supabase")


def main():
    parser = argparse.ArgumentParser(description="Fetch Polymarket historical markets")
    parser.add_argument("--limit",         type=int, default=10_000, help="Max markets to fetch")
    parser.add_argument("--push-supabase", action="store_true",      help="Push results to Supabase")
    parser.add_argument("--output",        type=str, default=None,   help="Output parquet path")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = args.output or os.path.join(OUTPUT_DIR, "markets_history.parquet")

    print(f"Fetching up to {args.limit} resolved markets from Polymarket Gamma API...")
    markets = []
    
    for raw in fetch_closed_markets(limit=args.limit):
        try:
            markets.append(parse_market(raw))
        except Exception as e:
            print(f"  Warning: failed to parse market {raw.get('id')}: {e}")
    
    df = pd.DataFrame(markets)
    df = df.drop_duplicates(subset="id")
    
    # Basic stats
    print(f"\nFetched {len(df)} markets:")
    print(f"  Disputed:  {(df['resolution_state'] == 'DISPUTED').sum()}")
    print(f"  Resolved:  {(df['resolution_state'] == 'RESOLVED').sum()}")
    print(f"  Other:     {(~df['resolution_state'].isin(['DISPUTED','RESOLVED'])).sum()}")
    print(f"  Total USD volume: ${df['volume_usd'].sum():,.0f}")

    df.to_parquet(out_path, index=False)
    print(f"\nSaved to: {out_path}")

    if args.push_supabase:
        print("Pushing to Supabase...")
        push_to_supabase(df)
        print("Done.")


if __name__ == "__main__":
    main()
