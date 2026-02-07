import { CacheClient } from './types';
import { InMemoryCache } from './inMemoryCache';
import { RedisRestCache } from './redisRestCache';

let cacheClient: CacheClient | null = null;

export function getCacheClient(): CacheClient {
  if (cacheClient) return cacheClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    cacheClient = new RedisRestCache(url, token);
  } else {
    cacheClient = new InMemoryCache();
  }

  return cacheClient;
}

export * from './types';
