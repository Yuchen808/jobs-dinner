// ink studio skips the shadow test for any baked light that contributes less than 3% at a point. With the lamp's bulb
// split into several weak points (for a soft edge) that lets unshadowed light leak past the hood onto far surfaces.
// This lowers the cut-off. Run again after any `npm install`:  node patch-ink.js
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, 'node_modules', '@shapeshift-labs', 'ink-studio', 'dist', 'ink-studio.node.cjs');
let s = fs.readFileSync(file, 'utf8');
if (s.includes('c > 0.002 && nd > 0')) console.log('already patched');
else if (s.includes('c > 0.03 && nd > 0')) { fs.writeFileSync(file, s.replace('c > 0.03 && nd > 0', 'c > 0.002 && nd > 0')); console.log('patched'); }
else { console.error('pattern not found: the toolkit changed, check src/sculpt.js'); process.exit(1); }
