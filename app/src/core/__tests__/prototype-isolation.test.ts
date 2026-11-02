import { allCards, allCases, concepts, masteryCards, playableCards, playableCases } from '../../content';
import releaseLock from '../../content/release-lock.json';
import { coreEntries } from '../contentHash';

// Node tipleri tsconfig'te yüklü değil; yalnızca bu testin ihtiyacı olan yüzey bildirilir.
declare const __dirname: string;
declare const require: (name: string) => unknown;
interface Dirent {
  name: string;
  isDirectory(): boolean;
}
interface Fs {
  readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  readFileSync(path: string, encoding: string): string;
  existsSync(path: string): boolean;
}
interface Path {
  join(...parts: string[]): string;
  dirname(p: string): string;
  resolve(...parts: string[]): string;
  relative(from: string, to: string): string;
  sep: string;
}
const fs = require('fs') as Fs;
const path = require('path') as Path;

const SRC = path.resolve(__dirname, '..', '..'); // app/src
const rel = (file: string): string => path.relative(SRC, file).split(path.sep).join('/');

/** Bir klasördeki tüm .ts/.tsx dosyaları (test klasörleri hariç). */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** İçe aktarma belirteçlerini çıkarır. `import type` / `export type` çalışma zamanında silindiği için atlanır. */
function importsOf(source: string): string[] {
  const specs: string[] = [];
  const stmt = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (let m = stmt.exec(source); m; m = stmt.exec(source)) {
    // `export const x = 1` gibi "from"suz ifadeler eşleşmez; "from"suz eşleşme yalnızca `import 'x'` olabilir.
    if (m[1] === 'export' && !m[3]) continue;
    if (m[2]) continue;
    specs.push(m[4]);
  }
  const dyn = /(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (let m = dyn.exec(source); m; m = dyn.exec(source)) specs.push(m[1]);
  return specs;
}

function resolveRelative(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (/\.(tsx?|json)$/.test(candidate) && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Prototipin içe aktarabileceği dış paketler. */
const ALLOWED_PACKAGES = new Set(['react', 'react-native', 'expo-router', 'react-native-safe-area-context']);
/** Bu klasörlerdeki hiçbir dosya prototipten (çalışma zamanında) erişilebilir olamaz. */
const FORBIDDEN_DIRS = ['core/', 'state/', 'content/'];
const FORBIDDEN_TEXT = ['AsyncStorage', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie'];

const LAB_ENTRIES = [...sourceFiles(path.join(SRC, 'prototype')), path.join(SRC, 'app', 'lab.tsx')];

interface Reach {
  files: string[];
  problems: string[];
}

/** Prototipten çalışma zamanında erişilebilen tüm yerel dosyalar ve ihlaller. */
function reachFromPrototype(): Reach {
  const seen = new Set<string>();
  const problems: string[] = [];
  const queue = [...LAB_ENTRIES];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const where = rel(file);
    if (FORBIDDEN_DIRS.some((d) => where.startsWith(d))) problems.push(`yasak dosyaya erişiliyor: ${where}`);
    const text = fs.readFileSync(file, 'utf8');
    for (const word of FORBIDDEN_TEXT) {
      if (text.includes(word)) problems.push(`${where}: yasak depolama ifadesi "${word}"`);
    }
    for (const spec of importsOf(text)) {
      if (spec.startsWith('.')) {
        const target = resolveRelative(file, spec);
        if (!target) problems.push(`${where}: çözülemeyen içe aktarma "${spec}"`);
        else queue.push(target);
      } else if (!ALLOWED_PACKAGES.has(spec)) {
        problems.push(`${where}: izin verilmeyen paket "${spec}"`);
      }
    }
  }
  return { files: [...seen].map(rel).sort(), problems };
}

describe('importsOf (tarayıcının kendisi)', () => {
  it('değer içe aktarmalarını, yan etkili ve dinamik olanları yakalar; tür içe aktarmalarını atlar', () => {
    const source = [
      "import { a } from './a';",
      "import type { T } from '../core/session';",
      "import './side';",
      'import {',
      '  x,',
      '  y,',
      "} from '../state/progress-context';",
      "export { z } from './z';",
      "export type { W } from './w';",
      'export const k = 1;',
      "const m = require('react-native');",
      "const d = import('expo-router');",
    ].join('\n');
    expect(importsOf(source).sort()).toEqual(
      ['./a', './side', '../state/progress-context', './z', 'react-native', 'expo-router'].sort(),
    );
  });
});

describe('prototip izolasyonu (M1)', () => {
  it('tarayıcı gerçekten dosya buluyor (sağlama)', () => {
    const { files } = reachFromPrototype();
    expect(files).toEqual(expect.arrayContaining(['prototype/engine.ts', 'prototype/ui/LabFlow.tsx', 'app/lab.tsx', 'ui/Screen.tsx', 'ui/Button.tsx']));
    expect(files.length).toBeGreaterThan(8);
  });

  it('prototip; progress, FSRS, mastery, seri, depolama ve gerçek içerik modüllerine erişemez', () => {
    expect(reachFromPrototype().problems).toEqual([]);
  });

  it('gerçek kod prototipi içe aktarmaz (ters yön)', () => {
    const real = [
      ...sourceFiles(path.join(SRC, 'core')),
      ...sourceFiles(path.join(SRC, 'state')),
      ...sourceFiles(path.join(SRC, 'content')),
      ...sourceFiles(path.join(SRC, 'ui')),
      ...sourceFiles(path.join(SRC, 'app')).filter((f) => rel(f) !== 'app/lab.tsx'),
    ];
    const offenders = real.filter((f) => importsOf(fs.readFileSync(f, 'utf8')).some((s) => /prototype/.test(s)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('prototip etkinlikleri gerçek eğitim havuzuna ve kilide girmez', () => {
    const labLike = (id: string): boolean => id.startsWith('lab-');
    expect(allCards.filter((c) => labLike(c.id))).toEqual([]);
    expect(playableCards.filter((c) => labLike(c.id))).toEqual([]);
    expect(masteryCards.filter((c) => labLike(c.id))).toEqual([]);
    expect([...allCases, ...playableCases].filter((c) => labLike(c.id))).toEqual([]);
    expect(concepts.filter((c) => labLike(c.id))).toEqual([]);
    expect(Object.keys(coreEntries({ cards: allCards, cases: allCases }, false)).filter(labLike)).toEqual([]);
    expect(Object.keys((releaseLock as { items: Record<string, string> }).items).filter(labLike)).toEqual([]);
  });

  it('lab rotası EXPO_PUBLIC_LAB=1 koşuluna bağlıdır', () => {
    const text = fs.readFileSync(path.join(SRC, 'app', 'lab.tsx'), 'utf8');
    expect(text).toContain("process.env.EXPO_PUBLIC_LAB !== '1'");
    expect(text).toContain('<Redirect href="/" />');
  });
});
