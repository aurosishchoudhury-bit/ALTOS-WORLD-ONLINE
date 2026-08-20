export const colors = {
  surface: "#FDFDF7",
  onSurface: "#22301F",
  surfaceSecondary: "#F1F7EC",
  onSurfaceSecondary: "#4A5A48",
  surfaceTertiary: "#E4EFDD",
  surfaceInverse: "#22301F",
  onSurfaceInverse: "#FDFDF7",
  brand: "#3E8E4C",
  brandSecondary: "#6FBF7B",
  brandTertiary: "#DCF2DE",
  onBrand: "#FFFFFF",
  success: "#2E9E5B",
  warning: "#E8963E",
  error: "#D9534F",
  border: "#DDE6D6",
  borderStrong: "#22301F",
  divider: "#DDE6D6",
  muted: "#7E8A7B",
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
