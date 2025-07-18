import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Klaviyo } from 'klaviyo-react-native-sdk';

export default function ProfileScreen() {
  const [apiKey, setApiKey] = useState('');
  const [profile, setProfile] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    externalId: ''
  });

  const handleInitialize = () => {
    if (apiKey.length !== 6) {
      Alert.alert('Invalid API Key', 'Please enter a 6-character API key');
      return;
    }
    Klaviyo.initialize(apiKey);
  };

  const handleTrackEvent = () => {
    Klaviyo.createEvent({
      name: 'Test Event',
    });
  };

  const handleSaveProfile = () => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Phone validation (basic format check)
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (profile.phoneNumber && !phoneRegex.test(profile.phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    Klaviyo.setProfile({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phoneNumber: profile.phoneNumber,
      externalId: profile.externalId
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.apiInput}
            placeholder="Enter 6-char API key"
            value={apiKey}
            onChangeText={setApiKey}
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={handleInitialize}>
            <Text style={styles.buttonText}>Initialize</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.button, styles.fullWidthButton]} onPress={handleTrackEvent}>
          <Text style={styles.buttonText}>Track Event</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={profile.email}
          onChangeText={(text) => setProfile({ ...profile, email: text })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={profile.firstName}
          onChangeText={(text) => setProfile({ ...profile, firstName: text })}
        />
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={profile.lastName}
          onChangeText={(text) => setProfile({ ...profile, lastName: text })}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={profile.phoneNumber}
          onChangeText={(text) => setProfile({ ...profile, phoneNumber: text })}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="External ID"
          value={profile.externalId}
          onChangeText={(text) => setProfile({ ...profile, externalId: text })}
        />
        <TouchableOpacity style={[styles.button, styles.fullWidthButton]} onPress={handleSaveProfile}>
          <Text style={styles.buttonText}>Save Profile</Text>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  apiInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
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