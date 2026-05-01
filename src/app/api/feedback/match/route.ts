import { NextResponse } from 'next/server';
import { addMatchFeedback, listMatchFeedback, MatchFeedbackStatus } from '@/lib/feedback/matchFeedback';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const entries = await listMatchFeedback();
  const filtered = status ? entries.filter((entry) => entry.status === status) : entries;
  return NextResponse.json({ entries: filtered });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const polymarketId = String(body.polymarketId || '').trim();
    const kalshiId = String(body.kalshiId || '').trim();
    const status = (body.status || 'mismatch') as MatchFeedbackStatus;
    const reason = body.reason ? String(body.reason) : undefined;

    if (!polymarketId || !kalshiId) {
      return NextResponse.json({ error: 'polymarketId and kalshiId are required' }, { status: 400 });
    }

    if (status !== 'mismatch' && status !== 'match') {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }

    const entry = await addMatchFeedback({ polymarketId, kalshiId, status, reason });
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save feedback';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
