// app/ingresos_gastos.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ExpoPrint from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import {
    eliminarIngresosAjustados,
    executeQuery,
    guardarGastoManual,
    guardarIngresosAjustados,
    obtenerGastosManuales,
    obtenerIngresosAjustados,
    tieneIngresosAjustados,
} from "../src/db/database";
import { AuthService } from "../src/db/services/auth_service";
import { getFechaLocal } from "../src/utils/dateUtils";

interface ResumenDia {
  fecha: string;
  ingresos: number;
  gastos: number;
  balance: number;
}

interface DiaMes {
  dia: number;
  monto: number;
}

interface DatosAnuales {
  [mes: number]: DiaMes[]; // mes 1-12 -> array de días 1-31
}

export default function IngresosGastosScreen() {
  const params = useLocalSearchParams();
  const puntoId = params.puntoId ? parseInt(params.puntoId as string) : null;
  const puntoNombre = (params.puntoNombre as string) || "Punto";

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState(
    "/ingresos_gastos",
    params,
  );

  // Estados de autenticación
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [resumenDia, setResumenDia] = useState<ResumenDia | null>(null);
  const [datosAnuales, setDatosAnuales] = useState<DatosAnuales>({});
  const [refreshing, setRefreshing] = useState(false);
  const [mostrarModalEditarGasto, setMostrarModalEditarGasto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<{
    mes: number;
    dia: number;
    monto: number;
  } | null>(null);
  const [nuevoGasto, setNuevoGasto] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [vistaActual, setVistaActual] = useState<"ingresos" | "gastos">(
    "ingresos",
  );
  const [mostrarModalConfig, setMostrarModalConfig] = useState(false);
  const [reductorIngresos, setReductorIngresos] = useState("0");
  const [mostrarModalFiltroMes, setMostrarModalFiltroMes] = useState(false);
  const [mesSeleccionado, setMesSeleccionado] = useState<number | null>(
    new Date().getMonth() + 1,
  ); // Mes actual (1-12) por defecto
  const [tieneIngresosAjustadosMes, setTieneIngresosAjustadosMes] =
    useState(false);
  const router = useRouter();

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

  // Recargar datos cuando cambia el multiplicador
  const guardarMultiplicador = () => {
    setMostrarModalConfig(false);
    cargarDatosConVista(vistaActual); // Recargar datos con el nuevo multiplicador
  };

  // Función para guardar los ingresos ajustados del mes actual
  const guardarIngresosAjustadosMes = async () => {
    try {
      if (!puntoId || !mesSeleccionado) {
        Alert.alert("Error", "No hay punto de venta o mes seleccionado");
        return;
      }

      const hoy = new Date();
      const añoActual = hoy.getFullYear();
      const reductor = parseFloat(reductorIngresos) || 0;

      if (reductor === 0 || reductor === 1) {
        Alert.alert(
          "Información",
          reductor === 0
            ? "El reductor es 0. La función está desactivada, se mostrarán todos los ingresos."
            : "El reductor es 1. No hay cambios que guardar.",
        );
        return;
      }

      console.log(
        `💾 Guardando ingresos ajustados para mes ${mesSeleccionado} con reductor ${reductor}`,
      );

      // Obtener ingresos originales del mes
      const ingresosOriginalesQuery = await executeQuery(
        `
        SELECT 
          strftime('%d', v.creado_en) as dia,
          COALESCE(SUM(v.total_venta), 0) as total_ingresos
        FROM Venta v
        WHERE v.punto_id = ? 
          AND strftime('%Y', v.creado_en) = ?
          AND strftime('%m', v.creado_en) = ?
        GROUP BY strftime('%d', v.creado_en)
      `,
        [
          puntoId,
          añoActual.toString(),
          mesSeleccionado.toString().padStart(2, "0"),
        ],
      );

      console.log(
        `📊 Se encontraron ${ingresosOriginalesQuery.length} días con ingresos para guardar`,
      );

      // Guardar cada día con el multiplicador aplicado
      let guardados = 0;
      for (const ingreso of ingresosOriginalesQuery) {
        const dia = parseInt(ingreso.dia);
        const montoOriginal = parseFloat(ingreso.total_ingresos) || 0;
        const montoAjustado = montoOriginal - montoOriginal * reductor;

        const exito = await guardarIngresosAjustados(
          puntoId,
          añoActual,
          mesSeleccionado!,
          dia,
          montoOriginal,
          montoAjustado,
          reductor,
          `Ajustado con reductor ${reductor}`,
        );

        if (exito) guardados++;
      }

      if (guardados > 0) {
        Alert.alert(
          "Éxito",
          `Se guardaron ${guardados} días de ingresos ajustados para el mes seleccionado.`,
        );
        setTieneIngresosAjustadosMes(true);
        cargarDatosConVista(vistaActual); // Recargar para reflejar cambios
      } else {
        Alert.alert(
          "Información",
          "No se encontraron ingresos para guardar en este mes.",
        );
      }
    } catch (error) {
      console.error("❌ Error guardando ingresos ajustados:", error);
      Alert.alert("Error", "No se pudieron guardar los ingresos ajustados");
    }
  };

  // Función para eliminar ingresos ajustados del mes actual
  const eliminarIngresosAjustadosMes = async () => {
    try {
      if (!puntoId || !mesSeleccionado) {
        Alert.alert("Error", "No hay punto de venta o mes seleccionado");
        return;
      }

      const hoy = new Date();
      const añoActual = hoy.getFullYear();

      Alert.alert(
        "Confirmar",
        "¿Estás seguro de que quieres eliminar los ingresos ajustados de este mes? Se volverán a mostrar los ingresos originales.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              const exito = await eliminarIngresosAjustados(
                puntoId,
                añoActual,
                mesSeleccionado!,
              );

              if (exito) {
                Alert.alert(
                  "Éxito",
                  "Ingresos ajustados eliminados. Mostrando datos originales.",
                );
                setTieneIngresosAjustadosMes(false);
                cargarDatosConVista(vistaActual); // Recargar para reflejar cambios
              } else {
                Alert.alert(
                  "Error",
                  "No se pudieron eliminar los ingresos ajustados",
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error("❌ Error eliminando ingresos ajustados:", error);
      Alert.alert("Error", "No se pudieron eliminar los ingresos ajustados");
    }
  };

  // Verificar si hay ingresos ajustados para el mes actual
  const verificarIngresosAjustadosMes = async () => {
    if (!puntoId || !mesSeleccionado) return;

    const hoy = new Date();
    const añoActual = hoy.getFullYear();

    const tieneAjustados = await tieneIngresosAjustados(
      puntoId,
      añoActual,
      mesSeleccionado!,
    );
    setTieneIngresosAjustadosMes(tieneAjustados);
  };

  // Función para obtener ingresos ajustados del mes actual
  const obtenerIngresosAjustadosDelMes = async () => {
    if (!puntoId || !mesSeleccionado) return [];

    try {
      const hoy = new Date();
      const añoActual = hoy.getFullYear();
      const ingresosAjustados = await obtenerIngresosAjustados(
        puntoId,
        añoActual,
      );

      // Filtrar solo los del mes seleccionado
      return ingresosAjustados.filter(
        (ingreso) => parseInt(ingreso.mes) === mesSeleccionado,
      );
    } catch (error) {
      console.error("Error obteniendo ingresos ajustados del mes:", error);
      return [];
    }
  };

  const cargarDatosConVista = async (vistaForzada: "ingresos" | "gastos") => {
    try {
      setLoading(true);
      console.log(
        "🔄 cargarDatosConVista iniciado con vista forzada:",
        vistaForzada,
      );

      // Cargar siempre el resumen del mes para las tarjetas superiores
      await cargarResumenMesConVista(vistaForzada);

      // Cargar datos anuales para la tabla principal
      await cargarDatosAnualesConVista(vistaForzada);
    } catch (error) {
      console.error("Error cargando datos con vista forzada:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const cargarDatosAnualesConVista = async (
    vistaForzada: "ingresos" | "gastos",
  ) => {
    try {
      console.log(
        "🔄 cargarDatosAnualesConVista iniciado, vistaForzada:",
        vistaForzada,
      );

      const hoy = new Date();
      const añoActual = hoy.getFullYear();

      if (vistaForzada === "ingresos") {
        console.log("💰 Cargando datos de ingresos (vista forzada)...");

        // Obtener ingresos ajustados del mes actual si existen
        const ingresosAjustadosDelMes = await obtenerIngresosAjustadosDelMes();
        console.log(
          `📊 Se encontraron ${ingresosAjustadosDelMes.length} ingresos ajustados para el mes ${mesSeleccionado}`,
        );

        // Generar estructura para todos los meses del año (solo para ingresos)
        const datosDelAño: DatosAnuales = {};
        for (let mes = 1; mes <= 12; mes++) {
          const diasDelMes: DiaMes[] = [];
          for (let dia = 1; dia <= 31; dia++) {
            diasDelMes.push({ dia, monto: 0 });
          }
          datosDelAño[mes] = diasDelMes;
        }

        // Consultar ingresos por día del año actual
        const ingresosQuery = await executeQuery(
          `
          SELECT 
            strftime('%m', v.creado_en) as mes,
            strftime('%d', v.creado_en) as dia,
            COALESCE(SUM(v.total_venta), 0) as total_ingresos
          FROM Venta v
          WHERE v.punto_id = ? 
            AND strftime('%Y', v.creado_en) = ?
          GROUP BY strftime('%m', v.creado_en), strftime('%d', v.creado_en)
        `,
          [puntoId, añoActual.toString()],
        );

        console.log(
          `📊 Se encontraron ${ingresosQuery.length} registros de ingresos (vista forzada)`,
        );

        // Llenar los datos de ingresos priorizando ajustes guardados
        ingresosQuery.forEach((ingreso) => {
          const mesNum = parseInt(ingreso.mes);
          const diaNum = parseInt(ingreso.dia);
          if (mesNum >= 1 && mesNum <= 12 && diaNum >= 1 && diaNum <= 31) {
            const montoOriginal = parseFloat(ingreso.total_ingresos) || 0;

            // PRIORIDAD: Verificar si hay un ingreso ajustado guardado para este día
            const ajustado = ingresosAjustadosDelMes.find(
              (item) =>
                parseInt(item.mes) === mesNum && parseInt(item.dia) === diaNum,
            );

            let montoFinal = 0;
            if (ajustado) {
              // Usar monto ajustado guardado (prioridad absoluta)
              montoFinal = parseFloat(ajustado.monto_ajustado) || 0;
              console.log(
                `✅ Usando ingreso ajustado para ${mesNum}-${diaNum}: $${montoFinal}`,
              );
            } else {
              // Sin ajustes: aplicar reductor si corresponde
              const reductor = parseFloat(reductorIngresos) || 0;

              // Lógica simplificada: aplicar reductor solo al mes seleccionado
              let aplicarReductor = false;

              if (mesSeleccionado === null) {
                // Si no hay mes seleccionado (todos los meses), aplicar reductor 1 (sin efecto)
                aplicarReductor = false;
              } else {
                // Si hay un mes seleccionado, aplicar reductor solo a ese mes
                aplicarReductor = mesNum === mesSeleccionado;
              }

              montoFinal = aplicarReductor
                ? reductor === 0
                  ? montoOriginal
                  : montoOriginal - montoOriginal * reductor
                : montoOriginal;
            }

            datosDelAño[mesNum][diaNum - 1].monto = montoFinal;
          }
        });

        console.log("✅ Datos de ingresos cargados (vista forzada)");
        setDatosAnuales(datosDelAño);
      } else if (vistaForzada === "gastos") {
        console.log("💸 Cargando datos de gastos (vista forzada)...");

        // Para gastos, delegar completamente a cargarGastosManuales()
        // NO crear estructura aquí para evitar duplicación
        await cargarGastosManuales();
        console.log("✅ Datos de gastos cargados (vista forzada)");
      }
    } catch (error) {
      console.error("Error cargando datos anuales con vista forzada:", error);
      Alert.alert("Error", "No se pudieron cargar los datos anuales");
    }
  };

  const cargarResumenMesConVista = async (
    vistaForzada: "ingresos" | "gastos",
  ) => {
    try {
      const hoy = new Date();
      const añoActual = hoy.getFullYear();
      const mesActual = hoy.getMonth() + 1;

      if (vistaForzada === "ingresos") {
        // Obtener ingresos ajustados del mes actual si existen
        const ingresosAjustadosDelMes = await obtenerIngresosAjustadosDelMes();
        console.log(
          `📊 Resumen: Se encontraron ${ingresosAjustadosDelMes.length} ingresos ajustados para el mes ${mesSeleccionado}`,
        );

        // Consultar ingresos originales de todos los meses del año (sin multiplicador)
        const ingresosQuery = await executeQuery(
          `
          SELECT 
            strftime('%m', v.creado_en) as mes,
            strftime('%d', v.creado_en) as dia,
            COALESCE(SUM(v.total_venta), 0) as total_ingresos
          FROM Venta v
          WHERE v.punto_id = ? 
            AND strftime('%Y', v.creado_en) = ?
          GROUP BY strftime('%m', v.creado_en), strftime('%d', v.creado_en)
        `,
          [puntoId, añoActual.toString()],
        );

        // Calcular ingresos totales priorizando ajustes guardados
        let ingresosTotales = 0;
        ingresosQuery.forEach((ingreso) => {
          const mesNum = parseInt(ingreso.mes);
          const diaNum = parseInt(ingreso.dia);
          const montoOriginal = parseFloat(ingreso.total_ingresos) || 0;

          // PRIORIDAD: Verificar si hay un ingreso ajustado guardado para este día
          const ajustado = ingresosAjustadosDelMes.find(
            (item) =>
              parseInt(item.mes) === mesNum && parseInt(item.dia) === diaNum,
          );

          let montoFinal = 0;
          if (ajustado) {
            // Usar monto ajustado guardado (prioridad absoluta)
            montoFinal = parseFloat(ajustado.monto_ajustado) || 0;
          } else {
            // Sin ajustes: aplicar reductor si corresponde
            const reductor = parseFloat(reductorIngresos) || 0;

            // Lógica mejorada: aplicar reductor según el contexto
            let aplicarReductor = false;

            if (mesSeleccionado === null) {
              // Si no hay mes seleccionado (todos los meses), aplicar reductor 1 (sin efecto)
              aplicarReductor = false;
            } else {
              // Si hay un mes seleccionado, aplicar reductor solo a ese mes
              aplicarReductor = mesNum === mesSeleccionado;
            }

            montoFinal = aplicarReductor
              ? reductor === 0
                ? montoOriginal
                : montoOriginal - montoOriginal * reductor
              : montoOriginal;
          }

          if (aplicarReductor || mesSeleccionado === null) {
            ingresosTotales += montoFinal;
          }
        });

        setResumenDia({
          fecha: getFechaLocal(),
          ingresos: ingresosTotales,
          gastos: 0,
          balance: ingresosTotales,
        });
      } else {
        // Para gastos, calcular el total manual de los datos editables
        // O mejor, cargar directamente desde BD para asegurar persistencia
        console.log(
          "💸 cargarResumenMesConVista - Calculando resumen de gastos desde BD...",
        );
        console.log(
          "📍 mesSeleccionado en cargarResumenMesConVista:",
          mesSeleccionado,
        );
        console.log("📍 mesActual en cargarResumenMesConVista:", mesActual);

        try {
          if (!puntoId) {
            console.error("❌ puntoId es null en cargarResumenMesConVista");
            return;
          }
          const gastosBD = await obtenerGastosManuales(puntoId, añoActual);
          console.log(
            `📊 cargarResumenMesConVista - Se encontraron ${gastosBD.length} gastos en BD`,
          );
          console.log(
            "📋 cargarResumenMesConVista - Gastos encontrados:",
            gastosBD,
          );

          let totalGastos = 0;
          let gastosConsiderados = 0;

          // Considerar el mes seleccionado en lugar del mes actual
          const mesObjetivo =
            mesSeleccionado !== null ? mesSeleccionado : mesActual;
          console.log(
            `🎯 cargarResumenMesConVista - Mes objetivo para cálculo: ${mesObjetivo}`,
          );

          gastosBD.forEach((gasto: any) => {
            const mes = parseInt(gasto.mes);
            const monto = parseFloat(gasto.monto) || 0;

            console.log(
              `💰 cargarResumenMesConVista - Procesando gasto: mes=${mes}, monto=${monto}`,
            );

            if (mes === mesObjetivo) {
              totalGastos += monto;
              gastosConsiderados++;
              console.log(
                `✅ cargarResumenMesConVista - Gasto agregado al total: mes=${mes}, monto=${monto}, totalParcial=${totalGastos}`,
              );
            } else {
              console.log(
                `⏭️ cargarResumenMesConVista - Gasto omitido (mes ${mes} != mesObjetivo ${mesObjetivo})`,
              );
            }
          });

          console.log(
            `📊 cargarResumenMesConVista - Total gastos mes ${mesObjetivo}: $${totalGastos} (de ${gastosConsiderados} gastos considerados)`,
          );

          setResumenDia({
            fecha: getFechaLocal(),
            ingresos: 0,
            gastos: totalGastos,
            balance: -totalGastos,
          });
        } catch (error) {
          console.error("Error obteniendo gastos para resumen:", error);
          // Fallback a cálculo local si falla BD
          let totalGastos = 0;
          if (datosAnuales[mesActual]) {
            totalGastos = datosAnuales[mesActual].reduce(
              (sum, dia) => sum + dia.monto,
              0,
            );
          }

          setResumenDia({
            fecha: getFechaLocal(),
            ingresos: 0,
            gastos: totalGastos,
            balance: -totalGastos,
          });
        }
      }
    } catch (error) {
      console.error("Error cargando resumen del mes con vista forzada:", error);
      Alert.alert("Error", "No se pudo cargar el resumen del mes");
    }
  };

  const cargarDatosAnuales = useCallback(async () => {
    try {
      console.log("🔄 cargarDatosAnuales iniciado, vistaActual:", vistaActual);

      const hoy = new Date();
      const añoActual = hoy.getFullYear();

      if (vistaActual === "ingresos") {
        console.log("💰 Cargando datos de ingresos...");

        // Obtener ingresos ajustados del mes actual si existen
        const ingresosAjustadosDelMes = await obtenerIngresosAjustadosDelMes();
        console.log(
          `📊 Anual: Se encontraron ${ingresosAjustadosDelMes.length} ingresos ajustados para el mes ${mesSeleccionado}`,
        );

        // Generar estructura para todos los meses del año (solo para ingresos)
        const datosDelAño: DatosAnuales = {};
        for (let mes = 1; mes <= 12; mes++) {
          const diasDelMes: DiaMes[] = [];
          for (let dia = 1; dia <= 31; dia++) {
            diasDelMes.push({ dia, monto: 0 });
          }
          datosDelAño[mes] = diasDelMes;
        }

        // Consultar ingresos por día del año actual
        const ingresosQuery = await executeQuery(
          `
          SELECT 
            strftime('%m', v.creado_en) as mes,
            strftime('%d', v.creado_en) as dia,
            COALESCE(SUM(v.total_venta), 0) as total_ingresos
          FROM Venta v
          WHERE v.punto_id = ? 
            AND strftime('%Y', v.creado_en) = ?
          GROUP BY strftime('%m', v.creado_en), strftime('%d', v.creado_en)
        `,
          [puntoId, añoActual.toString()],
        );

        console.log(
          `📊 Se encontraron ${ingresosQuery.length} registros de ingresos`,
        );

        // Llenar los datos de ingresos priorizando ajustes guardados
        ingresosQuery.forEach((ingreso) => {
          const mesNum = parseInt(ingreso.mes);
          const diaNum = parseInt(ingreso.dia);
          if (mesNum >= 1 && mesNum <= 12 && diaNum >= 1 && diaNum <= 31) {
            const montoOriginal = parseFloat(ingreso.total_ingresos) || 0;

            // PRIORIDAD: Verificar si hay un ingreso ajustado guardado para este día
            const ajustado = ingresosAjustadosDelMes.find(
              (item) =>
                parseInt(item.mes) === mesNum && parseInt(item.dia) === diaNum,
            );

            let montoFinal = 0;
            if (ajustado) {
              // Usar monto ajustado guardado (prioridad absoluta)
              montoFinal = parseFloat(ajustado.monto_ajustado) || 0;
            } else {
              // Sin ajustes: aplicar reductor si corresponde
              const reductor = parseFloat(reductorIngresos) || 0;

              // Lógica simplificada: aplicar reductor solo al mes seleccionado
              let aplicarReductor = false;

              if (mesSeleccionado === null) {
                // Si no hay mes seleccionado (todos los meses), aplicar reductor 1 (sin efecto)
                aplicarReductor = false;
              } else {
                // Si hay un mes seleccionado, aplicar reductor solo a ese mes
                aplicarReductor = mesNum === mesSeleccionado;
              }

              montoFinal = aplicarReductor
                ? reductor === 0
                  ? montoOriginal
                  : montoOriginal - montoOriginal * reductor
                : montoOriginal;
            }

            datosDelAño[mesNum][diaNum - 1].monto = montoFinal;
          }
        });

        console.log("✅ Datos de ingresos cargados");
        setDatosAnuales(datosDelAño);
      } else if (vistaActual === "gastos") {
        console.log("💸 Cargando datos de gastos...");

        // Para gastos, delegar completamente a cargarGastosManuales()
        // NO crear estructura aquí para evitar duplicación
        await cargarGastosManuales();
        console.log("✅ Datos de gastos cargados");
      }
    } catch (error) {
      console.error("Error cargando datos anuales:", error);
      Alert.alert("Error", "No se pudieron cargar los datos anuales");
    }
  }, [puntoId, vistaActual, reductorIngresos]);

  const cargarResumenMes = useCallback(async () => {
    try {
      const hoy = new Date();
      const añoActual = hoy.getFullYear();
      const mesActual = hoy.getMonth() + 1;

      if (vistaActual === "ingresos") {
        // Obtener ingresos ajustados del mes actual si existen
        const ingresosAjustadosDelMes = await obtenerIngresosAjustadosDelMes();
        console.log(
          `📊 Resumen Normal: Se encontraron ${ingresosAjustadosDelMes.length} ingresos ajustados para el mes ${mesSeleccionado}`,
        );

        // Consultar ingresos originales de todos los meses del año (sin multiplicador)
        const ingresosQuery = await executeQuery(
          `
          SELECT 
            strftime('%m', v.creado_en) as mes,
            strftime('%d', v.creado_en) as dia,
            COALESCE(SUM(v.total_venta), 0) as total_ingresos
          FROM Venta v
          WHERE v.punto_id = ? 
            AND strftime('%Y', v.creado_en) = ?
          GROUP BY strftime('%m', v.creado_en), strftime('%d', v.creado_en)
        `,
          [puntoId, añoActual.toString()],
        );

        // Calcular ingresos totales priorizando ajustes guardados
        let ingresosTotales = 0;
        ingresosQuery.forEach((ingreso) => {
          const mesNum = parseInt(ingreso.mes);
          const diaNum = parseInt(ingreso.dia);
          const montoOriginal = parseFloat(ingreso.total_ingresos) || 0;

          // PRIORIDAD: Verificar si hay un ingreso ajustado guardado para este día
          const ajustado = ingresosAjustadosDelMes.find(
            (item) =>
              parseInt(item.mes) === mesNum && parseInt(item.dia) === diaNum,
          );

          let montoFinal = 0;
          if (ajustado) {
            // Usar monto ajustado guardado (prioridad absoluta)
            montoFinal = parseFloat(ajustado.monto_ajustado) || 0;
          } else {
            // Sin ajustes: aplicar reductor si corresponde
            const reductor = parseFloat(reductorIngresos) || 0;

            // Lógica mejorada: aplicar reductor según el contexto
            let aplicarReductor = false;

            if (mesSeleccionado === null) {
              // Si no hay mes seleccionado (todos los meses), aplicar reductor 1 (sin efecto)
              aplicarReductor = false;
            } else {
              // Si hay un mes seleccionado, aplicar reductor solo a ese mes
              aplicarReductor = mesNum === mesSeleccionado;
            }

            montoFinal = aplicarReductor
              ? reductor === 0
                ? montoOriginal
                : montoOriginal - montoOriginal * reductor
              : montoOriginal;
          }

          if (aplicarReductor || mesSeleccionado === null) {
            ingresosTotales += montoFinal;
          }
        });

        setResumenDia({
          fecha: getFechaLocal(),
          ingresos: ingresosTotales,
          gastos: 0,
          balance: ingresosTotales,
        });
      } else {
        // Para gastos, cargar directamente desde BD para asegurar persistencia
        console.log("💸 cargarResumenMes - Calculando gastos desde BD...");

        try {
          if (!puntoId) {
            console.error("❌ puntoId es null en cargarResumenMes");
            return;
          }
          const gastosBD = await obtenerGastosManuales(puntoId, añoActual);
          let totalGastos = 0;

          gastosBD.forEach((gasto: any) => {
            const mes = parseInt(gasto.mes);
            // Considerar el mes seleccionado en lugar del mes actual
            const mesObjetivo =
              mesSeleccionado !== null ? mesSeleccionado : mesActual;
            if (mes === mesObjetivo) {
              totalGastos += parseFloat(gasto.monto) || 0;
            }
          });

          console.log(
            `📊 cargarResumenMes - Total gastos mes ${mesSeleccionado !== null ? mesSeleccionado : mesActual}: $${totalGastos}`,
          );

          setResumenDia({
            fecha: getFechaLocal(),
            ingresos: 0,
            gastos: totalGastos,
            balance: -totalGastos,
          });
        } catch (error) {
          console.error("Error en cargarResumenMes obteniendo gastos:", error);
          // Fallback a cálculo local
          let totalGastos = 0;
          if (datosAnuales[mesActual]) {
            totalGastos = datosAnuales[mesActual].reduce(
              (sum, dia) => sum + dia.monto,
              0,
            );
          }

          setResumenDia({
            fecha: getFechaLocal(),
            ingresos: 0,
            gastos: totalGastos,
            balance: -totalGastos,
          });
        }
      }
    } catch (error) {
      console.error("Error cargando resumen del mes:", error);
      Alert.alert("Error", "No se pudo cargar el resumen del mes");
    }
  }, [puntoId, vistaActual, reductorIngresos]); // Agregado reductorIngresos y columnasExcluidas para recalcular cuando cambian

  // Aplicar reductor a los ingresos (mostrar el resto)
  const aplicarReductor = (ingresos: number) => {
    const reductor = parseFloat(reductorIngresos) || 0;
    // Si el reductor es 0, está desactivado, mostrar todos los ingresos
    if (reductor === 0) {
      return ingresos;
    }
    return ingresos - ingresos * reductor;
  };

  // Funciones para editar gastos
  const editarGasto = (mes: number, dia: number, montoActual: number) => {
    setGastoEditando({ mes, dia, monto: montoActual });
    setNuevoGasto(montoActual.toString());
    setMostrarModalEditarGasto(true);
  };

  const guardarGastoEditado = async () => {
    if (!gastoEditando) return;

    const nuevoMonto = parseFloat(nuevoGasto) || 0;

    if (nuevoMonto < 0) {
      Alert.alert("Error", "El monto no puede ser negativo");
      return;
    }

    // Guardar en la base de datos con manejo de errores
    try {
      const hoy = new Date();
      const añoActual = hoy.getFullYear();

      if (!puntoId) {
        Alert.alert("Error", "No hay punto de venta seleccionado");
        return;
      }

      console.log(
        `💾 Guardando gasto: mes=${gastoEditando.mes}, dia=${gastoEditando.dia}, monto=${nuevoMonto}`,
      );

      const exito = await guardarGastoManual(
        puntoId,
        añoActual,
        gastoEditando.mes,
        gastoEditando.dia,
        nuevoMonto,
      );

      if (exito) {
        console.log(
          "✅ Gasto guardado exitosamente en BD, recargando datos...",
        );

        // Actualizar el estado local inmediatamente
        const nuevosDatosAnuales = { ...datosAnuales };
        if (
          nuevosDatosAnuales[gastoEditando.mes] &&
          nuevosDatosAnuales[gastoEditando.mes][gastoEditando.dia - 1]
        ) {
          nuevosDatosAnuales[gastoEditando.mes][gastoEditando.dia - 1].monto =
            nuevoMonto;
          setDatosAnuales(nuevosDatosAnuales);
          console.log("✅ Gasto actualizado en estado local");
        }

        // Forzar recarga completa desde BD para asegurar persistencia
        setTimeout(async () => {
          console.log("🔄 Recargando gastos desde BD después de guardar...");
          await cargarGastosManuales();
          await cargarResumenMes();
          console.log("✅ Recarga completada después de guardar gasto");
        }, 100);

        setMostrarModalEditarGasto(false);
        setGastoEditando(null);
        setNuevoGasto("");
        Alert.alert("Éxito", "Gasto actualizado correctamente");
      } else {
        Alert.alert("Error", "No se pudo guardar el gasto en la base de datos");
      }
    } catch (error) {
      console.error("❌ Error guardando gasto manual:", error);
      Alert.alert(
        "Error",
        "No se pudo guardar el gasto. Por favor, intenta nuevamente.",
      );
    }
  };

  const cancelarEdicionGasto = () => {
    setMostrarModalEditarGasto(false);
    setGastoEditando(null);
    setNuevoGasto("");
  };

  // Función para cargar gastos manuales desde la base de datos
  const cargarGastosManuales = async () => {
    try {
      console.log("🔄 Cargando gastos manuales desde la base de datos...");

      const hoy = new Date();
      const añoActual = hoy.getFullYear();

      if (!puntoId) {
        console.log("❌ No hay puntoId, retornando");
        return;
      }

      console.log(
        `📅 Buscando gastos para puntoId: ${puntoId}, año: ${añoActual}, mesSeleccionado: ${mesSeleccionado}`,
      );

      // IMPORTANTE: Limpiar completamente el estado ANTES de cargar gastos
      const datosGastos: DatosAnuales = {};
      for (let mes = 1; mes <= 12; mes++) {
        const diasDelMes: DiaMes[] = [];
        for (let dia = 1; dia <= 31; dia++) {
          diasDelMes.push({ dia, monto: 0 }); // Todos empiezan en 0
        }
        datosGastos[mes] = diasDelMes;
      }

      // Limpiar el estado inmediatamente para evitar contaminación
      setDatosAnuales(datosGastos);
      console.log("🧹 Estado limpiado, estructura vacía establecida");

      const gastos = await obtenerGastosManuales(puntoId, añoActual);
      console.log(
        `📊 Se encontraron ${gastos.length} gastos en la base de datos`,
      );
      console.log("📋 Gastos encontrados:", gastos);

      // Llenar con los datos de la base de datos
      gastos.forEach((gasto: any) => {
        const mes = parseInt(gasto.mes);
        const dia = parseInt(gasto.dia);
        const monto = parseFloat(gasto.monto) || 0;

        console.log(
          `💰 Procesando gasto: mes=${mes}, dia=${dia}, monto=${monto}`,
        );

        // Si hay un mes seleccionado, solo cargar gastos de ese mes
        // Si no hay mes seleccionado (null), cargar todos los meses
        const debeCargar =
          mesSeleccionado === null ? true : mes === mesSeleccionado;

        if (debeCargar && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
          datosGastos[mes][dia - 1].monto = monto;
          console.log(
            `✅ Gasto agregado: mes=${mes}, dia=${dia}, monto=${monto}`,
          );
        } else if (!debeCargar) {
          console.log(
            `⏭️ Gasto omitido (mes ${mes} no coincide con mesSeleccionado ${mesSeleccionado})`,
          );
        } else {
          console.log(`❌ Gasto inválido: mes=${mes}, dia=${dia}`);
        }
      });

      console.log("🎯 Datos finales de gastos:", datosGastos);
      // Actualizar el estado con los datos finales
      setDatosAnuales(datosGastos);
      console.log("✅ Datos de gastos cargados y establecidos");

      // Verificación adicional - verificar el estado después de un pequeño delay
      setTimeout(() => {
        console.log(
          "🔍 Verificación - Estado actual datosAnuales después de setDatosAnuales:",
          JSON.stringify(datosAnuales),
        );
      }, 100);
    } catch (error) {
      console.error("❌ Error cargando gastos manuales:", error);
      // En caso de error, establecer estructura vacía
      const datosVacios: DatosAnuales = {};
      for (let mes = 1; mes <= 12; mes++) {
        const diasDelMes: DiaMes[] = [];
        for (let dia = 1; dia <= 31; dia++) {
          diasDelMes.push({ dia, monto: 0 });
        }
        datosVacios[mes] = diasDelMes;
      }
      setDatosAnuales(datosVacios);
    }
  };

  // Función para guardar gasto manual en la base de datos
  const calcularTotalesConMultiplicador = () => {
    if (!resumenDia) return { ingresos: 0, gastos: 0, balance: 0 };
    const ingresosModificados = aplicarReductor(resumenDia.ingresos);
    return {
      ingresos: ingresosModificados,
      gastos: resumenDia.gastos,
      balance: ingresosModificados - resumenDia.gastos,
    };
  };

  // Función para cargar todos los gastos del año para el PDF (sin filtro de mes)
  const cargarTodosLosGastosParaPDF = async (): Promise<DatosAnuales> => {
    try {
      console.log("🔄 Cargando TODOS los gastos del año para PDF...");

      const hoy = new Date();
      const añoActual = hoy.getFullYear();

      if (!puntoId) {
        console.log("❌ No hay puntoId, retornando estructura vacía");
        const datosVacios: DatosAnuales = {};
        for (let mes = 1; mes <= 12; mes++) {
          const diasDelMes: DiaMes[] = [];
          for (let dia = 1; dia <= 31; dia++) {
            diasDelMes.push({ dia, monto: 0 });
          }
          datosVacios[mes] = diasDelMes;
        }
        return datosVacios;
      }

      // Crear estructura para todos los meses del año
      const todosLosGastos: DatosAnuales = {};
      for (let mes = 1; mes <= 12; mes++) {
        const diasDelMes: DiaMes[] = [];
        for (let dia = 1; dia <= 31; dia++) {
          diasDelMes.push({ dia, monto: 0 });
        }
        todosLosGastos[mes] = diasDelMes;
      }

      // Obtener TODOS los gastos del año sin filtrar por mes
      const gastos = await obtenerGastosManuales(puntoId, añoActual);
      console.log(
        `📊 Se encontraron ${gastos.length} gastos TOTALES en la base de datos para PDF`,
      );

      // Llenar con TODOS los datos de la base de datos (sin filtro de mes)
      gastos.forEach((gasto: any) => {
        const mes = parseInt(gasto.mes);
        const dia = parseInt(gasto.dia);
        const monto = parseFloat(gasto.monto) || 0;

        if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
          todosLosGastos[mes][dia - 1].monto = monto;
          console.log(
            `✅ Gasto agregado al PDF: mes=${mes}, dia=${dia}, monto=${monto}`,
          );
        }
      });

      console.log("✅ Todos los gastos cargados para PDF");
      return todosLosGastos;
    } catch (error) {
      console.error("❌ Error cargando todos los gastos para PDF:", error);
      // En caso de error, retornar estructura vacía
      const datosVacios: DatosAnuales = {};
      for (let mes = 1; mes <= 12; mes++) {
        const diasDelMes: DiaMes[] = [];
        for (let dia = 1; dia <= 31; dia++) {
          diasDelMes.push({ dia, monto: 0 });
        }
        datosVacios[mes] = diasDelMes;
      }
      return datosVacios;
    }
  };

  const exportarPDF = async () => {
    try {
      setGeneratingPDF(true);

      const periodo = vistaActual === "ingresos" ? "Ingresos" : "Gastos";

      // Obtener nombre del mes
      const nombreMes = new Date().toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      });
      // Capitalizar primera letra del mes
      const nombreMesCapitalizado =
        nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

      // Obtener ingresos ajustados si estamos en vista de ingresos
      let ingresosAjustados: any[] = [];
      if (vistaActual === "ingresos" && puntoId) {
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        ingresosAjustados = await obtenerIngresosAjustados(puntoId, añoActual);
        console.log(
          `📊 PDF: Se encontraron ${ingresosAjustados.length} ingresos ajustados para usar en exportación`,
        );
      }

      // Para gastos, cargar TODOS los datos del año (ignorando el filtro de mes)
      let datosParaPDF = datosAnuales;
      if (vistaActual === "gastos") {
        console.log("📊 PDF: Cargando TODOS los gastos del año (sin filtro)");
        datosParaPDF = await cargarTodosLosGastosParaPDF();
      }

      let tablaHTML = "";

      // Tabla para vista anual con estructura D | Mes | D | Mes...
      const nombresMeses = [
        "ENE",
        "FEB",
        "MAR",
        "ABR",
        "MAY",
        "JUN",
        "JUL",
        "AGO",
        "SEP",
        "OCT",
        "NOV",
        "DIC",
      ];

      // Generar encabezado con D y cada mes alternado (sin D inicial duplicada)
      const encabezadoHTML = nombresMeses
        .flatMap((mes, index) => [
          `<th style="width: 25px;">D</th>`,
          `<th style="width: auto;">${mes}</th>`,
        ])
        .join("");

      tablaHTML = `
        <table>
          <thead>
            <tr>
              ${encabezadoHTML}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: 31 }, (_, diaIndex) => {
              const dia = diaIndex + 1;
              return `
                <tr>
                  ${nombresMeses
                    .map((_, mesIndex) => {
                      const mesNum = mesIndex + 1;
                      let montoFinal = 0;

                      if (vistaActual === "ingresos") {
                        // Para ingresos: verificar si hay datos ajustados para este mes y día
                        const ajustado = ingresosAjustados.find(
                          (item) =>
                            parseInt(item.mes) === mesNum &&
                            parseInt(item.dia) === dia,
                        );

                        if (ajustado) {
                          // PRIORIDAD ABSOLUTA: Usar monto ajustado guardado siempre
                          montoFinal = parseFloat(ajustado.monto_ajustado) || 0;
                        } else {
                          // Sin ajustes: usar datos originales con multiplicador 1 (sin efecto)
                          const monto =
                            datosParaPDF[mesNum]?.[dia - 1]?.monto || 0;
                          montoFinal = monto; // Multiplicador 1 = sin cambios
                        }
                      } else {
                        // Para gastos: usar datos completos del año
                        montoFinal =
                          datosParaPDF[mesNum]?.[dia - 1]?.monto || 0;
                      }

                      return `<td style="width: 25px;">${dia}</td><td style="width: auto;" class="${vistaActual === "ingresos" ? "monto-ingreso" : "monto-gasto"}">
                        ${montoFinal === 0 ? "-" : `$${montoFinal.toFixed(2)}`}
                      </td>`;
                    })
                    .join("")}
                </tr>
              `;
            }).join("")}
          </tbody>
          
          <!-- Fila de Totales por Mes -->
          <tfoot>
            <tr style="background-color: #f3f4f6; font-weight: bold; border-top: 2px solid #1f2937;">
              ${nombresMeses
                .flatMap((mes, index) => {
                  const mesNum = index + 1;
                  let totalMes = 0;

                  if (vistaActual === "ingresos") {
                    // Calcular total de ingresos para este mes
                    for (let dia = 1; dia <= 31; dia++) {
                      const ajustado = ingresosAjustados.find(
                        (item) =>
                          parseInt(item.mes) === mesNum &&
                          parseInt(item.dia) === dia,
                      );

                      if (ajustado) {
                        totalMes += parseFloat(ajustado.monto_ajustado) || 0;
                      } else {
                        const monto =
                          datosParaPDF[mesNum]?.[dia - 1]?.monto || 0;
                        totalMes += monto; // Multiplicador 1 = sin cambios
                      }
                    }
                  } else {
                    // Calcular total de gastos para este mes (usando datos completos)
                    for (let dia = 1; dia <= 31; dia++) {
                      totalMes += datosParaPDF[mesNum]?.[dia - 1]?.monto || 0;
                    }
                  }

                  // Para el primer mes, incluir la celda "TOTAL"
                  if (index === 0) {
                    return [
                      `<td style="width: 25px; padding: 5px 2px; text-align: center; border: 1px solid #374151; background-color: #e5e7eb;">TOTAL</td>`,
                      `<td style="width: auto; padding: 5px 2px; text-align: center; border: 1px solid #374151; color: ${vistaActual === "ingresos" ? "#059669" : "#dc2626"};">
                        ${totalMes === 0 ? "-" : `$${totalMes.toFixed(2)}`}
                      </td>`,
                    ];
                  } else {
                    // Para los demás meses, solo incluir la celda del total
                    return [
                      `<td style="width: 25px; padding: 5px 2px; text-align: center; border: 1px solid #374151; background-color: #e5e7eb;"></td>`,
                      `<td style="width: auto; padding: 5px 2px; text-align: center; border: 1px solid #374151; color: ${vistaActual === "ingresos" ? "#059669" : "#dc2626"};">
                        ${totalMes === 0 ? "-" : `$${totalMes.toFixed(2)}`}
                      </td>`,
                    ];
                  }
                })
                .join("")}
            </tr>
          </tfoot>
        </table>
      `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${vistaActual === "ingresos" ? "Reporte de Ingresos" : "Reporte de Gastos"}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 8px; color: #333; font-size: 9px; }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #1f2937; padding-bottom: 8px; }
            .header h1 { color: #1f2937; margin: 0; font-size: 16px; }
            .header p { color: #6b7280; margin: 2px 0 0 0; font-size: 9px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 9px; table-layout: fixed; }
            th { background-color: #1f2937; color: white; padding: 5px 2px; text-align: center; font-weight: bold; border: 1px solid #374151; font-size: 8px; word-wrap: break-word; }
            td { padding: 3px 2px; border: 1px solid #e5e7eb; text-align: center; font-size: 7px; word-wrap: break-word; overflow: hidden; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .ingreso-row { background-color: #f0fdf4; }
            .gasto-row { background-color: #fef2f2; }
            .balance-row { background-color: #e0e7ff; }
            .tipo-ingreso { color: #059669; font-weight: bold; }
            .tipo-gasto { color: #dc2626; font-weight: bold; }
            .tipo-balance { color: #4f46e5; font-weight: bold; }
            .monto-ingreso { color: #059669; font-weight: bold; }
            .monto-gasto { color: #dc2626; font-weight: bold; }
            .balance-positivo { color: #059669; font-weight: bold; }
            .balance-negativo { color: #dc2626; font-weight: bold; }
            .footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 7px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${vistaActual === "ingresos" ? "REPORTE DE INGRESOS" : "REPORTE DE GASTOS"}</h1>
            <p>${puntoNombre} - ${nombreMesCapitalizado}</p>
            <p>Generado: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES")}</p>
          </div>
          
          ${tablaHTML}
          
          <div class="footer">
          </div>
        </body>
        </html>
      `;

      const { uri } = await ExpoPrint.printToFileAsync({ html: htmlContent });

      const fechaActual = new Date()
        .toLocaleDateString("es-ES")
        .replace(/\//g, "-");
      const nombreArchivo = `INGRESOS_GASTOS_${periodo.replace(" ", "_")}_${fechaActual}.pdf`;

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
                    [{ text: "OK" }],
                  );
                  return;
                }
                await Sharing.shareAsync(uri, {
                  mimeType: "application/pdf",
                  dialogTitle: nombreArchivo,
                });
              } catch (error) {
                console.error("Error compartiendo PDF:", error);
                Alert.alert(
                  "Error al Compartir",
                  "No se pudo compartir el archivo.",
                  [{ text: "OK" }],
                );
              }
            },
          },
          {
            text: "Cerrar",
            style: "cancel",
          },
        ],
      );
    } catch (error) {
      console.error("Error generando PDF:", error);
      Alert.alert("Error", "No se pudo generar el archivo PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // useEffect principal para cargar datos iniciales y cuando cambia la vista
  useEffect(() => {
    console.log("🔄 useEffect disparado, vistaActual:", vistaActual);
    console.log("📍 mesSeleccionado actual:", mesSeleccionado);

    // Limpieza agresiva al cambiar a gastos para evitar cualquier contaminación
    if (vistaActual === "gastos") {
      console.log("🧹 Limpiando agresivamente todos los datos para gastos");

      // Limpiar completamente el estado
      setDatosAnuales({});
      setResumenDia(null);

      // Forzar recarga de datos de gastos con un pequeño retraso para asegurar que vistaActual esté actualizado
      setTimeout(() => {
        console.log("🔄 Ejecutando cargarDatos con delay para gastos");
        console.log("📍 mesSeleccionado en setTimeout:", mesSeleccionado);
        cargarDatosConVista("gastos");
      }, 200);
    } else {
      // Para ingresos, limpiar datosAnuales para evitar contaminación de gastos
      setDatosAnuales({});
      setTimeout(() => {
        console.log("🔄 Ejecutando cargarDatos con delay para ingresos");
        cargarDatosConVista("ingresos");
      }, 100);
    }
  }, [vistaActual]);

  // useEffect para verificar ingresos ajustados y recargar datos cuando cambia el mes seleccionado
  useEffect(() => {
    if (vistaActual === "ingresos") {
      verificarIngresosAjustadosMes();
    }

    // Recargar los datos para actualizar las tarjetas de totales
    console.log("🔄 Cambio en mesSeleccionado detectado, recargando datos...");
    setTimeout(() => {
      cargarDatosConVista(vistaActual);
    }, 100);
  }, [mesSeleccionado, vistaActual]);

  const renderVistaAnual = () => {
    const nombresMeses = [
      "ENE",
      "FEB",
      "MAR",
      "ABR",
      "MAY",
      "JUN",
      "JUL",
      "AGO",
      "SEP",
      "OCT",
      "NOV",
      "DIC",
    ];

    // Filtrar meses si hay uno seleccionado
    const mesesAMostrar =
      mesSeleccionado !== null
        ? [mesSeleccionado - 1] // Array con solo el índice del mes seleccionado
        : Array.from({ length: 12 }, (_, i) => i); // Todos los meses

    return (
      <View>
        {/* Encabezado con D y meses filtrados */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, { flex: 0.3 }]}>D</Text>
          {mesesAMostrar.map((index) => (
            <Text key={index} style={[styles.headerText, { flex: 1 }]}>
              {nombresMeses[index]}
            </Text>
          ))}
        </View>

        {/* Lista de días 1-31 con montos por mes filtrado */}
        <FlatList
          data={Array.from({ length: 31 }, (_, i) => i + 1)}
          renderItem={({ item: dia, index }) =>
            renderDiaAnual(dia, index, mesesAMostrar)
          }
          keyExtractor={(item) => `dia-${item}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                console.log(
                  "🔄 RefreshControl disparado, vistaActual:",
                  vistaActual,
                );
                setRefreshing(true);
                cargarDatosConVista(vistaActual);
              }}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      </View>
    );
  };

  const renderDiaAnual = (
    dia: number,
    index: number,
    mesesAMostrar: number[] = Array.from({ length: 12 }, (_, i) => i),
  ) => {
    const nombresMeses = [
      "ENE",
      "FEB",
      "MAR",
      "ABR",
      "MAY",
      "JUN",
      "JUL",
      "AGO",
      "SEP",
      "OCT",
      "NOV",
      "DIC",
    ];

    return (
      <View style={[styles.filaDiaMes, index % 2 === 0 && styles.rowEven]}>
        <Text style={[styles.diaText, { flex: 0.3 }]}>{dia}</Text>
        {mesesAMostrar.map((mesIndex) => {
          const mesNum = mesIndex + 1;
          const monto = datosAnuales[mesNum]?.[dia - 1]?.monto || 0;
          const esGasto = vistaActual === "gastos";

          return (
            <TouchableOpacity
              key={mesIndex}
              style={[{ flex: 1 }, esGasto && styles.editableCell]}
              onPress={() => {
                if (esGasto) {
                  editarGasto(mesNum, dia, monto);
                }
                // Para ingresos, ya no se permite excluir columnas
              }}
              disabled={false}
            >
              <Text
                style={[
                  vistaActual === "ingresos"
                    ? styles.ingresosText
                    : styles.gastosText,
                  { flex: 1 },
                  esGasto && styles.editableText,
                ]}
              >
                {monto === 0
                  ? "-"
                  : `$${vistaActual === "ingresos" ? monto.toFixed(2) : monto.toFixed(2)}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const { ingresos, gastos } = calcularTotalesConMultiplicador();

  // Para la card de ingresos, usar directamente resumenDia.ingresos
  // que ya tiene el reductor aplicado por las funciones de carga
  const ingresosCard = resumenDia?.ingresos || 0;

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f2937" />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={[styles.iconButton, styles.backButton]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Ingresos y Gastos</Text>
            <Text style={styles.headerSubtitle}>
              {puntoNombre} -{" "}
              {vistaActual === "ingresos" ? "Ingresos" : "Gastos"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, styles.filterButton]}
              onPress={() => setMostrarModalFiltroMes(true)}
            >
              <Ionicons name="calendar-outline" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.configButton]}
              onPress={() => setMostrarModalConfig(true)}
            >
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.exportButton]}
              onPress={exportarPDF}
              disabled={generatingPDF || Object.keys(datosAnuales).length === 0}
            >
              {generatingPDF ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color="white"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vistaSelector}>
          <TouchableOpacity
            style={[
              styles.vistaButton,
              vistaActual === "ingresos" && styles.vistaButtonActive,
            ]}
            onPress={() => setVistaActual("ingresos")}
          >
            <Text
              style={[
                styles.vistaButtonText,
                vistaActual === "ingresos" && styles.vistaButtonTextActive,
              ]}
            >
              Ingresos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.vistaButton,
              vistaActual === "gastos" && styles.vistaButtonActive,
            ]}
            onPress={() => setVistaActual("gastos")}
          >
            <Text
              style={[
                styles.vistaButtonText,
                vistaActual === "gastos" && styles.vistaButtonTextActive,
              ]}
            >
              Gastos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.resumenContainer}>
        {vistaActual === "ingresos" ? (
          <View style={[styles.resumenCard, styles.ingresosCard, { flex: 1 }]}>
            <Text style={styles.resumenTitle}>Ingresos</Text>
            <Text style={[styles.resumenMonto, styles.ingresosColor]}>
              ${ingresosCard.toFixed(2)}
            </Text>
          </View>
        ) : (
          <View style={[styles.resumenCard, styles.gastosCard, { flex: 1 }]}>
            <Text style={styles.resumenTitle}>Gastos</Text>
            <Text style={[styles.resumenMonto, styles.gastosColor]}>
              ${gastos.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>{renderVistaAnual()}</View>

      {/* Modal de Configuración */}
      {mostrarModalConfig && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configuración</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setMostrarModalConfig(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.inputLabel}>Reductor de Ingresos</Text>
              <TextInput
                style={styles.input}
                value={reductorIngresos}
                onChangeText={setReductorIngresos}
                placeholder="1.0"
                keyboardType="numeric"
              />
              <Text style={styles.helperText}>
                Este número reducirá los ingresos mostrando el resto. Ejemplo:
                si ingresas 10 pesos y pones 0.2, mostrará 8 (el resto)
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={() => setMostrarModalConfig(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonSave]}
                onPress={guardarMultiplicador}
              >
                <Text style={styles.modalButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>

            {/* Botones para Ingresos Ajustados - solo visible en vista de ingresos */}
            {vistaActual === "ingresos" && mesSeleccionado && (
              <View style={styles.modalContent}>
                <View style={styles.ingresosAjustadosSection}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="wallet-outline" size={20} color="#3b82f6" />
                    <Text style={styles.sectionTitle}>Ingresos Ajustados</Text>
                  </View>

                  <Text style={styles.sectionDescription}>
                    Guarda permanentemente los ingresos del mes actual con el
                    multiplicador aplicado. Estos datos se usarán en futuras
                    exportaciones PDF.
                  </Text>

                  {tieneIngresosAjustadosMes ? (
                    <View style={styles.ajustadosCard}>
                      <View style={styles.ajustadosCardHeader}>
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#10b981"
                        />
                        <View style={styles.ajustadosCardInfo}>
                          <Text style={styles.ajustadosCardTitle}>
                            Ajustes Guardados
                          </Text>
                          <Text style={styles.ajustadosCardSubtitle}>
                            Los ingresos de este mes ya están ajustados
                          </Text>
                        </View>
                      </View>

                      <View style={styles.ajustadosCardBody}>
                        <Text style={styles.ajustadosCardDescription}>
                          El reductor actual está siendo aplicado
                          permanentemente a este mes. Puedes eliminar estos
                          ajustes para volver a los datos originales.
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            styles.buttonDanger,
                            styles.buttonFullWidth,
                          ]}
                          onPress={eliminarIngresosAjustadosMes}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color="white"
                          />
                          <Text
                            style={[
                              styles.modalButtonText,
                              styles.buttonTextWithIcon,
                            ]}
                          >
                            Eliminar Ajustes
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.sinAjustadosCard}>
                      <View style={styles.sinAjustadosCardHeader}>
                        <Ionicons
                          name="information-circle-outline"
                          size={24}
                          color="#6b7280"
                        />
                        <View style={styles.sinAjustadosCardInfo}>
                          <Text style={styles.sinAjustadosCardTitle}>
                            Sin Ajustes
                          </Text>
                          <Text style={styles.sinAjustadosCardSubtitle}>
                            Este mes aún no tiene ingresos ajustados
                          </Text>
                        </View>
                      </View>

                      <View style={styles.sinAjustadosCardBody}>
                        <Text style={styles.sinAjustadosCardDescription}>
                          Aplica el multiplicador actual y guarda los resultados
                          permanentemente para usarlos en reportes futuros.
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            styles.buttonPrimary,
                            styles.buttonFullWidth,
                          ]}
                          onPress={guardarIngresosAjustadosMes}
                        >
                          <Text style={styles.modalButtonText}>
                            Guardar Ingresos Ajustados
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Modal para Filtro por Mes */}
      {mostrarModalFiltroMes && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por Mes</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setMostrarModalFiltroMes(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={[
                  styles.mesOption,
                  mesSeleccionado === null && styles.mesOptionSelected,
                ]}
                onPress={() => {
                  setMesSeleccionado(null);
                  setMostrarModalFiltroMes(false);
                }}
              >
                <Text
                  style={[
                    styles.mesOptionText,
                    mesSeleccionado === null && styles.mesOptionTextSelected,
                  ]}
                >
                  Todos los meses
                </Text>
              </TouchableOpacity>
              {[
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
              ].map((mes, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.mesOption,
                    mesSeleccionado === index + 1 && styles.mesOptionSelected,
                  ]}
                  onPress={() => {
                    setMesSeleccionado(index + 1);
                    setMostrarModalFiltroMes(false);
                  }}
                >
                  <Text
                    style={[
                      styles.mesOptionText,
                      mesSeleccionado === index + 1 &&
                        styles.mesOptionTextSelected,
                    ]}
                  >
                    {mes}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Modal para Editar Gasto */}
      {mostrarModalEditarGasto &&
        gastoEditando &&
        (() => {
          const nombresMeses = [
            "ENE",
            "FEB",
            "MAR",
            "ABR",
            "MAY",
            "JUN",
            "JUL",
            "AGO",
            "SEP",
            "OCT",
            "NOV",
            "DIC",
          ];
          return (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Editar Gasto</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={cancelarEdicionGasto}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modalContent}>
                  <Text style={styles.inputLabel}>
                    Gasto - {nombresMeses[gastoEditando.mes - 1]} Día{" "}
                    {gastoEditando.dia}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={nuevoGasto}
                    onChangeText={setNuevoGasto}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                  <Text style={styles.helperText}>
                    Ingresa el monto del gasto para este día
                  </Text>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.buttonCancel]}
                    onPress={cancelarEdicionGasto}
                  >
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.buttonSave]}
                    onPress={guardarGastoEditado}
                  >
                    <Text style={styles.modalButtonText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: { marginTop: 12, fontSize: 16, color: "#6b7280" },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
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
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#1f2937" },
  headerSubtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: { backgroundColor: "transparent" },
  filterButton: {
    backgroundColor: "#3b82f6",
  },
  configButton: {
    backgroundColor: "#6b7280",
  },
  exportButton: {
    backgroundColor: "#059669",
  },
  vistaSelector: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 4,
  },
  vistaButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  vistaButtonActive: {
    backgroundColor: "#3b82f6",
  },
  vistaButtonText: { fontSize: 14, fontWeight: "500", color: "#6b7280" },
  vistaButtonTextActive: { color: "white" },
  resumenContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  resumenCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ingresosCard: { borderTopWidth: 3, borderTopColor: "#10b981" },
  gastosCard: { borderTopWidth: 3, borderTopColor: "#ef4444" },
  balanceCard: { borderTopWidth: 3, borderTopColor: "#6366f1" },
  resumenTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  resumenMonto: { fontSize: 20, fontWeight: "bold" },
  ingresosColor: { color: "#059669" },
  gastosColor: { color: "#dc2626" },
  balancePositivo: { color: "#4f46e5" },
  balanceNegativo: { color: "#dc2626" },
  content: { flex: 1, paddingHorizontal: 16 },
  contenidoDia: { paddingTop: 20 },
  filaResumen: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filaIngresos: { borderLeftWidth: 4, borderLeftColor: "#10b981" },
  filaGastos: { borderLeftWidth: 4, borderLeftColor: "#ef4444" },
  filaBalance: { borderLeftWidth: 4, borderLeftColor: "#6366f1" },
  conceptoText: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
  montoIngresoText: { fontSize: 18, fontWeight: "bold", color: "#059669" },
  montoGastoText: { fontSize: 18, fontWeight: "bold", color: "#dc2626" },
  montoBalanceText: { fontSize: 18, fontWeight: "bold" },
  listHeader: { marginBottom: 8 },
  listContainer: { paddingBottom: 20 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  headerText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  filaDiaMes: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "center",
  },
  ingresoRow: {
    backgroundColor: "#f0fdf4",
  },
  gastoRow: {
    backgroundColor: "#fef2f2",
  },
  balanceRow: {
    backgroundColor: "#e0e7ff",
  },
  rowEven: { backgroundColor: "#f9fafb" },
  diaText: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
    textAlign: "center",
  },
  ingresosText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#059669",
    textAlign: "center",
  },
  gastosText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#dc2626",
    textAlign: "center",
  },
  balanceText: { fontSize: 14, fontWeight: "bold", textAlign: "center" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  iconText: { fontSize: 20, color: "white" },
  emptyIcon: { fontSize: 60, color: "#9ca3af", marginBottom: 16 },
  // Estilos del modal
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    margin: 20,
    maxWidth: 400,
    width: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 16,
    color: "#6b7280",
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
  },
  buttonCancel: {
    backgroundColor: "#6b7280",
  },
  buttonSave: {
    backgroundColor: "#059669",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  editableCell: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 4,
    marginHorizontal: 1,
  },
  editableText: {
    color: "#dc2626",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  excludedCell: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
    borderRadius: 4,
  },
  excludedText: {
    color: "#d97706",
    fontWeight: "bold",
  },
  mesOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  mesOptionSelected: {
    backgroundColor: "#3b82f6",
  },
  mesOptionText: {
    fontSize: 16,
    color: "#374151",
  },
  mesOptionTextSelected: {
    color: "white",
    fontWeight: "bold",
  },
  // Estilos para sección de ingresos ajustados (antiguos - ya no se usan)
  modalSection: {
    marginTop: 16,
    paddingTop: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginBottom: 16,
  },
  sectionTitleOld: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 8,
  },
  sectionDescriptionOld: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  ajustadosInfo: {
    backgroundColor: "#fef3c7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  ajustadosWarning: {
    fontSize: 14,
    color: "#d97706",
    marginBottom: 12,
    textAlign: "center",
  },
  buttonPrimary: {
    backgroundColor: "#3b82f6",
  },
  buttonDanger: {
    backgroundColor: "#dc2626",
  },
  // Estilos mejorados para Ingresos Ajustados
  ingresosAjustadosSection: {
    marginTop: 16, // Reducido para pegarlo más a los botones
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    // alignItems: "center", // Eliminado para alinear a la izquierda como el resto
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
    // justifyContent: "center", // Eliminado para alinear a la izquierda
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    // textAlign: "center", // Eliminado para alinear a la izquierda
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 20,
    // textAlign: "center", // Eliminado para alinear a la izquierda
  },
  // Tarjeta para ajustes guardados
  ajustadosCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    overflow: "hidden",
    width: "100%", // Asegurar que ocupe todo el ancho disponible
  },
  ajustadosCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#dcfce7",
    gap: 12,
    justifyContent: "center", // Centrar header de tarjeta
  },
  ajustadosCardInfo: {
    flex: 1,
    alignItems: "center", // Centrar texto de info
  },
  ajustadosCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 2,
    textAlign: "center", // Centrar título de tarjeta
  },
  ajustadosCardSubtitle: {
    fontSize: 14,
    color: "#15803d",
    textAlign: "center", // Centrar subtítulo de tarjeta
  },
  ajustadosCardBody: {
    padding: 16,
    gap: 12,
    alignItems: "center", // Centrar contenido del body
  },
  ajustadosCardDescription: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    textAlign: "center", // Centrar descripción de tarjeta
  },
  // Tarjeta para sin ajustes
  sinAjustadosCard: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    width: "100%", // Asegurar que ocupe todo el ancho disponible
  },
  sinAjustadosCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f3f4f6",
    gap: 12,
    justifyContent: "center", // Centrar header de tarjeta
  },
  sinAjustadosCardInfo: {
    flex: 1,
    alignItems: "center", // Centrar texto de info
  },
  sinAjustadosCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 2,
    textAlign: "center", // Centrar título de tarjeta
  },
  sinAjustadosCardSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center", // Centrar subtítulo de tarjeta
  },
  sinAjustadosCardBody: {
    padding: 16,
    gap: 12,
    alignItems: "center", // Centrar contenido del body
  },
  sinAjustadosCardDescription: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    textAlign: "center", // Centrar descripción de tarjeta
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
  // Estilos de botones mejorados
  buttonFullWidth: {
    width: "100%",
  },
  buttonTextWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
