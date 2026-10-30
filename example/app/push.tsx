import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Clipboard, Platform, ScrollView } from 'react-native';
import { Klaviyo } from 'klaviyo-react-native-sdk';
import * as Notifications from 'expo-notifications';
import { useNavigation } from 'expo-router';
import { ExampleColors, useExampleTheme } from '../theme';

// Add type declaration for global variable
declare global {
  var lastBackgroundNotification: any;
}

export default function PushScreen() {
  const colors = useExampleTheme();
  const styles = createStyles(colors);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  const [lastSilentNotification, setLastSilentNotification] = useState<any>(null);
  const [lastBackgroundNotification, setLastBackgroundNotification] = useState<any>(null);
  const navigation = useNavigation();

  useEffect(() => {
    setupNotifications();
    
    // Check for any background notifications that were received
    if (global.lastBackgroundNotification) {
      console.log('Found background notification in global:', global.lastBackgroundNotification);
      setLastBackgroundNotification(global.lastBackgroundNotification);
    }

    // Add a listener for when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Push screen focused, checking for background notifications');
      if (global.lastBackgroundNotification) {
        console.log('Found background notification on focus:', global.lastBackgroundNotification);
        setLastBackgroundNotification(global.lastBackgroundNotification);
      }
    });

    // Cleanup function
    return () => {
      unsubscribe();
    };
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

  const renderNotificationPayload = (notification: any, type: 'regular' | 'silent' | 'background') => {
    if (!notification) return null;

    console.log('Rendering notification:', { type, notification });

    const content = notification.request?.content || notification;
    const data = content.data || {};
    const aps = data?.aps as Record<string, unknown> | undefined;
    const isSilent = aps?.contentAvailable === 1 && aps?.alert == null;

    // Helper function to safely stringify objects
    const safeStringify = (obj: any) => {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    };

    return (
      <View style={styles.notificationContainer} testID={`push_last_${type}_notification`}>
        <Text style={styles.notificationTitle}>
          {type === 'background' ? 'Last Background Notification:' : 
           type === 'silent' ? 'Last Silent Push:' : 'Last Notification:'}
        </Text>
        {content.title && (
          <Text style={styles.notificationText}>
            Title: {content.title}
          </Text>
        )}
        {content.body && (
          <Text style={styles.notificationText}>
            Body: {typeof content.body === 'object' ? safeStringify(content.body) : content.body}
          </Text>
        )}
        <Text style={styles.notificationText}>
          Data: {safeStringify(data)}
        </Text>
        {notification.key_value_pairs && (
          <Text style={styles.notificationText}>
            Key-Value Pairs: {safeStringify(notification.key_value_pairs)}
          </Text>
        )}
        <Text style={styles.notificationText}>
          Received: {new Date(notification.receivedAt || notification.date).toLocaleString()}
        </Text>
        {type === 'background' && (
          <Text style={styles.notificationText}>
            Source: Background Task
          </Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} testID="push_screen">
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">Push Notifications</Text>
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.fullWidthButton,
            pushPermissionStatus === 'granted' && styles.buttonSuccess
          ]} 
          testID="push_request_permission_button"
          accessibilityRole="button"
          onPress={setupNotifications}
        >
          <Text style={styles.buttonText}>
            {pushPermissionStatus === 'granted' ? 'Push Enabled' : 'Enable Push Notifications'}
          </Text>
        </TouchableOpacity>
        {pushPermissionStatus && (
          <Text style={styles.permissionStatus} testID="push_permission_status_text">
            Status: {pushPermissionStatus}
          </Text>
        )}

        {lastNotification && renderNotificationPayload(lastNotification, 'regular')}
        {lastSilentNotification && renderNotificationPayload(lastSilentNotification, 'silent')}
        {lastBackgroundNotification && renderNotificationPayload(lastBackgroundNotification, 'background')}

        {
          <>
            <TouchableOpacity 
              style={[styles.button, styles.fullWidthButton]} 
              testID="push_get_token_button"
              accessibilityRole="button"
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
                  <Text style={styles.tokenText} selectable={true} testID="push_token_text">
                    {pushToken}
                  </Text>
                  <TouchableOpacity 
                    style={styles.copyButton}
                    testID="push_copy_token_button"
                    accessibilityRole="button"
                    accessibilityLabel="Copy push token"
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
    fontWeight: 'bold',
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.button,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  fullWidthButton: {
    width: '100%',
  },
  buttonText: {
    color: colors.onButton,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSuccess: {
    backgroundColor: colors.successButton,
  },
  permissionStatus: {
    textAlign: 'center',
    marginTop: 8,
    color: colors.secondaryText,
  },
  tokenContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  tokenLabel: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 5,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tokenText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  copyButton: {
    backgroundColor: colors.button,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: colors.onButton,
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: colors.text,
  },
  notificationText: {
    fontSize: 12,
    color: colors.secondaryText,
    marginBottom: 3,
    fontFamily: 'monospace',
  },
});
