import { Agent, Connection } from "agents";

interface Env {
    AGENT: DurableObjectNamespace;
}

interface ArbitrageOpportunity {
    id: string;
    question: string;
    polymarketPrice: number;
    kalshiPrice: number;
    profitMargin: number;
    volume: number;
    platform1: string;
    platform2: string;
}

interface State {
    opportunities: ArbitrageOpportunity[];
    lastScan: number;
    scanCount: number;
    botActive: boolean;
    scanHistory: Array<{ timestamp: number; opportunitiesFound: number }>;
}

export class ArbitrageBot extends Agent<Env, State> {
    initialState: State = {
        opportunities: [],
        lastScan: 0,
        scanCount: 0,
        botActive: false,
        scanHistory: [],
    };

    async onStart() {
        console.log("ArbitrageBot started with state:", this.state);

        // Resume scheduled scans if bot was active
        if (this.state.botActive) {
            await this.schedule("*/5 * * * *", "performScan", {});
            console.log("Resumed scheduled scans (every 5 minutes)");
        }
    }

    async onConnect(connection: Connection) {
        // Send current state to newly connected client
        connection.send(JSON.stringify({
            type: "state_sync",
            state: this.state,
        }));
    }

    async onMessage(connection: Connection, message: string) {
        const data = JSON.parse(message);

        switch (data.type) {
            case "start_bot":
                await this.startBot(connection);
                break;

            case "stop_bot":
                await this.stopBot(connection);
                break;

            case "manual_scan":
                await this.performScan();
                connection.send(JSON.stringify({ type: "scan_triggered" }));
                break;

            case "get_state":
                connection.send(JSON.stringify({
                    type: "state_sync",
                    state: this.state,
                }));
                break;
        }
    }

    async startBot(connection: Connection) {
        // Schedule recurring scans every 5 minutes
        await this.schedule("*/5 * * * *", "performScan", {});

        this.setState({
            ...this.state,
            botActive: true,
        });

        connection.send(JSON.stringify({
            type: "bot_started",
            message: "Bot activated. Scanning every 5 minutes.",
        }));

        // Perform immediate scan
        await this.performScan();
    }

    async stopBot(connection: Connection) {
        // Cancel all scheduled tasks
        const schedules = await this.getSchedules();
        for (const schedule of schedules) {
            await this.cancelSchedule(schedule.id);
        }

        this.setState({
            ...this.state,
            botActive: false,
        });

        connection.send(JSON.stringify({
            type: "bot_stopped",
            message: "Bot deactivated. Scheduled scans stopped.",
        }));
    }

    async performScan() {
        console.log("Performing arbitrage scan...");

        try {
            // Fetch opportunities from our API
            const opportunities = await this.scanArbitrageOpportunities();

            const scanResult = {
                timestamp: Date.now(),
                opportunitiesFound: opportunities.length,
            };

            // Update state
            this.setState({
                ...this.state,
                opportunities,
                lastScan: Date.now(),
                scanCount: this.state.scanCount + 1,
                scanHistory: [...this.state.scanHistory.slice(-9), scanResult], // Keep last 10
            });

            // Broadcast to all connected clients
            this.broadcast(JSON.stringify({
                type: "scan_complete",
                opportunities,
                scanCount: this.state.scanCount,
                timestamp: Date.now(),
            }));

            console.log(`Scan complete: ${opportunities.length} opportunities found`);
        } catch (error) {
            console.error("Scan error:", error);

            this.broadcast(JSON.stringify({
                type: "scan_error",
                error: error.message,
                timestamp: Date.now(),
            }));
        }
    }

    async scanArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
        // In production, this would call your actual API
        // For now, return mock data - replace with actual API call

        // Example: const response = await fetch('https://your-api.com/api/arbitrage/scan');
        // const data = await response.json();
        // return data.opportunities;

        // Mock opportunities for testing
        return [
            {
                id: "mock-1",
                question: "Will Bitcoin reach $100k in 2026?",
                polymarketPrice: 0.65,
                kalshiPrice: 0.58,
                profitMargin: 7.0,
                volume: 125000,
                platform1: "Polymarket",
                platform2: "Kalshi",
            },
            {
                id: "mock-2",
                question: "Will Trump win 2026 election?",
                polymarketPrice: 0.52,
                kalshiPrice: 0.48,
                profitMargin: 4.0,
                volume: 250000,
                platform1: "Polymarket",
                platform2: "Kalshi",
            },
        ];
    }
}

// Worker entrypoint
const worker = {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Route WebSocket upgrades to the agent
        if (url.pathname === "/ws") {
            const agentId = url.searchParams.get("id") || "default-agent";
            const id = env.AGENT.idFromName(agentId);
            const stub = env.AGENT.get(id);
            return stub.fetch(request);
        }

        // Health check endpoint
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", service: "arbitrage-agent" }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response("ArbitrageBot Agent - Use /ws?id=<agent-id> for WebSocket connection", {
            status: 200,
        });
    },
};

export default worker;
