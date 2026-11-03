import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/schibsted-grotesk';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { isIsolatedLabRoute } from '../core/lab-route';
import { ProgressProvider } from '../state/progress-context';
import { colors } from '../ui/theme';

declare const process: { env: Record<string, string | undefined> };

export default function RootLayout() {
  const pathname = usePathname();
  const [loaded, error] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
  });

  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir.
  if (!loaded && !error) return null;

  const content = (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          animation: 'fade',
        }}
      />
    </>
  );

  // Prototip rotası ilerleme sağlayıcısı olmadan açılır: diskten okuma ve yedek yazma yolu yoktur.
  if (isIsolatedLabRoute(process.env.EXPO_PUBLIC_LAB, pathname)) return content;
  return <ProgressProvider>{content}</ProgressProvider>;
}
