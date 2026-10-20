import { useExampleTheme } from "../example/theme";

let colorScheme: "light" | "dark" | null = null;
jest.mock(
  "react-native",
  () => ({
    useColorScheme: () => colorScheme,
  }),
  { virtual: true },
);

function luminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("example appearance", () => {
  it("uses dark surfaces when the system changes appearance and falls back to light", () => {
    colorScheme = "light";
    const light = useExampleTheme();
    colorScheme = "dark";
    const dark = useExampleTheme();
    expect(luminance(dark.background)).toBeLessThan(0.05);
    expect(luminance(light.background)).toBeGreaterThan(0.9);
    colorScheme = null;
    expect(useExampleTheme()).toEqual(light);
  });

  it.each(["light", "dark"] as const)(
    "keeps %s text, inputs, cards and actions readable",
    (scheme) => {
      colorScheme = scheme;
      const colors = useExampleTheme();
      for (const surface of [colors.background, colors.surface, colors.card]) {
        expect(contrast(colors.text, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colors.secondaryText, surface)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      expect(
        contrast(colors.placeholder, colors.background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colors.warningText, colors.warningBackground),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colors.successText, colors.successBackground),
      ).toBeGreaterThanOrEqual(4.5);
      for (const action of [
        colors.button,
        colors.successButton,
        colors.dangerButton,
        colors.secondaryButton,
      ]) {
        expect(contrast(colors.onButton, action)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
