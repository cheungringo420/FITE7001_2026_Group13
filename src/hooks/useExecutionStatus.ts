'use client';

import { useEffect, useState } from 'react';
import { ExecutionRecord } from '@/lib/execution/types';

export function useExecutionStatus(executionId: string | null) {
  const [record, setRecord] = useState<ExecutionRecord | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!executionId) {
      setRecord(null);
      setIsPolling(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsPolling(true);

    const fetchRecord = async () => {
      try {
        const response = await fetch(`/api/execution/${executionId}`);
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.error || 'Failed to load execution status');
        }
        const data = await response.json();
        if (!cancelled) {
          setRecord(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Execution status error');
        }
      }
    };

    fetchRecord();
    const interval = setInterval(fetchRecord, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [executionId]);

  return { record, isPolling, error };
}
