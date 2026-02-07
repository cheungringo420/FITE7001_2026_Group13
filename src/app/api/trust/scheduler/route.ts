import { NextResponse } from 'next/server';
import { startTrustScheduler, stopTrustScheduler, getTrustSchedulerStatus, triggerTrustRefresh } from '@/lib/trust/scheduler';

export async function GET() {
  return NextResponse.json(getTrustSchedulerStatus());
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const intervalMs = Number(body.intervalMs || 60000);
    const status = startTrustScheduler(Number.isFinite(intervalMs) ? intervalMs : 60000);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start scheduler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const status = stopTrustScheduler();
  return NextResponse.json(status);
}

export async function PUT() {
  const status = triggerTrustRefresh();
  return NextResponse.json(status);
}
