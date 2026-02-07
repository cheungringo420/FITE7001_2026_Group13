'use client';

import { useEffect, useRef, useState } from 'react';
import { Market } from '@/lib/polymarket/types';
import { NormalizedMarket } from '@/lib/kalshi/types';

export interface MarketStreamSnapshot {
  polymarket?: Market[];
  kalshi?: NormalizedMarket[];
  updatedAt?: string;
  sources?: {
    polymarket?: string;
    kalshi?: string;
  };
}

export function useMarketStream() {
  const [snapshot, setSnapshot] = useState<MarketStreamSnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/stream/markets');

    source.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    source.onerror = () => {
      setIsConnected(false);
      setError('Stream disconnected');
    };

    const onSnapshot = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as MarketStreamSnapshot;
        if (data.updatedAt && data.updatedAt === lastUpdateRef.current) return;
        lastUpdateRef.current = data.updatedAt || null;
        setSnapshot(data);
      } catch {
        setError('Malformed stream payload');
      }
    };

    source.addEventListener('snapshot', onSnapshot as EventListener);

    return () => {
      source.removeEventListener('snapshot', onSnapshot as EventListener);
      source.close();
    };
  }, []);

  return {
    snapshot,
    isConnected,
    error,
  };
}
