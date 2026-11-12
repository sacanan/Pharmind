// Prototip (M1) yalnızca EXPO_PUBLIC_LAB=1 ile derlenen yapıya girer. Bayrak kapalıyken prototip
// kodu ve /lab rotası Metro tarafından hiç görülmez; pakette bulunmaz (scripts/verify-lab-build.mjs).
const { getDefaultConfig } = require('expo/metro-config');

const labFlag = process.env.EXPO_PUBLIC_LAB === '1';

// Üretim (NODE_ENV=production) derlemesinde bayrak yanlışlıkla açık kalırsa derleme DURUR. Prototipli
// önizleme derlemesi yalnızca `npm run export:lab` ile (PHARMIND_LAB_BUILD=1) alınabilir.
if (labFlag && process.env.NODE_ENV === 'production' && process.env.PHARMIND_LAB_BUILD !== '1') {
  throw new Error(
    'EXPO_PUBLIC_LAB=1 ile üretim derlemesi reddedildi. Prototipli önizleme için `npm run export:lab` kullanın; ' +
      'üretim derlemesinde EXPO_PUBLIC_LAB ayarlı olmamalıdır.',
  );
}

const config = getDefaultConfig(__dirname);

if (!labFlag) {
  const existing = config.resolver.blockList;
  const blocked = [/[\\/]src[\\/]prototype[\\/].*/, /[\\/]src[\\/]app[\\/]lab\.tsx$/];
  config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...blocked];
}

module.exports = config;
