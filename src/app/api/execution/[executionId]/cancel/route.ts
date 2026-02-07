import { NextResponse } from 'next/server';
import { updateExecution, getExecution } from '@/lib/execution/store';

export async function POST(_: Request, { params }: { params: { executionId: string } }) {
  const existing = getExecution(params.executionId);
  if (!existing) {
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
  }

  const updated = updateExecution(params.executionId, { status: 'cancelled' });
  if (!updated) {
    return NextResponse.json({ error: 'Unable to cancel execution' }, { status: 400 });
  }

  return NextResponse.json({ status: updated.status, executionId: updated.executionId });
}
