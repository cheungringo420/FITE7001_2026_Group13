import { CacheClient } from './types';

export class RedisRestCache implements CacheClient {
  constructor(private url: string, private token: string) {}

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.url}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Redis REST error: ${response.status} ${text}`);
    }

    return response.json();
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.request(`/get/${encodeURIComponent(key)}`);
    if (!data || data.result === null || data.result === undefined) return null;
    try {
      return JSON.parse(data.result) as T;
    } catch {
      return data.result as T;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    await this.request(`/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, {
      method: 'POST',
      body: payload,
    });
  }

  async delete(key: string): Promise<void> {
    await this.request(`/del/${encodeURIComponent(key)}`, { method: 'POST' });
  }
}
