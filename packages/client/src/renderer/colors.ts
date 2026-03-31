/**
 * 3270 Color Mapping and Themes
 *
 * Maps 3270 extended color values to CSS color strings.
 * Provides theme support for different terminal appearances.
 */

import { Color3270 } from '@tn3270/shared';

export interface ColorTheme {
  name: string;
  background: string;
  /** Default text color when no field attribute or extended color is set */
  defaultColor: string;
  /** Color map for extended 3270 colors */
  colors: Record<number, string>;
  /** Cursor color */
  cursor: string;
  /** Status bar background */
  statusBackground: string;
  /** Status bar text */
  statusText: string;
}

const STANDARD_COLORS: Record<number, string> = {
  [Color3270.BLUE]: '#5555ff',
  [Color3270.RED]: '#ff5555',
  [Color3270.PINK]: '#ff55ff',
  [Color3270.GREEN]: '#33ff33',
  [Color3270.TURQUOISE]: '#55ffff',
  [Color3270.YELLOW]: '#ffff55',
  [Color3270.WHITE]: '#ffffff',
};

export const GREEN_ON_BLACK: ColorTheme = {
  name: 'Green on Black',
  background: '#000000',
  defaultColor: '#33ff33',
  colors: STANDARD_COLORS,
  cursor: '#33ff33',
  statusBackground: '#1a1a1a',
  statusText: '#33ff33',
};

export const AMBER_ON_BLACK: ColorTheme = {
  name: 'Amber on Black',
  background: '#000000',
  defaultColor: '#ffaa00',
  colors: {
    ...STANDARD_COLORS,
    [Color3270.GREEN]: '#ffaa00',
  },
  cursor: '#ffaa00',
  statusBackground: '#1a1a1a',
  statusText: '#ffaa00',
};

export const WHITE_ON_BLACK: ColorTheme = {
  name: 'White on Black',
  background: '#000000',
  defaultColor: '#cccccc',
  colors: STANDARD_COLORS,
  cursor: '#ffffff',
  statusBackground: '#1a1a1a',
  statusText: '#cccccc',
};

export const DEFAULT_THEME = GREEN_ON_BLACK;

/**
 * Resolve a 3270 color value to a CSS color string.
 * Returns the theme default if the color is 0x00 (default).
 */
export function resolveColor(colorValue: number, theme: ColorTheme): string {
  if (colorValue === Color3270.DEFAULT || colorValue === 0x00) {
    return theme.defaultColor;
  }
  return theme.colors[colorValue] ?? theme.defaultColor;
}
