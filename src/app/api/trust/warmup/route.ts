import { NextResponse } from 'next/server';
import { warmupTrustCaches } from '@/lib/trust/warmup';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body.limit || 50);
    const result = await warmupTrustCaches(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ ...result, warmedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to warm trust caches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to warm trust caches' }, { status: 405 });
}
