import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import LoadingAnimation from "@/components/LoadingAnimation";
import RummiModal from "@/components/RummiModal";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";

const { width } = Dimensions.get("window");

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  image_url?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, db, storage } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [userName, setUserName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [rummiModalVisible, setRummiModalVisible] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [newPet, setNewPet] = useState({
    name: '',
    species: '',
    breed: '',
    age: '',
    gender: '',
  });

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    setLoading(true);
    try {
      if (!user) {
        console.error("No hay usuario autenticado");
        router.replace("/(auth)/login");
        return;
      }

      console.log("User ID:", user.id);

      // Obtener nombre del usuario
      const { data: profile } = await db
        .select("profiles", "name")
        .eq("id", user.id)
        .single();

      if (profile?.name) {
        setUserName(profile.name);
      } else {
        setUserName(user.email?.split('@')[0] || 'Usuario');
      }

      // Cargar mascotas del usuario
      const { data: petsData, error: petsError } = await db
        .select("pets", "*")
        .eq("user_id", user.id);

      console.log("=== PETS DEBUG ===");
      console.log("Query result:", petsData);
      console.log("Error:", petsError);
      console.log("Number of pets:", petsData?.length || 0);

      if (petsError) {
        console.error("Error loading pets:", petsError);
        setPets([]);
      } else if (petsData) {
        console.log("Setting pets state with:", petsData);
        setPets(petsData);
      } else {
        console.log("No pets data");
        setPets([]);
      }
    } catch (error: any) {
      console.error("Error en initializeData:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initializeData();
    setRefreshing(false);
  };

  const handlePickImage = async (petId: string) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos permiso para acceder a tus fotos');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPetPhoto(petId, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadPetPhoto = async (petId: string, uri: string) => {
    setUploadingPhoto(petId);
    try {
      if (!user) {
        Alert.alert('Error', 'Debes iniciar sesión');
        return;
      }

      // Create file name and path
      const fileExt = uri.split('.').pop() || 'jpg';
      const filePath = `${user.id}/${petId}/${Date.now()}.${fileExt}`;

      // Read file as array buffer for React Native compatibility
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      // Upload to Supabase Storage
      const { error: uploadError } = await storage.upload('pet-photos', filePath, arrayBuffer, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Error', `No se pudo subir la foto: ${uploadError.message || 'Error desconocido'}`);
        return;
      }

      // Get public URL
      const publicUrl = storage.getPublicUrl('pet-photos', filePath);

      if (!publicUrl) {
        Alert.alert('Error', 'No se pudo obtener la URL de la foto');
        return;
      }

      // Update pet record with new image URL
      const { data: updateData, error: updateError } = await db
        .update('pets', { image_url: publicUrl })
        .eq('id', petId)
        .eq('user_id', user.id)
        .select();

      if (updateError) {
        console.error('Update error:', updateError);
        Alert.alert('Error', `No se pudo actualizar la mascota: ${updateError.message}`);
        return;
      }

      if (!updateData || updateData.length === 0) {
        console.error('No rows updated - pet not found or no permission');
        Alert.alert('Error', 'No se pudo encontrar la mascota o no tienes permisos para actualizarla');
        return;
      }

      // Refresh pets to show new photo
      await initializeData();
      Alert.alert('¡Éxito!', 'Foto actualizada correctamente');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', `No se pudo subir la foto: ${error.message || 'Error desconocido'}`);
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleAddPet = async () => {
    if (!newPet.name || !newPet.species) {
      Alert.alert('Error', 'Por favor ingresa al menos el nombre y la especie');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión');
      return;
    }

    const petData: any = {
      user_id: user.id,
      name: newPet.name,
      species: newPet.species,
    };

    if (newPet.breed) petData.breed = newPet.breed;
    if (newPet.age) petData.age = parseInt(newPet.age);
    if (newPet.gender) petData.gender = newPet.gender;

    const { data, error } = await db
      .insert('pets', [petData])
      .select()
      .single();

    if (error) {
      Alert.alert('Error', 'Error agregando mascota: ' + error.message);
    } else {
      setPets([data, ...pets]);
      Alert.alert('¡Éxito!', 'Mascota agregada correctamente');
      setShowAddPetModal(false);
      setNewPet({ name: '', species: '', breed: '', age: '', gender: '' });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingAnimation size={100} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3A85C4"
          />
        }
      >
        {/* Header con logo */}
        <View style={styles.header}>
          <Image
            source={require("../../../assets/images/logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>Hola, {userName}</Text>
          <Text style={styles.subtitleText}>Bienvenido de nuevo</Text>
        </View>

        {/* Sección de Mascotas - Carrusel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis Mascotas</Text>
            <TouchableOpacity onPress={() => setShowAddPetModal(true)}>
              <MaterialIcons name="add-circle" size={28} color="#3A85C4" />
            </TouchableOpacity>
          </View>

          {pets.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              snapToInterval={width - 80}
              decelerationRate="fast"
            >
              {pets.map((pet, index) => (
                <View
                  key={pet.id}
                  style={[
                    styles.carouselCard,
                    index === 0 && styles.carouselCardFirst,
                    index === pets.length - 1 && styles.carouselCardLast
                  ]}
                >
                  <TouchableOpacity
                    style={styles.carouselImageContainer}
                    onPress={() => router.push("/main/(tabs)/perfil")}
                    activeOpacity={0.9}
                  >
                    {pet.image_url ? (
                      <Image
                        source={{ uri: pet.image_url }}
                        style={styles.carouselImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.carouselImagePlaceholder}>
                        <MaterialIcons name="pets" size={80} color="#3A85C4" />
                        <Text style={styles.placeholderText}>Sin foto</Text>
                      </View>
                    )}
                    <View style={styles.carouselOverlay}>
                      <Text style={styles.carouselPetName}>{pet.name}</Text>
                      <Text style={styles.carouselPetBreed}>{pet.breed || pet.species}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Camera button */}
                  <TouchableOpacity
                    style={styles.cameraButton}
                    onPress={() => handlePickImage(pet.id)}
                    disabled={uploadingPhoto === pet.id}
                  >
                    {uploadingPhoto === pet.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <MaterialIcons name="add-a-photo" size={24} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.emptyPetsCard}
              onPress={() => setShowAddPetModal(true)}
            >
              <MaterialIcons name="pets" size={64} color="#d1d5db" />
              <Text style={styles.emptyPetsText}>No tienes mascotas aún</Text>
              <Text style={styles.emptyPetsSubtext}>
                Toca aquí para agregar tu primera mascota
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Acciones Rápidas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acceso Rápido</Text>
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#e0f2fe' }]}
              onPress={() => router.push("/main/(tabs)/gps")}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#0ea5e9' }]}>
                <MaterialIcons name="my-location" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Rastreo GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#fef3c7' }]}
              onPress={() => router.push("/main/(tabs)/logbook")}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#f59e0b' }]}>
                <MaterialIcons name="book" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Diario</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#e0e7ff' }]}
              onPress={() => router.push("/main/(tabs)/chats")}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#6366f1' }]}>
                <MaterialIcons name="chat" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Chat IA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#dbeafe' }]}
              onPress={() => router.push("/main/(tabs)/perfil")}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#3b82f6' }]}>
                <MaterialIcons name="person" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Perfil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Floating Rummi Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setRummiModalVisible(true)}
        activeOpacity={0.9}
      >
        <Image
          source={require("../../../assets/images/Rummi.jpg")}
          style={styles.floatingButtonImage}
        />
      </TouchableOpacity>

      {/* Rummi Chat Modal */}
      <RummiModal
        visible={rummiModalVisible}
        onClose={() => setRummiModalVisible(false)}
      />

      {/* Modal para agregar mascota */}
      <Modal
        visible={showAddPetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddPetModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar Nueva Mascota</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre de la mascota *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ej., Max, Luna"
                    value={newPet.name}
                    onChangeText={(text) => setNewPet({...newPet, name: text})}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Especie *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ej., Perro, Gato, Ave"
                    value={newPet.species}
                    onChangeText={(text) => setNewPet({...newPet, species: text})}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Raza</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ej., Golden Retriever"
                    value={newPet.breed}
                    onChangeText={(text) => setNewPet({...newPet, breed: text})}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Edad</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Edad en años"
                    keyboardType="numeric"
                    value={newPet.age}
                    onChangeText={(text) => setNewPet({...newPet, age: text})}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Género</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Macho o Hembra"
                    value={newPet.gender}
                    onChangeText={(text) => setNewPet({...newPet, gender: text})}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={handleAddPet}>
                <Text style={styles.modalButtonText}>Agregar Mascota</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddPetModal(false);
                  setNewPet({ name: '', species: '', breed: '', age: '', gender: '' });
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  scrollContainer: {
    paddingBottom: 120,
  },
  // Header
  header: {
    backgroundColor: "#3A85C4",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
    borderRadius: 60,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  // Section
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
  },
  // Carousel
  carouselContainer: {
    paddingRight: 20,
  },
  carouselCard: {
    width: width - 80,
    marginLeft: 20,
  },
  carouselCardFirst: {
    marginLeft: 20,
  },
  carouselCardLast: {
    marginRight: 20,
  },
  carouselImageContainer: {
    width: "100%",
    height: 280,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  carouselImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
  },
  placeholderText: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 12,
    fontWeight: "600",
  },
  carouselOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
  },
  carouselPetName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  carouselPetBreed: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
  },
  emptyPetsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  emptyPetsText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6b7280",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyPetsSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  // Actions
  actionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    width: (width - 52) / 2,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  bottomSpacing: {
    height: 40,
  },
  // Camera button
  cameraButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3A85C4",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Floating Rummi button
  floatingButton: {
    position: "absolute",
    bottom: 110,
    right: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#7FD0FF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 4,
    borderColor: "#fff",
  },
  floatingButtonImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: width * 0.9,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalForm: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#3A85C4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
