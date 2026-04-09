import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import {
    Almacen,
    AlmacenesService,
} from "../src/db/services/almacenes_service";
import { AuthService } from "../src/db/services/auth_service";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  addButton: {
    backgroundColor: "#3b82f6",
    marginLeft: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
  },
  listHeaderText: {
    fontSize: 14,
    color: "#6b7280",
  },
  almacenItem: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 0,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
  },
  almacenHeader: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  almacenIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  almacenInfo: {
    flex: 1,
  },
  almacenHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  almacenTextContainer: {
    flex: 1,
  },
  almacenDescripcion: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 20,
    fontWeight: "400",
  },
  almacenNombre: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  almacenMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 8,
  },
  almacenUbicacion: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },
  almacenStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  almacenActions: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 16,
    gap: 8,
    backgroundColor: "#fafbfc",
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minWidth: 70,
  },
  editButton: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  deleteButton: {
    backgroundColor: "#fef2f2",
    borderColor: "#ef4444",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
    textAlign: "center",
  },
  editButtonText: {
    color: "#1d4ed8",
  },
  deleteButtonText: {
    color: "#dc2626",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalContent: {
    maxHeight: "60%",
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
  },
  cancelButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#3b82f6",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButtonModal: {
    backgroundColor: "#ef4444",
  },
  deleteButtonTextModal: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#6b7280",
  },
});

export default function AlmacenesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/almacenes", params);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [almacenToDelete, setAlmacenToDelete] = useState<Almacen | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados para el formulario
  const [formNombre, setFormNombre] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formUbicacion, setFormUbicacion] = useState("");

  // Cargar datos
  const cargarAlmacenes = async () => {
    try {
      const data = await AlmacenesService.getAllAlmacenes();
      setAlmacenes(data);
    } catch (error) {
      console.error("Error cargando almacenes:", error);
      Alert.alert("Error", "No se pudieron cargar los almacenes");
    }
  };

  useEffect(() => {
    const inicializar = async () => {
      if (isAuthenticated) {
        await cargarAlmacenes();
        setLoading(false);
      }
    };
    inicializar();
  }, [isAuthenticated]);

  const recargarDatos = async () => {
    setRefreshing(true);
    await cargarAlmacenes();
    setRefreshing(false);
  };

  const abrirModalCrear = () => {
    setEditingAlmacen(null);
    setFormNombre("");
    setFormDescripcion("");
    setFormUbicacion("");
    setModalVisible(true);
  };

  const abrirModalEditar = (almacen: Almacen) => {
    setEditingAlmacen(almacen);
    setFormNombre(almacen.nombre);
    setFormDescripcion(almacen.descripcion || "");
    setFormUbicacion(almacen.ubicacion || "");
    setModalVisible(true);
  };

  const cerrarModal = () => {
    setModalVisible(false);
    setEditingAlmacen(null);
  };

  const guardarAlmacen = async () => {
    try {
      if (!formNombre.trim()) {
        Alert.alert("Error", "El nombre del almacén es obligatorio");
        return;
      }

      // Verificar si el nombre ya existe
      const existeNombre = await AlmacenesService.existsNombre(
        formNombre.trim(),
        editingAlmacen?.id,
      );

      if (existeNombre) {
        Alert.alert("Error", "Ya existe un almacén con ese nombre");
        return;
      }

      if (editingAlmacen) {
        // Actualizar
        await AlmacenesService.updateAlmacen(
          editingAlmacen.id,
          formNombre.trim(),
          formDescripcion.trim() || undefined,
          formUbicacion.trim() || undefined,
        );
        Alert.alert("Éxito", "Almacén actualizado correctamente");
      } else {
        // Crear
        await AlmacenesService.createAlmacen(
          formNombre.trim(),
          formDescripcion.trim() || undefined,
          formUbicacion.trim() || undefined,
        );
        Alert.alert("Éxito", "Almacén creado correctamente");
      }

      await cargarAlmacenes();
      cerrarModal();
    } catch (error) {
      console.error("Error guardando almacén:", error);
      Alert.alert("Error", "No se pudo guardar el almacén");
    }
  };

  const confirmarEliminar = (almacen: Almacen) => {
    setAlmacenToDelete(almacen);
    setDeleteModalVisible(true);
  };

  const eliminarAlmacen = async () => {
    if (!almacenToDelete) return;

    try {
      await AlmacenesService.deleteAlmacen(almacenToDelete.id);
      Alert.alert("Éxito", "Almacén eliminado correctamente");
      await cargarAlmacenes();
      setDeleteModalVisible(false);
      setAlmacenToDelete(null);
    } catch (error: any) {
      console.error("Error eliminando almacén:", error);
      Alert.alert("Error", error.message || "No se pudo eliminar el almacén");
    }
  };

  const verificarPassword = async () => {
    const isValid = await AuthService.verifyPassword(password);
    if (isValid) {
      setIsAuthenticated(true);
      setAuthModalVisible(false);
      setPassword("");
    } else {
      Alert.alert("Error", "Contraseña incorrecta");
      setPassword("");
    }
  };

  const navegarAAlmacen = (almacen: Almacen) => {
    router.push(`/almacen?almacenId=${almacen.id}`);
  };

  const renderAlmacenItem = ({ item }: { item: Almacen }) => (
    <View style={styles.almacenItem}>
      <View style={styles.almacenHeader}>
        <View style={styles.almacenInfo}>
          <View style={styles.almacenHeaderContent}>
            <View style={styles.almacenIconContainer}>
              <Ionicons name="business-outline" size={28} color="#1d4ed8" />
            </View>
            <View style={styles.almacenTextContainer}>
              <Text style={styles.almacenNombre}>{item.nombre}</Text>
              {item.descripcion && (
                <Text style={styles.almacenDescripcion} numberOfLines={2}>
                  {item.descripcion}
                </Text>
              )}
              <View style={styles.almacenMeta}>
                {item.ubicacion && (
                  <Text style={styles.almacenUbicacion}>
                    📍 {item.ubicacion}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.almacenActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => navegarAAlmacen(item)}
        >
          <Text style={[styles.actionButtonText, styles.editButtonText]}>
            Ver
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => abrirModalEditar(item)}
        >
          <Text style={[styles.actionButtonText, styles.editButtonText]}>
            Editar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => confirmarEliminar(item)}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
            Eliminar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Modal
          visible={authModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => router.back()}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Acceso Restringido</Text>
              </View>

              <View style={styles.modalContent}>
                <Text
                  style={{
                    fontSize: 16,
                    marginBottom: 20,
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  Esta pantalla requiere autenticación para acceder
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Contraseña</Text>
                  <TextInput
                    style={styles.formInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Ingrese la contraseña"
                    secureTextEntry
                    autoFocus
                    maxLength={20}
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => router.back()}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={verificarPassword}
                >
                  <Text style={styles.saveButtonText}>Acceder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando almacenes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Almacenes</Text>
            <Text style={styles.headerSubtitle}>
              Gestiona tus almacenes y controla el inventario centralizado
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, styles.addButton]}
              onPress={abrirModalCrear}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={almacenes}
        renderItem={renderAlmacenItem}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={recargarDatos}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
        ListHeaderComponent={
          almacenes.length === 0 ? null : (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {almacenes.length}{" "}
                {almacenes.length === 1 ? "almacén" : "almacenes"}
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay almacenes</Text>
            <Text style={styles.emptySubtext}>
              Crea tu primer almacén para comenzar a gestionar tu inventario
            </Text>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.editButton,
                { marginTop: 20 },
              ]}
              onPress={abrirModalCrear}
            >
              <Text style={[styles.actionButtonText, styles.editButtonText]}>
                Crear primer almacén
              </Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={
          almacenes.length > 0 ? styles.listContainer : null
        }
      />

      {/* Modal Crear/Editar */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAlmacen ? "Editar Almacén" : "Nuevo Almacén"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={cerrarModal}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nombre *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formNombre}
                  onChangeText={setFormNombre}
                  placeholder="Ej: Almacén Central"
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Descripción</Text>
                <TextInput
                  style={styles.formInput}
                  value={formDescripcion}
                  onChangeText={setFormDescripcion}
                  placeholder="Descripción del almacén (opcional)"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ubicación</Text>
                <TextInput
                  style={styles.formInput}
                  value={formUbicacion}
                  onChangeText={setFormUbicacion}
                  placeholder="Ej: Planta baja, Oficina principal"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cerrarModal}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={guardarAlmacen}
              >
                <Text style={styles.saveButtonText}>
                  {editingAlmacen ? "Actualizar" : "Crear"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Eliminar Almacén</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text
                style={{ fontSize: 16, marginBottom: 20, textAlign: "center" }}
              >
                ¿Estás seguro que deseas eliminar el almacén "
                <Text style={{ fontWeight: "bold" }}>
                  {almacenToDelete?.nombre}
                </Text>
                "?
              </Text>
              <Text
                style={{ fontSize: 14, color: "#6b7280", textAlign: "center" }}
              >
                Esta acción no se puede deshacer
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButtonModal]}
                onPress={eliminarAlmacen}
              >
                <Text style={styles.deleteButtonTextModal}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
