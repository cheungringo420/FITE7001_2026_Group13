/**
 * Lightweight in-memory audit trail for execution events.
 * In production this would persist to a database or logging service.
 */

export interface AuditEvent {
  executionId: string;
  eventType: string;
  payload?: unknown;
  context?: unknown;
  timestamp: string;
}

const auditLog: AuditEvent[] = [];

/**
 * Record an execution audit event.
 * Signature matches how service.ts calls it:
 *   recordAuditEvent(executionId, eventType, payload?, context?)
 */
export function recordAuditEvent(
  executionId: string,
  eventType: string,
  payload?: unknown,
  context?: unknown,
): void {
  auditLog.push({
    executionId,
    eventType,
    payload,
    context,
    timestamp: new Date().toISOString(),
  });
  // Keep last 1000 entries in memory
  if (auditLog.length > 1000) {
    auditLog.splice(0, auditLog.length - 1000);
  }
}

export function getAuditLog(): readonly AuditEvent[] {
  return auditLog;
}

/** Get the audit trail for a specific execution. */
export function getAuditTrail(executionId: string): AuditEvent[] | null {
  const events = auditLog.filter((e) => e.executionId === executionId);
  return events.length > 0 ? events : null;
}

/** Get the most recent execution history, grouped by executionId. */
export function getExecutionHistory(limit: number = 20) {
  const byId = new Map<string, AuditEvent[]>();
  for (const event of auditLog) {
    const list = byId.get(event.executionId) ?? [];
    list.push(event);
    byId.set(event.executionId, list);
  }
  return Array.from(byId.entries())
    .map(([executionId, events]) => ({
      executionId,
      events,
      startedAt: events[0]?.timestamp,
      lastEventAt: events[events.length - 1]?.timestamp,
    }))
    .sort((a, b) => (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? ''))
    .slice(0, limit);
}
