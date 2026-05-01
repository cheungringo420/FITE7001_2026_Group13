const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const slides = [
    '01-title.html', '02-thesis.html', '03-markets.html', '04-compare.html',
    '05-arbitrage.html', '06-trust.html', '07-cross-asset.html',
    '08-worked-example.html', '09-math.html', '10-quality-gates.html',
    '11-research.html', '12-limitations.html', '13-closing.html',
];

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
    const outDir = path.join(__dirname, '..', 'previews');
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of slides) {
        const page = await ctx.newPage();
        await page.goto('file://' + path.join(__dirname, f));
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: path.join(outDir, f.replace('.html', '.png')), fullPage: false });
        await page.close();
    }
    await browser.close();
    console.log('done');
})();
