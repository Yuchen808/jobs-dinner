// Close views of the host's face in the viewer.  node shot-face.js <outPrefix>
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] || 'out/face';
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--no-first-run', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11', '--window-size=1100,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
  await page.goto('http://127.0.0.1:8766/web/', { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const views = { 'three-quarter': [-0.75, 0.2, 9], side: [0, 0.12, 9], 'from-front-right': [0.55, 0.38, 8] };
  for (const [name, [yaw, pitch, zoom]] of Object.entries(views)) {
    await page.evaluate((y, p, z) => window.__view(y, p, z, [1.12, 1.33, 0]), yaw, pitch, zoom);
    await new Promise(r => setTimeout(r, 900));
    await page.screenshot({ path: `${prefix}-${name}.png`, clip: { x: 0, y: 0, width: 800, height: 800 } });
  }
  await browser.close(); console.log('saved');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
