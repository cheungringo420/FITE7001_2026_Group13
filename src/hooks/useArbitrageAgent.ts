'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

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

interface AgentState {
    opportunities: ArbitrageOpportunity[];
    lastScan: number;
    scanCount: number;
    botActive: boolean;
    scanHistory: Array<{ timestamp: number; opportunitiesFound: number }>;
}

interface UseArbitrageAgentReturn {
    state: AgentState | null;
    connected: boolean;
    loading: boolean;
    error: string | null;
    startBot: () => void;
    stopBot: () => void;
    manualScan: () => void;
}

export function useArbitrageAgent(agentUrl: string, agentId: string = 'default-agent'): UseArbitrageAgentReturn {
    const [state, setState] = useState<AgentState | null>(null);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

    const connect = useCallback(function connectImpl() {
        try {
            const wsUrl = `${agentUrl}/ws?id=${agentId}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Connected to ArbitrageBot agent');
                setConnected(true);
                setLoading(false);
                setError(null);

                // Request current state
                ws.send(JSON.stringify({ type: 'get_state' }));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'state_sync':
                        setState(data.state);
                        break;

                    case 'scan_complete':
                        setState(prev => prev ? {
                            ...prev,
                            opportunities: data.opportunities,
                            scanCount: data.scanCount,
                            lastScan: data.timestamp,
                        } : null);
                        break;

                    case 'bot_started':
                    case 'bot_stopped':
                        console.log(data.message);
                        break;

                    case 'scan_error':
                        console.error('Scan error:', data.error);
                        setError(data.error);
                        break;
                }
            };

            ws.onerror = (err) => {
                console.error('WebSocket error:', err);
                setError('Connection error');
                setLoading(false);
            };

            ws.onclose = () => {
                console.log('Disconnected from agent, reconnecting in 3s...');
                setConnected(false);

                // Attempt reconnection
                reconnectTimeoutRef.current = setTimeout(() => {
                    connectImpl();
                }, 3000);
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed');
            setLoading(false);
        }
    }, [agentUrl, agentId]);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const startBot = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'start_bot' }));
        }
    }, []);

    const stopBot = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'stop_bot' }));
        }
    }, []);

    const manualScan = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'manual_scan' }));
        }
    }, []);

    return {
        state,
        connected,
        loading,
        error,
        startBot,
        stopBot,
        manualScan,
    };
}
