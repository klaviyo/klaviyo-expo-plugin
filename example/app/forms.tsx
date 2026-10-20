import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { Klaviyo } from "klaviyo-react-native-sdk";
import { ExampleColors, useExampleTheme } from "../theme";

export default function FormsScreen() {
  const colors = useExampleTheme();
  const styles = createStyles(colors);
  const handleRegisterForInAppForms = () => {
    Klaviyo.registerForInAppForms();
  };

  const handleUnregisterFromInAppForms = () => {
    Klaviyo.unregisterFromInAppForms();
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>In-App Forms</Text>
        <TouchableOpacity
          style={[styles.button, styles.fullWidthButton]}
          onPress={handleRegisterForInAppForms}
        >
          <Text style={styles.buttonText}>Register for In-App Forms</Text>
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
      </View>
    </View>
  );
}

const createStyles = (colors: ExampleColors) => StyleSheet.create({
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
