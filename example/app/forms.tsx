import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Switch,
  TouchableOpacity,
} from "react-native";
import { Klaviyo, FormLifecycleEventType } from "klaviyo-react-native-sdk";
import type {
  FormConfiguration,
  FormLifecycleEvent,
} from "klaviyo-react-native-sdk";
import { ExampleColors, useExampleTheme } from "../theme";

export default function FormsScreen() {
  const colors = useExampleTheme();
  const styles = createStyles(colors);
  const [rejectId, setRejectId] = useState("");
  const rejectedId = useRef("");
  const [loadTimeout, setLoadTimeout] = useState("");
  const [replayWindow, setReplayWindow] = useState("10");
  const [reportFailure, setReportFailure] = useState(true);
  const [manualId, setManualId] = useState("");
  const [status, setStatus] = useState("Unregistered");
  const [activity, setActivity] = useState<string[]>([]);
  const timeout = loadTimeout.trim() === "" ? undefined : Number(loadTimeout);
  const replay = Number(replayWindow);
  const timeoutError =
    timeout !== undefined &&
    (!Number.isFinite(timeout) || !Number.isInteger(timeout) || timeout <= 0)
      ? "Load timeout must be a positive finite whole number of seconds, or blank for the SDK default."
      : undefined;
  const replayError =
    replayWindow.trim() === "" ||
    !Number.isFinite(replay) ||
    !Number.isInteger(replay) ||
    replay < 0 ||
    replay > 30
      ? "Replay window must be a whole number from 0 to 30 seconds."
      : undefined;
  const valid = !timeoutError && !replayError;

  const log = (message: string) =>
    setActivity((current) => [...current, message].slice(-50));

  useEffect(
    () =>
      Klaviyo.registerFormLifecycleHandler((event: FormLifecycleEvent) => {
        const metadata = {
          formId: event.formId,
          formName: event.formName,
          ...(event.type === FormLifecycleEventType.WillDisplay
            ? { formType: event.formType }
            : {}),
          ...(event.type === FormLifecycleEventType.CtaClicked
            ? { buttonLabel: event.buttonLabel }
            : {}),
        };
        if (event.type === FormLifecycleEventType.WillDisplay) {
          const allow =
            rejectedId.current === "" || event.formId !== rejectedId.current;
          log(
            `${event.type} ${JSON.stringify(metadata)} — ${allow ? "allow" : "reject"}`,
          );
          return allow;
        }
        log(`${event.type} ${JSON.stringify(metadata)}`);
      }),
    [],
  );

  const register = (retry: boolean) => {
    if (!valid) return;
    const configuration: FormConfiguration = {
      ...(timeout === undefined ? {} : { loadTimeout: timeout }),
      eventReplayWindow: replay,
      ...(reportFailure
        ? {
            onFailure: () => {
              setStatus("Failed");
              log("Terminal initialization failure");
            },
          }
        : {}),
    };
    setStatus("Registration requested");
    log(
      `${retry ? "Retry" : "Registration"} requested: timeout=${timeout ?? "SDK default"}, replay=${replay}s, failure callback=${reportFailure ? "on" : "off"}`,
    );
    try {
      if (retry) Klaviyo.unregisterFromInAppForms();
      Klaviyo.registerForInAppForms(configuration);
    } catch {
      setStatus("Failed");
      log("Registration command failed");
    }
  };

  const handleUnregisterFromInAppForms = () => {
    Klaviyo.unregisterFromInAppForms();
    setStatus("Unregistered");
    log("Unregister requested");
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>In-App Forms</Text>
        <Text style={styles.text}>Status: {status}</Text>
        <Text style={styles.detail}>
          Readiness is not reported. Registration requests setup; lifecycle
          events report presentation. After a failure, use Retry or Unregister.
        </Text>
        <Text style={styles.text}>Load timeout (seconds)</Text>
        <TextInput
          accessibilityLabel="Load timeout seconds"
          style={styles.input}
          value={loadTimeout}
          onChangeText={setLoadTimeout}
          keyboardType="numeric"
          placeholder="SDK default"
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
        />
        {timeoutError && <Text style={styles.error}>{timeoutError}</Text>}
        <Text style={styles.text}>Replay window (seconds)</Text>
        <TextInput
          accessibilityLabel="Replay window seconds"
          style={styles.input}
          value={replayWindow}
          onChangeText={setReplayWindow}
          keyboardType="numeric"
          placeholder="10"
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
        />
        {replayError && <Text style={styles.error}>{replayError}</Text>}
        <Text style={styles.detail}>
          0 disables historical replay; live events stay enabled. Settings apply
          on Register or Retry. Retry starts a new load.
        </Text>
        <View style={styles.row}>
          <Text style={styles.text}>Report initialization failure</Text>
          <Switch
            accessibilityLabel="Report initialization failure"
            value={reportFailure}
            onValueChange={setReportFailure}
          />
        </View>
        <TouchableOpacity
          style={[styles.button, !valid && styles.disabledButton]}
          accessibilityRole="button"
          disabled={!valid}
          onPress={() => register(false)}
        >
          <Text style={[styles.buttonText, !valid && styles.disabledText]}>
            Register for In-App Forms
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !valid && styles.disabledButton]}
          accessibilityRole="button"
          disabled={!valid}
          onPress={() => register(true)}
        >
          <Text style={[styles.buttonText, !valid && styles.disabledText]}>
            Retry
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.fullWidthButton]}
          accessibilityRole="button"
          onPress={handleUnregisterFromInAppForms}
        >
          <Text style={styles.buttonText}>Unregister from In-App Forms</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.fullWidthButton]}
          accessibilityRole="button"
          onPress={() => Klaviyo.createEvent({ name: "Added to Cart" })}
        >
          <Text style={styles.buttonText}>Track Added to Cart</Text>
        </TouchableOpacity>
        <Text style={styles.text}>Reject form ID (optional)</Text>
        <TextInput
          accessibilityLabel="Reject form ID"
          style={styles.input}
          value={rejectId}
          onChangeText={(value) => {
            rejectedId.current = value.trim();
            setRejectId(value);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Blank allows every form"
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
        />
        <Text style={styles.detail}>
          Matches the trimmed ID exactly, including case. Changes apply to the
          next display decision immediately.
        </Text>
        <Text style={styles.text}>Manual form ID</Text>
        <TextInput
          accessibilityLabel="Manual form ID"
          style={styles.input}
          value={manualId}
          onChangeText={setManualId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Enter a form ID"
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
        />
        <TouchableOpacity
          style={[
            styles.button,
            manualId.trim() === "" && styles.disabledButton,
          ]}
          accessibilityRole="button"
          disabled={manualId.trim() === ""}
          onPress={() => {
            log(`Open requested: ${JSON.stringify(manualId)}`);
            Klaviyo.openForm(manualId);
          }}
        >
          <Text
            style={[
              styles.buttonText,
              manualId.trim() === "" && styles.disabledText,
            ]}
          >
            Open
          </Text>
        </TouchableOpacity>
        <Text style={styles.detail}>
          Register before opening. Open sends the ID exactly as entered;
          presentation is reported by lifecycle events.
        </Text>
        <Text style={styles.sectionTitle}>Lifecycle activity (last 50)</Text>
        <TouchableOpacity
          style={styles.button}
          accessibilityRole="button"
          onPress={() => setActivity([])}
        >
          <Text style={styles.buttonText}>Clear activity</Text>
        </TouchableOpacity>
        {activity.map((entry, index) => (
          <Text key={index} style={styles.activity}>
            {entry}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ExampleColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    section: {
      padding: 20,
      gap: 15,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 10,
    },
    text: { color: colors.text },
    detail: { color: colors.secondaryText },
    error: {
      color: colors.warningText,
      backgroundColor: colors.warningBackground,
      padding: 8,
    },
    activity: { color: colors.text, backgroundColor: colors.card, padding: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    input: {
      color: colors.text,
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
    },
    disabledButton: { backgroundColor: colors.disabledButton },
    disabledText: { color: colors.disabledText },
    button: {
      backgroundColor: colors.button,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
    },
    fullWidthButton: {
      width: "100%",
    },
    buttonText: {
      color: colors.onButton,
      fontSize: 16,
      fontWeight: "bold",
    },
  });
