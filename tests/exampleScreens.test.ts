let colorScheme: "light" | "dark" = "light";
const hosts: { name: string; props: Record<string, unknown> }[] = [];

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useState: (initial: unknown) => [
    typeof initial === "function" ? initial() : initial,
    () => undefined,
  ],
  useEffect: () => undefined,
  useRef: (initial: unknown) => ({ current: initial }),
}));
jest.mock(
  "react-native",
  () => ({
    useColorScheme: () => colorScheme,
    StyleSheet: { create: (styles: unknown) => styles },
    Platform: { OS: "ios" },
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    ScrollView: "ScrollView",
    TouchableOpacity: "TouchableOpacity",
    Pressable: "Pressable",
    Switch: "Switch",
    Modal: "Modal",
  }),
  { virtual: true },
);
jest.mock("klaviyo-react-native-sdk", () => ({ Klaviyo: {} }), {
  virtual: true,
});
jest.mock("@react-native-async-storage/async-storage", () => ({}), {
  virtual: true,
});
jest.mock("expo-constants", () => ({ expoConfig: {} }), { virtual: true });
jest.mock("expo-location", () => ({}), { virtual: true });
jest.mock("expo-application", () => ({ nativeBuildVersion: "1" }), {
  virtual: true,
});
jest.mock("expo-clipboard", () => ({}), { virtual: true });
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }), {
  virtual: true,
});
jest.mock(
  "react-native-safe-area-context",
  () => ({ SafeAreaView: "SafeAreaView" }),
  { virtual: true },
);
jest.mock(
  "expo-router",
  () => {
    const Tabs = Object.assign(
      (props: Record<string, unknown>) =>
        jest.requireActual("react").createElement("Tabs", props),
      { Screen: () => null },
    );
    return { Tabs, useNavigation: () => ({}) };
  },
  { virtual: true },
);
jest.mock("expo-task-manager", () => ({ defineTask: () => undefined }), {
  virtual: true,
});
jest.mock(
  "expo-notifications",
  () => ({ setNotificationHandler: () => undefined }),
  { virtual: true },
);
jest.mock("expo-linking", () => ({}), { virtual: true });
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }), {
  virtual: true,
});

import { useExampleTheme } from "../example/theme";

const React = jest.requireActual("react");
type Element = {
  type: string | symbol | ((props: Record<string, unknown>) => Element);
  props: Record<string, unknown>;
};

function inspect(element: Element): void {
  if (!element || typeof element !== "object") return;
  if (typeof element.type === "function") {
    inspect(element.type(element.props));
    return;
  }
  if (typeof element.type === "string") {
    hosts.push({ name: element.type, props: element.props });
  }
  React.Children.forEach(element.props.children, inspect);
}

const screens = [
  ["Profile", jest.requireActual("../example/app/index").default],
  ["Forms", jest.requireActual("../example/app/forms").default],
  ["Push", jest.requireActual("../example/app/push").default],
  ["Geofencing", jest.requireActual("../example/app/geofencing").default],
  [
    "Build info",
    jest.requireActual("../example/components/BuildInfoModal").BuildInfoModal,
  ],
];

function flatten(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.map(flatten))
    : style || {};
}

describe.each(["light", "dark"] as const)(
  "example screens in %s appearance",
  (scheme) => {
    beforeEach(() => {
      colorScheme = scheme;
      hosts.length = 0;
    });

    it.each(screens)(
      "renders %s with themed surfaces and explicit text colors",
      (_name, Screen) => {
        inspect(
          React.createElement(Screen, {
            visible: true,
            onClose: () => undefined,
          }),
        );
        const colors = useExampleTheme();
        const surface = hosts.find(({ name }) =>
          ["View", "ScrollView", "SafeAreaView"].includes(name),
        )!;
        expect(flatten(surface.props.style).backgroundColor).toBe(
          colors.background,
        );
        const text = hosts.filter(({ name }) => name === "Text");
        expect(text.length).toBeGreaterThan(0);
        for (const { props } of text) {
          expect(flatten(props.style).color).toMatch(/^#[a-f\d]{6}$/i);
        }
        for (const { props } of hosts.filter(
          ({ name }) => name === "TouchableOpacity",
        )) {
          const background = flatten(props.style).backgroundColor;
          if (!background) continue;
          const label = React.Children.toArray(props.children).find(
            (child: Element) => child.type === "Text",
          );
          expect(flatten(label.props.style).color).toBe(
            background === colors.disabledButton
              ? colors.disabledText
              : colors.onButton,
          );
        }
        for (const { props } of hosts.filter(
          ({ name }) => name === "TextInput",
        )) {
          expect(flatten(props.style).color).toBe(colors.text);
          expect(flatten(props.style).backgroundColor).toBe(colors.background);
          expect(props.placeholderTextColor).toBe(colors.placeholder);
          expect(props.selectionColor).toBe(colors.accent);
        }
      },
    );

    it("matches tab, header and scene surfaces to the system appearance", () => {
      const Layout = jest.requireActual("../example/app/_layout").default;
      inspect(React.createElement(Layout));
      const colors = useExampleTheme();
      const options = hosts.find(({ name }) => name === "Tabs")!.props
        .screenOptions as Record<string, unknown>;
      expect(flatten(options.headerStyle).backgroundColor).toBe(colors.surface);
      expect(flatten(options.tabBarStyle).backgroundColor).toBe(colors.surface);
      expect(flatten(options.sceneStyle).backgroundColor).toBe(
        colors.background,
      );
      expect(flatten(options.headerTitleStyle).color).toBe(colors.text);
      expect(options.tabBarActiveTintColor).toBe(colors.accent);
    });
  },
);
