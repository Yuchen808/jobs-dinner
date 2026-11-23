// Screenshot of the viewer zoomed in on a screen point.  node shot-zoom.js <out.png> <x> <y> <wheelSteps>
const puppeteer = require('puppeteer-core');
const [out, x = '690', y = '440', steps = '8'] = process.argv.slice(2);
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--no-first-run', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11', '--window-size=1400,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
  await page.goto('http://127.0.0.1:8766/web/', { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: out.replace('.png', '-wide.png') });
  await page.mouse.move(+x, +y);
  for (let i = 0; i < +steps; i++) { await page.mouse.wheel({ deltaY: -120 }); await new Promise(r => setTimeout(r, 120)); }
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: out });
  console.log('hud:', await page.evaluate(() => document.getElementById('hud').innerText.split('\n')[0]));
  await browser.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
