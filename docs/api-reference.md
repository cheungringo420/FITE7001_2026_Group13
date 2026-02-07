# PM Arbitrage — API Reference (with Sample JSON)

Base path: `/api`

## 1. Markets

### `GET /api/markets`
Query: `limit`, `order`, `ascending`
```json
[
  {
    "conditionId": "0xabc123",
    "question": "Will SPY close above $500 by Feb 19?",
    "category": "Finance",
    "active": true,
    "closed": false,
    "volume": "125000",
    "volume24hr": 8420,
    "outcomePrices": [0.42, 0.58],
    "slug": "spy-above-500"
  }
]
```

### `GET /api/markets/[conditionId]`
```json
{
  "conditionId": "0xabc123",
  "question": "Will SPY close above $500 by Feb 19?",
  "category": "Finance",
  "active": true,
  "closed": false,
  "volume": "125000",
  "volume24hr": 8420,
  "outcomePrices": [0.42, 0.58],
  "slug": "spy-above-500"
}
```

### `GET /api/kalshi/markets`
Query: `limit`
```json
{
  "markets": [
    {
      "id": "KQQQ-26FEB19",
      "question": "Will QQQ trade above $420 by Feb 19?",
      "category": "Finance",
      "yesPrice": 0.55,
      "noPrice": 0.45,
      "volume24h": 1200,
      "volume": 32000,
      "status": "active",
      "url": "https://kalshi.com/markets/KQQQ-26FEB19"
    }
  ]
}
```

### `GET /api/kalshi/orderbook/[ticker]`
```json
{
  "market_ticker": "KQQQ-26FEB19",
  "yes": { "bids": [[55, 10]], "asks": [[57, 12]] },
  "no": { "bids": [[43, 9]], "asks": [[45, 8]] }
}
```

### `GET /api/orderbook/[tokenId]`
```json
{
  "market": "0xabc123",
  "asset_id": "0xasset1",
  "bids": [[0.42, 200]],
  "asks": [[0.43, 180]]
}
```

## 2. Compare / Matching

### `GET /api/markets/compare`
Query: `strict=true|false`
```json
{
  "matchedPairs": [
    {
      "id": "0xabc123-KQQQ-26FEB19",
      "similarity": 0.78,
      "flagged": false,
      "alignmentBreakdown": {
        "score": 0.82,
        "criteria": {
          "explicitDate": { "polymarket": true, "kalshi": true, "match": true },
          "objectiveThreshold": { "polymarket": true, "kalshi": true, "match": true },
          "resolutionWording": { "polymarket": true, "kalshi": false, "match": false },
          "timeWindow": { "polymarket": "feb 19", "kalshi": "feb 19", "match": true },
          "ambiguityFlags": { "polymarket": [], "kalshi": ["likely"], "match": false }
        },
        "clarity": { "polymarket": 0.7, "kalshi": 0.6 }
      },
      "polymarket": { "id": "0xabc123", "question": "Will SPY close above $500 by Feb 19?" },
      "kalshi": { "id": "KQQQ-26FEB19", "question": "Will QQQ trade above $420 by Feb 19?" },
      "arbitrage": null
    }
  ],
  "unmatchedPolymarket": [],
  "unmatchedKalshi": [],
  "polymarketCount": 100,
  "kalshiCount": 100,
  "fetchedAt": "2026-02-07T03:12:00.000Z",
  "matchingMethod": "semantic"
}
```

## 3. Arbitrage

### `GET /api/arbitrage/scan`
Query: `strict=true|false`
```json
{
  "opportunities": [
    {
      "id": "0xabc123-KQQQ-26FEB19-1738900000",
      "question": "Will SPY close above $500 by Feb 19?",
      "type": "cross-platform",
      "strategy": "buy-yes-a-no-b",
      "platform1": { "name": "polymarket", "marketId": "0xabc123", "yesPrice": 0.42, "noPrice": 0.58 },
      "platform2": { "name": "kalshi", "marketId": "KQQQ-26FEB19", "yesPrice": 0.55, "noPrice": 0.45 },
      "profitPercentage": 3.1,
      "totalCost": 0.97,
      "guaranteedProfit": 0.03,
      "detectedAt": "2026-02-07T03:12:10.000Z"
    }
  ],
  "matchedMarkets": 14,
  "polymarketCount": 100,
  "kalshiCount": 100,
  "scannedAt": "2026-02-07T03:12:10.000Z"
}
```

## 4. Trust Engine

### `GET /api/trust/summary`
Query: `platform`, `limit`, `minTrust`
```json
{
  "items": [
    {
      "marketId": "0xabc123",
      "platform": "polymarket",
      "question": "Will SPY close above $500 by Feb 19?",
      "category": "Finance",
      "trustScore": 72,
      "resolutionConfidence": 70,
      "disputeRisk": 25,
      "integrityRisk": 15,
      "evidenceCount": 4,
      "updatedAt": "2026-02-07T03:10:00.000Z"
    }
  ]
}
```

### `GET /api/trust/market`
```json
{
  "analysis": {
    "trustScore": 72,
    "resolutionConfidence": 70,
    "disputeRisk": 25,
    "integrityRisk": 15,
    "evidenceCount": 4,
    "criteria": {
      "hasExplicitDate": true,
      "hasObjectiveThreshold": true,
      "hasResolutionWording": true,
      "ambiguityFlags": []
    },
    "evidence": [
      {
        "id": "ev1",
        "title": "Macro indicator suggests SPY growth",
        "summary": "Data indicates upward trend.",
        "publishedAt": "2026-02-01T00:00:00.000Z",
        "reliability": 0.8,
        "similarity": 0.7,
        "weight": 0.56
      }
    ],
    "consensusScore": 0.62,
    "agreementScore": 0.55
  }
}
```

### `POST /api/trust/refresh`
```json
{ "status": "ok", "refreshed": 120 }
```

### `GET /api/trust/scheduler`
```json
{ "running": true, "intervalMs": 900000, "lastRun": "2026-02-07T03:00:00.000Z" }
```

### `GET /api/trust/sources`
```json
{
  "sources": [
    { "id": "reuters", "name": "Reuters" },
    { "id": "wsj", "name": "WSJ" }
  ]
}
```

### `POST /api/trust/warmup`
```json
{ "status": "ok" }
```

## 5. Execution (Paper Trade)

### `POST /api/execution/quote`
```json
{
  "quoteId": "q_123",
  "expiresAt": "2026-02-07T03:15:00.000Z",
  "estimatedProfit": 0.03,
  "validation": { "marketMatch": "strict", "matchStatus": "ok", "riskStatus": "ok" }
}
```

### `POST /api/execution/submit`
```json
{
  "executionId": "x_123",
  "status": "submitted",
  "createdAt": "2026-02-07T03:15:05.000Z",
  "legs": [
    { "platform": "polymarket", "orderId": "polymarket_x_123_0", "status": "open" }
  ]
}
```

### `GET /api/execution/[executionId]`
```json
{
  "executionId": "x_123",
  "status": "filled",
  "profitRealized": 0.03
}
```

### `POST /api/execution/[executionId]/cancel`
```json
{ "status": "cancelled", "executionId": "x_123" }
```

## 6. Feedback Loop

### `POST /api/feedback/match`
```json
{
  "entry": {
    "id": "0xabc123|KQQQ-26FEB19",
    "polymarketId": "0xabc123",
    "kalshiId": "KQQQ-26FEB19",
    "status": "mismatch",
    "reason": "user-flag",
    "createdAt": "2026-02-07T03:12:00.000Z",
    "updatedAt": "2026-02-07T03:12:00.000Z"
  }
}
```

### `GET /api/feedback/match`
```json
{
  "entries": [
    { "id": "0xabc123|KQQQ-26FEB19", "status": "mismatch" }
  ]
}
```

## 7. Streaming

### `GET /api/stream/markets` (SSE)
Example event payload:
```json
{
  "polymarket": [{ "conditionId": "0xabc123", "question": "Will SPY close above $500 by Feb 19?" }],
  "kalshi": [{ "id": "KQQQ-26FEB19", "question": "Will QQQ trade above $420 by Feb 19?" }]
}
```

