import { NextResponse } from 'next/server';
import { getExecution } from '@/lib/execution/store';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  const record = getExecution(executionId);
  if (!record) {
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
  }
  return NextResponse.json(record, {
    headers: {
      Deprecation: 'true',
      Sunset: 'Wed, 31 Dec 2026 23:59:59 GMT',
      Link: `</api/execution/orders/${executionId}>; rel="successor-version"`,
    },
  });
}
