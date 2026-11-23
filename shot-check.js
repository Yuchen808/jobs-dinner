// Viewer checks: the visitor's face from two sides, and the whole room.  node shot-check.js <outPrefix>
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] || 'out/check';
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--no-first-run', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11', '--window-size=1100,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8766/web/', { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const views = { 'visitor-right': [0.9, 0.22, 9, [-1.08, 1.33, 0]], 'visitor-left': [2.2, 0.22, 9, [-1.08, 1.33, 0]], room: [0.72, 0.58, 1, [0.3, 1.2, 0.2]] };
  for (const [name, [yaw, pitch, zoom, at]] of Object.entries(views)) {
    await page.evaluate((y, p, z, a) => window.__view(y, p, z, a), yaw, pitch, zoom, at);
    await new Promise(r => setTimeout(r, 900));
    await page.screenshot({ path: `${prefix}-${name}.png`, clip: { x: 0, y: 0, width: 820, height: 820 } });
  }
  await browser.close(); console.log('saved');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
