// Record the viewer as an exact, seamless loop: time is stepped by hand, one screenshot per video frame.
//   node record-loop.js [size=1200] [fps=30] [loops=2] [zoom=0.95] [out=dinner-loop-v3.mp4]
// Before recording, the room is centred in the frame both ways: a test frame is measured and the camera is moved.
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const size = +(process.argv[2] || 1200), fps = +(process.argv[3] || 30), loops = +(process.argv[4] || 2), zoom = +(process.argv[5] || 0.95), outName = process.argv[6] || 'dinner-loop-v3.mp4';
const PY = 'E:/img3d/venv-hy3d/Scripts/python.exe';
// where the picture's content sits: centre of everything that is not background, in pixels
const MEASURE = "import sys;from PIL import Image,ImageChops as C;im=Image.open(sys.argv[1]).convert('RGB');bg=Image.new('RGB',im.size,im.getpixel((2,2)));b=C.difference(im,bg).convert('L').point(lambda v:255 if v>5 else 0).getbbox();print(b[0],b[1],b[2],b[3])";
const dir = path.join(__dirname, 'out', 'loop-frames');
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--no-first-run', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11', `--window-size=${size},${size}`] });
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8766/web/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const period = await page.evaluate(() => { window.__capture(true); return window.__loopSeconds(); });
  const cam = await page.evaluate(() => fetch('data/scene.json').then(r => r.json()).then(j => j.cam));
  const { yaw, pitch } = cam, at = [...cam.target], unit = 11.6 / (zoom * size);   // world units per pixel
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)], up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
  for (let pass = 0; pass < 3; pass++) {
    await page.evaluate((y, p, z, a) => new Promise(done => { window.__view(y, p, z, a); window.__t = 100; requestAnimationFrame(() => requestAnimationFrame(done)); }), yaw, pitch, zoom, at);
    const probe = path.join(dir, 'probe.png');
    await page.screenshot({ path: probe });
    const [x0, y0, x1, y1] = execFileSync(PY, ['-c', MEASURE, probe]).toString().trim().split(' ').map(Number);
    const dx = (x0 + x1) / 2 - size / 2, dy = (y0 + y1) / 2 - size / 2;
    console.log(`pass ${pass}: room ${x0}-${x1} x ${y0}-${y1}, off centre by ${dx.toFixed(1)}, ${dy.toFixed(1)} px, margins L ${x0} R ${size - x1} T ${y0} B ${size - y1}`);
    fs.rmSync(probe);
    if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) break;
    for (let k = 0; k < 3; k++) at[k] += right[k] * dx * unit - up[k] * dy * unit;
  }
  const n = Math.round(period * fps) * loops;
  console.log(`loop ${period.toFixed(3)} s, ${n} frames at ${fps} fps`);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => new Promise(done => { window.__t = t; requestAnimationFrame(() => requestAnimationFrame(done)); }), 100 + i / fps);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`) });
  }
  await browser.close();
  const out = path.join(__dirname, 'out', outName);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-movflags', '+faststart', out]);
  console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
