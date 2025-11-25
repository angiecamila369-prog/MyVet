import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import RummiModal from '@/components/RummiModal';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updatePassword, db, storage } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    city: ''
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pets, setPets] = useState<any[]>([]);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [newPet, setNewPet] = useState({
    name: '',
    species: '',
    breed: '',
    age: '',
    gender: ''
  });
  const [showPetDetailModal, setShowPetDetailModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [rummiModalVisible, setRummiModalVisible] = useState(false);

  // Cargar perfil desde Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);

      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      const { data, error } = await db
        .select('profiles', 'name, email, avatar_url, phone, city')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error.message);
        setLoading(false);
        return;
      }

      const profileData = {
        name: data.name || user.email?.split('@')[0] || 'User',
        email: data.email || user.email || '',
        phone: data.phone || '',
        city: data.city || ''
      };

      setProfile(profileData);
      setEditedProfile(profileData);
      setAvatarUrl(data.avatar_url || null);

      // Cargar mascotas del usuario
      const { data: petsData, error: petsError } = await db
        .select('pets', '*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (petsError) {
        console.error('Error loading pets:', petsError.message);
      } else {
        setPets(petsData || []);
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedProfile(profile);
  };

  const handleSave = async () => {
    setLoading(true);

    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión');
      setLoading(false);
      return;
    }

    const { error: profileError } = await db
      .update('profiles', {
        name: editedProfile.name,
        phone: editedProfile.phone,
        city: editedProfile.city
      })
      .eq('id', user.id);

    if (profileError) {
      Alert.alert('Error', 'Error actualizando perfil: ' + profileError.message);
    } else {
      setProfile(editedProfile);
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      setIsEditing(false);
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor ingresa y confirma tu nueva contraseña');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    const { error } = await updatePassword(newPassword);

    if (error) {
      Alert.alert('Error', 'Error al actualizar la contraseña: ' + error.message);
    } else {
      Alert.alert('Éxito', 'Contraseña actualizada correctamente');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tomar foto', 'Elegir de galería'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await takePhoto();
          } else if (buttonIndex === 2) {
            await pickImage();
          }
        }
      );
    } else {
      Alert.alert(
        'Foto de perfil',
        'Elige una opción',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tomar foto', onPress: takePhoto },
          { text: 'Elegir de galería', onPress: pickImage },
        ],
        { cancelable: true }
      );
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Se requiere permiso de cámara para tomar fotos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Se requiere permiso de galería de fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setLoading(true);

      if (!user) {
        Alert.alert('Error', 'Debes iniciar sesión');
        return;
      }

      // Crear un nombre único para la imagen
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Leer la imagen como ArrayBuffer
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      // Subir a Supabase Storage usando ArrayBuffer
      const { error: uploadError } = await storage.upload('avatar', filePath, arrayBuffer, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      // Obtener la URL pública
      const publicUrl = storage.getPublicUrl('avatar', filePath);

      // Actualizar el perfil con la nueva URL
      const { error: updateError } = await db
        .update('profiles', { avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(publicUrl);
      Alert.alert('Éxito', '¡Foto de perfil actualizada correctamente!');
    } catch (error: any) {
      Alert.alert('Error', 'Error al subir la imagen: ' + error.message);
    } finally {
      setLoading(false);
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
      Alert.alert('Error', 'Error al agregar mascota: ' + error.message);
    } else {
      setPets([data, ...pets]);
      Alert.alert('Éxito', '¡Mascota agregada correctamente!');
      setShowAddPetModal(false);
      setNewPet({ name: '', species: '', breed: '', age: '', gender: '' });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingDot} />
        <View style={styles.loadingDot} />
        <View style={styles.loadingDot} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header morado */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleImagePicker}
          activeOpacity={0.7}
        >
          <Image
            source={avatarUrl ? { uri: avatarUrl } : require('../../../assets/images/perfil.jpg')}
            style={styles.avatar}
          />
          <View style={styles.cameraIconContainer}>
            <MaterialIcons name="camera-alt" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información Personal</Text>

          {/* Name */}
          <View style={styles.infoItem}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="person" size={26} color="#3A85C4" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Nombre</Text>
              {isEditing ? (
                <TextInput
                  style={styles.infoInput}
                  value={editedProfile.name}
                  onChangeText={(text) => setEditedProfile({...editedProfile, name: text})}
                  placeholder="Ingresa tu nombre"
                />
              ) : (
                <Text style={styles.infoValue}>{profile.name || 'No especificado'}</Text>
              )}
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.infoItem}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="phone" size={26} color="#3A85C4" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Número de teléfono</Text>
              {isEditing ? (
                <TextInput
                  style={styles.infoInput}
                  value={editedProfile.phone}
                  onChangeText={(text) => setEditedProfile({...editedProfile, phone: text})}
                  keyboardType="phone-pad"
                  placeholder="Ingresa tu número de teléfono"
                />
              ) : (
                <Text style={styles.infoValue}>{profile.phone || 'No especificado'}</Text>
              )}
            </View>
          </View>

          {/* City */}
          <View style={styles.infoItem}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="location-city" size={26} color="#3A85C4" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Ciudad</Text>
              {isEditing ? (
                <TextInput
                  style={styles.infoInput}
                  value={editedProfile.city}
                  onChangeText={(text) => setEditedProfile({...editedProfile, city: text})}
                  placeholder="Ingresa tu ciudad"
                />
              ) : (
                <Text style={styles.infoValue}>{profile.city || 'No especificado'}</Text>
              )}
            </View>
          </View>

          {/* Edit/Save Buttons */}
          {isEditing ? (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Guardar cambios</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>Editar información personal</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* My Pets Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Mis Mascotas</Text>
            {pets.length > 0 && (
              <TouchableOpacity
                style={styles.addPetIconButton}
                onPress={() => setShowAddPetModal(true)}
              >
                <MaterialIcons name="add-circle" size={28} color="#3A85C4" />
              </TouchableOpacity>
            )}
          </View>

          {pets.length === 0 ? (
            <View style={styles.noPetsContainer}>
              <MaterialIcons name="pets" size={48} color="#d1d5db" />
              <Text style={styles.noPetsText}>Aún no has agregado mascotas</Text>
              <TouchableOpacity
                style={styles.addPetButton}
                onPress={() => setShowAddPetModal(true)}
              >
                <Text style={styles.addPetButtonText}>Agrega tu primera mascota</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {pets.map((pet) => (
                <View key={pet.id} style={styles.petItem}>
                  <View style={styles.petIconContainer}>
                    {pet.image_url ? (
                      <Image source={{ uri: pet.image_url }} style={styles.petAvatar} />
                    ) : (
                      <MaterialIcons name="pets" size={28} color="#3A85C4" />
                    )}
                  </View>
                  <View style={styles.petInfo}>
                    <Text style={styles.petText}>{pet.name}</Text>
                    {pet.breed && <Text style={styles.petBreed}>{pet.breed}</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPet(pet);
                      setShowPetDetailModal(true);
                    }}
                  >
                    <Text style={styles.viewProfile}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Settings Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Configuración</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowPasswordModal(true)}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="lock" size={24} color="#3A85C4" />
              <Text style={styles.settingText}>Cambiar contraseña</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleLogout}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="logout" size={24} color="#ef4444" />
              <Text style={[styles.settingText, styles.logoutText]}>Cerrar sesión</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de contraseña */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar Contraseña</Text>

            <View style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nueva contraseña</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="••••••••"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmar contraseña</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="••••••••"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={handleUpdatePassword}>
                <Text style={styles.modalButtonText}>Actualizar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                    placeholder="ej., Perro, Gato, Pájaro"
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

      {/* Modal de detalles de mascota */}
      <Modal
        visible={showPetDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPetDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.petDetailModal}>
            {selectedPet && (
              <>
                {/* Avatar de la mascota */}
                <View style={styles.petDetailAvatarContainer}>
                  {selectedPet.avatar_url ? (
                    <Image
                      source={{ uri: selectedPet.avatar_url }}
                      style={styles.petDetailAvatar}
                    />
                  ) : (
                    <View style={styles.petDetailAvatarPlaceholder}>
                      <MaterialIcons name="pets" size={60} color="#3A85C4" />
                    </View>
                  )}
                </View>

                {/* Nombre de la mascota */}
                <Text style={styles.petDetailName}>{selectedPet.name}</Text>

                {/* Información de la mascota */}
                <View style={styles.petDetailInfo}>
                  <View style={styles.petDetailRow}>
                    <View style={styles.petDetailItem}>
                      <MaterialIcons name="category" size={20} color="#3A85C4" />
                      <View style={styles.petDetailText}>
                        <Text style={styles.petDetailLabel}>Especie</Text>
                        <Text style={styles.petDetailValue}>
                          {selectedPet.species || 'No especificado'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {selectedPet.breed && (
                    <View style={styles.petDetailRow}>
                      <View style={styles.petDetailItem}>
                        <MaterialIcons name="info" size={20} color="#3A85C4" />
                        <View style={styles.petDetailText}>
                          <Text style={styles.petDetailLabel}>Raza</Text>
                          <Text style={styles.petDetailValue}>{selectedPet.breed}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {selectedPet.age && (
                    <View style={styles.petDetailRow}>
                      <View style={styles.petDetailItem}>
                        <MaterialIcons name="cake" size={20} color="#3A85C4" />
                        <View style={styles.petDetailText}>
                          <Text style={styles.petDetailLabel}>Edad</Text>
                          <Text style={styles.petDetailValue}>
                            {selectedPet.age} {selectedPet.age === 1 ? 'año' : 'años'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {selectedPet.gender && (
                    <View style={styles.petDetailRow}>
                      <View style={styles.petDetailItem}>
                        <MaterialIcons
                          name={selectedPet.gender === 'male' ? 'male' : 'female'}
                          size={20}
                          color="#3A85C4"
                        />
                        <View style={styles.petDetailText}>
                          <Text style={styles.petDetailLabel}>Género</Text>
                          <Text style={styles.petDetailValue}>
                            {selectedPet.gender.charAt(0).toUpperCase() + selectedPet.gender.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                {/* Botón cerrar */}
                <TouchableOpacity
                  style={styles.petDetailCloseButton}
                  onPress={() => {
                    setShowPetDetailModal(false);
                    setSelectedPet(null);
                  }}
                >
                  <Text style={styles.petDetailCloseText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3A85C4',
    opacity: 0.6,
  },
  header: {
    backgroundColor: '#3A85C4',
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'white',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3A85C4',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  addPetIconButton: {
    padding: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7FD0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  infoInput: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: '#3A85C4',
    paddingBottom: 2,
  },
  editButton: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  editActions: {
    marginTop: 20,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#3A85C4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  noPetsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPetsText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
    marginBottom: 20,
  },
  addPetButton: {
    backgroundColor: '#3A85C4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addPetButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  petItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  petIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7FD0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  petAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  petInfo: {
    flex: 1,
  },
  petText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  petBreed: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  viewProfile: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  logoutText: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalForm: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  modalActions: {
    gap: 12,
  },
  modalButton: {
    backgroundColor: '#3A85C4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  petDetailModal: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 30,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  petDetailAvatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  petDetailAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#7FD0FF',
  },
  petDetailAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#7FD0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petDetailName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  petDetailInfo: {
    marginBottom: 24,
  },
  petDetailRow: {
    marginBottom: 16,
  },
  petDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3A85C4',
  },
  petDetailText: {
    marginLeft: 12,
    flex: 1,
  },
  petDetailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 4,
  },
  petDetailValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  petDetailCloseButton: {
    backgroundColor: '#3A85C4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  petDetailCloseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
});
