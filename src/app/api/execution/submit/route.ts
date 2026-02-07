import { NextResponse } from 'next/server';
import { submitExecution } from '@/lib/execution/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.quoteId || !body.executionToken || !body.clientNonce) {
      return NextResponse.json({ error: 'Invalid execution request' }, { status: 400 });
    }

    const record = submitExecution({
      quoteId: body.quoteId,
      executionToken: body.executionToken,
      clientNonce: body.clientNonce,
    });

    return NextResponse.json({
      executionId: record.executionId,
      status: record.status,
      legs: record.legs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit execution';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
