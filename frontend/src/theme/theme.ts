export const colors = {
  surface: "#FDFDF9",
  onSurface: "#2A2F2A",
  surfaceSecondary: "#F4F4EE",
  onSurfaceSecondary: "#555C55",
  surfaceTertiary: "#EAEAE2",
  surfaceInverse: "#2A2F2A",
  onSurfaceInverse: "#FDFDF9",
  brand: "#657962",
  brandSecondary: "#8FA38C",
  brandTertiary: "#E2E7E0",
  onBrand: "#FFFFFF",
  success: "#4A6D50",
  warning: "#C28B4E",
  error: "#A85C5C",
  border: "#E1E1DA",
  borderStrong: "#2A2F2A",
  divider: "#E1E1DA",
  muted: "#8A8F88",
};

export const fonts = {
  display: "CormorantGaramond",
  displayMedium: "CormorantGaramond-Medium",
  displaySemiBold: "CormorantGaramond-SemiBold",
  text: "DMSans",
  textMedium: "DMSans-Medium",
  textSemiBold: "DMSans-SemiBold",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 0,
  md: 4,
  lg: 8,
  pill: 999,
};

export const type = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
};

export const formatINR = (value: number): string =>
  "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 });
