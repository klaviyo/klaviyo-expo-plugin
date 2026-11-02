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
    <View style={styles.container} testID="forms_screen">
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">In-App Forms</Text>
        <TouchableOpacity
          style={[styles.button, styles.fullWidthButton]}
          testID="forms_register_button"
          accessibilityRole="button"
          accessibilityLabel="Register for in-app forms"
          onPress={handleRegisterForInAppForms}
        >
          <Text style={styles.buttonText}>Register for In-App Forms</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.fullWidthButton]}
          testID="forms_unregister_button"
          accessibilityRole="button"
          accessibilityLabel="Unregister from in-app forms"
          onPress={handleUnregisterFromInAppForms}
        >
          <Text style={styles.buttonText}>Unregister from In-App Forms</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.fullWidthButton]}
          testID="events_added_to_cart_button"
          accessibilityRole="button"
          accessibilityLabel="Create Added to Cart event"
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
