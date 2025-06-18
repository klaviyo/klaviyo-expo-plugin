import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';

const featuredPlants = [
  {
    id: 1,
    name: 'Monstera Deliciosa',
    price: '$45.99',
    image: 'https://images.unsplash.com/photo-1525498128493-380d1990a112?w=500',
    description: 'Popular tropical plant with distinctive leaf holes'
  },
  {
    id: 2,
    name: 'Snake Plant',
    price: '$29.99',
    image: 'https://images.unsplash.com/photo-1596547609652-9cf5d8c10d6e?w=500',
    description: 'Low maintenance, air-purifying plant'
  },
  {
    id: 3,
    name: 'Fiddle Leaf Fig',
    price: '$59.99',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500',
    description: 'Trendy indoor tree with large violin-shaped leaves'
  }
];

export default function PlantShopScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Featured Plants</Text>
        <Text style={styles.headerSubtitle}>Discover our most popular plants</Text>
      </View>

      <View style={styles.plantsContainer}>
        {featuredPlants.map((plant) => (
          <TouchableOpacity key={plant.id} style={styles.plantCard}>
            <Image
              source={{ uri: plant.image }}
              style={styles.plantImage}
            />
            <View style={styles.plantInfo}>
              <Text style={styles.plantName}>{plant.name}</Text>
              <Text style={styles.plantPrice}>{plant.price}</Text>
              <Text style={styles.plantDescription}>{plant.description}</Text>
              <TouchableOpacity style={styles.addToCartButton}>
                <Text style={styles.buttonText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  plantPrice: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  plantDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  addToCartButton: {
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