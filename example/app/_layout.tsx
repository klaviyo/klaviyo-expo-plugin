import React from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Alert, ScrollView, Clipboard } from 'react-native';
import { Klaviyo } from 'klaviyo-react-native-sdk';
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const [apiKey, setApiKey] = useState('');
  const [profile, setProfile] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    externalId: ''
  });
  const [pushPermissionStatus, setPushPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    setupNotifications();

    // Foreground notification listener
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Received foreground notification:', notification);
      setLastNotification(notification);
    });

    // Background/Quit notification listener
    const backgroundSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Received background notification response:', response);
      setLastNotification(response.notification);
    });

    // Cleanup listeners on unmount
    return () => {
      foregroundSubscription.remove();
      backgroundSubscription.remove();
    };
  }, []);

  const setupNotifications = async () => {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      console.log('Requesting permissions');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    setPushPermissionStatus(finalStatus);
    
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Push notifications are required for this app to function properly.');
      return;
    }
    handleGetPushToken();
  };

  const handleGetPushToken = async () => {
    try {
      const token = (await Notifications.getDevicePushTokenAsync()).data;
      setPushToken(token);
      console.log('Expo Push Token:', token);
      Klaviyo.setPushToken(token);
    } catch (error) {
      console.error('Error getting push token:', error);
      Alert.alert('Error', 'Failed to get push token');
    }
  };

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

  const handleRegisterForInAppForms = () => {
    Klaviyo.registerForInAppForms();
  };

  return (
    <ScrollView style={styles.container}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>In-App Forms</Text>
        <TouchableOpacity style={[styles.button, styles.fullWidthButton]} onPress={handleRegisterForInAppForms}>
          <Text style={styles.buttonText}>Register for In-App Forms</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.fullWidthButton,
            pushPermissionStatus === 'granted' && styles.buttonSuccess
          ]} 
          onPress={setupNotifications}
        >
          <Text style={styles.buttonText}>
            {pushPermissionStatus === 'granted' ? 'Push Enabled' : 'Enable Push Notifications'}
          </Text>
        </TouchableOpacity>
        {pushPermissionStatus && (
          <Text style={styles.permissionStatus}>
            Status: {pushPermissionStatus}
          </Text>
        )}

        {lastNotification && (
          <View style={styles.notificationContainer}>
            <Text style={styles.notificationTitle}>Last Notification:</Text>
            <Text style={styles.notificationText}>
              Title: {lastNotification.request.content.title}
            </Text>
            <Text style={styles.notificationText}>
              Body: {lastNotification.request.content.body}
            </Text>
            {lastNotification.request.content.data && (
              <Text style={styles.notificationText}>
                Data: {JSON.stringify(lastNotification.request.content.data)}
              </Text>
            )}
          </View>
        )}

        {
          <>
            <TouchableOpacity 
              style={[styles.button, styles.fullWidthButton]} 
              onPress={handleGetPushToken}
            >
              <Text style={styles.buttonText}>
                {pushToken ? 'Update Push Token' : 'Get Push Token'}
              </Text>
            </TouchableOpacity>
            {pushToken && (
              <View style={styles.tokenContainer}>
                <Text style={styles.tokenLabel}>Current Token:</Text>
                <View style={styles.tokenRow}>
                  <Text style={styles.tokenText} selectable={true}>
                    {pushToken}
                  </Text>
                  <TouchableOpacity 
                    style={styles.copyButton}
                    onPress={() => {
                      Clipboard.setString(pushToken);
                      Alert.alert('Copied', 'Token copied to clipboard');
                    }}
                  >
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        }
      </View>
    </ScrollView>
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
  buttonSuccess: {
    backgroundColor: '#34C759',
  },
  permissionStatus: {
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
  tokenContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  tokenLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tokenText: {
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  copyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  notificationText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
});
