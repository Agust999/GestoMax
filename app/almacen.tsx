import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
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
import { PuntoHelper } from "../src/db/databaseHelper";
import { AlmacenService } from "../src/db/services/almacen_service";
import {
    Almacen,
    AlmacenesService,
} from "../src/db/services/almacenes_service";
import {
    FormulasPanService,
    type CrearFormulaPan,
    type FormulaPan,
} from "../src/db/services/formulas_pan_service";
import type {
    FiltrosHistorialInventario,
    HistorialInventarioItem,
} from "../src/db/services/historial_inventario_service";
import { HistorialInventarioService } from "../src/db/services/historial_inventario_service";
import {
    ProduccionPanService,
    type InsumoSeleccionado,
    type ResumenProduccion,
} from "../src/db/services/produccion_pan_service";
import {
    ProductoAlmacen,
    ProductoService,
} from "../src/db/services/producto_services";

const styles = StyleSheet.create({
  // Todos tus estilos van aquí dentro
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  alertButton: {
    backgroundColor: "#fef3c7",
  },
  addButton: {
    backgroundColor: "#3b82f6",
    marginLeft: 12,
  },
  alertBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  alertBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#1f2937",
  },
  filtrosContainer: {
    marginBottom: 12,
  },
  filtroGroup: {
    marginRight: 16,
  },
  filtroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  filtroOptions: {
    flexDirection: "row",
  },
  filtroOptionsScroll: {
    flexGrow: 0,
  },
  filtroOptionsContent: {
    flexDirection: "row",
    paddingRight: 8,
  },
  filtroOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    marginRight: 8,
  },
  filtroOptionActive: {
    backgroundColor: "#3b82f6",
  },
  filtroOptionText: {
    fontSize: 14,
    color: "#6b7280",
  },
  filtroOptionTextActive: {
    color: "white",
    fontWeight: "600",
  },
  limpiarFiltrosBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    marginRight: 8,
  },
  limpiarFiltrosText: {
    fontSize: 14,
    color: "#3b7280",
    marginLeft: 4,
  },
  ordenamientoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  ordenamientoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginRight: 12,
  },
  ordenamientoOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    marginRight: 8,
  },
  ordenamientoOptionActive: {
    backgroundColor: "#e0e7ff",
  },
  ordenamientoOptionText: {
    fontSize: 14,
    color: "#6b7280",
    marginRight: 4,
  },
  ordenamientoOptionTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  quickStatsCompact: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  quickStatCardCompact: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  quickStatTopCompact: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  quickStatIconCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  quickStatValueCompact: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    flex: 1,
  },
  quickStatLabelCompact: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  quickStatSubLabel: {
    fontSize: 10,
    color: "#9ca3af",
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  trendText: {
    fontSize: 10,
    color: "#9ca3af",
    marginLeft: 4,
  },
  alertBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  alertBadgeActive: {
    backgroundColor: "#fef3c7",
  },
  alertBadgeInactive: {
    backgroundColor: "#d1fae5",
  },
  zonaInfoContainer: {
    backgroundColor: "#eff6ff",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  zonaInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  zonaInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 8,
  },
  zonaInfoText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
    marginBottom: 12,
  },
  zonaInfoHighlight: {
    fontWeight: "600",
    color: "#3b82f6",
  },
  zonaStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
  },
  zonaStatItem: {
    alignItems: "center",
  },
  zonaStatLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  zonaStatValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  productosList: {
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
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
  },
  exportButtonText: {
    fontSize: 14,
    color: "#3b82f6",
    marginLeft: 4,
  },
  productoItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  productoInfo: {
    flex: 1,
    marginRight: 12,
  },
  productoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  productoMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoriaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  categoriaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  productoStats: {
    alignItems: "flex-end",
  },
  precioContainer: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  productoPrecio: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#059669",
  },
  precioLabel: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 2,
  },
  stockContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  stockText: {
    fontSize: 12,
    fontWeight: "500",
  },
  productoDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 8,
  },
  diasText: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 4,
  },
  productoActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  editarButton: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  transferButton: {
    backgroundColor: "#d1fae5",
    borderColor: "#10b981",
  },
  moverButton: {
    backgroundColor: "#f5f3ff",
    borderColor: "#8b5cf6",
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
  limpiarBusquedaButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3b82f6",
    borderRadius: 20,
  },
  limpiarBusquedaText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  almacenSelectModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    maxHeight: "90%",
  },
  almacenSelectModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    margin: 20,
    height: "80%",
    width: "95%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  puntoSelectModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  puntoSelectModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    margin: 20,
    height: "80%",
    width: "95%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  puntoSelectTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  puntoSelectList: {
    flex: 1,
  },
  almacenSelectTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  almacenSelectList: {
    flex: 1,
  },
  modalZona: {
    maxHeight: "80%",
    width: "90%",
    alignSelf: "center",
    borderRadius: 12,
    marginVertical: "auto",
  },
  modalSeleccionar: {
    maxHeight: "95%",
    width: "98%",
    alignSelf: "center",
    borderRadius: 12,
    marginVertical: "auto",
  },
  modalTransferencia: {
    maxHeight: "85%",
  },
  modalForm: {
    maxHeight: "90%",
  },
  modalProduccion: {
    maxHeight: "90%",
    width: "95%",
    maxWidth: 600,
  },
  modalEliminar: {
    maxHeight: "80%",
  },
  modalAlertas: {
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalContent: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 8,
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
  deleteButton: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    alignItems: "center",
  },
  modalCloseButtonX: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  statCardDestacado: {
    backgroundColor: "#d1fae5",
    borderWidth: 2,
    borderColor: "#10b981",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
    textAlign: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statSubLabel: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: "#eff6ff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
  infoHighlight: {
    fontWeight: "600",
    color: "#3b82f6",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  categoriasList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoriaItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  categoriaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  zonaCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flex: 1,
    alignItems: "center",
    minWidth: 0, // Permite que los cards se encojan correctamente
  },
  zonasGrid: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16, // Espacio consistente entre los cards
    marginHorizontal: 16, // Centra el grupo completo
  },
  zonaCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  zonaCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  zonaCardValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  zonaCardSubValue: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  productoInfoModal: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  productoInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  productoInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  productoInfoNombre: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  productoInfoCategoria: {
    fontSize: 14,
    color: "#6b7280",
  },
  productoInfoStats: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
  },
  productoInfoStat: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
  },
  infoDestino: {
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoDestinoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoDestinoText: {
    fontSize: 14,
    color: "#4b5563",
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
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
  formHelp: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 6,
  },
  precioInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  precioMaximoText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
  },
  puntosContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  puntoOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
    flex: 1,
    minWidth: "45%",
  },
  puntoOptionSelected: {
    backgroundColor: "#e0e7ff",
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  puntoOptionText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 8,
  },
  puntoOptionTextSelected: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  sinPuntosContainer: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fef3c7",
    borderRadius: 10,
  },
  sinPuntosText: {
    fontSize: 14,
    color: "#92400e",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  resumenContainer: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  resumenTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  resumenItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resumenLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  resumenValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  costosAdicionalesContainer: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  costoAdicionalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  costoAdicionalLabel: {
    fontSize: 14,
    color: "#6b7280",
    flex: 1,
  },
  costoAdicionalInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1f2937",
    textAlign: "right",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
    marginLeft: 8,
  },
  datePickerPlaceholder: {
    color: "#9ca3af",
  },
  clearDateButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 8,
  },
  clearDateText: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 4,
  },
  infoAdicional: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  infoTitulo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  infoValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  alertaEliminar: {
    alignItems: "center",
    padding: 20,
  },
  alertaEliminarTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  alertaEliminarTexto: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },
  detallesEliminar: {
    width: "100%",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
  },
  detalleEliminarItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detalleEliminarLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  detalleEliminarValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  alertaSection: {
    marginBottom: 24,
  },
  alertaHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  alertaTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  alertaItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  alertaItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  alertaItemNombre: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  alertaItemDetalle: {
    fontSize: 12,
    color: "#6b7280",
  },
  alertaItemAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
  },
  alertaItemActionText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "600",
  },
  alertaItemStock: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fee2e2",
    borderRadius: 6,
  },
  alertaItemStockText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  emptyAlertasContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyAlertasTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#059669",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyAlertasText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  infoDestinoZona: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoDestinoZonaText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#1f2937",
    flex: 1,
  },
  zonaOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "white",
  },
  zonaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  zonaInfo: {
    flex: 1,
  },
  zonaTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  zonaDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  zonaDetalle: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 16,
  },
  resumenZonas: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  resumenZonasTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  resumenZonasItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  resumenZonasInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  resumenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  resumenZonasLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  resumenZonasValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  // Estilos para el botón de Fórmula
  formulaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f97316",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  // Estilos para los modales de fórmula
  formulaModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "white",
  },
  formulaModalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  formulaCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  formulaModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  formulaModalContent: {
    flex: 1,
    padding: 20,
  },
  addFormulaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
    justifyContent: "center",
  },
  addFormulaButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  formulaListTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  emptyFormulaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyFormulaText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
    textAlign: "center",
  },
  emptyFormulaSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  // Estilos para el modal de crear fórmula
  createFormulaContent: {
    flex: 1,
    padding: 20,
  },
  formulaNameContainer: {
    marginBottom: 24,
  },
  formulaNameLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  formulaNameInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "white",
  },
  formulaTableContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 32,
  },
  formulaTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
  },
  formulaTableHeaderLeft: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  formulaTableHeaderRight: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
  },
  formulaTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  formulaTableInsumo: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
  },
  formulaTableInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    textAlign: "right",
    backgroundColor: "white",
  },
  createFormulaActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  cancelFormulaButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelFormulaButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  saveFormulaButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  saveFormulaButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  saveFormulaButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  // Estilos para el sistema de producción de panes
  insumoItem: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  insumoInfo: {
    flex: 1,
  },
  insumoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  insumoDescripcion: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  insumoCantidad: {
    fontSize: 12,
    color: "#059669",
    marginBottom: 2,
  },
  insumoRequerido: {
    fontSize: 12,
    color: "#d97706",
    marginBottom: 2,
  },
  seleccionarInsumoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  seleccionarInsumoText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "600",
    marginLeft: 4,
  },
  insumoProductoItem: {
    flexDirection: "row",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  insumoProductoInfo: {
    flex: 1,
  },
  insumoProductoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  insumoProductoDescripcion: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  insumoProductoDetalles: {
    gap: 2,
  },
  insumoProductoDetalle: {
    fontSize: 12,
    color: "#9ca3af",
  },
  insumosEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  insumosEmptyText: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
  },
  // Estilos para la lista de fórmulas existentes
  formulaListContainer: {
    flex: 1,
  },
  formulaItem: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  formulaInfo: {
    flex: 1,
  },
  formulaName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  formulaIngredients: {
    gap: 4,
  },
  ingredientText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  formulaActions: {
    alignItems: "flex-end",
    marginTop: 12,
  },
  formulaButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  formulaEditButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3b82f6",
    gap: 4,
  },
  formulaCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#10b981",
    gap: 4,
  },
  formulaDeleteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ef4444",
    gap: 4,
  },
  formulaButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
export default function AlmacenScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/almacen", params);

  // Helper function para obtener etiquetas de formato
  const getFormatLabel = (formato: string, plural: boolean = false) => {
    const labels: { [key: string]: { singular: string; plural: string } } = {
      paquete: { singular: "Paquete", plural: "Paquetes" },
      bolsa: { singular: "Bolsa", plural: "Bolsas" },
      lata: { singular: "Lata", plural: "Latas" },
      bulto: { singular: "Bulto", plural: "Bultos" },
      sobre: { singular: "Sobre", plural: "Sobres" },
      tubo: { singular: "Tubo", plural: "Tubos" },
      galon: { singular: "Galón", plural: "Galones" },
      litro: { singular: "Litro", plural: "Litros" },
      blister: { singular: "Blister", plural: "Blisters" },
      cajon: { singular: "Cajón", plural: "Cajones" },
      kilogramo: { singular: "Kilogramo", plural: "Kilogramos" },
      gramo: { singular: "Gramo", plural: "Gramos" },
      mililitro: { singular: "Mililitro", plural: "Mililitros" },
      metro: { singular: "Metro", plural: "Metros" },
      centimetro: { singular: "Centímetro", plural: "Centímetros" },
      pulgada: { singular: "Pulgada", plural: "Pulgadas" },
      cajas: { singular: "Caja", plural: "Cajas" },
    };

    return labels[formato]?.[plural ? "plural" : "singular"] || formato;
  };

  const [puntoActual, setPuntoActual] = useState<any>(null);
  const [almacenActual, setAlmacenActual] = useState<Almacen | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inventario, setInventario] = useState<ProductoAlmacen[]>([]);
  const [estadisticas, setEstadisticas] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todos");
  const [stockFiltro, setStockFiltro] = useState<string>("todos");
  const [fechaFiltro, setFechaFiltro] = useState<string>("todos");

  // Estados para los modales de fórmulas
  const [mostrarModalFormula, setMostrarModalFormula] = useState(false);
  const [mostrarModalCrearFormula, setMostrarModalCrearFormula] =
    useState(false);
  const [nombrePan, setNombrePan] = useState("");
  const [formulaData, setFormulaData] = useState({
    harina: "",
    levadura: "",
    nucleo: "",
    azucar: "",
    sal: "",
    aceite: "",
  });
  const [formulasExistentes, setFormulasExistentes] = useState<FormulaPan[]>(
    [],
  );
  const [formulasSeleccionadas, setFormulasSeleccionadas] = useState<number[]>(
    [],
  );
  const [formulaEditando, setFormulaEditando] = useState<FormulaPan | null>(
    null,
  );
  const [loadingFormulas, setLoadingFormulas] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [modalEstadisticas, setModalEstadisticas] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [modalAjusteStock, setModalAjusteStock] = useState(false);
  const [modalProductosVencidos, setModalProductosVencidos] = useState(false);
  const [modalProductoForm, setModalProductoForm] = useState(false);
  const [modalEliminarProducto, setModalEliminarProducto] = useState(false);
  const [modalSeleccionarZona, setModalSeleccionarZona] = useState(false);
  const [modalSeleccionarAlmacen, setModalSeleccionarAlmacen] = useState(false);
  const [
    modalSeleccionarAlmacenTransferencia,
    setModalSeleccionarAlmacenTransferencia,
  ] = useState(false);
  const [modalSeleccionarPunto, setModalSeleccionarPunto] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [modalCorreccionTransferencia, setModalCorreccionTransferencia] =
    useState(false);
  const [modalFormatoAlmacenamiento, setModalFormatoAlmacenamiento] =
    useState(false);
  const [modalTipoCantidadTransferencia, setModalTipoCantidadTransferencia] =
    useState(false);
  const [transferenciaSeleccionada, setTransferenciaSeleccionada] =
    useState<any>(null);
  const [cantidadCorreccion, setCantidadCorreccion] = useState("");
  const [motivoCorreccion, setMotivoCorreccion] = useState("");
  const [almacenDestinoCorreccion, setAlmacenDestinoCorreccion] = useState<
    number | null
  >(null);
  const [historialMovimientos, setHistorialMovimientos] = useState<
    HistorialInventarioItem[]
  >([]);
  const [historialFiltros, setHistorialFiltros] =
    useState<FiltrosHistorialInventario>({});
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [loadingMasHistorial, setLoadingMasHistorial] = useState(false);
  const [paginaActual, setPaginaActual] = useState(0);
  const [hayMasDatos, setHayMasDatos] = useState(true);
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState<Date | null>(null);
  const [showDatePickerHistorial, setShowDatePickerHistorial] = useState(false);
  const [tipoMovimientoFiltro, setTipoMovimientoFiltro] =
    useState<string>("todos");
  const [cantidadTransferencia, setCantidadTransferencia] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [tipoTransferencia, setTipoTransferencia] = useState<
    "punto" | "almacen"
  >("punto");
  const [tipoCantidadTransferencia, setTipoCantidadTransferencia] = useState<
    | "unidades"
    | "paquete"
    | "bolsa"
    | "lata"
    | "bulto"
    | "sobre"
    | "tubo"
    | "galon"
    | "litro"
    | "blister"
    | "cajon"
    | "kilogramo"
    | "gramo"
    | "mililitro"
    | "metro"
    | "centimetro"
    | "pulgada"
    | "cajas"
  >("unidades");
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<ProductoAlmacen | null>(null);
  const [puntosDestino, setPuntosDestino] = useState<any[]>([]);
  const [almacenesDestino, setAlmacenesDestino] = useState<Almacen[]>([]);
  const [almacenesParaCorreccion, setAlmacenesParaCorreccion] = useState<
    Almacen[]
  >([]);
  const [almacenesParaTransferencia, setAlmacenesParaTransferencia] = useState<
    Almacen[]
  >([]);

  // Estados para el sistema de producción de panes
  const [modalProduccionPan, setModalProduccionPan] = useState(false);
  const [resumenProduccion, setResumenProduccion] =
    useState<ResumenProduccion | null>(null);
  const [cantidadPanesProducir, setCantidadPanesProducir] = useState("");
  const [insumosSeleccionados, setInsumosSeleccionados] = useState<
    InsumoSeleccionado[]
  >([]);
  const [modalSeleccionInsumos, setModalSeleccionInsumos] = useState(false);
  const [insumoActualSeleccionar, setInsumoActualSeleccionar] =
    useState<string>("");
  const [productosInsumoDisponibles, setProductosInsumoDisponibles] = useState<
    any[]
  >([]);
  const [loadingProduccion, setLoadingProduccion] = useState(false);

  // Estados para costos adicionales de producción
  const [costoTrabajador, setCostoTrabajador] = useState("");
  const [costoTransporte, setCostoTransporte] = useState("");
  const [costoElectricidad, setCostoElectricidad] = useState("");

  const [puntoDestino, setPuntoDestino] = useState<number | null>(null);
  const [almacenDestino, setAlmacenDestino] = useState<number | null>(null);
  const [ajusteCantidad, setAjusteCantidad] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState<"entrada" | "salida">("entrada");

  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState("");
  const [formSubcategoria, setFormSubcategoria] = useState("");
  const [formPrecioCoste, setFormPrecioCoste] = useState("");
  const [formCantidad, setFormCantidad] = useState("");
  const [formFechaCaducidad, setFormFechaCaducidad] = useState("");
  const [formFormatoAlmacen, setFormFormatoAlmacen] = useState("");
  const [formUnidadesPorFormato, setFormUnidadesPorFormato] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formTipoProducto, setFormTipoProducto] = useState<
    "producto" | "insumo"
  >("producto");
  const [formCostoInsumo, setFormCostoInsumo] = useState("");
  const [formModoEdicion, setFormModoEdicion] = useState(false);
  const [formModoAgregarSimilar, setFormModoAgregarSimilar] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Función para cargar el historial de movimientos
  const cargarHistorial = async (
    filtros?: FiltrosHistorialInventario,
    reiniciarPagina = true,
  ) => {
    console.log("🎯 DEBUG - cargarHistorial llamado con:", {
      filtros,
      reiniciarPagina,
      puntoActual: puntoActual?.id,
      almacenActual: almacenActual?.id,
    });

    if (reiniciarPagina) {
      setPaginaActual(0);
      setHayMasDatos(true);
      setLoadingHistorial(true);
    } else {
      setLoadingMasHistorial(true);
    }

    try {
      // Siempre incluir el contexto del almacén o punto actual
      const filtrosConContexto: FiltrosHistorialInventario = {
        ...filtros,
        // Usar el tipoMovimiento de los filtros recibidos, no del estado
        tipo_movimiento:
          tipoMovimientoFiltro === "todos" ? undefined : tipoMovimientoFiltro,
      };

      // Agregar filtro según el contexto actual
      console.log("🔍 Contexto actual - PuntoActual:", puntoActual);
      console.log("🔍 Contexto actual - AlmacenActual:", almacenActual);
      console.log("🔍 Params:", params);

      if (puntoActual && puntoActual.id) {
        filtrosConContexto.punto_id = puntoActual.id;
        console.log("📍 Filtrando por punto ID:", puntoActual.id);
      } else if (almacenActual && almacenActual.id) {
        // Para almacenes específicos, incluir:
        // 1. Movimientos directos en este almacén
        // 2. Transferencias DESDE este almacén (aunque vayan a puntos)
        // 3. Transferencias HACIA este almacén (desde puntos o general)
        console.log(
          "🏭 Filtrando por almacén ID:",
          almacenActual.id,
          "con transferencias relacionadas",
        );

        // No filtrar por almacen_id directamente para permitir ver transferencias relacionadas
        // En su lugar, lo manejaremos en la consulta SQL
        filtrosConContexto.almacen_id_relacionado = almacenActual.id;
      } else {
        filtrosConContexto.almacen_id = 0; // Almacén General
        console.log("🏭 Filtrando por Almacén General (ID: 0)");
      }

      // Agregar paginación
      const limite = 20;
      const offset = reiniciarPagina ? 0 : paginaActual * limite;

      filtrosConContexto.limite = limite;
      // Nota: offset no está en la interfaz del servicio, se manejará en el servicio si es necesario

      console.log("📋 Cargando historial con filtros:", filtrosConContexto);
      console.log(
        "🏢 Contexto - Punto:",
        puntoActual?.id,
        "Almacén:",
        almacenActual?.id,
        "Tipo movimiento:",
        tipoMovimientoFiltro,
        "Página:",
        reiniciarPagina ? 0 : paginaActual,
      );

      const movimientos =
        await HistorialInventarioService.getMovimientosHistorial(
          filtrosConContexto,
        );
      console.log("✅ Movimientos obtenidos:", movimientos.length);

      if (reiniciarPagina) {
        setHistorialMovimientos(movimientos);
      } else {
        setHistorialMovimientos((prev) => [...prev, ...movimientos]);
      }

      // Verificar si hay más datos
      if (movimientos.length < limite) {
        setHayMasDatos(false);
      }

      if (!reiniciarPagina) {
        setPaginaActual((prev) => prev + 1);
      }
    } catch (error) {
      console.error("❌ Error cargando historial:", error);
      setHistorialMovimientos([]);
    } finally {
      setLoadingHistorial(false);
      setLoadingMasHistorial(false);
    }
  };

  const [productosVencidos, setProductosVencidos] = useState<ProductoAlmacen[]>(
    [],
  );
  const [productosPorVencer, setProductosPorVencer] = useState<
    ProductoAlmacen[]
  >([]);
  const [productosStockBajo, setProductosStockBajo] = useState<
    ProductoAlmacen[]
  >([]);
  const [productosEnZonaVenta, setProductosEnZonaVenta] = useState<
    ProductoAlmacen[]
  >([]);

  const [ordenarPor, setOrdenarPor] = useState<
    "nombre" | "cantidad" | "precio" | "fecha"
  >("nombre");
  const [ordenAscendente, setOrdenAscendente] = useState(true);

  const [estadisticasZonas, setEstadisticasZonas] = useState<{
    enVenta: number;
    enAlmacenPunto: number;
    valorVenta: number;
    valorAlmacenPunto: number;
  }>({ enVenta: 0, enAlmacenPunto: 0, valorVenta: 0, valorAlmacenPunto: 0 });

  const calcularPrecioMaximo = useCallback(
    (precioCostoReal: number): number => {
      return precioCostoReal / 0.7;
    },
    [],
  );

  const cargarDatosIniciales = useCallback(async () => {
    try {
      setLoading(true);

      let puntoId = params.puntoId ? parseInt(params.puntoId as string) : null;
      let almacenId = params.almacenId
        ? parseInt(params.almacenId as string)
        : null;
      let inventarioData: ProductoAlmacen[] = [];
      let totalDineroReal = 0;
      let totalDineroPromedio = 0;

      if (puntoId) {
        // Cargar datos de un punto específico - ZONA DE ALMACÉN DEL PUNTO (zona_id = 2)
        const puntoData = await PuntoHelper.getById(puntoId);
        if (puntoData) {
          setPuntoActual(puntoData);
          setAlmacenActual(null);

          // 1. Cargar productos del ALMACÉN DEL PUNTO (zona_id = 2)
          inventarioData = await ProductoService.getProductosDeZonaPunto(
            puntoId,
            2, // zona_id = 2 = Almacén del Punto
            200,
          );
          setInventario(inventarioData);

          // 2. Cargar productos en ZONA DE VENTA (zona_id = 1) para estadísticas
          const productosZonaVenta =
            await ProductoService.getProductosDeZonaPunto(puntoId, 1, 200);
          setProductosEnZonaVenta(productosZonaVenta);

          // 3. Calcular estadísticas para ambas zonas
          totalDineroReal =
            await ProductoService.getTotalDineroAlmacenPorPunto(puntoId);
          totalDineroPromedio =
            await ProductoService.getTotalDineroAlmacenPorPuntoPromedio(
              puntoId,
            );

          // 4. Calcular valor por zona
          const valorZonaVenta = productosZonaVenta.reduce(
            (sum: number, p: ProductoAlmacen) => sum + (p.total_costo || 0),
            0,
          );
          const valorAlmacenPunto = inventarioData.reduce(
            (sum: number, p: ProductoAlmacen) => sum + (p.total_costo || 0),
            0,
          );

          setEstadisticasZonas({
            enVenta: productosZonaVenta.length,
            enAlmacenPunto: inventarioData.length,
            valorVenta: valorZonaVenta,
            valorAlmacenPunto: valorAlmacenPunto,
          });
        }
      } else if (almacenId) {
        // Cargar datos de un almacén específico
        const almacenData = await AlmacenesService.getAlmacenById(almacenId);
        if (almacenData) {
          setAlmacenActual(almacenData);
          setPuntoActual(null);

          // Cargar productos del almacén específico
          inventarioData =
            await ProductoService.getProductosEnAlmacenEspecifico(
              almacenId,
              200,
            );
          console.log(
            `📋 Datos cargados para almacén ${almacenId}:`,
            inventarioData.length,
            "productos",
          );
          setInventario(inventarioData);

          // Calcular estadísticas del almacén
          totalDineroReal = await ProductoService.getTotalDineroAlmacen();
          totalDineroPromedio =
            await ProductoService.getTotalDineroAlmacenPromedio();
        }
      } else {
        // Si no hay puntoId ni almacenId, cargar el primer almacén disponible
        console.log(
          "🔍 No se proporcionó puntoId ni almacenId, buscando primer almacén...",
        );

        const almacenesDisponibles =
          await AlmacenesService.getAlmacenesActivos();
        console.log("🏭 Almacenes disponibles:", almacenesDisponibles);

        if (almacenesDisponibles.length > 0) {
          // Usar el primer almacén activo disponible
          const primerAlmacen = almacenesDisponibles[0];
          console.log("📦 Usando primer almacén:", primerAlmacen);

          setAlmacenActual(primerAlmacen);
          setPuntoActual(null);

          // Cargar productos del almacén específico
          inventarioData =
            await ProductoService.getProductosEnAlmacenEspecifico(
              primerAlmacen.id,
            );
          console.log(
            "📦 Productos cargados desde almacén específico:",
            primerAlmacen.nombre,
          );
          setInventario(inventarioData); // Added missing setInventario call

          // Calcular estadísticas del almacén específico
          totalDineroReal =
            await ProductoService.getTotalDineroAlmacenEspecifico(
              primerAlmacen.id,
            );
          totalDineroPromedio =
            await ProductoService.getTotalDineroAlmacenEspecificoPromedio(
              primerAlmacen.id,
            );
        } else {
          // Si no hay almacenes, cargar datos del almacén general
          console.log(
            "🏭 No hay almacenes disponibles, usando almacén general",
          );
          setPuntoActual({
            id: null,
            nombre: "Almacén General",
            tipo_negocio: null,
          });
          setAlmacenActual(null);
          inventarioData = await ProductoService.getProductosEnAlmacen(200);
          setInventario(inventarioData);
          totalDineroReal = await ProductoService.getTotalDineroAlmacen();
          totalDineroPromedio =
            await ProductoService.getTotalDineroAlmacenPromedio();
        }
      }

      // Filtros para alertas - SOLO productos del almacén actual
      let productosParaAlertas = inventarioData;

      console.log("🔍 === DEPURACIÓN DE ALERTAS ===");
      console.log(
        `🔍 Almacén actual: ${almacenActual?.nombre || "Almacén General"}`,
      );
      console.log(
        `🔍 Total de productos en inventarioData: ${inventarioData.length}`,
      );

      // Mostrar primeros 5 productos para ver su estructura
      console.log("🔍 Primeros 5 productos del inventario:");
      inventarioData.slice(0, 5).forEach((producto, index) => {
        console.log(`🔍 [${index}] ${producto.nombre}:`);
        console.log(`   - ubicacion: "${producto.ubicacion}"`);
        console.log(`   - tipo_ubicacion: "${producto.tipo_ubicacion}"`);
        console.log(`   - almacen_id: ${producto.almacen_id}`);
        console.log(`   - estado_vencimiento: ${producto.estado_vencimiento}`);
        console.log(`   - cantidad: ${producto.cantidad}`);
      });

      // Si estamos en un almacén específico, asegurarnos de filtrar solo productos de ese almacén
      if (almacenActual) {
        console.log(
          `🔍 Filtrando alertas para almacén específico: ${almacenActual.nombre} (ID: ${almacenActual.id})`,
        );

        productosParaAlertas = inventarioData.filter((producto) => {
          // Verificar que el producto sea del almacén actual
          const esDelAlmacen =
            producto.ubicacion === almacenActual.nombre ||
            producto.almacen_id === almacenActual.id ||
            (!producto.ubicacion?.includes("Punto") &&
              !producto.ubicacion?.includes("Zona") &&
              !producto.tipo_ubicacion?.includes("Punto"));

          if (
            !esDelAlmacen &&
            (producto.estado_vencimiento === "vencido" ||
              producto.estado_vencimiento === "por_vencer_rojo")
          ) {
            console.log(
              `❌ EXCLUIDO: ${producto.nombre} - ubicacion: "${producto.ubicacion}", tipo: "${producto.tipo_ubicacion}"`,
            );
          }

          return esDelAlmacen;
        });

        console.log(
          `🔍 Productos filtrados para alertas: ${productosParaAlertas.length} de ${inventarioData.length}`,
        );
      } else {
        console.log(
          "🔍 Filtrando alertas para almacén general - excluyendo zonas de venta",
        );

        productosParaAlertas = inventarioData.filter((producto) => {
          // Excluir productos que estén en puntos o zonas de venta
          const esDeAlmacenGeneral =
            !producto.ubicacion?.includes("Punto") &&
            !producto.ubicacion?.includes("Zona") &&
            !producto.tipo_ubicacion?.includes("Punto");

          if (
            !esDeAlmacenGeneral &&
            (producto.estado_vencimiento === "vencido" ||
              producto.estado_vencimiento === "por_vencer_rojo")
          ) {
            console.log(
              `❌ EXCLUIDO: ${producto.nombre} - ubicacion: "${producto.ubicacion}", tipo: "${producto.tipo_ubicacion}"`,
            );
          }

          return esDeAlmacenGeneral;
        });

        console.log(
          `🔍 Productos filtrados para almacén general: ${productosParaAlertas.length} de ${inventarioData.length}`,
        );
      }

      const vencidosData = productosParaAlertas.filter(
        (producto) => producto.estado_vencimiento === "vencido",
      );
      setProductosVencidos(vencidosData);

      const porVencerData = productosParaAlertas.filter(
        (producto) => producto.estado_vencimiento === "por_vencer_rojo",
      );
      setProductosPorVencer(porVencerData);

      const stockBajoData = productosParaAlertas.filter(
        (producto) => producto.cantidad > 0 && producto.cantidad <= 10,
      );
      setProductosStockBajo(stockBajoData);

      console.log(`🔍 === RESULTADO DE ALERTAS ===`);
      console.log(`🔍 Productos vencidos: ${vencidosData.length}`);
      vencidosData.forEach((p) =>
        console.log(`   - ${p.nombre}: ${p.ubicacion}`),
      );
      console.log(`🔍 Productos por vencer: ${porVencerData.length}`);
      porVencerData.forEach((p) =>
        console.log(`   - ${p.nombre}: ${p.ubicacion}`),
      );
      console.log(`🔍 ================================`);

      // Obtener categorías únicas (normalizadas)
      const categorias = inventarioData
        .map((p) => p.categoria?.trim())
        .filter((cat) => cat && cat.length > 0);

      // Eliminar duplicados usando case-insensitive y trim
      const categoriasNormalizadas = new Map();
      categorias.forEach((cat) => {
        const key = cat.toLowerCase();
        if (!categoriasNormalizadas.has(key)) {
          categoriasNormalizadas.set(key, cat); // Guardar el formato original
        }
      });

      const categoriasUnicas = Array.from(categoriasNormalizadas.values());

      setEstadisticas({
        totalDineroAlmacen: totalDineroReal,
        totalDineroAlmacenPromedio: totalDineroPromedio,
        totalProductos: inventarioData.length,
        productosConStock: inventarioData.filter((p) => p.cantidad > 0).length,
        productosSinStock: inventarioData.filter((p) => p.cantidad <= 0).length,
        productosVencidos: vencidosData.length,
        productosPorVencerRojo: porVencerData.length,
        productosPorVencerNaranja: inventarioData.filter(
          (p) => p.estado_vencimiento === "por_vencer_naranja",
        ).length,
        productosSeguros: inventarioData.filter(
          (p) => p.estado_vencimiento === "seguro",
        ).length,
        categoriasUnicas: categoriasUnicas,
      });
    } catch (error) {
      console.error("Error cargando datos del almacén:", error);
      Alert.alert("Error", "No se pudieron cargar los datos del almacén");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.puntoId, params.almacenId, almacenActual]);

  const cargarPuntosDestino = useCallback(async () => {
    try {
      // Cargar todos los puntos
      const todosPuntos = await PuntoHelper.getAll();

      // Cargar todos los almacenes
      const todosAlmacenes = await AlmacenesService.getAllAlmacenes();

      console.log("=== DEBUG CARGAR PUNTOS DESTINO ===");
      console.log("Total de puntos recuperados:", todosPuntos.length);
      console.log("Total de almacenes recuperados:", todosAlmacenes.length);

      if (almacenActual) {
        // Si estamos en un almacén específico, mostrar todos los puntos como destino
        console.log("Desde almacén específico - mostrando todos los puntos");
        setPuntosDestino(todosPuntos);
        // Y otros almacenes (excepto el actual) para transferencias normales
        const almacenesFiltrados = todosAlmacenes.filter(
          (a) => a.id !== almacenActual.id,
        );
        console.log(
          "Almacenes destino (desde almacen):",
          almacenesFiltrados.length,
        );
        console.log(
          "Almacenes destino (desde almacen):",
          JSON.stringify(almacenesFiltrados, null, 2),
        );
        setAlmacenesDestino(almacenesFiltrados);
        // Para transferencias, también usar almacenes filtrados (excluyendo actual)
        setAlmacenesParaTransferencia(almacenesFiltrados);
        // Para correcciones, mostrar TODOS los almacenes (incluyendo el actual)
        console.log("🔍 Cargando almacenes para corrección...");
        console.log(
          "🔍 Total de almacenes disponibles:",
          todosAlmacenes.length,
        );
        setAlmacenesParaCorreccion(todosAlmacenes);
        console.log(
          "🔍 Almacenes para corrección establecidos:",
          todosAlmacenes.map((a) => ({ id: a.id, nombre: a.nombre })),
        );
      } else if (puntoActual) {
        // Si es almacén general (sin tipo), mostrar todos los puntos
        if (!puntoActual.tipo_negocio) {
          console.log(
            "Desde punto sin tipo - mostrando todos los puntos excepto el actual",
          );
          const puntosFiltrados = todosPuntos.filter(
            (p) => p.id !== puntoActual.id,
          );
          console.log(
            "Puntos filtrados (punto sin tipo):",
            puntosFiltrados.length,
          );
          console.log(
            "Puntos filtrados (punto sin tipo):",
            JSON.stringify(puntosFiltrados, null, 2),
          );
          setPuntosDestino(puntosFiltrados);
          // Y todos los almacenes
          console.log(
            "Almacenes destino (desde punto sin tipo):",
            todosAlmacenes,
          );
          setAlmacenesDestino(todosAlmacenes);
          // Para transferencias, excluir el almacén actual si estamos en un almacén específico
          if (almacenActual) {
            const almacenesFiltrados = todosAlmacenes.filter(
              (a) => a.id !== almacenActual.id,
            );
            setAlmacenesParaTransferencia(almacenesFiltrados);
          } else {
            setAlmacenesParaTransferencia(todosAlmacenes);
          }
        } else {
          // Si es un punto específico, mostrar todos los otros puntos como destino
          // (excepto el punto actual para evitar transferirse a sí mismo)
          const puntosFiltrados = todosPuntos.filter(
            (p) => p.id !== puntoActual.id,
          );
          console.log("=== PUNTO CON TIPO ===");
          console.log("Punto actual ID:", puntoActual.id);
          console.log(
            "Puntos filtrados (excluyendo punto actual):",
            puntosFiltrados.length,
          );
          console.log(
            "Puntos filtrados (excluyendo punto actual):",
            JSON.stringify(puntosFiltrados, null, 2),
          );
          setPuntosDestino(puntosFiltrados);
          // Y todos los almacenes
          console.log(
            "Almacenes destino (desde punto con tipo):",
            todosAlmacenes,
          );
          setAlmacenesDestino(todosAlmacenes);
          // Para transferencias, excluir el almacén actual si estamos en un almacén específico
          if (almacenActual) {
            const almacenesFiltrados = todosAlmacenes.filter(
              (a) => a.id !== almacenActual.id,
            );
            setAlmacenesParaTransferencia(almacenesFiltrados);
          } else {
            setAlmacenesParaTransferencia(todosAlmacenes);
          }
        }
      } else {
        // Almacén general
        console.log("=== CASO GENERAL ===");
        console.log("Caso general - mostrando todos los puntos");
        console.log("Total puntos a mostrar:", todosPuntos.length);
        setPuntosDestino(todosPuntos);
        console.log("Almacenes destino (general):", todosAlmacenes);
        setAlmacenesDestino(todosAlmacenes);
        // Para transferencias, excluir el almacén actual si estamos en un almacén específico
        if (almacenActual) {
          const almacenesFiltrados = todosAlmacenes.filter(
            (a) => a.id !== almacenActual.id,
          );
          setAlmacenesParaTransferencia(almacenesFiltrados);
        } else {
          setAlmacenesParaTransferencia(todosAlmacenes);
        }
      }

      // Debug final state after a short delay to see if state updates correctly
      setTimeout(() => {
        console.log("=== ESTADO FINAL DESPUÉS DE SET STATE ===");
        console.log("puntosDestino.length:", puntosDestino.length);
        console.log("puntosDestino:", JSON.stringify(puntosDestino, null, 2));
      }, 100);
    } catch (error) {
      console.error("Error cargando puntos y almacenes destino:", error);
      setPuntosDestino([]);
      setAlmacenesDestino([]);
    }
  }, [puntoActual, almacenActual]);

  useEffect(() => {
    cargarDatosIniciales();
  }, [params.puntoId, params.almacenId]);

  useEffect(() => {
    if (puntoActual || almacenActual) {
      cargarPuntosDestino();
    }
  }, [puntoActual, almacenActual, cargarPuntosDestino]);

  // Cargar historial cuando se abre el modal
  useEffect(() => {
    console.log("🔍 DEBUG useEffect - modalHistorial:", modalHistorial);
    console.log("🔍 DEBUG useEffect - historialFiltros:", historialFiltros);

    if (modalHistorial) {
      console.log("🚀 DEBUG - Abriendo modal de historial, cargando datos...");
      // Cargar historial directamente sin diagnóstico
      cargarHistorial(historialFiltros);
    }
  }, [modalHistorial, historialFiltros]);

  // Cargar fórmulas cuando se abre el modal principal
  useEffect(() => {
    if (mostrarModalFormula) {
      cargarFormulasExistentes();
    }
  }, [mostrarModalFormula]);

  const inventarioFiltrado = useMemo(() => {
    let filtrados = inventario.filter((producto) => {
      if (
        searchQuery &&
        !producto.nombre.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (
        categoriaFiltro !== "todos" &&
        producto.categoria?.trim().toLowerCase() !==
          categoriaFiltro.trim().toLowerCase()
      ) {
        return false;
      }

      if (stockFiltro === "bajo" && producto.cantidad > 10) {
        return false;
      }
      if (
        stockFiltro === "normal" &&
        (producto.cantidad <= 10 || producto.cantidad <= 0)
      ) {
        return false;
      }

      if (
        fechaFiltro === "vencidos" &&
        producto.estado_vencimiento !== "vencido"
      ) {
        return false;
      }
      if (
        fechaFiltro === "por_vencer" &&
        !["por_vencer_rojo", "por_vencer_naranja"].includes(
          producto.estado_vencimiento || "",
        )
      ) {
        return false;
      }

      if (producto.cantidad <= 0) {
        return false;
      }

      return true;
    });

    filtrados.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (ordenarPor) {
        case "nombre":
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
          break;
        case "cantidad":
          aValue = a.cantidad;
          bValue = b.cantidad;
          break;
        case "precio":
          aValue = a.precio_coste;
          bValue = b.precio_coste;
          break;
        case "fecha":
          aValue = a.fecha_caducidad
            ? new Date(a.fecha_caducidad).getTime()
            : Infinity;
          bValue = b.fecha_caducidad
            ? new Date(b.fecha_caducidad).getTime()
            : Infinity;
          break;
        default:
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
      }

      if (aValue < bValue) return ordenAscendente ? -1 : 1;
      if (aValue > bValue) return ordenAscendente ? 1 : -1;
      return 0;
    });

    return filtrados;
  }, [
    inventario,
    searchQuery,
    categoriaFiltro,
    stockFiltro,
    fechaFiltro,
    ordenarPor,
    ordenAscendente,
  ]);

  // Función para agrupar productos por nombre y fecha de caducidad
  const inventarioAgrupado = useMemo(() => {
    const grupos: { [key: string]: ProductoAlmacen[] } = {};

    inventarioFiltrado.forEach((producto) => {
      // Crear clave única con nombre y fecha de caducidad
      const clave = `${producto.nombre.toLowerCase()}_${producto.fecha_caducidad || "sin_fecha"}`;

      if (!grupos[clave]) {
        grupos[clave] = [];
      }
      grupos[clave].push(producto);
    });

    // Convertir a array y procesar cada grupo
    return Object.values(grupos).map((grupo) => {
      if (grupo.length === 1) {
        // Producto único, calcular cantidad general por nombre
        const cantidadGeneral = inventarioFiltrado
          .filter(
            (p) => p.nombre.toLowerCase() === grupo[0].nombre.toLowerCase(),
          )
          .reduce((sum, p) => sum + p.cantidad, 0);

        return {
          ...grupo[0],
          cantidadGeneral:
            cantidadGeneral > grupo[0].cantidad ? cantidadGeneral : undefined,
          esGrupo: false,
        };
      } else {
        // Múltiples productos con mismo nombre y fecha - agrupar
        const productoAgrupado = {
          ...grupo[0],
          cantidad: grupo.reduce((sum, p) => sum + p.cantidad, 0),
          total_costo: grupo.reduce((sum, p) => sum + p.total_costo, 0),
          ids: grupo.map((p) => p.id),
          esGrupo: true,
          productosOriginales: grupo,
        };
        return productoAgrupado;
      }
    });
  }, [inventarioFiltrado]);

  // Función para obtener cantidad general por nombre de producto
  const getCantidadGeneral = useCallback(
    (nombre: string): number => {
      return inventarioFiltrado
        .filter((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
        .reduce((sum, p) => sum + p.cantidad, 0);
    },
    [inventarioFiltrado],
  );

  const formatMoneda = (monto: number) => {
    return ProductoService.formatMoneda(monto);
  };

  const formatFecha = (fechaString: string | null | undefined): string => {
    if (!fechaString) return "Sin fecha";
    try {
      const fecha = new Date(fechaString);
      return fecha.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      return fechaString;
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setFormFechaCaducidad(date.toISOString().split("T")[0]);
    }
  };

  const getColorFecha = (producto: ProductoAlmacen) => {
    return ProductoService.getColorVencimiento(producto.estado_vencimiento);
  };

  const getColorStock = (cantidad: number) => {
    if (cantidad <= 0) return "#ef4444";
    if (cantidad <= 10) return "#f59e0b";
    return "#10b981";
  };

  const transferirDirectoAlmacenPunto = async () => {
    if (!productoSeleccionado || !puntoDestino || !cantidadTransferencia) {
      Alert.alert("Error", "Complete la cantidad y seleccione un punto");
      return;
    }

    const cantidad = parseInt(cantidadTransferencia);

    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert("Error", "Cantidad inválida");
      return;
    }

    if (cantidad > productoSeleccionado.cantidad) {
      Alert.alert(
        "Error",
        `Stock insuficiente. Disponible: ${productoSeleccionado.cantidad}`,
      );
      return;
    }

    try {
      const puntoDestinoData = puntosDestino.find((p) => p.id === puntoDestino);

      Alert.alert(
        "Confirmar Transferencia",
        `¿Transferir ${cantidad} unidades de "${productoSeleccionado.nombre}" al Almacén del Punto "${puntoDestinoData?.nombre}"?\n\n` +
          `• Solo se transferirá como stock de respaldo\n` +
          `• No estará disponible para venta inmediata\n` +
          `• Valor transferido: ${formatMoneda((productoSeleccionado.precio_coste_real || productoSeleccionado.precio_coste) * cantidad)}`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Transferir",
            onPress: async () => {
              const result = await ProductoService.transferirAlmacenAZona({
                productoId: productoSeleccionado.id,
                puntoId: puntoDestino!,
                cantidad: cantidad,
                precioVenta: 0,
                zonaId: 2,
              });

              if (result.success) {
                Alert.alert("Éxito", result.message);
                setModalTransferencia(false);
                resetFormularios();
                cargarDatosIniciales();
              } else {
                Alert.alert("Error", result.message);
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo realizar la transferencia");
    }
  };

  const abrirModalTransferencia = (producto: ProductoAlmacen) => {
    setProductoSeleccionado(producto);
    setTipoCantidadTransferencia("unidades"); // Reiniciar a unidades por defecto
    setModalTransferencia(true);
  };

  const transferirAAlmacen = async () => {
    console.log("🚀 FUNCIÓN transferirAAlmacen LLAMADA");
    console.log("📦 productoSeleccionado:", productoSeleccionado);
    console.log("📦 almacenDestino:", almacenDestino);
    console.log("📦 cantidadTransferencia:", cantidadTransferencia);
    console.log("📦 tipoCantidadTransferencia:", tipoCantidadTransferencia);

    if (!productoSeleccionado || !almacenDestino || !cantidadTransferencia) {
      console.log("❌ Validación fallida: campos incompletos");
      Alert.alert("Error", "Complete todos los campos requeridos");
      return;
    }

    let cantidadNumerica = parseInt(cantidadTransferencia);
    let unidadesTransferir;

    if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
      Alert.alert("Error", "Cantidad inválida");
      return;
    }

    // Calcular unidades reales a transferir
    if (tipoCantidadTransferencia === "unidades") {
      unidadesTransferir = cantidadNumerica;
    } else {
      // Validar que el producto tenga el formato seleccionado
      const formatoProducto = productoSeleccionado.formato_almacen;
      const formatoSeleccionado =
        tipoCantidadTransferencia === "cajas"
          ? "cajas"
          : tipoCantidadTransferencia === "blisters"
            ? "blisters"
            : tipoCantidadTransferencia; // Usar el valor directamente para cualquier otro formato

      // Normalizar formatos para comparación (manejar singular/plural)
      const formatoProductoNormalizado = formatoProducto?.toLowerCase();
      const formatoSeleccionadoNormalizado = formatoSeleccionado.toLowerCase();

      // Verificar si el formato coincide (permitir cualquier formato)
      const formatoValido =
        formatoProductoNormalizado === formatoSeleccionadoNormalizado;

      if (!formatoValido || !productoSeleccionado.unidades_por_formato) {
        Alert.alert(
          "Error de formato",
          `Este producto no tiene formato de ${formatoSeleccionado} configurado.\n\n` +
            `Formato del producto: ${formatoProducto || "Sin formato"}\n` +
            `Unidades por formato: ${productoSeleccionado.unidades_por_formato || "No configurado"}`,
        );
        return;
      }

      unidadesTransferir =
        cantidadNumerica * productoSeleccionado.unidades_por_formato;
    }

    if (unidadesTransferir > productoSeleccionado.cantidad) {
      Alert.alert(
        "Error",
        `Stock insuficiente. Disponible: ${productoSeleccionado.cantidad} unidades`,
      );
      return;
    }

    const almacenDestinoData = almacenesDestino.find(
      (a) => a.id === almacenDestino,
    );

    const mensajeConfirmacion =
      tipoCantidadTransferencia === "unidades"
        ? `¿Transferir ${cantidadNumerica} unidades de "${productoSeleccionado.nombre}" al almacén "${almacenDestinoData?.nombre}"?\n\n` +
          `• Valor transferido: ${formatMoneda((productoSeleccionado.precio_coste_real || productoSeleccionado.precio_coste) * unidadesTransferir)}`
        : `¿Transferir ${cantidadNumerica} ${
            tipoCantidadTransferencia === "cajas"
              ? "caja" + (cantidadNumerica !== 1 ? "s" : "")
              : tipoCantidadTransferencia === "blisters"
                ? "blister" + (cantidadNumerica !== 1 ? "s" : "")
                : "paquete" + (cantidadNumerica !== 1 ? "s" : "")
          } (${unidadesTransferir} unidades) de "${productoSeleccionado.nombre}" al almacén "${almacenDestinoData?.nombre}"?\n\n` +
          `• Valor transferido: ${formatMoneda((productoSeleccionado.precio_coste_real || productoSeleccionado.precio_coste) * unidadesTransferir)}`;

    Alert.alert("Confirmar Transferencia", mensajeConfirmacion, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Transferir",
        onPress: async () => {
          console.log("🎯 BOTÓN TRANSFERIR PRESIONADO");
          try {
            // Determinar el almacén origen según el contexto actual
            let almacenOrigenId;
            if (almacenActual?.id) {
              // Transferencia desde almacén específico
              almacenOrigenId = almacenActual.id;
              console.log("📂 Origen: almacén específico ID:", almacenOrigenId);
            } else if (puntoActual?.id) {
              // Transferencia desde almacén de punto (zona_id = 2)
              console.log("📂 Origen: almacén de punto - BLOQUEADO");
              // Para transferencias desde punto, usamos una función diferente
              Alert.alert(
                "Error",
                "No se puede transferir desde almacén de punto a otro almacén",
              );
              return;
            } else {
              // Transferencia desde almacén general (no tiene almacen_id específico)
              almacenOrigenId = null; // Indica que es del almacén general
              console.log("📂 Origen: almacén general");
            }

            console.log(
              "🔄 LLAMANDO A AlmacenService.transferirEntreAlmacenes...",
            );
            const result = await AlmacenService.transferirEntreAlmacenes(
              productoSeleccionado.id,
              almacenOrigenId,
              almacenDestino,
              unidadesTransferir,
            );
            console.log(" RESULTADO TRANSFERENCIA:", result);
            if (result.success) {
              Alert.alert("Éxito", result.message);
              setModalTransferencia(false);
              resetFormularios();
              cargarDatosIniciales();
            } else {
              console.error(" ERROR EN TRANSFERENCIA:", result);
              Alert.alert("Error", result.message);
            }
          } catch (error) {
            Alert.alert("Error", "No se pudo realizar la transferencia");
          }
        },
      },
    ]);
  };

  const transferirProducto = async (destinoZona: number = 1) => {
    if (!productoSeleccionado || !puntoDestino || !cantidadTransferencia) {
      Alert.alert("Error", "Complete todos los campos requeridos");
      return;
    }

    let cantidadNumerica = parseInt(cantidadTransferencia);
    let unidadesTransferir;

    if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
      Alert.alert("Error", "Cantidad inválida");
      return;
    }

    // Calcular unidades reales a transferir
    if (tipoCantidadTransferencia === "unidades") {
      unidadesTransferir = cantidadNumerica;
    } else {
      // Validar que el producto tenga el formato seleccionado
      const formatoProducto = productoSeleccionado.formato_almacen;
      const formatoSeleccionado =
        tipoCantidadTransferencia === "cajas"
          ? "cajas"
          : tipoCantidadTransferencia === "blisters"
            ? "blisters"
            : tipoCantidadTransferencia; // Usar el valor directamente para cualquier otro formato

      // Normalizar formatos para comparación (manejar singular/plural)
      const formatoProductoNormalizado = formatoProducto?.toLowerCase();
      const formatoSeleccionadoNormalizado = formatoSeleccionado.toLowerCase();

      // Verificar si el formato coincide (permitir cualquier formato)
      const formatoValido =
        formatoProductoNormalizado === formatoSeleccionadoNormalizado;

      if (!formatoValido || !productoSeleccionado.unidades_por_formato) {
        Alert.alert(
          "Error de formato",
          `Este producto no tiene formato de ${formatoSeleccionado} configurado.\n\n` +
            `Formato del producto: ${formatoProducto || "Sin formato"}\n` +
            `Unidades por formato: ${productoSeleccionado.unidades_por_formato || "No configurado"}`,
        );
        return;
      }

      unidadesTransferir =
        cantidadNumerica * productoSeleccionado.unidades_por_formato;
    }

    if (unidadesTransferir > productoSeleccionado.cantidad) {
      Alert.alert(
        "Error",
        `Stock insuficiente. Disponible: ${productoSeleccionado.cantidad} unidades`,
      );
      return;
    }

    if (destinoZona === 1) {
      if (!precioVenta) {
        Alert.alert("Error", "Para zona de venta se requiere precio de venta");
        return;
      }

      const precio = parseFloat(precioVenta);
      if (isNaN(precio) || precio <= 0) {
        Alert.alert("Error", "Precio de venta inválido");
        return;
      }

      const precioCostoReal =
        productoSeleccionado.precio_coste_real ||
        productoSeleccionado.precio_coste;
      const precioMaximo = calcularPrecioMaximo(precioCostoReal);

      if (precio > precioMaximo) {
        Alert.alert(
          "Advertencia",
          `El precio de venta (${formatMoneda(precio)}) excede el precio máximo sugerido (${formatMoneda(precioMaximo)}).\n\n` +
            `• Precio costo real: ${formatMoneda(precioCostoReal)}\n` +
            `• Precio máximo (mantiene 30% de margen): ${formatMoneda(precioMaximo)}\n\n` +
            `¿Desea continuar?`,
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Continuar",
              onPress: () =>
                realizarTransferencia(unidadesTransferir, precio, destinoZona),
            },
          ],
        );
        return;
      }

      realizarTransferencia(unidadesTransferir, precio, destinoZona);
    } else {
      transferirDirectoAlmacenPunto();
    }
  };

  const realizarTransferencia = async (
    cantidad: number,
    precio: number,
    zonaDestino: number,
  ) => {
    try {
      const puntoDestinoData = puntosDestino.find((p) => p.id === puntoDestino);
      const precioCostoReal =
        productoSeleccionado!.precio_coste_real ||
        productoSeleccionado!.precio_coste;
      const gananciaEstimada = (precio - precioCostoReal) * cantidad;

      const destinoTexto =
        zonaDestino === 1 ? "Zona de Venta" : "Almacén del Punto";

      Alert.alert(
        "Confirmar Transferencia",
        `¿Transferir ${cantidad} unidades de "${productoSeleccionado!.nombre}" a ${destinoTexto} de ${puntoDestinoData?.nombre}?\n\n` +
          `• Precio venta: ` +
          formatMoneda(precio) +
          ` c/u\n` +
          `• Precio costo real: ` +
          formatMoneda(precioCostoReal) +
          ` c/u\n` +
          `• Ganancia unitaria: ` +
          formatMoneda(precio - precioCostoReal) +
          `\n` +
          `• Ganancia total: ` +
          formatMoneda(gananciaEstimada),
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Transferir",
            onPress: async () => {
              // Determinar el origen de la transferencia
              let requestParams: any = {
                productoId: productoSeleccionado!.id,
                puntoId: puntoDestino!,
                cantidad: cantidad,
                precioVenta: precio,
                zonaId: zonaDestino,
              };
              if (puntoActual?.id) {
                requestParams.puntoIdOrigen = puntoActual.id;
              }
              // Caso 2: Transferencia desde almacén específico
              else if (almacenActual?.id) {
                console.log(
                  " Iniciando transferencia desde almacén específico:",
                  {
                    almacenOrigenId: almacenActual.id,
                    productoId: productoSeleccionado!.id,
                    puntoDestino: puntoDestino!,
                    cantidad: cantidad,
                    precioVenta: precio,
                    zonaDestino: zonaDestino,
                  },
                );

                const result =
                  await ProductoService.transferirAlmacenEspecificoAZona({
                    productoId: productoSeleccionado!.id,
                    almacenOrigenId: almacenActual.id,
                    puntoId: puntoDestino!,
                    cantidad: cantidad,
                    precioVenta: precio,
                    zonaId: zonaDestino,
                  });

                console.log(
                  " Resultado transferencia almacén específico:",
                  result,
                );

                if (result.success) {
                  console.log(" Transferencia exitosa, actualizando datos...");
                  Alert.alert("Éxito", result.message);
                  setModalTransferencia(false);
                  resetFormularios();
                  cargarDatosIniciales();
                } else {
                  console.log(" Error en transferencia:", result.message);
                  Alert.alert("Error", result.message);
                }
                return;
              }
              // Caso 3: Transferencia desde almacén general (no hacer nada especial)

              const result =
                await ProductoService.transferirAlmacenAZona(requestParams);

              if (result.success) {
                Alert.alert("Éxito", result.message);
                setModalTransferencia(false);
                resetFormularios();
                cargarDatosIniciales();
              } else {
                Alert.alert("Error", result.message);
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo realizar la transferencia");
    }
  };

  const moverAZonaVenta = async (producto: ProductoAlmacen) => {
    const precioVentaActual = (producto as any).precio_venta || 0;
    const result = await ProductoService.transferirAlmacenAZona({
      productoId: producto.id,
      puntoId: puntoActual!.id,
      cantidad: producto.cantidad,
      precioVenta: precioVentaActual,
    });

    if (result.success) {
      Alert.alert("Éxito", result.message);
      cargarDatosIniciales();
    } else {
      Alert.alert("Error", result.message);
    }
  };

  const moverAAlmacenPunto = async (producto: ProductoAlmacen) => {
    Alert.alert(
      "Mover a Almacén del Punto",
      `¿Mover ${producto.cantidad} unidades de "${producto.nombre}" a Almacén del Punto (stock de respaldo)?\n\n` +
        `• Ya no estará disponible para venta inmediata\n` +
        `• Puede moverse de nuevo a venta después`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Mover",
          onPress: async () => {
            const result = await ProductoService.transferirAlmacenAZona({
              productoId: producto.id,
              puntoId: puntoActual!.id,
              cantidad: producto.cantidad,
              precioVenta: 0,
            });

            if (result.success) {
              Alert.alert("Éxito", result.message);
              cargarDatosIniciales();
            } else {
              Alert.alert("Error", result.message);
            }
          },
        },
      ],
    );
  };

  const ajustarStock = async () => {
    if (!productoSeleccionado || !ajusteCantidad) {
      Alert.alert("Error", "Complete la cantidad");
      return;
    }

    const cantidad = parseInt(ajusteCantidad);

    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert("Error", "Cantidad inválida");
      return;
    }

    if (ajusteTipo === "salida" && cantidad > productoSeleccionado.cantidad) {
      Alert.alert(
        "Error",
        `Cantidad insuficiente. Stock disponible: ${productoSeleccionado.cantidad}`,
      );
      return;
    }

    try {
      Alert.alert(
        "Confirmar Ajuste",
        `¿Registrar ${ajusteTipo === "entrada" ? "entrada" : "salida"} de ${cantidad} unidades de "${productoSeleccionado.nombre}"?\n\n` +
          `Stock actual: ${productoSeleccionado.cantidad} unidades\n` +
          `Nuevo stock: ${productoSeleccionado.cantidad + cantidad * (ajusteTipo === "entrada" ? 1 : -1)} unidades`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Ajustar",
            onPress: async () => {
              try {
                // Convertir ajusteTipo a delta para el sistema centralizado
                const delta = ajusteTipo === "entrada" ? cantidad : -cantidad;

                if (puntoActual?.id) {
                  // Usar la función específica para puntos
                  resultado = await ProductoService.updateCantidadPunto(
                    productoSeleccionado.id,
                    puntoActual.id,
                    Math.abs(delta), // Usar el valor absoluto del delta
                    "add", // Siempre usamos "add" y el delta se calcula arriba
                  );
                } else if (almacenActual?.id) {
                  // Usar la función específica para almacenes específicos
                  resultado =
                    await ProductoService.updateCantidadAlmacenEspecifico(
                      productoSeleccionado.id,
                      almacenActual.id,
                      Math.abs(delta), // Usar el valor absoluto del delta
                      "add", // Siempre usamos "add" y el delta se calcula arriba
                    );
                } else {
                  resultado = await ProductoService.updateCantidadAlmacen(
                    productoSeleccionado.id,
                    Math.abs(delta), // Usar el valor absoluto del delta
                    "add", // Siempre usamos "add" y el delta se calcula arriba
                  );
                }

                if (resultado.success) {
                  Alert.alert("Éxito", "Stock ajustado correctamente");
                  setModalAjusteStock(false);
                  resetFormularios();
                  cargarDatosIniciales();
                } else {
                  Alert.alert("Error", resultado.message);
                }
              } catch (error) {
                Alert.alert("Error", "No se pudo ajustar el stock");
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo ajustar el stock");
    }
  };

  const guardarProducto = async () => {
    if (
      !formNombre.trim() ||
      !formCategoria.trim() ||
      !formPrecioCoste ||
      !formCantidad ||
      !formFechaCaducidad ||
      (formTipoProducto === "insumo" && !formCostoInsumo)
    ) {
      Alert.alert(
        "Error",
        formTipoProducto === "insumo"
          ? "Complete todos los campos requeridos (Nombre, Categoría, Costo del Insumo, Cantidad, Fecha Caducidad)"
          : "Complete todos los campos requeridos (Nombre, Categoría, Precio Coste, Cantidad, Fecha Caducidad)",
      );
      return;
    }

    // Validar campos de formato si se seleccionó un formato
    if (formFormatoAlmacen && !formUnidadesPorFormato) {
      const label = getFormatLabel(formFormatoAlmacen, false);

      Alert.alert(
        "Error",
        `Si selecciona un formato de almacenamiento, debe especificar cuántas unidades contiene cada ${label}`,
      );
      return;
    }

    const precioCoste = parseFloat(formPrecioCoste);
    const cantidad = parseInt(formCantidad);
    const unidadesPorFormato = formUnidadesPorFormato
      ? parseFloat(formUnidadesPorFormato)
      : undefined;

    if (isNaN(precioCoste) || precioCoste <= 0) {
      Alert.alert("Error", "Precio de coste inválido");
      return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert("Error", "Cantidad inválida");
      return;
    }

    if (
      unidadesPorFormato !== undefined &&
      (isNaN(unidadesPorFormato) || unidadesPorFormato <= 0)
    ) {
      Alert.alert("Error", "Unidades por formato inválidas");
      return;
    }

    // Validar costo del insumo si es tipo insumo
    if (formTipoProducto === "insumo") {
      const costoInsumo = parseFloat(formCostoInsumo);
      if (isNaN(costoInsumo) || costoInsumo <= 0) {
        Alert.alert("Error", "Costo del insumo inválido");
        return;
      }
    }

    if (!formFechaCaducidad) {
      Alert.alert("Error", "Debe seleccionar una fecha de caducidad");
      return;
    }

    try {
      if (formModoEdicion && productoSeleccionado) {
        console.log(
          "🔄 INICIANDO EDICIÓN DE PRODUCTO:",
          productoSeleccionado.id,
        );
        const fechaCaducidadFinal = formFechaCaducidad || undefined;

        // 1. Actualizar el producto
        console.log("📝 Actualizando datos del producto...");
        await ProductoService.updateProducto(
          productoSeleccionado.id,
          formNombre,
          formCategoria,
          formSubcategoria,
          precioCoste,
          fechaCaducidadFinal,
          formFormatoAlmacen,
          unidadesPorFormato,
          formDescripcion,
        );
        console.log("✅ Producto actualizado en la base de datos");

        // 2. Actualizar la cantidad
        console.log("📦 Actualizando cantidad...");
        if (puntoActual?.id) {
          // Si estamos en un punto específico, actualizar en AlmacenZona zona_id = 2
          console.log(`📍 Actualizando cantidad en punto ${puntoActual.id}`);
          const resultadoCantidad = await ProductoService.updateCantidadPunto(
            productoSeleccionado.id,
            puntoActual.id,
            cantidad,
            "set",
          );
          if (!resultadoCantidad.success) {
            console.error(
              "❌ Error actualizando cantidad en punto:",
              resultadoCantidad.message,
            );
            Alert.alert("Error", resultadoCantidad.message);
            return;
          }
          console.log("✅ Cantidad actualizada en punto");
        } else if (almacenActual?.id) {
          // Si estamos en un almacén específico, actualizar en AlmacenProducto
          console.log(
            `🏪 Actualizando cantidad en almacén específico ${almacenActual.id}`,
          );
          const resultadoCantidad =
            await ProductoService.updateCantidadAlmacenEspecifico(
              productoSeleccionado.id,
              almacenActual.id,
              cantidad,
              "set",
            );
          if (!resultadoCantidad.success) {
            console.error(
              "❌ Error actualizando cantidad en almacén específico:",
              resultadoCantidad.message,
            );
            Alert.alert("Error", resultadoCantidad.message);
            return;
          }
          console.log("✅ Cantidad actualizada en almacén específico");
        } else {
          console.log("🏪 Actualizando cantidad en almacén general");
          const resultadoCantidad = await ProductoService.updateCantidadAlmacen(
            productoSeleccionado.id,
            cantidad,
            "set",
          );
          if (!resultadoCantidad.success) {
            console.error(
              "❌ Error actualizando cantidad en almacén:",
              resultadoCantidad.message,
            );
            Alert.alert("Error", resultadoCantidad.message);
            return;
          }
          console.log("✅ Cantidad actualizada en almacén");
        }

        console.log("🎉 Edición completada exitosamente");
        Alert.alert("Éxito", "Producto actualizado correctamente");
        setModalProductoForm(false);
        resetFormulariosProducto();
        // Forzar recarga completa para mostrar datos actualizados en las cards
        await cargarDatosIniciales();
      } else {
        // MODO CREACIÓN - Verificar si existe producto con mismo nombre y fecha
        const productoExistente = inventario.find(
          (p) =>
            p.nombre.toLowerCase() === formNombre.trim().toLowerCase() &&
            p.fecha_caducidad === formFechaCaducidad,
        );

        if (productoExistente && !formModoAgregarSimilar) {
          // Si existe producto con mismo nombre y fecha y NO estamos en modo añadir similar, preguntar
          Alert.alert(
            "Producto Existente",
            `Ya existe un producto con el nombre "${formNombre}" y la misma fecha de caducidad.\n\n` +
              `¿Desea agregar las ${cantidad} unidades al producto existente en lugar de crear uno nuevo?`,
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Agregar al existente",
                onPress: async () => {
                  try {
                    let resultado;
                    if (puntoActual?.id) {
                      resultado = await ProductoService.updateCantidadPunto(
                        productoExistente.id,
                        puntoActual.id,
                        cantidad,
                        "add",
                      );
                    } else if (almacenActual?.id) {
                      // Usar la función específica para almacenes específicos
                      resultado =
                        await ProductoService.updateCantidadAlmacenEspecifico(
                          productoExistente.id,
                          almacenActual.id,
                          cantidad,
                          "add",
                        );
                    } else {
                      resultado = await ProductoService.updateCantidadAlmacen(
                        productoExistente.id,
                        cantidad,
                        "add",
                      );
                    }

                    if (resultado.success) {
                      Alert.alert(
                        "Éxito",
                        `Se agregaron ${cantidad} unidades al producto existente`,
                      );
                      setModalProductoForm(false);
                      resetFormulariosProducto();
                      // Forzar recarga completa para mostrar datos actualizados en las cards
                      await cargarDatosIniciales();
                    } else {
                      Alert.alert("Error", resultado.message);
                    }
                  } catch (error) {
                    console.error("Error agregando cantidad:", error);
                    Alert.alert(
                      "Error",
                      "No se pudo agregar la cantidad al producto existente",
                    );
                  }
                },
              },
              {
                text: "Crear nuevo",
                onPress: async () => {
                  await crearNuevoProducto();
                },
              },
            ],
          );
        } else {
          // Si no existe producto O estamos en modo añadir similar, crear nuevo directamente
          await crearNuevoProducto();
        }
      }
    } catch (error) {
      console.error(" ERROR GENERAL en guardarProducto:", error);

      // Si estamos en modo edición, mostrar error específico
      if (formModoEdicion && productoSeleccionado) {
        console.error(" Error específico en edición:", error);
        Alert.alert(
          "Error al editar producto",
          `No se pudo actualizar el producto: ${error instanceof Error ? error.message : "Error desconocido"}`,
        );
      } else {
        console.error(" Error específico en creación:", error);
        Alert.alert(
          "Error al crear producto",
          `No se pudo crear el producto: ${error instanceof Error ? error.message : "Error desconocido"}`,
        );
      }
    }
  };

  const crearNuevoProducto = async () => {
    const precioCoste = parseFloat(formPrecioCoste);
    let cantidad = parseInt(formCantidad);
    const fechaCaducidadFinal = formFechaCaducidad || undefined;
    const unidadesPorFormato = formUnidadesPorFormato
      ? parseFloat(formUnidadesPorFormato)
      : undefined;

    // Calcular cantidad total si se especificó formato y cantidad inicial
    let cantidadTotal = cantidad;
    if (formFormatoAlmacen && unidadesPorFormato && cantidad > 0) {
      cantidadTotal = cantidad * unidadesPorFormato;
      console.log(
        `📦 Cálculo automático: ${cantidad} ${getFormatLabel(
          formFormatoAlmacen,
          true,
        )} × ${unidadesPorFormato} unid./${getFormatLabel(
          formFormatoAlmacen,
          false,
        )} = ${cantidadTotal} unidades`,
      );
    }

    try {
      let resultado;

      if (puntoActual?.id) {
        // PUNTO ESPECÍFICO: Crear producto directamente en el almacén del punto (zona_id = 2)
        resultado = await ProductoService.createProductoDirectoEnPunto(
          formNombre,
          formCategoria,
          formSubcategoria,
          precioCoste,
          cantidadTotal,
          puntoActual.id,
          formFechaCaducidad || undefined,
          formFormatoAlmacen || undefined,
          unidadesPorFormato || undefined,
          undefined,
          formDescripcion,
        );
      } else if (almacenActual?.id) {
        // ALMACÉN ESPECÍFICO: Crear producto directamente en el almacén específico
        resultado = await ProductoService.createProductoDirectoEnAlmacen(
          formNombre,
          formCategoria,
          formSubcategoria,
          precioCoste,
          cantidadTotal,
          almacenActual.id,
          formFechaCaducidad || undefined,
          formFormatoAlmacen || undefined,
          unidadesPorFormato || undefined,
          undefined,
          formDescripcion,
        );
      } else {
        // ALMACÉN GENERAL
        resultado = await ProductoService.createProductoDirectoEnAlmacenGeneral(
          formNombre,
          formCategoria,
          formSubcategoria,
          precioCoste,
          cantidadTotal,
          formFechaCaducidad || undefined,
          formFormatoAlmacen || undefined,
          unidadesPorFormato || undefined,
          undefined,
          formDescripcion,
        );
      }

      if (resultado.success) {
        Alert.alert("Éxito", resultado.message);
        setModalProductoForm(false);
        resetFormulariosProducto();
        // Forzar recarga completa para mostrar datos actualizados en las cards
        await cargarDatosIniciales();
      } else {
        Alert.alert(
          "Error",
          resultado.message || "No se pudo crear el producto",
        );
        // Forzar recarga completa para mostrar datos actualizados en las cards
        await cargarDatosIniciales();
      }
    } catch (error) {
      console.error("Error creando producto:", error);
      Alert.alert("Error", "No se pudo crear el producto");
    }
  };

  const eliminarProducto = async () => {
    if (!productoSeleccionado) return;

    try {
      let mensajeConfirmacion =
        `¿Estás seguro de eliminar el producto "${productoSeleccionado.nombre}"?\n\n` +
        `Esta acción eliminará el producto solo de este almacén específico.\n` +
        `Actualmente hay ${productoSeleccionado.cantidad} unidades en stock.`;

      // Determinar qué función de eliminación usar según el contexto
      let funcionEliminar: () => Promise<any>;

      if (almacenActual?.id) {
        // Estamos en un almacén específico
        funcionEliminar = () =>
          AlmacenService.deleteProductoDeAlmacenEspecifico(
            productoSeleccionado.id,
            almacenActual.id,
          );
        mensajeConfirmacion =
          `¿Estás seguro de eliminar el producto "${productoSeleccionado.nombre}" del almacén "${almacenActual.nombre}"?\n\n` +
          `Esta acción eliminará el producto solo de este almacén.\n` +
          `El producto seguirá existiendo en otros almacenes si tiene stock allí.\n` +
          `Actualmente hay ${productoSeleccionado.cantidad} unidades en este almacén.`;
      } else if (puntoActual?.id) {
        // Estamos en un punto
        funcionEliminar = () =>
          AlmacenService.deleteProductoDeZonaPunto(
            productoSeleccionado.id,
            puntoActual.id,
            1,
          ); // zona 1 = zona de venta
        mensajeConfirmacion =
          `¿Estás seguro de eliminar el producto "${productoSeleccionado.nombre}" de la zona de venta del punto "${puntoActual.nombre}"?\n\n` +
          `Esta acción eliminará el producto solo de este punto.\n` +
          `El producto seguirá existiendo en el almacén general y otros puntos.\n` +
          `Actualmente hay ${productoSeleccionado.cantidad} unidades en este punto.`;
      } else {
        // Estamos en el almacén general
        funcionEliminar = () =>
          AlmacenService.deleteProductoDeAlmacenGeneral(
            productoSeleccionado.id,
          );
        mensajeConfirmacion =
          `¿Estás seguro de eliminar el producto "${productoSeleccionado.nombre}" del almacén general?\n\n` +
          `Esta acción eliminará el producto solo del almacén general.\n` +
          `El producto seguirá existiendo en puntos y otros almacenes si tiene stock allí.\n` +
          `Actualmente hay ${productoSeleccionado.cantidad} unidades en el almacén general.`;
      }

      Alert.alert("Confirmar Eliminación", mensajeConfirmacion, [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const resultado = await funcionEliminar();

              if (resultado.success) {
                Alert.alert("Éxito", resultado.message);
                setModalEliminarProducto(false);
                resetFormularios();
                cargarDatosIniciales();
              } else {
                Alert.alert("Error", resultado.message);
              }
            } catch (error) {
              console.error("Error al eliminar producto:", error);
              Alert.alert("Error", "No se pudo eliminar el producto");
            }
          },
        },
      ]);
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      Alert.alert("Error", "No se pudo eliminar el producto");
    }
  };

  const abrirFormularioEdicion = async (producto: ProductoAlmacen) => {
    // Forzar recarga del producto para obtener datos actualizados
    try {
      let productoActualizado;
      if (puntoActual?.id) {
        productoActualizado = await ProductoService.getProductosDeZonaPunto(
          puntoActual.id,
          2, // zona_id = 2 = Almacén del Punto
          200,
        ).then((productos) => productos.find((p) => p.id === producto.id));
      } else if (almacenActual?.id) {
        productoActualizado =
          await ProductoService.getProductosEnAlmacenEspecifico(
            almacenActual.id,
            200,
          ).then((productos) => productos.find((p) => p.id === producto.id));
      } else {
        productoActualizado = await ProductoService.getProductosEnAlmacen(
          200,
        ).then((productos) => productos.find((p) => p.id === producto.id));
      }

      const productoUsar = productoActualizado || producto;
      const precioCosteReal =
        productoUsar.precio_coste_real || productoUsar.precio_coste;

      setProductoSeleccionado(productoUsar);
      setFormNombre(productoUsar.nombre);
      setFormCategoria(productoUsar.categoria);
      setFormSubcategoria(productoUsar.subcategoria || "");
      setFormDescripcion(productoUsar.descripcion || "");
      setFormPrecioCoste(precioCosteReal.toString());
      setFormCantidad(productoUsar.cantidad.toString());
      setFormFechaCaducidad(productoUsar.fecha_caducidad || "");
      if (productoUsar.fecha_caducidad) {
        setSelectedDate(new Date(productoUsar.fecha_caducidad));
      }
      setFormModoEdicion(true);
      setModalProductoForm(true);
    } catch (error) {
      console.error("Error recargando producto para edición:", error);
      // Usar el producto original si hay error
      const precioCosteReal =
        producto.precio_coste_real || producto.precio_coste;
      setProductoSeleccionado(producto);
      setFormNombre(producto.nombre);
      setFormCategoria(producto.categoria);
      setFormSubcategoria(producto.subcategoria || "");
      setFormDescripcion(producto.descripcion || "");
      setFormPrecioCoste(precioCosteReal.toString());
      setFormCantidad(producto.cantidad.toString());
      setFormFechaCaducidad(producto.fecha_caducidad || "");
      if (producto.fecha_caducidad) {
        setSelectedDate(new Date(producto.fecha_caducidad));
      }
      setFormModoEdicion(true);
      setModalProductoForm(true);
    }
  };

  const abrirFormularioNuevo = () => {
    resetFormulariosProducto();
    setFormModoEdicion(false);
    setFormModoAgregarSimilar(false);
    setModalProductoForm(true);
  };

  const abrirFormularioAgregarSimilar = (producto: any) => {
    resetFormulariosProducto();
    setFormNombre(producto.nombre);
    setFormCategoria(producto.categoria);
    setFormSubcategoria(producto.subcategoria || "");
    setFormDescripcion(producto.descripcion || "");
    setFormModoEdicion(false);
    setFormModoAgregarSimilar(true); // Indicar que estamos en modo añadir similar
    setModalProductoForm(true);
  };

  // Funciones para el sistema de producción

  const abrirSeleccionInsumo = async (nombreInsumo: string) => {
    try {
      setInsumoActualSeleccionar(nombreInsumo);

      // Obtener el ID del almacén actual
      const almacenId = almacenActual?.id || (puntoActual ? 0 : 0);

      // Buscar productos disponibles para este insumo
      const productos = await ProduccionPanService.buscarInsumosPorNombre(
        nombreInsumo,
        almacenId,
      );

      setProductosInsumoDisponibles(productos);
      setModalSeleccionInsumos(true);
    } catch (error: any) {
      console.error("Error buscando insumos:", error);
      Alert.alert("Error", "No se pudieron cargar los insumos disponibles");
    }
  };

  const seleccionarInsumo = async (producto: any) => {
    if (!resumenProduccion) return;

    // Actualizar el insumo seleccionado (solo el que coincide exactamente)
    console.log("🎯 Insumo actual a seleccionar:", insumoActualSeleccionar);
    console.log("🎯 Producto seleccionado:", producto.nombre);

    const nuevosInsumos = insumosSeleccionados.map((insumo) => {
      console.log("🔍 Evaluando insumo:", insumo.nombre);
      console.log(
        "🔍 ¿Contiene?",
        insumo.nombre
          .toLowerCase()
          .includes(insumoActualSeleccionar.toLowerCase()),
      );
      console.log(
        "🔍 ¿Es exacto?",
        insumo.nombre.toLowerCase() === producto.nombre.toLowerCase(),
      );

      if (
        insumo.nombre
          .toLowerCase()
          .includes(insumoActualSeleccionar.toLowerCase())
      ) {
        console.log(
          "✅ Insumo actualizado:",
          insumo.nombre,
          "->",
          producto.nombre,
        );
        return {
          ...insumo,
          producto_id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion || "",
          cantidad_disponible: producto.cantidad_almacen,
          formato_almacen: producto.formato_almacen || "g",
          unidades_por_formato: producto.unidades_por_formato,
          precio_coste: producto.precio_coste,
        };
      }
      return insumo;
    });

    setInsumosSeleccionados(nuevosInsumos);
    setModalSeleccionInsumos(false);

    // Recalcular costos
    if (resumenProduccion) {
      const { costo_total, costo_por_pan } =
        ProduccionPanService.calcularCostoProduccion(
          resumenProduccion.formula,
          nuevosInsumos,
        );

      // Recalcular cantidad máxima con los nuevos insumos
      const { cantidad_maxima: cantidadMaxima } =
        await ProduccionPanService.calcularCantidadMaxima(
          resumenProduccion.formula,
          almacenActual?.id || 0,
          nuevosInsumos, // Pasar los insumos seleccionados
        );

      console.log(" Cantidad máxima recalculada:", cantidadMaxima);
      console.log(
        " Insumos usados para cálculo:",
        nuevosInsumos.map(
          (i) => `${i.nombre}: ${i.cantidad_disponible}${i.formato_almacen}`,
        ),
      );

      setResumenProduccion({
        ...resumenProduccion,
        insumos_seleccionados: nuevosInsumos,
        costo_total,
        costo_por_pan,
        cantidad_maxima_posible: cantidadMaxima,
      });
    }
  };

  const ejecutarProduccion = async () => {
    if (!resumenProduccion || !cantidadPanesProducir) {
      Alert.alert("Error", "Datos incompletos para la producción");
      return;
    }

    const cantidad = parseInt(cantidadPanesProducir);
    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert("Error", "La cantidad de panes debe ser mayor a 0");
      return;
    }

    if (cantidad > resumenProduccion.cantidad_maxima_posible) {
      Alert.alert(
        "Error",
        `Solo puedes producir un máximo de ${resumenProduccion.cantidad_maxima_posible} panes`,
      );
      return;
    }

    try {
      setLoadingProduccion(true);

      // Obtener el ID del almacén actual
      const almacenId = almacenActual?.id || (puntoActual ? 0 : 0);

      // Ejecutar la producción
      const resultado = await ProduccionPanService.producirPanes(
        resumenProduccion.formula.id,
        cantidad,
        insumosSeleccionados,
        almacenId,
        {
          trabajador: parseFloat(costoTrabajador || "0"),
          transporte: parseFloat(costoTransporte || "0"),
          electricidad: parseFloat(costoElectricidad || "0"),
        },
      );

      if (resultado.success) {
        Alert.alert("Éxito", resultado.message, [
          {
            text: "OK",
            onPress: () => {
              // Cerrar modal y recargar datos
              setModalProduccionPan(false);
              cargarDatosIniciales();
            },
          },
        ]);
      } else {
        Alert.alert("Error", resultado.message);
      }
    } catch (error: any) {
      console.error("Error en producción:", error);
      Alert.alert("Error", "No se pudo completar la producción");
    } finally {
      setLoadingProduccion(false);
    }
  };

  const resetFormularios = () => {
    setProductoSeleccionado(null);
    setPuntoDestino(null);
    setAlmacenDestino(null);
    setCantidadTransferencia("");
    setPrecioVenta("");
    setTipoTransferencia("punto");
    setTipoCantidadTransferencia("unidades");
    setCantidadCorreccion("");
    setMotivoCorreccion("");
    setModalSeleccionarAlmacenTransferencia(false);
    setTransferenciaSeleccionada(null);
  };

  const resetFormulariosProducto = () => {
    setFormNombre("");
    setFormCategoria("");
    setFormSubcategoria("");
    setFormPrecioCoste("");
    setFormCantidad("");
    setFormFechaCaducidad("");
    setFormFormatoAlmacen("");
    setFormUnidadesPorFormato("");
    setFormDescripcion("");
    setFormTipoProducto("producto");
    setFormCostoInsumo("");
    setFormModoEdicion(false);
    setFormModoAgregarSimilar(false);
    setSelectedDate(new Date());
    setShowDatePicker(false);
  };

  const abrirModalCorreccion = (movimiento: any) => {
    setTransferenciaSeleccionada(movimiento);
    // Usar cantidad_variacion en lugar de cantidad (que no existe)
    const cantidad = Math.abs(movimiento.cantidad_variacion) || 0;
    setCantidadCorreccion(cantidad.toString());
    setMotivoCorreccion("");
    // Establecer el almacén destino por defecto (el almacén actual)
    setAlmacenDestinoCorreccion(almacenActual?.id || null);
    setModalCorreccionTransferencia(true);
  };

  const corregirTransferencia = async () => {
    if (
      !transferenciaSeleccionada ||
      !cantidadCorreccion ||
      !motivoCorreccion.trim() ||
      !almacenDestinoCorreccion
    ) {
      Alert.alert("Error", "Complete todos los campos requeridos");
      return;
    }

    const cantidadCorrecta = parseInt(cantidadCorreccion);
    const cantidadOriginal =
      Math.abs(transferenciaSeleccionada.cantidad_variacion) || 0;

    if (isNaN(cantidadCorrecta) || cantidadCorrecta < 0) {
      Alert.alert("Error", "Cantidad correcta inválida");
      return;
    }

    if (cantidadCorrecta === cantidadOriginal) {
      Alert.alert(
        "Error",
        "La cantidad correcta es igual a la original. No hay cambios que realizar.",
      );
      return;
    }

    const diferencia = Math.abs(cantidadCorrecta - cantidadOriginal);
    const accion = cantidadCorrecta > cantidadOriginal ? "enviar" : "devolver";

    // Mostrar alerta sobre suplantación de apertura antes de continuar
    Alert.alert(
      "⚠️ Advertencia Importante",
      "Para que todos los datos se mantengan correctamente después de esta corrección, es necesario que suplantes la apertura del día. Esto asegura que los registros de inventario y ventas se mantengan consistentes.\n\n¿Deseas continuar con la corrección?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Entendido, continuar",
          style: "default",
          onPress: () => {
            // Después de que el usuario entiende la advertencia, mostrar la confirmación normal
            Alert.alert(
              "Confirmar Corrección",
              `¿Estás seguro de corregir esta transferencia?\n\n` +
                `• Producto: ${transferenciaSeleccionada.producto_nombre}\n` +
                `• Cantidad original: ${cantidadOriginal} unidades\n` +
                `• Cantidad correcta: ${cantidadCorrecta} unidades\n` +
                `• Diferencia: ${diferencia} unidades\n` +
                `• Acción: ${accion} ${diferencia} unidades\n` +
                `• Motivo: ${motivoCorreccion}\n\n` +
                `Esta acción actualizará el stock en ambos almacenes.`,
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Corregir",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const result =
                        await AlmacenService.corregirTransferenciaConDestino(
                          transferenciaSeleccionada.id,
                          cantidadOriginal,
                          cantidadCorrecta,
                          motivoCorreccion,
                          almacenDestinoCorreccion,
                        );

                      if (result.success) {
                        Alert.alert(
                          "✅ Éxito",
                          result.message +
                            "\n\n💡 Recuerda suplantar la apertura del día para mantener la consistencia de los datos.",
                        );
                        setModalCorreccionTransferencia(false);
                        resetFormularios();
                        cargarDatosIniciales();
                        // Recargar historial si está abierto
                        if (modalHistorial) {
                          cargarHistorial(historialFiltros);
                        }
                      } else {
                        Alert.alert("Error", result.message);
                      }
                    } catch (error) {
                      console.error("Error corrigiendo transferencia:", error);
                      Alert.alert("Error", "No se pudo realizar la corrección");
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    cargarDatosIniciales();
  };

  const limpiarFiltros = () => {
    setSearchQuery("");
    setCategoriaFiltro("todos");
    setStockFiltro("todos");
    setFechaDesdeFiltro(null);
  };

  // Función para formatear cantidades con 3 decimales
  const formatearCantidad = (cantidad: number): string => {
    if (cantidad === null || cantidad === undefined) return "0";
    return Number(cantidad.toFixed(3)).toString();
  };

  const renderProductoItem = ({ item }: { item: any }) => {
    const colorFecha = getColorFecha(item);
    const colorStock = getColorStock(item.cantidad);
    const cantidadGeneral =
      item.cantidadGeneral || getCantidadGeneral(item.nombre);

    return (
      <TouchableOpacity
        style={styles.productoItem}
        onPress={async () => {
          // Forzar recarga del producto para obtener datos actualizados
          try {
            let productoActualizado;
            if (puntoActual?.id) {
              productoActualizado =
                await ProductoService.getProductosDeZonaPunto(
                  puntoActual.id,
                  2, // zona_id = 2 = Almacén del Punto
                  200,
                ).then((productos) => productos.find((p) => p.id === item.id));
            } else if (almacenActual?.id) {
              productoActualizado =
                await ProductoService.getProductosEnAlmacenEspecifico(
                  almacenActual.id,
                  200,
                ).then((productos) => productos.find((p) => p.id === item.id));
            } else {
              productoActualizado = await ProductoService.getProductosEnAlmacen(
                200,
              ).then((productos) => productos.find((p) => p.id === item.id));
            }

            if (productoActualizado) {
              setProductoSeleccionado(productoActualizado);
            } else {
              setProductoSeleccionado(item);
            }
          } catch (error) {
            console.error("Error recargando producto:", error);
            setProductoSeleccionado(item);
          }
        }}
        onLongPress={() => {
          Alert.alert(
            "Opciones del Producto",
            `"${item.nombre}"\n\n` +
              `• Precio costo real: ${formatMoneda(item.precio_coste_real || item.precio_coste)}\n` +
              `• Precio costo promedio: ${formatMoneda(item.precio_coste)}\n` +
              `• Stock: ${formatearCantidad(item.cantidad)} unidades\n` +
              (item.formato_almacen && item.unidades_por_formato
                ? `• Formato: ${getFormatLabel(item.formato_almacen, true)} (${item.unidades_por_formato} unid./c${getFormatLabel(item.formato_almacen, false)})\n`
                : "") +
              (cantidadGeneral > item.cantidad
                ? `• Total general: ${cantidadGeneral} unidades\n`
                : "") +
              `• Categoría: ${item.categoria}` +
              (item.esGrupo
                ? `\n• ${item.productosOriginales?.length || 0} productos agrupados`
                : ""),
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Editar",
                onPress: () => abrirFormularioEdicion(item),
              },
              {
                text: "Eliminar",
                onPress: async () => {
                  // Forzar recarga del producto para obtener datos actualizados
                  try {
                    let productoActualizado;
                    if (puntoActual?.id) {
                      productoActualizado =
                        await ProductoService.getProductosDeZonaPunto(
                          puntoActual.id,
                          2, // zona_id = 2 = Almacén del Punto
                          200,
                        ).then((productos) =>
                          productos.find((p) => p.id === item.id),
                        );
                    } else if (almacenActual?.id) {
                      productoActualizado =
                        await ProductoService.getProductosEnAlmacenEspecifico(
                          almacenActual.id,
                          200,
                        ).then((productos) =>
                          productos.find((p) => p.id === item.id),
                        );
                    } else {
                      productoActualizado =
                        await ProductoService.getProductosEnAlmacen(200).then(
                          (productos) =>
                            productos.find((p) => p.id === item.id),
                        );
                    }

                    const productoUsar = productoActualizado || item;
                    setProductoSeleccionado(productoUsar);
                    setModalEliminarProducto(true);
                  } catch (error) {
                    console.error(
                      "Error recargando producto para eliminación:",
                      error,
                    );
                    setProductoSeleccionado(item);
                    setModalEliminarProducto(true);
                  }
                },
                style: "destructive",
              },
            ],
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.productoHeader}>
          <View style={styles.productoInfo}>
            <Text style={styles.productoNombre} numberOfLines={1}>
              {item.nombre}
              {item.esGrupo && (
                <Text
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    fontStyle: "italic",
                  }}
                >
                  {" "}
                  ({item.productosOriginales?.length || 0} lotes)
                </Text>
              )}
            </Text>
            <View style={styles.productoMeta}>
              <View
                style={[styles.categoriaBadge, { backgroundColor: "#e0e7ff" }]}
              >
                <Text style={[styles.categoriaText, { color: "#4f46e5" }]}>
                  {item.categoria}
                </Text>
              </View>
              {item.subcategoria && (
                <View
                  style={[
                    styles.categoriaBadge,
                    { backgroundColor: "#f3f4f6" },
                  ]}
                >
                  <Text style={[styles.categoriaText, { color: "#6b7280" }]}>
                    {item.subcategoria}
                  </Text>
                </View>
              )}
              <View
                style={[styles.categoriaBadge, { backgroundColor: "#fef3c7" }]}
              >
                <Text
                  style={[
                    styles.categoriaText,
                    { color: "#d97706", fontSize: 10 },
                  ]}
                >
                  PROM
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.productoStats}>
            <View style={styles.precioContainer}>
              <Text style={styles.productoPrecio}>
                {formatMoneda(item.precio_coste)}
              </Text>
              <Text style={styles.precioLabel}>Precio promedio</Text>
            </View>
            <View style={styles.stockContainer}>
              <View
                style={[styles.stockDot, { backgroundColor: colorStock }]}
              />
              <View>
                <Text style={[styles.stockText, { color: colorStock }]}>
                  {formatearCantidad(item.cantidad)} unidades
                </Text>
                {item.formato_almacen && item.unidades_por_formato && (
                  <Text
                    style={[
                      styles.stockText,
                      { color: "#6b7280", fontSize: 10 },
                    ]}
                  >
                    {Math.floor(item.cantidad / item.unidades_por_formato)}{" "}
                    {item.formato_almacen === "cajas"
                      ? "caja" +
                        (Math.floor(
                          item.cantidad / item.unidades_por_formato,
                        ) !== 1
                          ? "s"
                          : "")
                      : item.formato_almacen === "blisters"
                        ? "blister" +
                          (Math.floor(
                            item.cantidad / item.unidades_por_formato,
                          ) !== 1
                            ? "s"
                            : "")
                        : item.formato_almacen === "paquetes"
                          ? "paquete" +
                            (Math.floor(
                              item.cantidad / item.unidades_por_formato,
                            ) !== 1
                              ? "s"
                              : "")
                          : getFormatLabel(item.formato_almacen, false) +
                            (Math.floor(
                              item.cantidad / item.unidades_por_formato,
                            ) !== 1
                              ? "s"
                              : "")}
                    {item.cantidad % item.unidades_por_formato > 0 &&
                      ` + ${formatearCantidad(item.cantidad % item.unidades_por_formato)} unid.`}
                  </Text>
                )}
                {cantidadGeneral > item.cantidad && (
                  <Text
                    style={[
                      styles.stockText,
                      { color: "#3b82f6", fontSize: 10 },
                    ]}
                  >
                    General: {cantidadGeneral}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.productoDetails}>
          {item.fecha_caducidad && (
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={14} color={colorFecha} />
              <Text style={[styles.detailText, { color: colorFecha }]}>
                {formatFecha(item.fecha_caducidad)}
                {item.dias_restantes !== undefined && (
                  <Text style={styles.diasText}>
                    {item.dias_restantes < 0
                      ? ` (Vencido hace ${Math.abs(item.dias_restantes)} días)`
                      : item.dias_restantes === 0
                        ? " (Hoy)"
                        : ` (${item.dias_restantes} días)`}
                  </Text>
                )}
              </Text>
            </View>
          )}

          {item.descripcion && (
            <View style={styles.detailRow}>
              <Ionicons
                name="document-text-outline"
                size={14}
                color="#6b7280"
              />
              <Text
                style={[
                  styles.detailText,
                  { color: "#6b7280", fontStyle: "italic" },
                ]}
                numberOfLines={2}
              >
                {item.descripcion}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color="#059669" />
            <Text
              style={[
                styles.detailText,
                { color: "#059669", fontWeight: "600" },
              ]}
            >
              Valor total: {formatMoneda(item.total_costo)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={14} color="#4f5563" />
            <Text style={[styles.detailText, { color: "#4f5563" }]}>
              {puntoActual?.id
                ? "Almacén del Punto"
                : almacenActual?.id
                  ? almacenActual.nombre
                  : "Almacén General"}
            </Text>
          </View>
        </View>

        <View style={styles.productoActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editarButton]}
            onPress={() => abrirFormularioEdicion(item)}
          >
            <Ionicons name="create-outline" size={16} color="#3b82f6" />
            <Text style={[styles.actionButtonText, { color: "#3b82f6" }]}>
              Editar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: "#f0f9ff", borderColor: "#0ea5e9" },
            ]}
            onPress={() => abrirFormularioAgregarSimilar(item)}
          >
            <Ionicons name="add-circle-outline" size={16} color="#0ea5e9" />
            <Text style={[styles.actionButtonText, { color: "#0ea5e9" }]}>
              Añadir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.transferButton]}
            onPress={() => {
              abrirModalTransferencia(item);
            }}
          >
            <Ionicons name="arrow-forward-outline" size={16} color="#10b981" />
            <Text style={[styles.actionButtonText, { color: "#10b981" }]}>
              Transferir
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Función temporal para diagnosticar y reparar cantidad_inicial
  const diagnosticarCantidadInicial = async () => {
    try {
      console.log("🔧 Iniciando diagnóstico de cantidad_inicial...");

      if (almacenActual) {
        await AlmacenHistoryService.diagnosticarYRepararCantidadInicial(
          almacenActual.id,
        );
      } else {
        await AlmacenHistoryService.diagnosticarYRepararCantidadInicial();
      }

      Alert.alert(
        "Éxito",
        "Diagnóstico completado. Revisa la consola para detalles.",
      );

      // Recargar el historial para ver los cambios
      if (modalHistorial) {
        cargarHistorial(historialFiltros);
      }
    } catch (error) {
      console.error("❌ Error en diagnóstico:", error);
      Alert.alert("Error", "No se pudo completar el diagnóstico");
    }
  };

  // Funciones para gestión de fórmulas de pan
  const cargarFormulasExistentes = async () => {
    try {
      setLoadingFormulas(true);

      if (!almacenActual) {
        console.log("🍞 No hay almacén actual, no se cargan fórmulas");
        setFormulasExistentes([]);
        return;
      }

      console.log(
        "🍞 Buscando fórmulas para almacén:",
        almacenActual.nombre,
        "ID:",
        almacenActual.id,
      );

      const formulas = await FormulasPanService.obtenerFormulasActivas(
        almacenActual.id,
      );

      console.log("🍞 Fórmulas recibidas del servicio:", formulas);
      console.log("🍞 Detalle de fórmulas:");
      formulas.forEach((formula, index) => {
        console.log(
          `  ${index + 1}. ID: ${formula.id}, Nombre: ${formula.nombre}, Almacén: ${formula.almacen_id}`,
        );
      });

      setFormulasExistentes(formulas);
      console.log(
        "🍞 Fórmulas cargadas para almacén",
        almacenActual.nombre,
        ":",
        formulas.length,
      );
      console.log("🍞 Estado formulasExistentes:", formulasExistentes.length);
    } catch (error) {
      console.error("Error cargando fórmulas:", error);
      Alert.alert("Error", "No se pudieron cargar las fórmulas existentes");
    } finally {
      setLoadingFormulas(false);
    }
  };

  const guardarFormula = async () => {
    try {
      // Validar que el nombre no esté vacío
      if (!nombrePan.trim()) {
        Alert.alert("Error", "El nombre del pan es obligatorio");
        return;
      }

      // Validar que todos los ingredientes tengan valores válidos
      const harina = parseFloat(formulaData.harina) || 0;
      const levadura = parseFloat(formulaData.levadura) || 0;
      const nucleo = parseFloat(formulaData.nucleo) || 0;
      const azucar = parseFloat(formulaData.azucar) || 0;
      const sal = parseFloat(formulaData.sal) || 0;
      const aceite = parseFloat(formulaData.aceite) || 0;

      if (harina <= 0) {
        Alert.alert("Error", "La harina debe ser mayor a 0");
        return;
      }

      if (levadura < 0 || nucleo < 0 || azucar < 0 || sal < 0 || aceite < 0) {
        Alert.alert(
          "Error",
          "Los ingredientes no pueden tener valores negativos",
        );
        return;
      }

      if (!almacenActual) {
        Alert.alert(
          "Error",
          "No se puede guardar la fórmula sin un almacén seleccionado",
        );
        return;
      }

      try {
        setLoadingFormulas(true);

        if (formulaEditando) {
          // Estamos editando una fórmula existente
          const datosActualizados = {
            nombre: nombrePan.trim(),
            harina,
            levadura,
            nucleo,
            azucar,
            sal,
            aceite,
          };

          console.log(
            " Actualizando fórmula:",
            formulaEditando.id,
            datosActualizados,
          );

          const resultado = await FormulasPanService.actualizarFormula(
            formulaEditando.id,
            datosActualizados,
          );

          if (resultado.success) {
            Alert.alert("Éxito", resultado.message);
            setMostrarModalCrearFormula(false);
            limpiarFormularioFormula();
            setFormulaEditando(null);
            // Recargar fórmulas del almacén actual
            await cargarFormulasExistentes();
          } else {
            Alert.alert("Error", resultado.message);
          }
        } else {
          // Estamos creando una nueva fórmula
          const nuevaFormula: CrearFormulaPan = {
            almacen_id: almacenActual.id,
            nombre: nombrePan.trim(),
            harina,
            levadura,
            nucleo,
            azucar,
            sal,
            aceite,
          };

          console.log(" Creando fórmula:", nuevaFormula);
          console.log(
            " Para almacén:",
            almacenActual.nombre,
            "ID:",
            almacenActual.id,
          );

          const resultado = await FormulasPanService.crearFormula(nuevaFormula);

          console.log(" Resultado de creación:", resultado);

          if (resultado.success) {
            Alert.alert("Éxito", resultado.message);
            setMostrarModalCrearFormula(false);
            limpiarFormularioFormula();
            // Recargar fórmulas del almacén actual
            console.log(" Recargando fórmulas después de crear...");
            await cargarFormulasExistentes();
            console.log(
              " Fórmulas después de recargar:",
              formulasExistentes.length,
            );
          } else {
            Alert.alert("Error", resultado.message);
          }
        }
      } catch (error: any) {
        console.error("Error guardando fórmula:", error);
        Alert.alert("Error", "No se pudo guardar la fórmula");
      } finally {
        setLoadingFormulas(false);
      }
    } catch (error) {
      console.error("Error guardando fórmula:", error);
      Alert.alert("Error", "No se pudo guardar la fórmula");
    }
  };

  // Función para limpiar el formulario
  const limpiarFormularioFormula = () => {
    setNombrePan("");
    setFormulaData({
      harina: "",
      levadura: "",
      nucleo: "",
      azucar: "",
      sal: "",
      aceite: "",
    });
  };

  const toggleSeleccionFormula = (formulaId: number) => {
    setFormulasSeleccionadas((prev) =>
      prev.includes(formulaId)
        ? prev.filter((id) => id !== formulaId)
        : [...prev, formulaId],
    );
  };

  const eliminarFormulasSeleccionadas = async () => {
    if (formulasSeleccionadas.length === 0) {
      Alert.alert("Info", "No hay fórmulas seleccionadas para eliminar");
      return;
    }

    Alert.alert(
      "Eliminar Fórmulas",
      `¿Estás seguro de eliminar ${formulasSeleccionadas.length} fórmula(s)? Esta acción se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              let eliminadas = 0;
              for (const formulaId of formulasSeleccionadas) {
                const resultado =
                  await FormulasPanService.eliminarFormula(formulaId);
                if (resultado.success) eliminadas++;
              }

              Alert.alert(
                "Éxito",
                `${eliminadas} de ${formulasSeleccionadas.length} fórmulas eliminadas`,
              );

              // Limpiar selección y recargar
              setFormulasSeleccionadas([]);
              await cargarFormulasExistentes();
            } catch (error) {
              console.error("Error eliminando fórmulas:", error);
              Alert.alert("Error", "No se pudieron eliminar las fórmulas");
            }
          },
        },
      ],
    );
  };

  const crearPanDesdeFormulaDirecta = async (formula: FormulaPan) => {
    // Obtener el ID del almacén actual
    const almacenId = almacenActual?.id || (puntoActual ? 0 : 0);

    try {
      setLoadingProduccion(true);

      // Obtener resumen de producción
      const resultado = await ProduccionPanService.obtenerResumenProduccion(
        formula.id,
        almacenId,
      );

      if (!resultado.success || !resultado.resumen) {
        Alert.alert("Error", resultado.message);
        return;
      }

      // Configurar el resumen y mostrar el modal
      setResumenProduccion(resultado.resumen);
      setInsumosSeleccionados(resultado.resumen.insumos_seleccionados);
      setCantidadPanesProducir(
        resultado.resumen.cantidad_maxima_posible.toString(),
      );
      setModalProduccionPan(true);
    } catch (error: any) {
      console.error("Error preparando producción:", error);
      Alert.alert("Error", "No se pudo preparar la producción");
    } finally {
      setLoadingProduccion(false);
    }
  };

  const crearPanDesdeFormula = async () => {
    if (formulasSeleccionadas.length === 0) {
      Alert.alert("Info", "Selecciona una fórmula para crear el pan");
      return;
    }

    if (formulasSeleccionadas.length > 1) {
      Alert.alert("Info", "Selecciona solo una fórmula para crear el pan");
      return;
    }

    const formula = formulasExistentes.find(
      (f) => f.id === formulasSeleccionadas[0],
    );

    if (!formula) {
      Alert.alert("Error", "Fórmula no encontrada");
      return;
    }

    // Llamar a la función directa
    await crearPanDesdeFormulaDirecta(formula);
  };

  const editarFormula = (formula: any) => {
    console.log("📝 Editando fórmula:", formula);

    // Cargar los datos de la fórmula en el formulario
    setNombrePan(formula.nombre);
    setFormulaData({
      harina: formula.harina.toString(),
      levadura: formula.levadura.toString(),
      nucleo: formula.nucleo.toString(),
      azucar: formula.azucar.toString(),
      sal: formula.sal.toString(),
      aceite: formula.aceite.toString(),
    });

    // Guardar referencia a la fórmula que se está editando
    setFormulaEditando(formula);

    // Cerrar modal principal y abrir modal de crear/editar
    setMostrarModalFormula(false);
    setMostrarModalCrearFormula(true);
  };

  // Función para eliminar una fórmula
  const eliminarFormula = async (formula: any) => {
    Alert.alert(
      "Eliminar Fórmula",
      `¿Estás seguro de eliminar la fórmula "${formula.nombre}"? Esta acción se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const resultado = await FormulasPanService.eliminarFormula(
                formula.id,
              );

              if (resultado.success) {
                Alert.alert(
                  "Éxito",
                  `Fórmula "${formula.nombre}" eliminada exitosamente`,
                );
                // Recargar fórmulas
                await cargarFormulasExistentes();
              } else {
                Alert.alert("Error", resultado.message);
              }
            } catch (error) {
              console.error("Error eliminando fórmula:", error);
              Alert.alert("Error", "No se pudo eliminar la fórmula");
            }
          },
        },
      ],
    );
  };

  const categoriasUnicas = useMemo(() => {
    const categorias = inventario
      .filter((p) => p.cantidad > 0)
      .map((p) => p.categoria?.trim())
      .filter((cat) => cat && cat.length > 0);

    // Eliminar duplicados usando case-insensitive y trim
    const categoriasNormalizadas = new Map();
    categorias.forEach((cat) => {
      const key = cat.toLowerCase();
      if (!categoriasNormalizadas.has(key)) {
        categoriasNormalizadas.set(key, cat); // Guardar el formato original
      }
    });

    return ["todos", ...Array.from(categoriasNormalizadas.values())];
  }, [inventario]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando almacén...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Almacén</Text>
            {(almacenActual || puntoActual) && (
              <Text style={styles.headerSubtitle}>
                {almacenActual ? almacenActual.nombre : puntoActual?.nombre} •{" "}
                {inventario.length} productos
              </Text>
            )}
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setMostrarFiltros(!mostrarFiltros)}
            >
              <Ionicons
                name={mostrarFiltros ? "filter" : "filter-outline"}
                size={24}
                color="#3b82f6"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setModalHistorial(true)}
            >
              <Ionicons name="time-outline" size={24} color="#8b5cf6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, styles.alertButton]}
              onPress={() => setModalProductosVencidos(true)}
            >
              <Ionicons name="warning-outline" size={24} color="#d97706" />
              {(productosVencidos.length > 0 ||
                productosPorVencer.length > 0) && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {productosVencidos.length + productosPorVencer.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, styles.addButton]}
              onPress={abrirFormularioNuevo}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Búsqueda */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar producto..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
          {/* Botón de Fórmula del Pan */}
          <TouchableOpacity
            style={styles.formulaButton}
            onPress={() => setMostrarModalFormula(true)}
          >
            <Ionicons name="flame" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Filtros desplegables */}
        {mostrarFiltros && (
          <View style={styles.filtrosContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* Filtro por categoría */}
              <View style={styles.filtroGroup}>
                <Text style={styles.filtroLabel}>Categoría</Text>
                <ScrollView horizontal style={styles.filtroOptions}>
                  {categoriasUnicas.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.filtroOption,
                        categoriaFiltro === cat && styles.filtroOptionActive,
                      ]}
                      onPress={() => setCategoriaFiltro(cat)}
                    >
                      <Text
                        style={[
                          styles.filtroOptionText,
                          categoriaFiltro === cat &&
                            styles.filtroOptionTextActive,
                        ]}
                      >
                        {cat === "todos" ? "Todas" : cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Filtro por stock */}
              <View style={styles.filtroGroup}>
                <Text style={styles.filtroLabel}>Stock</Text>
                <ScrollView horizontal style={styles.filtroOptions}>
                  {["todos", "bajo", "normal"].map((opcion) => (
                    <TouchableOpacity
                      key={opcion}
                      style={[
                        styles.filtroOption,
                        stockFiltro === opcion && styles.filtroOptionActive,
                      ]}
                      onPress={() => setStockFiltro(opcion)}
                    >
                      <Text
                        style={[
                          styles.filtroOptionText,
                          stockFiltro === opcion &&
                            styles.filtroOptionTextActive,
                        ]}
                      >
                        {opcion === "todos"
                          ? "Todos"
                          : opcion === "bajo"
                            ? "Bajo"
                            : "Normal"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Filtro por fecha */}
              <View style={styles.filtroGroup}>
                <Text style={styles.filtroLabel}>Fecha</Text>
                <ScrollView horizontal style={styles.filtroOptions}>
                  {["todos", "vencidos", "por_vencer"].map((opcion) => (
                    <TouchableOpacity
                      key={opcion}
                      style={[
                        styles.filtroOption,
                        fechaFiltro === opcion && styles.filtroOptionActive,
                      ]}
                      onPress={() => setFechaFiltro(opcion)}
                    >
                      <Text
                        style={[
                          styles.filtroOptionText,
                          fechaFiltro === opcion &&
                            styles.filtroOptionTextActive,
                        ]}
                      >
                        {opcion === "todos"
                          ? "Todos"
                          : opcion === "vencidos"
                            ? "Vencidos"
                            : "Por vencer"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Botón limpiar filtros */}
              <TouchableOpacity
                style={styles.limpiarFiltrosBtn}
                onPress={limpiarFiltros}
              >
                <Ionicons name="refresh-outline" size={16} color="#3b7280" />
                <Text style={styles.limpiarFiltrosText}>Limpiar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Ordenamiento */}
        <View style={styles.ordenamientoContainer}>
          <Text style={styles.ordenamientoLabel}>Ordenar por:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: "nombre", label: "Nombre" },
              { key: "cantidad", label: "Stock" },
              { key: "precio", label: "Precio" },
              { key: "fecha", label: "Fecha" },
            ].map((opcion) => (
              <TouchableOpacity
                key={opcion.key}
                style={[
                  styles.ordenamientoOption,
                  ordenarPor === opcion.key && styles.ordenamientoOptionActive,
                ]}
                onPress={() => {
                  if (ordenarPor === opcion.key) {
                    setOrdenAscendente(!ordenAscendente);
                  } else {
                    setOrdenarPor(opcion.key as any);
                    setOrdenAscendente(true);
                  }
                }}
              >
                <Text
                  style={[
                    styles.ordenamientoOptionText,
                    ordenarPor === opcion.key &&
                      styles.ordenamientoOptionTextActive,
                  ]}
                >
                  {opcion.label}
                </Text>
                {ordenarPor === opcion.key && (
                  <Ionicons
                    name={ordenAscendente ? "arrow-up" : "arrow-down"}
                    size={12}
                    color="#3b82f6"
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStatsCompact}>
        <View style={styles.quickStatCardCompact}>
          <View style={styles.quickStatTopCompact}>
            <View
              style={[
                styles.quickStatIconCompact,
                { backgroundColor: "#e0e7ff" },
              ]}
            >
              <Ionicons name="cube-outline" size={24} color="#4f46e5" />
            </View>
            <Text style={styles.quickStatValueCompact}>
              {inventarioFiltrado.length}
            </Text>
          </View>
          <Text style={styles.quickStatLabelCompact}>Productos</Text>
          <Text style={styles.quickStatSubLabel}>
            {Math.round(
              (inventarioFiltrado.length / Math.max(inventario.length, 1)) *
                100,
            )}
            % del total
          </Text>
        </View>

        <TouchableOpacity
          style={styles.quickStatCardCompact}
          onPress={() => setModalEstadisticas(true)}
          activeOpacity={0.7}
        >
          <View style={styles.quickStatTopCompact}>
            <View
              style={[
                styles.quickStatIconCompact,
                { backgroundColor: "#d1fae5" },
              ]}
            >
              <Ionicons name="cash-outline" size={24} color="#059669" />
            </View>
            <Text style={styles.quickStatValueCompact} numberOfLines={1}>
              {estadisticas
                ? formatMoneda(estadisticas.totalDineroAlmacen)
                    .replace("CUP", "")
                    .trim()
                : "$0"}
            </Text>
          </View>
          <Text style={styles.quickStatLabelCompact}>
            Estadísticas del Almacén
          </Text>
          <View style={styles.trendContainer}>
            <Ionicons name="stats-chart-outline" size={12} color="#059669" />
            <Text style={styles.trendText}>Toca para ver estadísticas</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.quickStatCardCompact}>
          <View style={styles.quickStatTopCompact}>
            <View
              style={[
                styles.quickStatIconCompact,
                { backgroundColor: "#fef3c7" },
              ]}
            >
              <Ionicons name="time-outline" size={24} color="#d97706" />
            </View>
            <Text style={styles.quickStatValueCompact}>
              {productosPorVencer.length}
            </Text>
          </View>
          <Text style={styles.quickStatLabelCompact}>Por Vencer</Text>
          <View
            style={[
              styles.alertBadgeCompact,
              productosPorVencer.length > 0
                ? styles.alertBadgeActive
                : styles.alertBadgeInactive,
            ]}
          >
            <Text style={styles.alertBadgeText}>
              {productosPorVencer.length > 0 ? "¡Revisar!" : "Todo OK"}
            </Text>
          </View>
        </View>
      </View>

      {/* Lista de Productos */}
      <FlatList
        data={inventarioAgrupado}
        renderItem={renderProductoItem}
        keyExtractor={(item, index) =>
          `producto-${item.id || index}-${item.nombre}`
        }
        contentContainerStyle={styles.productosList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {searchQuery ||
              categoriaFiltro !== "todos" ||
              stockFiltro !== "todos"
                ? "No se encontraron productos"
                : "No hay productos en el almacén"}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? "Intenta con otro nombre o limpia la búsqueda"
                : "Agrega productos usando el botón +"}
            </Text>
            {(searchQuery ||
              categoriaFiltro !== "todos" ||
              stockFiltro !== "todos") && (
              <TouchableOpacity
                style={styles.limpiarBusquedaButton}
                onPress={limpiarFiltros}
              >
                <Text style={styles.limpiarBusquedaText}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {inventarioFiltrado.length}{" "}
              {inventarioFiltrado.length === 1 ? "producto" : "productos"}{" "}
              encontrados
            </Text>
          </View>
        }
      />

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Modal de Estadísticas */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEstadisticas}
        onRequestClose={() => setModalEstadisticas(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Estadísticas del Almacén</Text>
              <TouchableOpacity onPress={() => setModalEstadisticas(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {estadisticas && (
                <>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Productos totales</Text>
                      <Text style={styles.statValue}>
                        {estadisticas.totalProductos}
                      </Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Con stock</Text>
                      <Text style={styles.statValue}>
                        {estadisticas.productosConStock}
                      </Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Sin stock</Text>
                      <Text style={[styles.statValue, { color: "#9ca3af" }]}>
                        {estadisticas.productosSinStock}
                      </Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Por vencer</Text>
                      <Text style={[styles.statValue, { color: "#f59e0b" }]}>
                        {productosPorVencer.length}
                      </Text>
                    </View>

                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Vencidos</Text>
                      <Text style={[styles.statValue, { color: "#dc2626" }]}>
                        {estadisticas.productosVencidos}
                      </Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Stock bajo</Text>
                      <Text style={[styles.statValue, { color: "#f59e0b" }]}>
                        {productosStockBajo.length}
                      </Text>
                    </View>
                  </View>

                  {puntoActual && puntoActual.tipo_negocio && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        Distribución por Zonas
                      </Text>
                      <View style={styles.zonasGrid}>
                        <View
                          style={[
                            styles.zonaCard,
                            { backgroundColor: "#d1fae5" },
                          ]}
                        >
                          <View style={styles.zonaCardHeader}>
                            <Ionicons
                              name="cart-outline"
                              size={20}
                              color="#059669"
                            />
                            <Text
                              style={[
                                styles.zonaCardTitle,
                                { color: "#059669" },
                              ]}
                            >
                              Zona de Venta
                            </Text>
                          </View>
                          <Text style={styles.zonaCardValue}>
                            {estadisticasZonas.enVenta} productos
                          </Text>
                          <Text style={styles.zonaCardSubValue}>
                            {formatMoneda(estadisticasZonas.valorVenta)}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.zonaCard,
                            { backgroundColor: "#e0e7ff" },
                          ]}
                        >
                          <View style={styles.zonaCardHeader}>
                            <Ionicons
                              name="cube-outline"
                              size={20}
                              color="#4f46e5"
                            />
                            <Text
                              style={[
                                styles.zonaCardTitle,
                                { color: "#4f46e5" },
                              ]}
                            >
                              Almacén del Punto
                            </Text>
                          </View>
                          <Text style={styles.zonaCardValue}>
                            {estadisticasZonas.enAlmacenPunto} productos
                          </Text>
                          <Text style={styles.zonaCardSubValue}>
                            {formatMoneda(estadisticasZonas.valorAlmacenPunto)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={styles.infoSection}>
                    <View style={styles.infoHeader}>
                      <Ionicons
                        name="information-circle-outline"
                        size={20}
                        color="#3b82f6"
                      />
                      <Text style={styles.infoTitle}>
                        Información sobre precios
                      </Text>
                    </View>
                    <Text style={styles.infoText}>
                      •{" "}
                      <Text style={styles.infoHighlight}>Precios REALES:</Text>{" "}
                      Guardados en base de datos para contabilidad
                    </Text>
                    <Text style={styles.infoText}>
                      •{" "}
                      <Text style={styles.infoHighlight}>
                        Precios PROMEDIO:
                      </Text>{" "}
                      Mostrados en pantalla para productos con mismo nombre
                    </Text>
                    <Text style={styles.infoText}>
                      •{" "}
                      <Text style={styles.infoHighlight}>Transferencias:</Text>{" "}
                      Usan precios REALES para cálculos de ganancias
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Categorías ({estadisticas.categoriasUnicas.length})
                    </Text>
                    <View style={styles.categoriasList}>
                      {estadisticas.categoriasUnicas.map(
                        (cat: string, index: number) => (
                          <View key={index} style={styles.categoriaItem}>
                            <View
                              style={[
                                styles.categoriaDot,
                                { backgroundColor: "#3b82f6" },
                              ]}
                            />
                            <Text style={styles.categoriaText}>{cat}</Text>
                          </View>
                        ),
                      )}
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}></View>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar zona de destino */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalSeleccionarZona}
        onRequestClose={() => setModalSeleccionarZona(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalZona]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Zona de Destino</Text>
              <TouchableOpacity onPress={() => setModalSeleccionarZona(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {productoSeleccionado && (
              <View style={styles.modalContent}>
                <View style={styles.infoDestinoZona}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="#3b82f6"
                  />
                  <Text style={styles.infoDestinoZonaText}>
                    ¿Dónde deseas transferir &quot;{productoSeleccionado.nombre}
                    &quot;?
                  </Text>
                </View>

                {/* Opción 1: Zona de Venta */}
                <TouchableOpacity
                  style={styles.zonaOption}
                  onPress={() => {
                    setModalSeleccionarZona(false);
                    abrirModalTransferencia(productoSeleccionado!);
                  }}
                >
                  <View
                    style={[styles.zonaIcon, { backgroundColor: "#d1fae5" }]}
                  >
                    <Ionicons name="cart-outline" size={24} color="#059669" />
                  </View>
                  <View style={styles.zonaInfo}>
                    <Text style={styles.zonaTitle}>📍 Zona de Venta</Text>
                    <Text style={styles.zonaDescription}>
                      Visible en pantalla de ventas
                    </Text>
                    <Text style={styles.zonaDetalle}>
                      • Aparecerá en la pantalla de ventas • Requiere precio de
                      venta • Máximo 70% sobre costo real
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                {/* Opción 2: Almacén del Punto */}
                <TouchableOpacity
                  style={styles.zonaOption}
                  onPress={() => {
                    transferirDirectoAlmacenPunto();
                    setModalSeleccionarZona(false);
                  }}
                >
                  <View
                    style={[styles.zonaIcon, { backgroundColor: "#e0e7ff" }]}
                  >
                    <Ionicons name="cube-outline" size={24} color="#4f46e5" />
                  </View>
                  <View style={styles.zonaInfo}>
                    <Text style={styles.zonaTitle}>📦 Almacén del Punto</Text>
                    <Text style={styles.zonaDescription}>
                      Stock de respaldo (no visible en ventas)
                    </Text>
                    <Text style={styles.zonaDetalle}>
                      • No requiere precio de venta • Solo se usa como stock de
                      respaldo • Puede moverse a venta después
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                <View style={styles.resumenZonas}>
                  <Text style={styles.resumenZonasTitle}>Resumen de Zonas</Text>
                  <View style={styles.resumenZonasItem}>
                    <View style={styles.resumenZonasInfo}>
                      <View
                        style={[
                          styles.resumenDot,
                          { backgroundColor: "#059669" },
                        ]}
                      />
                      <Text style={styles.resumenZonasLabel}>
                        Zona de Venta:
                      </Text>
                    </View>
                    <Text style={styles.resumenZonasValue}>
                      {estadisticasZonas.enVenta} productos •{" "}
                      {formatMoneda(estadisticasZonas.valorVenta)}
                    </Text>
                  </View>
                  <View style={styles.resumenZonasItem}>
                    <View style={styles.resumenZonasInfo}>
                      <View
                        style={[
                          styles.resumenDot,
                          { backgroundColor: "#4f46e5" },
                        ]}
                      />
                      <Text style={styles.resumenZonasLabel}>
                        Almacén del Punto:
                      </Text>
                    </View>
                    <Text style={styles.resumenZonasValue}>
                      {inventario.length} productos •{" "}
                      {formatMoneda(estadisticasZonas.valorAlmacenPunto)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalSeleccionarZona(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Transferencia */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalTransferencia}
        onRequestClose={() => {
          setModalTransferencia(false);
          resetFormularios();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalTransferencia]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transferir Producto</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalTransferencia(false);
                  resetFormularios();
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {productoSeleccionado && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.productoInfoModal}>
                  <View style={styles.productoInfoHeader}>
                    <Ionicons name="cube-outline" size={24} color="#3b82f6" />
                    <View style={styles.productoInfoText}>
                      <Text style={styles.productoInfoNombre}>
                        {productoSeleccionado.nombre}
                      </Text>
                      <Text style={styles.productoInfoCategoria}>
                        {productoSeleccionado.categoria} • Stock:{" "}
                        {productoSeleccionado.cantidad} unidades
                      </Text>
                    </View>
                  </View>
                  <View style={styles.productoInfoStats}>
                    <Text style={styles.productoInfoStat}>
                      Precio costo real:{" "}
                      {formatMoneda(
                        productoSeleccionado.precio_coste_real ||
                          productoSeleccionado.precio_coste,
                      )}
                    </Text>
                    <Text style={styles.productoInfoStat}>
                      Precio promedio:{" "}
                      {formatMoneda(productoSeleccionado.precio_coste)}
                    </Text>
                    {productoSeleccionado.fecha_caducidad && (
                      <Text style={styles.productoInfoStat}>
                        Vence:{" "}
                        {formatFecha(productoSeleccionado.fecha_caducidad)}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Tipo de transferencia *</Text>
                  <View style={styles.puntosContainer}>
                    <TouchableOpacity
                      style={[
                        styles.puntoOption,
                        tipoTransferencia === "punto" &&
                          styles.puntoOptionSelected,
                      ]}
                      onPress={() => {
                        setTipoTransferencia("punto");
                        setAlmacenDestino(null);
                      }}
                    >
                      <Ionicons
                        name="storefront-outline"
                        size={20}
                        color={
                          tipoTransferencia === "punto" ? "#3b82f6" : "#6b7280"
                        }
                      />
                      <Text
                        style={[
                          styles.puntoOptionText,
                          tipoTransferencia === "punto" &&
                            styles.puntoOptionTextSelected,
                        ]}
                      >
                        Transferir a Punto
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.puntoOption,
                        tipoTransferencia === "almacen" &&
                          styles.puntoOptionSelected,
                      ]}
                      onPress={() => {
                        setTipoTransferencia("almacen");
                        setPuntoDestino(null);
                      }}
                    >
                      <Ionicons
                        name="cube-outline"
                        size={20}
                        color={
                          tipoTransferencia === "almacen"
                            ? "#3b82f6"
                            : "#6b7280"
                        }
                      />
                      <Text
                        style={[
                          styles.puntoOptionText,
                          tipoTransferencia === "almacen" &&
                            styles.puntoOptionTextSelected,
                        ]}
                      >
                        Transferir a Almacén
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {tipoTransferencia === "punto" && (
                  <View style={styles.infoDestino}>
                    <View style={styles.infoDestinoItem}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#3b82f6"
                      />
                      <Text style={styles.infoDestinoText}>
                        Transferir a{" "}
                        <Text style={{ fontWeight: "600", color: "#059669" }}>
                          Zona de Venta
                        </Text>{" "}
                        para venta inmediata
                      </Text>
                    </View>
                  </View>
                )}

                {tipoTransferencia === "almacen" && (
                  <View style={styles.infoDestino}>
                    <View style={styles.infoDestinoItem}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#3b82f6"
                      />
                      <Text style={styles.infoDestinoText}>
                        Transferir a{" "}
                        <Text style={{ fontWeight: "600", color: "#8b5cf6" }}>
                          otro Almacén
                        </Text>{" "}
                        para reabastecimiento
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {tipoTransferencia === "punto"
                      ? "Punto de destino *"
                      : "Almacén de destino *"}
                  </Text>

                  {tipoTransferencia === "punto" && (
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setModalSeleccionarPunto(true)}
                    >
                      <Ionicons
                        name={
                          puntoDestino
                            ? "storefront-outline"
                            : "storefront-outline"
                        }
                        size={20}
                        color={puntoDestino ? "#3b82f6" : "#6b7280"}
                      />
                      <Text
                        style={[
                          styles.datePickerText,
                          !puntoDestino && styles.datePickerPlaceholder,
                        ]}
                      >
                        {puntoDestino
                          ? puntosDestino.find((p) => p.id === puntoDestino)
                              ?.nombre || "Punto seleccionado"
                          : "Seleccionar punto de destino"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  )}

                  {tipoTransferencia === "almacen" &&
                  almacenesParaTransferencia.length > 0 ? (
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() =>
                        setModalSeleccionarAlmacenTransferencia(true)
                      }
                    >
                      <Ionicons name="cube-outline" size={20} color="#6b7280" />
                      <Text
                        style={[
                          styles.datePickerText,
                          !almacenDestino && styles.datePickerPlaceholder,
                        ]}
                      >
                        {almacenDestino
                          ? almacenesParaTransferencia.find(
                              (a) => a.id === almacenDestino,
                            )?.nombre || "Almacén seleccionado"
                          : "Seleccionar almacén de destino"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  ) : tipoTransferencia === "almacen" &&
                    almacenesParaTransferencia.length === 0 ? (
                    <View style={styles.sinPuntosContainer}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={24}
                        color="#f59e0b"
                      />
                      <Text style={styles.sinPuntosText}>
                        No hay almacenes disponibles para transferencia
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Tipo de cantidad</Text>
                  <TouchableOpacity
                    style={[
                      styles.formInput,
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      },
                    ]}
                    onPress={() => setModalTipoCantidadTransferencia(true)}
                  >
                    <Text
                      style={{
                        color: tipoCantidadTransferencia
                          ? "#1f2937"
                          : "#9ca3af",
                      }}
                    >
                      {tipoCantidadTransferencia
                        ? tipoCantidadTransferencia.charAt(0).toUpperCase() +
                          tipoCantidadTransferencia.slice(1)
                        : "Seleccionar tipo de cantidad"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {tipoCantidadTransferencia === "unidades"
                      ? "Cantidad a transferir *"
                      : `Cantidad de ${
                          tipoCantidadTransferencia.charAt(0).toUpperCase() +
                          tipoCantidadTransferencia.slice(1)
                        } *`}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={cantidadTransferencia}
                    onChangeText={setCantidadTransferencia}
                    placeholder={
                      tipoCantidadTransferencia === "unidades"
                        ? "Ej: 10"
                        : `Ej: 5 ${tipoCantidadTransferencia.charAt(0).toUpperCase() + tipoCantidadTransferencia.slice(1)}`
                    }
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                  <Text style={styles.formHelp}>
                    Stock disponible: {productoSeleccionado.cantidad} unidades
                    {productoSeleccionado.formato_almacen &&
                      productoSeleccionado.unidades_por_formato && (
                        <Text>
                          {" "}
                          (≈{" "}
                          {Math.floor(
                            productoSeleccionado.cantidad /
                              productoSeleccionado.unidades_por_formato,
                          )}{" "}
                          {getFormatLabel(
                            productoSeleccionado.formato_almacen,
                            false,
                          )}{" "}
                          {Math.floor(
                            productoSeleccionado.cantidad /
                              productoSeleccionado.unidades_por_formato,
                          ) !== 1
                            ? "s"
                            : ""}
                        </Text>
                      )}
                    {!cantidadTransferencia?.trim() && (
                      <Text style={{ color: "#dc2626", fontSize: 12 }}>
                        {"\n⚠️ Ingrese la cantidad a transferir"}
                      </Text>
                    )}
                  </Text>
                </View>

                {tipoTransferencia === "punto" && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Precio de venta *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={precioVenta}
                      onChangeText={setPrecioVenta}
                      placeholder="Ej: 35.00"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.precioInfoContainer}>
                      <Text style={styles.formHelp}>
                        Precio costo real:{" "}
                        {formatMoneda(
                          productoSeleccionado.precio_coste_real ||
                            productoSeleccionado.precio_coste,
                        )}
                      </Text>
                      <Text style={styles.precioMaximoText}>
                        Máx:{" "}
                        {formatMoneda(
                          calcularPrecioMaximo(
                            productoSeleccionado.precio_coste_real ||
                              productoSeleccionado.precio_coste,
                          ),
                        )}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.resumenContainer}>
                  <Text style={styles.resumenTitle}>
                    Resumen de transferencia
                  </Text>
                  <View style={styles.resumenItem}>
                    <Text style={styles.resumenLabel}>Producto:</Text>
                    <Text style={styles.resumenValue}>
                      {productoSeleccionado.nombre}
                    </Text>
                  </View>
                  <View style={styles.resumenItem}>
                    <Text style={styles.resumenLabel}>Cantidad:</Text>
                    <Text style={styles.resumenValue}>
                      {cantidadTransferencia || 0}{" "}
                      {tipoCantidadTransferencia === "unidades"
                        ? "unidades"
                        : tipoCantidadTransferencia.charAt(0).toUpperCase() +
                          tipoCantidadTransferencia.slice(1)}
                      {tipoCantidadTransferencia !== "unidades" &&
                      productoSeleccionado.formato_almacen &&
                      productoSeleccionado.unidades_por_formato &&
                      cantidadTransferencia
                        ? ` (${parseInt(cantidadTransferencia) * productoSeleccionado.unidades_por_formato} unid. totales)`
                        : ""}
                    </Text>
                  </View>
                  <View style={styles.resumenItem}>
                    <Text style={styles.resumenLabel}>Precio costo real:</Text>
                    <Text style={styles.resumenValue}>
                      {formatMoneda(
                        productoSeleccionado.precio_coste_real ||
                          productoSeleccionado.precio_coste,
                      )}
                    </Text>
                  </View>
                  {tipoTransferencia === "punto" && (
                    <>
                      <View style={styles.resumenItem}>
                        <Text style={styles.resumenLabel}>Precio venta:</Text>
                        <Text
                          style={[
                            styles.resumenValue,
                            { color: "#059669", fontWeight: "600" },
                          ]}
                        >
                          {cantidadTransferencia && precioVenta
                            ? formatMoneda(
                                parseInt(cantidadTransferencia || "0") *
                                  parseFloat(precioVenta || "0"),
                              )
                            : "$0.00"}
                        </Text>
                      </View>
                      <View style={styles.resumenItem}>
                        <Text style={styles.resumenLabel}>
                          Ganancia estimada:
                        </Text>
                        <Text
                          style={[
                            styles.resumenValue,
                            { color: "#10b981", fontWeight: "600" },
                          ]}
                        >
                          {cantidadTransferencia && precioVenta
                            ? formatMoneda(
                                parseInt(cantidadTransferencia || "0") *
                                  parseFloat(precioVenta || "0") -
                                  parseInt(cantidadTransferencia || "0") *
                                    (productoSeleccionado.precio_coste_real ||
                                      productoSeleccionado.precio_coste),
                              )
                            : "$0.00"}
                        </Text>
                      </View>
                    </>
                  )}
                  <View style={styles.resumenItem}>
                    <Text style={styles.resumenLabel}>Destino:</Text>
                    <Text
                      style={[
                        styles.resumenValue,
                        {
                          color:
                            tipoTransferencia === "punto"
                              ? "#059669"
                              : "#8b5cf6",
                          fontWeight: "600",
                        },
                      ]}
                    >
                      {tipoTransferencia === "punto"
                        ? "Zona de Venta"
                        : "Otro Almacén"}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalTransferencia(false);
                  resetFormularios();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  console.log("🔘 BOTÓN PRINCIPAL PRESIONADO");
                  console.log("📊 tipoTransferencia:", tipoTransferencia);
                  console.log(
                    "🎯 tipoTransferencia === 'punto':",
                    tipoTransferencia === "punto",
                  );
                  console.log(
                    "🎯 tipoTransferencia === 'almacen':",
                    tipoTransferencia === "almacen",
                  );

                  if (tipoTransferencia === "punto") {
                    console.log("🔄 Ejecutando transferirProducto(1)");
                    transferirProducto(1);
                  } else {
                    console.log("🔄 Ejecutando transferirAAlmacen()");
                    transferirAAlmacen();
                  }
                }}
                disabled={(() => {
                  const puntoDisabled =
                    (tipoTransferencia === "punto" &&
                      (!puntoDestino ||
                        !cantidadTransferencia?.trim() ||
                        !precioVenta)) ||
                    (tipoTransferencia === "punto" &&
                      puntosDestino.length === 0);

                  const almacenDisabled =
                    tipoTransferencia === "almacen" &&
                    (!almacenDestino || !cantidadTransferencia?.trim());

                  const isDisabled = puntoDisabled || almacenDisabled;

                  console.log("🔍 ESTADO DEL BOTÓN:");
                  console.log("  - tipoTransferencia:", tipoTransferencia);
                  console.log("  - puntoDestino:", puntoDestino);
                  console.log("  - almacenDestino:", almacenDestino);
                  console.log(
                    "  - cantidadTransferencia:",
                    `"${cantidadTransferencia}"`,
                  );
                  console.log("  - precioVenta:", precioVenta);
                  console.log(
                    "  - puntosDestino.length:",
                    puntosDestino.length,
                  );
                  console.log("  - puntoDisabled:", puntoDisabled);
                  console.log("  - almacenDisabled:", almacenDisabled);
                  console.log("  - isDisabled:", isDisabled);
                  console.log("  - !almacenDestino:", !almacenDestino);
                  console.log(
                    "  - !cantidadTransferencia:",
                    !cantidadTransferencia,
                  );

                  return isDisabled;
                })()}
              >
                <Text style={styles.saveButtonText}>
                  {tipoTransferencia === "punto"
                    ? "Transferir a Venta"
                    : "Transferir"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Formulario de Producto */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalProductoForm}
        onRequestClose={() => {
          setModalProductoForm(false);
          resetFormulariosProducto();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalForm]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {formModoEdicion ? "Editar Producto" : "Nuevo Producto"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalProductoForm(false);
                  resetFormulariosProducto();
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nombre del Producto *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formNombre}
                  onChangeText={setFormNombre}
                  placeholder="Ej: Leche Entera"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.formHelp}>
                  Puede haber productos con el mismo nombre pero distinto precio
                  de coste y fecha de caducidad
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo de Producto *</Text>
                <View style={{ flexDirection: "row", gap: 15 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor:
                        formTipoProducto === "producto" ? "#dcfce7" : "#f3f4f6",
                      borderWidth: 1,
                      borderColor:
                        formTipoProducto === "producto" ? "#16a34a" : "#d1d5db",
                    }}
                    onPress={() => {
                      setFormTipoProducto("producto");
                      setFormCostoInsumo("");
                    }}
                  >
                    <Ionicons
                      name={
                        formTipoProducto === "producto"
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={20}
                      color={
                        formTipoProducto === "producto" ? "#16a34a" : "#6b7280"
                      }
                    />
                    <Text
                      style={{
                        color:
                          formTipoProducto === "producto"
                            ? "#16a34a"
                            : "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Producto
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor:
                        formTipoProducto === "insumo" ? "#fef3c7" : "#f3f4f6",
                      borderWidth: 1,
                      borderColor:
                        formTipoProducto === "insumo" ? "#f59e0b" : "#d1d5db",
                    }}
                    onPress={() => {
                      setFormTipoProducto("insumo");
                    }}
                  >
                    <Ionicons
                      name={
                        formTipoProducto === "insumo"
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={20}
                      color={
                        formTipoProducto === "insumo" ? "#f59e0b" : "#6b7280"
                      }
                    />
                    <Text
                      style={{
                        color:
                          formTipoProducto === "insumo" ? "#f59e0b" : "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Insumo
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.formHelp}>
                  {formTipoProducto === "insumo"
                    ? "Los insumos son productos comprados en formato (ej: sacos, cajas) cuyo precio se divide por unidades"
                    : "Los productos son artículos individuales con precio unitario directo"}
                </Text>
              </View>

              {formTipoProducto === "insumo" && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Costo Total del Insumo *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formCostoInsumo}
                    onChangeText={(text) => {
                      setFormCostoInsumo(text);
                      // Calcular automáticamente el precio de coste real
                      if (text && formUnidadesPorFormato && formCantidad) {
                        const costoTotal = parseFloat(text) || 0;
                        const unidadesPorFormato =
                          parseFloat(formUnidadesPorFormato) || 1;
                        const cantidad = parseInt(formCantidad) || 1;
                        const totalUnidades = cantidad * unidadesPorFormato;
                        const precioPorUnidad = costoTotal / totalUnidades;
                        setFormPrecioCoste(precioPorUnidad.toFixed(2));
                      }
                    }}
                    placeholder="Ej: 30000 (costo del saco completo)"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.formHelp}>
                    Ingresa el costo total del insumo (ej: 30000 por el saco
                    completo)
                  </Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Categoría *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formCategoria}
                  onChangeText={setFormCategoria}
                  placeholder="Ej: Lácteos"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Subcategoría (Opcional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={formSubcategoria}
                  onChangeText={setFormSubcategoria}
                  placeholder="Ej: Leche"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Descripción (Opcional)</Text>
                <TextInput
                  style={[styles.formInput, { height: 80 }]}
                  value={formDescripcion}
                  onChangeText={setFormDescripcion}
                  placeholder="Ej: Producto lácteo fresco, ideal para el consumo diario..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <Text style={styles.formHelp}>
                  Información adicional sobre el producto (características,
                  usos, etc.)
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Precio de Coste REAL *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    formTipoProducto === "insumo" && {
                      backgroundColor: "#f3f4f6",
                    },
                  ]}
                  value={formPrecioCoste}
                  onChangeText={setFormPrecioCoste}
                  placeholder={
                    formTipoProducto === "insumo"
                      ? "Se calcula automáticamente"
                      : "Ej: 25.50"
                  }
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  editable={formTipoProducto !== "insumo"}
                />
                <Text style={styles.formHelp}>
                  {formTipoProducto === "insumo"
                    ? "Este precio se calcula automáticamente dividiendo el costo total entre las unidades totales"
                    : "Este precio se guardará individualmente en la base de datos para contabilidad"}
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Cantidad Inicial *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formCantidad}
                  onChangeText={(text) => {
                    setFormCantidad(text);
                    // Recalcular precio de coste si es insumo
                    if (
                      formTipoProducto === "insumo" &&
                      formCostoInsumo &&
                      formUnidadesPorFormato
                    ) {
                      const costoTotal = parseFloat(formCostoInsumo) || 0;
                      const unidadesPorFormato =
                        parseFloat(formUnidadesPorFormato) || 1;
                      const cantidad = parseInt(text) || 1;
                      const totalUnidades = cantidad * unidadesPorFormato;
                      const precioPorUnidad = costoTotal / totalUnidades;
                      setFormPrecioCoste(precioPorUnidad.toFixed(2));
                    }
                  }}
                  placeholder={
                    formFormatoAlmacen
                      ? `Ej: 4 ${getFormatLabel(formFormatoAlmacen, true)}`
                      : "Ej: 10"
                  }
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
                <Text style={styles.formHelp}>
                  {formFormatoAlmacen && formUnidadesPorFormato
                    ? `Cantidad de ${getFormatLabel(
                        formFormatoAlmacen,
                        true,
                      )} que reciben (${parseInt(formCantidad || "0") * parseInt(formUnidadesPorFormato || "0")} unidades totales)`
                    : "Cantidad de unidades que ingresan al almacén"}
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Formato de Almacenamiento</Text>
                <TouchableOpacity
                  style={[
                    styles.formInput,
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                  ]}
                  onPress={() => setModalFormatoAlmacenamiento(true)}
                >
                  <Text
                    style={{
                      color: formFormatoAlmacen ? "#1f2937" : "#9ca3af",
                    }}
                  >
                    {formFormatoAlmacen
                      ? formFormatoAlmacen.charAt(0).toUpperCase() +
                        formFormatoAlmacen.slice(1)
                      : "Seleccionar formato"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              {formFormatoAlmacen && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Unidades por {getFormatLabel(formFormatoAlmacen, false)} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formUnidadesPorFormato}
                    onChangeText={(text) => {
                      setFormUnidadesPorFormato(text);
                      // Recalcular precio de coste si es insumo
                      if (
                        formTipoProducto === "insumo" &&
                        formCostoInsumo &&
                        formCantidad
                      ) {
                        const costoTotal = parseFloat(formCostoInsumo) || 0;
                        const unidadesPorFormato = parseFloat(text) || 1;
                        const cantidad = parseInt(formCantidad) || 1;
                        const totalUnidades = cantidad * unidadesPorFormato;
                        const precioPorUnidad = costoTotal / totalUnidades;
                        setFormPrecioCoste(precioPorUnidad.toFixed(2));
                      }
                    }}
                    placeholder={`Ej: 24 unidades por ${getFormatLabel(
                      formFormatoAlmacen,
                      false,
                    )}`}
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                  <Text style={styles.formHelp}>
                    Cuántas unidades contiene cada{" "}
                    {getFormatLabel(formFormatoAlmacen, false)}
                  </Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fecha de Caducidad *</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                  <Text
                    style={[
                      styles.datePickerText,
                      !formFechaCaducidad && styles.datePickerPlaceholder,
                    ]}
                  >
                    {formFechaCaducidad
                      ? formatFecha(formFechaCaducidad)
                      : "Seleccionar fecha"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6b7280" />
                </TouchableOpacity>
                {formFechaCaducidad && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => {
                      setFormFechaCaducidad("");
                      setSelectedDate(new Date());
                    }}
                  >
                    <Ionicons name="close-circle" size={16} color="#9ca3af" />
                    <Text style={styles.clearDateText}>Limpiar fecha</Text>
                  </TouchableOpacity>
                )}
              </View>

              {formModoEdicion && productoSeleccionado && (
                <View style={styles.infoAdicional}>
                  <Text style={styles.infoTitulo}>Información Actual</Text>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Stock actual:</Text>
                    <Text style={styles.infoValue}>
                      {productoSeleccionado.cantidad} unidades
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Precio costo real:</Text>
                    <Text style={styles.infoValue}>
                      {formatMoneda(
                        productoSeleccionado.precio_coste_real ||
                          productoSeleccionado.precio_coste,
                      )}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      Precio promedio actual:
                    </Text>
                    <Text style={styles.infoValue}>
                      {formatMoneda(productoSeleccionado.precio_coste)}
                    </Text>
                  </View>
                  {productoSeleccionado.dias_restantes !== undefined && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Días restantes:</Text>
                      <Text
                        style={[
                          styles.infoValue,
                          { color: getColorFecha(productoSeleccionado) },
                        ]}
                      >
                        {productoSeleccionado.dias_restantes} días
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalProductoForm(false);
                  resetFormulariosProducto();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={guardarProducto}
                disabled={
                  !formNombre.trim() ||
                  !formCategoria.trim() ||
                  !formPrecioCoste ||
                  !formCantidad ||
                  !formFechaCaducidad ||
                  (formTipoProducto === "insumo" && !formCostoInsumo)
                }
              >
                <Text style={styles.saveButtonText}>
                  {formModoEdicion ? "Actualizar" : "Crear"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Eliminar Producto */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEliminarProducto}
        onRequestClose={() => {
          setModalEliminarProducto(false);
          resetFormularios();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalEliminar]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Eliminar Producto</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalEliminarProducto(false);
                  resetFormularios();
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {productoSeleccionado && (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.alertaEliminar}>
                  <Ionicons name="warning-outline" size={48} color="#ef4444" />
                  <Text style={styles.alertaEliminarTitulo}>
                    ¿Eliminar &quot;{productoSeleccionado.nombre}&quot;?
                  </Text>
                  <Text style={styles.alertaEliminarTexto}>
                    Esta acción eliminará el producto solo de este almacén
                    específico. El producto seguirá existiendo en otros
                    almacenes si tiene stock allí.
                    {productoSeleccionado.cantidad > 0 && (
                      <Text style={{ color: "#dc2626", fontWeight: "600" }}>
                        Se eliminarán {productoSeleccionado.cantidad} unidades
                        de este almacén.
                      </Text>
                    )}
                  </Text>

                  <View style={styles.detallesEliminar}>
                    <View style={styles.detalleEliminarItem}>
                      <Text style={styles.detalleEliminarLabel}>
                        Categoría:
                      </Text>
                      <Text style={styles.detalleEliminarValue}>
                        {productoSeleccionado.categoria}
                      </Text>
                    </View>
                    <View style={styles.detalleEliminarItem}>
                      <Text style={styles.detalleEliminarLabel}>Stock:</Text>
                      <Text
                        style={[
                          styles.detalleEliminarValue,
                          {
                            color: getColorStock(productoSeleccionado.cantidad),
                          },
                        ]}
                      >
                        {productoSeleccionado.cantidad} unidades
                      </Text>
                    </View>
                    <View style={styles.detalleEliminarItem}>
                      <Text style={styles.detalleEliminarLabel}>
                        Precio costo real:
                      </Text>
                      <Text style={styles.detalleEliminarValue}>
                        {formatMoneda(
                          productoSeleccionado.precio_coste_real ||
                            productoSeleccionado.precio_coste,
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalEliminarProducto(false);
                  resetFormularios();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={eliminarProducto}
              >
                <Ionicons name="trash-outline" size={16} color="white" />
                <Text style={[styles.saveButtonText, { marginLeft: 8 }]}>
                  Eliminar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Productos Vencidos/Próximos a Vencer */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalProductosVencidos}
        onRequestClose={() => setModalProductosVencidos(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalAlertas]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alertas de Productos</Text>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Productos vencidos */}
              {productosVencidos.length > 0 && (
                <View style={styles.alertaSection}>
                  <View
                    style={[
                      styles.alertaHeader,
                      { backgroundColor: "#fee2e2" },
                    ]}
                  >
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color="#dc2626"
                    />
                    <Text style={[styles.alertaTitle, { color: "#dc2626" }]}>
                      Productos Vencidos ({productosVencidos.length})
                    </Text>
                  </View>
                  {productosVencidos.map((producto) => (
                    <View key={producto.id} style={styles.alertaItem}>
                      <View style={styles.alertaItemInfo}>
                        <Text style={styles.alertaItemNombre}>
                          {producto.nombre}
                        </Text>
                        <Text style={styles.alertaItemDetalle}>
                          Vencido hace {Math.abs(producto.dias_restantes || 0)}{" "}
                          días • Stock: {formatearCantidad(producto.cantidad)}{" "}
                          unidades
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.alertaItemAction}
                        onPress={() => {
                          setProductoSeleccionado(producto);
                          setModalProductosVencidos(false);
                          abrirFormularioEdicion(producto);
                        }}
                      >
                        <Text style={styles.alertaItemActionText}>Editar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Productos próximos a vencer */}
              {productosPorVencer.length > 0 && (
                <View style={styles.alertaSection}>
                  <View
                    style={[
                      styles.alertaHeader,
                      { backgroundColor: "#fef3c7" },
                    ]}
                  >
                    <Ionicons name="time-outline" size={20} color="#d97706" />
                    <Text style={[styles.alertaTitle, { color: "#d97706" }]}>
                      Por Vencer en 30 días ({productosPorVencer.length})
                    </Text>
                  </View>
                  {productosPorVencer.map((producto) => (
                    <View key={producto.id} style={styles.alertaItem}>
                      <View style={styles.alertaItemInfo}>
                        <Text style={styles.alertaItemNombre}>
                          {producto.nombre}
                        </Text>
                        <Text style={styles.alertaItemDetalle}>
                          Vence en {producto.dias_restantes} días • Stock:{" "}
                          {formatearCantidad(producto.cantidad)} unidades
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.alertaItemAction,
                          { backgroundColor: "#3b82f6" },
                        ]}
                        onPress={() => {
                          setProductoSeleccionado(producto);
                          setModalProductosVencidos(false);
                          abrirModalTransferencia(producto);
                        }}
                      >
                        <Text
                          style={[
                            styles.alertaItemActionText,
                            { color: "white" },
                          ]}
                        >
                          Transferir
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Productos con stock bajo */}
              {productosStockBajo.length > 0 && (
                <View style={styles.alertaSection}>
                  <View
                    style={[
                      styles.alertaHeader,
                      { backgroundColor: "#dbeafe" },
                    ]}
                  >
                    <Ionicons
                      name="trending-down-outline"
                      size={20}
                      color="#3b82f6"
                    />
                    <Text style={[styles.alertaTitle, { color: "#3b82f6" }]}>
                      Stock Bajo ({productosStockBajo.length})
                    </Text>
                  </View>
                  {productosStockBajo.map((producto) => (
                    <View key={producto.id} style={styles.alertaItem}>
                      <View style={styles.alertaItemInfo}>
                        <Text style={styles.alertaItemNombre}>
                          {producto.nombre}
                        </Text>
                        <Text style={styles.alertaItemDetalle}>
                          Stock: {formatearCantidad(producto.cantidad)} unidades
                          • Categoría: {producto.categoria}
                        </Text>
                      </View>
                      <View style={styles.alertaItemStock}>
                        <Text
                          style={[
                            styles.alertaItemStockText,
                            { color: "#dc2626" },
                          ]}
                        >
                          BAJO
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {productosVencidos.length === 0 &&
                productosPorVencer.length === 0 &&
                productosStockBajo.length === 0 && (
                  <View style={styles.emptyAlertasContainer}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={64}
                      color="#10b981"
                    />
                    <Text style={styles.emptyAlertasTitle}>
                      ¡Todo en orden!
                    </Text>
                    <Text style={styles.emptyAlertasText}>
                      No hay productos vencidos, por vencer o con stock bajo
                    </Text>
                  </View>
                )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalProductosVencidos(false)}
              >
                <Text style={styles.cancelButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Punto */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalSeleccionarPunto}
        onRequestClose={() => setModalSeleccionarPunto(false)}
      >
        <View style={styles.puntoSelectModalOverlay}>
          <View style={styles.puntoSelectModalContent}>
            <Text style={styles.puntoSelectTitle}>Seleccionar Punto</Text>
            <FlatList
              data={puntosDestino}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item: punto }) => (
                <TouchableOpacity
                  style={[
                    styles.zonaOption,
                    puntoDestino === punto.id && styles.puntoOptionSelected,
                  ]}
                  onPress={() => {
                    setPuntoDestino(punto.id);
                    setModalSeleccionarPunto(false);
                  }}
                >
                  <View style={styles.zonaIcon}>
                    <Ionicons
                      name={
                        punto.tipo_negocio === "panaderia"
                          ? "restaurant-outline"
                          : "storefront-outline"
                      }
                      size={24}
                      color={puntoDestino === punto.id ? "#3b82f6" : "#6b7280"}
                    />
                  </View>
                  <View style={styles.zonaInfo}>
                    <Text style={styles.zonaTitle}>{punto.nombre}</Text>
                    <Text style={styles.zonaDescription}>
                      Tipo: {punto.tipo_negocio || "General"}
                    </Text>
                    {punto.id === puntoActual?.id && (
                      <Text style={[styles.zonaDetalle, { color: "#f59e0b" }]}>
                        Punto actual
                      </Text>
                    )}
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Ionicons
                      name={
                        puntoDestino === punto.id
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={20}
                      color={puntoDestino === punto.id ? "#3b82f6" : "#d1d5db"}
                    />
                  </View>
                </TouchableOpacity>
              )}
              style={styles.puntoSelectList}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <View style={styles.sinPuntosContainer}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color="#f59e0b"
                  />
                  <Text style={styles.sinPuntosText}>
                    No hay puntos disponibles
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>
      {/* Modal de Selección de Almacén */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalSeleccionarAlmacen}
        onRequestClose={() => setModalSeleccionarAlmacen(false)}
      >
        <View style={styles.almacenSelectModalOverlay}>
          <View style={styles.almacenSelectModalContent}>
            <Text style={styles.almacenSelectTitle}>Seleccionar Almacén</Text>
            <FlatList
              data={almacenesParaCorreccion}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item: almacen }) => (
                <TouchableOpacity
                  style={[
                    styles.zonaOption,
                    almacenDestino === almacen.id && styles.puntoOptionSelected,
                  ]}
                  onPress={() => {
                    setAlmacenDestino(almacen.id);
                    setModalSeleccionarAlmacen(false);
                  }}
                >
                  <View style={styles.zonaIcon}>
                    <Ionicons
                      name="cube-outline"
                      size={24}
                      color={
                        almacenDestino === almacen.id ? "#3b82f6" : "#6b7280"
                      }
                    />
                  </View>
                  <View style={styles.zonaInfo}>
                    <Text style={styles.zonaTitle}>{almacen.nombre}</Text>
                    {almacen.descripcion && (
                      <Text style={styles.zonaDescription}>
                        {almacen.descripcion}
                      </Text>
                    )}
                    {almacen.ubicacion && (
                      <Text style={styles.zonaDetalle}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color="#9ca3af"
                        />{" "}
                        {almacen.ubicacion}
                      </Text>
                    )}
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Ionicons
                      name={
                        almacenDestino === almacen.id
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={20}
                      color={
                        almacenDestino === almacen.id ? "#3b82f6" : "#d1d5db"
                      }
                    />
                  </View>
                </TouchableOpacity>
              )}
              style={styles.almacenSelectList}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <View style={styles.sinPuntosContainer}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color="#f59e0b"
                  />
                  <Text style={styles.sinPuntosText}>
                    No hay almacenes disponibles
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Almacén para Transferencias */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalSeleccionarAlmacenTransferencia}
        onRequestClose={() => setModalSeleccionarAlmacenTransferencia(false)}
      >
        <View style={styles.almacenSelectModalOverlay}>
          <View style={styles.almacenSelectModalContent}>
            <Text style={styles.almacenSelectTitle}>
              Seleccionar Almacén de Destino
            </Text>
            <FlatList
              data={almacenesParaTransferencia}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item: almacen }) => (
                <TouchableOpacity
                  style={[
                    styles.zonaOption,
                    almacenDestino === almacen.id && styles.puntoOptionSelected,
                  ]}
                  onPress={() => {
                    setAlmacenDestino(almacen.id);
                    setModalSeleccionarAlmacenTransferencia(false);
                  }}
                >
                  <View style={styles.zonaIcon}>
                    <Ionicons
                      name="cube-outline"
                      size={24}
                      color={
                        almacenDestino === almacen.id ? "#3b82f6" : "#6b7280"
                      }
                    />
                  </View>
                  <View style={styles.zonaInfo}>
                    <Text style={styles.zonaTitle}>{almacen.nombre}</Text>
                    {almacen.descripcion && (
                      <Text style={styles.zonaDescription}>
                        {almacen.descripcion}
                      </Text>
                    )}
                    {almacen.ubicacion && (
                      <Text style={styles.zonaDetalle}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color="#9ca3af"
                        />{" "}
                        {almacen.ubicacion}
                      </Text>
                    )}
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Ionicons
                      name={
                        almacenDestino === almacen.id
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={20}
                      color={
                        almacenDestino === almacen.id ? "#3b82f6" : "#d1d5db"
                      }
                    />
                  </View>
                </TouchableOpacity>
              )}
              style={styles.almacenSelectList}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <View style={styles.sinPuntosContainer}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color="#f59e0b"
                  />
                  <Text style={styles.sinPuntosText}>
                    No hay almacenes disponibles para transferencia
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de Historial de Movimientos - Diseño Compacto */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalHistorial}
        onRequestClose={() => setModalHistorial(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View
            style={[
              styles.modalContainer,
              {
                maxHeight: "85%",
                margin: 20,
                width: "92%",
                maxWidth: 520,
                alignSelf: "center",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Historial -{" "}
                {puntoActual
                  ? puntoActual.nombre
                  : almacenActual
                    ? almacenActual.nombre
                    : "Almacén General"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButtonX}
                onPress={() => setModalHistorial(false)}
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {/* Filtro por fecha */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Filtrar por fecha</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePickerHistorial(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                  <Text style={styles.datePickerText}>
                    {fechaDesdeFiltro
                      ? `Desde: ${fechaDesdeFiltro.toLocaleDateString("es-ES")}`
                      : "Seleccionar fecha"}
                  </Text>
                  {fechaDesdeFiltro && (
                    <TouchableOpacity
                      style={styles.clearDateButton}
                      onPress={() => {
                        setFechaDesdeFiltro(null);
                        cargarHistorial({
                          ...historialFiltros,
                          fecha_inicio: undefined,
                        });
                      }}
                    >
                      <Ionicons name="close-circle" size={16} color="#6b7280" />
                      <Text style={styles.clearDateText}>Limpiar</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* Filtro por tipo de movimiento */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Filtrar por tipo</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filtroOptionsScroll}
                  contentContainerStyle={styles.filtroOptionsContent}
                >
                  <TouchableOpacity
                    style={[
                      styles.filtroOption,
                      tipoMovimientoFiltro === "todos" &&
                        styles.filtroOptionActive,
                    ]}
                    onPress={() => {
                      const nuevosFiltros = {
                        ...historialFiltros,
                        tipo_movimiento: undefined,
                      };
                      setTipoMovimientoFiltro("todos");
                      setHistorialFiltros(nuevosFiltros);
                      cargarHistorial(nuevosFiltros, true); // reiniciar página
                    }}
                  >
                    <Text
                      style={[
                        styles.filtroOptionText,
                        tipoMovimientoFiltro === "todos" &&
                          styles.filtroOptionTextActive,
                      ]}
                    >
                      Todos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filtroOption,
                      tipoMovimientoFiltro === "creacion" &&
                        styles.filtroOptionActive,
                    ]}
                    onPress={() => {
                      const nuevosFiltros = {
                        ...historialFiltros,
                        tipo_movimiento: "creacion",
                      };
                      setTipoMovimientoFiltro("creacion");
                      setHistorialFiltros(nuevosFiltros);
                      cargarHistorial(nuevosFiltros, true); // reiniciar página
                    }}
                  >
                    <Text
                      style={[
                        styles.filtroOptionText,
                        tipoMovimientoFiltro === "creacion" &&
                          styles.filtroOptionTextActive,
                      ]}
                    >
                      Creación
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filtroOption,
                      tipoMovimientoFiltro === "ajuste" &&
                        styles.filtroOptionActive,
                    ]}
                    onPress={() => {
                      const nuevosFiltros = {
                        ...historialFiltros,
                        tipo_movimiento: "ajuste",
                      };
                      setTipoMovimientoFiltro("ajuste");
                      setHistorialFiltros(nuevosFiltros);
                      cargarHistorial(nuevosFiltros, true); // reiniciar página
                    }}
                  >
                    <Text
                      style={[
                        styles.filtroOptionText,
                        tipoMovimientoFiltro === "ajuste" &&
                          styles.filtroOptionTextActive,
                      ]}
                    >
                      Ajuste
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filtroOption,
                      tipoMovimientoFiltro === "transferencia" &&
                        styles.filtroOptionActive,
                    ]}
                    onPress={() => {
                      const nuevosFiltros = {
                        ...historialFiltros,
                        tipo_movimiento: "transferencia",
                      };
                      setTipoMovimientoFiltro("transferencia");
                      setHistorialFiltros(nuevosFiltros);
                      cargarHistorial(nuevosFiltros, true); // reiniciar página
                    }}
                  >
                    <Text
                      style={[
                        styles.filtroOptionText,
                        tipoMovimientoFiltro === "transferencia" &&
                          styles.filtroOptionTextActive,
                      ]}
                    >
                      Transferencia
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Botón de limpiar filtros */}
              <View style={styles.formGroup}>
                <TouchableOpacity
                  onPress={() => {
                    setHistorialFiltros({});
                    setFechaDesdeFiltro(null);
                    setTipoMovimientoFiltro("todos");
                    cargarHistorial({});
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 20,
                    marginRight: 8,
                  }}
                >
                  <Ionicons name="refresh-outline" size={14} color="#6b7280" />
                  <Text style={styles.limpiarFiltrosText}>Limpiar filtros</Text>
                </TouchableOpacity>
              </View>

              {/* Lista de movimientos optimizada */}
              {loadingHistorial ? (
                <View style={{ padding: 30, alignItems: "center" }}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text
                    style={{ marginTop: 12, color: "#6b7280", fontSize: 14 }}
                  >
                    Cargando...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={historialMovimientos.filter((movimiento) => {
                    // Filtrar por fecha si está seleccionada
                    if (fechaDesdeFiltro) {
                      const fechaMovimiento = new Date(movimiento.creado_en);
                      const fechaFiltro = new Date(fechaDesdeFiltro);
                      fechaFiltro.setHours(0, 0, 0, 0);
                      return fechaMovimiento >= fechaFiltro;
                    }

                    return true;
                  })}
                  keyExtractor={(item, index) =>
                    `${item.id}-${item.tipo}-${index}`
                  }
                  style={{ maxHeight: 280 }}
                  onEndReached={() => {
                    if (
                      !loadingHistorial &&
                      !loadingMasHistorial &&
                      hayMasDatos
                    ) {
                      cargarHistorial(historialFiltros, false); // no reiniciar página
                    }
                  }}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={() => {
                    if (loadingMasHistorial) {
                      return (
                        <View style={{ padding: 20 }}>
                          <ActivityIndicator size="small" color="#3b82f6" />
                          <Text style={{ marginLeft: 10, color: "#6b7280" }}>
                            Cargando más...
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  }}
                  renderItem={({ item }) => {
                    // Debug para ver qué datos llegan
                    console.log("🔍 DEBUG Item historial:", {
                      id: item.id,
                      producto_nombre: item.producto_nombre,
                      tipo_movimiento: item.tipo_movimiento,
                      cantidad_variacion: item.cantidad_variacion,
                      stock_anterior: item.stock_anterior,
                      stock_nuevo: item.stock_nuevo,
                      entidad_origen_destino: item.entidad_origen_destino,
                    });

                    if (
                      item.tipo === "transferencia_punto" ||
                      item.tipo === "transferencia_almacen"
                    ) {
                      console.log(
                        `🔍 DEBUG Transferencia ${item.producto_nombre}:`,
                        {
                          tipo: item.tipo,
                          cantidad: item.cantidad,
                          cantidad_antes: item.cantidad_antes,
                          cantidad_despues: item.cantidad_despues,
                          punto_destino: item.punto_destino_nombre,
                          almacen_destino: item.almacen_destino_nombre,
                        },
                      );
                    }

                    // Para transferencias, usar el stock_nuevo directamente del HistorialInventario
                    let stockRestante = 0;
                    if (
                      item.tipo_movimiento === "transferencia" &&
                      item.producto_nombre
                    ) {
                      stockRestante = item.stock_nuevo || 0;
                    }

                    // Para correcciones, usar el stock_nuevo directamente del HistorialInventario
                    if (
                      item.tipo_movimiento === "ajuste" &&
                      item.producto_nombre
                    ) {
                      stockRestante = item.stock_nuevo || 0;
                    }

                    // Determinar icono y colores según el tipo de movimiento
                    let icono: keyof typeof Ionicons.glyphMap = "cube-outline";
                    let colorFondo = "#f3f4f6";
                    let colorTexto = "#6b7280";
                    let textoTipo = "OTRO";
                    let descripcionMovimiento = "";

                    if (item.tipo_movimiento === "transferencia") {
                      icono = "arrow-forward-outline";
                      colorFondo = "#dbeafe";
                      colorTexto = "#1d4ed8";
                      textoTipo = "TRANSFERENCIA";
                      const cantidadTransferida = Math.abs(
                        item.cantidad_variacion,
                      );
                      const destino =
                        item.entidad_origen_destino &&
                        item.entidad_origen_destino !== "Destino"
                          ? item.entidad_origen_destino
                          : item.punto_destino_nombre ||
                            item.almacen_destino_nombre ||
                            "Destino";
                      const stockTotal = item.stock_total || item.stock_nuevo;

                      if (item.cantidad_variacion < 0) {
                        // Salida: Transferido
                        descripcionMovimiento = `Transferido: ${cantidadTransferida} unidades hacia ${destino} | Stock: ${item.stock_anterior} → ${item.stock_nuevo} (Total: ${stockTotal} unidades)`;
                      } else {
                        // Entrada: Recibido
                        descripcionMovimiento = `Recibido: ${cantidadTransferida} unidades desde ${destino} | Stock: ${item.stock_anterior} → ${item.stock_nuevo} (Total: ${stockTotal} unidades)`;
                      }
                    } else if (item.tipo_movimiento === "venta") {
                      icono = "cart-outline";
                      colorFondo = "#fee2e2";
                      colorTexto = "#dc2626";
                      textoTipo = "VENTA";
                      const variacion =
                        item.cantidad_variacion > 0
                          ? `+${item.cantidad_variacion}`
                          : `${item.cantidad_variacion}`;
                      descripcionMovimiento = `${variacion} unidades vendidas | Stock: ${item.stock_anterior} → ${item.stock_nuevo}`;
                    } else if (item.tipo_movimiento === "ajuste") {
                      icono = "refresh-outline";
                      colorFondo = "#e0e7ff";
                      colorTexto = "#3730a3";
                      textoTipo = "AJUSTE";
                      const variacion =
                        item.cantidad_variacion > 0
                          ? `+${item.cantidad_variacion}`
                          : `${item.cantidad_variacion}`;
                      descripcionMovimiento = `${variacion} unidades (ajuste) | Stock: ${item.stock_anterior} → ${item.stock_nuevo}`;
                    } else if (item.tipo_movimiento === "cierre") {
                      icono = "clipboard-outline";
                      colorFondo = "#fef3c7";
                      colorTexto = "#92400e";
                      textoTipo = "CIERRE";
                      const variacion =
                        item.cantidad_variacion > 0
                          ? `+${item.cantidad_variacion}`
                          : `${item.cantidad_variacion}`;
                      descripcionMovimiento = `${variacion} unidades (cierre) | Stock: ${item.stock_anterior} → ${item.stock_nuevo}`;
                    } else if (item.tipo_movimiento === "devolucion") {
                      icono = "arrow-back-outline";
                      colorFondo = "#dcfce7";
                      colorTexto = "#166534";
                      textoTipo = "DEVOLUCIÓN";
                      const variacion =
                        item.cantidad_variacion > 0
                          ? `+${item.cantidad_variacion}`
                          : `${item.cantidad_variacion}`;
                      descripcionMovimiento = `${variacion} unidades devueltas | Stock: ${item.stock_anterior} → ${item.stock_nuevo}`;
                    } else if (item.tipo_movimiento === "merma") {
                      icono = "trash-outline";
                      colorFondo = "#fecaca";
                      colorTexto = "#b91c1c";
                      textoTipo = "MERMA";
                      const variacion =
                        item.cantidad_variacion > 0
                          ? `+${item.cantidad_variacion}`
                          : `${item.cantidad_variacion}`;
                      descripcionMovimiento = `${variacion} unidades (merma) | Stock: ${item.stock_anterior} → ${item.stock_nuevo}`;
                    } else if (item.tipo_movimiento === "produccion") {
                      icono = "construct-outline";
                      colorFondo = "#f0fdf4";
                      colorTexto = "#166534";
                      textoTipo = "PRODUCCIÓN";
                      const variacion =
                        item.cantidad_variacion > 0
                          ? `+${item.cantidad_variacion}`
                          : `${item.cantidad_variacion}`;
                      descripcionMovimiento = `${variacion} unidades producidas | Stock: ${item.stock_anterior} → ${item.stock_nuevo}`;
                    } else if (item.tipo_movimiento === "creacion") {
                      icono = "add-circle-outline";
                      colorFondo = "#dcfce7";
                      colorTexto = "#166534";
                      textoTipo = "CREACIÓN";
                      const cantidadCreada = Math.abs(item.cantidad_variacion);
                      const stockTotal = item.stock_total || item.stock_nuevo;
                      descripcionMovimiento = `Entró: ${cantidadCreada} unidades | Stock: ${item.stock_anterior} → ${item.stock_nuevo} (Total: ${stockTotal} unidades)`;
                    } else {
                      // Default case for unknown types
                      const variacion =
                        item.cantidad_variacion > 0
                          ? `+${item.cantidad_variacion}`
                          : `${item.cantidad_variacion}`;
                      descripcionMovimiento = `${variacion} unidades | Stock: ${item.stock_anterior} → ${item.stock_nuevo}`;
                    }

                    return (
                      <View
                        style={{
                          backgroundColor: "#f9fafb",
                          padding: 12,
                          borderRadius: 8,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 4,
                              }}
                            >
                              <Ionicons
                                name={icono}
                                size={16}
                                color={colorTexto}
                                style={{ marginRight: 6 }}
                              />
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: "600",
                                  color: "#1f2937",
                                  flex: 1,
                                }}
                                numberOfLines={1}
                              >
                                {item.producto_nombre}
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                marginLeft: 22,
                              }}
                              numberOfLines={1}
                            >
                              {item.producto_categoria}
                            </Text>
                            {descripcionMovimiento && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: colorTexto,
                                  marginLeft: 22,
                                  marginTop: 2,
                                  fontStyle: "italic",
                                }}
                                numberOfLines={1}
                              >
                                {descripcionMovimiento}
                              </Text>
                            )}
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 10,
                              backgroundColor: colorFondo,
                              alignItems: "center",
                              minWidth: 60,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: colorTexto,
                                textTransform: "uppercase",
                              }}
                            >
                              {textoTipo}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 8,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: "#f3f4f6",
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            {/* Mostrar variación y stock final */}
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 2,
                              }}
                            >
                              <Ionicons
                                name="trending-up-outline"
                                size={12}
                                color={
                                  item.cantidad_variacion >= 0
                                    ? "#059669"
                                    : "#dc2626"
                                }
                                style={{ marginRight: 4 }}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color:
                                    item.cantidad_variacion >= 0
                                      ? "#059669"
                                      : "#dc2626",
                                }}
                              >
                                Variación:{" "}
                                {item.cantidad_variacion >= 0 ? "+" : ""}
                                {item.cantidad_variacion} unidades
                              </Text>
                            </View>

                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 2,
                              }}
                            >
                              <Ionicons
                                name="cube-outline"
                                size={12}
                                color="#6b7280"
                                style={{ marginRight: 4 }}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: "#6b7280",
                                }}
                              >
                                Stock final: {item.stock_nuevo} unidades
                              </Text>
                            </View>

                            {/* Mostrar notas adicionales si existen */}
                            {item.notas && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "flex-start",
                                  marginTop: 2,
                                }}
                              >
                                <Ionicons
                                  name="information-circle-outline"
                                  size={12}
                                  color="#9ca3af"
                                  style={{ marginRight: 4, marginTop: 1 }}
                                />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: "#9ca3af",
                                    flex: 1,
                                    fontStyle: "italic",
                                  }}
                                  numberOfLines={2}
                                >
                                  {item.notas}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Botones de acción */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            {/* Botón de corrección para transferencias */}
                            {item.tipo_movimiento === "transferencia" && (
                              <TouchableOpacity
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  backgroundColor: "#fef3c7",
                                  borderRadius: 6,
                                  marginRight: 8,
                                }}
                                onPress={() => abrirModalCorreccion(item)}
                              >
                                <Ionicons
                                  name="refresh-outline"
                                  size={12}
                                  color="#d97706"
                                />
                                <Text
                                  style={{
                                    fontSize: 10,
                                    color: "#d97706",
                                    fontWeight: "600",
                                    marginLeft: 4,
                                  }}
                                >
                                  Corregir
                                </Text>
                              </TouchableOpacity>
                            )}

                            <Text
                              style={{
                                fontSize: 10,
                                color: "#9ca3af",
                                marginRight: 8,
                              }}
                            >
                              {formatFecha(item.creado_en.split("T")[0])}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                />
              )}

              {historialMovimientos.length === 0 && !loadingHistorial && (
                <View
                  style={{
                    alignItems: "center",
                    paddingVertical: 30,
                    paddingHorizontal: 20,
                  }}
                >
                  <Ionicons name="time-outline" size={40} color="#d1d5db" />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#6b7280",
                      marginTop: 12,
                      textAlign: "center",
                    }}
                  >
                    No hay movimientos
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Los movimientos aparecerán aquí
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Corrección de Transferencia */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalCorreccionTransferencia}
        onRequestClose={() => {
          setModalCorreccionTransferencia(false);
          resetFormularios();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalForm]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Corregir</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalCorreccionTransferencia(false);
                  resetFormularios();
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {transferenciaSeleccionada && (
              <ScrollView style={styles.modalContent}>
                {/* Información de la transferencia original */}
                <View style={styles.productoInfoModal}>
                  <View style={styles.productoInfoHeader}>
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color="#3b82f6"
                    />
                    <View style={styles.productoInfoText}>
                      <Text style={styles.productoInfoNombre}>
                        {transferenciaSeleccionada.producto_nombre}
                      </Text>
                      <Text style={styles.productoInfoCategoria}>
                        {transferenciaSeleccionada.producto_categoria}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productoInfoStats}>
                    <View style={styles.detalleEliminarItem}>
                      <Text style={styles.detalleEliminarLabel}>
                        Cantidad original:
                      </Text>
                      <Text style={styles.detalleEliminarValue}>
                        {Math.abs(
                          transferenciaSeleccionada.cantidad_variacion || 0,
                        )}{" "}
                        unidades
                      </Text>
                    </View>

                    <View style={styles.detalleEliminarItem}>
                      <Text style={styles.detalleEliminarLabel}>Fecha:</Text>
                      <Text style={styles.detalleEliminarValue}>
                        {formatFecha(
                          transferenciaSeleccionada.creado_en.split("T")[0],
                        )}
                      </Text>
                    </View>

                    <View style={styles.detalleEliminarItem}>
                      <Text style={styles.detalleEliminarLabel}>Destino:</Text>
                      <Text style={styles.detalleEliminarValue}>
                        {transferenciaSeleccionada.punto_destino_nombre ||
                          transferenciaSeleccionada.almacen_destino_nombre ||
                          "Destino"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Formulario de corrección */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Cantidad correcta</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ingrese la cantidad correcta..."
                    value={cantidadCorreccion}
                    onChangeText={setCantidadCorreccion}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <Text style={styles.formHelp}>
                    Ingrese la cantidad real que debería haberse transferido
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Motivo de la corrección</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      { height: 80, textAlignVertical: "top" },
                    ]}
                    placeholder="¿Por qué necesita corregir esta transferencia?..."
                    value={motivoCorreccion}
                    onChangeText={setMotivoCorreccion}
                    multiline={true}
                    numberOfLines={3}
                  />
                  <Text style={styles.formHelp}>
                    Ej: Error al contar los productos, se confundió la cantidad,
                    etc.
                  </Text>
                </View>

                {/* Campo para seleccionar almacén destino */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Almacén que recibirá las unidades
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.formInput,
                      {
                        height: 50,
                        justifyContent: "center",
                        alignItems: "flex-start",
                        paddingHorizontal: 15,
                        backgroundColor: "#f9fafb",
                      },
                    ]}
                    onPress={() => {
                      console.log(
                        "🔍 Abriendo modal de selección de almacén para corrección",
                      );
                      console.log(
                        "🔍 almacenesParaCorrección.length:",
                        almacenesParaCorreccion.length,
                      );
                      console.log(
                        "🔍 almacenesParaCorrección:",
                        almacenesParaCorreccion.map((a) => ({
                          id: a.id,
                          nombre: a.nombre,
                        })),
                      );
                      setModalSeleccionarAlmacen(true);
                    }}
                  >
                    <Text style={{ flex: 1, color: "#374151" }}>
                      {almacenDestinoCorreccion
                        ? almacenesParaCorreccion.find(
                            (a) => a.id === almacenDestinoCorreccion,
                          )?.nombre || "Almacén seleccionado"
                        : "Seleccionar almacén..."}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color="#6b7280"
                      style={{ marginLeft: 10 }}
                    />
                  </TouchableOpacity>
                  <Text style={styles.formHelp}>
                    Seleccione el almacén que recibirá las unidades corregidas
                  </Text>
                </View>

                {/* Resumen de la corrección */}
                {cantidadCorreccion && (
                  <View style={styles.resumenContainer}>
                    <Text style={styles.resumenTitle}>
                      Resumen de la corrección
                    </Text>

                    <View style={styles.resumenItem}>
                      <Text style={styles.resumenLabel}>
                        Cantidad original:
                      </Text>
                      <Text style={styles.resumenValue}>
                        {Math.abs(
                          transferenciaSeleccionada.cantidad_variacion || 0,
                        )}{" "}
                        unidades
                      </Text>
                    </View>

                    <View style={styles.resumenItem}>
                      <Text style={styles.resumenLabel}>
                        Cantidad correcta:
                      </Text>
                      <Text style={styles.resumenValue}>
                        {cantidadCorreccion} unidades
                      </Text>
                    </View>

                    <View style={styles.resumenItem}>
                      <Text style={styles.resumenLabel}>Diferencia:</Text>
                      <Text
                        style={[
                          styles.resumenValue,
                          {
                            color:
                              parseInt(cantidadCorreccion) >
                              Math.abs(
                                transferenciaSeleccionada.cantidad_variacion ||
                                  0,
                              )
                                ? "#059669"
                                : parseInt(cantidadCorreccion) <
                                    Math.abs(
                                      transferenciaSeleccionada.cantidad_variacion ||
                                        0,
                                    )
                                  ? "#dc2626"
                                  : "#6b7280",
                          },
                        ]}
                      >
                        {parseInt(cantidadCorreccion) >
                        Math.abs(
                          transferenciaSeleccionada.cantidad_variacion || 0,
                        )
                          ? "+"
                          : ""}
                        {Math.abs(
                          parseInt(cantidadCorreccion) -
                            Math.abs(
                              transferenciaSeleccionada.cantidad_variacion || 0,
                            ),
                        )}{" "}
                        unidades
                        {parseInt(cantidadCorreccion) <
                        Math.abs(
                          transferenciaSeleccionada.cantidad_variacion || 0,
                        )
                          ? " (faltante)"
                          : " (sobrante)"}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalCorreccionTransferencia(false);
                  resetFormularios();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={corregirTransferencia}
              >
                <Ionicons name="refresh-outline" size={16} color="white" />
                <Text style={[styles.saveButtonText, { marginLeft: 8 }]}>
                  Corregir
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Formato de Almacenamiento */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalFormatoAlmacenamiento}
        onRequestClose={() => setModalFormatoAlmacenamiento(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.almacenSelectModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.almacenSelectTitle}>Seleccionar Formato</Text>
            </View>

            <ScrollView
              style={styles.almacenSelectList}
              showsVerticalScrollIndicator={false}
            >
              {[
                { key: "", label: "Sin formato" },
                { key: "paquete", label: "Paquete" },
                { key: "bolsa", label: "Bolsa" },
                { key: "lata", label: "Lata" },
                { key: "bulto", label: "Bulto" },
                { key: "sobre", label: "Sobre" },
                { key: "tubo", label: "Tubo" },
                { key: "galon", label: "Galón" },
                { key: "litro", label: "Litro" },
                { key: "blister", label: "Blister" },
                { key: "cajon", label: "Cajón" },
                { key: "kilogramo", label: "Kilogramo" },
                { key: "gramo", label: "Gramo" },
                { key: "mililitro", label: "Mililitro" },
                { key: "metro", label: "Metro" },
                { key: "centimetro", label: "Centímetro" },
                { key: "pulgada", label: "Pulgada" },
                { key: "cajas", label: "Cajas" },
              ].map((formato) => (
                <TouchableOpacity
                  key={formato.key}
                  style={[
                    styles.zonaOption,
                    formFormatoAlmacen === formato.key && {
                      backgroundColor: "#e0e7ff",
                      borderColor: "#3b82f6",
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => {
                    setFormFormatoAlmacen(formato.key);
                    setModalFormatoAlmacenamiento(false);
                    // Limpiar unidades por formato si se selecciona "Sin formato"
                    if (!formato.key) {
                      setFormUnidadesPorFormato("");
                    }
                  }}
                >
                  <View
                    style={[
                      styles.zonaIcon,
                      {
                        backgroundColor:
                          formFormatoAlmacen === formato.key
                            ? "#3b82f6"
                            : "#f3f4f6",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        formFormatoAlmacen === formato.key
                          ? "checkmark"
                          : "cube-outline"
                      }
                      size={24}
                      color={
                        formFormatoAlmacen === formato.key ? "white" : "#6b7280"
                      }
                    />
                  </View>
                  <View style={styles.zonaInfo}>
                    <Text
                      style={[
                        styles.zonaTitle,
                        formFormatoAlmacen === formato.key && {
                          color: "#3b82f6",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {formato.label}
                    </Text>
                    {formato.key && (
                      <Text style={styles.zonaDescription}>
                        Formato de almacenamiento para productos
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalFormatoAlmacenamiento(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Tipo de Cantidad */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalTipoCantidadTransferencia}
        onRequestClose={() => setModalTipoCantidadTransferencia(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.almacenSelectModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.almacenSelectTitle}>
                Seleccionar Tipo de Cantidad
              </Text>
            </View>

            <ScrollView
              style={styles.almacenSelectList}
              showsVerticalScrollIndicator={false}
            >
              {/* Mostrar solo opciones relevantes según el formato del producto */}
              {productoSeleccionado?.formato_almacen
                ? // Si el producto tiene formato, mostrar solo unidades y ese formato específico
                  [
                    { key: "unidades", label: "Unidades" },
                    {
                      key: productoSeleccionado.formato_almacen,
                      label: getFormatLabel(
                        productoSeleccionado.formato_almacen,
                        true,
                      ),
                    },
                  ].map((tipo) => (
                    <TouchableOpacity
                      key={tipo.key}
                      style={[
                        styles.zonaOption,
                        tipoCantidadTransferencia === tipo.key && {
                          backgroundColor: "#e0e7ff",
                          borderColor: "#3b82f6",
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => {
                        setTipoCantidadTransferencia(tipo.key);
                        setModalTipoCantidadTransferencia(false);
                      }}
                    >
                      <View
                        style={[
                          styles.zonaIcon,
                          {
                            backgroundColor:
                              tipoCantidadTransferencia === tipo.key
                                ? "#3b82f6"
                                : "#f3f4f6",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            tipoCantidadTransferencia === tipo.key
                              ? "checkmark"
                              : "cube-outline"
                          }
                          size={24}
                          color={
                            tipoCantidadTransferencia === tipo.key
                              ? "white"
                              : "#6b7280"
                          }
                        />
                      </View>
                      <View style={styles.zonaInfo}>
                        <Text
                          style={[
                            styles.zonaTitle,
                            tipoCantidadTransferencia === tipo.key && {
                              color: "#3b82f6",
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {tipo.label}
                        </Text>
                        <Text style={styles.zonaDescription}>
                          {tipo.key === "unidades"
                            ? "Transferir por unidades individuales"
                            : `Transferir por ${getFormatLabel(tipo.key, false)}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                : // Si el producto no tiene formato, mostrar todas las opciones
                  [
                    { key: "unidades", label: "Unidades" },
                    { key: "paquete", label: "Paquetes" },
                    { key: "bolsa", label: "Bolsas" },
                    { key: "lata", label: "Latas" },
                    { key: "bulto", label: "Bultos" },
                    { key: "sobre", label: "Sobres" },
                    { key: "tubo", label: "Tubos" },
                    { key: "galon", label: "Galones" },
                    { key: "litro", label: "Litros" },
                    { key: "blister", label: "Blisters" },
                    { key: "cajon", label: "Cajones" },
                    { key: "kilogramo", label: "Kilogramos" },
                    { key: "gramo", label: "Gramos" },
                    { key: "mililitro", label: "Mililitros" },
                    { key: "metro", label: "Metros" },
                    { key: "centimetro", label: "Centímetros" },
                    { key: "pulgada", label: "Pulgadas" },
                    { key: "cajas", label: "Cajas" },
                  ].map((tipo) => (
                    <TouchableOpacity
                      key={tipo.key}
                      style={[
                        styles.zonaOption,
                        tipoCantidadTransferencia === tipo.key && {
                          backgroundColor: "#e0e7ff",
                          borderColor: "#3b82f6",
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => {
                        setTipoCantidadTransferencia(tipo.key);
                        setModalTipoCantidadTransferencia(false);
                      }}
                    >
                      <View
                        style={[
                          styles.zonaIcon,
                          {
                            backgroundColor:
                              tipoCantidadTransferencia === tipo.key
                                ? "#3b82f6"
                                : "#f3f4f6",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            tipoCantidadTransferencia === tipo.key
                              ? "checkmark"
                              : "cube-outline"
                          }
                          size={24}
                          color={
                            tipoCantidadTransferencia === tipo.key
                              ? "white"
                              : "#6b7280"
                          }
                        />
                      </View>
                      <View style={styles.zonaInfo}>
                        <Text
                          style={[
                            styles.zonaTitle,
                            tipoCantidadTransferencia === tipo.key && {
                              color: "#3b82f6",
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {tipo.label}
                        </Text>
                        <Text style={styles.zonaDescription}>
                          {tipo.key === "unidades"
                            ? "Transferir por unidades individuales"
                            : `Transferir por ${getFormatLabel(tipo.key, false)}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalTipoCantidadTransferencia(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DateTimePicker para filtro de fecha */}
      {showDatePickerHistorial && (
        <DateTimePicker
          value={fechaDesdeFiltro || new Date()}
          mode="date"
          display="spinner"
          onChange={(event, date) => {
            setShowDatePickerHistorial(false);
            if (date) {
              setFechaDesdeFiltro(date);
              cargarHistorial({
                ...historialFiltros,
                fecha_inicio: getFechaLocal(),
              });
            }
          }}
        />
      )}
      <Modal
        visible={mostrarModalFormula}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMostrarModalFormula(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalForm]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fórmula del Pan</Text>
            </View>

            <ScrollView style={styles.modalContent}>
              <TouchableOpacity
                style={styles.addFormulaButton}
                onPress={() => {
                  setMostrarModalCrearFormula(true);
                  setMostrarModalFormula(false);
                }}
              >
                <Ionicons name="add-circle" size={24} color="white" />
                <Text style={styles.addFormulaButtonText}>Añadir Fórmula</Text>
              </TouchableOpacity>

              <Text style={styles.formulaListTitle}>Fórmulas Existentes</Text>

              {loadingFormulas ? (
                <View style={styles.emptyFormulaContainer}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.emptyFormulaText}>
                    Cargando fórmulas...
                  </Text>
                </View>
              ) : formulasExistentes.length > 0 ? (
                <View style={styles.formulaListContainer}>
                  {formulasExistentes.map((formula) => (
                    <View key={formula.id} style={styles.formulaItem}>
                      <View style={styles.formulaInfo}>
                        <Text style={styles.formulaName}>{formula.nombre}</Text>
                        <View style={styles.formulaIngredients}>
                          <Text style={styles.ingredientText}>
                            Harina: {formula.harina}g
                          </Text>
                          <Text style={styles.ingredientText}>
                            Levadura: {formula.levadura}g
                          </Text>
                          <Text style={styles.ingredientText}>
                            Núcleo: {formula.nucleo}g
                          </Text>
                          <Text style={styles.ingredientText}>
                            Azúcar: {formula.azucar}g
                          </Text>
                          <Text style={styles.ingredientText}>
                            Sal: {formula.sal}g
                          </Text>
                          <Text style={styles.ingredientText}>
                            Aceite: {formula.aceite}g
                          </Text>
                        </View>
                      </View>
                      <View style={styles.formulaActions}>
                        <View style={styles.formulaButtonsContainer}>
                          <TouchableOpacity
                            style={styles.formulaDeleteButton}
                            onPress={() => eliminarFormula(formula)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color="#ef4444"
                            />
                            <Text style={styles.formulaButtonText}>
                              Eliminar
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.formulaEditButton}
                            onPress={() => editarFormula(formula)}
                          >
                            <Ionicons
                              name="create-outline"
                              size={18}
                              color="#3b82f6"
                            />
                            <Text style={styles.formulaButtonText}>
                              Crear Pan
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.formulaCreateButton}
                            onPress={() => crearPanDesdeFormulaDirecta(formula)}
                          >
                            <Ionicons
                              name="add-outline"
                              size={18}
                              color="#10b981"
                            />
                            <Text style={styles.formulaButtonText}>Crear</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyFormulaContainer}>
                  <Ionicons
                    name="restaurant-outline"
                    size={64}
                    color="#d1d5db"
                  />
                  <Text style={styles.emptyFormulaText}>
                    No hay fórmulas registradas
                  </Text>
                  <Text style={styles.emptyFormulaSubtext}>
                    Presiona "Añadir Fórmula" para crear tu primera receta
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setMostrarModalFormula(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Crear Fórmula */}
      <Modal
        visible={mostrarModalCrearFormula}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setMostrarModalCrearFormula(false);
          setMostrarModalFormula(true);
          // Limpiar formulario
          setNombrePan("");
          setFormulaData({
            harina: "",
            levadura: "",
            nucleo: "",
            azucar: "",
            sal: "",
            aceite: "",
          });
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalForm]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {formulaEditando ? "Editar Fórmula" : "Crear Fórmula"}
              </Text>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nombre del Pan</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ej: Pan Francés"
                  placeholderTextColor="#9ca3af"
                  value={nombrePan}
                  onChangeText={setNombrePan}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Receta Base (gramos)</Text>
                <View style={styles.formulaTableContainer}>
                  <View style={styles.formulaTableHeader}>
                    <Text style={styles.formulaTableHeaderLeft}>Insumos</Text>
                    <Text style={styles.formulaTableHeaderRight}>
                      Cantidad (g)
                    </Text>
                  </View>

                  {/* Harina */}
                  <View style={styles.formulaTableRow}>
                    <Text style={styles.formulaTableInsumo}>Harina</Text>
                    <TextInput
                      style={styles.formulaTableInput}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      value={formulaData.harina}
                      onChangeText={(value) =>
                        setFormulaData((prev) => ({ ...prev, harina: value }))
                      }
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Levadura */}
                  <View style={styles.formulaTableRow}>
                    <Text style={styles.formulaTableInsumo}>Levadura</Text>
                    <TextInput
                      style={styles.formulaTableInput}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      value={formulaData.levadura}
                      onChangeText={(value) =>
                        setFormulaData((prev) => ({ ...prev, levadura: value }))
                      }
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Núcleo */}
                  <View style={styles.formulaTableRow}>
                    <Text style={styles.formulaTableInsumo}>Núcleo</Text>
                    <TextInput
                      style={styles.formulaTableInput}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      value={formulaData.nucleo}
                      onChangeText={(value) =>
                        setFormulaData((prev) => ({ ...prev, nucleo: value }))
                      }
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Azúcar */}
                  <View style={styles.formulaTableRow}>
                    <Text style={styles.formulaTableInsumo}>Azucar</Text>
                    <TextInput
                      style={styles.formulaTableInput}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      value={formulaData.azucar}
                      onChangeText={(value) =>
                        setFormulaData((prev) => ({ ...prev, azucar: value }))
                      }
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Sal */}
                  <View style={styles.formulaTableRow}>
                    <Text style={styles.formulaTableInsumo}>Sal</Text>
                    <TextInput
                      style={styles.formulaTableInput}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      value={formulaData.sal}
                      onChangeText={(value) =>
                        setFormulaData((prev) => ({ ...prev, sal: value }))
                      }
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Aceite */}
                  <View style={styles.formulaTableRow}>
                    <Text style={styles.formulaTableInsumo}>Aceite</Text>
                    <TextInput
                      style={styles.formulaTableInput}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      value={formulaData.aceite}
                      onChangeText={(value) =>
                        setFormulaData((prev) => ({ ...prev, aceite: value }))
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setMostrarModalCrearFormula(false);
                  setMostrarModalFormula(true);
                  // Limpiar formulario y estado de edición
                  limpiarFormularioFormula();
                  setFormulaEditando(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={guardarFormula}
                disabled={
                  !nombrePan.trim() ||
                  !formulaData.harina ||
                  !formulaData.levadura ||
                  !formulaData.nucleo ||
                  !formulaData.azucar ||
                  !formulaData.sal ||
                  !formulaData.aceite
                }
              >
                <Text style={styles.saveButtonText}>
                  {formulaEditando ? "Actualizar" : "Guardar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Producción de Panes */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalProduccionPan}
        onRequestClose={() => setModalProduccionPan(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContainer, styles.modalProduccion]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Producción de Panes</Text>
              <TouchableOpacity onPress={() => setModalProduccionPan(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {resumenProduccion && (
                <>
                  {/* Información de la fórmula */}
                  <View style={styles.productoInfoModal}>
                    <View style={styles.productoInfoHeader}>
                      <Ionicons
                        name="restaurant-outline"
                        size={20}
                        color="#10b981"
                      />
                      <View style={styles.productoInfoText}>
                        <Text style={styles.productoInfoNombre}>
                          {resumenProduccion.formula.nombre}
                        </Text>
                        <Text style={styles.productoInfoCategoria}>
                          Fórmula de Producción
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Cantidad máxima posible */}
                  <View style={styles.resumenContainer}>
                    <Text style={styles.resumenTitle}>
                      Cantidad Máxima Posible
                    </Text>
                    <Text style={styles.resumenValue}>
                      {resumenProduccion.cantidad_maxima_posible} panes
                    </Text>
                  </View>

                  {/* Campo para cantidad a producir */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Cantidad a producir</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ingrese la cantidad..."
                      value={cantidadPanesProducir}
                      onChangeText={setCantidadPanesProducir}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={styles.formHelp}>
                      Máximo: {resumenProduccion.cantidad_maxima_posible} panes
                    </Text>
                  </View>

                  {/* Resumen de insumos */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Insumos Requeridos</Text>
                    {resumenProduccion.insumos_seleccionados.map(
                      (insumo, index) => (
                        <View key={index} style={styles.insumoItem}>
                          <View style={styles.insumoInfo}>
                            <Text style={styles.insumoNombre}>
                              {insumo.nombre}
                            </Text>
                            <Text style={styles.insumoDescripcion}>
                              {insumo.descripcion}
                            </Text>
                            <Text style={styles.insumoCantidad}>
                              Disponible: {insumo.cantidad_disponible}{" "}
                              {insumo.formato_almacen}
                            </Text>
                            <Text style={styles.insumoRequerido}>
                              Requerido: {insumo.cantidad_requerida}g por pan
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.seleccionarInsumoButton}
                            onPress={() => abrirSeleccionInsumo(insumo.nombre)}
                          >
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color="#3b82f6"
                            />
                            <Text style={styles.seleccionarInsumoText}>
                              Seleccionar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ),
                    )}
                  </View>

                  {/* Resumen de costos */}
                  <View style={styles.resumenContainer}>
                    <Text style={styles.resumenTitle}>
                      Costos de Producción
                    </Text>

                    {/* Costos Adicionales */}
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Costos Adicionales</Text>

                      <View style={styles.costosAdicionalesContainer}>
                        <View style={styles.costoAdicionalItem}>
                          <Text style={styles.costoAdicionalLabel}>
                            Trabajador ($):
                          </Text>
                          <TextInput
                            style={styles.costoAdicionalInput}
                            placeholder="0.00"
                            placeholderTextColor="#9ca3af"
                            value={costoTrabajador}
                            onChangeText={setCostoTrabajador}
                            keyboardType="numeric"
                          />
                        </View>

                        <View style={styles.costoAdicionalItem}>
                          <Text style={styles.costoAdicionalLabel}>
                            Transporte ($):
                          </Text>
                          <TextInput
                            style={styles.costoAdicionalInput}
                            placeholder="0.00"
                            placeholderTextColor="#9ca3af"
                            value={costoTransporte}
                            onChangeText={setCostoTransporte}
                            keyboardType="numeric"
                          />
                        </View>

                        <View style={styles.costoAdicionalItem}>
                          <Text style={styles.costoAdicionalLabel}>
                            Electricidad ($):
                          </Text>
                          <TextInput
                            style={styles.costoAdicionalInput}
                            placeholder="0.00"
                            placeholderTextColor="#9ca3af"
                            value={costoElectricidad}
                            onChangeText={setCostoElectricidad}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    </View>

                    {/* Costos de Insumos */}
                    <View style={styles.resumenItem}>
                      <Text style={styles.resumenLabel}>
                        Costo insumos por pan:
                      </Text>
                      <Text style={styles.resumenValue}>
                        ${resumenProduccion.costo_por_pan.toFixed(2)}
                      </Text>
                    </View>

                    {/* Costos Adicionales por pan */}
                    {cantidadPanesProducir && (
                      <View style={styles.resumenItem}>
                        <Text style={styles.resumenLabel}>
                          Costos adicionales por pan:
                        </Text>
                        <Text style={styles.resumenValue}>
                          $
                          {(
                            (parseFloat(costoTrabajador || "0") +
                              parseFloat(costoTransporte || "0") +
                              parseFloat(costoElectricidad || "0")) /
                            parseInt(cantidadPanesProducir || "1")
                          ).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Costo Total por pan */}
                    {cantidadPanesProducir && (
                      <View style={styles.resumenItem}>
                        <Text style={styles.resumenLabel}>
                          Costo total por pan:
                        </Text>
                        <Text style={styles.resumenValue}>
                          $
                          {(
                            resumenProduccion.costo_por_pan +
                            (parseFloat(costoTrabajador || "0") +
                              parseFloat(costoTransporte || "0") +
                              parseFloat(costoElectricidad || "0")) /
                              parseInt(cantidadPanesProducir || "1")
                          ).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Costo Total */}
                    {cantidadPanesProducir && (
                      <View style={styles.resumenItem}>
                        <Text style={styles.resumenLabel}>
                          Costo total producción:
                        </Text>
                        <Text style={styles.resumenValue}>
                          $
                          {(
                            resumenProduccion.costo_por_pan *
                              parseInt(cantidadPanesProducir || "0") +
                            parseFloat(costoTrabajador || "0") +
                            parseFloat(costoTransporte || "0") +
                            parseFloat(costoElectricidad || "0")
                          ).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalProduccionPan(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={ejecutarProduccion}
                disabled={loadingProduccion || !cantidadPanesProducir}
              >
                {loadingProduccion ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Producir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Insumos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalSeleccionInsumos}
        onRequestClose={() => setModalSeleccionInsumos(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContainer, styles.modalSeleccionar]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Seleccionar {insumoActualSeleccionar}
              </Text>
              <TouchableOpacity onPress={() => setModalSeleccionInsumos(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {productosInsumoDisponibles.length > 0 ? (
                productosInsumoDisponibles.map((producto) => (
                  <TouchableOpacity
                    key={producto.id}
                    style={styles.insumoProductoItem}
                    onPress={() => seleccionarInsumo(producto)}
                  >
                    <View style={styles.insumoProductoInfo}>
                      <Text style={styles.insumoProductoNombre}>
                        {producto.nombre}
                      </Text>
                      <Text style={styles.insumoProductoDescripcion}>
                        {producto.descripcion || "Sin descripción"}
                      </Text>
                      <View style={styles.insumoProductoDetalles}>
                        <Text style={styles.insumoProductoDetalle}>
                          Cantidad:{" "}
                          {formatearCantidad(producto.cantidad_almacen)}{" "}
                          {producto.formato_almacen}
                        </Text>
                        <Text style={styles.insumoProductoDetalle}>
                          Precio: ${producto.precio_coste}
                        </Text>
                        {producto.unidades_por_formato && (
                          <Text style={styles.insumoProductoDetalle}>
                            Formato: {producto.unidades_por_formato} unid./c
                            {producto.formato_almacen}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.insumosEmptyContainer}>
                  <Ionicons name="alert-circle" size={40} color="#f59e0b" />
                  <Text style={styles.insumosEmptyText}>
                    No hay productos disponibles para {insumoActualSeleccionar}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
