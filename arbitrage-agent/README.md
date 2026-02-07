# ArbitrageBot Agent - Local Development Guide

## Quick Start

### 1. Start the Agent (Local Development)

```bash
cd /Users/ringocheung/project_v2/arbitrage-agent
npm run dev
```

Agent runs at: `http://localhost:8787`

### 2. Test WebSocket Connection

```bash
# In a new terminal
wscat -c "ws://localhost:8787/ws?id=test-agent"

# Send commands:
{"type":"start_bot"}
{"type":"manual_scan"}
{"type":"stop_bot"}
{"type":"get_state"}
```

### 3. Health Check

```bash
curl http://localhost:8787/health
# Response: {"status":"ok","service":"arbitrage-agent"}
```

## Frontend Integration

### Option A: Local Agent (Development)

Add to `/src/app/bot/page.tsx`:

```tsx
'use client';

import { useArbitrageAgent } from '@/hooks/useArbitrageAgent';

export default function BotPage() {
  const { state, connected, loading, startBot, stopBot, manualScan } = useArbitrageAgent(
    'ws://localhost:8787',
    'my-bot-1'
  );

  return (
    <div>
      {connected ? '🟢 Connected' : '🔴 Disconnected'}
      
      <button onClick={startBot} disabled={state?.botActive}>
        Start Bot
      </button>
      
      <button onClick={stopBot} disabled={!state?.botActive}>
        Stop Bot
      </button>

      <div>
        <h3>Opportunities ({state?.opportunities.length || 0})</h3>
        {state?.opportunities.map(opp => (
          <div key={opp.id}>
            {opp.question} - Profit: {opp.profitMargin}%
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Option B: Deployed Agent (Production)

After deployment, update the WebSocket URL:

```tsx
const { state } = useArbitrageAgent(
  'wss://arbitrage-agent.<your-subdomain>.workers.dev',
  'my-bot-1'
);
```

## Deployment

### Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com
2. **Wrangler Login**:
   ```bash
   npx wrangler login
   ```

### Deploy Steps

```bash
cd /Users/ringocheung/project_v2/arbitrage-agent
npm run deploy
```

Output will show your Worker URL:
```
Published arbitrage-agent
  https://arbitrage-agent.<your-subdomain>.workers.dev
```

### Environment Variables

Add to `wrangler.toml`:

```toml
[vars]
API_BASE_URL = "https://your-main-app.com/api"
```

## Agent Features

### Scheduled Scans

- **Cron**: Every 5 minutes (`*/5 * * * *`)
- **Trigger**: Automatic when bot is active
- **Manual**: Send `{"type":"manual_scan"}` message

### State Persistence

State survives:
- Browser close/refresh
- Agent restarts
- Server deployments

### Real-time Updates

All connected clients receive:
- `scan_complete` - New opportunities found
- `bot_started` - Bot activated
- `bot_stopped` - Bot deactivated
- `scan_error` - Scan failed

## Testing

### Test Message Flow

1. Connect: WebSocket opens → receives `state_sync`
2. Start Bot: Send `start_bot` → receives `bot_started` + immediate scan
3. Wait 5 min: Auto scan → receives `scan_complete`
4. Stop Bot: Send `stop_bot` → receives `bot_stopped`

### Verify Persistence

1. Start bot
2. Close browser/disconnect WebSocket
3. Wait 5 minutes
4. Reconnect → `scanCount` should have increased

## Production Considerations

### Replace Mock Data

In `src/index.ts`, replace `scanArbitrageOpportunities()`:

```typescript
async scanArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
  // Call your actual API
  const response = await fetch('https://your-api.com/api/arbitrage/scan');
  const data = await response.json();
  return data.opportunities;
}
```

### Add SQL Storage (Optional)

```typescript
// In onStart()
await this.sql.exec(`
  CREATE TABLE IF NOT EXISTS trade_history (
    id INTEGER PRIMARY KEY,
    opportunity_id TEXT,
    timestamp INTEGER,
    profit REAL
  )
`);

// In performScan()
for (const opp of opportunities) {
  await this.sql.exec(
    'INSERT INTO trade_history VALUES (?, ?, ?, ?)',
    [null, opp.id, Date.now(), opp.profitMargin]
  );
}
```

### Monitor Logs

```bash
npx wrangler tail arbitrage-agent
```

## Cost

- **Free Tier**: 100,000 requests/day
- **Paid Plan**: $5/month for unlimited requests
- **Durable Objects**: $0.15/million requests

**Estimated monthly cost for this agent**: ~$0.50 - $2.00

## Troubleshooting

### "Module not found: agents"

```bash
cd arbitrage-agent
npm install
```

### "WebSocket connection failed"

- Check agent is running: `npm run dev`
- Verify URL: `ws://localhost:8787/ws?id=test`
- Check browser console for CORS errors

### "Scheduled task not firing"

- Verify bot is active: `state.botActive === true`
- Check wrangler logs: `npx wrangler tail`
- Cron syntax: `*/5 * * * *` (every 5 min)

## Next Steps

1. **Local Testing**: Start agent + test WebSocket
2. **Frontend Integration**: Update bot page to use hook
3. **Deploy**: `npm run deploy` when ready
4. **Production API**: Replace mock data with real scan logic
