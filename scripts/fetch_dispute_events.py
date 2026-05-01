#!/usr/bin/env python3
"""
Step 3: Fetch UMA Optimistic Oracle dispute events from Dune Analytics.
These are the ground-truth labels: which markets were actually disputed?

Approach A (recommended): Dune Analytics API — pre-built query
Approach B (fallback): Goldsky subgraph for Polygon UMA OptimisticOracle

Usage:
  python3 scripts/fetch_dispute_events.py --source dune --api-key YOUR_DUNE_KEY
  python3 scripts/fetch_dispute_events.py --source gamma  # No API key needed
"""
import argparse
import os
import time
from typing import Optional

import httpx
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DATA_DIR    = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "dispute_events.parquet")

# ── Approach A: Dune Analytics ────────────────────────────────
# Public Dune query: UMA OptimisticOracle DisputePrice events on Polygon
# Query: https://dune.com/queries/3456789 (substitute your own or use existing public query)
DUNE_QUERY_ID = os.environ.get("DUNE_POLYMARKET_DISPUTE_QUERY_ID", "3456789")

def fetch_from_dune(api_key: str, query_id: str) -> list[dict]:
    """Execute a Dune Analytics query and return results."""
    headers = {"X-Dune-API-Key": api_key}
    base = "https://api.dune.com/api/v1"

    # Trigger execution
    resp = httpx.post(f"{base}/query/{query_id}/execute", headers=headers, timeout=30)
    resp.raise_for_status()
    execution_id = resp.json()["execution_id"]
    print(f"  Dune execution started: {execution_id}")

    # Poll until complete
    for attempt in range(60):
        time.sleep(5)
        status_resp = httpx.get(f"{base}/execution/{execution_id}/status", headers=headers)
        status = status_resp.json().get("state", "")
        print(f"  Status: {status} ({attempt+1}/60)")
        if status == "QUERY_STATE_COMPLETED":
            break
        if status in ("QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED"):
            raise RuntimeError(f"Dune query failed: {status}")

    # Fetch results
    results_resp = httpx.get(f"{base}/execution/{execution_id}/results", headers=headers, timeout=60)
    results_resp.raise_for_status()
    return results_resp.json().get("result", {}).get("rows", [])


# ── Approach B: Gamma API (simpler, no on-chain parsing needed) ──
# Polymarket Gamma API marks disputed markets in the market object
def fetch_disputes_from_gamma(markets_path: str) -> list[dict]:
    """
    Extract dispute information directly from the markets_history parquet.
    Markets with resolution_state == 'DISPUTED' are our dispute events.
    This is the fallback when Dune API key is not available.
    """
    print("  Using Gamma API dispute markers from markets_history.parquet...")
    df = pd.read_parquet(markets_path)
    
    disputed = df[df["resolution_state"] == "DISPUTED"].copy()
    
    events = []
    for _, row in disputed.iterrows():
        events.append({
            "market_id":         row["id"],
            "dispute_tx_hash":   f"gamma_{row['id']}",   # surrogate key
            "disputer_wallet":   None,
            "proposer_wallet":   None,
            "bond_amount_usdc":  None,
            "disputed_at":       row.get("resolved_at"),
            "block_number":      None,
            "question_id":       row["id"],
            "outcome":           "disputed",
            "dvm_escalated":     False,
            "source":            "gamma_api",
        })
    
    print(f"  Found {len(events)} disputed markets from Gamma API")
    return events


# ── Approach C: Goldsky Subgraph (on-chain via GraphQL) ─────────
GOLDSKY_ENDPOINT = "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/uma/0.0.1/gn"

UMA_DISPUTE_QUERY = """
query DisputeEvents($skip: Int!, $first: Int!) {
  disputePriceEvents(first: $first, skip: $skip, orderBy: blockTimestamp, orderDirection: desc) {
    id
    transactionHash
    disputer
    proposer
    blockTimestamp
    blockNumber
    requester
    identifier
    ancillaryData
    proposedPrice
    disputedPrice
  }
}
"""

def fetch_from_goldsky(limit: int = 5000) -> list[dict]:
    """Query UMA OptimisticOracle dispute events from Goldsky subgraph."""
    events = []
    skip = 0
    batch = 1000
    
    with httpx.Client(timeout=30) as client:
        while len(events) < limit:
            resp = client.post(
                GOLDSKY_ENDPOINT,
                json={"query": UMA_DISPUTE_QUERY, "variables": {"skip": skip, "first": batch}},
            )
            resp.raise_for_status()
            data = resp.json().get("data", {}).get("disputePriceEvents", [])
            if not data:
                break
            
            for evt in data:
                # Try to decode ancillaryData to find Polymarket market ID
                anc = evt.get("ancillaryData", "")
                question_id = None
                if anc and anc.startswith("0x"):
                    try:
                        decoded = bytes.fromhex(anc[2:]).decode("utf-8", errors="ignore")
                        # Polymarket ancillaryData format: "q: title \n...\n id: <marketId>"
                        for part in decoded.split("\n"):
                            if "id:" in part.lower():
                                question_id = part.split("id:")[-1].strip().rstrip('"').strip()
                    except Exception:
                        pass
                
                events.append({
                    "market_id":        None,   # linked in join step
                    "dispute_tx_hash":  evt["transactionHash"],
                    "disputer_wallet":  evt["disputer"],
                    "proposer_wallet":  evt["proposer"],
                    "bond_amount_usdc": None,
                    "disputed_at":      pd.Timestamp(int(evt["blockTimestamp"]), unit="s", tz="UTC").isoformat(),
                    "block_number":     int(evt["blockNumber"]),
                    "question_id":      question_id,
                    "outcome":          "unknown",
                    "dvm_escalated":    False,
                    "source":           "goldsky",
                })
            
            skip += len(data)
            print(f"  Fetched {len(events)} dispute events so far...")
            time.sleep(0.2)
    
    return events


def push_to_supabase(df: pd.DataFrame) -> None:
    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)
    
    records = df.where(df.notna(), None).to_dict(orient="records")
    batch_size = 500
    for i in range(0, len(records), batch_size):
        client.table("dispute_events").upsert(
            records[i:i+batch_size], on_conflict="dispute_tx_hash"
        ).execute()
        print(f"  Pushed {min(i+batch_size, len(records))}/{len(records)} events")


def main():
    parser = argparse.ArgumentParser(description="Fetch dispute events")
    parser.add_argument("--source", choices=["dune", "gamma", "goldsky"], default="gamma",
                        help="Data source for dispute events")
    parser.add_argument("--api-key",       type=str, default=None, help="Dune API key")
    parser.add_argument("--query-id",      type=str, default=DUNE_QUERY_ID, help="Dune query ID")
    parser.add_argument("--push-supabase", action="store_true")
    parser.add_argument("--limit",         type=int, default=5000)
    parser.add_argument("--output",        type=str, default=OUTPUT_FILE)
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)
    
    if args.source == "dune":
        api_key = args.api_key or os.environ.get("DUNE_API_KEY")
        if not api_key:
            raise ValueError("--api-key or DUNE_API_KEY env var required for Dune source")
        print("Fetching dispute events from Dune Analytics...")
        events = fetch_from_dune(api_key, args.query_id)
    elif args.source == "goldsky":
        print("Fetching dispute events from Goldsky subgraph (Polygon on-chain)...")
        events = fetch_from_goldsky(limit=args.limit)
    else:  # gamma
        markets_path = os.path.join(DATA_DIR, "markets_history.parquet")
        events = fetch_disputes_from_gamma(markets_path)

    df = pd.DataFrame(events)
    print(f"\nTotal dispute events: {len(df)}")
    df.to_parquet(args.output, index=False)
    print(f"Saved to: {args.output}")

    if args.push_supabase:
        push_to_supabase(df)


if __name__ == "__main__":
    main()
