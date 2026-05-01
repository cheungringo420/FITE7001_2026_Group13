import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/signals
 * Returns the latest alpha signals from the scanner pipeline.
 * The Python alpha_scanner.py writes to data/alpha_signals.json.
 */
export async function GET() {
  try {
    const signalsPath = path.join(process.cwd(), 'data', 'alpha_signals.json');

    if (!fs.existsSync(signalsPath)) {
      return NextResponse.json({
        status:   'no_data',
        message:  'No signals available. Run: python3 scripts/alpha_scanner.py',
        signals:  [],
      });
    }

    const raw = JSON.parse(fs.readFileSync(signalsPath, 'utf-8'));

    // Enrich with age info
    const scannedAt = new Date(raw.scanned_at);
    const ageMs     = Date.now() - scannedAt.getTime();
    const stale     = ageMs > 5 * 60 * 1000; // >5 min = stale

    return NextResponse.json({
      status:    stale ? 'stale' : 'fresh',
      scannedAt: raw.scanned_at,
      ageMs,
      nSignals:  raw.n_signals,
      summary:   raw.summary,
      signals:   raw.signals,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
