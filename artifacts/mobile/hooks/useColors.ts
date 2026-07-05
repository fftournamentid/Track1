import { useColorScheme } from "react-native";
import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * Falls back to the light palette when the device is in light mode or
 * when a dark palette is not defined.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
