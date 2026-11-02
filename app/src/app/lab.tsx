import { Redirect } from 'expo-router';
import { LabFlow } from '../prototype/ui/LabFlow';

// Expo derleme sırasında `process.env.EXPO_PUBLIC_*` ifadesini sabit değerle değiştirir.
declare const process: { env: Record<string, string | undefined> };

/**
 * M1 oyun prototipi. Yalnızca `EXPO_PUBLIC_LAB=1` ile derlenmiş yapıda açılır; aksi halde ana
 * sayfaya yönlendirir. Ana ekrandan bağlantı verilmez. Hiçbir ilerleme kaydına dokunmaz.
 */
export default function Lab() {
  if (process.env.EXPO_PUBLIC_LAB !== '1') return <Redirect href="/" />;
  return <LabFlow />;
}
