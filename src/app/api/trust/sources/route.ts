import { NextResponse } from 'next/server';
import { loadEvidenceDataset } from '@/lib/trust/evidence';

export async function GET() {
  try {
    const dataset = await loadEvidenceDataset();
    return NextResponse.json({ sources: dataset.sources || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load sources';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
