// Web dışa aktarımı. Metro, EXPO_PUBLIC_* değerlerini dönüştürülmüş modülde önbellekte tuttuğu için
// `--clear` HER ZAMAN verilir; bayrak açıkça ayarlanır (kapalıysa ortamdan silinir).
// Kullanım: node scripts/export-web.mjs [--lab] --out <klasör>
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const lab = args.includes('--lab');
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : 'dist';
if (!out) {
  console.error('--out için klasör gerekli');
  process.exit(2);
}

const env = { ...process.env, CI: '1' };
if (lab) env.EXPO_PUBLIC_LAB = '1';
else delete env.EXPO_PUBLIC_LAB;

const r = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', out], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
