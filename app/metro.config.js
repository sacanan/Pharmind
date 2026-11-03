// Prototip (M1) yalnızca EXPO_PUBLIC_LAB=1 ile derlenen yapıya girer. Bayrak kapalıyken prototip
// kodu ve /lab rotası Metro tarafından hiç görülmez; pakette bulunmaz (scripts/verify-lab-build.mjs).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_PUBLIC_LAB !== '1') {
  const existing = config.resolver.blockList;
  const blocked = [/[\\/]src[\\/]prototype[\\/].*/, /[\\/]src[\\/]app[\\/]lab\.tsx$/];
  config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...blocked];
}

module.exports = config;
