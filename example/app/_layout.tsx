import { Stack } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Klaviyo} from 'klaviyo-react-native-sdk';

export default function RootLayout() {
  const handleInitialize = () => {
    Klaviyo.initialize("UHZ3zG");
  };

  const handleTrackEvent = () => {
    Klaviyo.createEvent({
      name: 'Test Event',
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleInitialize}>
        <Text style={styles.buttonText}>Initialize Klaviyo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleTrackEvent}>
        <Text style={styles.buttonText}>Track Event</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
