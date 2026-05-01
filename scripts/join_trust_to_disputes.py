#!/usr/bin/env python3
"""
Step 4: Join trust scores with dispute events to create the analysis dataset.
Output: data/trust_with_disputes.parquet

Usage:
  python3 scripts/join_trust_to_disputes.py
"""
import os
import pandas as pd

DATA_DIR    = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "trust_with_disputes.parquet")


def main():
    print("Loading trust scores...")
    trust_df = pd.read_parquet(os.path.join(DATA_DIR, "trust_scores_historical.parquet"))
    print(f"  {len(trust_df)} scored markets")

    print("Loading dispute events...")
    dispute_df = pd.read_parquet(os.path.join(DATA_DIR, "dispute_events.parquet"))
    print(f"  {len(dispute_df)} dispute events")

    # Get set of disputed market IDs
    disputed_ids = set(dispute_df["market_id"].dropna().unique())
    print(f"  {len(disputed_ids)} unique disputed market IDs")

    # Load market metadata for additional context
    markets_df = pd.read_parquet(os.path.join(DATA_DIR, "markets_history.parquet"))

    # Join
    merged = trust_df.merge(
        markets_df[["id", "question", "category", "resolved_at",
                    "resolution_state", "volume_usd", "liquidity_usd"]],
        left_on="market_id",
        right_on="id",
        how="left",
    )

    # Binary label: was this market disputed?
    merged["disputed"] = merged["market_id"].isin(disputed_ids).astype(int)
    
    # Also flag markets where resolution_state == DISPUTED from Gamma API
    merged["disputed"] = merged.apply(
        lambda r: 1 if (
            r["disputed"] == 1 or
            str(r.get("resolution_state", "")).upper() == "DISPUTED"
        ) else 0,
        axis=1,
    )

    print(f"\nJoined dataset: {len(merged)} markets")
    print(f"  Disputed:     {merged['disputed'].sum()} ({merged['disputed'].mean()*100:.2f}%)")
    print(f"  Not disputed: {(merged['disputed'] == 0).sum()}")

    # Basic sanity check
    print("\nDispute rate by trust score decile (preview):")
    merged["decile"] = pd.cut(merged["composite_score"], bins=10, labels=False)
    preview = merged.groupby("decile")["disputed"].agg(["mean", "count"]).round(4)
    print(preview.to_string())

    merged.drop(columns=["id"], errors="ignore").to_parquet(OUTPUT_FILE, index=False)
    print(f"\nSaved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
