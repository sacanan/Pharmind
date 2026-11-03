// Derlenmiş çıktıyı sınar: bayrak açıkken prototip pakette olmalı, kapalıyken OLMAMALI.
// Aynı önbellekle açık → kapalı → açık → kapalı sırası denenir (Metro önbellek regresyonu).
// Kullanım: node scripts/verify-lab-build.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MARKERS = ['Mini oyun denemesi', 'lab-mg-1', 'lab-mg-5'];
const root = mkdtempSync(join(tmpdir(), 'pharmind-lab-'));

function bundleText(dir) {
  const jsDir = join(dir, '_expo', 'static', 'js', 'web');
  return readdirSync(jsDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(jsDir, f), 'utf8'))
    .join('\n');
}

const failures = [];
try {
  [true, false, true, false].forEach((lab, i) => {
    const out = join(root, `build-${i}`);
    const args = ['scripts/export-web.mjs', '--out', out, ...(lab ? ['--lab'] : [])];
    const r = spawnSync('node', args, { stdio: 'inherit' });
    if (r.status !== 0) {
      failures.push(`derleme ${i + 1} (lab=${lab}) başarısız`);
      return;
    }
    const text = bundleText(out);
    for (const marker of MARKERS) {
      const present = text.includes(marker);
      if (present !== lab) {
        failures.push(`derleme ${i + 1} (lab=${lab}): "${marker}" ${present ? 'pakette VAR' : 'pakette YOK'}`);
      }
    }
    console.log(`derleme ${i + 1}: lab=${lab ? 'açık' : 'kapalı'} -> ${failures.length ? 'sorun var' : 'tamam'}`);
  });
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failures.length) {
  console.error('\nSORUNLAR:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('Bayrak açık/kapalı derlemeleri beklendiği gibi.');
