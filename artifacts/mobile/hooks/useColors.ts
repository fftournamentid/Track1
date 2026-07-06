import colors from "@/constants/colors";

/**
 * Always returns the light (white + orange) design tokens.
 * Dark mode is disabled per brand requirements — background is always #FFFFFF.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
