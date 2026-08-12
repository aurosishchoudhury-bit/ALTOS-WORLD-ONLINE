import { useFonts } from "expo-font";

export const useAppFonts = (): readonly [boolean, Error | null] =>
  useFonts({
    CormorantGaramond: require("../../assets/fonts/CormorantGaramond-Regular.ttf"),
    "CormorantGaramond-Medium": require("../../assets/fonts/CormorantGaramond-Medium.ttf"),
    "CormorantGaramond-SemiBold": require("../../assets/fonts/CormorantGaramond-SemiBold.ttf"),
    DMSans: require("../../assets/fonts/DMSans-Regular.ttf"),
    "DMSans-Medium": require("../../assets/fonts/DMSans-Medium.ttf"),
    "DMSans-SemiBold": require("../../assets/fonts/DMSans-SemiBold.ttf"),
  });
