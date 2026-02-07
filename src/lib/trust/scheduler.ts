import { clearTrustCaches } from './store';
import { resetEvidenceCache } from './evidence';

let scheduler: NodeJS.Timeout | null = null;
let intervalMs = 0;
let lastRun: string | null = null;

function refreshOnce() {
  clearTrustCaches();
  resetEvidenceCache();
  lastRun = new Date().toISOString();
}

export function startTrustScheduler(nextIntervalMs = 60_000) {
  if (scheduler) {
    return getTrustSchedulerStatus();
  }

  intervalMs = nextIntervalMs;
  refreshOnce();
  scheduler = setInterval(refreshOnce, intervalMs);
  return getTrustSchedulerStatus();
}

export function stopTrustScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
  return getTrustSchedulerStatus();
}

export function getTrustSchedulerStatus() {
  return {
    running: scheduler !== null,
    intervalMs,
    lastRun,
  };
}

export function triggerTrustRefresh() {
  refreshOnce();
  return getTrustSchedulerStatus();
}
