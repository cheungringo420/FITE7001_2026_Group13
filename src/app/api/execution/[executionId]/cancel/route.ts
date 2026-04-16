import { NextResponse } from 'next/server';
import { cancelExecution } from '@/lib/execution/service';

export async function POST(
  _: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;
    const updated = cancelExecution(executionId);
    return NextResponse.json({ status: updated.status, executionId: updated.executionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel execution';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
