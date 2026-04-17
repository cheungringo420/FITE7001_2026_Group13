"""Orderbook-depth-based slippage: walk the book to compute average fill price."""

import pytest

from backtest.engine.orderbook_slippage import OrderbookSlippageModel, BookLevel


@pytest.fixture
def buy_book():
    """Ask-side book with increasing price levels (what a buyer walks)."""
    return [
        BookLevel(price=0.50, size=100),
        BookLevel(price=0.51, size=200),
        BookLevel(price=0.53, size=500),
        BookLevel(price=0.55, size=1000),
    ]


def test_zero_size_order_has_zero_slippage(buy_book):
    model = OrderbookSlippageModel()
    result = model.fill(size=0, book=buy_book, side="buy")
    assert result["avg_price"] == 0.0
    assert result["slippage"] == 0.0
    assert result["fill_fraction"] == 0.0


def test_order_within_top_level_fills_at_top(buy_book):
    """Small order (<= top-level size) fills entirely at the top price."""
    model = OrderbookSlippageModel()
    result = model.fill(size=50, book=buy_book, side="buy")
    assert result["avg_price"] == pytest.approx(0.50)
    assert result["slippage"] == pytest.approx(0.0)
    assert result["fill_fraction"] == pytest.approx(1.0)


def test_order_walks_multiple_levels(buy_book):
    """Order larger than top level must walk the book and pay a VWAP > top."""
    model = OrderbookSlippageModel()
    # 250 units: 100 @ 0.50 + 150 @ 0.51 = 50 + 76.5 = 126.5, avg = 0.506
    result = model.fill(size=250, book=buy_book, side="buy")
    expected_avg = (100 * 0.50 + 150 * 0.51) / 250
    assert result["avg_price"] == pytest.approx(expected_avg)
    assert result["slippage"] == pytest.approx(expected_avg - 0.50)
    assert result["fill_fraction"] == pytest.approx(1.0)


def test_order_exceeding_book_returns_partial_fill(buy_book):
    """Order larger than total book size should return fill_fraction < 1."""
    model = OrderbookSlippageModel()
    total_size = sum(lvl.size for lvl in buy_book)  # 1800
    result = model.fill(size=total_size + 500, book=buy_book, side="buy")
    assert result["fill_fraction"] == pytest.approx(total_size / (total_size + 500))


def test_sell_side_walks_bids_downward():
    """On sell, book is bids (descending price)."""
    sell_book = [
        BookLevel(price=0.50, size=100),
        BookLevel(price=0.49, size=200),
        BookLevel(price=0.47, size=500),
    ]
    model = OrderbookSlippageModel()
    result = model.fill(size=250, book=sell_book, side="sell")
    # Seller gets a worse (lower) price as they walk down bids
    expected = (100 * 0.50 + 150 * 0.49) / 250
    assert result["avg_price"] == pytest.approx(expected)
    # Slippage for sell = top_price - avg_price (positive = worse for seller)
    assert result["slippage"] == pytest.approx(0.50 - expected)


def test_slippage_scales_with_order_size(buy_book):
    """Bigger order → worse average price."""
    model = OrderbookSlippageModel()
    small = model.fill(size=100, book=buy_book, side="buy")
    large = model.fill(size=800, book=buy_book, side="buy")
    assert large["slippage"] > small["slippage"]


def test_estimate_from_snapshot_uses_volume_weighted_price():
    """When given a flat snapshot, estimate should match top-of-book for tiny orders."""
    model = OrderbookSlippageModel()
    snapshot = {"bids": [(0.48, 1000), (0.47, 500)], "asks": [(0.50, 1000), (0.52, 500)]}
    result = model.estimate(order_size=10, side="buy", snapshot=snapshot)
    assert result["avg_price"] == pytest.approx(0.50)
