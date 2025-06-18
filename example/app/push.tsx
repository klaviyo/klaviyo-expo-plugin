import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';

const myPlants = [
  {
    id: 1,
    name: 'Monstera Deliciosa',
    image: 'https://images.unsplash.com/photo-1525498128493-380d1990a112?w=500',
    lastWatered: '2 days ago',
    nextWatering: 'Tomorrow',
    health: 'Thriving'
  },
  {
    id: 2,
    name: 'Snake Plant',
    image: 'https://images.unsplash.com/photo-1596547609652-9cf5d8c10d6e?w=500',
    lastWatered: '5 days ago',
    nextWatering: 'In 2 days',
    health: 'Good'
  },
  {
    id: 3,
    name: 'Fiddle Leaf Fig',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500',
    lastWatered: '1 day ago',
    nextWatering: 'Today',
    health: 'Needs Attention'
  }
];

export default function MyGardenScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Garden</Text>
        <Text style={styles.headerSubtitle}>Track your plant collection</Text>
      </View>

      <View style={styles.plantsContainer}>
        {myPlants.map((plant) => (
          <View key={plant.id} style={styles.plantCard}>
            <Image
              source={{ uri: plant.image }}
              style={styles.plantImage}
            />
            <View style={styles.plantInfo}>
              <Text style={styles.plantName}>{plant.name}</Text>
              <View style={styles.plantDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Watered:</Text>
                  <Text style={styles.detailValue}>{plant.lastWatered}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Next Watering:</Text>
                  <Text style={styles.detailValue}>{plant.nextWatering}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Health:</Text>
                  <Text style={[
                    styles.detailValue,
                    styles[`health${plant.health.replace(' ', '')}`]
                  ]}>
                    {plant.health}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.waterButton}>
                <Text style={styles.buttonText}>Water Plant</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#F1F8E9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  plantsContainer: {
    padding: 15,
  },
  plantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  plantImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  plantInfo: {
    padding: 15,
  },
  plantName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  plantDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  healthThriving: {
    color: '#2E7D32',
  },
  healthGood: {
    color: '#1976D2',
  },
  healthNeedsAttention: {
    color: '#D32F2F',
  },
  waterButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 