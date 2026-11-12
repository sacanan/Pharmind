// Derlenmiş çıktıyı sınar. Kanıt kapsamı (bunun ötesi iddia edilmez):
//  1. Bayrak açıkken prototip metinleri pakette VAR, kapalıyken HİÇBİRİ yok (src/prototype altındaki
//     tüm uzun metin değişmezleri + kimlikler, ham ve \uXXXX kaçışlı hâlleriyle; çıktıdaki tüm metin dosyaları).
//  2. Gerçek tarayıcıda (başsız Chrome) /lab: açıkken prototip görünür, kapalıyken görünmez.
//  3. Üretim yolu: ortamda EXPO_PUBLIC_LAB varken export-web.mjs ve doğrudan `expo export` durur.
// Dört derleme sırasıyla açık → kapalı → açık → kapalı alınır ve HEPSİ `--clear` kullanır; bu betik,
// önbellek temizlenmeden bayrak değiştirmenin güvenli olduğunu KANITLAMAZ. Android/iOS derlemeleri
// bu betikte sınanmaz (yalnızca web).
// Kullanım: node scripts/verify-lab-build.mjs   (tarayıcı: CHROME_BIN veya google-chrome/chromium)
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const failures = [];
const fail = (m) => failures.push(m);

// --- İşaretçiler: src/prototype altındaki (testler hariç) tırnaklı metinler ---------------------------
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'test-support' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}
function collectLiterals(files) {
  const out = new Set();
  for (const file of files) {
    // Açıklama satırları pakete girmez; yalnızca kod içindeki metin değişmezleri taranır.
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/\s.*$/gm, '');
    for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])+)\1/g)) {
      const v = m[2];
      if (v.length >= 12 && (v.includes(' ') || v.startsWith('lab-')) && !v.includes('${')) out.add(v);
    }
  }
  return out;
}
const literals = collectLiterals(sourceFiles('src/prototype'));
// Gerçek (prototip dışı) uygulamanın da kullandığı ortak metinler (örn. "Tahmin ettim (isteğe bağlı)")
// bayrak kapalıyken zaten pakette bulunur; prototip sızıntısı kanıtı olamazlar, taramadan çıkarılır.
const sharedFiles = readdirSync('src', { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'prototype').flatMap((e) => sourceFiles(join('src', e.name)));
const shared = collectLiterals(sharedFiles);
const excludedShared = [...literals].filter((v) => shared.has(v));
for (const v of excludedShared) literals.delete(v);
if (excludedShared.length) console.log(`ortak metin (gerçek uygulamada da var) taramadan çıkarıldı: ${excludedShared.length} → ${excludedShared.map((v) => JSON.stringify(v)).join(', ')}`);
literals.add('lab-mg-1').add('lab-mg-5').add('Mini oyun denemesi');
const escapeU = (s) => s.replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const variants = (s) => [s, escapeU(s), escapeU(s).toUpperCase().replace(/\\U/g, '\\u')];
const present = (haystack, s) => variants(s).some((v) => haystack.includes(v));
const CORE = ['Mini oyun denemesi', 'lab-mg-1', 'lab-mg-5', 'Deneme kapatıldı'];

function allText(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const full = join(dir, e.name);
      if (e.isDirectory()) return [allText(full)];
      return /\.(js|html|json|map|txt|css)$/.test(e.name) ? [readFileSync(full, 'utf8')] : [];
    })
    .join('\n');
}

// --- Tarayıcı ----------------------------------------------------------------------------------------
function findChrome() {
  const names = [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const n of names.filter(Boolean)) {
    const r = spawnSync(n, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return n;
  }
  return null;
}
const chrome = findChrome();
if (!chrome) {
  if (process.env.CI) fail('CI ortamında başsız Chrome bulunamadı (tarayıcı denetimi zorunlu)');
  else console.warn('UYARI: Chrome bulunamadı; gerçek tarayıcı denetimi ATLANDI (CHROME_BIN verin).');
}

const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
function serve(root) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) p = join(root, 'index.html');
      res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
      res.end(readFileSync(p));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function dumpDom(url) {
  return new Promise((resolve) => {
    const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=12000', '--dump-dom', url];
    const p = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    const timer = setTimeout(() => p.kill(), 60000);
    p.on('close', () => {
      clearTimeout(timer);
      resolve(out);
    });
  });
}

// --- Dört derleme ------------------------------------------------------------------------------------
const root = mkdtempSync(join(tmpdir(), 'pharmind-lab-'));
try {
  for (const [i, lab] of [true, false, true, false].entries()) {
    const out = join(root, `build-${i}`);
    const r = spawnSync('node', ['scripts/export-web.mjs', '--out', out, ...(lab ? ['--lab'] : [])], { stdio: 'inherit' });
    const tag = `derleme ${i + 1} (lab=${lab ? 'açık' : 'kapalı'})`;
    if (r.status !== 0) {
      fail(`${tag} başarısız`);
      continue;
    }
    const text = allText(out);
    if (lab) {
      for (const s of CORE) if (!present(text, s)) fail(`${tag}: "${s}" pakette YOK`);
    } else {
      const leaked = [...literals].filter((s) => present(text, s));
      if (leaked.length) fail(`${tag}: ${leaked.length} prototip metni pakette VAR, örn. "${leaked[0]}"`);
    }
    if (chrome) {
      const server = await serve(out);
      const dom = await dumpDom(`http://127.0.0.1:${server.address().port}/lab`);
      server.close();
      const shown = dom.includes('Mini oyun denemesi');
      if (lab && !shown) fail(`${tag}: tarayıcıda /lab prototipi göstermiyor`);
      if (!lab && (shown || dom.includes('TEST i'))) fail(`${tag}: tarayıcıda bayraksız /lab prototipi GÖSTERİYOR`);
      if (dom.length < 200) fail(`${tag}: tarayıcı DOM'u boş (render edilmedi)`);
      console.log(`${tag}: ${literals.size} metin tarandı; tarayıcıda /lab ${shown ? 'prototip' : 'prototip YOK'}`);
    } else {
      console.log(`${tag}: ${literals.size} metin tarandı; tarayıcı denetimi atlandı`);
    }
  }

  // --- Üretim yolu: bayrak yanlışlıkla açık kalırsa derleme durmalı ---------------------------------
  const guardEnv = { ...process.env, EXPO_PUBLIC_LAB: '1' };
  const viaScript = spawnSync('node', ['scripts/export-web.mjs', '--out', join(root, 'guard-1')], { env: guardEnv, stdio: 'ignore' });
  if (viaScript.status === 0) fail('export:web, EXPO_PUBLIC_LAB ayarlıyken durmadı');
  const direct = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', join(root, 'guard-2')], {
    env: { ...guardEnv, CI: '1' },
    stdio: 'ignore',
  });
  if (direct.status === 0) fail('doğrudan `expo export`, EXPO_PUBLIC_LAB=1 ile üretim derlemesini reddetmedi');
  else console.log('üretim koruması: bayrak açıkken hem export:web hem doğrudan expo export reddedildi');
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failures.length) {
  console.error('\nSORUNLAR:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('Tüm denetimler beklendiği gibi.');
