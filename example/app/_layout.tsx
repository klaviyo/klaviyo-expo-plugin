import React, { useEffect } from 'react';
import { StyleSheet, Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Klaviyo } from 'klaviyo-react-native-sdk';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// Define the background task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  console.log('Received a notification in background task!', {
    data,
    error,
    executionInfo
  });

  if (error) {
    console.error('Error in background notification task:', error);
    return;
  }

  // Store the notification data in global variable for later retrieval
  if (data) {
    const notificationData = {
      ...data,
      receivedAt: new Date().toISOString(),
      isBackground: true
    };
    // Store in global variable
    global.lastBackgroundNotification = notificationData;
    console.log('Stored background notification:', notificationData);
  }
});

// Helper function to check for new background notifications
export const checkForBackgroundNotifications = () => {
  if (global.lastBackgroundNotification) {
    console.log('Found background notification:', global.lastBackgroundNotification);
    return global.lastBackgroundNotification;
  }
  return null;
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check for silent push by looking at content-available in APS payload
    const isSilentPush = notification.request.content.data?.aps?.contentAvailable === 1;
    
    console.log('Notification received:', {
      isSilentPush,
      data: notification.request.content.data
    });

    // For silent notifications, we don't want to show an alert
    if (isSilentPush) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // For regular notifications, show alert and play sound
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowInForeground: true,
    };
  },
});

// Helper function to handle deeplink URLs from notifications
const handleDeeplink = (notification: Notifications.Notification | Notifications.NotificationResponse) => {
  const request = 'notification' in notification 
    ? notification.notification.request 
    : notification.request;

  const deeplinkUrl = Platform.OS === 'ios'
    ? (request.trigger as any)?.payload?.url
    : request.content.data?.url;

  if (deeplinkUrl) {
    console.log('Opening deeplink URL:', deeplinkUrl);
    Linking.openURL(deeplinkUrl);
  }
};

export default function AppLayout() {

  useEffect(() => {
    // Initialize Klaviyo from stored API key
    const initializeKlaviyo = async () => {
      try {
        const storedApiKey = await AsyncStorage.getItem('klaviyoApiKey');
        if (storedApiKey && storedApiKey.length === 6) {
          console.log('Initializing Klaviyo with stored API key:', storedApiKey);
          Klaviyo.initialize(storedApiKey);
        }
      } catch (error) {
        console.error('Error initializing Klaviyo from storage:', error);
      }
    };

    initializeKlaviyo();

    // Register the background task
    Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

    // Foreground notification listener
    console.log('Setting up foreground notification listener');
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      const isSilentPush = notification.request.content.data?.aps?.contentAvailable === 1;
      
      console.log('Received foreground notification:', JSON.stringify({
        actionIdentifier: 'foreground',
        isSilentPush,
        notification: {
          request: {
            trigger: notification.request.trigger,
            content: {
              title: notification.request.content.title,
              body: notification.request.content.body,
              data: notification.request.content.data
            },
            identifier: notification.request.identifier
          },
          date: notification.date
        }
      }, null, 2));

      // Store the notification in the app's state
      if (isSilentPush) {
        // Store the notification data globally
        global.lastBackgroundNotification = {
          ...notification.request.content.data,
          receivedAt: new Date().toISOString()
        };
      }
    });

    // Background/Quit notification listener
    console.log('Setting up background notification listener');
    const backgroundSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Received background notification response:', JSON.stringify({
        actionIdentifier: response.actionIdentifier,
        notification: {
          request: {
            trigger: response.notification.request.trigger,
            content: {
              title: response.notification.request.content.title,
              body: response.notification.request.content.body,
              data: response.notification.request.content.data
            },
            identifier: response.notification.request.identifier
          },
          date: response.notification.date
        }
      }, null, 2));

      handleDeeplink(response);
    });

    // Cleanup listeners on unmount
    return () => {
      console.log('Removing notification listeners');
      foregroundSubscription.remove();
      backgroundSubscription.remove();
    };
    
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: styles.tabBar,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="forms"
        options={{
          title: 'Forms',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="push"
        options={{
          title: 'Push',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="geofencing"
        options={{
          title: 'Geofencing',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="location" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
});
