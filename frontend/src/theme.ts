/**
 * TaxIQ Pro design tokens.
 *
 * Inspired by the Lufthansa centenary retro livery: deep navy fuselage,
 * crane yellow accent, crisp white lettering.
 */
export const lightTheme = {
  mode: 'light' as 'light' | 'dark',
  colors: {
    background: {
      app: '#F4F6FB', // app root background — cool paper white
      surface: '#FFFFFF', // cards, standard surfaces
      elevated: '#FFFFFF', // floating elements
      sunken: '#E7ECF7', // text inputs, inactive chips
    },
    text: {
      primary: '#05164D', // Lufthansa navy
      secondary: '#46577F',
      tertiary: '#7E8BA8',
      inverse: '#FFFFFF',
    },
    brand: {
      primary: '#05164D', // navy buttons, white lettering
      onPrimary: '#FFFFFF',
      secondary: '#A8710A', // crane yellow, darkened for contrast on white
      onSecondary: '#FFFFFF',
      tertiary: '#E6EBF7', // navy tint panels
    },
    semantic: {
      success: '#127E5B',
      warning: '#B3760A',
      danger: '#B22B2B',
      info: '#46577F',
    },
    border: {
      default: '#DDE3F0',
      strong: '#AAB5CE',
    },
    chart: [
      '#05164D', // Navy
      '#A8710A', // Crane gold
      '#127E5B', // Green
      '#B22B2B', // Red
      '#2E6BB8', // Sky blue
      '#7E8BA8', // Steel
    ],
    overlay: {
      scrim: 'rgba(5, 22, 77, 0.45)',
    },
    tabBar: {
      background: '#FFFFFF',
      active: '#05164D',
      inactive: '#7E8BA8',
    },
  },
  typography: {
    scale: {
      sm: 12,
      base: 14,
      lg: 16,
      xl: 20,
      xxl: 24,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radius: {
    sm: 6,
    md: 12,
    lg: 20,
    pill: 999,
  },
};

export const darkTheme = {
  mode: 'dark' as 'light' | 'dark',
  colors: {
    background: {
      app: '#05164D', // Lufthansa navy fuselage
      surface: '#0C2358',
      elevated: '#163069',
      sunken: '#030F38',
    },
    text: {
      primary: '#F2F5FC',
      secondary: '#AEBCDC',
      tertiary: '#8492B8',
      inverse: '#05164D',
    },
    brand: {
      primary: '#FFAD00', // crane yellow on navy
      onPrimary: '#05164D',
      secondary: '#1E3B7D',
      onSecondary: '#F2F5FC',
      tertiary: '#0F2765',
    },
    semantic: {
      success: '#3FC493',
      warning: '#FFAD00',
      danger: '#FF7A7A',
      info: '#AEBCDC',
    },
    border: {
      default: '#1E3468',
      strong: '#3D5793',
    },
    chart: [
      '#FFAD00', // Crane yellow
      '#3FC493', // Green
      '#FF7A7A', // Red
      '#6FA8FF', // Sky blue
      '#AEBCDC', // Steel
      '#D9B26B', // Sand
    ],
    overlay: {
      scrim: 'rgba(3, 15, 56, 0.7)',
    },
    tabBar: {
      background: '#0C2358',
      active: '#FFAD00',
      inactive: '#8492B8',
    },
  },
  typography: lightTheme.typography,
  spacing: lightTheme.spacing,
  radius: lightTheme.radius,
};

export type Theme = typeof lightTheme;

/**
 * Flat palette used by screens. Keys intentionally mirror the roles the old
 * hardcoded hex values played so every screen can stay a single StyleSheet.
 */
export type Palette = {
  bg: string;
  bgSunken: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textTertiary: string;
  onPrimary: string;
  accent: string;
  accentAlt: string;
  warning: string;
  danger: string;
  success: string;
  info: string;
  brandTint: string;
  tabBg: string;
  tabActive: string;
  tabInactive: string;
  scrim: string;
  chart: string[];
  isDark: boolean;
};

export function paletteFor(theme: Theme): Palette {
  const c = theme.colors;
  return {
    bg: c.background.app,
    bgSunken: c.background.sunken,
    surface: c.background.surface,
    surfaceAlt: c.background.sunken,
    elevated: c.background.elevated,
    border: c.border.default,
    borderStrong: c.border.strong,
    text: c.text.primary,
    textSecondary: c.text.secondary,
    textMuted: c.text.secondary,
    textTertiary: c.text.tertiary,
    onPrimary: c.brand.onPrimary,
    accent: c.brand.primary,
    accentAlt: c.brand.secondary,
    warning: c.semantic.warning,
    danger: c.semantic.danger,
    success: c.semantic.success,
    info: c.semantic.info,
    brandTint: c.brand.tertiary,
    tabBg: c.tabBar.background,
    tabActive: c.tabBar.active,
    tabInactive: c.tabBar.inactive,
    scrim: c.overlay.scrim,
    chart: [...c.chart],
    isDark: theme.mode === 'dark',
  };
}

export const lightPalette = paletteFor(lightTheme);
export const darkPalette = paletteFor(darkTheme);
