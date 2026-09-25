import { test, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { select: (values) => values.android },
  StyleSheet: { create: (styles) => styles, flatten: (style) => style },
}));

import { getThemeColors, setThemeMode } from '../src/shared/ui/theme/luxury';

const luminance = (hex) => {
  const [red, green, blue] = hex.match(/[\da-f]{2}/gi).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

test('filled buttons keep readable text in dark and light themes', () => {
  try {
    for (const mode of ['dark', 'light']) {
      setThemeMode(mode);
      const colors = getThemeColors();
      const foreground = luminance(colors.onAccent);
      for (const background of [colors.gold, colors.goldMid, colors.red]) {
        const surface = luminance(background);
        const contrast =
          (Math.max(foreground, surface) + 0.05) / (Math.min(foreground, surface) + 0.05);
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      }
    }
  } finally {
    setThemeMode('dark');
  }
});
