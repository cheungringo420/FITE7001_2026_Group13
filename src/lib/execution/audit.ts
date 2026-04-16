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
