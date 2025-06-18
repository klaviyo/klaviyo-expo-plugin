import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';

const plantCategories = [
  {
    id: 1,
    name: 'Indoor Plants',
    image: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=500',
    description: 'Perfect for your home or office'
  },
  {
    id: 2,
    name: 'Succulents',
    image: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=500',
    description: 'Low maintenance, drought-resistant plants'
  },
  {
    id: 3,
    name: 'Flowering Plants',
    image: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=500',
    description: 'Add color to your space'
  },
  {
    id: 4,
    name: 'Air Plants',
    image: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=500',
    description: 'No soil needed, perfect for creative displays'
  }
];

export default function PlantTypesScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plant Categories</Text>
        <Text style={styles.headerSubtitle}>Browse by plant type</Text>
      </View>

      <View style={styles.categoriesContainer}>
        {plantCategories.map((category) => (
          <TouchableOpacity key={category.id} style={styles.categoryCard}>
            <Image
              source={{ uri: category.image }}
              style={styles.categoryImage}
            />
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryDescription}>{category.description}</Text>
              <TouchableOpacity style={styles.browseButton}>
                <Text style={styles.buttonText}>Browse Collection</Text>
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
  categoriesContainer: {
    padding: 15,
  },
  categoryCard: {
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
  categoryImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  categoryInfo: {
    padding: 15,
  },
  categoryName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  browseButton: {
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