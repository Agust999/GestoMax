// app/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  restoreNavigationState,
  useAppState,
} from "../components/NavigationPersistence";
import { initDatabase } from "../src/db/database";
import {
  OfertaHelper,
  PrestamoDeudaHelper,
  ProductoHelper,
  PuntoHelper,
} from "../src/db/databaseHelper";
import { AgendaService } from "../src/db/services/agenda_service";
import { AuthService } from "../src/db/services/auth_service";
import { BackupService } from "../src/db/services/backup_service_final";
import { CierreService } from "../src/db/services/cierre_service";
import { GastoService } from "../src/db/services/gasto_service";
import LicenseService, {
  LicenseValidationResult,
} from "../src/db/services/license_service";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hook para detectar estado de la app
  const appState = useAppState();
  console.log("📱 Estado actual de la app:", appState);
  const [totalDineroAlmacen, setTotalDineroAlmacen] = useState(0);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [gastosHoy, setGastosHoy] = useState(0);
  const [productosVencidos, setProductosVencidos] = useState(0);
  const [productosPorVencer, setProductosPorVencer] = useState(0);
  const [prestamosVencidos, setPrestamosVencidos] = useState(0);
  const [prestamosProximos, setPrestamosProximos] = useState(0);
  const [eventosHoy, setEventosHoy] = useState(0);
  const [eventosProximos, setEventosProximos] = useState(0);
  const [totalPrestamosPendientes, setTotalPrestamosPendientes] = useState(0);

  // Estado para el modal de alertas del Estado del Sistema
  const [modalAlertasVisible, setModalAlertasVisible] = useState(false);
  const [alertasData, setAlertasData] = useState<any[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);

  // Función para cargar datos de alertas del Estado del Sistema
  const cargarAlertasSistema = async () => {
    try {
      setLoadingAlertas(true);
      const alertasArray = [];

      // Productos vencidos
      if (productosVencidos > 0) {
        const productosVencidosData =
          await ProductoHelper.getProximosAVencer(30);
        const vencidos = productosVencidosData.filter(
          (p) => p.dias_restantes <= 0,
        );
        alertasArray.push(
          ...vencidos.map((p) => ({
            tipo: "producto_vencido",
            titulo: "Producto Vencido",
            descripcion: `${p.nombre} - Vencido hace ${Math.abs(p.dias_restantes)} días`,
            dias_restantes: p.dias_restantes,
            categoria: p.categoria,
            precio_coste: p.precio_coste,
            precio_venta: p.precio_venta,
            cantidad_disponible: p.cantidad_disponible,
            ubicacion_nombre: p.ubicacion_nombre,
            tipo_ubicacion: p.tipo_ubicacion,
            zona_detalle: p.zona_detalle,
            punto: p.ubicacion_nombre,
          })),
        );
      }

      // Productos por vencer
      if (productosPorVencer > 0) {
        const productosProximosData =
          await ProductoHelper.getProximosAVencer(30);
        const porVencer = productosProximosData.filter(
          (p) => p.dias_restantes > 0 && p.dias_restantes <= 30,
        );
        alertasArray.push(
          ...porVencer.map((p) => ({
            tipo: "producto_por_vencer",
            titulo: "Producto por Vencer",
            descripcion: `${p.nombre} - Vence en ${p.dias_restantes} días`,
            dias_restantes: p.dias_restantes,
            categoria: p.categoria,
            precio_coste: p.precio_coste,
            precio_venta: p.precio_venta,
            cantidad_disponible: p.cantidad_disponible,
            ubicacion_nombre: p.ubicacion_nombre,
            tipo_ubicacion: p.tipo_ubicacion,
            zona_detalle: p.zona_detalle,
            punto: p.ubicacion_nombre,
          })),
        );
      }

      // Préstamos vencidos
      if (prestamosVencidos > 0) {
        const prestamosVencidosData = await PrestamoDeudaHelper.getVencidos();
        alertasArray.push(
          ...prestamosVencidosData.map((p) => ({
            tipo: "prestamo_vencido",
            titulo: "Deuda Vencida",
            descripcion: `${p.descripcion} - Vencida hace ${Math.abs(p.dias_restantes || 0)} días`,
            dias_restantes: p.dias_restantes,
            monto: p.monto,
            fecha_inicio: p.fecha_inicio,
            fecha_vencimiento: p.fecha_vencimiento,
            punto: p.punto_nombre,
          })),
        );
      }

      // Préstamos próximos
      if (prestamosProximos > 0) {
        const prestamosProximosData =
          await PrestamoDeudaHelper.getProximosAVencer(7);
        alertasArray.push(
          ...prestamosProximosData.map((p) => ({
            tipo: "prestamo_proximo",
            titulo: "Deuda por Vencer",
            descripcion: `${p.descripcion} - Vence en ${p.dias_restantes} días`,
            dias_restantes: p.dias_restantes,
            monto: p.monto,
            fecha_inicio: p.fecha_inicio,
            fecha_vencimiento: p.fecha_vencimiento,
            punto: p.punto_nombre,
          })),
        );
      }

      // Eventos de hoy
      if (eventosHoy > 0) {
        const eventosHoyData = await AgendaService.getEventosHoy();
        alertasArray.push(
          ...eventosHoyData.map((e) => ({
            tipo: "evento_hoy",
            titulo: "Evento para Hoy",
            descripcion: `${e.titulo} - ${e.hora}`,
            fecha: e.fecha,
            hora: e.hora,
            tipo_evento: e.tipo,
            prioridad: e.prioridad,
            ubicacion: e.ubicacion,
            punto: e.punto_nombre || "General",
          })),
        );
      }

      // Eventos próximos
      if (eventosProximos > 0) {
        const eventosProximosData = await AgendaService.getEventosSemana();
        alertasArray.push(
          ...eventosProximosData.map((e) => ({
            tipo: "evento_proximo",
            titulo: "Evento Próximo",
            descripcion: `${e.titulo} - ${e.fecha} ${e.hora}`,
            fecha: e.fecha,
            hora: e.hora,
            tipo_evento: e.tipo,
            prioridad: e.prioridad,
            ubicacion: e.ubicacion,
            punto: e.punto_nombre || "General",
          })),
        );
      }

      // Alerta de cierre diario pendiente (falta 8 horas para finalizar el día)
      const ahora = new Date();
      const finDia = new Date();
      finDia.setHours(23, 59, 59, 999); // Final del día
      const horasRestantes =
        (finDia.getTime() - ahora.getTime()) / (1000 * 60 * 60);

      if (horasRestantes <= 8 && horasRestantes > 0) {
        const puntos = await PuntoHelper.getAll();
        const puntosSinCerrar = [];

        for (const punto of puntos) {
          const tieneCierreHoy = await CierreService.existeCierreHoy(punto.id);
          if (!tieneCierreHoy) {
            // Verificar si hay ventas hoy para no alertar puntos inactivos
            const ventasHoy = await PuntoHelper.getVentasHoy(punto.id);
            if (ventasHoy > 0) {
              puntosSinCerrar.push({
                id: punto.id,
                nombre: punto.nombre,
                ventas: ventasHoy,
              });
            }
          }
        }

        if (puntosSinCerrar.length > 0) {
          const horasMinutos = `${Math.floor(horasRestantes)}h ${Math.floor((horasRestantes % 1) * 60)}min`;
          alertasArray.push({
            tipo: "cierre_pendiente",
            titulo: "Cierre Diario Pendiente",
            descripcion: `Quedan ${horasMinutos} para finalizar el día. ${puntosSinCerrar.length} punto(s) sin cerrar.`,
            puntos_pendientes: puntosSinCerrar,
            horas_restantes: horasRestantes,
            urgencia:
              horasRestantes <= 2
                ? "alta"
                : horasRestantes <= 4
                  ? "media"
                  : "baja",
          });
        }
      }

      setAlertasData(alertasArray);
    } catch (error) {
      console.error("Error cargando alertas del sistema:", error);
      setAlertasData([]);
    } finally {
      setLoadingAlertas(false);
    }
  };

  // Estado para el modal de productos por vencer
  const [modalProductosVencerVisible, setModalProductosVencerVisible] =
    useState(false);
  const [productosVencerData, setProductosVencerData] = useState<any[]>([]);
  const [loadingProductosVencer, setLoadingProductosVencer] = useState(false);

  // Calcular total de alertas para el centro de notificaciones
  const totalAlertas =
    productosVencidos +
    productosPorVencer +
    prestamosVencidos +
    prestamosProximos +
    eventosHoy +
    eventosProximos;
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Estados de licenciamiento
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseValidationResult | null>(null);
  const [userCode, setUserCode] = useState<string>("");
  const [licenseModalVisible, setLicenseModalVisible] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseLoading, setLicenseLoading] = useState(false);

  // Estados de autenticación para importar base de datos
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados para configuración de contraseña
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configPassword, setConfigPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isConfigAuthenticated, setIsConfigAuthenticated] = useState(false);

  // Estados para recuperación de contraseña
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<
    "menu" | "security" | "code"
  >("menu");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isSecuritySetup, setIsSecuritySetup] = useState(false);

  // Estados para configuración inicial de seguridad
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [selectedSecurityQuestion, setSelectedSecurityQuestion] = useState("");
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState("");
  const [securityAnswerSetup, setSecurityAnswerSetup] = useState("");
  const [recoveryHint, setRecoveryHint] = useState("");
  const [showCodesSetup, setShowCodesSetup] = useState(false);
  const router = useRouter();

  // Función para cargar productos por vencer con ubicación
  const cargarProductosPorVencerConUbicacion = async () => {
    try {
      setLoadingProductosVencer(true);
      const productos = await ProductoHelper.getProximosAVencerConUbicacion(
        30,
        100,
      );
      setProductosVencerData(productos);
    } catch (error) {
      console.error("Error al cargar productos por vencer:", error);
      Alert.alert("Error", "No se pudieron cargar los productos por vencer");
    } finally {
      setLoadingProductosVencer(false);
    }
  };

  // Obtener datos de la base de datos
  const fetchData = async () => {
    try {
      // Obtener total dinero en almacén
      const totalAlmacen = await ProductoHelper.getTotalDineroAlmacen();
      setTotalDineroAlmacen(totalAlmacen);

      // Obtener ventas del día (sumar todos los puntos)
      let totalVentas = 0;
      const puntos = await PuntoHelper.getAll();

      for (const punto of puntos) {
        const ventasPunto = await PuntoHelper.getVentasHoy(punto.id);
        totalVentas += ventasPunto;
      }
      setVentasHoy(totalVentas);

      // Obtener productos próximos a vencer (30 días)
      const productosProximosAVencer =
        await ProductoHelper.getProximosAVencer(30);

      console.log("🔍 === DEPURACIÓN PRODUCTOS POR VENCER ===");
      console.log(
        `🔍 Total de productos encontrados: ${productosProximosAVencer.length}`,
      );

      // Mostrar primeros 5 productos para depuración
      console.log("🔍 Primeros 5 productos:");
      productosProximosAVencer.slice(0, 5).forEach((p, index) => {
        console.log(`🔍 [${index}] ${p.nombre}:`);
        console.log(`   - dias_restantes: ${p.dias_restantes}`);
        console.log(`   - cantidad_disponible: ${p.cantidad_disponible}`);
        console.log(`   - ubicacion_nombre: "${p.ubicacion_nombre}"`);
        console.log(`   - tipo_ubicacion: "${p.tipo_ubicacion}"`);
        console.log(`   - zona_detalle: "${p.zona_detalle}"`);
      });

      const vencidos = productosProximosAVencer.filter(
        (p) => p.dias_restantes <= 0,
      );
      const porVencer = productosProximosAVencer.filter(
        (p) => p.dias_restantes > 0 && p.dias_restantes <= 30,
      );

      console.log(`🔍 Productos vencidos: ${vencidos.length}`);
      console.log(`🔍 Productos por vencer: ${porVencer.length}`);
      console.log(`🔍 ================================`);

      setProductosVencidos(vencidos.length);
      setProductosPorVencer(porVencer.length);

      // OBTENER DATOS REALES DE PRÉSTAMOS/DEUDAS
      const prestamosVencidosData = await PrestamoDeudaHelper.getVencidos();
      const prestamosProximosData =
        await PrestamoDeudaHelper.getProximosAVencer(7);
      const totalPendiente = await PrestamoDeudaHelper.getTotalPendiente();

      setPrestamosVencidos(prestamosVencidosData.length);
      setPrestamosProximos(prestamosProximosData.length);
      setTotalPrestamosPendientes(totalPendiente);

      // OBTENER DATOS DE EVENTOS DE LA AGENDA
      try {
        const eventosHoyData = await AgendaService.getEventosHoy();
        const eventosProximosData = await AgendaService.getEventosSemana();

        setEventosHoy(eventosHoyData.length);
        setEventosProximos(
          eventosProximosData.filter(
            (e) => !eventosHoyData.some((h) => h.id === e.id),
          ).length,
        );
      } catch (error) {
        console.error("Error cargando eventos:", error);
        setEventosHoy(0);
        setEventosProximos(0);
      }

      // Obtener gastos de hoy de todos los puntos
      let totalGastos = 0;
      for (const punto of puntos) {
        const gastosPunto = await GastoService.obtenerGastosPorPeriodo(
          punto.id,
          "hoy",
        );

        // Calcular montos reales para gastos
        let totalPunto = 0;
        for (const gasto of gastosPunto) {
          if (gasto.categoria === "Salario") {
            // Para salarios: usar el precio directamente (ya es un monto calculado)
            const montoReal = gasto.precio || 0;
            console.log(
              `💳 ${gasto.nombre}: Salario = $${montoReal.toFixed(2)}`,
            );
            totalPunto += montoReal;
          } else {
            // Para gastos generales: usar el precio directamente
            const montoReal = gasto.precio || 0;
            console.log(`📋 ${gasto.nombre}: $${montoReal.toFixed(2)}`);
            totalPunto += montoReal;
          }
        }

        totalGastos += totalPunto;
      }
      setGastosHoy(totalGastos);
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    }
  };

  // En app/index.tsx, modifica el useEffect:
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("🔄 Inicializando aplicación...");

        // USAR LA VERSIÓN DE DESARROLLO
        const success = await initDatabase();

        if (!success) {
          throw new Error("No se pudo inicializar la base de datos");
        }

        console.log("✅ Base de datos lista");

        // Crear tabla de ofertas
        await OfertaHelper.createTable();

        // Intentar restaurar navegación - ahora verifica si es inicio fresco
        console.log("🔄 Verificando si restaurar navegación...");
        const wasRestored = await restoreNavigationState(router);
        if (wasRestored) {
          console.log("📍 Navegación restaurada exitosamente");
          setLoading(false);
          return; // No cargar datos si se restauró navegación
        }

        console.log(
          "🔄 No se restauró navegación (inicio fresco o sin estado), cargando datos normalmente",
        );

        // Cargar datos solo si no se restauró navegación
        await fetchData();

        // Cargar estado de licencia
        await loadLicenseStatus();
      } catch (error) {
        console.error("❌ Error initializing app:", error);
        Alert.alert("Error", "No se pudo inicializar la aplicación");
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Cargar estado de licencia
  const loadLicenseStatus = async () => {
    try {
      // Verificar si LicenseService está disponible
      if (!LicenseService) {
        console.log(
          "⚠️ LicenseService no disponible - omitiendo validación de licencia",
        );
        return;
      }

      const [status, user] = await Promise.all([
        LicenseService.validateLicense(),
        LicenseService.getUserCode(),
      ]);

      setLicenseStatus(status);
      setUserCode(user);

      // Mostrar advertencia si quedan 7 días o menos
      if (
        status.needsActivation &&
        status.daysRemaining <= 7 &&
        status.canUseApp
      ) {
        Alert.alert(
          "⚠️ Advertencia de Licencia",
          `Tu período de prueba termina en ${status.daysRemaining} días. Contacta al desarrollador con tu código de usuario para obtener tu clave de activación.`,
          [{ text: "Entendido" }],
        );
      }
    } catch (error) {
      console.error("Error cargando estado de licencia:", error);
    }
  };

  // Activar licencia
  const activateLicense = async () => {
    if (!licenseKey.trim()) {
      Alert.alert("Error", "Por favor ingresa una clave de licencia válida");
      return;
    }

    // Verificar si LicenseService está disponible
    if (!LicenseService) {
      Alert.alert("Error", "Servicio de licencia no disponible");
      return;
    }

    setLicenseLoading(true);

    try {
      const result = await LicenseService.activateLicense(licenseKey.trim());

      if (result.success) {
        Alert.alert("✅ ¡Licencia Activada!", result.message, [
          {
            text: "OK",
            onPress: () => {
              setLicenseModalVisible(false);
              setLicenseKey("");
              loadLicenseStatus(); // Recargar estado
            },
          },
        ]);
      } else {
        Alert.alert("Error de Activación", result.message);
      }
    } catch (error) {
      console.error("Error activando licencia:", error);
      Alert.alert("Error", "Ocurrió un error al activar la licencia");
    } finally {
      setLicenseLoading(false);
    }
  };

  // Copiar User Code al portapapeles
  const copyUserCode = async () => {
    try {
      await Clipboard.setString(userCode || "");
      Alert.alert(
        "✅ Código Copiado",
        `Tu código ${userCode} ha sido copiado al portapapeles.\n\nAhora puedes pegarlo en WhatsApp o cualquier otra aplicación.`,
        [{ text: "OK" }],
      );
    } catch (err) {
      console.error("Error copiando código:", err);
      Alert.alert(
        "Error",
        "No se pudo copiar el código. Por favor, cópialo manualmente.",
        [{ text: "OK" }],
      );
    }
  };

  // Cargar códigos de recuperación cuando se autentica en configuración
  useEffect(() => {
    if (isConfigAuthenticated) {
      cargarCodigosRecuperacion();
    }
  }, [isConfigAuthenticated]);

  const navegarAPunto = () => {
    router.push("/punto");
  };

  const navegarAPrestamos = () => {
    router.push("/prestamos");
  };

  const navegarAAgenda = () => {
    router.push("/agenda");
  };

  const navegarAAlmacenes = () => {
    router.push("/almacenes");
  };

  const recargarDatos = () => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  };

  // Función para exportar base de datos
  const exportarBaseDatos = async () => {
    try {
      setBackupLoading(true);
      Alert.alert(
        "Exportar Base de Datos",
        "¿Desea crear un backup de toda la base de datos? Esto puede tomar unos segundos...",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Exportar",
            onPress: async () => {
              try {
                const result = await BackupService.exportarBaseDatos();
                if (result.success) {
                  Alert.alert("Éxito", result.message, [
                    {
                      text: "OK",
                    },
                    {
                      text: "Compartir",
                      onPress: async () => {
                        if (result.filePath) {
                          const shareResult =
                            await BackupService.compartirBackup(
                              result.filePath,
                            );
                          if (!shareResult.success) {
                            Alert.alert("Error", shareResult.message);
                          }
                        }
                      },
                    },
                  ]);
                } else {
                  Alert.alert("Error", result.message);
                }
              } catch (error) {
                Alert.alert("Error", "No se pudo exportar la base de datos");
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo iniciar el proceso de exportación");
    } finally {
      setBackupLoading(false);
    }
  };

  // Función para importar base de datos
  const importarBaseDatos = () => {
    // Mostrar modal de autenticación
    setAuthModalVisible(true);
  };

  // Función de verificación de contraseña para importar BD
  const verificarPassword = async () => {
    try {
      console.log("🔐 DEBUG: AuthService disponible:", !!AuthService);
      console.log("🔐 DEBUG: password:", password);

      if (!AuthService) {
        console.error("❌ ERROR IMPORT BD: AuthService no está disponible");
        Alert.alert("Error", "Servicio de autenticación no disponible");
        return;
      }

      const isValid = await AuthService.verifyPassword(password);
      console.log("🔐 DEBUG IMPORT BD: isValid:", isValid);

      if (isValid) {
        setIsAuthenticated(true);
        setAuthModalVisible(false);
        setPassword("");
        // Ejecutar la función de importar
        ejecutarImportacion();
      } else {
        Alert.alert("Error", "Contraseña incorrecta");
        setPassword("");
      }
    } catch (error) {
      console.error("❌ ERROR IMPORT BD en verificarPassword:", error);
      Alert.alert("Error", "Ocurrió un error al verificar la contraseña");
      setPassword("");
    }
  };

  // Función para abrir configuración de contraseña
  const abrirConfiguracion = () => {
    setConfigModalVisible(true);
    setIsConfigAuthenticated(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // Función para verificar contraseña actual en configuración
  const verificarConfigPassword = async () => {
    try {
      console.log("🔐 DEBUG: AuthService disponible:", !!AuthService);
      console.log("🔐 DEBUG: currentPassword:", currentPassword);

      if (!AuthService) {
        console.error("❌ ERROR: AuthService no está disponible");
        Alert.alert("Error", "Servicio de autenticación no disponible");
        return;
      }

      const isValid = await AuthService.verifyPassword(currentPassword);
      console.log("🔐 DEBUG: isValid:", isValid);

      if (isValid) {
        setIsConfigAuthenticated(true);
        setCurrentPassword("");
      } else {
        Alert.alert("Error", "Contraseña actual incorrecta");
        setCurrentPassword("");
      }
    } catch (error) {
      console.error("❌ ERROR en verificarConfigPassword:", error);
      Alert.alert("Error", "Ocurrió un error al verificar la contraseña");
      setCurrentPassword("");
    }
  };

  // Función para guardar nueva contraseña
  const guardarNuevaContraseña = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Las contraseñas nuevas no coinciden");
      return;
    }

    if (newPassword.length < 4) {
      Alert.alert("Error", "La contraseña debe tener al menos 4 caracteres");
      return;
    }

    const result = await AuthService.setPassword(newPassword);
    if (result.success) {
      Alert.alert("Éxito", result.message);
      setConfigModalVisible(false);
      setIsConfigAuthenticated(false);
      setNewPassword("");
      setConfirmPassword("");
    } else {
      Alert.alert("Error", result.message);
    }
  };

  // ===== FUNCIONES DE RECUPERACIÓN DE CONTRASEÑA =====

  // Abrir modal de recuperación
  const abrirRecuperacion = async () => {
    try {
      // Verificar si hay seguridad configurada
      const securitySetup = await AuthService.isSecuritySetup();
      console.log("🔐 DEBUG: isSecuritySetup =", securitySetup);
      setIsSecuritySetup(securitySetup);

      // Cargar pregunta de seguridad si existe
      if (securitySetup) {
        const securityData = await AuthService.getSecurityData();
        console.log("🔐 DEBUG: securityData =", securityData);
        if (securityData) {
          setSecurityQuestion(securityData.securityQuestion);
        }

        // Cargar códigos de recuperación
        let codes = await AuthService.getRecoveryCodes();
        console.log("🔐 DEBUG: recoveryCodes iniciales =", codes);

        // Si no hay códigos, generar nuevos
        if (codes.length === 0) {
          console.log("🔐 DEBUG: Generando nuevos códigos...");
          codes = AuthService.generateRecoveryCodes();

          // Guardar los nuevos códigos
          await AsyncStorage.setItem(
            "GESTOMAX_RECOVERY_CODES",
            JSON.stringify(codes),
          );
          console.log("🔐 DEBUG: Códigos generados y guardados =", codes);
        }

        setRecoveryCodes(codes);
        console.log("🔐 DEBUG: Códigos cargados =", codes);
      }

      setRecoveryModalVisible(true);
      setRecoveryStep("menu");
      setSecurityAnswer("");
      setRecoveryCode("");
    } catch (error) {
      console.error("❌ ERROR en abrirRecuperacion:", error);
      Alert.alert("Error", "No se pudo abrir el modal de recuperación");
    }
  };

  // Cerrar modales de recuperación
  const cerrarRecuperacion = () => {
    setRecoveryModalVisible(false);
    setRecoveryStep("menu");
    setSecurityAnswer("");
    setRecoveryCode("");
  };

  // Iniciar recuperación por pregunta de seguridad
  const iniciarRecuperacionSeguridad = () => {
    setRecoveryStep("security");
  };

  // Cargar códigos de recuperación para mostrar
  const cargarCodigosRecuperacion = async () => {
    try {
      let codes = await AuthService.getRecoveryCodes();

      // Si no hay códigos, generar nuevos
      if (codes.length === 0) {
        codes = AuthService.generateRecoveryCodes();

        // Guardar los nuevos códigos
        const securityData = await AuthService.getSecurityData();
        if (securityData) {
          // Actualizar los códigos en el storage
          await AsyncStorage.setItem(
            "GESTOMAX_RECOVERY_CODES",
            JSON.stringify(codes),
          );
        }
      }

      setRecoveryCodes(codes);
    } catch (error) {
      console.error("Error cargando códigos de recuperación:", error);
      // Generar códigos locales como fallback
      const fallbackCodes = AuthService.generateRecoveryCodes();
      setRecoveryCodes(fallbackCodes);
    }
  };
  // Verificar respuesta de seguridad
  const verificarRespuestaSeguridad = async () => {
    if (!securityAnswer.trim()) {
      Alert.alert("Error", "Debes ingresar una respuesta");
      return;
    }

    try {
      const result = await AuthService.verifySecurityAnswer(securityAnswer);

      if (result.success) {
        Alert.alert("✅ Respuesta Correcta", result.message, [
          {
            text: "OK",
            onPress: () => setRecoveryStep("reset"),
          },
        ]);
      } else {
        Alert.alert("❌ Respuesta Incorrecta", result.message, [
          {
            text: "Intentar de nuevo",
            onPress: () => setSecurityAnswer(""),
          },
          {
            text: "Usar código de recuperación",
            onPress: () => setRecoveryStep("code"),
          },
        ]);
      }
    } catch (error) {
      console.error("Error verificando respuesta de seguridad:", error);
      Alert.alert("Error", "Ocurrió un error al verificar la respuesta");
    }
  };

  // Verificar código de recuperación y mostrar contraseña actual
  const verificarCodigoRecuperacion = async () => {
    console.log("🔐 DEBUG: verificarCodigoRecuperacion iniciado");
    console.log("🔐 DEBUG: recoveryCode =", recoveryCode);

    if (!recoveryCode.trim()) {
      Alert.alert("Error", "Debes ingresar un código de recuperación");
      return;
    }

    try {
      const result = await AuthService.verifyRecoveryCode(recoveryCode);
      console.log("🔐 DEBUG: result.verifyRecoveryCode =", result);

      if (result.success) {
        // Obtener la contraseña actual
        const currentPassword = await AuthService.getPassword();
        console.log("🔐 DEBUG: currentPassword =", currentPassword);

        Alert.alert(
          "✅ Código Válido",
          `Tu contraseña actual es: ${currentPassword}\n\nPuedes usar esta contraseña para acceder al sistema.`,
          [
            {
              text: "OK",
              onPress: () => {
                setRecoveryModalVisible(false);
                setRecoveryStep("menu");
                setRecoveryCode("");
              },
            },
          ],
        );
      } else {
        console.log(
          "🔐 DEBUG: Código inválido, result.message =",
          result.message,
        );
        Alert.alert("❌ Código Inválido", result.message, [
          {
            text: "Intentar de nuevo",
            onPress: () => setRecoveryCode(""),
          },
        ]);
      }
    } catch (error) {
      console.error("Error verificando código de recuperación:", error);
      Alert.alert("Error", "Ocurrió un error al verificar el código");
    }
  };

  // ===== FUNCIONES DE CONFIGURACIÓN INICIAL DE SEGURIDAD =====

  // Abrir modal de configuración inicial
  const abrirConfiguracionInicial = async () => {
    // Verificar si ya está configurada la seguridad
    const securitySetup = await AuthService.isSecuritySetup();

    if (securitySetup) {
      Alert.alert(
        "Seguridad ya configurada",
        "La seguridad ya está configurada. Puedes cambiarla desde el botón de configuración.",
        [{ text: "OK" }],
      );
      return;
    }

    setSetupModalVisible(true);
    setSelectedSecurityQuestion("");
    setCustomSecurityQuestion("");
    setSecurityAnswerSetup("");
    setRecoveryHint("");
    setShowCodesSetup(false);
  };

  // Configurar seguridad inicial
  const configurarSeguridadInicial = async () => {
    const question =
      selectedSecurityQuestion === "custom"
        ? customSecurityQuestion
        : selectedSecurityQuestion;

    if (!question.trim() || !securityAnswerSetup.trim()) {
      Alert.alert(
        "Error",
        "La pregunta y respuesta de seguridad son obligatorias",
      );
      return;
    }

    try {
      const result = await AuthService.setupSecurity(
        newPassword || "1234",
        question,
        securityAnswerSetup,
        recoveryHint,
      );

      if (result.success) {
        setRecoveryCodes(result.recoveryCodes || []);
        setShowCodesSetup(true);

        Alert.alert("✅ Seguridad Configurada", result.message, [
          { text: "OK" },
        ]);
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      console.error("Error configurando seguridad:", error);
      Alert.alert("Error", "Ocurrió un error al configurar la seguridad");
    }
  };

  // Función real de importación (se ejecuta después de autenticar)
  const ejecutarImportacion = async () => {
    try {
      setRestoreLoading(true);

      // Primero buscar backups disponibles en la carpeta GestoMax
      const backupsDisponibles = await BackupService.listarBackupsDisponibles();

      if (backupsDisponibles.length > 0) {
        // Mostrar lista de backups disponibles
        const opciones = backupsDisponibles
          .map(
            (backup, index) =>
              `${index + 1}. ${backup.fileName} (${backup.fecha.toLocaleDateString()})`,
          )
          .join("\n");

        Alert.alert(
          "Backups Disponibles",
          `📂 Se encontraron ${backupsDisponibles.length} backups en la carpeta GestoMax:\n\n${opciones}\n\n¿Cuál desea restaurar?`,
          [
            {
              text: "Cancelar",
              style: "cancel",
            },
            {
              text: "Seleccionar Manualmente",
              onPress: () => mostrarSelectorManual(),
            },
            {
              text: "Restaurar Último",
              style: "default",
              onPress: () => restaurarBackup(backupsDisponibles[0]),
            },
          ],
        );
      } else {
        // No hay backups, mostrar selector manual
        mostrarSelectorManual();
      }

      function mostrarSelectorManual() {
        Alert.alert(
          "Importar Base de Datos",
          "⚠️ ADVERTENCIA: Esta acción eliminará todos los datos actuales y los reemplazará con los del backup. ¿Desea continuar?",
          [
            {
              text: "Cancelar",
              style: "cancel",
            },
            {
              text: "Seleccionar Archivo",
              style: "destructive",
              onPress: async () => {
                try {
                  // Usar el selector de archivos
                  const seleccionResult =
                    await BackupService.seleccionarArchivoBackup();

                  if (!seleccionResult.success) {
                    Alert.alert(
                      "Error",
                      seleccionResult.error ||
                        "No se pudo seleccionar el archivo",
                    );
                    return;
                  }

                  // Mostrar información del backup seleccionado
                  const infoResult = await BackupService.obtenerInfoBackup(
                    seleccionResult.filePath!,
                  );

                  if (infoResult.valido && infoResult.info) {
                    const info = infoResult.info;
                    Alert.alert(
                      "Backup Encontrado",
                      `📈 Información del backup:\n\n` +
                        `• Archivo: ${seleccionResult.fileName}\n` +
                        `• Versión: ${info.version}\n` +
                        `• Fecha: ${new Date(info.fecha).toLocaleString()}\n` +
                        `• Tablas: ${info.totalTablas}\n` +
                        `• Registros: ${info.totalRegistros}\n\n` +
                        `¿Desea restaurar este backup?`,
                      [
                        {
                          text: "Cancelar",
                          style: "cancel",
                        },
                        {
                          text: "Restaurar",
                          style: "destructive",
                          onPress: () =>
                            restaurarBackup({
                              uri: seleccionResult.filePath!,
                              fileName:
                                seleccionResult.fileName || "backup.json",
                            }),
                        },
                      ],
                    );
                  } else {
                    Alert.alert(
                      "❌ Error",
                      infoResult.error || "El archivo no es un backup válido",
                    );
                  }
                } catch (error) {
                  console.error("Error en proceso de importación:", error);
                  Alert.alert(
                    "❌ Error",
                    "No se pudo procesar el archivo seleccionado",
                  );
                }
              },
            },
          ],
        );
      }

      async function restaurarBackup(backup: {
        uri: string;
        fileName: string;
      }) {
        try {
          const restoreResult = await BackupService.restaurarBaseDatos(
            backup.uri,
          );

          if (restoreResult.success) {
            Alert.alert(
              "✅ Éxito",
              restoreResult.message +
                "\n\nLa app se recargará automáticamente.",
              [
                {
                  text: "OK",
                  onPress: () => {
                    // Recargar la app para reflejar los cambios
                    fetchData();
                  },
                },
              ],
            );
          } else {
            Alert.alert("❌ Error", restoreResult.message);
          }
        } catch (error) {
          Alert.alert("❌ Error", "No se pudo restaurar la base de datos");
        }
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo iniciar el proceso de importación");
    } finally {
      setRestoreLoading(false);
    }
  };

  const formatMoneda = (monto: number) => {
    return new Intl.NumberFormat("es-CU", {
      style: "currency",
      currency: "CUP",
    }).format(monto);
  };

  const formatHora = (fecha: Date) => {
    return fecha.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando base de datos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header Premium */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>GM</Text>
            </View>
            <View>
              <Text style={styles.title}>GestoMax</Text>
              <View style={styles.statusContainer}>
                <View
                  style={[styles.statusDot, { backgroundColor: "#10b981" }]}
                />
                <Text style={styles.statusText}>100% Offline</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={abrirConfiguracion}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-closed" size={20} color="#6b7280" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setLicenseModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="person" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Banner de advertencia de licencia */}
      {licenseStatus &&
        licenseStatus.needsActivation &&
        licenseStatus.daysRemaining <= 7 && (
          <View style={styles.licenseWarningBanner}>
            <Text style={styles.licenseWarningText}>
              ⚠️ Quedan {licenseStatus.daysRemaining} días de prueba
            </Text>
          </View>
        )}

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={recargarDatos}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
      >
        {/* KPI Card Unificada */}
        <View style={styles.unifiedKpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiTitle}>Resumen del Día</Text>
            <View style={styles.kpiTimeContainer}>
              <Ionicons name="time-outline" size={16} color="#64748b" />
              <Text style={styles.kpiTime}>{formatHora(new Date())}</Text>
            </View>
          </View>

          <View style={styles.kpiContent}>
            <View style={styles.kpiRow}>
              <View style={styles.kpiSection}>
                <View style={styles.kpiItemInline}>
                  <View
                    style={[
                      styles.kpiIconContainer,
                      { backgroundColor: "#f59e0b15" },
                    ]}
                  >
                    <Ionicons name="cube-outline" size={18} color="#f59e0b" />
                  </View>
                  <View style={styles.kpiTextContainer}>
                    <Text style={styles.kpiLabel}>En Almacén</Text>
                    <Text style={styles.kpiValue}>
                      {formatMoneda(totalDineroAlmacen)}
                    </Text>
                  </View>
                </View>

                <View style={styles.kpiItemInline}>
                  <View
                    style={[
                      styles.kpiIconContainer,
                      { backgroundColor: "#3b82f615" },
                    ]}
                  >
                    <Ionicons
                      name="trending-up-outline"
                      size={18}
                      color="#3b82f6"
                    />
                  </View>
                  <View style={styles.kpiTextContainer}>
                    <Text style={styles.kpiLabel}>Ventas Hoy</Text>
                    <Text style={styles.kpiValue}>
                      {formatMoneda(ventasHoy)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.kpiDivider} />

            <View style={styles.kpiRow}>
              <View style={styles.kpiSection}>
                <View style={styles.kpiItemInline}>
                  <View
                    style={[
                      styles.kpiIconContainer,
                      { backgroundColor: "#ef444415" },
                    ]}
                  >
                    <Ionicons name="wallet-outline" size={18} color="#ef4444" />
                  </View>
                  <View style={styles.kpiTextContainer}>
                    <Text style={styles.kpiLabel}>Gastos Hoy</Text>
                    <Text style={styles.kpiValue}>
                      {formatMoneda(gastosHoy)}
                    </Text>
                  </View>
                </View>

                <View style={styles.kpiItemInline}>
                  <View
                    style={[
                      styles.kpiIconContainer,
                      {
                        backgroundColor:
                          ventasHoy - gastosHoy >= 0
                            ? "#10b98115"
                            : "#ef444415",
                      },
                    ]}
                  >
                    <Ionicons
                      name="analytics-outline"
                      size={18}
                      color={ventasHoy - gastosHoy >= 0 ? "#10b981" : "#ef4444"}
                    />
                  </View>
                  <View style={styles.kpiTextContainer}>
                    <Text style={styles.kpiLabel}>Balance</Text>
                    <Text
                      style={[
                        styles.kpiValue,
                        {
                          color:
                            ventasHoy - gastosHoy >= 0 ? "#10b981" : "#ef4444",
                        },
                      ]}
                    >
                      {formatMoneda(ventasHoy - gastosHoy)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Acciones Rápidas Compactas */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Módulos Principales</Text>
          <View style={styles.actionsBlock}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={navegarAAlmacenes}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#fef3c7" }]}>
                <Ionicons name="cube" size={24} color="#d97706" />
              </View>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionTitle}>Inventario</Text>
                <Text style={styles.actionSubtitle}>
                  Gestión de múltiples almacenes
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={navegarAPunto}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#e0e7ff" }]}>
                <Ionicons name="cart" size={24} color="#4f46e5" />
              </View>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionTitle}>Punto de Venta</Text>
                <Text style={styles.actionSubtitle}>
                  Ventas, ONAT y cierres de caja
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={navegarAPrestamos}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#d1fae5" }]}>
                <Ionicons name="cash" size={24} color="#059669" />
              </View>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionTitle}>Finanzas</Text>
                <Text style={styles.actionSubtitle}>
                  Préstamos, deudas y pagos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={navegarAAgenda}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#fce7f3" }]}>
                <Ionicons name="calendar-outline" size={24} color="#be185d" />
              </View>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionTitle}>Agenda</Text>
                <Text style={styles.actionSubtitle}>
                  Citas, recordatorios y eventos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Centro de Notificaciones Unificado */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Estado del Sistema</Text>
          <TouchableOpacity
            style={
              totalAlertas === 0 ? styles.allClearCard : styles.alertsContainer
            }
            activeOpacity={0.7}
            onPress={async () => {
              await cargarAlertasSistema();
              setModalAlertasVisible(true);
            }}
          >
            {totalAlertas === 0 ? (
              <>
                <Ionicons name="checkmark-circle" size={28} color="#10b981" />
                <View style={styles.allClearText}>
                  <Text style={styles.allClearTitle}>Todo en orden</Text>
                  <Text style={styles.allClearSubtitle}>
                    No hay productos por vencer, deudas pendientes ni eventos
                    próximos.
                  </Text>
                </View>
              </>
            ) : (
              <>
                {productosVencidos > 0 && (
                  <View
                    style={[styles.alertRow, { borderLeftColor: "#ef4444" }]}
                  >
                    <Ionicons name="warning" size={20} color="#ef4444" />
                    <Text style={styles.alertText}>
                      {productosVencidos} producto(s) vencido(s)
                    </Text>
                  </View>
                )}
                {productosPorVencer > 0 && (
                  <View
                    style={[styles.alertRow, { borderLeftColor: "#f59e0b" }]}
                  >
                    <Ionicons name="alert-circle" size={20} color="#f59e0b" />
                    <Text style={styles.alertText}>
                      {productosPorVencer} producto(s) por vencer pronto
                    </Text>
                  </View>
                )}
                {prestamosVencidos > 0 && (
                  <View
                    style={[styles.alertRow, { borderLeftColor: "#ef4444" }]}
                  >
                    <Ionicons name="cash" size={20} color="#ef4444" />
                    <Text style={styles.alertText}>
                      {prestamosVencidos} deuda(s) vencida(s)
                    </Text>
                  </View>
                )}
                {prestamosProximos > 0 && (
                  <View
                    style={[styles.alertRow, { borderLeftColor: "#f59e0b" }]}
                  >
                    <Ionicons name="time" size={20} color="#f59e0b" />
                    <Text style={styles.alertText}>
                      {prestamosProximos} deuda(s) por vencer
                    </Text>
                  </View>
                )}
                {eventosHoy > 0 && (
                  <View
                    style={[styles.alertRow, { borderLeftColor: "#3b82f6" }]}
                  >
                    <Ionicons name="calendar" size={20} color="#3b82f6" />
                    <Text style={styles.alertText}>
                      {eventosHoy} evento(s) para hoy
                    </Text>
                  </View>
                )}
                {eventosProximos > 0 && (
                  <View
                    style={[styles.alertRow, { borderLeftColor: "#8b5cf6" }]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#8b5cf6"
                    />
                    <Text style={styles.alertText}>
                      {eventosProximos} evento(s) próximos
                    </Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Backup/Restore Compacto */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Respaldo de Datos</Text>
          <View style={styles.backupCompactContainer}>
            <TouchableOpacity
              style={[
                styles.backupCompactButton,
                backupLoading && styles.backupCompactButtonDisabled,
              ]}
              onPress={exportarBaseDatos}
              disabled={backupLoading}
              activeOpacity={0.7}
            >
              <View style={styles.backupIconContainer}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={24}
                  color={backupLoading ? "#9ca3af" : "#3b82f6"}
                />
              </View>
              <Text
                style={[
                  styles.backupCompactButtonText,
                  backupLoading && styles.backupCompactButtonTextDisabled,
                ]}
              >
                {backupLoading ? "Exportando..." : "Exportar Datos"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.backupCompactButton,
                restoreLoading && styles.backupCompactButtonDisabled,
              ]}
              onPress={importarBaseDatos}
              disabled={restoreLoading}
              activeOpacity={0.7}
            >
              <View style={styles.backupIconContainer}>
                <Ionicons
                  name="cloud-download-outline"
                  size={24}
                  color={restoreLoading ? "#9ca3af" : "#10b981"}
                />
              </View>
              <Text
                style={[
                  styles.backupCompactButtonText,
                  restoreLoading && styles.backupCompactButtonTextDisabled,
                ]}
              >
                {restoreLoading ? "Importando..." : "Importar Datos"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Información del Sistema */}
        <View style={styles.systemInfo}>
          <View
            style={[
              styles.systemInfoContent,
              isTablet && styles.systemInfoContentTablet,
            ]}
          >
            <View style={styles.systemInfoTextContainer}>
              <Ionicons name="rocket-outline" size={20} color="#3b82f6" />
              <View style={styles.systemInfoTextWrapper}>
                <Text style={styles.systemInfoTitle}>Sistema 100% Offline</Text>
                <Text style={styles.systemInfoText}>
                  Esta App funciona completamente sin internet. Todos los datos
                  se almacenan localmente en tu dispositivo y están disponibles
                  incluso en modo avión.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View
            style={[
              styles.footerContent,
              isTablet && styles.footerContentTablet,
            ]}
          >
            <View style={styles.footerBrand}>
              <View style={styles.footerLogo}>
                <Text style={styles.footerLogoText}>GM</Text>
              </View>
              <View>
                <Text style={styles.footerTitle}>GestoMax </Text>
                <Text style={styles.footerSubtitle}>Gestión 100% Offline</Text>
              </View>
            </View>
            <View style={styles.footerStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {productosVencidos +
                    productosPorVencer +
                    prestamosVencidos +
                    prestamosProximos +
                    eventosHoy +
                    eventosProximos}
                </Text>
                <Text style={styles.statLabelFooter}>alertas activas</Text>
              </View>
              <Text style={styles.statDivider}>•</Text>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {formatMoneda(totalDineroAlmacen)}
                </Text>
                <Text style={styles.statLabelFooter}>en inventario</Text>
              </View>
              <Text style={styles.statDivider}>•</Text>
              <View style={styles.statItem}>
                <Text style={styles.statTime}>{formatHora(new Date())}</Text>
                <Text style={styles.statLabelFooter}>última actualización</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modal de autenticación para importar base de datos */}
      <Modal
        visible={authModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setAuthModalVisible(false);
          setPassword("");
        }}
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
                Esta acción requiere autenticación para acceder
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

              {/* Botón de recuperación */}
              <TouchableOpacity
                style={styles.recoveryButton}
                onPress={abrirRecuperacion}
              >
                <Text style={styles.recoveryButtonText}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.authModalFooter}>
              <TouchableOpacity
                style={[styles.authModalButton, styles.authCancelButton]}
                onPress={() => {
                  setAuthModalVisible(false);
                  setPassword("");
                }}
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

      {/* Modal de configuración de contraseña */}
      <Modal
        visible={configModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfigModalVisible(false)}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authModalOverlay}>
          <View style={styles.authModalContainer}>
            <View style={styles.authModalHeader}>
              <Text style={styles.authModalTitle}>
                {isConfigAuthenticated
                  ? "Cambiar Contraseña"
                  : "Configuración de Seguridad"}
              </Text>
            </View>

            <ScrollView
              style={styles.authModalScroll}
              contentContainerStyle={styles.authModalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {!isConfigAuthenticated ? (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      color: "#6b7280",
                      marginBottom: 20,
                      textAlign: "center",
                    }}
                  >
                    Ingrese la contraseña actual para acceder a la configuración
                  </Text>

                  <View style={styles.authFormGroup}>
                    <Text style={styles.authFormLabel}>Contraseña Actual</Text>
                    <TextInput
                      style={styles.authFormInput}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Ingrese la contraseña actual"
                      secureTextEntry
                      autoFocus
                      maxLength={20}
                    />
                  </View>

                  {/* Botón de recuperación en configuración de seguridad */}
                  <TouchableOpacity
                    style={styles.recoveryButton}
                    onPress={abrirRecuperacion}
                  >
                    <Text style={styles.recoveryButtonText}>
                      ¿Olvidaste tu contraseña?
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      color: "#6b7280",
                      marginBottom: 20,
                      textAlign: "center",
                    }}
                  >
                    Configure su nueva contraseña de acceso
                  </Text>

                  <View style={styles.authFormGroup}>
                    <Text style={styles.authFormLabel}>Nueva Contraseña</Text>
                    <TextInput
                      style={styles.authFormInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Ingrese la nueva contraseña"
                      secureTextEntry
                      autoFocus
                      maxLength={20}
                    />
                  </View>

                  <View style={styles.authFormGroup}>
                    <Text style={styles.authFormLabel}>
                      Confirmar Contraseña
                    </Text>
                    <TextInput
                      style={styles.authFormInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirme la nueva contraseña"
                      secureTextEntry
                      maxLength={20}
                    />
                  </View>

                  {/* SECCIÓN DE CÓDIGOS DE RECUPERACIÓN */}
                  {isConfigAuthenticated && (
                    <View style={styles.recoveryCodesContainer}>
                      <Text style={styles.recoveryCodesTitle}>
                        📋 Códigos de Recuperación
                      </Text>
                      <Text style={styles.recoveryCodesDescription}>
                        Guarda estos códigos en un lugar seguro. Puedes usarlos
                        para recuperar tu contraseña si la olvidas.
                      </Text>
                      {recoveryCodes.length > 0 ? (
                        <View style={styles.codesGrid}>
                          {recoveryCodes.map((code, index) => (
                            <View key={index} style={styles.codeItem}>
                              <Text style={styles.codeText}>{code}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.noCodesText}>
                          No hay códigos disponibles
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.authModalFooter}>
              <TouchableOpacity
                style={[styles.authModalButton, styles.authCancelButton]}
                onPress={() => {
                  setConfigModalVisible(false);
                  setIsConfigAuthenticated(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                <Text style={styles.authCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authModalButton, styles.authSaveButton]}
                onPress={
                  isConfigAuthenticated
                    ? guardarNuevaContraseña
                    : verificarConfigPassword
                }
              >
                <Text style={styles.authSaveButtonText}>
                  {isConfigAuthenticated ? "Guardar" : "Acceder"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de recuperación de contraseña */}
      <Modal
        visible={recoveryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cerrarRecuperacion}
      >
        <View style={styles.authModalOverlay}>
          <View style={styles.authModalContainer}>
            <View style={styles.authModalHeader}>
              <Text style={styles.authModalTitle}>Recuperar Contraseña</Text>
            </View>

            <View style={styles.authModalContent}>
              {/* DIRECTAMENTE CAMPO DE CÓDIGO DE VERIFICACIÓN */}
              <View>
                <Text style={styles.recoveryDescription}>
                  Ingresa tu Código de Verificación para ver tu contraseña
                  actual:
                </Text>

                <View style={styles.authFormGroup}>
                  <Text style={styles.authFormLabel}>
                    Código de Verificación
                  </Text>
                  <View style={styles.codeInputContainer}>
                    <Ionicons name="keypad" size={20} color="#10b981" />
                    <TextInput
                      style={styles.codeInput}
                      value={recoveryCode}
                      onChangeText={setRecoveryCode}
                      placeholder="Ingresa tu código aquí"
                      autoFocus
                      maxLength={8}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <Text style={styles.codeHint}>
                  Los códigos tienen 8 caracteres y se muestran en mayúsculas
                </Text>
              </View>
            </View>

            <View style={styles.authModalFooter}>
              <TouchableOpacity
                style={[styles.authModalButton, styles.authCancelButton]}
                onPress={cerrarRecuperacion}
              >
                <Text style={styles.authCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authModalButton, styles.authSaveButton]}
                onPress={verificarCodigoRecuperacion}
              >
                <Text style={styles.authSaveButtonText}>Verificar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={licenseModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLicenseModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.authModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.authModalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.authModalScrollContent}
            >
              <View style={styles.authModalHeader}>
                <Text style={styles.authModalTitle}>
                  {licenseStatus?.isActivated
                    ? "Licencia Activada"
                    : "Activar Licencia"}
                </Text>
                <TouchableOpacity
                  onPress={() => setLicenseModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.authModalBody}>
                {licenseStatus?.isActivated ? (
                  <View style={styles.licenseActivatedContainer}>
                    <View style={styles.licenseIconContainer}>
                      <Text style={styles.licenseIcon}>✅</Text>
                    </View>
                    <Text style={styles.licenseActivatedTitle}>
                      ¡Licencia Activada Permanentemente!
                    </Text>
                    <Text style={styles.licenseActivatedMessage}>
                      Gracias por usar GestoMax. Tu licencia está activada y no
                      tiene límite de tiempo.
                    </Text>

                    <View style={styles.deviceInfoContainer}>
                      <Text style={styles.deviceInfoLabel}>
                        Código de Usuario:
                      </Text>
                      <TextInput
                        style={styles.deviceInfoValue}
                        value={userCode}
                        editable={false}
                        selectTextOnFocus={true}
                        multiline={false}
                      />
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={copyUserCode}
                      >
                        <Text style={styles.copyButtonText}>
                          📋 Copiar Código
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.licenseActivationContainer}>
                    <View style={styles.licenseIconContainer}>
                      <Text style={styles.licenseIcon}>🔑</Text>
                    </View>
                    <Text style={styles.licenseTitle}>
                      {licenseStatus?.daysRemaining === 0
                        ? "Licencia Expirada"
                        : `Quedan ${licenseStatus?.daysRemaining || 0} días`}
                    </Text>
                    <Text style={styles.licenseMessage}>
                      {licenseStatus?.daysRemaining === 0
                        ? "Tu período de prueba ha expirado. Activa tu licencia para continuar usando GestoMax."
                        : "Activa tu licencia ahora para usar GestoMax sin interrupciones."}
                    </Text>

                    <View style={styles.deviceInfoContainer}>
                      <Text style={styles.deviceInfoLabel}>
                        Código de Usuario:
                      </Text>
                      <TextInput
                        style={styles.deviceInfoValue}
                        value={userCode}
                        editable={false}
                        selectTextOnFocus={true}
                        multiline={false}
                      />
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={copyUserCode}
                      >
                        <Text style={styles.copyButtonText}>
                          📋 Copiar Código
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.licenseInputContainer}>
                      <Text style={styles.inputLabel}>Clave de Licencia</Text>
                      <TextInput
                        style={styles.licenseInput}
                        value={licenseKey}
                        onChangeText={setLicenseKey}
                        placeholder="XX-XXX-XXX"
                        placeholderTextColor="#666"
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
            <View style={styles.authModalFooter}>
              {!licenseStatus?.isActivated && (
                <TouchableOpacity
                  style={[
                    styles.authModalButton,
                    styles.authSaveButton,
                    licenseLoading && styles.buttonDisabled,
                  ]}
                  onPress={activateLicense}
                  disabled={licenseLoading}
                >
                  <Text style={styles.authSaveButtonText}>
                    {licenseLoading ? "Activando..." : "Activar Licencia"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.authModalButton, styles.authCancelButton]}
                onPress={() => setLicenseModalVisible(false)}
              >
                <Text style={styles.authCancelButtonText}>
                  {licenseStatus?.isActivated ? "Cerrar" : "Cancelar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de productos por vencer */}
      <Modal
        visible={modalProductosVencerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalProductosVencerVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalProductosVencerVisible(false)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Productos por Vencer</Text>
            <View style={styles.modalSpacer} />
          </View>

          <View style={styles.modalContent}>
            {loadingProductosVencer ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Cargando productos...</Text>
              </View>
            ) : productosVencerData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text style={styles.emptyTitle}>
                  No hay productos por vencer
                </Text>
                <Text style={styles.emptySubtitle}>
                  Todos los productos están en buen estado
                </Text>
              </View>
            ) : (
              <FlatList
                data={productosVencerData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.productoCard}>
                    <View style={styles.productoHeader}>
                      <Text style={styles.productoNombre}>{item.nombre}</Text>
                      <View
                        style={[
                          styles.diasBadge,
                          item.dias_restantes <= 0
                            ? styles.diasVencido
                            : item.dias_restantes <= 7
                              ? styles.diasCritico
                              : item.dias_restantes <= 15
                                ? styles.diasAlerta
                                : styles.diasNormal,
                        ]}
                      >
                        <Text style={styles.diasText}>
                          {item.dias_restantes <= 0
                            ? "Vencido"
                            : `${Math.floor(item.dias_restantes)} días`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.productoDetails}>
                      <Text style={styles.productoCategoria}>
                        {item.categoria}{" "}
                        {item.subcategoria && `- ${item.subcategoria}`}
                      </Text>
                      <Text style={styles.productoFecha}>
                        Vence:{" "}
                        {new Date(item.fecha_caducidad).toLocaleDateString()}
                      </Text>

                      {/* Mostrar todas las ubicaciones donde tiene stock */}
                      <View style={styles.ubicacionesContainer}>
                        {item.cantidad_punto > 0 && (
                          <Text style={styles.productoUbicacion}>
                            📍 Punto: {item.nombre_punto} (Zona de Venta)
                          </Text>
                        )}
                        {item.cantidad_almacen_especifico > 0 && (
                          <Text style={styles.productoUbicacion}>
                            📍 Almacén Específico:{" "}
                            {item.nombre_almacen_especifico}
                          </Text>
                        )}
                        {item.cantidad_almacen_general > 0 && (
                          <Text style={styles.productoUbicacion}>
                            📍 Almacén General
                          </Text>
                        )}
                      </View>

                      {/* Mostrar cantidades */}
                      <View style={styles.stockContainer}>
                        {item.cantidad_punto > 0 && (
                          <Text style={styles.stockText}>
                            🏪 Punto: {item.cantidad_punto} und
                          </Text>
                        )}
                        {item.cantidad_almacen_especifico > 0 && (
                          <Text style={styles.stockText}>
                            📦 Almacén: {item.cantidad_almacen_especifico} und
                          </Text>
                        )}
                        {item.cantidad_almacen_general > 0 && (
                          <Text style={styles.stockText}>
                            📦 Almacén General: {item.cantidad_almacen_general}{" "}
                            und
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal de Alertas del Estado del Sistema */}
      <Modal
        visible={modalAlertasVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalAlertasVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalAlertasVisible(false)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Alertas del Sistema</Text>
          </View>

          {loadingAlertas ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Cargando alertas...</Text>
            </View>
          ) : (
            <FlatList
              data={alertasData}
              keyExtractor={(item, index) => `alerta-${index}`}
              renderItem={({ item }) => {
                // Determinar colores según el tipo de alerta
                const getAlertaColors = (tipo: string) => {
                  switch (tipo) {
                    case "producto_vencido":
                      return {
                        bg: "#fef2f2",
                        border: "#dc2626",
                        icon: "#dc2626",
                        iconBg: "#fee2e2",
                        header: "#991b1b",
                        text: "#7f1d1d",
                      };
                    case "producto_por_vencer":
                      return {
                        bg: "#fffbeb",
                        border: "#f59e0b",
                        icon: "#f59e0b",
                        iconBg: "#fef3c7",
                        header: "#92400e",
                        text: "#78350f",
                      };
                    case "prestamo_vencido":
                      return {
                        bg: "#fef2f2",
                        border: "#dc2626",
                        icon: "#dc2626",
                        iconBg: "#fee2e2",
                        header: "#991b1b",
                        text: "#7f1d1d",
                      };
                    case "prestamo_proximo":
                      return {
                        bg: "#fffbeb",
                        border: "#f59e0b",
                        icon: "#f59e0b",
                        iconBg: "#fef3c7",
                        header: "#92400e",
                        text: "#78350f",
                      };
                    case "evento_hoy":
                      return {
                        bg: "#eff6ff",
                        border: "#3b82f6",
                        icon: "#3b82f6",
                        iconBg: "#dbeafe",
                        header: "#1e40af",
                        text: "#1e3a8a",
                      };
                    case "evento_proximo":
                      return {
                        bg: "#f3e8ff",
                        border: "#8b5cf6",
                        icon: "#8b5cf6",
                        iconBg: "#ede9fe",
                        header: "#6d28d9",
                        text: "#5b21b6",
                      };
                    default:
                      return {
                        bg: "#f9fafb",
                        border: "#6b7280",
                        icon: "#6b7280",
                        iconBg: "#e5e7eb",
                        header: "#374151",
                        text: "#4b5563",
                      };
                  }
                };

                const colors = getAlertaColors(item.tipo);

                // Determinar icono según el tipo
                const getIcon = (tipo: string) => {
                  switch (tipo) {
                    case "producto_vencido":
                      return "warning";
                    case "producto_por_vencer":
                      return "alert-circle";
                    case "prestamo_vencido":
                      return "cash";
                    case "prestamo_proximo":
                      return "time";
                    case "evento_hoy":
                      return "calendar";
                    case "evento_proximo":
                      return "calendar-outline";
                    default:
                      return "information-circle";
                  }
                };

                return (
                  <View
                    style={[
                      styles.alertaCard,
                      {
                        backgroundColor: colors.bg,
                        borderLeftColor: colors.border,
                      },
                    ]}
                  >
                    {/* Header de la card */}
                    <View style={styles.alertaCardHeader}>
                      <View
                        style={[
                          styles.alertaIconWrapper,
                          { backgroundColor: colors.iconBg },
                        ]}
                      >
                        <Ionicons
                          name={getIcon(item.tipo)}
                          size={22}
                          color={colors.icon}
                        />
                      </View>
                      <View style={styles.alertaHeaderContent}>
                        <Text
                          style={[
                            styles.alertaCardTitle,
                            { color: colors.header },
                          ]}
                        >
                          {item.titulo}
                        </Text>
                        <Text
                          style={[
                            styles.alertaCardSubtitle,
                            { color: colors.text },
                          ]}
                        >
                          {item.descripcion}
                        </Text>
                      </View>
                    </View>

                    {/* Divider */}
                    <View
                      style={[
                        styles.alertaDivider,
                        { backgroundColor: colors.border + "20" },
                      ]}
                    />

                    {/* Contenido de la card */}
                    <View style={styles.alertaCardContent}>
                      {/* Información principal */}
                      <View style={styles.alertaMainInfo}>
                        {item.monto && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="cash-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.header },
                              ]}
                            >
                              Monto:{" "}
                              <Text style={styles.alertaInfoValue}>
                                {formatMoneda(item.monto)}
                              </Text>
                            </Text>
                          </View>
                        )}

                        {item.fecha_inicio && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="calendar-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.header },
                              ]}
                            >
                              Inicio:{" "}
                              <Text style={styles.alertaInfoValue}>
                                {item.fecha_inicio}
                              </Text>
                            </Text>
                          </View>
                        )}

                        {item.fecha_vencimiento && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="calendar-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.header },
                              ]}
                            >
                              Vence:{" "}
                              <Text style={styles.alertaInfoValue}>
                                {item.fecha_vencimiento}
                              </Text>
                            </Text>
                          </View>
                        )}

                        {item.precio_coste && item.precio_venta && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="pricetag-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.header },
                              ]}
                            >
                              Costo:{" "}
                              <Text style={styles.alertaInfoValue}>
                                ${formatMoneda(item.precio_coste)}
                              </Text>
                            </Text>
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.text, marginLeft: 8 },
                              ]}
                            >
                              Venta:{" "}
                              <Text style={styles.alertaInfoValue}>
                                ${formatMoneda(item.precio_venta)}
                              </Text>
                            </Text>
                          </View>
                        )}

                        {item.fecha && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="calendar-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.header },
                              ]}
                            >
                              {item.fecha} {item.hora && `a las ${item.hora}`}
                            </Text>
                          </View>
                        )}

                        {item.dias_restantes !== undefined && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="time-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.text },
                              ]}
                            >
                              {item.dias_restantes <= 0
                                ? `Vencido hace ${Math.abs(item.dias_restantes)} días`
                                : `Vence en ${item.dias_restantes} días`}
                            </Text>
                          </View>
                        )}

                        {item.cantidad_disponible !== undefined && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="cube-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.header },
                              ]}
                            >
                              Cantidad:{" "}
                              <Text style={styles.alertaInfoValue}>
                                {item.cantidad_disponible} unidades
                              </Text>
                            </Text>
                          </View>
                        )}

                        {item.ubicacion_nombre && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="business-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.header },
                              ]}
                            >
                              Ubicación:{" "}
                              <Text style={styles.alertaInfoValue}>
                                {item.ubicacion_nombre}
                              </Text>
                            </Text>
                          </View>
                        )}

                        {item.zona_detalle && item.tipo_ubicacion && (
                          <View style={styles.alertaInfoRow}>
                            <Ionicons
                              name="layers-outline"
                              size={16}
                              color={colors.icon}
                            />
                            <Text
                              style={[
                                styles.alertaInfoText,
                                { color: colors.text },
                              ]}
                            >
                              {item.tipo_ubicacion} - {item.zona_detalle}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Información secundaria */}
                      {(item.punto || item.categoria || item.tipo_evento) && (
                        <View style={styles.alertaSecondaryInfo}>
                          {item.punto && (
                            <View style={styles.alertaTag}>
                              <Ionicons
                                name="business-outline"
                                size={12}
                                color={colors.text}
                              />
                              <Text
                                style={[
                                  styles.alertaTagText,
                                  { color: colors.text },
                                ]}
                              >
                                {item.punto}
                              </Text>
                            </View>
                          )}

                          {item.categoria && (
                            <View style={styles.alertaTag}>
                              <Ionicons
                                name="folder-outline"
                                size={12}
                                color={colors.text}
                              />
                              <Text
                                style={[
                                  styles.alertaTagText,
                                  { color: colors.text },
                                ]}
                              >
                                {item.categoria}
                              </Text>
                            </View>
                          )}

                          {item.tipo_evento && (
                            <View style={styles.alertaTag}>
                              <Ionicons
                                name="calendar-outline"
                                size={12}
                                color={colors.text}
                              />
                              <Text
                                style={[
                                  styles.alertaTagText,
                                  { color: colors.text },
                                ]}
                              >
                                {item.tipo_evento}
                              </Text>
                            </View>
                          )}

                          {item.prioridad && (
                            <View style={styles.alertaTag}>
                              <Ionicons
                                name="flag-outline"
                                size={12}
                                color={colors.text}
                              />
                              <Text
                                style={[
                                  styles.alertaTagText,
                                  { color: colors.text },
                                ]}
                              >
                                {item.prioridad}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={styles.alertasListContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyAlertasContainer}>
                  <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                  <Text style={styles.emptyAlertsTitle}>
                    No hay alertas activas
                  </Text>
                  <Text style={styles.emptyAlertsSubtitle}>
                    Todo está funcionando correctamente
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    width: "90%",
    maxWidth: 400,
    flexGrow: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  authModalContent: {
    marginBottom: 20,
  },
  authModalBody: {
    flexGrow: 1,
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
  authModalScroll: {
    maxHeight: 300, // Altura máxima para el contenido scrollable
    marginBottom: 20,
  },
  authModalScrollContent: {
    paddingBottom: 10,
  },
  authModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
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
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
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
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 3,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 16,
    fontWeight: "800",
    color: "white",
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    fontSize: 18,
    color: "#6b7280",
  },
  // KPI Card Unificada
  unifiedKpiCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  kpiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  kpiTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  kpiTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kpiTime: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  kpiContent: {
    flex: 1,
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  kpiSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    flex: 1,
    gap: 16,
  },
  kpiItemInline: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  kpiTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  kpiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
    lineHeight: 20,
  },
  kpiDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
  },
  // Acciones Rápidas (Compactas)
  actionsBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#ffffff",
  },
  actionDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginLeft: 64,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextContent: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  // Centro de Notificaciones Unificado
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },
  allClearCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  allClearText: {
    flex: 1,
    marginLeft: 16,
  },
  allClearTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  allClearSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  alertsContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderLeftWidth: 4,
    backgroundColor: "#ffffff",
  },
  alertText: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 12,
    flex: 1,
  },
  // Backup Compacto
  backupCompactContainer: {
    flexDirection: "row",
    gap: 12,
  },
  backupCompactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 56,
    position: "relative",
  },
  backupIconContainer: {
    position: "absolute",
    left: 16,
    top: "50%",
    transform: [{ translateY: 4 }],
  },
  backupCompactButtonDisabled: {
    opacity: 0.6,
    borderColor: "#e5e7eb",
  },
  backupCompactButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#374151",
    textAlign: "right",
    lineHeight: 24,
    flex: 1,
    marginLeft: 40,
  },
  backupCompactButtonTextDisabled: {
    color: "#9ca3af",
  },
  buttonCardPrestamos: {
    // Mantiene los mismos estilos que el botón principal
  },
  buttonCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  buttonIconCirclePunto: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonIconCirclePrestamos: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonIcon: {
    fontSize: 32,
    color: "white",
  },
  buttonCardBadgePunto: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  buttonCardBadgePuntoText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7c3aed",
    letterSpacing: 0.5,
  },
  buttonCardBadgePrestamos: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  buttonCardBadgePrestamosText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065f46",
    letterSpacing: 0.5,
  },
  buttonCardContent: {
    marginBottom: 24,
  },
  buttonCardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  buttonCardDescription: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 20,
    lineHeight: 22,
  },
  buttonCardFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featureBadgePunto: {
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  featureBadgePuntoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7c3aed",
  },
  featureBadgePrestamos: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  featureBadgePrestamosText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065f46",
  },
  buttonCardAlmacenes: {
    // Mantiene los mismos estilos que el botón principal
  },
  buttonIconCircleAlmacenes: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonCardBadgeAlmacenes: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  buttonCardBadgeAlmacenesText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d97706",
    letterSpacing: 0.5,
  },
  featureBadgeAlmacenes: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  featureBadgeAlmacenesText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#d97706",
  },
  buttonCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  buttonActionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  buttonArrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonArrow: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 16,
  },
  alertPanelHeaderTablet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alertPanelTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  alertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  alertIconContainerPrestamos: {
    backgroundColor: "#dbeafe",
  },
  alertIcon: {
    fontSize: 24,
  },
  alertPanelTitleText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  alertPanelSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  alertBadges: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  badgeDanger: {
    backgroundColor: "#fee2e2",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  badgeWarning: {
    backgroundColor: "#fef3c7",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  badgeIcon: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#dc2626",
  },
  badgeWarningText: {
    color: "#d97706",
  },
  alertPanelBody: {
    padding: 24,
  },
  alertList: {
    gap: 12,
  },
  alertListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  alertItemDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
  },
  alertItemWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fffbeb",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  alertItemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  alertItemIcon: {
    fontSize: 20,
  },
  alertItemText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyStateIconContainerPrestamos: {
    backgroundColor: "#dbeafe",
  },
  emptyStateIcon: {
    fontSize: 36,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    color: "#6b7280",
    fontSize: 15,
    textAlign: "center",
  },
  alertPanelFooter: {
    padding: 20,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    gap: 12,
  },
  alertPanelFooterTablet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footerStatusText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  footerUpdateText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  refreshButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButtonPrestamos: {
    borderColor: "#3b82f6",
  },
  refreshButtonIcon: {
    fontSize: 16,
    color: "#3b82f6",
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  // Información del Sistema
  systemInfo: {
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: "#dbeafe",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  systemInfoContent: {
    gap: 24,
  },
  systemInfoContentTablet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  systemInfoTextContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 20,
  },
  systemInfoIcon: {
    fontSize: 40,
  },
  systemInfoTextWrapper: {
    flex: 1,
  },
  systemInfoTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  systemInfoText: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 22,
  },
  // Footer
  footer: {
    backgroundColor: "#111827",
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 40,
  },
  footerContent: {
    gap: 24,
    alignItems: "center",
  },
  footerContentTablet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  footerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  footerLogoText: {
    fontSize: 14,
    fontWeight: "800",
    color: "white",
    letterSpacing: 1,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "white",
    marginBottom: 4,
  },
  footerSubtitle: {
    fontSize: 13,
    color: "#d1d5db",
  },
  footerStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "white",
  },
  statTime: {
    fontSize: 20,
    fontWeight: "800",
    color: "#60a5fa",
  },
  statLabelFooter: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  statDivider: {
    color: "#4b5563",
    fontSize: 20,
  },
  // Backup Styles
  backupButtonsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  backupButton: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  backupButtonExport: {
    backgroundColor: "#f0f9ff",
    borderColor: "#3b82f6",
  },
  backupButtonImport: {
    backgroundColor: "#fef2f2",
    borderColor: "#ef4444",
  },
  backupButtonDisabled: {
    opacity: 0.5,
  },
  backupButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backupButtonIcon: {
    fontSize: 32,
  },
  backupButtonTextContainer: {
    flex: 1,
  },
  backupButtonTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  backupButtonDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  backupButtonLoading: {
    fontSize: 20,
  },
  backupButtonArrow: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6b7280",
  },
  backupInfoContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    marginTop: 8,
  },
  backupInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  backupInfoList: {
    gap: 8,
  },
  backupInfoItem: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    paddingLeft: 8,
  },

  // Estilos para recuperación de contraseña
  recoveryButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  recoveryButtonText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  recoveryDescription: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  recoveryOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dangerOption: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  recoveryOptionContent: {
    flex: 1,
    marginLeft: 16,
  },
  recoveryOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  dangerText: {
    color: "#dc2626",
  },
  recoveryOptionDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  securityQuestionContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  securityQuestionText: {
    flex: 1,
    fontSize: 16,
    color: "#1e40af",
    fontWeight: "600",
    marginLeft: 12,
  },
  codeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#10b981",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    fontSize: 18,
    color: "#065f46",
    fontWeight: "600",
    marginLeft: 12,
    textAlign: "center",
    letterSpacing: 2,
  },
  codeHint: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    fontStyle: "italic",
  },
  passwordStrengthContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },
  strongText: {
    color: "#10b981",
  },
  weakText: {
    color: "#f59e0b",
  },

  // Estilos para códigos de recuperación en modal de configuración
  recoveryCodesContainer: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recoveryCodesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  recoveryCodesDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 20,
  },
  codesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  codeItem: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: "center",
  },
  codeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: 1,
  },
  noCodesText: {
    fontSize: 14,
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },

  // Estilos para configuración de seguridad
  securitySetupContainer: {
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#0ea5e9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  securitySetupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0c4a6e",
    marginBottom: 8,
  },
  securitySetupDescription: {
    fontSize: 14,
    color: "#0369a1",
    marginBottom: 16,
    lineHeight: 20,
  },
  pickerContainer: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  picker: {
    fontSize: 16,
    color: "#1f2937",
  },
  setupSecurityButton: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  setupSecurityButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // Estilos para licencia
  licenseWarningBanner: {
    backgroundColor: "#2d1b1b",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f59e0b",
  },
  licenseWarningText: {
    color: "#f59e0b",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  licenseActivatedContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  licenseActivationContainer: {
    paddingVertical: 10,
  },
  licenseIconContainer: {
    marginBottom: 15,
  },
  licenseIcon: {
    fontSize: 48,
  },
  licenseActivatedTitle: {
    color: "#10b981",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  licenseActivatedMessage: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  licenseTitle: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  licenseMessage: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  deviceInfoContainer: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  deviceInfoLabel: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 5,
  },
  deviceInfoValue: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    fontFamily: "monospace",
  },
  copyButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  copyButtonText: {
    color: "white",
    fontSize: 12,
  },
  licenseInputContainer: {
    marginBottom: 20,
  },
  licenseInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "monospace",
    color: "#1f2937",
  },
  buttonDisabled: {
    backgroundColor: "#9ca3af",
  },

  // Estilos para modal de productos por vencer
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    textAlign: "center",
  },
  modalSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  listContainer: {
    padding: 16,
  },
  productoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  productoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  productoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    marginRight: 12,
  },
  diasBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
  },
  diasVencido: {
    backgroundColor: "#dc2626",
  },
  diasCritico: {
    backgroundColor: "#f59e0b",
  },
  diasAlerta: {
    backgroundColor: "#f97316",
  },
  diasNormal: {
    backgroundColor: "#eab308",
  },
  diasText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  productoDetails: {
    gap: 8,
  },
  ubicacionesContainer: {
    gap: 4,
    marginVertical: 4,
  },
  productoCategoria: {
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
  },
  productoFecha: {
    fontSize: 12,
    color: "#6b7280",
  },
  productoUbicacion: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "500",
  },
  ubicacionSinStock: {
    color: "#dc2626",
  },
  stockContainer: {
    marginTop: 8,
    gap: 4,
  },
  stockText: {
    fontSize: 13,
    color: "#6b7280",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },

  // Estilos para modal de alertas del Estado del Sistema - Nuevo diseño
  alertaCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  alertaCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  alertaIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  alertaHeaderContent: {
    flex: 1,
  },
  alertaCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  alertaCardSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  alertaDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  alertaCardContent: {
    padding: 16,
    paddingTop: 12,
  },
  alertaMainInfo: {
    marginBottom: 12,
  },
  alertaInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  alertaInfoText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
    flex: 1,
  },
  alertaInfoValue: {
    fontWeight: "700",
  },
  alertaSecondaryInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  alertaTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  alertaTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
