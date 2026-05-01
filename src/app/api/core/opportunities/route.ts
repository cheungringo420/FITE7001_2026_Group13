import { NextResponse } from 'next/server';
import { scanOpportunities } from '@/lib/core/opportunities/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strict = searchParams.get('strict') === 'true';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const result = await scanOpportunities({ strict });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan opportunities';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
