import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Clipboard, Platform, ScrollView } from 'react-native';
import { Klaviyo } from 'klaviyo-react-native-sdk';
import * as Notifications from 'expo-notifications';

export default function PushScreen() {
  const [pushPermissionStatus, setPushPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    console.log('Setting up notifications...');
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Existing permission status:', existingStatus);
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      console.log('Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('New permission status:', status);
    }
    
    setPushPermissionStatus(finalStatus);
    
    if (finalStatus !== 'granted') {
      console.log('Permission not granted, stopping setup');
      Alert.alert('Permission Required', 'Push notifications are required for this app to function properly.');
      return;
    }
    console.log('Permissions granted, proceeding to get push token');
    handleGetPushToken();
  };

  const handleGetPushToken = async () => {
    try {
      console.log('Getting push token...');
      console.log('Platform:', Platform.OS);
      
      // Add timeout promise with longer timeout for iOS
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`getDevicePushTokenAsync timed out after ${Platform.OS === 'ios' ? '30' : '10'} seconds`));
        }, Platform.OS === 'ios' ? 30000 : 10000);
      });

      const tokenPromise = Notifications.getDevicePushTokenAsync();
      
      // Race between the actual call and the timeout
      const tokenResponse = await Promise.race([tokenPromise, timeoutPromise]) as Notifications.DevicePushToken;
      const token = tokenResponse.data;
      console.log('Extracted token:', token);
      setPushToken(token);      
      console.log('Setting token in Klaviyo...');
      try {
        Klaviyo.setPushToken(token);
        console.log('Token set in Klaviyo successfully');
      } catch (klaviyoError) {
        console.error('Error setting token in Klaviyo:', klaviyoError);
        Alert.alert('Warning', 'Token was retrieved but could not be set in Klaviyo. Please try again.');
      }
    } catch (error) {
      console.error('Error getting push token:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      Alert.alert('Error', `Failed to get push token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
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