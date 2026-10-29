let hookIndex = 0;
let slots: any[] = [];
let effects: (() => void | (() => void))[] = [];
let cleanup: (() => void) | void;
const unsubscribe = jest.fn();
let lifecycle: (event: any) => unknown;
const commands: string[] = [];
const register = jest.fn();
const open = jest.fn();

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useState: (initial: any) => {
    const index = hookIndex++;
    if (!(index in slots))
      slots[index] = typeof initial === "function" ? initial() : initial;
    return [
      slots[index],
      (value: any) => {
        slots[index] =
          typeof value === "function" ? value(slots[index]) : value;
      },
    ];
  },
  useRef: (initial: any) => {
    const index = hookIndex++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  },
  useEffect: (effect: () => void) => {
    const index = hookIndex++;
    if (!(index in slots)) {
      slots[index] = true;
      effects.push(effect);
    }
  },
}));
jest.mock(
  "react-native",
  () => ({
    useColorScheme: () => "dark",
    StyleSheet: { create: (value: any) => value },
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    ScrollView: "ScrollView",
    TouchableOpacity: "TouchableOpacity",
    Switch: "Switch",
  }),
  { virtual: true },
);
jest.mock(
  "klaviyo-react-native-sdk",
  () => ({
    FormLifecycleEventType: {
      WillDisplay: "formWillDisplay",
      Shown: "formShown",
      Dismissed: "formDismissed",
      CtaClicked: "formCtaClicked",
    },
    Klaviyo: {
      registerFormLifecycleHandler: jest.fn((handler: any) => {
        lifecycle = handler;
        return unsubscribe;
      }),
      registerForInAppForms: (...args: any[]) => {
        commands.push("register");
        register(...args);
      },
      unregisterFromInAppForms: () => {
        commands.push("unregister");
      },
      openForm: (...args: any[]) => open(...args),
      createEvent: jest.fn(),
    },
  }),
  { virtual: true },
);

import FormsScreen from "../example/app/forms";
import { Klaviyo } from "klaviyo-react-native-sdk";

type Element = { type: any; props: any };
let hosts: Element[];
const React = jest.requireActual("react");
function text(element: any): string {
  if (typeof element === "string" || typeof element === "number")
    return String(element);
  return React.Children.toArray(element?.props?.children).map(text).join("");
}
function render() {
  hookIndex = 0;
  hosts = [];
  function visit(element: Element) {
    if (!element || typeof element !== "object") return;
    if (typeof element.type === "function")
      return visit(element.type(element.props));
    hosts.push(element);
    React.Children.forEach(element.props.children, visit);
  }
  visit(FormsScreen());
  for (const effect of effects.splice(0)) cleanup = effect();
}
function input(label: string, value: string) {
  hosts
    .find(
      (element) =>
        element.type === "TextInput" &&
        element.props.accessibilityLabel === label,
    )!
    .props.onChangeText(value);
  render();
}
function press(label: string) {
  const button = hosts.find(
    (element) => element.type === "TouchableOpacity" && text(element) === label,
  )!;
  expect(button).toBeDefined();
  if (!button.props.disabled) button.props.onPress();
  render();
}
const output = () =>
  hosts
    .filter((element) => element.type === "Text")
    .map(text)
    .join("\n");

beforeEach(() => {
  slots = [];
  effects = [];
  commands.length = 0;
  cleanup = undefined;
  jest.clearAllMocks();
  render();
});
afterEach(() => {
  cleanup?.();
});

it("uses live trimmed exact reject IDs without re-registering and cleans up its handler", () => {
  const event = {
    type: "formWillDisplay",
    formId: "AbC",
    formName: "Sale",
    formType: "modal",
  };
  expect(lifecycle(event)).toBe(true);
  input("Reject form ID", " AbC ");
  expect(lifecycle(event)).toBe(false);
  expect(lifecycle({ ...event, formId: "abc" })).toBe(true);
  input("Reject form ID", "");
  expect(lifecycle(event)).toBe(true);
  expect(Klaviyo.registerFormLifecycleHandler).toHaveBeenCalledTimes(1);
  expect(register).not.toHaveBeenCalled();
  cleanup?.();
  cleanup = undefined;
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it("keeps invalid edits off the active attempt and retries explicitly with zero replay", () => {
  press("Register for In-App Forms");
  expect(register.mock.calls[0][0]).toMatchObject({
    eventReplayWindow: 10,
    onFailure: expect.any(Function),
  });
  expect(register.mock.calls[0][0].loadTimeout).toBeUndefined();
  expect(output()).toContain("Registration requested");
  expect(output()).toContain("Readiness is not reported");
  input("Load timeout seconds", "1.5");
  input("Replay window seconds", "31");
  press("Retry");
  expect(commands).toEqual(["register"]);
  expect(output()).toContain("whole");
  input("Load timeout seconds", "25");
  input("Replay window seconds", "0");
  register.mockImplementationOnce((configuration: any) =>
    configuration.onFailure(),
  );
  press("Retry");
  expect(commands).toEqual(["register", "unregister", "register"]);
  expect(register.mock.lastCall[0]).toMatchObject({
    loadTimeout: 25,
    eventReplayWindow: 0,
  });
  expect(output()).toContain("Failed");
  expect(output()).toContain("Terminal initialization failure");
  press("Unregister from In-App Forms");
  expect(output()).toContain("Unregistered");
});

it.each(["0", "-1", "NaN", "Infinity", "2.5"])(
  "rejects invalid timeout %s without changing registration",
  (value) => {
    input("Load timeout seconds", value);
    press("Register for In-App Forms");
    expect(register).not.toHaveBeenCalled();
  },
);

it("forwards every nonblank manual ID exactly regardless of registration and records commands separately from presentation", () => {
  press("Open");
  expect(open).not.toHaveBeenCalled();
  input("Manual form ID", "  Form-AbC  ");
  press("Open");
  expect(open).toHaveBeenCalledWith("  Form-AbC  ");
  expect(register).not.toHaveBeenCalled();
  expect(output()).toContain("Open requested");
  expect(output()).not.toContain("formShown");
  lifecycle({ type: "formShown", formId: "Form-AbC", formName: "Sale" });
  render();
  expect(output()).toContain("formShown");
});

it("bounds and clears activity without logging private URL payloads", () => {
  for (let index = 0; index < 55; index++)
    lifecycle({
      type: "formCtaClicked",
      formId: `form-${index}`,
      formName: "Sale",
      buttonLabel: "Buy",
      deepLinkUrl: "https://example.test?jwt=secret",
    });
  render();
  expect(output()).not.toContain('"formId":"form-0"');
  expect(output()).toContain('"formId":"form-54"');
  expect(output()).toContain('"buttonLabel":"Buy"');
  expect(output()).not.toContain("secret");
  press("Clear activity");
  expect(output()).not.toContain("form-54");
});

it("omits the optional failure callback and preserves the SDK timeout fallback boundary", () => {
  hosts
    .find((element) => element.type === "Switch")!
    .props.onValueChange(false);
  render();
  input("Load timeout seconds", "100000000000000000000");
  input("Replay window seconds", "30");
  press("Register for In-App Forms");
  expect(register.mock.lastCall[0]).toEqual({
    loadTimeout: 1e20,
    eventReplayWindow: 30,
  });
});

it.each(["", "-1", "1.5", "NaN", "Infinity", "31"])(
  "rejects invalid replay %s before Retry unregisters",
  (value) => {
    press("Register for In-App Forms");
    input("Replay window seconds", value);
    press("Retry");
    expect(commands).toEqual(["register"]);
  },
);

it("keeps manual Open available after initialization failure", () => {
  press("Register for In-App Forms");
  register.mock.lastCall[0].onFailure();
  render();
  input("Manual form ID", "pending-form");
  press("Open");
  expect(open).toHaveBeenCalledWith("pending-form");
  expect(output()).toContain("Failed");
  expect(commands).toEqual(["register"]);
});
