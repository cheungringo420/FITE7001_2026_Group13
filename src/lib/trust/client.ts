import { TrustSummaryItem } from './types';

export function trustKey(platform: 'polymarket' | 'kalshi', id: string): string {
  return `${platform}:${id}`;
}

export function buildTrustMap(items: TrustSummaryItem[]): Record<string, TrustSummaryItem> {
  return items.reduce<Record<string, TrustSummaryItem>>((acc, item) => {
    acc[trustKey(item.platform, item.marketId)] = item;
    return acc;
  }, {});
}

export async function fetchTrustSummary(params?: {
  platform?: 'polymarket' | 'kalshi' | 'all';
  limit?: number;
  minTrust?: number;
}): Promise<TrustSummaryItem[]> {
  const platform = params?.platform ?? 'all';
  const limit = params?.limit ?? 150;
  const minTrust = params?.minTrust ?? 0;

  const searchParams = new URLSearchParams({
    platform,
    limit: limit.toString(),
    minTrust: minTrust.toString(),
  });

  const response = await fetch(`/api/trust/summary?${searchParams.toString()}`);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.items || []) as TrustSummaryItem[];
}
