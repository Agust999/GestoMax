// app/gastos.tsx
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { AuthService } from "../src/db/services/auth_service";
import { GastoService, type Gasto } from "../src/db/services/gasto_service";
import { formatearFecha, getFechaLocal } from "../src/utils/dateUtils";

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
    alignItems: "center",
  },
  headerCenterContainer: {
    flex: 2,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
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
  },
  filterButton: {
    backgroundColor: "#eff6ff",
  },
  refreshButton: {
    backgroundColor: "#f0fdf4",
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gastoItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  gastoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  gastoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  gastoAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  gastoMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  gastoCategory: {
    fontSize: 12,
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  gastoDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
  gastoCategorySalario: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
  gastoType: {
    fontSize: 12,
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tipoPasivo: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  recurrenteBadge: {
    fontSize: 10,
    color: "#ffffff",
    backgroundColor: "#10b981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  gastoDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  gastoFecha: {
    fontSize: 12,
    color: "#9ca3af",
  },
  gastoActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  editButton: {
    backgroundColor: "#eff6ff",
  },
  deleteButton: {
    backgroundColor: "#fef2f2",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  modalSaveButton: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3b82f6",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 2,
  },
  periodSegmentedControl: {
    flexDirection: "column",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  periodSegmentButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 6,
  },
  segmentButtonActive: {
    backgroundColor: "#3b82f6",
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  segmentButtonTextActive: {
    color: "#ffffff",
  },
  segmentButtonTextDisabled: {
    color: "#d1d5db",
  },
  segmentButtonDisabled: {
    opacity: 0.5,
  },
  helperText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    lineHeight: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  checkboxInnerChecked: {
    backgroundColor: "#3b82f6",
  },
  checkboxCheck: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#374151",
  },
  deudaInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 6,
  },
  deudaInfoText: {
    fontSize: 12,
    color: "#92400e",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateButtonText: {
    fontSize: 16,
    color: "#1f2937",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
  },
  // Radio button styles
  radioContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  radioInnerChecked: {
    backgroundColor: "#3b82f6",
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "white",
  },
  radioLabel: {
    fontSize: 16,
    color: "#374151",
  },
  // Estilos para modal de autenticación
  authModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  authModalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
  },
  authModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  authModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  authModalContent: {
    maxHeight: "60%",
  },
  authFormGroup: {
    marginBottom: 20,
  },
  authFormLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  authFormInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
  },
  authModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  authModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  authCancelButton: {
    backgroundColor: "#f3f4f6",
  },
  authCancelButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  authSaveButton: {
    backgroundColor: "#3b82f6",
  },
  authSaveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default function GastosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Obtener parámetros de Expo Router
  const puntoId = params.puntoId ? parseInt(params.puntoId as string) : null;
  const puntoNombre = (params.puntoNombre as string) || "Punto";

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/gastos", params);

  // Estados de autenticación
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados principales
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gastosFiltrados, setGastosFiltrados] = useState<Gasto[]>([]);
  const [gastosModalFiltrados, setGastosModalFiltrados] = useState<Gasto[]>([]);

  // Estados de filtros principales (pantalla principal)
  const [busqueda, setBusqueda] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<
    "todos" | "hoy" | "semana" | "mes" | "periodo"
  >("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<
    "todos" | "general" | "salario"
  >("todos");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");

  // Estados de filtros del modal (independientes)
  const [busquedaModal, setBusquedaModal] = useState("");
  const [filtroPeriodoModal, setFiltroPeriodoModal] = useState<
    "todos" | "hoy" | "semana" | "mes" | "periodo"
  >("todos");
  const [filtroCategoriaModal, setFiltroCategoriaModal] = useState<
    "todos" | "general" | "salario"
  >("todos");
  const [fechaInicioModal, setFechaInicioModal] = useState<string>("");
  const [fechaFinModal, setFechaFinModal] = useState<string>("");

  // Estados para modales
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [modalFiltrosVisible, setModalFiltrosVisible] = useState(false);
  const [modalHistorialSueldoVisible, setModalHistorialSueldoVisible] =
    useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<"inicio" | "fin">(
    "inicio",
  );
  const [datePickerSource, setDatePickerSource] = useState<
    "principal" | "modal"
  >("principal");

  // Estados para historial de sueldo
  const [historialSueldo, setHistorialSueldo] = useState<
    {
      fecha: string;
      dia: string;
      ventas: number;
      porcentaje: number;
      sueldo: number;
    }[]
  >([]);
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] =
    useState<string>("");
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // Estados de formulario (actualizados para nueva estructura)
  const fechaInicial = getFechaLocal();
  console.log(`🔍 DEBUG: Fecha inicial del formulario: ${fechaInicial}`);

  const [formData, setFormData] = useState({
    nombre: "",
    precio: "",
    salario_empleado: "1", // Valor por defecto válido para evitar validación cruzada
    salario_fijo: "",
    categoria: "General" as "General" | "Salario",
    descripcion: "",
    descripcion_deuda: "",
    es_porcentaje: true, // Nuevo campo para controlar el tipo
    fecha_gasto: fechaInicial, // 🔧 CORRECCIÓN: Agregar fecha actual por defecto
    tipo: "casual" as "casual" | "pasivo", // 🔧 CORRECCIÓN: Agregar tipo por defecto
    recurrente: false, // 🔧 CORRECCIÓN: Agregar recurrente por defecto
    periodicidad: "diario" as "diario" | "semanal" | "mensual", // 🔧 CORRECCIÓN: Agregar periodicidad por defecto
    deuda: false, // 🔧 CORRECCIÓN: Agregar deuda por defecto
  });

  // Estados para funcionalidad de deudas
  const [esDeuda, setEsDeuda] = useState(false);
  const [deudaData, setDeudaData] = useState({
    fecha_pago: getFechaLocal(),
  });

  // Estados para edición
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null);

  // Estados para estadísticas
  const [estadisticas, setEstadisticas] = useState({
    salario: { total: 0, cantidad: 0 },
    total: { total: 0, cantidad: 0 },
  });

  // Función de verificación de contraseña
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

  // Funciones de cálculo (fuera de useCallback para evitar dependencias circulares)
  const calcularSalariosDelDiaFunc = async (
    puntoIdParam: number,
  ): Promise<number> => {
    try {
      // Obtener todos los gastos de salarios del punto
      const todosGastos = await GastoService.read_gasto(puntoIdParam);
      const salarios = todosGastos.filter(
        (gasto) => gasto.categoria === "Salario",
      );

      let totalSalarios = 0;

      for (const salario of salarios) {
        // Verificar si el trabajador está trabajando hoy
        const estaTrabajandoHoy = await GastoService.debeGenerarSalarioHoy(
          puntoIdParam,
          salario.id!,
        );

        // Si no está trabajando hoy, el salario es 0
        if (!estaTrabajandoHoy) {
          continue;
        }

        const fechaHoy = getFechaLocal();
        const porcentajeVigente =
          await GastoService.obtenerPorcentajeVigenteEnFecha(
            salario.id!,
            fechaHoy,
          );

        // Obtener ventas de hoy para este trabajador específico
        const ventasHoy = await GastoService.obtenerVentasTrabajadorPeriodo(
          puntoIdParam,
          salario.id!,
          "hoy",
        );

        // Calcular salario teórico según el tipo
        const esPorcentaje = salario.es_porcentaje === 1;
        let salarioTeorico = 0;

        if (esPorcentaje) {
          // Salario porcentual: calcular sobre ventas
          salarioTeorico = (ventasHoy * porcentajeVigente) / 100;
        } else {
          // Salario fijo: usar el monto fijo directamente
          salarioTeorico = salario.salario_fijo || 0;
        }

        // Obtener consumos propios del trabajador del día de hoy
        const consumosPropios =
          await GastoService.obtenerConsumosPropiosPeriodo(
            puntoIdParam,
            salario.nombre || "Sin nombre",
            "hoy",
          );

        // Salario final = teórico - consumos
        const salarioFinal = salarioTeorico - consumosPropios;

        totalSalarios += salarioFinal;
      }

      return totalSalarios;
    } catch (error) {
      console.error("Error calculando salarios del día:", error);
      return 0;
    }
  };

  // Función para calcular el monto real del salario (igual que estadísticas)
  const calcularMontoRealSalario = useCallback(
    async (gasto: Gasto): Promise<number> => {
      if (gasto.categoria !== "Salario" || !puntoId) {
        return gasto.precio || 0;
      }

      try {
        // Verificar si el trabajador está trabajando hoy
        const estaTrabajandoHoy = await GastoService.debeGenerarSalarioHoy(
          puntoId,
          gasto.id!,
        );

        // Si no está trabajando hoy, el salario es 0
        if (!estaTrabajandoHoy) {
          return 0;
        }

        const fechaHoy = getFechaLocal();
        const porcentajeVigente =
          await GastoService.obtenerPorcentajeVigenteEnFecha(
            gasto.id!,
            fechaHoy,
          );

        // Obtener ventas de hoy
        const ventasHoy = await GastoService.obtenerGananciasPeriodo(
          puntoId,
          "hoy",
          false,
        );

        // Calcular salario teórico según el tipo
        const esPorcentaje = gasto.es_porcentaje === 1;
        let salarioTeorico = 0;

        if (esPorcentaje) {
          // Salario porcentual: calcular sobre ventas
          salarioTeorico = (ventasHoy * porcentajeVigente) / 100;
        } else {
          // Salario fijo: usar el monto fijo directamente
          salarioTeorico = gasto.salario_fijo || 0;
        }

        // Obtener consumos propios del trabajador del día de hoy
        const consumosPropios =
          await GastoService.obtenerConsumosPropiosPeriodo(
            puntoId,
            gasto.nombre || "Sin nombre",
            "hoy",
          );

        // Salario final = teórico - consumos
        const salarioFinal = salarioTeorico - consumosPropios;

        return salarioFinal;
      } catch (error) {
        console.error("Error calculando monto real de salario:", error);
        return gasto.precio || 0; // Fallback al valor guardado
      }
    },
    [puntoId],
  );

  // Función para calcular el monto real del salario según el período
  const calcularMontoRealSalarioConPeriodo = useCallback(
    async (
      gasto: Gasto,
      periodo: "todos" | "hoy" | "semana" | "mes" | "periodo",
    ): Promise<number> => {
      if (gasto.categoria !== "Salario" || !puntoId) {
        return gasto.precio || 0;
      }

      try {
        // Para "todos", usar el valor guardado ya que no hay un período específico
        if (periodo === "todos") {
          return gasto.precio || 0;
        }

        // Obtener ventas del período específico para este trabajador
        const ventasPeriodo = await GastoService.obtenerVentasTrabajadorPeriodo(
          puntoId,
          gasto.id!,
          periodo === "periodo" && fechaInicio && fechaFin
            ? "periodo"
            : periodo,
          periodo === "periodo" ? fechaInicio : undefined,
          periodo === "periodo" ? fechaFin : undefined,
        );

        // Obtener porcentaje vigente para todos los cálculos (usar siempre el porcentaje actual)
        const fechaHoy = getFechaLocal();
        const porcentajeVigente =
          await GastoService.obtenerPorcentajeVigenteEnFecha(
            gasto.id!,
            fechaHoy,
          );

        // Calcular salario teórico del período según el tipo
        const esPorcentaje = gasto.es_porcentaje === 1;
        let salarioTeorico = 0;

        if (esPorcentaje) {
          // Salario porcentual: calcular sobre ventas
          salarioTeorico = (ventasPeriodo * porcentajeVigente) / 100;
        } else {
          // Salario fijo: usar el monto fijo directamente
          salarioTeorico = gasto.salario_fijo || 0;
        }

        // Obtener consumos propios del trabajador del período específico
        const consumosPropios =
          await GastoService.obtenerConsumosPropiosPeriodo(
            puntoId,
            gasto.nombre || "Sin nombre",
            periodo,
            fechaInicio,
            fechaFin,
          );

        // Salario final = teórico - consumos del período
        const salarioFinal = salarioTeorico - consumosPropios;

        console.log(
          `💰 DEBUG salario ${periodo}: ventas=${ventasPeriodo}, porcentaje=${porcentajeVigente}%, teorico=${salarioTeorico}, consumos=${consumosPropios}, final=${salarioFinal}`,
        );

        return salarioFinal;
      } catch (error) {
        console.error(
          "Error calculando monto real de salario con período:",
          error,
        );
        return gasto.precio || 0; // Fallback al valor guardado
      }
    },
    [puntoId, fechaInicio, fechaFin],
  );

  const calcularTotalGastosFunc = useCallback(
    async (puntoIdParam: number): Promise<number> => {
      try {
        console.log("🔍 DEBUG calcularTotalGastosFunc: puntoId=", puntoIdParam);

        // Usar el filtro de período actual en lugar de siempre "hoy"
        let datos: Gasto[] = [];

        if (filtroPeriodo === "todos") {
          datos = await GastoService.read_gasto(puntoIdParam);
        } else if (filtroPeriodo === "periodo" && fechaInicio && fechaFin) {
          datos = await GastoService.obtenerGastosPorPeriodo(
            puntoIdParam,
            "periodo",
            fechaInicio,
            fechaFin,
          );
        } else {
          datos = await GastoService.obtenerGastosPorPeriodo(
            puntoIdParam,
            filtroPeriodo as "hoy" | "semana" | "mes",
          );
        }

        console.log(
          "📊 DEBUG gastos encontrados para",
          filtroPeriodo,
          ":",
          datos.length,
        );

        let totalGastos = 0;

        for (const gasto of datos) {
          console.log(
            "🔍 DEBUG gasto:",
            gasto.nombre,
            "categoria:",
            gasto.categoria,
            "precio:",
            gasto.precio,
          );

          if (gasto.categoria === "General") {
            // Sumar gastos generales del período
            totalGastos += Math.abs(gasto.precio || 0);
            console.log(
              "➕ DEBUG sumando gasto general:",
              Math.abs(gasto.precio || 0),
            );
          } else if (gasto.categoria === "Salario") {
            // Para salarios, calcular el monto real según el período
            const montoReal = await calcularMontoRealSalarioConPeriodo(
              gasto,
              filtroPeriodo,
            );
            totalGastos += montoReal;
            console.log("💰 DEBUG sumando salario:", montoReal);
          }
        }

        console.log("🎯 DEBUG total final:", totalGastos);
        return totalGastos;
      } catch (error) {
        console.error("Error calculando total de gastos:", error);
        return 0;
      }
    },
    [calcularMontoRealSalarioConPeriodo, filtroPeriodo, fechaInicio, fechaFin],
  );

  // Cargar gastos
  const cargarGastos = useCallback(async () => {
    if (!puntoId) return;

    try {
      // Primero reparar salarios existentes si es necesario
      await GastoService.repararSalariosExistentes(puntoId);

      let datos: Gasto[] = [];

      if (filtroPeriodo === "todos") {
        datos = await GastoService.read_gasto(puntoId);
      } else if (filtroPeriodo === "periodo" && fechaInicio && fechaFin) {
        datos = await GastoService.obtenerGastosPorPeriodo(
          puntoId,
          "periodo",
          fechaInicio,
          fechaFin,
        );
      } else {
        datos = await GastoService.obtenerGastosPorPeriodo(
          puntoId,
          filtroPeriodo as "hoy" | "semana" | "mes",
        );
      }

      // Aplicar filtro de categoría si no es "todos"
      if (filtroCategoria !== "todos") {
        datos = datos.filter((gasto) => {
          if (filtroCategoria === "salario") {
            return gasto.categoria === "Salario";
          } else if (filtroCategoria === "general") {
            return gasto.categoria === "General";
          }
          return true;
        });
      }

      // Aplicar búsqueda
      if (busqueda.trim()) {
        datos = datos.filter((gasto) =>
          gasto.nombre.toLowerCase().includes(busqueda.toLowerCase()),
        );
      }

      setGastosFiltrados(datos);
    } catch (error) {
      console.error("Error cargando gastos:", error);
      Alert.alert("Error", "No se pudieron cargar los gastos");
    } finally {
      setRefreshing(false);
    }
  }, [
    puntoId,
    filtroPeriodo,
    filtroCategoria,
    fechaInicio,
    fechaFin,
    busqueda,
  ]);

  // Cargar estadísticas
  const cargarEstadisticas = useCallback(async () => {
    if (!puntoId) return;

    try {
      // Para salarios del día, siempre usar hoy independientemente del filtro
      const salarioDia = await calcularSalariosDelDiaFunc(puntoId);

      // Para total de gastos, usar los filtros actuales
      const totalGastos = await calcularTotalGastosFunc(puntoId);

      setEstadisticas({
        salario: { total: salarioDia, cantidad: 1 },
        total: { total: totalGastos, cantidad: 1 },
      });
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  }, [puntoId, calcularTotalGastosFunc]);

  // Función para forzar recarga completa de datos
  const recargarDatosCompletos = useCallback(async () => {
    if (!puntoId) return;

    setLoading(true);
    try {
      await Promise.all([cargarGastos(), cargarEstadisticas()]);
    } catch (error) {
      console.error("Error recargando datos:", error);
    } finally {
      setLoading(false);
    }
  }, [puntoId, cargarGastos, cargarEstadisticas]);

  // Cargar gastos para el modal de filtros
  const cargarGastosParaModal = useCallback(async () => {
    if (!puntoId) return;

    try {
      let datos: Gasto[] = [];

      if (filtroPeriodoModal === "todos") {
        datos = await GastoService.read_gasto(puntoId);
      } else if (
        filtroPeriodoModal === "periodo" &&
        fechaInicioModal &&
        fechaFinModal
      ) {
        datos = await GastoService.obtenerGastosPorPeriodo(
          puntoId,
          "periodo",
          fechaInicioModal,
          fechaFinModal,
        );
      } else {
        datos = await GastoService.obtenerGastosPorPeriodo(
          puntoId,
          filtroPeriodoModal as "hoy" | "semana" | "mes",
        );
      }

      // Aplicar filtro de categoría si no es "todos"
      if (filtroCategoriaModal !== "todos") {
        datos = datos.filter((gasto) => {
          if (filtroCategoriaModal === "salario") {
            return gasto.categoria === "Salario";
          } else if (filtroCategoriaModal === "general") {
            return gasto.categoria === "General";
          }
          return true;
        });
      }

      // Aplicar filtro de búsqueda si hay texto
      if (busquedaModal.trim()) {
        datos = datos.filter(
          (gasto) =>
            gasto.nombre.toLowerCase().includes(busquedaModal.toLowerCase()) ||
            (gasto.descripcion &&
              gasto.descripcion
                .toLowerCase()
                .includes(busquedaModal.toLowerCase())),
        );
      }

      setGastosModalFiltrados(datos);
    } catch (error) {
      console.error("Error cargando gastos para modal:", error);
      setGastosModalFiltrados([]);
    }
  }, [
    puntoId,
    filtroPeriodoModal,
    filtroCategoriaModal,
    fechaInicioModal,
    fechaFinModal,
    busquedaModal,
  ]);

  // Crear gasto
  const crearGasto = async () => {
    if (!puntoId) return;

    if (!formData.nombre.trim()) {
      Alert.alert("Error", "El nombre del gasto es requerido");
      return;
    }

    // Validaciones adicionales para deudas
    if (esDeuda && !formData.descripcion.trim()) {
      Alert.alert(
        "Error",
        "La descripción del gasto es requerida cuando se crea como deuda",
      );
      return;
    }

    if (esDeuda && !deudaData.fecha_pago) {
      Alert.alert("Error", "La fecha de pago de la deuda es requerida");
      return;
    }

    try {
      // DEBUG: Log para cazar el bug de deuda y fecha
      const fechaActualDebug = getFechaLocal();
      console.log("ENVIANDO:", {
        categoria: formData.categoria,
        esDeuda,
        es_porcentaje: formData.es_porcentaje,
        fecha_gasto: formData.fecha_gasto,
        fecha_actual: fechaActualDebug,
        tipo_fecha_gasto: typeof formData.fecha_gasto,
        diff_misma_fecha: formData.fecha_gasto === fechaActualDebug,
      });

      // Preparar el request según la categoría
      const request: any = {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        tipo: formData.tipo,
        descripcion: formData.descripcion.trim(),
        descripcion_deuda: formData.descripcion_deuda.trim(),
        fecha_gasto: formData.fecha_gasto,
        deuda: esDeuda === true, // Blindar envío
        recurrente: formData.recurrente,
        es_porcentaje: formData.es_porcentaje === true, // CRÍTICO: blindar undefined
        salario_empleado:
          formData.es_porcentaje === true
            ? parseFloat(formData.salario_empleado)
            : null, //viar 0 para evitar validaciones antiguas
        salario_fijo:
          formData.es_porcentaje === true
            ? null
            : parseFloat(formData.salario_fijo), // Enviar null para evitar falsy values
      };

      // Agregar campos específicos según categoría
      if (formData.categoria === "General") {
        const monto = parseFloat(formData.precio);
        if (isNaN(monto) || monto <= 0) {
          Alert.alert("Error", "El monto debe ser un número positivo");
          return;
        }
        request.precio = monto;
      } else if (formData.categoria === "Salario") {
        const esPorcentaje = formData.es_porcentaje === true;

        if (esPorcentaje) {
          const p = parseFloat(formData.salario_empleado);
          if (isNaN(p) || p < 1 || p > 100) {
            Alert.alert("Error", "El porcentaje debe estar entre 1 a 100");
            return;
          }
        }
        request.recurrente = true; // Automático para salarios
        request.periodicidad = formData.periodicidad || "diario"; // Automático
      }

      // Usar el nuevo GastoService
      const resultado = await GastoService.crearGastoNuevo(request, puntoId);

      if (!resultado.success) {
        Alert.alert("Error", resultado.message);
        return;
      }

      // Si se creó una deuda, redirigir a préstamos
      if (resultado.data?.redirect === "prestamos") {
        Alert.alert(
          "Deuda Creada",
          "La deuda se ha creado correctamente y será visible en la pantalla de préstamos.",
        );
        setModalCrearVisible(false);
        resetFormulario();

        // Redirigir a la pantalla de préstamos
        router.push("/prestamos");
        return;
      }

      setModalCrearVisible(false);
      resetFormulario();
      await cargarGastos();
      await cargarEstadisticas();
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo crear el gasto");
    }
  };

  // Actualizar gasto
  const actualizarGasto = async () => {
    if (!gastoEditando?.id) return;

    try {
      const request: any = {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        tipo: formData.tipo,
        descripcion: formData.descripcion.trim(),
        descripcion_deuda: formData.descripcion_deuda.trim(),
        fecha_gasto: formData.fecha_gasto,
        recurrente: formData.recurrente,
        es_porcentaje: formData.es_porcentaje === true, // CRÍTICO: blindar undefined
        salario_empleado:
          formData.es_porcentaje === true
            ? parseFloat(formData.salario_empleado)
            : null, //iar 0 para evitar validaciones antiguas
        salario_fijo:
          formData.es_porcentaje === true
            ? null
            : parseFloat(formData.salario_fijo), // Enviar null para evitar falsy values
      };

      if (formData.categoria === "General") {
        const monto = parseFloat(formData.precio);
        if (!isNaN(monto) && monto > 0) {
          request.precio = monto;
        }
      } else if (formData.categoria === "Salario") {
        const esPorcentaje = formData.es_porcentaje === true;

        if (esPorcentaje) {
          const p = parseFloat(formData.salario_empleado);
          if (isNaN(p) || p < 1 || p > 100) {
            Alert.alert("Error", "El porcentaje debe estar entre 1 a 100");
            return;
          }
        }
        request.recurrente = true; // Automático para salarios
        request.periodicidad = formData.periodicidad || "diario"; // Automático
      }

      const resultado = await GastoService.update_gasto_modificado(
        gastoEditando.id,
        request,
      );

      if (resultado.success) {
        Alert.alert("Éxito", "Gasto actualizado correctamente");
        setModalEditarVisible(false);
        resetFormulario();

        // Forzar recarga completa de datos para asegurar que se muestre el nuevo porcentaje
        await recargarDatosCompletos();

        // Recarga adicional específica para estadísticas (forzar actualización inmediata)
        setTimeout(async () => {
          await cargarEstadisticas();
        }, 500);
      } else {
        Alert.alert("Error", resultado.message);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo actualizar el gasto");
    }
  };

  // Eliminar gasto
  const eliminarGasto = async (id: number) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de que deseas eliminar este gasto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const resultado = await GastoService.delete_gasto(id);
              if (resultado.success) {
                Alert.alert("Éxito", "Gasto eliminado correctamente");
                await cargarGastos();
                await cargarEstadisticas();
              } else {
                Alert.alert("Error", resultado.message);
              }
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "No se pudo eliminar el gasto",
              );
            }
          },
        },
      ],
    );
  };

  // Editar gasto
  const editarGasto = async (gasto: Gasto) => {
    // Obtener el porcentaje vigente de hoy para salarios
    let porcentajeVigente = "";
    if (gasto.categoria === "Salario") {
      try {
        const fechaHoy = getFechaLocal();
        const porcentaje = await GastoService.obtenerPorcentajeVigenteEnFecha(
          gasto.id!,
          fechaHoy,
        );
        porcentajeVigente = porcentaje.toString();
      } catch (error) {
        console.error("Error obteniendo porcentaje vigente:", error);
        porcentajeVigente = gasto.porcentaje?.toString() || ""; // Fallback al valor guardado
      }
    }

    setFormData({
      nombre: gasto.nombre,
      precio: gasto.precio?.toString() || "",
      salario_empleado: porcentajeVigente, // Usar el porcentaje vigente de hoy
      categoria: gasto.categoria,
      descripcion: gasto.descripcion || "",
      descripcion_deuda: "", // Resetear campo virtual
      tipo: gasto.tipo,
      recurrente: gasto.recurrente || false,
      periodicidad: gasto.periodicidad || "diario",
      fecha_gasto: gasto.fecha_gasto,
      deuda: false, // Resetear campo virtual
    });
    setGastoEditando(gasto);
    setModalEditarVisible(true);
  };

  // Resetear formulario
  const resetFormulario = () => {
    setFormData({
      nombre: "",
      precio: "",
      salario_empleado: "",
      salario_fijo: "",
      categoria: "General",
      descripcion: "",
      descripcion_deuda: "",
      tipo: "casual",
      recurrente: false,
      periodicidad: "diario",
      fecha_gasto: getFechaLocal(),
      deuda: false,
      es_porcentaje: true, // CRÍTICO: incluir es_porcentaje en reset
    });
    setEsDeuda(false);
    setDeudaData({
      fecha_pago: getFechaLocal(),
    });
  };

  // Cargar historial de sueldo
  const cargarHistorialSueldo = async (gasto: Gasto) => {
    if (!puntoId || !gasto.id) return;

    setCargandoHistorial(true);
    setTrabajadorSeleccionado(gasto.nombre);

    try {
      const resultado = await GastoService.obtenerHistorialSalarioDiario(
        puntoId,
        gasto.id,
      );

      if (resultado.success && resultado.data) {
        setHistorialSueldo(resultado.data);
        setModalHistorialSueldoVisible(true);
      } else {
        Alert.alert("Error", resultado.message);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo cargar el historial");
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    const inicializar = async () => {
      if (isAuthenticated && puntoId) {
        await recargarDatosCompletos();
      }
    };
    inicializar();
  }, [isAuthenticated, puntoId, recargarDatosCompletos]);

  // Cargar datos cuando cambian filtros
  useEffect(() => {
    cargarGastos();
    cargarEstadisticas();
  }, [cargarGastos, cargarEstadisticas]);

  // Cargar gastos del modal cuando cambia cualquier filtro
  useEffect(() => {
    if (modalFiltrosVisible) {
      cargarGastosParaModal();
    }
  }, [modalFiltrosVisible, cargarGastosParaModal]);

  // Renderizar item de gasto para el modal
  const renderGastoItemModal = ({ item }: { item: Gasto }) => (
    <View style={styles.gastoItem}>
      <View style={styles.gastoHeader}>
        <Text style={styles.gastoTitle}>{item.nombre || "Sin nombre"}</Text>
        <Text style={styles.gastoAmount}>
          {item.categoria === "General"
            ? `$${(item.precio || 0).toFixed(2)}`
            : item.categoria === "Salario"
              ? `$${(item.precio || 0).toFixed(2)}`
              : `$0.00`}
        </Text>
      </View>
      <View style={styles.gastoMeta}>
        <Text style={styles.gastoCategory}>{item.categoria}</Text>
        <Text style={styles.gastoDate}>
          {formatearFecha(item.fecha_gasto || getFechaLocal())}
        </Text>
      </View>
      {item.descripcion && (
        <Text style={styles.gastoDescription}>{item.descripcion}</Text>
      )}
    </View>
  );

  // Renderizar item de gasto
  const renderGastoItem = ({ item }: { item: Gasto }) => (
    <TouchableOpacity
      style={styles.gastoItem}
      onPress={() => {
        if (item.categoria === "Salario") {
          cargarHistorialSueldo(item);
        }
      }}
      disabled={item.categoria !== "Salario"}
    >
      <View style={styles.gastoHeader}>
        <Text style={styles.gastoTitle}>{item.nombre || "Sin nombre"}</Text>
        <Text style={styles.gastoAmount}>
          {item.categoria === "General"
            ? `$${(item.precio || 0).toFixed(2)}`
            : ""}
        </Text>
      </View>
      <View style={styles.gastoMeta}>
        <Text
          style={[
            styles.gastoCategory,
            item.categoria === "Salario" && styles.gastoCategorySalario,
          ]}
        >
          {item.categoria || "General"}
        </Text>
        <Text
          style={[
            styles.gastoType,
            item.tipo === "pasivo" && styles.tipoPasivo,
          ]}
        >
          {item.tipo || "casual"}
        </Text>
        {item.recurrente && (
          <Text style={styles.recurrenteBadge}>Recurrente</Text>
        )}
      </View>
      {item.descripcion && (
        <Text style={styles.gastoDescription}>{item.descripcion}</Text>
      )}
      <Text style={styles.gastoFecha}>
        Fecha: {formatearFecha(item.fecha_gasto || getFechaLocal())}
      </Text>
      {item.categoria === "Salario" && (
        <Text
          style={[
            styles.gastoDescription,
            { color: "#10b981", fontStyle: "italic" },
          ]}
        >
          💰 Toca para ver historial y detalle de salarios
        </Text>
      )}
      <View style={styles.gastoActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => editarGasto(item)}
        >
          <Ionicons name="create-outline" size={16} color="#3b82f6" />
          <Text style={[styles.actionButtonText, { color: "#3b82f6" }]}>
            Editar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => eliminarGasto(item.id!)}
        >
          <Ionicons name="trash-outline" size={16} color="#dc2626" />
          <Text style={[styles.actionButtonText, { color: "#dc2626" }]}>
            Eliminar
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
          <View style={styles.authModalOverlay}>
            <View style={styles.authModalContainer}>
              <View style={styles.authModalHeader}>
                <Text style={styles.authModalTitle}>Acceso Restringido</Text>
              </View>

              <View style={styles.authModalContent}>
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

                <View style={styles.authFormGroup}>
                  <Text style={styles.authFormLabel}>Contraseña</Text>
                  <TextInput
                    style={styles.authFormInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Ingrese la contraseña"
                    secureTextEntry
                    autoFocus
                    maxLength={20}
                  />
                </View>
              </View>

              <View style={styles.authModalFooter}>
                <TouchableOpacity
                  style={[styles.authModalButton, styles.authCancelButton]}
                  onPress={() => router.back()}
                >
                  <Text style={styles.authCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.authModalButton, styles.authSaveButton]}
                  onPress={verificarPassword}
                >
                  <Text style={styles.authSaveButtonText}>Acceder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - Pegado arriba */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleContainer}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenterContainer}>
            <Text style={styles.headerTitle}>Gastos</Text>
            <Text style={styles.headerSubtitle}>{puntoNombre}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, styles.filterButton]}
              onPress={() => setModalFiltrosVisible(true)}
            >
              <Ionicons name="filter-outline" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.addButton]}
              onPress={() => {
                resetFormulario();
                setModalCrearVisible(true);
              }}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 8,
            paddingHorizontal: 12,
            backgroundColor: "#ffffff",
          }}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color="#6b7280"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={[
              styles.searchInput,
              { borderWidth: 0, paddingHorizontal: 0 },
            ]}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar gastos..."
          />
        </View>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons
              name="wallet-outline"
              size={24}
              color="#10b981"
              style={styles.statIcon}
            />
            <Text style={styles.statValue}>
              {"$" + estadisticas.salario.total.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>SALARIO</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons
              name="cash-outline"
              size={24}
              color="#3b82f6"
              style={styles.statIcon}
            />
            <Text style={styles.statValue}>
              {"$" + estadisticas.total.total.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
        </View>
      </View>

      {/* Lista de gastos */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Cargando gastos...</Text>
        </View>
      ) : gastosFiltrados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={60} color="#9ca3af" />
          <Text style={styles.emptyText}>No hay gastos registrados</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listContainer}
          data={gastosFiltrados}
          renderItem={renderGastoItem}
          keyExtractor={(item) => item.id?.toString() || ""}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={recargarDatosCompletos}
            />
          }
        />
      )}

      {/* Modal Crear Gasto */}
      <Modal
        visible={modalCrearVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalCrearVisible(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Gasto</Text>
            <TouchableOpacity onPress={crearGasto}>
              <Text style={styles.modalSaveButton}>Guardar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre del gasto *</Text>
              <TextInput
                style={styles.input}
                value={formData.nombre}
                onChangeText={(text) =>
                  setFormData({ ...formData, nombre: text })
                }
                placeholder="Ej: Salario del empleado"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.categoria === "General" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      categoria: "General",
                      salario_empleado: "",
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.categoria === "General" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    General
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.categoria === "Salario" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      categoria: "Salario",
                      tipo: "pasivo",
                      recurrente: true,
                      periodicidad: "diario",
                      precio: "",
                      salario_empleado: "",
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.categoria === "Salario" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Salario
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Campo condicional según categoría */}
            {formData.categoria === "General" ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Precio *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.precio}
                  onChangeText={(text) =>
                    setFormData({ ...formData, precio: text })
                  }
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Salario</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      formData.es_porcentaje && styles.segmentButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, es_porcentaje: true })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        formData.es_porcentaje &&
                          styles.segmentButtonTextActive,
                      ]}
                    >
                      Porcentaje (%)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      !formData.es_porcentaje && styles.segmentButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        es_porcentaje: false,
                        salario_empleado: "1", // Valor dummy válido para evitar validación cruzada
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        !formData.es_porcentaje &&
                          styles.segmentButtonTextActive,
                      ]}
                    >
                      Monto Fijo ($)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {formData.categoria === "Salario" && (
              <>
                {formData.es_porcentaje ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>% Salario *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.salario_empleado}
                      onChangeText={(text) =>
                        setFormData({ ...formData, salario_empleado: text })
                      }
                      placeholder="ej: 15 para 15%"
                      keyboardType="numeric"
                    />
                    <Text style={styles.helperText}>
                      ⚠️ Este es un PORCENTAJE de las ganancias. El trabajador
                      recibirá el {formData.salario_empleado || "0"}% de las
                      ganancias{" "}
                      {formData.periodicidad === "diario"
                        ? "del día completo"
                        : formData.periodicidad === "semanal"
                          ? "de la semana completa"
                          : "del mes completo"}{" "}
                      • El monto real se calcula automáticamente
                    </Text>
                  </View>
                ) : (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Monto Fijo Diario ($) *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.salario_fijo}
                      onChangeText={(text) =>
                        setFormData({ ...formData, salario_fijo: text })
                      }
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                    <Text style={styles.helperText}>
                      💰 El trabajador recibirá este monto fijo por el período
                      seleccionado.
                      {formData.periodicidad === "diario"
                        ? "diario"
                        : formData.periodicidad === "semanal"
                          ? "semanal"
                          : "mensual"}
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.descripcion}
                onChangeText={(text) =>
                  setFormData({ ...formData, descripcion: text })
                }
                placeholder="Descripción opcional del gasto"
                multiline
                numberOfLines={3}
              />
            </View>

            {esDeuda && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción de la Deuda *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.descripcion_deuda}
                  onChangeText={(text) =>
                    setFormData({ ...formData, descripcion_deuda: text })
                  }
                  placeholder="Describe los detalles de esta deuda"
                  multiline
                  numberOfLines={2}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.tipo === "casual" && styles.segmentButtonActive,
                    formData.categoria === "Salario" &&
                      styles.segmentButtonDisabled,
                  ]}
                  onPress={() => {
                    if (formData.categoria !== "Salario") {
                      setFormData({ ...formData, tipo: "casual" });
                    }
                  }}
                  disabled={formData.categoria === "Salario"}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.tipo === "casual" &&
                        styles.segmentButtonTextActive,
                      formData.categoria === "Salario" &&
                        styles.segmentButtonTextDisabled,
                    ]}
                  >
                    Casual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.tipo === "pasivo" && styles.segmentButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, tipo: "pasivo" })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.tipo === "pasivo" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Pasivo
                  </Text>
                </TouchableOpacity>
              </View>
              {formData.categoria === "Salario" && (
                <Text style={styles.helperText}>
                  Los gastos de salarios siempre se configuran como "Pasivo"
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Fecha del gasto</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#f5f5f5" }]}
                value={formData.fecha_gasto}
                editable={false}
                placeholder="Fecha actual"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  style={styles.radioButton}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      recurrente: !formData.recurrente,
                    });
                    // Si se marca recurrente, desmarcar deuda
                    if (!formData.recurrente) {
                      setEsDeuda(false);
                      setFormData((prev) => ({ ...prev, deuda: false }));
                    }
                  }}
                >
                  <View
                    style={[
                      styles.radioInner,
                      formData.recurrente && styles.radioInnerChecked,
                    ]}
                  >
                    {formData.recurrente && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.radioLabel}>Recurrente</Text>
              </View>

              {formData.recurrente && (
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      formData.periodicidad === "diario" &&
                        styles.segmentButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, periodicidad: "diario" })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        formData.periodicidad === "diario" &&
                          styles.segmentButtonTextActive,
                      ]}
                    >
                      Diario
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      formData.periodicidad === "semanal" &&
                        styles.segmentButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, periodicidad: "semanal" })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        formData.periodicidad === "semanal" &&
                          styles.segmentButtonTextActive,
                      ]}
                    >
                      Semanal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      formData.periodicidad === "mensual" &&
                        styles.segmentButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, periodicidad: "mensual" })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        formData.periodicidad === "mensual" &&
                          styles.segmentButtonTextActive,
                      ]}
                    >
                      Mensual
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  style={styles.radioButton}
                  onPress={() => {
                    const nuevoEstadoDeuda = !esDeuda;
                    setEsDeuda(nuevoEstadoDeuda);
                    setFormData({ ...formData, deuda: nuevoEstadoDeuda });
                    // Si se marca deuda, desmarcar recurrente
                    if (nuevoEstadoDeuda) {
                      setFormData((prev) => ({ ...prev, recurrente: false }));
                    }
                  }}
                >
                  <View
                    style={[
                      styles.radioInner,
                      esDeuda && styles.radioInnerChecked,
                    ]}
                  >
                    {esDeuda && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.radioLabel}>Generar como deuda</Text>
              </View>

              {esDeuda && (
                <View style={styles.deudaInfo}>
                  <Text style={styles.deudaInfoText}>
                    💰 Se creará automáticamente una deuda en el sistema
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Editar Gasto */}
      <Modal
        visible={modalEditarVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalEditarVisible(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar Gasto</Text>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={formData.nombre}
                onChangeText={(text) =>
                  setFormData({ ...formData, nombre: text })
                }
                placeholder="Nombre del gasto"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.categoria === "General" &&
                      styles.segmentButtonActive,
                    formData.categoria === "Salario" &&
                      styles.segmentButtonDisabled,
                  ]}
                  onPress={() => {
                    if (formData.categoria !== "Salario") {
                      setFormData({
                        ...formData,
                        categoria: "General",
                        salario_empleado: "",
                      });
                    }
                  }}
                  disabled={formData.categoria === "Salario"}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.categoria === "General" &&
                        styles.segmentButtonTextActive,
                      formData.categoria === "Salario" &&
                        styles.segmentButtonTextDisabled,
                    ]}
                  >
                    General
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.categoria === "Salario" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, categoria: "Salario" })
                  }
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.categoria === "Salario" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Salario
                  </Text>
                </TouchableOpacity>
              </View>
              {formData.categoria === "Salario" && (
                <Text style={styles.helperText}>
                  Los gastos de salarios siempre se configuran como "Pasivo"
                </Text>
              )}
            </View>

            {/* Campo condicional según categoría */}
            {formData.categoria === "General" ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Precio *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.precio}
                  onChangeText={(text) =>
                    setFormData({ ...formData, precio: text })
                  }
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Salario</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      formData.es_porcentaje && styles.segmentButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, es_porcentaje: true })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        formData.es_porcentaje &&
                          styles.segmentButtonTextActive,
                      ]}
                    >
                      Porcentaje (%)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      !formData.es_porcentaje && styles.segmentButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        es_porcentaje: false,
                        salario_empleado: "1", // Valor dummy válido para evitar validación cruzada
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        !formData.es_porcentaje &&
                          styles.segmentButtonTextActive,
                      ]}
                    >
                      Monto Fijo ($)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {formData.categoria === "Salario" && (
              <>
                {formData.es_porcentaje ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>% Salario *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.salario_empleado}
                      onChangeText={(text) =>
                        setFormData({ ...formData, salario_empleado: text })
                      }
                      placeholder="ej: 15 para 15%"
                      keyboardType="numeric"
                    />
                    <Text style={styles.helperText}>
                      ⚠️ Este es un PORCENTAJE de las ganancias. El trabajador
                      recibirá el {formData.salario_empleado || "0"}% de las
                      ganancias{" "}
                      {formData.periodicidad === "diario"
                        ? "del día completo"
                        : formData.periodicidad === "semanal"
                          ? "de la semana completa"
                          : "del mes completo"}{" "}
                      • El monto real se calcula automáticamente
                    </Text>
                  </View>
                ) : (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Monto Fijo Diario ($) *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.salario_fijo}
                      onChangeText={(text) =>
                        setFormData({ ...formData, salario_fijo: text })
                      }
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                    <Text style={styles.helperText}>
                      💰 El trabajador recibirá este monto fijo por el período
                      seleccionado.
                      {formData.periodicidad === "diario"
                        ? "diario"
                        : formData.periodicidad === "semanal"
                          ? "semanal"
                          : "mensual"}
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.descripcion}
                onChangeText={(text) =>
                  setFormData({ ...formData, descripcion: text })
                }
                placeholder="Descripción opcional del gasto"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.tipo === "casual" && styles.segmentButtonActive,
                    formData.categoria === "Salario" &&
                      styles.segmentButtonDisabled,
                  ]}
                  onPress={() => {
                    if (formData.categoria !== "Salario") {
                      setFormData({ ...formData, tipo: "casual" });
                    }
                  }}
                  disabled={formData.categoria === "Salario"}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.tipo === "casual" &&
                        styles.segmentButtonTextActive,
                      formData.categoria === "Salario" &&
                        styles.segmentButtonTextDisabled,
                    ]}
                  >
                    Casual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.tipo === "pasivo" && styles.segmentButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, tipo: "pasivo" })}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formData.tipo === "pasivo" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Pasivo
                  </Text>
                </TouchableOpacity>
              </View>
              {formData.categoria === "Salario" && (
                <Text style={styles.helperText}>
                  Los gastos de salarios siempre se configuran como "Pasivo"
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Fecha del gasto</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#f5f5f5" }]}
                value={formData.fecha_gasto}
                editable={false}
                placeholder="Fecha actual"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Filtros */}
      <Modal
        visible={modalFiltrosVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ width: 24 }} />
            <Text style={styles.modalTitle}>Filtros</Text>
            <TouchableOpacity onPress={() => setModalFiltrosVisible(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Búsqueda</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={[
                    styles.searchInput,
                    { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8 },
                  ]}
                  placeholder="Buscar gastos..."
                  value={busquedaModal}
                  onChangeText={setBusquedaModal}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Período</Text>
              <View style={styles.periodSegmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.periodSegmentButton,
                    filtroPeriodoModal === "todos" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroPeriodoModal("todos")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroPeriodoModal === "todos" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.periodSegmentButton,
                    filtroPeriodoModal === "hoy" && styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroPeriodoModal("hoy")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroPeriodoModal === "hoy" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Hoy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.periodSegmentButton,
                    filtroPeriodoModal === "semana" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroPeriodoModal("semana")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroPeriodoModal === "semana" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Semana
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.periodSegmentButton,
                    filtroPeriodoModal === "mes" && styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroPeriodoModal("mes")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroPeriodoModal === "mes" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Mes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.periodSegmentButton,
                    filtroPeriodoModal === "periodo" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroPeriodoModal("periodo")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroPeriodoModal === "periodo" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Personalizado
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {filtroPeriodoModal === "periodo" && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Fecha inicio</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      setDatePickerMode("inicio");
                      setDatePickerSource("modal");
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.dateButtonText}>
                      {fechaInicioModal
                        ? formatearFecha(fechaInicioModal)
                        : "Seleccionar fecha"}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#6b7280"
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Fecha fin</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      setDatePickerMode("fin");
                      setDatePickerSource("modal");
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.dateButtonText}>
                      {fechaFinModal
                        ? formatearFecha(fechaFinModal)
                        : "Seleccionar fecha"}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#6b7280"
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    filtroCategoriaModal === "todos" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroCategoriaModal("todos")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroCategoriaModal === "todos" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    filtroCategoriaModal === "general" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroCategoriaModal("general")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroCategoriaModal === "general" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    General
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    filtroCategoriaModal === "salario" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() => setFiltroCategoriaModal("salario")}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      filtroCategoriaModal === "salario" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Salario
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Resultados de filtros */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Resultados ({gastosModalFiltrados.length} gastos)
              </Text>
              {gastosModalFiltrados.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No se encontraron gastos con los filtros seleccionados
                  </Text>
                </View>
              ) : (
                <View style={{ maxHeight: 300 }}>
                  {gastosModalFiltrados.map((item) => (
                    <View key={item.id?.toString() || Math.random().toString()}>
                      {renderGastoItemModal({ item })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Historial de Sueldo */}
      <Modal
        visible={modalHistorialSueldoVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalHistorialSueldoVisible(false)}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Historial de Sueldo</Text>
            <View style={{ width: 24 }} />
          </View>

          {cargandoHistorial ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Cargando historial...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Trabajador</Text>
                <Text
                  style={[
                    styles.input,
                    { backgroundColor: "#f3f4f6", color: "#1f2937" },
                  ]}
                >
                  {trabajadorSeleccionado}
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Resumen del mes</Text>
                <View
                  style={{
                    backgroundColor: "#f0fdf4",
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#bbf7d0",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, color: "#166534", marginBottom: 4 }}
                  >
                    💰 Total ventas: $
                    {historialSueldo
                      .reduce((sum, dia) => sum + dia.ventas, 0)
                      .toFixed(2)}
                  </Text>
                  <Text
                    style={{ fontSize: 14, color: "#166534", marginBottom: 4 }}
                  >
                    💼 Salario teórico: $
                    {historialSueldo
                      .reduce(
                        (sum, dia) => sum + dia.ventas * (dia.porcentaje / 100),
                        0,
                      )
                      .toFixed(2)}
                  </Text>
                  <Text
                    style={{ fontSize: 14, color: "#dc2626", marginBottom: 4 }}
                  >
                    🛒 Consumos propios: $
                    {historialSueldo
                      .reduce(
                        (sum, dia) =>
                          sum + ((dia as any).consumos_propios || 0),
                        0,
                      )
                      .toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      color: "#166534",
                      fontWeight: "600",
                      marginBottom: 4,
                    }}
                  >
                    💳 Salario final: $
                    {historialSueldo
                      .reduce((sum, dia) => sum + dia.sueldo, 0)
                      .toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Historial diario</Text>
                {historialSueldo.length === 0 ? (
                  <Text
                    style={{
                      textAlign: "center",
                      color: "#6b7280",
                      padding: 20,
                    }}
                  >
                    No hay datos disponibles
                  </Text>
                ) : (
                  historialSueldo.map((dia, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <View>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "600",
                              color: "#1f2937",
                            }}
                          >
                            {dia.dia}
                          </Text>
                          <Text style={{ fontSize: 12, color: "#6b7280" }}>
                            {formatearFecha(dia.fecha)}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 12, color: "#6b7280" }}>
                            Ventas: ${dia.ventas.toFixed(2)}
                          </Text>
                          <Text style={{ fontSize: 12, color: "#3b82f6" }}>
                            {dia.es_porcentaje
                              ? `Porcentaje: ${dia.porcentaje}%`
                              : `Salario Fijo: $${dia.salario_fijo || 0}`}
                          </Text>
                          {(dia as any).salario_teorico !== undefined && (
                            <Text style={{ fontSize: 12, color: "#059669" }}>
                              Teórico: $
                              {(dia as any).salario_teorico.toFixed(2)}
                            </Text>
                          )}
                          {(dia as any).consumos_propios !== undefined &&
                            (dia as any).consumos_propios > 0 && (
                              <Text style={{ fontSize: 12, color: "#dc2626" }}>
                                Consumos: -$
                                {(dia as any).consumos_propios.toFixed(2)}
                              </Text>
                            )}
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "600",
                              color: "#10b981",
                            }}
                          >
                            Final: ${dia.sueldo.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* DateTimePicker */}
      {showDatePicker && (
        <DateTimePicker
          value={
            datePickerMode === "inicio"
              ? new Date(
                  datePickerSource === "modal"
                    ? fechaInicioModal || new Date()
                    : fechaInicio || new Date(),
                )
              : new Date(
                  datePickerSource === "modal"
                    ? fechaFinModal || new Date()
                    : fechaFin || new Date(),
                )
          }
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (event.type === "set" && selectedDate) {
              // ✅ Extraer componentes locales para mantener la fecha exacta (evitar UTC)
              const año = selectedDate.getFullYear();
              const mes = String(selectedDate.getMonth() + 1).padStart(2, "0");
              const día = String(selectedDate.getDate()).padStart(2, "0");
              const dateStr = `${año}-${mes}-${día}`;

              if (datePickerMode === "inicio") {
                if (datePickerSource === "modal") {
                  setFechaInicioModal(dateStr);
                } else {
                  setFechaInicio(dateStr);
                }
              } else {
                if (datePickerSource === "modal") {
                  setFechaFinModal(dateStr);
                } else {
                  setFechaFin(dateStr);
                }
              }
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}
