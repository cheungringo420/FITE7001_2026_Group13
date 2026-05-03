# Execution Service Architecture

## Goals
- Execute cross-platform arbitrage safely and deterministically.
- Keep exchange API credentials and signing keys off the client.
- Provide auditable order lifecycle and risk controls.
- Support automated and manual execution flows.

## Trust Boundaries
- **Client (untrusted):** UI and wallet interactions only. Never receives exchange credentials.
- **API Gateway (semi-trusted):** Authenticates user, issues short-lived execution tokens.
- **Execution Service (trusted):** Holds exchange credentials, signs orders, enforces risk policy.
- **Key Management (trusted):** HSM/Secrets Manager for Kalshi RSA key and Polymarket API key material.
- **Data Ingest (trusted):** Normalizes market data and streams into cache for pricing and risk checks.

## Components
1. **Execution Service**
   - Stateless order router
   - Risk engine (pre-trade + post-trade)
   - Execution strategy (split, IOC/FOK, retry rules)
2. **Order Orchestrator**
   - Tracks multi-leg orders
   - Handles partial fills and rollback/hedge
3. **Risk Engine**
   - Max notional per trade, per day
   - Price slippage limits
   - Platform availability checks
   - Market resolution criteria match validation
4. **Credential Vault**
   - Stores Polymarket API credentials and Kalshi RSA private key
   - Rotation hooks
5. **Audit & Ledger**
   - Immutable log of execution requests, orders, fills, cancellations

## Data Flow
1. Client requests execution plan with target market IDs and max spend.
2. Execution Service validates market equivalence and quotes.
3. Client approves plan and signs a short-lived execution token.
4. Execution Service places orders on both platforms.
5. Order Orchestrator monitors fill status and resolves partials.
6. Result is posted back to client and stored in audit log.

## Minimal API Spec (REST)

### `POST /v1/execution/quote`
Request:
```json
{
  "legs": [
    {
      "platform": "polymarket",
      "marketId": "<conditionId>",
      "side": "yes|no",
      "action": "buy|sell",
      "size": 50,
      "limitPrice": 0.47
    },
    {
      "platform": "kalshi",
      "marketId": "<ticker>",
      "side": "yes|no",
      "action": "buy|sell",
      "size": 50,
      "limitPrice": 0.53
    }
  ],
  "maxNotional": 50,
  "ttlMs": 10000,
  "marketMatchKey": "poly:EVENT-123|kalshi:EVENT-ABC",
  "allowHeuristic": false
}
```
Response:
```json
{
  "quoteId": "q_123",
  "expiresAt": "2026-02-04T12:00:10Z",
  "estimatedProfit": 2.1,
  "validation": {
    "marketMatch": "strict",
    "riskStatus": "ok"
  }
}
```

### `POST /v1/execution/submit`
Request:
```json
{
  "quoteId": "q_123",
  "executionToken": "<jwt>",
  "clientNonce": "<uuid>"
}
```
Response:
```json
{
  "executionId": "x_456",
  "status": "submitted",
  "legs": [
    { "platform": "polymarket", "orderId": "p_1", "status": "open" },
    { "platform": "kalshi", "orderId": "k_1", "status": "open" }
  ]
}
```

### `GET /v1/execution/:executionId`
Response:
```json
{
  "executionId": "x_456",
  "status": "partially_filled|filled|failed|cancelled",
  "fills": [
    { "platform": "polymarket", "filled": 20, "avgPrice": 0.48 },
    { "platform": "kalshi", "filled": 20, "avgPrice": 0.52 }
  ],
  "profitRealized": 1.8
}
```

### `POST /v1/execution/:executionId/cancel`
Response:
```json
{ "status": "cancelled" }
```

## Security Controls
- JWT execution token scoped to `quoteId`, TTL 30s
- Per-user rate limiting and max notional caps
- Order placement only from allowlisted server IPs
- Secrets stored in KMS/HSM with rotation and audit
- Integrity checks: enforce market resolution criteria matching

## Observability
- Structured logs for every request/response
- Order latency metrics and fill-rate dashboards
- Alerting on partial fills, slippage breaches, and API errors
