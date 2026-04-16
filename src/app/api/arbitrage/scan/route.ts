import { NextResponse } from 'next/server';
import { scanOpportunities } from '@/lib/core/opportunities/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strict = searchParams.get('strict') === 'true';
    const result = await scanOpportunities({ strict });

    return NextResponse.json(result, {
      headers: {
        Deprecation: 'true',
        Sunset: 'Wed, 31 Dec 2026 23:59:59 GMT',
        Link: '</api/core/opportunities>; rel="successor-version"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan for arbitrage opportunities';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
