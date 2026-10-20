import { useColorScheme } from "react-native";

const light = {
  background: "#ffffff",
  surface: "#f5f5f5",
  card: "#f0f0f0",
  text: "#111111",
  secondaryText: "#595959",
  placeholder: "#666666",
  border: "#cccccc",
  accent: "#0066cc",
  button: "#0066cc",
  onButton: "#ffffff",
  successButton: "#218838",
  dangerButton: "#c92520",
  secondaryButton: "#5856c9",
  disabledButton: "#dddddd",
  disabledText: "#595959",
  warningBackground: "#fff3e0",
  warningText: "#994000",
  warningBorder: "#d98a00",
  successBackground: "#e8f5e9",
  successText: "#28632c",
  successBorder: "#4caf50",
};

export type ExampleColors = typeof light;

const dark: ExampleColors = {
  background: "#121212",
  surface: "#1c1c1e",
  card: "#242426",
  text: "#f5f5f5",
  secondaryText: "#bdbdbd",
  placeholder: "#a6a6aa",
  border: "#636366",
  accent: "#69b1ff",
  button: "#0066cc",
  onButton: "#ffffff",
  successButton: "#218838",
  dangerButton: "#c92520",
  secondaryButton: "#5856c9",
  disabledButton: "#38383a",
  disabledText: "#bdbdbd",
  warningBackground: "#382a16",
  warningText: "#ffcb85",
  warningBorder: "#b77920",
  successBackground: "#182d20",
  successText: "#9cdda5",
  successBorder: "#45834d",
};

export function useExampleTheme(): ExampleColors {
  return useColorScheme() === "dark" ? dark : light;
}
