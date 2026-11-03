import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

declare const process: { env: Record<string, string | undefined> };
declare const require: (name: string) => { LabFlow: ComponentType };

/**
 * Prototip rotası. Yalnızca `EXPO_PUBLIC_LAB=1` ile derlenen yapıda açılır. Bayrak derleme sırasında
 * değere çevrildiği için bayraksız derlemede aşağıdaki `require` ölü koda düşer ve prototip kodu
 * pakete hiç girmez (scripts/verify-lab-build.mjs bunu denetler). Bayrak bir erişim yetkisi değildir.
 */
export default function Lab() {
  if (process.env.EXPO_PUBLIC_LAB !== '1') return <Redirect href="/" />;
  const { LabFlow } = require('../prototype/ui/LabFlow');
  return <LabFlow />;
}
