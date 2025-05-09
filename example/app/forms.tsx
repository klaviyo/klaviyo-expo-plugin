import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Klaviyo } from 'klaviyo-react-native-sdk';

export default function FormsScreen() {
  const handleRegisterForInAppForms = () => {
    Klaviyo.registerForInAppForms();
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>In-App Forms</Text>
        <TouchableOpacity style={[styles.button, styles.fullWidthButton]} onPress={handleRegisterForInAppForms}>
          <Text style={styles.buttonText}>Register for In-App Forms</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 20,
    gap: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  fullWidthButton: {
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 