import type { TextStyle } from 'react-native';

/**
 * Renkler yalnızca anlam taşır: yeşil = doğru, kırmızı = yanlış, kehribar = dikkat/kararsız.
 * Süs olarak kullanılmaz. Ana düğme mürekkep rengindedir (yeşil "doğru" demek).
 */
export const colors = {
  paper: '#EFF2F0',
  ink: '#1A2428',
  inkSoft: '#4A585D',
  foil: '#C5CCCA',
  /** Boş/seçilmemiş öğelerin çerçevesi: kâğıda karşı en az 3:1 (foil yalnızca süs ve dolgu için). */
  edge: '#76858A',
  correct: '#137A55',
  wrong: '#C93A2F',
  attention: '#D18B14',
} as const;

export const fonts = {
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  bold: 'SchibstedGrotesk_700Bold',
  heavy: 'SchibstedGrotesk_800ExtraBold',
} as const;

/** 8 piksellik ızgara */
export const space = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 } as const;

export const type = {
  title: {
    fontFamily: fonts.heavy,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  question: {
    fontFamily: fonts.heavy,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.ink,
  },
  bodyStrong: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 26,
    color: colors.ink,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
  },
} satisfies Record<string, TextStyle>;

/** İçerik sütununun azami genişliği (web ve tablet için) */
export const COLUMN_WIDTH = 560;

/** Dokunma hedefi en az 48 piksel */
export const TOUCH = 48;
