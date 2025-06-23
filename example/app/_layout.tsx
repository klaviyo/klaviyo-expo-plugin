import React, { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Klaviyo } from 'klaviyo-react-native-sdk';
import * as Notifications from 'expo-notifications';

export default function AppLayout() {
  useEffect(() => {
    // Initialize Klaviyo
    Klaviyo.initialize("UHZ3zG");
    
    // Set profile
    Klaviyo.setProfile({
      email: 'daniel.peluso@klaviyo.com',
      firstName: 'Daniel',
      lastName: 'Peluso',
    });

    // Request notification permissions and get push token
    const setupNotifications = async () => {
      try {
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
        
        if (finalStatus !== 'granted') {
          console.log('Permission not granted, stopping setup');
          return;
        }
        
        console.log('Permissions granted, proceeding to get push token');
        await handleGetPushToken();
        
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
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
        console.log('✅ Extracted token:', token);
        
        // Send the token to Klaviyo
        try {
          Klaviyo.setPushToken(token);
          console.log('✅ Token set in Klaviyo successfully');
        } catch (klaviyoError) {
          console.error('❌ Error setting token in Klaviyo:', klaviyoError);
        }
        
      } catch (error) {
        console.error('❌ Error getting push token:', error);
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
        }
      }
    };

    setupNotifications();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2E7D32', // Forest green
        tabBarInactiveTintColor: '#81C784', // Light green
        tabBarStyle: styles.tabBar,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Plant Shop',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="leaf" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="forms"
        options={{
          title: 'Plant Types',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="push"
        options={{
          title: 'My Garden',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="flower" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF', // Clean white background
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0', // Light gray border
    elevation: 8, // Add shadow for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 4, // Add shadow for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    color: '#2E7D32', // Forest green text
    fontSize: 18,
    fontWeight: '600',
  },
});
