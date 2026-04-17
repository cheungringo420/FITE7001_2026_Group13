"""
Orderbook-depth slippage model.

Walks a price-sorted book to compute the volume-weighted average fill price
of a market order. Supports either a list of BookLevel objects or a snapshot
dict of {"bids": [(price, size), ...], "asks": [(price, size), ...]}.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BookLevel:
    price: float
    size: float


class OrderbookSlippageModel:
    """Walk an orderbook to compute VWAP fill + slippage."""

    def fill(self, size: float, book: list[BookLevel], side: str) -> dict:
        """
        Simulate a market order of `size` consuming levels in order.

        `book` must already be sorted: asks ascending (for buy), bids descending (for sell).
        Returns avg_price, slippage, fill_fraction, filled_size.
        """
        if size <= 0 or not book:
            return {"avg_price": 0.0, "slippage": 0.0, "fill_fraction": 0.0, "filled_size": 0.0}

        remaining = size
        notional = 0.0
        filled = 0.0
        top = book[0].price

        for level in book:
            take = min(level.size, remaining)
            notional += take * level.price
            filled += take
            remaining -= take
            if remaining <= 0:
                break

        if filled == 0:
            return {"avg_price": 0.0, "slippage": 0.0, "fill_fraction": 0.0, "filled_size": 0.0}

        avg_price = notional / filled
        if side == "buy":
            slippage = avg_price - top
        else:
            slippage = top - avg_price

        return {
            "avg_price": avg_price,
            "slippage": slippage,
            "fill_fraction": filled / size,
            "filled_size": filled,
        }

    def estimate(self, order_size: float, side: str, snapshot: dict) -> dict:
        """
        Compute fill from a snapshot dict. Chooses asks for buy, bids for sell.
        Snapshot levels may be (price, size) tuples or dicts.
        """
        side_key = "asks" if side == "buy" else "bids"
        raw = snapshot.get(side_key, [])
        levels = [BookLevel(price=float(p), size=float(s)) for p, s in _iter_levels(raw)]
        return self.fill(order_size, levels, side)


def _iter_levels(raw):
    for item in raw:
        if isinstance(item, dict):
            yield item["price"], item["size"]
        else:
            yield item[0], item[1]
