import { NextResponse } from 'next/server';
import { clearTrustCaches } from '@/lib/trust/store';
import { resetEvidenceCache } from '@/lib/trust/evidence';

export async function POST() {
  clearTrustCaches();
  resetEvidenceCache();
  return NextResponse.json({ ok: true, clearedAt: new Date().toISOString() });
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to refresh trust caches' }, { status: 405 });
}
