import { NextResponse } from 'next/server';
import { cancelExecution } from '@/lib/execution/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const executionId = String(body.executionId || '').trim();
    if (!executionId) {
      return NextResponse.json({ error: 'executionId is required' }, { status: 400 });
    }

    const updated = cancelExecution(executionId);
    return NextResponse.json({ status: updated.status, executionId: updated.executionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel execution';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
