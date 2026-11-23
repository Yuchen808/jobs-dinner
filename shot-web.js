// Open a page in headless Chrome, wait, save a screenshot, and print anything the page logged or threw.
//   node shot-web.js <url> <out.png> [waitMs] [width] [height]
const puppeteer = require('puppeteer-core');
const [url, out, wait = '4000', width = '1400', height = '900'] = process.argv.slice(2);
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--no-first-run', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11', `--window-size=${width},${height}`]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: +width, height: +height, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 400)));
  page.on('requestfailed', r => console.log('[failed]', r.url().slice(0, 160)));
  page.on('response', r => { if (r.status() >= 400) console.log('[http ' + r.status() + ']', r.url().slice(0, 160)); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, +wait));
  await page.screenshot({ path: out });
  console.log('hud:', await page.evaluate(() => (document.getElementById('hud') || {}).innerText || '(no hud)'));
  await browser.close();
  console.log('saved', out);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
