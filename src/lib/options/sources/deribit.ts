// Deribit public REST client for BTC options.
// No auth required for read-only endpoints.
// Deribit prices options in BTC ("inverse"); we normalize to USD using the
// underlying spot returned alongside each book summary.

const DERIBIT_API = 'https://www.deribit.com/api/v2/public';

interface DeribitInstrument {
    instrument_name: string;
    base_currency: 'BTC';
    expiration_timestamp: number;
    strike: number;
    option_type: 'call' | 'put';
    is_active: boolean;
    kind: 'option';
}

interface DeribitBookSummary {
    instrument_name: string;
    underlying_price: number;
    mark_price: number;
    mark_iv: number;
    bid_price: number | null;
    ask_price: number | null;
    volume: number;
    open_interest: number;
}

export interface NormalizedOption {
    instrumentName: string;
    strike: number;
    optionType: 'call' | 'put';
    bid: number;
    ask: number;
    mid: number;
    iv: number;
    underlyingPrice: number;
    daysToExpiration: number;
    expirationDate: string;
}

export interface ChainSlice {
    underlyingPrice: number;
    expirationTimestamp: number;
    expirationDate: string;
    daysToExpiration: number;
    calls: NormalizedOption[];
    puts: NormalizedOption[];
}

async function deribitGet<T>(path: string): Promise<T> {
    const res = await fetch(`${DERIBIT_API}${path}`);
    if (!res.ok) {
        throw new Error(`Deribit ${path} failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { result: T };
    return json.result;
}

export function fetchBtcInstruments(): Promise<DeribitInstrument[]> {
    return deribitGet<DeribitInstrument[]>('/get_instruments?currency=BTC&kind=option&expired=false');
}

export function fetchBtcBookSummary(): Promise<DeribitBookSummary[]> {
    return deribitGet<DeribitBookSummary[]>('/get_book_summary_by_currency?currency=BTC&kind=option');
}

// Pick the listed expiry closest to a target ISO date and normalize the chain.
export async function fetchBtcChainNearExpiry(targetExpiryISO: string): Promise<ChainSlice | null> {
    const [instruments, books] = await Promise.all([
        fetchBtcInstruments(),
        fetchBtcBookSummary(),
    ]);
    if (instruments.length === 0 || books.length === 0) return null;

    const target = new Date(targetExpiryISO).getTime();
    const expiries = Array.from(new Set(instruments.map((i) => i.expiration_timestamp)));
    expiries.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    const chosenExpiry = expiries[0];

    const chosenInstruments = instruments.filter((i) => i.expiration_timestamp === chosenExpiry);
    const bookByName = new Map(books.map((b) => [b.instrument_name, b]));

    const underlyingPrice = books[0].underlying_price;
    const expirationDate = new Date(chosenExpiry).toISOString();
    const daysToExpiration = Math.max(0, (chosenExpiry - Date.now()) / 86_400_000);

    const normalized: NormalizedOption[] = [];
    for (const inst of chosenInstruments) {
        const book = bookByName.get(inst.instrument_name);
        if (!book) continue;
        const bidUsd = (book.bid_price ?? 0) * book.underlying_price;
        const askUsd = (book.ask_price ?? 0) * book.underlying_price;
        const mid = bidUsd && askUsd ? (bidUsd + askUsd) / 2 : (bidUsd || askUsd);
        if (mid <= 0) continue;
        normalized.push({
            instrumentName: inst.instrument_name,
            strike: inst.strike,
            optionType: inst.option_type,
            bid: bidUsd,
            ask: askUsd,
            mid,
            iv: book.mark_iv / 100,
            underlyingPrice: book.underlying_price,
            daysToExpiration,
            expirationDate,
        });
    }

    return {
        underlyingPrice,
        expirationTimestamp: chosenExpiry,
        expirationDate,
        daysToExpiration,
        calls: normalized.filter((o) => o.optionType === 'call').sort((a, b) => a.strike - b.strike),
        puts: normalized.filter((o) => o.optionType === 'put').sort((a, b) => a.strike - b.strike),
    };
}
