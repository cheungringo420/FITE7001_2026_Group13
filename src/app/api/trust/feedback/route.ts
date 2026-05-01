import { NextResponse } from 'next/server';
import { addTrustFeedback, listTrustFeedback, TrustFeedbackType } from '@/lib/feedback/trustFeedback';

const VALID_TYPES: TrustFeedbackType[] = [
  'trust-agree',
  'trust-disagree',
  'evidence-helpful',
  'evidence-misleading',
  'report-issue',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const marketId = String(body.marketId || '').trim();
    const platform = body.platform as 'polymarket' | 'kalshi';
    const feedbackType = body.feedbackType as TrustFeedbackType;
    const comment = body.comment ? String(body.comment) : undefined;

    if (!marketId || !platform || !feedbackType) {
      return NextResponse.json(
        { error: 'Missing required fields: marketId, platform, feedbackType' },
        { status: 400 },
      );
    }

    if (platform !== 'polymarket' && platform !== 'kalshi') {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(feedbackType)) {
      return NextResponse.json(
        { error: `Invalid feedbackType. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const entry = await addTrustFeedback({ marketId, platform, feedbackType, comment });
    const entries = await listTrustFeedback();

    return NextResponse.json({
      success: true,
      feedbackId: entry.id,
      totalFeedback: entries.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit feedback';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId') || undefined;
    const platformParam = searchParams.get('platform');
    const platform = platformParam === 'polymarket' || platformParam === 'kalshi'
      ? platformParam
      : undefined;

    const filtered = await listTrustFeedback({ marketId, platform });
    const stats = {
      total: filtered.length,
      trustAgree: filtered.filter((entry) => entry.feedbackType === 'trust-agree').length,
      trustDisagree: filtered.filter((entry) => entry.feedbackType === 'trust-disagree').length,
      evidenceHelpful: filtered.filter((entry) => entry.feedbackType === 'evidence-helpful').length,
      evidenceMisleading: filtered.filter((entry) => entry.feedbackType === 'evidence-misleading').length,
      reportIssue: filtered.filter((entry) => entry.feedbackType === 'report-issue').length,
    };

    return NextResponse.json({
      feedback: filtered.slice(-50),
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch feedback';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
