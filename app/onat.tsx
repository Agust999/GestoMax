// app/onat.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ExpoPrint from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import { AuthService } from "../src/db/services/auth_service";
import { OnatService } from "../src/db/services/onat_service";

interface OnatData {
  montoTotal: number;
  porcentaje: number;
  montoOnat: number;
  montoBase: number;
}

interface MesOption {
  label: string;
  value: string;
  fechaInicio: string;
  fechaFin: string;
}

interface TransferenciaItem {
  id: number;
  punto_id: number;
  punto_nombre: string;
  total_venta: number;
  total_transferencia: number;
  tipo_pago: string;
  metodo_transferencia: string;
  creado_en: string;
  cantidad_productos: number;
}

interface HistorialPaginado {
  datos: TransferenciaItem[];
  totalRegistros: number;
  paginaActual: number;
  totalPaginas: number;
}

interface ResumenTransferenciasMes {
  cuentaFiscal: number;
  tarjeta: number;
  total: number;
}

export default function OnatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/onat", params);

  // Parámetros opcionales
  const puntoId = params.puntoId
    ? parseInt(params.puntoId as string)
    : undefined;
  const puntoNombre = (params.puntoNombre as string) || "Todos los puntos";

  // Estados de autenticación
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados
  const [loading, setLoading] = useState(true);
  const [onatData, setOnatData] = useState<OnatData>({
    montoTotal: 0,
    porcentaje: 5.0,
    montoOnat: 0,
    montoBase: 0,
  });
  const [historial, setHistorial] = useState<TransferenciaItem[]>([]);
  const [historialPaginado, setHistorialPaginado] = useState<HistorialPaginado>(
    {
      datos: [],
      totalRegistros: 0,
      paginaActual: 1,
      totalPaginas: 0,
    },
  );
  const [paginaActual, setPaginaActual] = useState(1);
  const [mostrarModalConfiguracion, setMostrarModalConfiguracion] =
    useState(false);
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [mostrarSelectorMes, setMostrarSelectorMes] = useState(false);
  const [mostrarModalRejuego, setMostrarModalRejuego] = useState(false);
  const [rejuego, setRejuego] = useState("");
  const [calculoRejuego, setCalculoRejuego] = useState({
    montoVentasConRejuego: 0,
    nuevoMontoOnat: 0,
    reduccionTotal: 0,
  });
  const [resumenTransferenciasMes, setResumenTransferenciasMes] =
    useState<ResumenTransferenciasMes>({
      cuentaFiscal: 0,
      tarjeta: 0,
      total: 0,
    });
  const [generatingPDF, setGeneratingPDF] = useState(false);

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

  // Generar lista de meses disponibles del año actual
  const generarMesesDisponibles = (): MesOption[] => {
    const meses: MesOption[] = [];
    const fechaActual = new Date();
    const añoActual = fechaActual.getFullYear();
    const mesActual = fechaActual.getMonth();

    // Generar meses del año actual hasta el mes actual
    for (let i = 0; i <= mesActual; i++) {
      const fecha = new Date(añoActual, i, 1);
      const primerDia = new Date(añoActual, i, 1);
      const ultimoDia = new Date(añoActual, i + 1, 0);

      const nombreMes = fecha.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      });

      // Usar formato de fecha local (YYYY-MM-DD) en lugar de UTC
      const formatFechaLocal = (date: Date) => {
        const año = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, "0");
        const día = String(date.getDate()).padStart(2, "0");
        return `${año}-${mes}-${día}`;
      };

      meses.push({
        label: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
        value: `${añoActual}-${(i + 1).toString().padStart(2, "0")}`,
        fechaInicio: formatFechaLocal(primerDia),
        fechaFin: formatFechaLocal(ultimoDia),
      });

      console.log(
        `🗓️ Mes generado: ${nombreMes} (${añoActual}-${(i + 1).toString().padStart(2, "0")})`,
      );
      console.log(`   - Inicio: ${formatFechaLocal(primerDia)}`);
      console.log(`   - Fin: ${formatFechaLocal(ultimoDia)}`);
    }

    return meses.reverse(); // Mostrar meses más recientes primero
  };

  const mesesDisponibles = generarMesesDisponibles();

  // Cargar historial paginado
  const cargarHistorialPaginado = useCallback(
    async (pagina: number = 1, fechaInicio?: string, fechaFin?: string) => {
      try {
        const resultado = await OnatService.getHistorialVentas(
          puntoId,
          pagina,
          10,
          fechaInicio,
          fechaFin,
        );
        setHistorialPaginado(resultado);
        setHistorial(resultado.datos);
        setPaginaActual(pagina);
      } catch (error) {
        console.error("Error cargando historial paginado:", error);
      }
    },
    [puntoId],
  );

  // Cargar datos
  const cargarDatos = useCallback(
    async (fechaInicio?: string, fechaFin?: string) => {
      try {
        setLoading(true);

        const [data, resumenTransferencias] = await Promise.all([
          OnatService.calcularMontoOnat(puntoId, fechaInicio, fechaFin),
          OnatService.getResumenTransferencias(puntoId, fechaInicio, fechaFin),
        ]);
        setOnatData(data);
        setResumenTransferenciasMes(resumenTransferencias);
        setNuevoPorcentaje(data.porcentaje.toString());

        // Cargar historial paginado con las fechas seleccionadas
        await cargarHistorialPaginado(1, fechaInicio, fechaFin);
      } catch (error) {
        console.error("Error cargando datos ONAT:", error);
        Alert.alert("Error", "No se pudieron cargar los datos de ONAT");
      } finally {
        setLoading(false);
      }
    },
    [puntoId, cargarHistorialPaginado],
  );

  useEffect(() => {
    const inicializar = async () => {
      if (isAuthenticated) {
        await cargarDatos();
      }
    };
    inicializar();
  }, [isAuthenticated, puntoId, cargarDatos]);

  // Obtener fechas del mes seleccionado
  const getFechasMesSeleccionado = () => {
    if (!mesSeleccionado)
      return { fechaInicio: undefined, fechaFin: undefined };

    const mes = mesesDisponibles.find((m) => m.value === mesSeleccionado);
    return mes
      ? { fechaInicio: mes.fechaInicio, fechaFin: mes.fechaFin }
      : { fechaInicio: undefined, fechaFin: undefined };
  };

  // Seleccionar mes
  const seleccionarMes = (mes: MesOption) => {
    console.log(`📅 Mes seleccionado: ${mes.label}`);
    console.log(`   - Fecha inicio: ${mes.fechaInicio}`);
    console.log(`   - Fecha fin: ${mes.fechaFin}`);

    setMesSeleccionado(mes.value);
    setMostrarSelectorMes(false);
    cargarDatos(mes.fechaInicio, mes.fechaFin);
  };

  // Recargar datos
  const recargarDatos = async () => {
    const mes = mesesDisponibles.find((m) => m.value === mesSeleccionado);
    if (mes) {
      await cargarDatos(mes.fechaInicio, mes.fechaFin);
    } else {
      await cargarDatos();
    }
  };

  // Guardar nuevo porcentaje
  const guardarPorcentaje = async () => {
    try {
      const porcentaje = parseFloat(nuevoPorcentaje);

      if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        Alert.alert("Error", "El porcentaje debe ser un número entre 0 y 100");
        return;
      }

      const exito = await OnatService.updatePorcentajeOnat(porcentaje);

      if (exito) {
        Alert.alert("Éxito", "Porcentaje ONAT actualizado correctamente");
        setMostrarModalConfiguracion(false);

        // Mantener el filtro del mes seleccionado al recargar
        const mes = mesesDisponibles.find((m) => m.value === mesSeleccionado);
        if (mes) {
          await cargarDatos(mes.fechaInicio, mes.fechaFin);
        } else {
          await cargarDatos();
        }
      } else {
        Alert.alert("Error", "No se pudo actualizar el porcentaje");
      }
    } catch (error) {
      console.error("Error guardando porcentaje:", error);
      Alert.alert("Error", "No se pudo guardar el porcentaje");
    }
  };

  // Formatear moneda
  const formatMoneda = (monto: number) => {
    return new Intl.NumberFormat("es-CU", {
      style: "currency",
      currency: "CUP",
    }).format(monto);
  };

  // Formatear fecha
  const formatFecha = (fechaStr: string) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calcular monto con rejuego
  const calcularMontoConRejuego = (valorRejuego: number) => {
    // Paso 1 (Reducción): Calcula cuánto se va a reducir: montoAReducir = onatData.montoTotal * valorRejuego
    const montoAReducir = onatData.montoTotal * valorRejuego;

    // Paso 2 (Nueva Base): La venta simulada es la resta: ventasSimuladas = onatData.montoTotal - montoAReducir
    const ventasSimuladas = onatData.montoTotal - montoAReducir;

    // Paso 3 (Recálculo): Calcula el nuevoMontoOnat aplicando la fórmula sobre las ventasSimuladas
    // Fórmula: Impuesto = (Ventas - 3260) * 0.05 + (Ventas * (PorcentajeConfigurado / 100))
    // Nota: El término (Ventas - 3260) debe ser 0 si las ventas son menores a 3260
    const baseFija = Math.max(0, ventasSimuladas - 3260) * 0.05;
    const componenteVariable = ventasSimuladas * (onatData.porcentaje / 100);
    const nuevoMontoOnat = baseFija + componenteVariable;

    // Cálculo del Ahorro: La reduccionTotal (lo que se ahorra el usuario) debe ser: montoOnatOriginal - nuevoMontoOnat
    const reduccionTotal = onatData.montoOnat - nuevoMontoOnat;

    // Actualizar el estado con todos los valores necesarios para la UI
    setCalculoRejuego({
      montoVentasConRejuego: ventasSimuladas,
      nuevoMontoOnat: nuevoMontoOnat,
      reduccionTotal: reduccionTotal,
    });
  };

  // Manejar cambio en el rejuego
  const handleRejuegoChange = (texto: string) => {
    setRejuego(texto);

    // Validar que el texto sea un número válido y mayor o igual a 0 antes de ejecutar el cálculo
    const valor = parseFloat(texto);
    if (!isNaN(valor) && valor >= 0) {
      calcularMontoConRejuego(valor);
    } else {
      // Resetear valores si el input no es válido
      setCalculoRejuego({
        montoVentasConRejuego: 0,
        nuevoMontoOnat: 0,
        reduccionTotal: 0,
      });
    }
  };

  // Obtener color según método de transferencia
  const getMetodoColor = (metodo: string) => {
    switch (metodo) {
      case "ENZONA":
        return "#3b82f6";
      case "TRANSFERMOVIL":
        return "#10b981";
      case "Tarjeta":
        return "#8b5cf6";
      default:
        return "#6b7280";
    }
  };

  const exportarPDFTransferencias = async () => {
    try {
      setGeneratingPDF(true);
      const anioActual = new Date().getFullYear();
      const resumenMensual = await OnatService.getResumenTransferenciasPorMes(
        puntoId,
        anioActual,
      );
      const nombresMeses = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];

      const totalGeneral = resumenMensual.reduce(
        (acc, mes) => acc + mes.total,
        0,
      );

      const filasHtml = resumenMensual
        .map(
          (item) => `
            <tr>
              <td>${nombresMeses[item.mes - 1]}</td>
              <td class="monto">${item.cuentaFiscal.toFixed(2)}</td>
              <td class="monto">${item.tarjeta.toFixed(2)}</td>
              <td class="monto total-mes">${item.total.toFixed(2)}</td>
            </tr>
          `,
        )
        .join("");

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Reporte Transferencias ONAT</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 12px; color: #1f2937; }
            .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 18px; color: #1f2937; }
            .header p { margin: 4px 0 0 0; font-size: 12px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
            th { background-color: #1f2937; color: white; padding: 8px; border: 1px solid #374151; text-align: center; }
            td { border: 1px solid #e5e7eb; padding: 7px; }
            td.monto { text-align: right; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .total-mes { font-weight: bold; color: #1e40af; }
            .fila-total td { background-color: #e5e7eb; font-weight: bold; border-top: 2px solid #374151; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>REPORTE TRANSFERENCIAS ONAT</h1>
            <p>${puntoNombre} - ${anioActual}</p>
            <p>Generado: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES")}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>MES</th>
                <th>Cuenta Fiscal</th>
                <th>Tarjeta</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
              <tr class="fila-total">
                <td>Monto Total</td>
                <td class="monto"></td>
                <td class="monto"></td>
                <td class="monto">${totalGeneral.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      const { uri } = await ExpoPrint.printToFileAsync({ html: htmlContent });
      const nombreArchivo = `ONAT_TRANSFERENCIAS_${anioActual}.pdf`;

      Alert.alert(
        "PDF Generado Exitosamente",
        `El archivo "${nombreArchivo}" ha sido guardado. ¿Qué deseas hacer?`,
        [
          {
            text: "Compartir",
            onPress: async () => {
              try {
                const isSharingAvailable = await Sharing.isAvailableAsync();
                if (!isSharingAvailable) {
                  Alert.alert(
                    "No Disponible",
                    "No hay aplicaciones disponibles para compartir archivos.",
                  );
                  return;
                }
                await Sharing.shareAsync(uri, {
                  mimeType: "application/pdf",
                  dialogTitle: nombreArchivo,
                });
              } catch (error) {
                console.error("Error compartiendo PDF ONAT:", error);
                Alert.alert(
                  "Error al Compartir",
                  "No se pudo compartir el PDF.",
                );
              }
            },
          },
          { text: "Cerrar", style: "cancel" },
        ],
      );
    } catch (error) {
      console.error("Error generando PDF ONAT:", error);
      Alert.alert("Error", "No se pudo generar el PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando datos ONAT...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>ONAT</Text>
            <Text style={styles.headerSubtitle}>
              {puntoNombre} •{" "}
              {mesSeleccionado
                ? mesesDisponibles.find((m) => m.value === mesSeleccionado)
                    ?.label
                : "Todos los meses"}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.monthSelectorButton}
              onPress={() => setMostrarSelectorMes(true)}
            >
              <Ionicons name="calendar-outline" size={24} color="white" />
              <Text style={styles.monthSelectorText}>
                {mesSeleccionado
                  ? mesesDisponibles
                      .find((m) => m.value === mesSeleccionado)
                      ?.label?.substring(0, 3) || "Mes"
                  : "Mes"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pdfButton,
                generatingPDF && styles.pdfButtonDisabled,
              ]}
              onPress={exportarPDFTransferencias}
              disabled={generatingPDF}
            >
              <Ionicons name="document-text-outline" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => setMostrarModalRejuego(true)}
            >
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <View style={styles.refreshControl}>
            <TouchableOpacity
              onPress={recargarDatos}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshButtonText}>Actualizar datos</Text>
            </TouchableOpacity>
          </View>
        }
      >
        {/* Tarjeta principal de resumen */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIconContainer}>
              <Text style={styles.summaryIcon}>🏛️</Text>
            </View>
            <View style={styles.summaryTitleContainer}>
              <Text style={styles.summaryTitle}>Resumen ONAT</Text>
            </View>
          </View>

          <View style={styles.summaryContent}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>MONTO Total Ventas:</Text>
                <Text style={styles.summaryValue}>
                  {formatMoneda(onatData.montoTotal)}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>%ONAT Configurado</Text>
                <View style={styles.percentageContainer}>
                  <Text style={styles.percentageValue}>
                    {onatData.porcentaje.toFixed(2)}%
                  </Text>
                  <TouchableOpacity
                    style={styles.editPercentageButton}
                    onPress={() => setMostrarModalConfiguracion(true)}
                  >
                    <Text style={styles.editPercentageText}>✏️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>%ONAT sobre Ventas</Text>
                <Text style={styles.summaryValue}>
                  {formatMoneda(
                    (onatData.montoTotal * onatData.porcentaje) / 100,
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>
                  Base ONAT (Ventas-3260) * 5%
                </Text>
                <Text style={styles.summaryValue}>
                  {formatMoneda(onatData.montoBase)}
                </Text>
              </View>
            </View>

            <View style={[styles.summaryRow, styles.summaryRowHighlight]}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Monto a Pagar ONAT</Text>
                <Text style={styles.summaryValueHighlight}>
                  {formatMoneda(onatData.montoOnat)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tarjeta de información */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoTitle}>Información Importante</Text>
          </View>
          <Text style={styles.infoText}>
            El cálculo se basa en la fórmula: (Monto total Ventas - 3260) * 5% +
            (% ONAT configurado * Monto total Ventas). El porcentaje adicional
            es configurable y puede ser modificado presionando el botón de
            configuración.
          </Text>
        </View>

        {/* Historial de ventas */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Historial de Ventas</Text>
          </View>

          {historial.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📋</Text>
              <Text style={styles.emptyStateText}>
                No hay ventas registradas
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {historial.map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <View style={styles.historyItemInfo}>
                      <Text style={styles.historyItemTitle}>
                        {item.punto_nombre || "Punto no especificado"}
                      </Text>
                      <Text style={styles.historyItemDate}>
                        {formatFecha(item.creado_en)}
                      </Text>
                    </View>
                    <View style={styles.historyItemAmount}>
                      <Text style={styles.historyItemValue}>
                        {formatMoneda(item.total_venta)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.historyItemDetails}>
                    <View style={styles.historyDetailItem}>
                      <Text style={styles.historyDetailLabel}>Tipo:</Text>
                      <Text style={styles.historyDetailValue}>
                        {item.tipo_pago === "efectivo"
                          ? "Efectivo"
                          : item.tipo_pago === "transferencia"
                            ? "Transferencia"
                            : "Mixto"}
                      </Text>
                    </View>

                    {item.metodo_transferencia && (
                      <View style={styles.historyDetailItem}>
                        <Text style={styles.historyDetailLabel}>Método:</Text>
                        <Text
                          style={[
                            styles.historyDetailValue,
                            {
                              color: getMetodoColor(item.metodo_transferencia),
                            },
                          ]}
                        >
                          {item.metodo_transferencia}
                        </Text>
                      </View>
                    )}

                    <View style={styles.historyDetailItem}>
                      <Text style={styles.historyDetailLabel}>Productos:</Text>
                      <Text style={styles.historyDetailValue}>
                        {item.cantidad_productos}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Paginación */}
          {historialPaginado.totalPaginas > 1 && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[
                  styles.paginationArrow,
                  paginaActual === 1 && styles.paginationArrowDisabled,
                ]}
                onPress={() => {
                  const { fechaInicio, fechaFin } = getFechasMesSeleccionado();
                  paginaActual > 1 &&
                    cargarHistorialPaginado(
                      paginaActual - 1,
                      fechaInicio,
                      fechaFin,
                    );
                }}
                disabled={paginaActual === 1}
              >
                <Text
                  style={[
                    styles.paginationArrowText,
                    paginaActual === 1 && styles.paginationArrowTextDisabled,
                  ]}
                >
                  ←
                </Text>
              </TouchableOpacity>

              <View style={styles.paginationInfo}>
                <Text style={styles.paginationText}>
                  {paginaActual}/{historialPaginado.totalPaginas}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationArrow,
                  paginaActual === historialPaginado.totalPaginas &&
                    styles.paginationArrowDisabled,
                ]}
                onPress={() => {
                  const { fechaInicio, fechaFin } = getFechasMesSeleccionado();
                  paginaActual < historialPaginado.totalPaginas &&
                    cargarHistorialPaginado(
                      paginaActual + 1,
                      fechaInicio,
                      fechaFin,
                    );
                }}
                disabled={paginaActual === historialPaginado.totalPaginas}
              >
                <Text
                  style={[
                    styles.paginationArrowText,
                    paginaActual === historialPaginado.totalPaginas &&
                      styles.paginationArrowTextDisabled,
                  ]}
                >
                  →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.transferCard}>
          <View style={styles.transferHeader}>
            <Text style={styles.transferTitle}>Transferencias del periodo</Text>
            <Text style={styles.transferSubtitle}>
              {mesSeleccionado
                ? mesesDisponibles.find((m) => m.value === mesSeleccionado)
                    ?.label
                : "Todos los meses"}
            </Text>
          </View>
          <View style={styles.transferRow}>
            <Text style={styles.transferLabel}>Cuenta Fiscal</Text>
            <Text style={styles.transferValue}>
              {formatMoneda(resumenTransferenciasMes.cuentaFiscal)}
            </Text>
          </View>
          <View style={styles.transferRow}>
            <Text style={styles.transferLabel}>Tarjeta</Text>
            <Text style={styles.transferValue}>
              {formatMoneda(resumenTransferenciasMes.tarjeta)}
            </Text>
          </View>
          <View style={[styles.transferRow, styles.transferTotalRow]}>
            <Text style={styles.transferTotalLabel}>TOTAL</Text>
            <Text style={styles.transferTotalValue}>
              {formatMoneda(resumenTransferenciasMes.total)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal de selección de mes */}
      <Modal
        visible={mostrarSelectorMes}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMostrarSelectorMes(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Mes</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setMostrarSelectorMes(false)}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TouchableOpacity
                style={[
                  styles.monthOption,
                  !mesSeleccionado && styles.monthOptionSelected,
                ]}
                onPress={() => {
                  setMesSeleccionado("");
                  setMostrarSelectorMes(false);
                  cargarDatos();
                }}
              >
                <Text
                  style={[
                    styles.monthOptionText,
                    !mesSeleccionado && styles.monthOptionTextSelected,
                  ]}
                >
                  Todos los meses
                </Text>
              </TouchableOpacity>

              {mesesDisponibles.map((mes) => (
                <TouchableOpacity
                  key={mes.value}
                  style={[
                    styles.monthOption,
                    mesSeleccionado === mes.value && styles.monthOptionSelected,
                  ]}
                  onPress={() => seleccionarMes(mes)}
                >
                  <Text
                    style={[
                      styles.monthOptionText,
                      mesSeleccionado === mes.value &&
                        styles.monthOptionTextSelected,
                    ]}
                  >
                    {mes.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de configuración de porcentaje */}
      <Modal
        visible={mostrarModalConfiguracion}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMostrarModalConfiguracion(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configurar % ONAT</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setMostrarModalConfiguracion(false)}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>
                Porcentaje a aplicar sobre ventas totales:
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={nuevoPorcentaje}
                  onChangeText={setNuevoPorcentaje}
                  keyboardType="numeric"
                  placeholder="Ej: 5.0"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>

              <Text style={styles.modalHelp}>
                Ingresa un valor entre 0 y 100. Este porcentaje se sumará al
                cálculo base de (Monto total Ventas - 3260) * 5%.
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setMostrarModalConfiguracion(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={guardarPorcentaje}
              >
                <Text style={styles.modalButtonTextSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de cálculo con rejuego */}
      <Modal
        visible={mostrarModalRejuego}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMostrarModalRejuego(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cálculo con Rejuego</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setMostrarModalRejuego(false)}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.rejuegoSummaryContainer}>
                <Text style={styles.rejuegoLabel}>Monto ONAT:</Text>
                <Text style={styles.rejuegoValue}>
                  {formatMoneda(onatData.montoOnat)}
                </Text>
              </View>

              <Text style={styles.modalLabel}>Monto a Reducir de Ventas:</Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={rejuego}
                  onChangeText={handleRejuegoChange}
                  keyboardType="numeric"
                  placeholder="Ej: 1000"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.inputSuffix}></Text>
              </View>

              {calculoRejuego.montoVentasConRejuego > 0 && (
                <View style={styles.rejuegoResultContainer}>
                  <View style={styles.rejuegoResultHeader}>
                    <Text style={styles.rejuegoResultLabel}>
                      Monto ONAT Original:
                    </Text>
                    <Text style={styles.rejuegoResultValue}>
                      {formatMoneda(onatData.montoOnat)}
                    </Text>
                  </View>

                  <View style={styles.rejuegoSavingsContainer}>
                    <Text style={styles.rejuegoSavingsLabel}>
                      Nuevo Monto ONAT:
                    </Text>
                    <Text style={styles.rejuegoSavingsValue}>
                      {formatMoneda(calculoRejuego.nuevoMontoOnat)}
                    </Text>
                  </View>

                  <View style={styles.rejuegoResultHeader}>
                    <Text style={styles.rejuegoResultLabel}>
                      Reducción Lograda:
                    </Text>
                    <Text style={styles.rejuegoResultValue}>
                      {formatMoneda(calculoRejuego.reduccionTotal)}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.modalHelp}>
                Ingresa un número que representa el monto a reducir de las
                ventas totales. El sistema calculará las ventas simuladas
                restando este monto y aplicará la fórmula ONAT completa sobre el
                resultado.
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={() => setMostrarModalRejuego(false)}
              >
                <Text style={styles.modalButtonTextSave}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: "500",
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
  // Header
  header: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 20,
    color: "#000000", // Cambiado de gris a negro
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
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
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    fontSize: 18,
    color: "#6b7280",
  },
  configIcon: {
    fontSize: 18,
  },
  configButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6b7280",
    alignItems: "center",
    justifyContent: "center",
  },
  monthSelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  monthSelectorIcon: {
    fontSize: 16,
  },
  monthSelectorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  pdfButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfButtonDisabled: {
    opacity: 0.6,
  },
  pdfButtonIcon: {
    fontSize: 18,
    color: "white",
  },
  // Refresh control
  refreshControl: {
    padding: 20,
  },
  refreshButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    alignSelf: "center",
  },
  refreshButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  // Summary Card
  summaryCard: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  summaryIcon: {
    fontSize: 28,
  },
  summaryTitleContainer: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  summaryContent: {
    gap: 20,
  },
  summaryRow: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
  },
  summaryRowHighlight: {
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  summaryValueHighlight: {
    fontSize: 20,
    fontWeight: "800",
    color: "#3b82f6",
  },
  percentageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  percentageValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  editPercentageButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  editPercentageText: {
    fontSize: 14,
  },
  // Info Card
  infoCard: {
    backgroundColor: "#fef3c7",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
  },
  infoText: {
    fontSize: 13,
    color: "#78350f",
    lineHeight: 18,
  },
  // History Card
  historyCard: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  historyCount: {
    fontSize: 12,
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 12,
    color: "#6b7280",
  },
  historyItemAmount: {
    alignItems: "flex-end",
  },
  historyItemValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3b82f6",
  },
  historyItemDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  historyDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyDetailLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  historyDetailValue: {
    fontSize: 12,
    color: "#1f2937",
    fontWeight: "600",
  },
  transferCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  transferHeader: {
    marginBottom: 12,
  },
  transferTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  transferSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  transferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  transferLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  transferValue: {
    fontSize: 15,
    color: "#1f2937",
    fontWeight: "700",
  },
  transferTotalRow: {
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  transferTotalLabel: {
    fontSize: 14,
    color: "#1e40af",
    fontWeight: "800",
  },
  transferTotalValue: {
    fontSize: 16,
    color: "#1e40af",
    fontWeight: "800",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 28,
    width: "90%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseIcon: {
    fontSize: 16,
    color: "#6b7280",
  },
  modalBody: {
    padding: 24,
  },
  modalLabel: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
  },
  inputSuffix: {
    fontSize: 16,
    color: "#6b7280",
    marginLeft: 12,
    fontWeight: "600",
  },
  modalHelp: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#f3f4f6",
  },
  modalButtonSave: {
    backgroundColor: "#3b82f6",
  },
  modalButtonTextCancel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  modalButtonTextSave: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  // Month selector styles
  monthOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  monthOptionSelected: {
    backgroundColor: "#dbeafe",
    borderBottomColor: "#3b82f6",
  },
  monthOptionText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  monthOptionTextSelected: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  // Pagination styles
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "white",
  },
  paginationArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  paginationArrowDisabled: {
    backgroundColor: "#e5e7eb",
    opacity: 0.5,
  },
  paginationArrowText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  paginationArrowTextDisabled: {
    color: "#9ca3af",
  },
  paginationInfo: {
    flex: 1,
    alignItems: "center",
  },
  paginationText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  // Rejuego modal styles
  rejuegoSummaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  rejuegoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  rejuegoValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  rejuegoResultContainer: {
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  rejuegoResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rejuegoResultLabel: {
    fontSize: 14,
    color: "#1e40af",
    fontWeight: "600",
  },
  rejuegoResultValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e40af",
  },
  rejuegoSavingsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#93c5fd",
  },
  rejuegoSavingsLabel: {
    fontSize: 12,
    color: "#1e40af",
    fontWeight: "500",
  },
  rejuegoSavingsValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },
});
