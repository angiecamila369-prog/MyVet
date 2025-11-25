import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import LoadingAnimation from "@/components/LoadingAnimation";
import RummiModal from "@/components/RummiModal";
import { useAuth } from "@/contexts/AuthContext";

interface Pet {
  id: string;
  name: string;
  species: string;
}

interface LogEntry {
  id: string;
  pet_id: string;
  pet_name: string;
  type: 'food' | 'medicine' | 'symptom' | 'vet' | 'exercise' | 'weight';
  title: string;
  description: string;
  created_at: string;
}

export default function PetLogScreen() {
  const { user, db } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rummiModalVisible, setRummiModalVisible] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: 'food' as 'food' | 'medicine' | 'symptom' | 'vet' | 'exercise' | 'weight',
    title: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!user) return;

      // Cargar mascotas del usuario
      const { data: petsData } = await db
        .select('pets', 'id, name, species')
        .eq('user_id', user.id);

      if (petsData && petsData.length > 0) {
        setPets(petsData);
        setSelectedPet(petsData[0].id);
        await loadLogEntries(petsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogEntries = async (petId: string) => {
    try {
      const { data, error } = await db
        .select('pet_logs', '*')
        .eq('pet_id', petId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agregar el nombre de la mascota a cada entrada
      const entriesWithPetName = data?.map((entry: any) => ({
        ...entry,
        pet_name: pets.find(p => p.id === entry.pet_id)?.name || 'Desconocido'
      })) || [];

      setLogEntries(entriesWithPetName);
    } catch (error) {
      console.error('Error loading log entries:', error);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.title.trim()) {
      Alert.alert('Error', 'Por favor ingresa un título');
      return;
    }

    if (!selectedPet) {
      Alert.alert('Error', 'Por favor selecciona una mascota');
      return;
    }

    try {
      const { error } = await db
        .insert('pet_logs', [{
          pet_id: selectedPet,
          type: newEntry.type,
          title: newEntry.title,
          description: newEntry.description,
        }]);

      if (error) throw error;

      Alert.alert('Éxito', 'Registro agregado correctamente');
      setShowAddModal(false);
      setNewEntry({ type: 'food', title: '', description: '' });
      await loadLogEntries(selectedPet);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const deleteEntry = async (entryId: string) => {
    Alert.alert(
      'Eliminar registro',
      '¿Estás seguro de que deseas eliminar este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await db
                .delete('pet_logs')
                .eq('id', entryId);

              if (error) throw error;
              if (selectedPet) await loadLogEntries(selectedPet);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'food':
        return (
          <Image
            source={require('../../../assets/images/food.jpg')}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        );
      case 'medicine':
        return (
          <Image
            source={require('../../../assets/images/medicine.jpg')}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        );
      case 'symptom':
        return (
          <Image
            source={require('../../../assets/images/sick.jpg')}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        );
      case 'vet':
        return (
          <Image
            source={require('../../../assets/images/vet.jpg')}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        );
      case 'exercise':
        return (
          <Image
            source={require('../../../assets/images/exercise.jpg')}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        );
      case 'weight':
        return (
          <Image
            source={require('../../../assets/images/weight.jpg')}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        );
      default:
        return (
          <Image
            source={require('../../../assets/images/log.jpg')}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'food': return '#b587d1ff';
      case 'medicine': return '#73a1edff';
      case 'symptom': return '#f46530ff';
      case 'vet': return '#ee9adcff';
      case 'exercise': return '#f59e0b';
      case 'weight': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'food': return 'Alimentación';
      case 'medicine': return 'Medicina';
      case 'symptom': return 'Síntoma';
      case 'vet': return 'Veterinario';
      case 'exercise': return 'Ejercicio';
      case 'weight': return 'Peso';
      default: return 'Otro';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingAnimation size={100} />
          <Text style={styles.loadingText}>Cargando bitácora...</Text>
        </View>
      </View>
    );
  }

  if (pets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bitácora de Mascotas</Text>
        </View>
        <View style={styles.emptyState}>
          <MaterialIcons name="pets" size={80} color="#d1d5db" />
          <Text style={styles.emptyStateTitle}>No tienes mascotas registradas</Text>
          <Text style={styles.emptyStateText}>
            Agrega una mascota desde tu perfil para comenzar a registrar su bitácora
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bitácora de Mascotas</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          <TouchableOpacity
            style={[styles.categoryCircle, !selectedCategory && styles.categoryCircleActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={styles.categoryIcon}>📋</Text>
          </TouchableOpacity>
          {['food', 'medicine', 'symptom', 'vet', 'exercise', 'weight'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.categoryCircle,
                selectedCategory === type && styles.categoryCircleActive
              ]}
              onPress={() => setSelectedCategory(type === selectedCategory ? null : type)}
            >
              <View style={styles.categoryIconContainer}>
                {typeof getTypeIcon(type) === 'string' ? (
                  <Text style={styles.categoryIcon}>{getTypeIcon(type)}</Text>
                ) : (
                  getTypeIcon(type)
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Add Button - Floating */}
      <TouchableOpacity
        style={styles.addButtonFloating}
        onPress={() => setShowAddModal(true)}
      >
        <MaterialIcons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Pet Selector */}
        <View style={styles.petSelectorContainer}>
          <Text style={styles.sectionTitle}>Mascota</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.petSelector}
          >
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petCard,
                  selectedPet === pet.id && styles.petCardActive
                ]}
                onPress={() => {
                  setSelectedPet(pet.id);
                  loadLogEntries(pet.id);
                }}
              >
                <MaterialIcons
                  name="pets"
                  size={24}
                  color={selectedPet === pet.id ? '#fff' : '#3A85C4'}
                />
                <Text style={[
                  styles.petName,
                  selectedPet === pet.id && styles.petNameActive
                ]}>
                  {pet.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Log Entries */}
        <View style={styles.logsContainer}>
          <Text style={styles.sectionTitle}>Registros</Text>
          {logEntries.length === 0 ? (
            <View style={styles.emptyLogs}>
              <MaterialIcons name="event-note" size={48} color="#d1d5db" />
              <Text style={styles.emptyLogsText}>No hay registros aún</Text>
              <Text style={styles.emptyLogsSubtext}>
                Agrega el primer registro de tu mascota
              </Text>
            </View>
          ) : (
            logEntries
              .filter(entry => !selectedCategory || entry.type === selectedCategory)
              .map((entry) => (
              <View key={entry.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logTypeContainer}>
                    <View style={styles.logIconContainer}>
                      {typeof getTypeIcon(entry.type) === 'string' ? (
                        <Text style={styles.logIcon}>{getTypeIcon(entry.type)}</Text>
                      ) : (
                        getTypeIcon(entry.type)
                      )}
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={styles.logTitle}>{entry.title}</Text>
                      <View style={styles.logMeta}>
                        <View style={[
                          styles.typeBadge,
                          { backgroundColor: getTypeColor(entry.type) }
                        ]}>
                          <Text style={styles.typeBadgeText}>{getTypeLabel(entry.type)}</Text>
                        </View>
                        <Text style={styles.logDate}>{formatDate(entry.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteEntry(entry.id)}
                    style={styles.deleteButton}
                  >
                    <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                {entry.description ? (
                  <Text style={styles.logDescription}>{entry.description}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Add Entry Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Registro</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <MaterialIcons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Type Selector */}
              <Text style={styles.inputLabel}>Tipo de registro</Text>
              <View style={styles.typeGrid}>
                {['food', 'medicine', 'symptom', 'vet', 'exercise', 'weight'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newEntry.type === type && styles.typeButtonActive,
                      { borderColor: getTypeColor(type) }
                    ]}
                    onPress={() => setNewEntry({ ...newEntry, type: type as any })}
                  >
                    {typeof getTypeIcon(type) === 'string' ? (
                      <Text style={styles.typeIcon}>{getTypeIcon(type)}</Text>
                    ) : (
                      <View style={styles.typeIconImageContainer}>{getTypeIcon(type)}</View>
                    )}
                    <Text style={[
                      styles.typeLabel,
                      newEntry.type === type && { color: getTypeColor(type) }
                    ]}>
                      {getTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title Input */}
              <Text style={styles.inputLabel}>Título</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Comida de la mañana"
                placeholderTextColor="#9ca3af"
                value={newEntry.title}
                onChangeText={(text) => setNewEntry({ ...newEntry, title: text })}
              />

              {/* Description Input */}
              <Text style={styles.inputLabel}>Descripción (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Agrega detalles adicionales..."
                placeholderTextColor="#9ca3af"
                value={newEntry.description}
                onChangeText={(text) => setNewEntry({ ...newEntry, description: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Save Button */}
              <TouchableOpacity style={styles.saveButton} onPress={handleAddEntry}>
                <Text style={styles.saveButtonText}>Guardar Registro</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  header: {
    backgroundColor: '#3A85C4',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 15,
  },
  categoriesContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 5,
  },
  categoryCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCircleActive: {
    backgroundColor: '#fff',
  },
  categoryIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 24,
  },
  addButtonFloating: {
    position: 'absolute',
    bottom: 200,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3A85C4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  petSelectorContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  petSelector: {
    gap: 12,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  petCardActive: {
    backgroundColor: '#3A85C4',
    borderColor: '#3A85C4',
  },
  petName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  petNameActive: {
    color: '#fff',
  },
  logsContainer: {
    marginBottom: 20,
  },
  emptyLogs: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  emptyLogsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptyLogsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logTypeContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  logIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logIcon: {
    fontSize: 24,
  },
  logInfo: {
    flex: 1,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  logDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  deleteButton: {
    padding: 4,
  },
  logDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '90%',
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    width: '30%',
  },
  typeButtonActive: {
    backgroundColor: '#f9fafb',
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  typeIconImageContainer: {
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#3A85C4',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#3A85C4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
