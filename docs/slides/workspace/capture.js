// Capture high-res screenshots of each prototype surface for the slide deck.
// Dev server must be running on port 3001.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const OUT_DIR = path.join(__dirname, '..', 'screens');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Each entry produces a single PNG; we use a tall viewport so the
// "above the fold" content fills the frame.
const captures = [
    { route: '/', name: 'markets', wait: 2500, scroll: 0 },
    { route: '/compare', name: 'compare', wait: 4000, scroll: 0 },
    { route: '/arbitrage', name: 'arbitrage', wait: 4000, scroll: 0 },
    { route: '/trust', name: 'trust', wait: 4000, scroll: 0 },
    { route: '/options', name: 'cross-asset', wait: 8000, scroll: 0 },
    { route: '/research', name: 'research', wait: 3000, scroll: 0 },
];

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: 'dark',
    });

    for (const c of captures) {
        const page = await ctx.newPage();
        try {
            await page.goto(BASE + c.route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            await page.waitForTimeout(c.wait);
            if (c.scroll) await page.evaluate((y) => window.scrollTo(0, y), c.scroll);
            await page.waitForTimeout(500);
            const out = path.join(OUT_DIR, `${c.name}.png`);
            await page.screenshot({ path: out, fullPage: false });
            console.log(`  ✓ ${c.name}.png  (${c.route})`);
        } catch (e) {
            console.log(`  ✗ ${c.name}: ${e.message}`);
        } finally {
            await page.close();
        }
    }

    // Also capture just the navbar strip for the "surface map" slide.
    const navPage = await ctx.newPage();
    try {
        await navPage.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
        await navPage.waitForTimeout(2500);
        const navEl = await navPage.$('nav');
        if (navEl) {
            await navEl.screenshot({ path: path.join(OUT_DIR, 'navbar.png') });
            console.log('  ✓ navbar.png');
        }
    } catch (e) {
        console.log(`  ✗ navbar: ${e.message}`);
    } finally {
        await navPage.close();
    }

    await browser.close();
})();
