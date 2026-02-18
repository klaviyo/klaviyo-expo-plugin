import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';
import { Klaviyo } from 'klaviyo-react-native-sdk';
import * as Location from 'expo-location';

interface Geofence {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
}

// Read ios.geofencingEnabled from the plugin options in app config (no extra prop needed)
const klaviyoPluginOptions = Constants.expoConfig?.plugins?.find(
  (p): p is [string, Record<string, unknown>] =>
    Array.isArray(p) && p[0] === 'klaviyo-expo-plugin' && p[1] != null
)?.[1];
const geofencingEnabledInBuild = (klaviyoPluginOptions?.ios as { geofencingEnabled?: boolean } | undefined)?.geofencingEnabled ?? false;

export default function GeofencingScreen() {
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [currentGeofences, setCurrentGeofences] = useState<Geofence[]>([]);

  useEffect(() => {
    if (!geofencingEnabledInBuild) return;
    checkLocationPermission();
    fetchCurrentGeofences();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status);
    } catch (error) {
      console.error('Error checking location permission:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        // Request fine location permission
        const fineLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location for geofencing features.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (fineLocationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Location permission is required for geofencing.');
          return false;
        }

        // Request background location permission for Android 10+
        if (Platform.Version >= 29) {
          const backgroundGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: 'Background Location Permission',
              message: 'This app needs background location access to track geofences when the app is closed.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          if (backgroundGranted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Warning', 'Background location permission is recommended for full geofencing functionality.');
          }
        }

        setLocationPermission('granted');
        return true;
      } else {
        // iOS permissions via expo-location
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

        if (foregroundStatus !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for geofencing.');
          setLocationPermission(foregroundStatus);
          return false;
        }

        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

        if (backgroundStatus !== 'granted') {
          Alert.alert('Warning', 'Background location permission is recommended for full geofencing functionality.');
        }

        setLocationPermission(foregroundStatus);
        return true;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error', 'Failed to request location permissions');
      return false;
    }
  };

  const handleRegisterGeofences = async () => {
    try {
      // Check and request permissions first
      const hasPermission = locationPermission === 'granted' || await requestLocationPermission();

      if (!hasPermission) {
        return;
      }

      Klaviyo.registerGeofencing();
      setGeofencingEnabled(true);

      // Fetch current geofences after a short delay to allow SDK to fetch them
      setTimeout(() => {
        fetchCurrentGeofences();
      }, 2000);

      Alert.alert('Success', 'Geofencing has been enabled successfully');
    } catch (error) {
      console.error('Error registering for geofences:', error);
      Alert.alert('Error', `Failed to enable geofencing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUnregisterGeofences = () => {
    try {
      Klaviyo.unregisterGeofencing();
      setGeofencingEnabled(false);
      setCurrentGeofences([]);
      Alert.alert('Success', 'Geofencing has been disabled');
    } catch (error) {
      console.error('Error unregistering from geofences:', error);
      Alert.alert('Error', `Failed to disable geofencing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const fetchCurrentGeofences = () => {
    try {
      Klaviyo.getCurrentGeofences((result: { geofences: Geofence[] }) => {
        console.log('Current geofences:', result.geofences);
        setCurrentGeofences(result.geofences);
      });
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Geofencing</Text>

        {!geofencingEnabledInBuild && (
          <View style={styles.disabledBanner}>
            <Text style={styles.disabledBannerText}>
              Geofencing is disabled (ios.geofencingEnabled is false). Enable it in app.config.js to use these features.
            </Text>
          </View>
        )}

        <Text style={styles.description}>
          Enable geofencing to track location-based events. This will request location permissions if not already granted.
        </Text>

        {locationPermission && geofencingEnabledInBuild && (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Location Permission: {locationPermission}
            </Text>
          </View>
        )}

        {!geofencingEnabled ? (
          <TouchableOpacity
            style={[styles.button, styles.fullWidthButton, !geofencingEnabledInBuild && styles.buttonDisabled]}
            onPress={geofencingEnabledInBuild ? handleRegisterGeofences : undefined}
            disabled={!geofencingEnabledInBuild}
          >
            <Text style={[styles.buttonText, !geofencingEnabledInBuild && styles.buttonTextDisabled]}>
              Enable Geofencing
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.button, styles.fullWidthButton, styles.buttonSuccess, !geofencingEnabledInBuild && styles.buttonDisabled]}
              disabled
            >
              <Text style={[styles.buttonText, !geofencingEnabledInBuild && styles.buttonTextDisabled]}>
                ✓ Geofencing Enabled
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.fullWidthButton, styles.buttonDanger, !geofencingEnabledInBuild && styles.buttonDisabled]}
              onPress={geofencingEnabledInBuild ? handleUnregisterGeofences : undefined}
              disabled={!geofencingEnabledInBuild}
            >
              <Text style={[styles.buttonText, !geofencingEnabledInBuild && styles.buttonTextDisabled]}>
                Disable Geofencing
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={[styles.statusContainer, !geofencingEnabledInBuild && styles.statusContainerDisabled]}>
          <Text style={styles.statusText}>
            {geofencingEnabled ? '✓ Geofencing is active' : 'Geofencing Status'}
          </Text>
          <Text style={styles.statusSubtext}>
            {geofencingEnabled
              ? 'The app will now track geofence events based on your location.'
              : currentGeofences.length > 0
                ? 'Geofences are being monitored. Click "Enable Geofencing" to register if needed.'
                : 'Click "Enable Geofencing" to start monitoring geofences.'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.fullWidthButton, styles.buttonSecondary, !geofencingEnabledInBuild && styles.buttonDisabled]}
          onPress={geofencingEnabledInBuild ? fetchCurrentGeofences : undefined}
          disabled={!geofencingEnabledInBuild}
        >
          <Text style={[styles.buttonText, !geofencingEnabledInBuild && styles.buttonTextDisabled]}>
            Refresh Geofences
          </Text>
        </TouchableOpacity>

        <View style={styles.geofenceListContainer}>
          <Text style={styles.geofenceListTitle}>
            Current Geofences ({currentGeofences.length})
          </Text>
          {currentGeofences.length === 0 ? (
            <Text style={styles.noGeofencesText}>
              No geofences configured. Geofences are fetched from your Klaviyo account.
            </Text>
          ) : (
            currentGeofences.map((geofence, index) => (
              <View key={index} style={styles.geofenceItem}>
                <Text style={styles.geofenceId}>
                  {geofence.identifier}
                </Text>
                <Text style={styles.geofenceCoords}>
                  Lat: {geofence.latitude.toFixed(6)}, Lon: {geofence.longitude.toFixed(6)}
                </Text>
                <Text style={styles.geofenceRadius}>
                  Radius: {geofence.radius}m
                </Text>
              </View>
            ))
          )}
        </View>
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
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
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
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonSecondary: {
    backgroundColor: '#5856D6',
  },
  buttonDisabled: {
    backgroundColor: '#C7C7CC',
    opacity: 0.8,
  },
  buttonTextDisabled: {
    color: '#8E8E93',
  },
  disabledBanner: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  disabledBannerText: {
    fontSize: 14,
    color: '#E65100',
  },
  statusContainerDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  permissionContainer: {
    padding: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    marginTop: 10,
    padding: 15,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  statusSubtext: {
    fontSize: 14,
    color: '#558B2F',
  },
  geofenceListContainer: {
    marginTop: 10,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  geofenceListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  noGeofencesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  geofenceItem: {
    padding: 10,
    backgroundColor: '#FFF',
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  geofenceId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  geofenceCoords: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  geofenceRadius: {
    fontSize: 12,
    color: '#666',
  },
});
