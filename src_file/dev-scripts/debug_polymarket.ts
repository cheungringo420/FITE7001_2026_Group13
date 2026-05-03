
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

async function debugPolymarket() {
    console.log('Fetching Polymarket data...');
    const url = `${GAMMA_API_BASE}/markets?limit=20&active=true&closed=false&enableOrderBook=true`;
    console.log(`URL: ${url}`);

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status: ${res.status}`);

        const markets = await res.json();
        console.log(`Fetched ${markets.length} markets`);

        // Log details for the first 5
        markets.slice(0, 5).forEach((m: { question: string; slug: string; active: boolean; closed: boolean; events?: Array<{ id: string; slug: string }> }, i: number) => {
            console.log(`\nMarket #${i + 1}:`);
            console.log(`Question: ${m.question}`);
            console.log(`Slug: ${m.slug}`);
            console.log(`Active: ${m.active}, Closed: ${m.closed}`);
            console.log(`Events:`, JSON.stringify(m.events ? m.events.map(e => ({ id: e.id, slug: e.slug })) : 'None'));

            // Replicate logic
            const eventSlug = m.events?.[0]?.slug;
            const constructedUrl = eventSlug
                ? `https://polymarket.com/event/${eventSlug}`
                : `https://polymarket.com/event/${m.slug}`;
            console.log(`Constructed URL: ${constructedUrl}`);
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

debugPolymarket();
