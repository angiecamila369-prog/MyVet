import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { CameraView, Camera } from "expo-camera";
import MapView, { Marker } from "react-native-maps";
import { WebView } from 'react-native-webview';
import LoadingAnimation from "@/components/LoadingAnimation";
import RummiModal from "@/components/RummiModal";
import { useAuth } from "@/contexts/AuthContext";

const { width } = Dimensions.get("window");

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
}

interface PetLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
  battery?: number;
}

export default function TrackingScreen() {
  const { user, db } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [petLocation, setPetLocation] = useState<PetLocation | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [rummiModalVisible, setRummiModalVisible] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showWebViewModal, setShowWebViewModal] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState("");

  useEffect(() => {
    fetchPets();
  }, []);

  useEffect(() => {
    if (selectedPet) {
      fetchPetLocation(selectedPet);
      // Actualizar ubicación cada 30 segundos
      const interval = setInterval(() => {
        fetchPetLocation(selectedPet);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedPet]);

  const fetchPets = async () => {
    setLoading(true);
    try {
      if (!user) {
        Alert.alert("Error", "Debes iniciar sesión");
        setLoading(false);
        return;
      }

      const { data: petsData, error: petsError } = await db
        .select("pets", "id, name, species, breed")
        .eq("user_id", user.id);

      if (petsError) {
        console.error("Error fetching pets:", petsError);
      } else if (petsData && petsData.length > 0) {
        setPets(petsData);
        setSelectedPet(petsData[0].id);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPetLocation = async (petId: string) => {
    try {
      // Intenta obtener la última ubicación de Supabase
      const { data, error } = await db
        .select("pet_locations", "*")
        .eq("pet_id", petId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Si no hay ubicaciones, no mostrar nada
        console.log("No location found for this pet");
        setPetLocation(null);
      } else {
        setPetLocation({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          timestamp: data.timestamp,
          battery: data.battery_level || 85,
        });
      }
    } catch (error) {
      console.error("Error fetching location:", error);
      setPetLocation(null);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');

    if (status !== 'granted') {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a la cámara para escanear códigos QR',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const handleOpenScanner = async () => {
    const hasAccess = await requestCameraPermission();
    if (hasAccess) {
      setScanned(false);
      setShowScannerModal(true);
    }
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scanned) return;

    setScanned(true);
    setShowScannerModal(false);

    // Procesar el código QR escaneado
    handleScanQR(data);
  };

  const extractCoordinatesFromQR = (qrData: string): { latitude: number; longitude: number } | null => {
    try {
      console.log("QR Data escaneado:", qrData);

      // Patrones comunes de URLs de Google Maps
      // Formato 1: https://maps.google.com/?q=4.7110,-74.0721
      // Formato 2: https://www.google.com/maps?q=4.7110,-74.0721
      // Formato 3: https://goo.gl/maps/...
      // Formato 4: geo:4.7110,-74.0721
      // Formato 5: https://maps.app.goo.gl/...
      // Formato 6: https://www.google.com/maps/@4.7110,-74.0721,15z
      // Formato 7: https://maps.google.com/maps?ll=4.7110,-74.0721

      // Intenta extraer del patrón @lat,lng,zoom (formato compartir de Google Maps)
      const atPattern = /@(-?\d+\.?\d+),(-?\d+\.?\d+)/;
      const atMatch = qrData.match(atPattern);
      if (atMatch) {
        console.log("Coordenadas encontradas con patrón @:", atMatch[1], atMatch[2]);
        return {
          latitude: parseFloat(atMatch[1]),
          longitude: parseFloat(atMatch[2])
        };
      }

      // Intenta extraer coordenadas directas del patrón q=lat,lng
      const qPattern = /[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/;
      const qMatch = qrData.match(qPattern);
      if (qMatch) {
        console.log("Coordenadas encontradas con patrón q=:", qMatch[1], qMatch[2]);
        return {
          latitude: parseFloat(qMatch[1]),
          longitude: parseFloat(qMatch[2])
        };
      }

      // Intenta extraer del patrón ll=lat,lng
      const llPattern = /[?&]ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/;
      const llMatch = qrData.match(llPattern);
      if (llMatch) {
        console.log("Coordenadas encontradas con patrón ll=:", llMatch[1], llMatch[2]);
        return {
          latitude: parseFloat(llMatch[1]),
          longitude: parseFloat(llMatch[2])
        };
      }

      // Intenta extraer del patrón geo:
      const geoPattern = /geo:(-?\d+\.?\d+),(-?\d+\.?\d+)/;
      const geoMatch = qrData.match(geoPattern);
      if (geoMatch) {
        console.log("Coordenadas encontradas con patrón geo:", geoMatch[1], geoMatch[2]);
        return {
          latitude: parseFloat(geoMatch[1]),
          longitude: parseFloat(geoMatch[2])
        };
      }

      // Intenta extraer del patrón place con coordenadas
      const placePattern = /place\/[^/]*\/(-?\d+\.?\d+),(-?\d+\.?\d+)/;
      const placeMatch = qrData.match(placePattern);
      if (placeMatch) {
        console.log("Coordenadas encontradas con patrón place:", placeMatch[1], placeMatch[2]);
        return {
          latitude: parseFloat(placeMatch[1]),
          longitude: parseFloat(placeMatch[2])
        };
      }

      // Intenta extraer coordenadas separadas por coma (formato simple)
      const simplePattern = /^(-?\d+\.?\d+),\s*(-?\d+\.?\d+)$/;
      const simpleMatch = qrData.match(simplePattern);
      if (simpleMatch) {
        console.log("Coordenadas encontradas con patrón simple:", simpleMatch[1], simpleMatch[2]);
        return {
          latitude: parseFloat(simpleMatch[1]),
          longitude: parseFloat(simpleMatch[2])
        };
      }

      console.log("No se encontraron coordenadas en el QR");
      return null;
    } catch (error) {
      console.error("Error extracting coordinates:", error);
      return null;
    }
  };

  const handleScanQR = async (scannedData: string) => {
    try {
      // Primero, intenta extraer coordenadas de Google Maps
      const coordinates = extractCoordinatesFromQR(scannedData);

      if (coordinates) {
        // Es un código QR de ubicación (Google Maps u otro)
        if (!selectedPet) {
          Alert.alert("Error", "Selecciona una mascota primero");
          return;
        }

        // Guardar la ubicación de la mascota
        const { error: locationError } = await db
          .insert("pet_locations", [{
            pet_id: selectedPet,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            timestamp: new Date().toISOString(),
            battery_level: 100, // Ubicación manual, asumimos batería completa
          }]);

        if (locationError) {
          console.error("Error saving location:", locationError);
          Alert.alert("Error", "No se pudo guardar la ubicación");
          return;
        }

        // Actualizar la ubicación en la pantalla
        setPetLocation({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          timestamp: new Date().toISOString(),
          battery: 100,
        });

        const petData = pets.find(p => p.id === selectedPet);
        Alert.alert(
          "Ubicación Registrada",
          `Se ha registrado la ubicación de ${petData?.name || 'tu mascota'}:\nLat: ${coordinates.latitude.toFixed(6)}\nLng: ${coordinates.longitude.toFixed(6)}`
        );
        return;
      }

      // Si no es una ubicación, buscar si es un QR de mascota
      const { data: qrData, error } = await db
        .select("pet_qr_codes", "pet_id")
        .eq("qr_code", scannedData)
        .single();

      if (error || !qrData) {
        // Verificar si es una URL acortada (me-qr.com, goo.gl, bit.ly, etc)
        const isShortUrl = scannedData.match(/https?:\/\/(q\.me-qr\.com|goo\.gl|bit\.ly|tiny\.url|maps\.app\.goo\.gl)/i);

        if (isShortUrl) {
          // Abrir el mapa en un WebView dentro de la app
          setWebViewUrl(scannedData);
          setShowWebViewModal(true);
          return;
        }

        // Mostrar el contenido del QR para debugging
        const preview = scannedData.length > 100 ? scannedData.substring(0, 100) + "..." : scannedData;
        Alert.alert(
          "Código no reconocido",
          `Este código QR no contiene una ubicación válida ni está registrado como QR de mascota.\n\nContenido: ${preview}\n\nSi es un enlace de Google Maps, por favor repórtalo para agregar soporte.`
        );
        return;
      }

      // Verificar si el usuario tiene acceso a esta mascota
      const { data: petData, error: petError } = await db
        .select("pets", "*")
        .eq("id", qrData.pet_id)
        .single();

      if (petError || !petData) {
        Alert.alert("Error", "No se encontró la mascota");
        return;
      }

      // Cambiar a la mascota escaneada
      setSelectedPet(qrData.pet_id);
      Alert.alert("Éxito", `Mostrando ubicación de ${petData.name}`);
    } catch (error) {
      console.error("Error scanning QR:", error);
      Alert.alert("Error", "Error al procesar el código QR");
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rastreo GPS</Text>
        </View>
        <View style={styles.loadingContainer}>
          <LoadingAnimation size={100} />
          <Text style={styles.loadingText}>Cargando mascotas...</Text>
        </View>
      </View>
    );
  }

  if (pets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rastreo GPS</Text>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="pets" size={80} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No tienes mascotas</Text>
          <Text style={styles.emptySubtitle}>
            Agrega una mascota en tu perfil para poder rastrearla
          </Text>
        </View>
      </View>
    );
  }

  const selectedPetData = pets.find(p => p.id === selectedPet);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rastreo GPS</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Pet Selector */}
        <View style={styles.petSelectorContainer}>
          <Text style={styles.sectionTitle}>Selecciona tu mascota</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.petScrollView}
          >
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petCard,
                  selectedPet === pet.id && styles.petCardActive
                ]}
                onPress={() => setSelectedPet(pet.id)}
              >
                <MaterialIcons
                  name="pets"
                  size={32}
                  color={selectedPet === pet.id ? '#fff' : '#3A85C4'}
                />
                <Text style={[
                  styles.petCardName,
                  selectedPet === pet.id && styles.petCardNameActive
                ]}>
                  {pet.name}
                </Text>
                <Text style={[
                  styles.petCardSpecies,
                  selectedPet === pet.id && styles.petCardSpeciesActive
                ]}>
                  {pet.species}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Location Status */}
        {petLocation && selectedPetData && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.statusTitle}>Ubicación de {selectedPetData.name}</Text>
                <Text style={styles.statusTimestamp}>
                  {formatTimestamp(petLocation.timestamp)}
                </Text>
              </View>
              <View style={styles.batteryContainer}>
                <MaterialIcons
                  name={petLocation.battery && petLocation.battery > 20 ? "battery-full" : "battery-alert"}
                  size={24}
                  color={petLocation.battery && petLocation.battery > 20 ? "#22c55e" : "#ef4444"}
                />
                <Text style={styles.batteryText}>{petLocation.battery}%</Text>
              </View>
            </View>

            {/* Coordinates */}
            <View style={styles.coordinatesContainer}>
              <View style={styles.coordinateItem}>
                <MaterialIcons name="place" size={20} color="#6b7280" />
                <View style={styles.coordinateText}>
                  <Text style={styles.coordinateLabel}>Latitud</Text>
                  <Text style={styles.coordinateValue}>
                    {petLocation.latitude.toFixed(6)}
                  </Text>
                </View>
              </View>
              <View style={styles.coordinateItem}>
                <MaterialIcons name="place" size={20} color="#6b7280" />
                <View style={styles.coordinateText}>
                  <Text style={styles.coordinateLabel}>Longitud</Text>
                  <Text style={styles.coordinateValue}>
                    {petLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Real Map or No Location Message */}
        {petLocation ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: petLocation.latitude,
                longitude: petLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              region={{
                latitude: petLocation.latitude,
                longitude: petLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={{
                  latitude: petLocation.latitude,
                  longitude: petLocation.longitude,
                }}
                title={selectedPetData?.name || "Mi Mascota"}
                description={`Última actualización: ${formatTimestamp(petLocation.timestamp)}`}
              >
                <View style={styles.customMarker}>
                  <MaterialIcons name="pets" size={30} color="#3A85C4" />
                </View>
              </Marker>
            </MapView>
          </View>
        ) : (
          <View style={styles.noLocationCard}>
            <MaterialIcons name="location-off" size={60} color="#9ca3af" />
            <Text style={styles.noLocationTitle}>Sin ubicación registrada</Text>
            <Text style={styles.noLocationText}>
              Escanea un código QR de Google Maps para registrar la ubicación de {selectedPetData?.name || 'tu mascota'}
            </Text>
          </View>
        )}

        {/* Scanner Button */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleOpenScanner}
        >
          <MaterialIcons name="qr-code-scanner" size={28} color="#fff" />
          <Text style={styles.scanButtonText}>Escanear QR</Text>
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={24} color="#3A85C4" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Sobre el rastreo GPS</Text>
            <Text style={styles.infoText}>
              El collar de tu mascota tiene un chip GPS que actualiza su ubicación cada 30 segundos.
              Comparte el código QR para que otros puedan rastrear a tu mascota en caso de emergencia.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Scanner Modal - Real Camera */}
      <Modal
        visible={showScannerModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowScannerModal(false);
          setScanned(false);
        }}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => {
              setShowScannerModal(false);
              setScanned(false);
            }}>
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Escanear QR</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Real Camera Scanner */}
          {hasPermission === null ? (
            <View style={styles.scannerPlaceholder}>
              <MaterialIcons name="qr-code-scanner" size={120} color="#fff" />
              <Text style={styles.scannerPlaceholderText}>
                Solicitando permisos de cámara...
              </Text>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.scannerPlaceholder}>
              <MaterialIcons name="no-photography" size={120} color="#ef4444" />
              <Text style={styles.scannerPlaceholderText}>
                No hay acceso a la cámara
              </Text>
              <Text style={styles.scannerPlaceholderSubtext}>
                Por favor, activa los permisos de cámara en la configuración
              </Text>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.scannerInstruction}>
                  Apunta al código QR de la mascota
                </Text>
              </View>
            </CameraView>
          )}

          <TouchableOpacity
            style={styles.scannerCloseButton}
            onPress={() => {
              setShowScannerModal(false);
              setScanned(false);
            }}
          >
            <Text style={styles.scannerCloseText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* WebView Modal for Google Maps */}
      <Modal
        visible={showWebViewModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowWebViewModal(false)}
      >
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity onPress={() => setShowWebViewModal(false)}>
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>Google Maps</Text>
            <View style={{ width: 28 }} />
          </View>

          <WebView
            source={{ uri: webViewUrl }}
            style={styles.webView}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <LoadingAnimation size={60} />
                <Text style={styles.webViewLoadingText}>Cargando mapa...</Text>
              </View>
            )}
          />

          <View style={styles.webViewInstructions}>
            <MaterialIcons name="info-outline" size={20} color="#3A85C4" />
            <Text style={styles.webViewInstructionsText}>
              Visualiza el mapa de Google Maps. Cierra esta ventana cuando termines.
            </Text>
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
    backgroundColor: "#f3f4f6",
  },
  header: {
    backgroundColor: "#3A85C4",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  petSelectorContainer: {
    marginBottom: 20,
  },
  petScrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  petCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  petCardActive: {
    backgroundColor: "#3A85C4",
    borderColor: "#3A85C4",
  },
  petCardName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 8,
  },
  petCardNameActive: {
    color: "#fff",
  },
  petCardSpecies: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  petCardSpeciesActive: {
    color: "#e0e7ff",
  },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  statusTimestamp: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  batteryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  batteryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  coordinatesContainer: {
    gap: 12,
  },
  coordinateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coordinateText: {
    flex: 1,
  },
  coordinateLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  coordinateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#e5e7eb",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  customMarker: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#3A85C4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  noLocationCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noLocationTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
  },
  noLocationText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  scanButton: {
    backgroundColor: "#22c55e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3A85C4",
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: width - 40,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  scannerPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  scannerPlaceholderText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 20,
    textAlign: "center",
  },
  scannerPlaceholderSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  scannerCloseButton: {
    margin: 20,
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  scannerCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
  // Camera Scanner styles
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#7FD0FF',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scannerInstruction: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  // WebView Modal styles
  webViewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  webViewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#3A85C4",
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  webViewTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  webViewLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  webViewInstructions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f9ff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  webViewInstructionsText: {
    flex: 1,
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
});
