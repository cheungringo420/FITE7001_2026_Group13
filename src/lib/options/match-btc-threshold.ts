// Pattern-matches Polymarket questions of the form
// "Will BTC reach $X by date Y?" into a structured threshold + expiry.
// Conservative: returns null whenever any of {underlying, direction, threshold,
// expiry} cannot be confidently extracted. Confidence reflects how many of the
// four signals were satisfied.

export interface ThresholdMatch {
    underlying: 'BTC';
    threshold: number;
    direction: 'above' | 'below';
    expiryISO: string;
    rawQuestion: string;
    matchConfidence: number;
}

const BTC_TOKENS = /\b(bitcoin|btc)\b/i;
const ABOVE_TOKENS = /(reach|hit|above|over|exceed|≥|>=|>\s*\$?|greater than|at least|at or above)/i;
const BELOW_TOKENS = /(below|under|≤|<=|<\s*\$?|less than|at most|at or below)/i;

const PRICE_RE = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([kKmM])?/g;

const MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];
// Match `Month YYYY` first (no day) so "June 2026" doesn't steal "20" as a day.
const MONTH_YEAR_RE = new RegExp(`\\b(${MONTHS.join('|')})\\s+(\\d{4})\\b`, 'i');
const MONTH_DAY_YEAR_RE = new RegExp(
    `\\b(${MONTHS.join('|')})\\s+(\\d{1,2})(?:[,\\s]+\\s*(\\d{4}))?\\b`,
    'i'
);
const ISO_DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const END_OF_YEAR_RE = /(?:by\s+)?(?:end\s+of\s+(?:year\s+)?|EOY\s+|by\s+)(\d{4})/i;
const BARE_YEAR_RE = /\b(20\d{2})\b/;

function lastDayOfMonth(year: number, monthIdx: number): number {
    return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

export function matchBtcThreshold(question: string): ThresholdMatch | null {
    if (!BTC_TOKENS.test(question)) return null;

    let direction: 'above' | 'below' | null = null;
    if (ABOVE_TOKENS.test(question)) direction = 'above';
    else if (BELOW_TOKENS.test(question)) direction = 'below';
    if (!direction) return null;

    // Pick the largest plausible BTC-range price; date numbers will fall outside.
    const prices: number[] = [];
    for (const m of question.matchAll(PRICE_RE)) {
        let n = parseFloat(m[1].replace(/,/g, ''));
        const suffix = m[2]?.toLowerCase();
        if (suffix === 'k') n *= 1_000;
        else if (suffix === 'm') n *= 1_000_000;
        if (n >= 1_000 && n <= 10_000_000) prices.push(n);
    }
    if (prices.length === 0) return null;
    const threshold = Math.max(...prices);

    let expiryISO: string | null = null;
    const iso = ISO_DATE_RE.exec(question);
    if (iso) {
        expiryISO = iso[1];
    } else {
        const monthYear = MONTH_YEAR_RE.exec(question);
        const monthDayYear = MONTH_DAY_YEAR_RE.exec(question);
        const eoy = END_OF_YEAR_RE.exec(question);
        if (monthYear) {
            const monthIdx = MONTHS.indexOf(monthYear[1].toLowerCase());
            const year = parseInt(monthYear[2], 10);
            const day = lastDayOfMonth(year, monthIdx);
            expiryISO = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else if (monthDayYear) {
            const monthIdx = MONTHS.indexOf(monthDayYear[1].toLowerCase());
            const year = monthDayYear[3]
                ? parseInt(monthDayYear[3], 10)
                : new Date().getUTCFullYear();
            const day = parseInt(monthDayYear[2], 10);
            expiryISO = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else if (eoy) {
            expiryISO = `${eoy[1]}-12-31`;
        } else {
            const bareYear = BARE_YEAR_RE.exec(question);
            if (bareYear) expiryISO = `${bareYear[1]}-12-31`;
        }
    }
    if (!expiryISO) return null;

    const signals = [BTC_TOKENS.test(question), !!direction, prices.length > 0, !!expiryISO];
    const matchConfidence = signals.filter(Boolean).length / signals.length;

    return {
        underlying: 'BTC',
        threshold,
        direction,
        expiryISO,
        rawQuestion: question,
        matchConfidence,
    };
}
