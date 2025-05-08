import React, { useEffect } from 'react';
import { StyleSheet} from 'react-native';
import * as Notifications from 'expo-notifications';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowInForeground: true,
  }),
});

export default function AppLayout() {
  
  useEffect(() => {
    // Foreground notification listener
    console.log('Setting up foreground notification listener');
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Received foreground notification:', JSON.stringify({
        actionIdentifier: 'foreground',
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

      // Handle deeplink if present in notification data
      if (notification.request.content.data?.url) {
        Linking.openURL(notification.request.content.data.url);
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

      // Handle deeplink if present in notification data
      if (response.notification.request.content.data?.url) {
        Linking.openURL(response.notification.request.content.data.url);
      }
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
