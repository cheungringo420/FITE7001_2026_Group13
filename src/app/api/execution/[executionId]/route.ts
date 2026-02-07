import { NextResponse } from 'next/server';
import { getExecution } from '@/lib/execution/store';

export async function GET(_: Request, { params }: { params: { executionId: string } }) {
  const record = getExecution(params.executionId);
  if (!record) {
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
  }
  return NextResponse.json(record);
}
