// Screenshots of the viewer from several camera positions, to check it without a person at the mouse.
//   node shot-views.js <outPrefix>
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] || 'out/web';
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--no-first-run', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11', '--window-size=1400,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
  await page.goto('http://127.0.0.1:8766/web/', { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const drag = async (dx, dy) => {
    await page.mouse.move(600, 450); await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(600 + (dx * i) / 12, 450 + (dy * i) / 12);
    await page.mouse.up(); await new Promise(r => setTimeout(r, 900));
  };
  await page.screenshot({ path: prefix + '-front.png' });
  await drag(0, 260);                       // tip up to look straight down
  await page.screenshot({ path: prefix + '-top.png' });
  await drag(0, -420); await drag(-560, 0); await drag(-360, 0);   // low, and round to the outside of the window wall
  await page.screenshot({ path: prefix + '-outside.png' });
  console.log('hud:', await page.evaluate(() => document.getElementById('hud').innerText.split('\n')[0]));
  await browser.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
