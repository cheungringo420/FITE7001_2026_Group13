"""
Data loader for prediction market and traditional market data.
Fetches and caches data from Polymarket, Kalshi, and yfinance.
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np
import requests
import yfinance as yf
import yaml


CACHE_DIR = Path(__file__).parent.parent / ".cache"


def _load_config() -> dict:
    config_path = Path(__file__).parent.parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def _cache_key(prefix: str, params: dict) -> str:
    raw = json.dumps(params, sort_keys=True)
    h = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"{prefix}_{h}"


def _read_cache(key: str, max_age_hours: int = 24) -> Optional[pd.DataFrame]:
    path = CACHE_DIR / f"{key}.parquet"
    if path.exists():
        age = datetime.now().timestamp() - path.stat().st_mtime
        if age < max_age_hours * 3600:
            return pd.read_parquet(path)
    return None


def _write_cache(key: str, df: pd.DataFrame):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(CACHE_DIR / f"{key}.parquet")


class DataLoader:
    """Fetches and caches prediction market + traditional market data."""

    def __init__(self, config: Optional[dict] = None):
        self.config = config or _load_config()

    # ── Polymarket ──────────────────────────────────────────────────

    def fetch_polymarket_resolved_markets(self, limit: int = 500) -> pd.DataFrame:
        """Fetch resolved markets from Polymarket Gamma API."""
        cache_key = _cache_key("poly_resolved", {"limit": limit})
        cached = _read_cache(cache_key, max_age_hours=12)
        if cached is not None:
            return cached

        url = self.config["data"]["polymarket_gamma_url"]
        all_markets = []
        offset = 0

        while len(all_markets) < limit:
            params = {
                "closed": "true",
                "limit": min(100, limit - len(all_markets)),
                "offset": offset,
            }
            try:
                resp = requests.get(url, params=params, timeout=30)
                resp.raise_for_status()
                batch = resp.json()
                if not batch:
                    break
                all_markets.extend(batch)
                offset += len(batch)
            except requests.RequestException as e:
                print(f"[DataLoader] Polymarket Gamma API error: {e}")
                break

        if not all_markets:
            return pd.DataFrame()

        df = pd.DataFrame(all_markets)
        _write_cache(cache_key, df)
        return df

    def fetch_polymarket_price_history(
        self, token_id: str, resolution: str = "1d"
    ) -> pd.DataFrame:
        """Fetch price history for a single Polymarket token."""
        cache_key = _cache_key("poly_price", {"token_id": token_id, "res": resolution})
        cached = _read_cache(cache_key, max_age_hours=6)
        if cached is not None:
            return cached

        url = f"{self.config['data']['polymarket_clob_url']}/prices-history"
        params = {"tokenID": token_id, "resolution": resolution}

        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as e:
            print(f"[DataLoader] Polymarket CLOB error for {token_id}: {e}")
            return pd.DataFrame()

        if not data or "history" not in data:
            return pd.DataFrame()

        df = pd.DataFrame(data["history"])
        if "t" in df.columns:
            df["date"] = pd.to_datetime(df["t"], unit="s", utc=True)
            df = df.set_index("date").sort_index()
        if "p" in df.columns:
            df = df.rename(columns={"p": "price"})
            df["price"] = df["price"].astype(float)

        _write_cache(cache_key, df)
        return df

    # ── Kalshi ──────────────────────────────────────────────────────

    def fetch_kalshi_resolved_markets(self, limit: int = 500) -> pd.DataFrame:
        """Fetch resolved/finalized markets from Kalshi API."""
        cache_key = _cache_key("kalshi_resolved", {"limit": limit})
        cached = _read_cache(cache_key, max_age_hours=12)
        if cached is not None:
            return cached

        base_url = self.config["data"]["kalshi_base_url"]
        url = f"{base_url}/markets"
        all_markets = []
        cursor = None

        while len(all_markets) < limit:
            params = {"status": "finalized", "limit": min(100, limit - len(all_markets))}
            if cursor:
                params["cursor"] = cursor

            try:
                resp = requests.get(url, params=params, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                markets = data.get("markets", [])
                if not markets:
                    break
                all_markets.extend(markets)
                cursor = data.get("cursor")
                if not cursor:
                    break
            except requests.RequestException as e:
                print(f"[DataLoader] Kalshi API error: {e}")
                break

        if not all_markets:
            return pd.DataFrame()

        df = pd.DataFrame(all_markets)
        _write_cache(cache_key, df)
        return df

    # ── Traditional Markets (yfinance) ──────────────────────────────

    def fetch_traditional_data(
        self,
        tickers: Optional[list] = None,
        start: str = "2024-01-01",
        end: Optional[str] = None,
    ) -> pd.DataFrame:
        """Fetch daily OHLCV for traditional tickers via yfinance."""
        tickers = tickers or self.config["tickers"]
        end = end or datetime.now().strftime("%Y-%m-%d")

        cache_key = _cache_key("trad", {"tickers": tickers, "start": start, "end": end})
        cached = _read_cache(cache_key, max_age_hours=12)
        if cached is not None:
            return cached

        dfs = {}
        for ticker in tickers:
            try:
                data = yf.download(ticker, start=start, end=end, progress=False)
                if not data.empty:
                    dfs[ticker] = data["Close"].rename(ticker)
            except Exception as e:
                print(f"[DataLoader] yfinance error for {ticker}: {e}")

        if not dfs:
            return pd.DataFrame()

        df = pd.DataFrame(dfs)
        df.index = pd.to_datetime(df.index)
        df.index.name = "date"
        _write_cache(cache_key, df)
        return df

    # ── Convenience ─────────────────────────────────────────────────

    def load_all(self) -> dict:
        """Load all data sources, return dict of DataFrames."""
        return {
            "polymarket_markets": self.fetch_polymarket_resolved_markets(),
            "kalshi_markets": self.fetch_kalshi_resolved_markets(),
            "traditional": self.fetch_traditional_data(),
        }
