// app/ganancia.tsx - Pantalla de Ganancias
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ExpoPrint from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
import { executeQuery, getSingleValue } from "../src/db/database";
import { PuntoHelper } from "../src/db/databaseHelper";
import { AuthService } from "../src/db/services/auth_service";
import { TopePrecioGananciaService } from "../src/db/services/tope_precio_ganancia_service";
import { getFechaLocal } from "../src/utils/dateUtils";

// Tipos
interface ProductoVendido {
  nombre: string;
  cantidad_vendida: number;
  total_vendido: number;
  categoria: string;
}

interface PersonaGananciaCompartida {
  id?: number;
  punto_id: number;
  nombre: string;
  tipo_comparticion: "porcentaje" | "cantidad_fija";
  valor: number;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

interface GananciaCompartidaCalculo {
  persona: PersonaGananciaCompartida;
  monto_a_recibir: number;
}

interface ComparacionPeriodo {
  periodo1: {
    inicio: string;
    fin: string;
    ganancias: number;
    ventas?: number;
  };
  periodo2: {
    inicio: string;
    fin: string;
    ganancias: number;
    ventas?: number;
  };
  diferencia: number;
  porcentaje: number;
  tipoComparacion: "ganancias" | "ventas";
}

interface GastoPorCategoria {
  categoria: string;
  total: number;
  cantidad: number;
  detalles?: GastoDetalle[];
}

interface GastoDetalle {
  nombre: string;
  monto: number;
  es_porcentaje: boolean;
  porcentaje?: number;
  descripcion?: string;
}

export default function GananciaScreen() {
  console.log("🎯 GananciaScreen componente montado");
  const router = useRouter();
  const params = useLocalSearchParams();

  // Obtener parámetros
  const puntoId = params.puntoId ? parseInt(params.puntoId as string) : null;

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/ganancia", params);
  const puntoNombre = (params.puntoNombre as string) || "Punto";

  console.log("📍 Parámetros recibidos:", { puntoId, puntoNombre });

  // Estados
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Datos de ganancias
  const [gananciaActual, setGananciaActual] = useState(0);
  const [gananciaBruta, setGananciaBruta] = useState(0); // Ganancia antes de gastos
  const [totalGastos, setTotalGastos] = useState(0); // Total de gastos del período
  const [productosMasVendidos, setProductosMasVendidos] = useState<
    ProductoVendido[]
  >([]);
  const [productosMenosVendidos, setProductosMenosVendidos] = useState<
    ProductoVendido[]
  >([]);
  const [productosTodosVendidos, setProductosTodosVendidos] = useState<
    ProductoVendido[]
  >([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalProductos, setTotalProductos] = useState(0);
  const [loadingTodosProductos, setLoadingTodosProductos] = useState(false);
  const [gananciaPeriodo, setGananciaPeriodo] = useState(0);
  const [comparacionPeriodos, setComparacionPeriodos] =
    useState<ComparacionPeriodo | null>(null);

  // Datos de gastos
  const [gastosPorCategoria, setGastosPorCategoria] = useState<
    GastoPorCategoria[]
  >([]);

  // Estados para filtros de período
  const [fechaInicio, setFechaInicio] = useState<Date | null>(null);
  const [fechaFin, setFechaFin] = useState<Date | null>(null);
  const [mostrarDatePickerInicio, setMostrarDatePickerInicio] = useState(false);
  const [mostrarDatePickerFin, setMostrarDatePickerFin] = useState(false);
  const [tipoPeriodo, setTipoPeriodo] = useState<
    "dia" | "semana" | "mes" | "personalizado" | null
  >("dia"); // Por defecto mostrar productos de hoy

  // Estados para fecha seleccionada del IPV
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(
    null,
  );

  // Estado para DateTimePicker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Estados para modo Ganancias/IPV
  const [modoVista, setModoVista] = useState<"ganancias" | "ipv">("ganancias");

  // 🔄 Estados separados e inmutables para cada tipo de datos
  const [datosIPVReales, setDatosIPVReales] = useState<any[]>([]);
  const [datosIPVReducidos, setDatosIPVReducidos] = useState<any[]>([]);
  const [usarDatosReducidos, setUsarDatosReducidos] = useState(false);

  // Estado combinado para UI (derivado, nunca mutado directamente)
  const datosIPVMostrados = usarDatosReducidos
    ? datosIPVReducidos
    : datosIPVReales;

  const [loadingIPV, setLoadingIPV] = useState(false);

  // Estado para verificar si hay reducción aplicada
  const [tieneReduccionAplicada, setTieneReduccionAplicada] = useState(false);

  // Estados para paginación de días del mes
  // Estado para controlar el día seleccionado (0 = no seleccionado)
  const [diaActual, setDiaActual] = useState(0);
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [añoActual, setAñoActual] = useState(new Date().getFullYear());
  const [diasDelMes, setDiasDelMes] = useState<number[]>([]);
  const [rejuego, setRejuego] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [progresoPDF, setProgresoPDF] = useState(0);
  const [mostrarModalProgreso, setMostrarModalProgreso] = useState(false);

  // Estados para modal de selección de período PDF
  const [mostrarModalPeriodoPDF, setMostrarModalPeriodoPDF] = useState(false);

  // Estados para modal de reductor
  const [mostrarModalReductor, setMostrarModalReductor] = useState(false);

  // Estados para gestión de topes de precios
  const [mostrarModalTopes, setMostrarModalTopes] = useState(false);
  const [topesPrecios, setTopesPrecios] = useState<{ [key: string]: number }>(
    {},
  );
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [precioTope, setPrecioTope] = useState("");

  // Nuevos estados para Reducción Visual con Efecto Dominó
  const [ajustesVisualesPorFecha, setAjustesVisualesPorFecha] = useState<
    Record<string, Record<number, number>>
  >({});

  // Función de Intercepción - El Motor para aplicar ajustes visuales con efecto dominó
  const aplicarAjustesVisualesALaVista = useCallback(
    (
      datosBase: any[],
      fechaVista: string,
      ajustes: Record<string, Record<number, number>>,
    ) => {
      console.log("🔧 Aplicando ajustes visuales para fecha:", fechaVista);
      try {
        const fechaVistaDate = new Date(fechaVista);
        const añoVista = fechaVistaDate.getFullYear();
        const mesVista = fechaVistaDate.getMonth() + 1;

        let reduccionesAcumuladas: Record<number, number> = {};

        for (const fechaAjuste in ajustes) {
          const fechaAjusteDate = new Date(fechaAjuste);
          if (
            fechaAjusteDate.getFullYear() === añoVista &&
            fechaAjusteDate.getMonth() + 1 === mesVista &&
            fechaAjusteDate <= fechaVistaDate
          ) {
            for (const productoId in ajustes[fechaAjuste]) {
              const unidades = ajustes[fechaAjuste][parseInt(productoId)];
              if (unidades > 0) {
                reduccionesAcumuladas[parseInt(productoId)] =
                  (reduccionesAcumuladas[parseInt(productoId)] || 0) + unidades;
              }
            }
          }
        }

        return datosBase.map((producto) => {
          const productoId = producto.id;
          const reduccionAcumulada = reduccionesAcumuladas[productoId] || 0;
          const reduccionHoy = ajustes[fechaVista]?.[productoId] || 0;

          // CÁLCULO CONTABLE CORREGIDO (Incluye Entradas)
          const inicioAjustado = (producto.inicio || 0) + reduccionAcumulada;
          const vendioAjustado = Math.max(
            0,
            (producto.vendio || 0) - reduccionHoy,
          );
          const quedoAjustado = Math.max(
            0,
            inicioAjustado + (producto.entro || 0) - vendioAjustado,
          );

          const precioFinal =
            topesPrecios[producto.producto] &&
            topesPrecios[producto.producto] < producto.precio
              ? topesPrecios[producto.producto]
              : producto.precio;

          return {
            ...producto,
            inicio: inicioAjustado,
            vendio: vendioAjustado,
            quedo: quedoAjustado,
            // Preservar monto_vendido original o recalcular con precio con tope si aplica
            monto_vendido:
              precioFinal !== producto.precio
                ? vendioAjustado * precioFinal
                : producto.monto_vendido,
            inicio_original: producto.inicio || 0,
            vendio_original: producto.vendio || 0,
            quedo_original: producto.quedo || 0,
            tiene_ajuste: reduccionHoy > 0 || reduccionAcumulada > 0,
            unidades_reducidas_hoy: reduccionHoy,
            unidades_reducidas_acumuladas: reduccionAcumulada,
          };
        });
      } catch (error) {
        console.error("❌ Error aplicando ajustes:", error);
        return datosBase;
      }
    },
    [topesPrecios],
  );
  // Función para cargar topes desde la base de datos
  const cargarTopesPrecios = useCallback(async () => {
    try {
      if (!puntoId) return;

      // Asegurar que la tabla exista
      await TopePrecioGananciaService.crearTabla();

      // Cargar topes desde la base de datos
      const topes =
        await TopePrecioGananciaService.obtenerTopesPorPunto(puntoId);
      setTopesPrecios(topes);
    } catch (error) {
      console.error("❌ Error cargando topes desde la base de datos:", error);
    }
  }, [puntoId]);

  // Función para obtener datos del IPV del mes
  const obtenerDatosIPVMes = useCallback(async () => {
    if (!puntoId) return [];

    try {
      setLoadingIPV(true);
      console.log(" Obteniendo datos del IPV para el mes actual");

      // Obtener primer y último día del mes actual
      const primerDia = new Date(añoActual, mesActual, 1);
      const ultimoDia = new Date(añoActual, mesActual + 1, 0);

      const fechaInicio = primerDia.toISOString().split("T")[0];
      const fechaFin = ultimoDia.toISOString().split("T")[0];

      console.log(" Rango del mes:", { fechaInicio, fechaFin });

      // Query para obtener todos los productos vendidos en el mes con sus totales
      const query = `
        SELECT 
          p.id AS id, 
          p.nombre AS producto, 
          COALESCE(AVG(az.precio_venta), 0) AS precio,
          COALESCE(SUM(dv.cantidad), 0) AS vendio,
          COALESCE(SUM(dv.cantidad * dv.precio_unitario), 0) AS monto_vendido,
          0 AS inicio,
          0 AS entro,
          0 AS quedo
        FROM Producto p
        INNER JOIN AlmacenZona az ON az.producto_id = p.id
        INNER JOIN DetalleVenta dv ON dv.producto_id = p.id
        INNER JOIN Venta v ON v.id = dv.venta_id
        WHERE v.punto_id = ? 
          AND DATE(v.creado_en) BETWEEN ? AND ?
          AND az.punto_id = ? AND az.zona_id = 1
        GROUP BY p.id, p.nombre
        HAVING SUM(dv.cantidad) > 0
        ORDER BY p.nombre
      `;

      const datosMes = await executeQuery(query, [
        puntoId,
        fechaInicio,
        fechaFin,
        puntoId,
      ]);

      if (!Array.isArray(datosMes)) {
        console.error(" Error: datosMes no es array");
        return [];
      }

      console.log(` Datos del mes obtenidos: ${datosMes.length} productos`);

      // Aplicar reducción si está activa
      let datosFinales = datosMes;
      if (usarDatosReducidos && tieneReduccionAplicada) {
        console.log("🔄 Aplicando reducción a datos del mes");
        datosFinales = datosMes.map((producto) => ({
          ...producto,
          vendio: Math.max(0, Math.floor((producto.vendio || 0) * 0.8)), // Reducción del 20% solo parte entera
          monto_vendido: Math.max(
            0,
            Math.floor((producto.monto_vendido || 0) * 0.8),
          ), // Reducción del 20% solo parte entera
        }));
        console.log(`✅ Reducción aplicada a ${datosFinales.length} productos`);
      }

      return datosFinales;
    } catch (error) {
      console.error(" Error obteniendo datos del IPV del mes:", error);
      return [];
    } finally {
      setLoadingIPV(false);
    }
  }, [
    puntoId,
    añoActual,
    mesActual,
    usarDatosReducidos,
    tieneReduccionAplicada,
  ]);

  // Función para cargar datos reales desde BD (inmutable)
  const cargarDatosIPVReales = useCallback(
    async (fecha: string) => {
      try {
        setLoadingIPV(true);
        console.log("🔄 Cargando datos reales desde BD para fecha:", fecha);

        // Usar la lógica actual de consulta SQL que ya está corregida
        const query = `
        SELECT 
          p.id AS id, p.nombre AS producto, az.precio_venta AS precio,
          COALESCE(cierre.cantidad, 0) AS inicio,
          COALESCE(entradas.cantidad, 0) AS entro,
          COALESCE(ventas.cantidad, 0) AS vendio,
          COALESCE(ventas.monto, 0) AS monto_vendido,
          COALESCE(az.cantidad, 0) AS quedo
        FROM AlmacenZona az
        INNER JOIN Producto p ON p.id = az.producto_id
        
        -- Ventas EXACTAS del día (ya usa dv.precio_unitario correctamente)
        LEFT JOIN (
            SELECT dv.producto_id, SUM(dv.cantidad) as cantidad, SUM(dv.cantidad * dv.precio_unitario) as monto
            FROM DetalleVenta dv
            INNER JOIN Venta v ON v.id = dv.venta_id
            WHERE v.punto_id = ? AND DATE(v.creado_en) = DATE(?)
            GROUP BY dv.producto_id
        ) ventas ON ventas.producto_id = p.id

        -- Entradas EXACTAS del día (transferencias + productos nuevos)
        LEFT JOIN (
            SELECT producto_id, SUM(cantidad) as cantidad
            FROM LogTransferencia
            WHERE punto_id = ? AND DATE(creado_en) = DATE(?)
            GROUP BY producto_id
        ) entradas ON entradas.producto_id = p.id

        -- Inicio del día (stock del cierre anterior)
        LEFT JOIN (
            SELECT 
                ccp.producto_id, 
                COALESCE(ccp.cantidad_sistema, 0) as cantidad
            FROM CierreCaja cc
            INNER JOIN CierreCajaProducto ccp ON ccp.cierre_id = cc.id
            WHERE cc.punto_id = ? AND cc.tipo = 'cierre' 
              AND DATE(cc.fecha_cierre) = (
                SELECT MAX(DATE(cc2.fecha_cierre)) 
                FROM CierreCaja cc2 
                WHERE cc2.punto_id = ? AND cc2.tipo = 'cierre' 
                  AND DATE(cc2.fecha_cierre) < DATE(?)
              )
        ) cierre ON cierre.producto_id = p.id

        WHERE az.punto_id = ? AND az.zona_id = 1
        ORDER BY p.nombre
      `;

        const datosReales = await executeQuery(query, [
          puntoId,
          fecha, // para ventas
          puntoId,
          fecha, // para entradas
          puntoId,
          puntoId,
          fecha, // para inicio (último cierre)
          puntoId, // para WHERE principal
        ]);

        if (!Array.isArray(datosReales)) {
          console.error("❌ Error: datosReales no es array");
          setDatosIPVReales([]);
          return;
        }

        setDatosIPVReales(datosReales);
        setTieneReduccionAplicada(false);
      } catch (error) {
        console.error("❌ Error cargando datos reales:", error);
        setDatosIPVReales([]);
      } finally {
        setLoadingIPV(false);
      }
    },
    [puntoId],
  );

  const obtenerDatosIPVFecha = useCallback(
    async (fecha: string) => {
      if (!puntoId) return;

      try {
        setLoadingIPV(true);
        console.log(
          "🔄 Obteniendo datos del IPV para fecha:",
          fecha,
          "puntoId:",
          puntoId,
        );

        // 🔄 Primero verificar si hay datos reducidos
        const { existeDatosReducidos, obtenerDatosReducidos } =
          await import("../src/db/services/ipv_datos_reducidos_service");

        const tieneDatosReducidos = await existeDatosReducidos(puntoId, fecha);

        if (tieneDatosReducidos) {
          console.log("✅ Datos reducidos encontrados, cargando...");
          const datosReducidos = await obtenerDatosReducidos(puntoId, fecha);
          setDatosIPVReducidos(datosReducidos);
          setUsarDatosReducidos(true);
          setTieneReduccionAplicada(true);
        } else {
          console.log("📊 No hay datos reducidos, cargando datos reales...");
          // Cargar datos reales usando la función dedicada
          await cargarDatosIPVReales(fecha);
          setUsarDatosReducidos(false);
          setTieneReduccionAplicada(false);
        }
      } catch (error) {
        console.error("❌ Error obteniendo datos del IPV:", error);
        Alert.alert("Error", "No se pudieron cargar los datos del IPV");
      } finally {
        setLoadingIPV(false);
      }
    },
    [puntoId, cargarDatosIPVReales],
  );

  // Función para guardar topes en la base de datos
  const guardarTopesPrecios = useCallback(
    async (topes: { [key: string]: number }) => {
      try {
        if (!puntoId) return;

        // Guardar todos los topes en la base de datos
        const exito = await TopePrecioGananciaService.guardarMultipleTopes(
          puntoId,
          topes,
        );

        if (exito) {
          console.log(`✅ Topes guardados en BD para punto ${puntoId}:`, topes);
        } else {
          console.error(`❌ Error guardando topes en BD para punto ${puntoId}`);
        }
      } catch (error) {
        console.error("❌ Error guardando topes en la base de datos:", error);
      }
    },
    [puntoId],
  );

  // Función para limpiar todos los topes
  const limpiarTodosTopes = useCallback(async () => {
    try {
      Alert.alert(
        "Confirmar",
        "¿Está seguro de que desea eliminar todos los topes de precios? Esta acción no se puede deshacer.",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              // Limpiar en la base de datos
              const exito =
                await TopePrecioGananciaService.limpiarTopesPorPunto(puntoId!);

              if (exito) {
                setTopesPrecios({});

                // Recalcular datos IPV sin topes
                const datosSinTopes = datosIPVMostrados.map((producto) => ({
                  ...producto,
                  precio_con_tope: producto.precio,
                  monto_vendido_con_tope: producto.monto_vendido || 0,
                }));

                Alert.alert(
                  "Topes Eliminados",
                  "Todos los topes de precios han sido eliminados correctamente",
                );
              } else {
                Alert.alert("Error", "No se pudieron eliminar los topes");
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert("Error", "No se pudo eliminar el tope");
    }
  }, [datosIPVMostrados, puntoId]);

  // Estados para comparación
  const [periodo1Inicio, setPeriodo1Inicio] = useState<Date | null>(null);
  const [periodo1Fin, setPeriodo1Fin] = useState<Date | null>(null);
  const [periodo2Inicio, setPeriodo2Inicio] = useState<Date | null>(null);
  const [periodo2Fin, setPeriodo2Fin] = useState<Date | null>(null);
  const [mostrarDatePicker1Inicio, setMostrarDatePicker1Inicio] =
    useState(false);
  const [mostrarDatePicker1Fin, setMostrarDatePicker1Fin] = useState(false);
  const [mostrarDatePicker2Inicio, setMostrarDatePicker2Inicio] =
    useState(false);
  const [mostrarDatePicker2Fin, setMostrarDatePicker2Fin] = useState(false);

  // Estados para modales
  const [mostrarModalPeriodo, setMostrarModalPeriodo] = useState(false);
  const [mostrarModalComparacion, setMostrarModalComparacion] = useState(false);
  const [tipoComparacion, setTipoComparacion] = useState<
    "ganancias" | "ventas"
  >("ganancias");
  const [
    mostrarModalGananciasCompartidas,
    setMostrarModalGananciasCompartidas,
  ] = useState(false);

  // Estados para ganancias compartidas
  const [personasCompartidas, setPersonasCompartidas] = useState<
    PersonaGananciaCompartida[]
  >([]);
  const [distribucionGanancias, setDistribucionGanancias] = useState<
    GananciaCompartidaCalculo[]
  >([]);
  const [totalUsuario, setTotalUsuario] = useState(0);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [mostrarFormNuevaPersona, setMostrarFormNuevaPersona] = useState(false);
  const [formDataPersona, setFormDataPersona] = useState({
    nombre: "",
    tipo_comparticion: "porcentaje" as "porcentaje" | "cantidad_fija",
    valor: "",
  });

  // Estados para edición de persona
  const [mostrarModalEditarPersona, setMostrarModalEditarPersona] =
    useState(false);
  const [personaEditando, setPersonaEditando] =
    useState<PersonaGananciaCompartida | null>(null);
  const [formDataEditPersona, setFormDataEditPersona] = useState({
    nombre: "",
    tipo_comparticion: "porcentaje" as "porcentaje" | "cantidad_fija",
    valor: "",
  });

  // Funciones principales
  const get_ganancia_actual = useCallback(async () => {
    try {
      let ganancias = 0;

      // Obtener ganancias según el período seleccionado
      switch (tipoPeriodo) {
        case "dia":
          ganancias = await PuntoHelper.getGananciasBrutasHoy(puntoId!);
          break;
        case "semana":
          ganancias = await PuntoHelper.getGananciasSemana(puntoId!);
          break;
        case "mes":
          ganancias = await PuntoHelper.getGananciasMes(puntoId!);
          break;
        case "personalizado":
          if (fechaInicio && fechaFin) {
            // Para período personalizado, calcular manualmente usando la misma lógica que get_ganancia_periodo
            const inicio = fechaInicio.toISOString().split("T")[0];
            const fin = fechaFin.toISOString().split("T")[0];

            ganancias = await getSingleValue<number>(
              `SELECT COALESCE(SUM(dv.subtotal - (COALESCE(p.precio_coste, 0) * dv.cantidad)), 0) as ganancias_periodo
               FROM DetalleVenta dv
               INNER JOIN Venta v ON dv.venta_id = v.id
               LEFT JOIN Producto p ON dv.producto_id = p.id
               WHERE v.punto_id = ? 
               AND DATE(v.creado_en) BETWEEN ? AND ?`,
              [puntoId, inicio, fin],
            );
          } else {
            ganancias = await PuntoHelper.getGananciasBrutasHoy(puntoId!);
          }
          break;
        default:
          ganancias = await PuntoHelper.getGananciasBrutasHoy(puntoId!);
      }

      console.log("📊 DEBUG get_ganancia_actual:", {
        tipoPeriodo,
        ganancias,
        fechas: { inicio: fechaInicio, fin: fechaFin },
      });

      return ganancias || 0;
    } catch (error) {
      console.error("Error obteniendo ganancia actual:", error);
      return 0;
    }
  }, [puntoId, tipoPeriodo, fechaInicio, fechaFin]);

  const calcularTotalGastos = useCallback(() => {
    const total = gastosPorCategoria.reduce(
      (sum, categoria) => sum + categoria.total,
      0,
    );
    return total;
  }, [gastosPorCategoria]);

  const calcularGananciaReal = useCallback(
    (gananciaBruta: number, gastos: number) => {
      return gananciaBruta - gastos; // Permitir ganancias negativas (pérdidas)
    },
    [],
  );

  const get_producto_mas_vendido = useCallback(async () => {
    try {
      let productos: any[] = [];

      // Mostrar productos según el período seleccionado
      switch (tipoPeriodo) {
        case "dia":
          productos = await PuntoHelper.getProductosMasVendidosHoy(
            puntoId!,
            10,
          );
          break;
        case "semana":
          productos = await PuntoHelper.getProductosMasVendidosSemana(
            puntoId!,
            10,
          );
          break;
        case "mes":
          productos = await PuntoHelper.getProductosMasVendidosMes(
            puntoId!,
            10,
          );
          break;
        case "personalizado":
          if (fechaInicio && fechaFin) {
            productos = await PuntoHelper.getProductosMasVendidosPeriodo(
              puntoId!,
              fechaInicio,
              fechaFin,
              10,
            );
          }
          break;
        default:
          productos = await PuntoHelper.getProductosMasVendidosHoy(
            puntoId!,
            10,
          );
      }

      return productos;
    } catch (error) {
      console.error("Error obteniendo productos más vendidos:", error);
      return [];
    }
  }, [puntoId, tipoPeriodo, fechaInicio, fechaFin]);

  const get_producto_menos_vendido = useCallback(async () => {
    try {
      let productos: any[] = [];

      // Mostrar productos según el período seleccionado usando funciones específicas para menos vendidos
      switch (tipoPeriodo) {
        case "dia":
          productos = await PuntoHelper.getProductosMenosVendidosHoy(
            puntoId!,
            5,
          );
          break;
        case "semana":
          productos = await PuntoHelper.getProductosMenosVendidosSemana(
            puntoId!,
            5,
          );
          break;
        case "mes":
          productos = await PuntoHelper.getProductosMenosVendidosMes(
            puntoId!,
            5,
          );
          break;
        case "personalizado":
          if (fechaInicio && fechaFin) {
            productos = await PuntoHelper.getProductosMenosVendidosPeriodo(
              puntoId!,
              fechaInicio,
              fechaFin,
              5,
            );
          }
          break;
        default:
          productos = await PuntoHelper.getProductosMenosVendidosHoy(
            puntoId!,
            5,
          );
      }

      return productos;
    } catch (error) {
      console.error("Error obteniendo productos menos vendidos:", error);
      return [];
    }
  }, [puntoId, tipoPeriodo, fechaInicio, fechaFin]);

  const get_productos_todos_vendidos = useCallback(
    async (pagina: number = 1, limite: number = 10) => {
      try {
        setLoadingTodosProductos(true);
        let productos: any[] = [];
        let total: number = 0;
        const offset = (pagina - 1) * limite;

        // Mostrar productos según el período seleccionado
        switch (tipoPeriodo) {
          case "dia":
            productos = await PuntoHelper.getProductosVendidosHoy(
              puntoId!,
              limite,
              offset,
            );
            total = await PuntoHelper.getTotalProductosVendidosHoy(puntoId!);
            break;
          case "semana":
            productos = await PuntoHelper.getProductosVendidosSemana(
              puntoId!,
              limite,
              offset,
            );
            total = await PuntoHelper.getTotalProductosVendidosSemana(puntoId!);
            break;
          case "mes":
            productos = await PuntoHelper.getProductosVendidosMes(
              puntoId!,
              limite,
              offset,
            );
            total = await PuntoHelper.getTotalProductosVendidosMes(puntoId!);
            break;
          case "personalizado":
            if (fechaInicio && fechaFin) {
              productos = await PuntoHelper.getProductosVendidosPeriodo(
                puntoId!,
                fechaInicio,
                fechaFin,
                limite,
                offset,
              );
              total = await PuntoHelper.getTotalProductosVendidosPeriodo(
                puntoId!,
                fechaInicio,
                fechaFin,
              );
            }
            break;
          default:
            productos = await PuntoHelper.getProductosVendidosHoy(
              puntoId!,
              limite,
              offset,
            );
            total = await PuntoHelper.getTotalProductosVendidosHoy(puntoId!);
            break;
        }

        return { productos, total };
      } catch (error) {
        console.error("Error obteniendo todos los productos vendidos:", error);
        return [];
      } finally {
        setLoadingTodosProductos(false);
      }
    },
    [puntoId, tipoPeriodo, fechaInicio, fechaFin],
  );

  // Estado para evitar interferencias en el cambio de modo
  const [evitarInterferencia, setEvitarInterferencia] = useState(false);

  // Función para ir al día de hoy
  const irHoy = useCallback(() => {
    const hoy = new Date();
    const nuevoDiaActual = hoy.getDate();
    const nuevoMesActual = hoy.getMonth();
    const nuevoAñoActual = hoy.getFullYear();

    // Activar bandera para evitar interferencias
    setEvitarInterferencia(true);

    // Actualizar todos los estados juntos
    setDiaActual(nuevoDiaActual);
    setMesActual(nuevoMesActual);
    setAñoActual(nuevoAñoActual);

    const fechaStr = getFechaLocal();
    console.log("🔄 Botón Hoy presionado, cargando datos para:", fechaStr);

    // Cargar datos directamente sin interferencias
    obtenerDatosIPVFecha(fechaStr);

    // Desactivar bandera después de un tiempo
    setTimeout(() => {
      setEvitarInterferencia(false);
    }, 500);
  }, [obtenerDatosIPVFecha]);

  // Función para generar HTML de una página específica del IPV
  const generarHTMLPaginaIPV = (
    productosPagina: any[],
    numeroPagina: number,
    totalPaginas: number,
    totalVentas: number,
    totalProductos: number,
    tituloPeriodo: string = "",
  ): string => {
    const productosHTML = productosPagina
      .map((producto, index) => {
        const isEven = index % 2 === 0;

        // Determinar precio a mostrar y monto final
        const precioConTope =
          topesPrecios[producto.producto] &&
          topesPrecios[producto.producto] < producto.precio
            ? topesPrecios[producto.producto]
            : null;

        let precioMostrar, montoFinal;

        if (precioConTope) {
          // Hay tope aplicado: usar precio con tope
          precioMostrar = precioConTope;
          montoFinal = (producto.vendio || 0) * precioConTope;
        } else {
          // Sin tope: calcular precio promedio real y usar monto real
          const montoReal = producto.monto_vendido || 0;
          const cantidadVendida = producto.vendio || 0;
          precioMostrar =
            cantidadVendida > 0 ? montoReal / cantidadVendida : producto.precio;
          montoFinal = montoReal;
        }

        return `
          <tr class="${isEven ? "" : "even"}">
            <td class="producto">${producto.producto}</td>
            <td>$${precioMostrar.toFixed(2)}</td>
            <td>${producto.inicio || 0}</td>
            <td>${producto.entro || 0}</td>
            <td>${producto.vendio || 0}</td>
            <td>${producto.quedo_visual !== undefined ? producto.quedo_visual : producto.quedo || 0}</td>
            <td class="vendido">$${montoFinal.toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="pagina">
        ${
          numeroPagina === 1
            ? `
          <div class="header">
            <h1>INFORME DE PRODUCTOS VENDIDOS (IPV)${puntoId ? ` - ${puntoNombre}` : ""} - ${tituloPeriodo}</h1>
            <p>Generado: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES")}</p>
            ${puntoId ? `<p>Punto: ${puntoNombre}</p>` : ""}
            ${tituloPeriodo ? `<p>Período: ${tituloPeriodo}</p>` : ""}
          </div>
        `
            : `
          <div class="header-continuo">
            <h1>INFORME DE PRODUCTOS VENDIDOS (IPV)${puntoId ? ` - ${puntoNombre}` : ""} - ${tituloPeriodo} (Cont.)</h1>
            <p>Página ${numeroPagina} de ${totalPaginas}</p>
          </div>
        `
        }
        
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Inicio</th>
              <th>Entró</th>
              <th>Vendió</th>
              <th>Quedó</th>
              <th>Venta</th>
            </tr>
          </thead>
          <tbody>
            ${productosHTML}
            ${
              numeroPagina === totalPaginas
                ? `
              <tr class="total">
                <td colspan="6"><strong>TOTAL VENTAS:</strong></td>
                <td><strong>$${totalVentas.toFixed(2)}</strong></td>
              </tr>
            `
                : ""
            }
          </tbody>
        </table>
        
        <div class="footer">
          <p>Página ${numeroPagina} de ${totalPaginas} | Total de productos: ${totalProductos}</p>
        </div>
      </div>
      
      ${numeroPagina < totalPaginas ? '<div class="page-break"></div>' : ""}
    `;
  };

  // Función para generar HTML específico para el PDF del mes (columnas simplificadas)
  const generarHTMLPaginaIPVMes = (
    productosPagina: any[],
    numeroPagina: number,
    totalPaginas: number,
    totalVentas: number,
    totalProductos: number,
    tituloPeriodo: string = "",
  ): string => {
    const productosHTML = productosPagina
      .map((producto, index) => {
        const isEven = index % 2 === 0;

        // Determinar precio a mostrar y monto final
        const precioConTope =
          topesPrecios[producto.producto] &&
          topesPrecios[producto.producto] < producto.precio
            ? topesPrecios[producto.producto]
            : producto.precio;

        const montoFinal = precioConTope
          ? (producto.vendio || 0) * precioConTope
          : producto.monto_vendido || 0;

        return `
          <tr style="background-color: ${isEven ? "#f9fafb" : "white"};">
            <td style="text-align: left; font-weight: 600; padding: 8px 6px;">${
              producto.producto || "N/A"
            }</td>
            <td style="text-align: center; padding: 8px 6px;">$${(precioConTope || 0).toFixed(2)}</td>
            <td style="text-align: center; font-weight: bold; color: #059669; padding: 8px 6px;">${
              producto.vendio || 0
            }</td>
            <td style="text-align: right; font-weight: bold; padding: 8px 6px;">$${montoFinal.toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="pagina">
        ${
          numeroPagina === 1
            ? `
          <div class="header">
            <h1>INFORME DE PRODUCTOS VENDIDOS (IPV)${puntoId ? ` - ${puntoNombre}` : ""} - ${tituloPeriodo}</h1>
            <p>Generado: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES")}</p>
            ${puntoId ? `<p>Punto: ${puntoNombre}</p>` : ""}
            ${tituloPeriodo ? `<p>Período: ${tituloPeriodo}</p>` : ""}
          </div>
        `
            : `
          <div class="header-continuo">
            <h1>INFORME DE PRODUCTOS VENDIDOS (IPV)${puntoId ? ` - ${puntoNombre}` : ""} - ${tituloPeriodo} (Cont.)</h1>
            <p>Página ${numeroPagina} de ${totalPaginas}</p>
          </div>
        `
        }
        
        <table>
          <thead>
            <tr>
              <th style="width: 40%; text-align: left;">Producto</th>
              <th style="width: 20%; text-align: center;">Precio</th>
              <th style="width: 20%; text-align: center;">Vendió</th>
              <th style="width: 20%; text-align: right;">Venta</th>
            </tr>
          </thead>
          <tbody>
            ${productosHTML}
            ${
              numeroPagina === totalPaginas
                ? `
            <tr class="total">
              <td colspan="3" style="text-align: right; font-weight: bold; padding: 10px 6px; background-color: #f0f9ff;">
                TOTAL GENERAL:
              </td>
              <td style="text-align: right; font-weight: bold; font-size: 14px; padding: 10px 6px; background-color: #f0f9ff;">
                $${totalVentas.toFixed(2)}
              </td>
            </tr>
            `
                : ""
            }
          </tbody>
        </table>
        
        <div class="footer">
          <p>Página ${numeroPagina} de ${totalPaginas} | Total de productos: ${totalProductos}</p>
        </div>
      </div>
      
      ${numeroPagina < totalPaginas ? '<div class="page-break"></div>' : ""}
    `;
  };

  const generarPDFIPV = useCallback(
    async (periodo: "dia" | "mes" = "dia") => {
      try {
        let datosParaPDF: any[] = [];
        let tituloPeriodo = "";
        let totalVentas = 0;

        if (periodo === "mes") {
          // Obtener datos del mes
          datosParaPDF = await obtenerDatosIPVMes();
          tituloPeriodo = `MES ${new Date(añoActual, mesActual).toLocaleDateString("es-ES", { month: "long", year: "numeric" }).toUpperCase()}`;

          // Calcular total de ventas del mes
          totalVentas = datosParaPDF.reduce((sum, producto) => {
            const montoReal = producto.monto_vendido || 0;

            // Aplicar tope si existe
            const precioConTope =
              topesPrecios[producto.producto] &&
              topesPrecios[producto.producto] < producto.precio
                ? topesPrecios[producto.producto]
                : null;

            const montoFinal = precioConTope
              ? (producto.vendio || 0) * precioConTope
              : montoReal;

            return sum + montoFinal;
          }, 0);
        } else {
          // Usar datos actuales (día)
          datosParaPDF = datosIPVMostrados;
          tituloPeriodo = "DÍA ACTUAL";

          // Calcular total de ventas del día
          const productosConDatos = datosParaPDF.filter(
            (producto) =>
              (producto.inicio || 0) > 0 || (producto.entro || 0) > 0,
          );

          totalVentas = productosConDatos.reduce((sum, producto) => {
            const montoReal = producto.monto_vendido || 0;
            const precioConTope =
              topesPrecios[producto.producto] &&
              topesPrecios[producto.producto] < producto.precio
                ? topesPrecios[producto.producto]
                : null;
            const montoFinal = precioConTope
              ? (producto.vendio || 0) * precioConTope
              : montoReal;
            return sum + montoFinal;
          }, 0);
        }

        // Validación preventiva
        if (datosParaPDF.length > 100) {
          const confirmar = await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Muchos Productos Detectados",
              `Se encontraron ${datosParaPDF.length} productos. La generación del PDF puede tardar varios minutos.\n\n¿Deseas continuar?`,
              [
                {
                  text: "Cancelar",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                { text: "Continuar", onPress: () => resolve(true) },
              ],
            );
          });

          if (!confirmar) return;
        }

        setGeneratingPDF(true);
        setMostrarModalProgreso(true);
        setProgresoPDF(0);

        const PRODUCTOS_POR_PAGINA = 25;
        const totalPaginas = Math.ceil(
          datosParaPDF.length / PRODUCTOS_POR_PAGINA,
        );

        // Filtrar productos con datos para mostrar (solo para día)
        let productosConDatos = datosParaPDF;
        if (periodo === "dia") {
          productosConDatos = datosParaPDF.filter(
            (producto) =>
              (producto.inicio || 0) > 0 || (producto.entro || 0) > 0,
          );
        }

        // Generar HTML completo con todas las páginas
        let htmlCompleto = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Informe de Productos Vendidos (IPV)</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
              font-size: 12px;
            }
            .pagina {
              page-break-after: always;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #1f2937;
              padding-bottom: 15px;
            }
            .header-continuo {
              text-align: center;
              margin-bottom: 15px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .header h1, .header-continuo h1 {
              color: #1f2937;
              margin: 0;
              font-size: 20px;
            }
            .header p, .header-continuo p {
              color: #6b7280;
              margin: 3px 0 0 0;
              font-size: 11px;
            }
            .page-break {
              page-break-after: always;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 10px;
            }
            th {
              background-color: #1f2937;
              color: white;
              padding: 8px 4px;
              text-align: center;
              font-weight: bold;
              border: 1px solid #374151;
              font-size: 9px;
            }
            td {
              padding: 6px 4px;
              border: 1px solid #e5e7eb;
              text-align: center;
              vertical-align: top;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .text-right {
              text-align: right;
            }
            .producto {
              text-align: left;
              font-weight: 600;
            }
            .vendido {
              font-weight: bold;
              color: #059669;
            }
            .total {
              background-color: #f0f9ff;
              font-weight: bold;
            }
            .footer {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 9px;
            }
            @media print {
              .pagina {
                page-break-after: always;
              }
              body {
                margin: 10px;
              }
            }
          </style>
        </head>
        <body>
      `;

        // Generar páginas de forma asíncrona por lotes
        for (let pagina = 1; pagina <= totalPaginas; pagina++) {
          const inicio = (pagina - 1) * PRODUCTOS_POR_PAGINA;
          const fin = Math.min(
            inicio + PRODUCTOS_POR_PAGINA,
            productosConDatos.length,
          );
          const productosPagina = productosConDatos.slice(inicio, fin);

          // Generar HTML para esta página
          const htmlPagina =
            periodo === "mes"
              ? generarHTMLPaginaIPVMes(
                  productosPagina,
                  pagina,
                  totalPaginas,
                  totalVentas,
                  productosConDatos.length,
                  tituloPeriodo,
                )
              : generarHTMLPaginaIPV(
                  productosPagina,
                  pagina,
                  totalPaginas,
                  totalVentas,
                  productosConDatos.length,
                  tituloPeriodo,
                );
          htmlCompleto += htmlPagina;

          // Actualizar progreso
          const progreso = Math.round((pagina / totalPaginas) * 100);
          setProgresoPDF(progreso);

          // Pequeña pausa para no bloquear la UI
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        htmlCompleto += `
        </body>
        </html>
      `;

        // Crear el PDF con expo-print
        const { uri } = await ExpoPrint.printToFileAsync({
          html: htmlCompleto,
        });

        // Generar nombre personalizado
        const fechaActual = new Date()
          .toLocaleDateString("es-ES")
          .replace(/\//g, "-");
        const nombreArchivo = `IPV_${puntoNombre}_${periodo === "mes" ? "MES_" : ""}${fechaActual}.pdf`;

        // Cerrar modal de progreso
        setMostrarModalProgreso(false);
        setProgresoPDF(0);

        // Mostrar alerta de éxito con opciones
        Alert.alert(
          "PDF Generado Exitosamente",
          `Se generó un PDF con ${totalPaginas} página(s) y ${productosConDatos.length} productos.\n\nEl archivo "${nombreArchivo}" ha sido guardado. ¿Qué deseas hacer?`,
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
                    "No se pudo compartir el archivo. El PDF está guardado en tu dispositivo y puedes compartirlo manualmente.",
                    [{ text: "OK" }],
                  );
                }
              },
            },
            {
              text: "Ver Información",
              onPress: () => {
                Alert.alert(
                  "Información del Archivo",
                  `📄 Nombre: ${nombreArchivo}\n\n📅 Fecha: ${fechaActual}\n\n📊 Total páginas: ${totalPaginas}\n\n📦 Total productos: ${productosConDatos.length}\n\n💰 Total ventas: $${totalVentas.toFixed(2)}\n\n💾 El archivo está guardado en el dispositivo. Puedes acceder a él desde aplicaciones de archivos y compartirlo manualmente si es necesario.`,
                  [{ text: "Entendido" }],
                );
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
        setMostrarModalProgreso(false);
        setProgresoPDF(0);
        Alert.alert("Error", "No se pudo generar el archivo PDF");
      } finally {
        setGeneratingPDF(false);
      }
    },
    [
      datosIPVMostrados,
      puntoNombre,
      puntoId,
      topesPrecios,
      generarHTMLPaginaIPV,
      generarHTMLPaginaIPVMes,
      obtenerDatosIPVMes,
      añoActual,
      mesActual,
    ],
  );

  // Funciones para generar PDF según período
  const generarPDFDia = useCallback(async () => {
    await generarPDFIPV("dia");
  }, [generarPDFIPV]);

  const generarPDFMes = useCallback(async () => {
    await generarPDFIPV("mes");
  }, [generarPDFIPV]);

  // Función para obtener días del mes
  const obtenerDiasDelMes = useCallback(() => {
    const ultimoDia = new Date(añoActual, mesActual + 1, 0).getDate();
    const dias = [];
    for (let i = 1; i <= ultimoDia; i++) {
      dias.push(i);
    }
    return dias;
  }, [añoActual, mesActual]);

  // Función para cambiar de día
  const cambiarDia = useCallback(
    (dia: number) => {
      console.log("🔍 DEBUG cambiarDia:", {
        diaSeleccionado: dia,
        añoActual,
        mesActual,
        puntoId,
      });

      setDiaActual(dia);
      const fechaStr = `${añoActual}-${(mesActual + 1).toString().padStart(2, "0")}-${dia.toString().padStart(2, "0")}`;
      console.log(
        "🔍 DEBUG cambiarDia - llamando obtenerDatosIPVFecha con:",
        fechaStr,
      );
      obtenerDatosIPVFecha(fechaStr);
    },
    [añoActual, mesActual, obtenerDatosIPVFecha],
  );

  // Función para cambiar de mes
  const cambiarMes = useCallback(
    (direccion: number) => {
      const nuevoMes = mesActual + direccion;
      if (nuevoMes >= 0 && nuevoMes <= 11) {
        setMesActual(nuevoMes);
        setDiaActual(1); // Resetear al primer día del nuevo mes
      } else if (nuevoMes < 0) {
        setMesActual(11);
        setAñoActual(añoActual - 1);
        setDiaActual(1);
      } else if (nuevoMes > 11) {
        setMesActual(0);
        setAñoActual(añoActual + 1);
        setDiaActual(1);
      }
    },
    [mesActual, añoActual],
  );

  // Función para obtener nombre del mes
  const obtenerNombreMes = useCallback((mes: number) => {
    const nombres = [
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
    return nombres[mes];
  }, []);

  // Función para aplicar reducción a todo el mes
  const aplicarReduccionMensual = useCallback(async () => {
    if (!puntoId || !rejuego) {
      Alert.alert("Error", "Por favor seleccione un valor de reductor válido");
      return;
    }

    try {
      const factor = parseFloat(rejuego);
      if (isNaN(factor) || factor <= 0 || factor >= 1) {
        Alert.alert(
          "Error",
          "El valor debe ser entre 0.01 y 0.99 (ej: 0.2 para 20%)",
        );
        return;
      }

      // Obtener fecha actual y límite del mes
      const today = new Date();
      const año = today.getFullYear();
      const mes = today.getMonth() + 1;
      const ultimoDiaMes = new Date(año, mes, 0).getDate();

      console.log(
        `🔄 Iniciando reducción mensual: ${año}-${mes} con factor ${factor}`,
      );

      // Importar servicios necesarios
      const { guardarDatosReducidos, eliminarDatosReducidosMes } =
        await import("../src/db/services/ipv_datos_reducidos_service");
      const AjustesInventarioService = (
        await import("../src/db/services/ajustes_inventario_service")
      ).default;

      // Eliminar datos reducidos existentes del mes
      await eliminarDatosReducidosMes(puntoId, año, mes);

      // Variables para mantener consistencia entre días
      let stockAcumulado: { [productoId: number]: number } = {};
      let reduccionTotalMes = 0;
      let diasProcesados = 0;

      // Procesar cada día del mes
      for (let dia = 1; dia <= ultimoDiaMes; dia++) {
        const fechaStr = `${año}-${mes.toString().padStart(2, "0")}-${dia.toString().padStart(2, "0")}`;

        console.log(`📅 Procesando día ${dia}: ${fechaStr}`);

        // Obtener datos reales del día
        const datosReales = await obtenerDatosRealesDia(puntoId, fechaStr);

        if (datosReales.length === 0) {
          console.log(`⚠️ No hay datos para el día ${dia}, saltando...`);
          continue;
        }

        // Aplicar reducción y mantener consistencia
        const datosReducidos = datosReales.map((producto) => {
          const productoId = producto.id;

          // Para día 1 del mes sin registros anteriores: inicio = 0
          // Para días siguientes: usar stock acumulado del día anterior si existe, sino stock inicial del día
          const esDia1 = dia === 1;
          const tieneStockAcumulado = stockAcumulado[productoId] !== undefined;

          let stockInicial: number;
          if (esDia1 && !tieneStockAcumulado) {
            // Día 1 sin registros del mes anterior: iniciar en 0
            stockInicial = 0;
            console.log(
              `  📅 Día ${dia} - ${producto.producto}: Sin registros mes anterior, inicio = 0`,
            );
          } else {
            // Usar stock acumulado del día anterior si existe, sino stock inicial del día
            stockInicial = stockAcumulado[productoId] ?? producto.inicio;
            console.log(
              `  📅 Día ${dia} - ${producto.producto}: inicio = ${stockInicial} (acumulado: ${stockAcumulado[productoId] ?? "N/A"}, real: ${producto.inicio})`,
            );
          }

          // Aplicar reducción a las ventas (factor es lo que se resta, no lo que queda)
          const ventasReducidas = Math.floor(producto.vendio * (1 - factor));

          // Calcular stock final manteniendo consistencia
          const stockFinal = Math.max(
            0,
            stockInicial + producto.entro - ventasReducidas,
          );

          // Actualizar stock acumulado para el siguiente día
          stockAcumulado[productoId] = stockFinal;

          // Calcular monto vendido reducido con precio con tope si existe
          const precioFinal =
            topesPrecios[producto.producto] &&
            topesPrecios[producto.producto] < producto.precio
              ? topesPrecios[producto.producto]
              : producto.precio;

          const montoVendidoReducido = ventasReducidas * precioFinal;

          // Acumular reducción total
          const unidadesReducidas = producto.vendio - ventasReducidas;
          reduccionTotalMes += unidadesReducidas;

          console.log(
            `  📦 ${producto.producto}: ${producto.vendio} → ${ventasReducidas} (-${unidadesReducidas})`,
          );

          return {
            id: productoId,
            producto: producto.producto,
            precio: precioFinal, // Usar precio con tope si existe
            inicio: stockInicial,
            entro: producto.entro,
            vendio: ventasReducidas,
            quedo: stockFinal,
            monto_vendido: montoVendidoReducido,
            unidades_reducidas: unidadesReducidas,
          };
        });

        // Guardar datos reducidos del día
        await guardarDatosReducidos(puntoId, fechaStr, datosReducidos);
        diasProcesados++;
        console.log(`✅ Día ${dia} procesado y guardado`);
      }

      // Guardar ajustes de inventario para reflejar la reducción
      const fechaHoy = getFechaLocal();
      const ajustesDiarios: { [productoId: number]: number } = {};

      // Calcular ajustes para el día actual
      if (stockAcumulado) {
        const datosHoy = await obtenerDatosRealesDia(puntoId, fechaHoy);
        datosHoy.forEach((producto) => {
          const productoId = producto.id;
          const stockReal = stockAcumulado[productoId];
          const stockReducido = Math.max(
            0,
            Math.floor(producto.vendio * factor),
          );
          const ajuste = stockReal - stockReducido;

          if (ajuste > 0) {
            ajustesDiarios[productoId] = ajuste;
          }
        });

        // Guardar ajustes en la tabla de ajustes de inventario
        if (Object.keys(ajustesDiarios).length > 0) {
          await AjustesInventarioService.guardarAjustes(
            puntoId,
            fechaHoy,
            ajustesDiarios,
          );
        }
      }

      // Recargar datos del día actual (la función detectará automáticamente si hay reducción)
      await obtenerDatosIPVFecha(fechaHoy);

      Alert.alert(
        "✅ Reducción Mensual Completada",
        `Se procesaron ${diasProcesados} días del mes.\n\n` +
          `Total de unidades reducidas: ${reduccionTotalMes}\n\n` +
          `Los datos reducidos se mostrarán automáticamente.`,
        [
          {
            text: "OK",
            style: "default",
          },
        ],
      );
    } catch (error: any) {
      console.error("❌ Error en reducción mensual:", error);
      Alert.alert(
        "Error",
        "Ocurrió un error al aplicar la reducción mensual. Por favor intente nuevamente.",
      );
    }
  }, [puntoId, rejuego, obtenerDatosIPVFecha]);

  // Función para limpiar reducción aplicada
  const limpiarReduccion = useCallback(async () => {
    try {
      console.log("🔄 Limpiando reducción aplicada...");

      if (!puntoId) {
        Alert.alert("Error", "No se ha seleccionado un punto de venta.");
        return;
      }

      // Eliminar todos los datos reducidos del mes actual
      const { eliminarDatosReducidosMes } =
        await import("../src/db/services/ipv_datos_reducidos_service");

      const añoActual = new Date().getFullYear();
      const mesActual = new Date().getMonth() + 1;

      await eliminarDatosReducidosMes(puntoId, añoActual, mesActual);

      // Pequeño delay para asegurar que la eliminación se complete antes de recargar
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Recargar datos del día actual (ahora mostrará datos reales)
      const fechaHoy = getFechaLocal();
      await obtenerDatosIPVFecha(fechaHoy);

      Alert.alert(
        "✅ Reducción Eliminada",
        "Se han eliminado todos los datos reducidos del mes.\n\n" +
          "Ahora se muestran los datos reales.",
        [
          {
            text: "OK",
            style: "default",
          },
        ],
      );
    } catch (error: any) {
      console.error("❌ Error limpiando reducción:", error);
      Alert.alert(
        "Error",
        "Ocurrió un error al eliminar la reducción. Por favor intente nuevamente.",
      );
    }
  }, [puntoId, obtenerDatosIPVFecha]);

  // 🔄 Función para eliminar reducción (CRÍTICO - según requisitos del usuario)
  const eliminarReduccion = useCallback(async () => {
    try {
      console.log("🔄 Eliminando reducción...");

      // Cambiar a modo datos reales
      setUsarDatosReducidos(false);
      setTieneReduccionAplicada(false);

      // 🔥 RELOAD REAL DATA FROM DB
      const fechaHoy = getFechaLocal();
      await cargarDatosIPVReales(fechaHoy);

      Alert.alert(
        "✅ Reducción Eliminada",
        "Se han restaurado los datos reales correctamente.",
        [{ text: "OK", style: "default" }],
      );
    } catch (error: any) {
      console.error("❌ Error eliminando reducción:", error);
      Alert.alert(
        "Error",
        "Ocurrió un error al eliminar la reducción. Por favor intente nuevamente.",
        [{ text: "OK", style: "default" }],
      );
    }
  }, [cargarDatosIPVReales]);

  // Función auxiliar para obtener datos reales de un día específico
  const obtenerDatosRealesDia = async (puntoId: number, fecha: string) => {
    const query = `
      SELECT 
        p.id AS id, p.nombre AS producto, az.precio_venta AS precio,
        COALESCE(apertura.cantidad, 0) AS inicio,
        COALESCE(entradas.cantidad, 0) AS entro,
        COALESCE(ventas.cantidad, 0) AS vendio,
        COALESCE(az.cantidad, 0) AS quedo
      FROM AlmacenZona az
      INNER JOIN Producto p ON p.id = az.producto_id
      
      -- Ventas EXACTAS del día
      LEFT JOIN (
          SELECT dv.producto_id, SUM(dv.cantidad) as cantidad
          FROM DetalleVenta dv
          INNER JOIN Venta v ON v.id = dv.venta_id
          WHERE v.punto_id = ? AND DATE(v.creado_en) = DATE(?)
          GROUP BY dv.producto_id
      ) ventas ON ventas.producto_id = p.id

      -- Entradas EXACTAS del día
      LEFT JOIN (
          SELECT producto_id, SUM(cantidad) as cantidad
          FROM LogTransferencia
          WHERE punto_id = ? AND DATE(creado_en) = DATE(?)
          GROUP BY producto_id
      ) entradas ON entradas.producto_id = p.id

      -- Inicio (apertura) EXACTO del día
      LEFT JOIN (
          SELECT ccp.producto_id, ccp.cantidad_sistema as cantidad
          FROM CierreCaja cc
          INNER JOIN CierreCajaProducto ccp ON ccp.cierre_id = cc.id
          WHERE cc.punto_id = ? AND cc.tipo = 'apertura' AND DATE(cc.fecha_cierre) = DATE(?)
      ) apertura ON apertura.producto_id = p.id

      WHERE az.punto_id = ? AND az.zona_id = 1
      ORDER BY p.nombre
    `;

    const resultados = await executeQuery(query, [
      puntoId,
      fecha, // para ventas
      puntoId,
      fecha, // para entradas
      puntoId,
      fecha, // para apertura
      puntoId, // para WHERE principal
    ]);

    return resultados || [];
  };
  const aplicarTopePrecio = useCallback(async () => {
    if (!productoSeleccionado || !precioTope || !puntoId) {
      Alert.alert("Error", "Por favor complete todos los campos");
      return;
    }

    try {
      const valorTope = parseFloat(precioTope);
      if (isNaN(valorTope) || valorTope <= 0) {
        Alert.alert("Error", "El tope debe ser un número mayor a 0");
        return;
      }

      // Actualizar topes de precios
      const nuevosTopes = { ...topesPrecios };
      nuevosTopes[productoSeleccionado] = valorTope;
      setTopesPrecios(nuevosTopes);

      // Guardar tope individual en la base de datos
      const exito = await TopePrecioGananciaService.guardarTope(
        puntoId,
        productoSeleccionado,
        valorTope,
      );

      if (!exito) {
        Alert.alert("Error", "No se pudo guardar el tope de precio");
        return;
      }

      // Recalcular datos IPV con nuevos topes
      const datosActualizados = datosIPVMostrados.map((producto) => ({
        ...producto,
        precio_con_tope:
          nuevosTopes[producto.producto] &&
          nuevosTopes[producto.producto] < producto.precio
            ? nuevosTopes[producto.producto]
            : producto.precio,
        monto_vendido_con_tope:
          (nuevosTopes[producto.producto] &&
          nuevosTopes[producto.producto] < producto.precio
            ? nuevosTopes[producto.producto]
            : producto.precio) * (producto.vendio || 0),
      }));

      // Nota: Los topes se aplican solo en visualización, no modifican datos base
      // setDatosIPV(datosActualizados); // ❌ PROHIBIDO - no modificar datos base

      Alert.alert(
        "Tope Aplicado",
        `Se ha aplicado un tope de $${valorTope.toFixed(2)} al producto "${productoSeleccionado}"`,
      );

      // Limpiar formulario
      setProductoSeleccionado("");
      setPrecioTope("");
      setMostrarModalTopes(false);
    } catch (error) {
      console.error("Error aplicando tope:", error);
      Alert.alert("Error", "No se pudo aplicar el tope de precio");
    }
  }, [
    productoSeleccionado,
    precioTope,
    topesPrecios,
    datosIPVMostrados,
    puntoId,
  ]);

  // Cargar datos del IPV cuando se cambia al modo IPV
  useEffect(() => {
    if (modoVista === "ipv" && puntoId) {
      const fechaHoy = getFechaLocal();
      obtenerDatosIPVFecha(fechaHoy);
    }
  }, [modoVista, puntoId, obtenerDatosIPVFecha]);

  const get_gastos_por_categoria = useCallback(async () => {
    console.log(
      "🚀 get_gastos_por_categoria llamado - obteniendo gastos reales",
    );

    try {
      // Importar GastoService dinámicamente para evitar problemas de importación circular
      const { GastoService } = await import("../src/db/services/gasto_service");

      // Obtener gastos del período actual según el tipoPeriodo seleccionado
      let periodo: "hoy" | "semana" | "mes" = "hoy";

      switch (tipoPeriodo) {
        case "dia":
          periodo = "hoy";
          break;
        case "semana":
          periodo = "semana";
          break;
        case "mes":
          periodo = "mes";
          break;
        case "personalizado":
          // Para período personalizado, usar la función de período específico
          if (fechaInicio && fechaFin) {
            const gastos = await GastoService.obtenerGastosPorPeriodo(
              puntoId!,
              "periodo",
              getFechaLocal(),
              getFechaLocal(),
            );

            // Agrupar por categoría manualmente
            const gastosAgrupados: { [key: string]: GastoPorCategoria } = {};

            for (const gasto of gastos) {
              const categoria = gasto.categoria || "general";
              if (!gastosAgrupados[categoria]) {
                gastosAgrupados[categoria] = {
                  categoria,
                  total: 0,
                  cantidad: 0,
                  detalles: [],
                };
              }

              let montoReal = gasto.precio;
              // Si es salario porcentual, calcular monto real y restar consumos propios
              if (
                gasto.categoria === "Salario" &&
                gasto.porcentaje &&
                gasto.porcentaje > 0
              ) {
                // Obtener ventas del período para este trabajador específico
                const gananciasPeriodo =
                  await GastoService.obtenerVentasTrabajadorPeriodo(
                    puntoId!,
                    gasto.id!, // Pasar el ID del trabajador específico
                    "periodo",
                    getFechaLocal(),
                    getFechaLocal(),
                  );

                // Obtener porcentaje vigente para el período (usar el porcentaje actual, no el guardado)
                const porcentajeVigente =
                  await GastoService.obtenerPorcentajeVigenteEnFecha(
                    gasto.id!,
                    getFechaLocal(), // Usar la fecha final del período
                  );

                // Lógica para calcular salario según tipo
                const esPorcentaje =
                  gasto.es_porcentaje === 1 ||
                  (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
                const salarioTeorico = esPorcentaje
                  ? (gananciasPeriodo * porcentajeVigente) / 100
                  : gasto.precio || 0; // Si es fijo, el salario es directamente el 'precio' guardado

                // Obtener consumos propios del trabajador
                const consumosPropios =
                  await GastoService.obtenerConsumosPropiosPeriodo(
                    puntoId!,
                    gasto.nombre || "Sin nombre",
                    "periodo",
                    getFechaLocal(),
                    getFechaLocal(),
                  );

                // Calcular salario final: teórico - consumos propios
                montoReal = salarioTeorico - consumosPropios;

                console.log(
                  `💰 DEBUG salario período personalizado: ventas=${gananciasPeriodo}, porcentajeVigente=${porcentajeVigente}%, teorico=${salarioTeorico}, consumos=${consumosPropios}, final=${montoReal}`,
                );
              }

              gastosAgrupados[categoria].total += montoReal;
              gastosAgrupados[categoria].cantidad += 1;

              // Agregar detalles para salarios
              if (gasto.categoria === "Salario") {
                gastosAgrupados[categoria].detalles?.push({
                  nombre: gasto.nombre,
                  monto: montoReal,
                  es_porcentaje:
                    gasto.porcentaje !== undefined && gasto.porcentaje > 0,
                  porcentaje: gasto.porcentaje,
                  descripcion: gasto.descripcion,
                });
              }
            }

            const resultado = Object.values(
              gastosAgrupados,
            ) as GastoPorCategoria[];
            console.log("✅ Gastos por período personalizado:", resultado);
            return resultado;
          }
          break;
      }

      // Para períodos predefinidos (hoy, semana, mes), usar la misma lógica que la pantalla de gastos
      // Obtener gastos del período específico usando obtenerGastosPorPeriodo
      const gastosDelPeriodo = await GastoService.obtenerGastosPorPeriodo(
        puntoId!,
        periodo,
        undefined,
        undefined,
      );

      console.log(
        "📊 Gastos obtenidos del período",
        periodo,
        ":",
        gastosDelPeriodo.length,
      );
      console.log(
        "🔍 Gastos:",
        gastosDelPeriodo.map((g) => ({
          nombre: g.nombre,
          categoria: g.categoria,
          precio: g.precio,
        })),
      );

      // Agrupar por categoría manualmente
      const gastosAgrupados: { [key: string]: GastoPorCategoria } = {};

      for (const gasto of gastosDelPeriodo) {
        console.log("🔍 Procesando gasto:", {
          nombre: gasto.nombre,
          categoria: gasto.categoria,
          precio: gasto.precio,
          porcentaje: gasto.porcentaje,
        });

        const categoria = gasto.categoria || "general";
        if (!gastosAgrupados[categoria]) {
          gastosAgrupados[categoria] = {
            categoria,
            total: 0,
            cantidad: 0,
            detalles: [],
          };
        }

        let montoReal = gasto.precio;
        // Si es salario porcentual, calcular monto real basado en ganancias del período
        if (
          gasto.categoria === "Salario" &&
          gasto.porcentaje &&
          gasto.porcentaje > 0
        ) {
          // Obtener ventas del período para este trabajador específico
          const gananciasPeriodo =
            await GastoService.obtenerVentasTrabajadorPeriodo(
              puntoId!,
              gasto.id!, // Pasar el ID del trabajador específico
              periodo,
            );

          // Obtener porcentaje vigente para el período
          const porcentajeVigente =
            await GastoService.obtenerPorcentajeVigenteEnFecha(
              gasto.id!,
              getFechaLocal(),
            );

          // Calcular salario teórico basado en ganancias del período
          const salarioTeorico = (gananciasPeriodo * porcentajeVigente) / 100;

          // Restar consumos propios del trabajador
          const consumosPropios =
            await GastoService.obtenerConsumosPropiosPeriodo(
              puntoId!,
              gasto.nombre || "Sin nombre",
              periodo,
            );

          // Calcular salario final: teórico - consumos propios
          montoReal = salarioTeorico - consumosPropios;
        } else {
          // Si es salario fijo o no es porcentual, usar el precio guardado
          montoReal = gasto.precio || 0;
        }

        gastosAgrupados[categoria].total += montoReal;
        gastosAgrupados[categoria].cantidad += 1;

        console.log("📈 Gasto agregado a categoría:", {
          categoria,
          montoReal,
          totalAcumulado: gastosAgrupados[categoria].total,
        });

        // Agregar detalles para salarios
        if (gasto.categoria === "Salario") {
          gastosAgrupados[categoria].detalles?.push({
            nombre: gasto.nombre,
            monto: montoReal,
            es_porcentaje: !!(gasto.porcentaje && gasto.porcentaje > 0),
            porcentaje: gasto.porcentaje,
            descripcion: gasto.descripcion,
          });
        }
      }

      const resultadoEnriquecido = Object.values(
        gastosAgrupados,
      ) as GastoPorCategoria[];
      console.log("✅ Gastos por categoría obtenidos:", resultadoEnriquecido);
      return resultadoEnriquecido;
    } catch (error) {
      console.error("❌ Error obteniendo gastos por categoría:", error);
      return [];
    }
  }, [puntoId, tipoPeriodo, fechaInicio, fechaFin]);

  // Cargar datos iniciales
  const cargarDatosIniciales = useCallback(async () => {
    try {
      console.log("🔄 Iniciando cargarDatosIniciales...");
      setLoading(true);

      console.log("📊 Cargando datos en paralelo...");
      // Cargar datos en paralelo
      await Promise.all([
        get_ganancia_actual().then((g) => {
          console.log("✅ Ganancia bruta cargada:", g);
          setGananciaBruta(g);
        }),
        get_producto_mas_vendido().then((p) => {
          console.log("✅ Productos más vendidos cargados:", p.length);
          setProductosMasVendidos(p);
        }),
        get_producto_menos_vendido().then((p) => {
          console.log("✅ Productos menos vendidos cargados:", p.length);
          setProductosMenosVendidos(p);
        }),
        get_gastos_por_categoria().then((g) => {
          console.log("✅ Gastos por categoría cargados:", g.length);
          setGastosPorCategoria(g);
        }),
      ]);

      // Manejar productos todos vendidos por separado
      const resultado = await get_productos_todos_vendidos(1, 10);
      if (Array.isArray(resultado)) {
        // Si devuelve un array directamente (caso antiguo)
        setProductosTodosVendidos(resultado);
        setTotalProductos(resultado.length);
      } else if (resultado && resultado.productos) {
        // Si devuelve un objeto con productos y total
        setProductosTodosVendidos(resultado.productos);
        setTotalProductos(resultado.total);
      } else {
        // Si no hay datos
        setProductosTodosVendidos([]);
        setTotalProductos(0);
      }
      console.log("🎉 Todos los datos cargados exitosamente");
    } catch (error) {
      console.error("Error cargando datos iniciales:", error);
      Alert.alert("Error", "No se pudieron cargar los datos iniciales");
    } finally {
      setLoading(false);
    }
  }, [
    get_ganancia_actual,
    get_producto_mas_vendido,
    get_producto_menos_vendido,
    get_gastos_por_categoria,
    get_productos_todos_vendidos,
  ]);

  useEffect(() => {
    console.log("🔍 useEffect ejecutado, puntoId:", puntoId);
    if (puntoId && isAuthenticated) {
      console.log(
        "✅ puntoId y autenticación existen, llamando a cargarDatosIniciales",
      );
      cargarDatosIniciales();
      cargarTopesPrecios(); // Cargar topes de precios

      // Crear tabla de ajustes de inventario si no existe
      import("../src/db/services/ajustes_inventario_service")
        .then((module) => {
          const AjustesInventarioService = module.default;
          AjustesInventarioService.crearTabla().catch((error) => {
            console.error("❌ Error creando tabla ajustes_inventario:", error);
          });
        })
        .catch((error) => {
          console.error("❌ Error importando AjustesInventarioService:", error);
        });
    } else if (!isAuthenticated) {
      console.log("🔒 Esperando autenticación");
    } else {
      console.log("❌ puntoId no disponible");
    }
  }, [puntoId, isAuthenticated, cargarDatosIniciales, cargarTopesPrecios]);

  // Calcular ganancia real y total gastos cuando cambien los datos
  useEffect(() => {
    const gastos = calcularTotalGastos();
    const gananciaReal = calcularGananciaReal(gananciaBruta, gastos);

    setTotalGastos(gastos);
    setGananciaActual(gananciaReal);

    console.log("💰 Cálculo de ganancias:", {
      gananciaBruta,
      totalGastos: gastos,
      gananciaReal,
    });
  }, [
    gananciaBruta,
    gastosPorCategoria,
    calcularTotalGastos,
    calcularGananciaReal,
  ]);

  // Efecto para recargar todos los productos cuando cambia el período
  useEffect(() => {
    if (puntoId && tipoPeriodo) {
      console.log("🔄 Cambio en período, recargando todos los productos");
      setPaginaActual(1); // Resetear a la primera página
      const cargarProductos = async () => {
        const resultado = await get_productos_todos_vendidos(1, 10);
        if (Array.isArray(resultado)) {
          setProductosTodosVendidos(resultado);
          setTotalProductos(resultado.length);
        } else if (resultado && resultado.productos) {
          setProductosTodosVendidos(resultado.productos);
          setTotalProductos(resultado.total);
        } else {
          setProductosTodosVendidos([]);
          setTotalProductos(0);
        }
      };
      cargarProductos();
    }
  }, [
    puntoId,
    tipoPeriodo,
    fechaInicio,
    fechaFin,
    get_productos_todos_vendidos,
  ]);

  // Funciones para ganancias compartidas (declaradas antes de los useEffect)
  const cargarPersonasCompartidas = useCallback(async () => {
    if (!puntoId) return;

    try {
      setLoadingPersonas(true);
      console.log("🔄 Iniciando carga de personas compartidas...");

      // Importación dinámica
      const { GananciasCompartidasService } =
        await import("../src/db/services/ganancias_compartidas_service");

      // Primero asegurarse de que la tabla exista
      await GananciasCompartidasService.crearTabla();
      console.log("✅ Tabla verificada/creada");

      const personas =
        await GananciasCompartidasService.obtenerPersonas(puntoId);
      console.log("👥 Personas obtenidas:", personas);
      setPersonasCompartidas(personas);

      // Calcular distribución con la ganancia actual (incluso si es 0)
      if (personas.length > 0) {
        console.log(
          "💰 Calculando distribución para ganancia:",
          gananciaActual,
        );
        const distribucion =
          await GananciasCompartidasService.calcularDistribucion(
            puntoId,
            gananciaActual,
          );
        console.log("📊 Distribución calculada:", distribucion);
        setDistribucionGanancias(distribucion.distribuciones);
        setTotalUsuario(distribucion.totalUsuario);
      } else {
        console.log("📭 No hay personas configuradas, limpiando distribución");
        setDistribucionGanancias([]);
        setTotalUsuario(gananciaActual);
      }
    } catch (error) {
      console.error("❌ Error cargando personas compartidas:", error);
      // En caso de error, limpiar los estados para evitar problemas
      setPersonasCompartidas([]);
      setDistribucionGanancias([]);
      setTotalUsuario(gananciaActual);
    } finally {
      setLoadingPersonas(false);
    }
  }, [puntoId, gananciaActual]);

  // Cargar personas compartidas cuando cambia la ganancia
  useEffect(() => {
    // Cargar personas siempre si hay puntoId (independientemente de si hay ganancias)
    if (puntoId) {
      console.log("🔄 Cargando personas compartidas (puntoId existe)");
      cargarPersonasCompartidas();
    } else {
      console.log("📭 Sin puntoId, limpiando personas compartidas");
      setPersonasCompartidas([]);
      setDistribucionGanancias([]);
      setTotalUsuario(gananciaActual);
    }
  }, [gananciaActual, puntoId, cargarPersonasCompartidas]);

  // Función para cargar datos del día actual (misma lógica que cambiarDia)
  const cargarDiaActual = useCallback(() => {
    console.log("🔍 DEBUG cargarDiaActual:", {
      añoActual,
      mesActual,
      diaActual,
      puntoId,
    });

    const fechaStr = `${añoActual}-${(mesActual + 1).toString().padStart(2, "0")}-${diaActual.toString().padStart(2, "0")}`;
    console.log(
      "🔍 DEBUG cargarDiaActual - llamando obtenerDatosIPVFecha con:",
      fechaStr,
    );
    const dias = obtenerDiasDelMes();
    setDiasDelMes(dias);

    // No cargar datos automáticamente, esperar a que el usuario seleccione un día
    console.log(
      "🔍 DEBUG useEffect - tabla IPV oculta, esperando selección de día",
    );
  }, [añoActual, mesActual, diaActual, obtenerDiasDelMes]);

  const get_ganancia_periodo = async (fechaInicio?: Date, fechaFin?: Date) => {
    try {
      let inicio: string;
      let fin: string;

      console.log("🔍 DEBUG get_ganancia_periodo:", {
        fechaInicioRecibida: fechaInicio,
        fechaFinRecibida: fechaFin,
        tipoPeriodoActual: tipoPeriodo,
      });

      console.log("🔍 DEBUG get_ganancia_periodo:", {
        fechaInicioRecibida: fechaInicio,
        fechaFinRecibida: fechaFin,
        tipoPeriodoActual: tipoPeriodo,
      });

      if (fechaInicio && fechaFin) {
        // Usar fechas proporcionadas (período personalizado)
        inicio = fechaInicio.toISOString().split("T")[0];
        fin = fechaFin.toISOString().split("T")[0];
        console.log("📅 Usando fechas personalizadas:", { inicio, fin });
      } else {
        // Calcular fechas según el tipo de período actual
        const hoy = new Date();

        if (tipoPeriodo === "dia") {
          inicio = fin = getFechaLocal();
        } else if (tipoPeriodo === "semana") {
          const semanaInicio = new Date(
            hoy.getTime() - 7 * 24 * 60 * 60 * 1000,
          );
          inicio = getFechaLocal();
          fin = getFechaLocal();
        } else if (tipoPeriodo === "mes") {
          const mesInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
          inicio = getFechaLocal();
          fin = getFechaLocal();
        } else {
          // Si no hay período definido, usar hoy por defecto
          inicio = fin = getFechaLocal();
        }
        console.log("📅 Usando fechas calculadas automáticamente:", {
          inicio,
          fin,
          tipoPeriodo,
        });
      }

      // Obtener ganancia bruta del período (incluyendo pagos de deuda)
      const gananciaBrutaResult = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (COALESCE(p.precio_coste, 0) * dv.cantidad)), 0) as ganancias_periodo
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         LEFT JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
         AND DATE(v.creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );

      const gananciaBruta = gananciaBrutaResult || 0;

      // Obtener gastos del período
      try {
        const { GastoService } =
          await import("../src/db/services/gasto_service");
        const gastosDelPeriodo = await GastoService.obtenerGastosPorPeriodo(
          puntoId!,
          "periodo",
          inicio,
          fin,
        );

        // Calcular total de gastos
        const gastosConMontos = await Promise.all(
          gastosDelPeriodo.map(async (gasto: any) => {
            let montoReal = gasto.precio;
            // Si es salario porcentual, calcular monto real basado en ganancias del período y restar consumos propios
            if (
              gasto.categoria === "Salario" &&
              gasto.porcentaje &&
              gasto.porcentaje > 0
            ) {
              // Obtener ventas del período para este trabajador específico
              const ventasTrabajador =
                await GastoService.obtenerVentasTrabajadorPeriodo(
                  puntoId!,
                  gasto.id!, // Pasar el ID del trabajador específico
                  "periodo",
                  inicio,
                  fin,
                );

              const salarioTeorico =
                (ventasTrabajador * gasto.porcentaje) / 100;

              // Obtener consumos propios del trabajador
              const consumosPropios =
                await GastoService.obtenerConsumosPropiosPeriodo(
                  puntoId!,
                  gasto.nombre || "Sin nombre",
                  "periodo",
                  inicio,
                  fin,
                );

              // Calcular salario final: teórico - consumos del período
              montoReal = salarioTeorico - consumosPropios;
            }
            return {
              ...gasto,
              montoReal,
            };
          }),
        );

        const totalGastosPeriodo = gastosConMontos.reduce(
          (total, gasto) => total + gasto.montoReal,
          0,
        );

        // Retornar ganancia real (ganancia bruta - gastos)
        return gananciaBruta - totalGastosPeriodo; // Permitir valores negativos
      } catch (error) {
        console.error("Error obteniendo gastos del período:", error);
        // Si hay error obteniendo gastos, retornar ganancia bruta
        return gananciaBruta;
      }
    } catch (error) {
      console.error("Error obteniendo ganancia del periodo:", error);
      return 0;
    }
  };

  const get_ventas_periodo = async (fechaInicio?: Date, fechaFin?: Date) => {
    try {
      let inicio: string;
      let fin: string;

      if (fechaInicio && fechaFin) {
        // Usar fechas proporcionadas (período personalizado)
        inicio = fechaInicio.toISOString().split("T")[0];
        fin = fechaFin.toISOString().split("T")[0];
      } else {
        // Calcular fechas según el tipo de período actual
        const hoy = new Date();

        if (tipoPeriodo === "dia") {
          inicio = fin = getFechaLocal();
        } else if (tipoPeriodo === "semana") {
          const semanaInicio = new Date(
            hoy.getTime() - 7 * 24 * 60 * 60 * 1000,
          );
          inicio = semanaInicio.toISOString().split("T")[0];
          fin = getFechaLocal();
        } else if (tipoPeriodo === "mes") {
          const mesInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
          inicio = mesInicio.toISOString().split("T")[0];
          fin = getFechaLocal();
        } else {
          // Si no hay período definido, usar hoy por defecto
          inicio = fin = getFechaLocal();
        }
      }

      // Obtener ventas totales del período
      const ventasResult = await getSingleValue<number>(
        `SELECT COALESCE(SUM(total_venta), 0) as ventas_periodo
         FROM Venta 
         WHERE punto_id = ? 
         AND DATE(creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );

      const ventas = ventasResult || 0;
      console.log(`📊 DEBUG get_ventas_periodo:`, {
        tipo: tipoPeriodo,
        inicio,
        fin,
        ventas,
      });

      return ventas;
    } catch (error) {
      console.error("Error obteniendo ventas del periodo:", error);
      return 0;
    }
  };

  const get_comparacion_ganancia = async (
    periodo1Inicio: Date,
    periodo1Fin: Date,
    periodo2Inicio: Date,
    periodo2Fin: Date,
    tipo: "ganancias" | "ventas" = "ganancias",
  ) => {
    try {
      const [valor1, valor2] = await Promise.all([
        tipo === "ganancias"
          ? get_ganancia_periodo(periodo1Inicio, periodo1Fin)
          : get_ventas_periodo(periodo1Inicio, periodo1Fin),
        tipo === "ganancias"
          ? get_ganancia_periodo(periodo2Inicio, periodo2Fin)
          : get_ventas_periodo(periodo2Inicio, periodo2Fin),
      ]);

      const diferencia = valor2 - valor1;
      const porcentaje = valor1 !== 0 ? (diferencia / valor1) * 100 : 0;

      return {
        periodo1: {
          inicio: periodo1Inicio.toISOString().split("T")[0],
          fin: periodo1Fin.toISOString().split("T")[0],
          ganancias: tipo === "ganancias" ? valor1 : 0,
          ventas: tipo === "ventas" ? valor1 : undefined,
        },
        periodo2: {
          inicio: periodo2Inicio.toISOString().split("T")[0],
          fin: periodo2Fin.toISOString().split("T")[0],
          ganancias: tipo === "ganancias" ? valor2 : 0,
          ventas: tipo === "ventas" ? valor2 : undefined,
        },
        diferencia,
        porcentaje,
        tipoComparacion: tipo,
      };
    } catch (error) {
      console.error("Error obteniendo comparación:", error);
      return null;
    }
  };

  const cargarComparacionPeriodos = async () => {
    if (!periodo1Inicio || !periodo1Fin || !periodo2Inicio || !periodo2Fin) {
      Alert.alert("Error", "Debes seleccionar ambos periodos completos");
      return;
    }

    const comparacion = await get_comparacion_ganancia(
      periodo1Inicio,
      periodo1Fin,
      periodo2Inicio,
      periodo2Fin,
      tipoComparacion,
    );

    if (comparacion) {
      setComparacionPeriodos(comparacion);
    }
  };

  // Funciones de utilidad
  const formatearMoneda = (cantidad: number) => {
    return new Intl.NumberFormat("es-CU", {
      style: "currency",
      currency: "CUP",
    }).format(cantidad);
  };

  const crearPersonaCompartida = async () => {
    if (!puntoId || !formDataPersona.nombre.trim() || !formDataPersona.valor) {
      Alert.alert("Error", "Todos los campos son requeridos");
      return;
    }

    const valorNumerico = parseFloat(formDataPersona.valor);
    if (isNaN(valorNumerico) || valorNumerico < 0) {
      Alert.alert("Error", "El valor debe ser un número mayor o igual a 0");
      return;
    }

    if (
      formDataPersona.tipo_comparticion === "porcentaje" &&
      valorNumerico > 100
    ) {
      Alert.alert("Error", "El porcentaje no puede ser mayor a 100");
      return;
    }

    try {
      // Importación dinámica
      const { GananciasCompartidasService } =
        await import("../src/db/services/ganancias_compartidas_service");

      // Validar que la suma de porcentajes no exceda 100%
      if (formDataPersona.tipo_comparticion === "porcentaje") {
        const totalPorcentajesExistentes =
          await GananciasCompartidasService.calcularTotalPorcentajes(puntoId);
        const totalConNuevoPorcentaje =
          totalPorcentajesExistentes + valorNumerico;

        if (totalConNuevoPorcentaje > 100) {
          const porcentajeDisponible = 100 - totalPorcentajesExistentes;
          Alert.alert(
            "Error",
            `La suma de porcentajes no puede exceder el 100%.\n\n` +
              `Porcentajes existentes: ${totalPorcentajesExistentes}%\n` +
              `Porcentaje a agregar: ${valorNumerico}%\n` +
              `Total: ${totalConNuevoPorcentaje}%\n\n` +
              `Porcentaje máximo disponible: ${porcentajeDisponible}%`,
          );
          return;
        }
      }

      const resultado = await GananciasCompartidasService.crearPersona(
        puntoId,
        formDataPersona.nombre.trim(),
        formDataPersona.tipo_comparticion,
        valorNumerico,
      );

      if (resultado.success) {
        Alert.alert("Éxito", resultado.message);
        setMostrarFormNuevaPersona(false);
        setFormDataPersona({
          nombre: "",
          tipo_comparticion: "porcentaje",
          valor: "",
        });
        cargarPersonasCompartidas();
      } else {
        Alert.alert("Error", resultado.message);
      }
    } catch (error) {
      console.error("Error creando persona compartida:", error);
      Alert.alert("Error", "No se pudo crear la persona");
    }
  };

  const eliminarPersonaCompartida = async (id: number, nombre: string) => {
    Alert.alert(
      "Confirmar",
      `¿Estás seguro de eliminar a "${nombre}" de las ganancias compartidas?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Importación dinámica
              const { GananciasCompartidasService } =
                await import("../src/db/services/ganancias_compartidas_service");
              const resultado =
                await GananciasCompartidasService.eliminarPersona(id);
              if (resultado.success) {
                Alert.alert("Éxito", resultado.message);
                cargarPersonasCompartidas();
              } else {
                Alert.alert("Error", resultado.message);
              }
            } catch (error) {
              console.error("Error eliminando persona compartida:", error);
              Alert.alert("Error", "No se pudo eliminar la persona");
            }
          },
        },
      ],
    );
  };

  const abrirModalEditarPersona = (persona: PersonaGananciaCompartida) => {
    setPersonaEditando(persona);
    setFormDataEditPersona({
      nombre: persona.nombre,
      tipo_comparticion: persona.tipo_comparticion,
      valor: persona.valor.toString(),
    });
    setMostrarModalEditarPersona(true);
  };

  const cerrarModalEditarPersona = () => {
    setMostrarModalEditarPersona(false);
    setPersonaEditando(null);
    setFormDataEditPersona({
      nombre: "",
      tipo_comparticion: "porcentaje",
      valor: "",
    });
  };

  const actualizarPersonaCompartida = async () => {
    if (!personaEditando) return;

    // Validar datos
    if (!formDataEditPersona.nombre.trim()) {
      Alert.alert("Error", "El nombre es requerido");
      return;
    }

    if (!formDataEditPersona.valor.trim()) {
      Alert.alert("Error", "El valor es requerido");
      return;
    }

    const valorNumerico = parseFloat(formDataEditPersona.valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      Alert.alert("Error", "El valor debe ser un número mayor a 0");
      return;
    }

    if (
      formDataEditPersona.tipo_comparticion === "porcentaje" &&
      valorNumerico > 100
    ) {
      Alert.alert("Error", "El porcentaje no puede ser mayor a 100");
      return;
    }

    try {
      const { GananciasCompartidasService } =
        await import("../src/db/services/ganancias_compartidas_service");

      // Validar que la suma de porcentajes no exceda 100%
      if (formDataEditPersona.tipo_comparticion === "porcentaje") {
        const totalPorcentajesExistentes =
          await GananciasCompartidasService.calcularTotalPorcentajes(puntoId!);
        // Restar el porcentaje actual de la persona que se está editando
        const totalSinPersonaActual =
          totalPorcentajesExistentes - personaEditando.valor;
        const totalConNuevoPorcentaje = totalSinPersonaActual + valorNumerico;

        if (totalConNuevoPorcentaje > 100) {
          const porcentajeDisponible = 100 - totalSinPersonaActual;
          Alert.alert(
            "Error",
            `La suma de porcentajes no puede exceder el 100%.\n\n` +
              `Porcentajes de otras personas: ${totalSinPersonaActual}%\n` +
              `Nuevo porcentaje para ${personaEditando.nombre}: ${valorNumerico}%\n` +
              `Total: ${totalConNuevoPorcentaje}%\n\n` +
              `Porcentaje máximo disponible para ${personaEditando.nombre}: ${porcentajeDisponible}%`,
          );
          return;
        }
      }

      const resultado = await GananciasCompartidasService.actualizarPersona(
        personaEditando.id!,
        formDataEditPersona.nombre.trim(),
        formDataEditPersona.tipo_comparticion,
        valorNumerico,
      );

      if (resultado.success) {
        Alert.alert("Éxito", resultado.message);
        cerrarModalEditarPersona();
        cargarPersonasCompartidas();
      } else {
        Alert.alert("Error", resultado.message);
      }
    } catch (error) {
      console.error("Error actualizando persona compartida:", error);
      Alert.alert("Error", "No se pudo actualizar la persona");
    }
  };

  const establecerPeriodoPredefinido = async (
    tipo: "dia" | "semana" | "mes",
  ) => {
    const hoy = new Date();
    let inicio: Date;
    let fin: Date = hoy;

    switch (tipo) {
      case "dia":
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        break;
      case "semana":
        inicio = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "mes":
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        break;
    }

    // Agrupar todas las actualizaciones de estado para evitar múltiples re-renderizados
    setTimeout(() => {
      setFechaInicio(inicio);
      setFechaFin(fin);
      setTipoPeriodo(tipo);
    }, 0);
  };

  // Función para manejar la activación/desactivación de filtros
  const togglePeriodo = (tipo: "dia" | "semana" | "mes" | "personalizado") => {
    if (tipoPeriodo === tipo) {
      // Si el filtro ya está activo, desactivarlo
      setTipoPeriodo(null);
      setFechaInicio(null);
      setFechaFin(null);
    } else {
      // Si no está activo o es otro filtro, activar este
      if (tipo !== "personalizado") {
        establecerPeriodoPredefinido(tipo);
      } else {
        // Para personalizado, solo establecer el tipo sin fechas
        setTipoPeriodo("personalizado");
      }
    }
  };

  const calcularGananciaPeriodoActual = async () => {
    // Validar que haya un período seleccionado
    if (!tipoPeriodo) {
      Alert.alert("Error", "Debes seleccionar un período primero");
      return;
    }

    console.log("🔍 DEBUG calcularGananciaPeriodoActual:", {
      tipoPeriodo,
      fechaInicio,
      fechaFin,
    });

    // Para período personalizado, validar que ambas fechas estén seleccionadas
    if (tipoPeriodo === "personalizado") {
      if (!fechaInicio || !fechaFin) {
        Alert.alert(
          "Error",
          "Debes seleccionar ambas fechas para el período personalizado",
        );
        return;
      }
    }

    // Para períodos predefinidos, las fechas se calculan automáticamente
    let inicio: Date | undefined;
    let fin: Date | undefined;

    if (tipoPeriodo === "personalizado") {
      inicio = fechaInicio!;
      fin = fechaFin!;
      console.log("📅 DEBUG Enviando fechas personalizadas:", { inicio, fin });
    }
    // Para otros períodos, no se pasan fechas (se calculan internamente)

    try {
      const ganancia = await get_ganancia_periodo(inicio, fin);
      console.log("💰 DEBUG Ganancia calculada:", ganancia);
      setGananciaPeriodo(ganancia);
      setGananciaActual(ganancia);

      // Recargar productos para que se actualicen según el período seleccionado
      const [masVendidos, menosVendidos, gastos, todosProductos] =
        await Promise.all([
          get_producto_mas_vendido(),
          get_producto_menos_vendido(),
          get_gastos_por_categoria(),
          get_productos_todos_vendidos(1, 10),
        ]);
      setProductosMasVendidos(masVendidos);
      setProductosMenosVendidos(menosVendidos);
      setGastosPorCategoria(gastos);
      setPaginaActual(1); // Resetear paginación

      // Cerrar el modal automáticamente después de calcular
      setMostrarModalPeriodo(false);

      console.log("✅ Período calculado exitosamente:", {
        tipoPeriodo,
        ganancia,
        fechas: { inicio, fin },
      });
    } catch (error) {
      console.error("Error calculando ganancia del período:", error);
      Alert.alert("Error", "No se pudo calcular las ganancias del período");
    }
  };

  // Funciones wrapper para actualizar el estado cuando se presionan los botones de refresh
  const refreshProductosMasVendidos = async () => {
    const productos = await get_producto_mas_vendido();
    setProductosMasVendidos(productos);
  };

  const refreshProductosMenosVendidos = async () => {
    const productos = await get_producto_menos_vendido();
    setProductosMenosVendidos(productos);
  };

  const refreshGastosPorCategoria = async () => {
    const gastos = await get_gastos_por_categoria();
    setGastosPorCategoria(gastos);
  };

  const refreshProductosTodosVendidos = async () => {
    const resultado = await get_productos_todos_vendidos(paginaActual, 10);
    if (Array.isArray(resultado)) {
      setProductosTodosVendidos(resultado);
      setTotalProductos(resultado.length);
    } else if (resultado && resultado.productos) {
      setProductosTodosVendidos(resultado.productos);
      setTotalProductos(resultado.total);
    } else {
      setProductosTodosVendidos([]);
      setTotalProductos(0);
    }
  };

  const cargarPaginaAnterior = async () => {
    if (paginaActual > 1) {
      const nuevaPagina = paginaActual - 1;
      setPaginaActual(nuevaPagina);
      const resultado = await get_productos_todos_vendidos(nuevaPagina, 10);
      if (Array.isArray(resultado)) {
        setProductosTodosVendidos(resultado);
        setTotalProductos(resultado.length);
      } else if (resultado && resultado.productos) {
        setProductosTodosVendidos(resultado.productos);
        setTotalProductos(resultado.total);
      } else {
        setProductosTodosVendidos([]);
        setTotalProductos(0);
      }
    }
  };

  const cargarPaginaSiguiente = async () => {
    const maxPagina = Math.ceil(totalProductos / 10);
    if (paginaActual < maxPagina) {
      const nuevaPagina = paginaActual + 1;
      setPaginaActual(nuevaPagina);
      const resultado = await get_productos_todos_vendidos(nuevaPagina, 10);
      if (Array.isArray(resultado)) {
        setProductosTodosVendidos(resultado);
        setTotalProductos(resultado.length);
      } else if (resultado && resultado.productos) {
        setProductosTodosVendidos(resultado.productos);
        setTotalProductos(resultado.total);
      } else {
        setProductosTodosVendidos([]);
        setTotalProductos(0);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarDatosIniciales();
    setRefreshing(false);
  };

  // Renderizado
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>
            {modoVista === "ganancias" ? "Ganancias" : "IPV"}
          </Text>
          <Text style={styles.subtitle}>{puntoNombre}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setMostrarModalGananciasCompartidas(true)}
          style={styles.refreshButton}
        >
          <Ionicons name="people-outline" size={20} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* Botones de modo Ganancias/IPV */}
      <View style={styles.modoFilter}>
        <TouchableOpacity
          style={[
            styles.modoButton,
            modoVista === "ganancias" && styles.modoButtonActive,
          ]}
          onPress={() => {
            setModoVista("ganancias");
          }}
        >
          <View style={styles.modoButtonContent}>
            <Ionicons
              name="trending-up-outline"
              size={20}
              color={modoVista === "ganancias" ? "#fff" : "#007AFF"}
            />
            <Text
              style={[
                styles.modoButtonText,
                modoVista === "ganancias" && styles.modoButtonTextActive,
              ]}
            >
              Ganancias
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modoButton,
            modoVista === "ipv" && styles.modoButtonActive,
          ]}
          onPress={() => {
            setModoVista("ipv");
            const fechaHoy = getFechaLocal();
            obtenerDatosIPVFecha(fechaHoy);
          }}
        >
          <View style={styles.modoButtonContent}>
            <Ionicons
              name="cube-outline"
              size={20}
              color={modoVista === "ipv" ? "#fff" : "#007AFF"}
            />
            <Text
              style={[
                styles.modoButtonText,
                modoVista === "ipv" && styles.modoButtonTextActive,
              ]}
            >
              IPV
            </Text>
          </View>
        </TouchableOpacity>

        {/* Indicador de estado de reducción - solo visible en modo IPV */}
        {modoVista === "ipv" && (
          <View style={styles.filtroDatosContainer}>
            <View style={styles.indicadorEstado}>
              <Ionicons
                name={tieneReduccionAplicada ? "trending-down" : "bar-chart"}
                size={16}
                color={tieneReduccionAplicada ? "#dc2626" : "#059669"}
              />
              <Text style={styles.indicadorTexto}>
                {tieneReduccionAplicada ? "Reducción Aplicada" : "Datos Reales"}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderGananciaActual = () => {
    // Determinar el título según el período seleccionado
    let titulo = "Ganancias";
    let subtitulo = "Total ganado después de gastos";

    if (tipoPeriodo === "dia") {
      titulo = "Ganancias de Hoy";
      subtitulo = "Ganancia real después de gastos";
    } else if (tipoPeriodo === "semana") {
      titulo = "Ganancias de la Última Semana";
      subtitulo = "Ganancia real después de gastos";
    } else if (tipoPeriodo === "mes") {
      titulo = "Ganancias de Este Mes";
      subtitulo = "Ganancia real después de gastos";
    } else if (tipoPeriodo === "personalizado") {
      titulo = "Ganancias del Período";
      subtitulo = `Ganancia real (${fechaInicio?.toLocaleDateString()} - ${fechaFin?.toLocaleDateString()})`;
    } else if (tipoPeriodo === null) {
      titulo = "Ganancias";
      subtitulo = "Selecciona un período para ver ganancias específicas";
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="trending-up" size={24} color="#10b981" />
          <Text style={styles.cardTitle}>{titulo}</Text>
        </View>

        {/* Ganancia Real (después de gastos) */}
        <Text
          style={[
            styles.gananciaActual,
            gananciaActual < 0 && styles.gananciaNegativa,
          ]}
        >
          {gananciaActual < 0 ? "-" : ""}
          {formatearMoneda(Math.abs(gananciaActual))}
        </Text>
        <Text style={styles.cardSubtitle}>{subtitulo}</Text>

        {/* Desglose de ganancias con distribución */}
        <View style={styles.gananciaDesglose}>
          <View style={styles.gananciaItem}>
            <Text style={styles.gananciaItemLabel}>Ganancia Bruta:</Text>
            <Text style={styles.gananciaItemValue}>
              {formatearMoneda(gananciaBruta)}
            </Text>
          </View>
          <View style={[styles.gananciaItem, styles.gananciaItemGastos]}>
            <Text style={styles.gananciaItemLabel}>Gastos:</Text>
            <Text style={[styles.gananciaItemValue, styles.gastosValue]}>
              {formatearMoneda(totalGastos)}
            </Text>
          </View>

          {/* Mostrar distribución de ganancias si hay personas configuradas */}
          {personasCompartidas.length > 0 && (
            <View style={styles.distribucionContainer}>
              <Text style={styles.distribucionTitle}>
                Distribución de Ganancias:
              </Text>
              {distribucionGanancias.map((dist, index) => (
                <View key={index} style={styles.distribucionItem}>
                  <Text style={styles.distribucionPersona}>
                    {dist.persona.nombre}:
                  </Text>
                  <Text style={styles.distribucionMonto}>
                    {formatearMoneda(dist.monto_a_recibir)}
                  </Text>
                </View>
              ))}
              <View style={[styles.distribucionItem, styles.distribucionTotal]}>
                <Text style={styles.distribucionPersona}>Para ti:</Text>
                <Text
                  style={[
                    styles.distribucionMonto,
                    totalUsuario < 0 && styles.distribucionNegativa,
                  ]}
                >
                  {totalUsuario < 0 ? "-" : ""}
                  {formatearMoneda(Math.abs(totalUsuario))}
                </Text>
              </View>
            </View>
          )}

          {/* Si no hay personas configuradas, mostrar ganancia normal */}
          {personasCompartidas.length === 0 && (
            <View style={[styles.gananciaItem, styles.gananciaItemTotal]}>
              <Text style={styles.gananciaItemLabelTotal}>Ganancia Real:</Text>
              <Text
                style={[
                  styles.gananciaItemValueTotal,
                  gananciaActual < 0 && styles.gananciaNegativa,
                ]}
              >
                {gananciaActual < 0 ? "-" : ""}
                {formatearMoneda(Math.abs(gananciaActual))}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderProductosVendidos = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Productos Más Vendidos</Text>
        <TouchableOpacity onPress={refreshProductosMasVendidos}>
          <Ionicons name="refresh" size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {productosMasVendidos.length > 0 ? (
        productosMasVendidos.map((producto, index) => (
          <View key={index} style={styles.productoItem}>
            <View style={styles.productoInfo}>
              <Text style={styles.productoNombre}>{producto.nombre}</Text>
              <Text style={styles.productoCategoria}>{producto.categoria}</Text>
            </View>
            <View style={styles.productoStats}>
              <Text style={styles.productoCantidad}>
                {producto.cantidad_vendida} uds
              </Text>
              <Text style={styles.productoTotal}>
                {formatearMoneda(producto.total_vendido)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No hay ventas hoy</Text>
      )}
    </View>
  );

  const renderProductosMenosVendidos = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Productos Menos Vendidos</Text>
        <TouchableOpacity onPress={refreshProductosMenosVendidos}>
          <Ionicons name="refresh" size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {productosMenosVendidos.length > 0 ? (
        productosMenosVendidos.map((producto, index) => (
          <View key={index} style={styles.productoItem}>
            <View style={styles.productoInfo}>
              <Text style={styles.productoNombre}>{producto.nombre}</Text>
              <Text style={styles.productoCategoria}>{producto.categoria}</Text>
            </View>
            <View style={styles.productoStats}>
              <Text style={styles.productoCantidad}>
                {producto.cantidad_vendida} uds
              </Text>
              <Text style={styles.productoTotal}>
                {formatearMoneda(producto.total_vendido)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No hay ventas hoy</Text>
      )}
    </View>
  );

  const renderProductosTodosVendidos = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Todos los Productos Vendidos</Text>
        <TouchableOpacity onPress={refreshProductosTodosVendidos}>
          <Ionicons name="refresh" size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {loadingTodosProductos ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      ) : productosTodosVendidos.length > 0 ? (
        <>
          {productosTodosVendidos.map((producto, index) => (
            <View key={index} style={styles.productoItem}>
              <View style={styles.productoInfo}>
                <Text style={styles.productoNombre}>{producto.nombre}</Text>
                <Text style={styles.productoCategoria}>
                  {producto.categoria}
                </Text>
              </View>
              <View style={styles.productoStats}>
                <Text style={styles.productoCantidad}>
                  {producto.cantidad_vendida} uds
                </Text>
                <Text style={styles.productoTotal}>
                  {formatearMoneda(producto.total_vendido)}
                </Text>
              </View>
            </View>
          ))}

          {/* Paginación */}
          {totalProductos > 10 && (
            <View style={styles.paginacionContainer}>
              <TouchableOpacity
                style={[
                  styles.paginacionButton,
                  paginaActual === 1 && styles.paginacionButtonDisabled,
                ]}
                onPress={cargarPaginaAnterior}
                disabled={paginaActual === 1}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={paginaActual === 1 ? "#9ca3af" : "#3b82f6"}
                />
                <Text
                  style={[
                    styles.paginacionButtonText,
                    paginaActual === 1 && styles.paginacionButtonTextDisabled,
                  ]}
                >
                  Anterior
                </Text>
              </TouchableOpacity>

              <Text style={styles.paginacionInfo}>
                Página {paginaActual} de {Math.ceil(totalProductos / 10)}
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginacionButton,
                  paginaActual === Math.ceil(totalProductos / 10) &&
                    styles.paginacionButtonDisabled,
                ]}
                onPress={cargarPaginaSiguiente}
                disabled={paginaActual === Math.ceil(totalProductos / 10)}
              >
                <Text
                  style={[
                    styles.paginacionButtonText,
                    paginaActual === Math.ceil(totalProductos / 10) &&
                      styles.paginacionButtonTextDisabled,
                  ]}
                >
                  Siguiente
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={
                    paginaActual === Math.ceil(totalProductos / 10)
                      ? "#9ca3af"
                      : "#3b82f6"
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <Text style={styles.emptyText}>No hay ventas en este período</Text>
      )}
    </View>
  );

  // Función para renderizar la barra de herramientas IPV
  const renderIPVToolbar = () => {
    return (
      <View style={styles.ipvToolbarContainer}>
        <Text style={styles.ipvToolbarTitle}>Herramientas IPV</Text>
        <View style={styles.ipvToolbarButtons}>
          {/* Botón de reducción */}
          <TouchableOpacity
            style={[styles.ipvToolbarButton, styles.ipvToolbarButtonSecondary]}
            onPress={() => setMostrarModalReductor(true)}
          >
            <Ionicons
              name="trending-down"
              size={20}
              color="white"
              style={styles.ipvToolbarButtonIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ipvToolbarButton, styles.ipvToolbarButtonPDF]}
            onPress={() => setMostrarModalPeriodoPDF(true)}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <ActivityIndicator
                size="small"
                color="white"
                style={styles.ipvToolbarButtonIcon}
              />
            ) : (
              <Ionicons
                name="document-text"
                size={20}
                color="white"
                style={styles.ipvToolbarButtonIcon}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ipvToolbarButton, styles.ipvToolbarButtonTopes]}
            onPress={() => setMostrarModalTopes(true)}
          >
            <Ionicons
              name="pricetag"
              size={20}
              color="white"
              style={styles.ipvToolbarButtonIcon}
            />
          </TouchableOpacity>

          {/* Botón para limpiar reducción */}
          <TouchableOpacity
            style={[styles.ipvToolbarButton, styles.ipvToolbarButtonClear]}
            onPress={limpiarReduccion}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color="white"
              style={styles.ipvToolbarButtonIcon}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Función para renderizar el IPV
  const renderIPV = () => {
    // Calcular totalVentas siempre que haya datos
    const totalVentas = datosIPVMostrados
      .filter(
        (producto) => (producto.inicio || 0) > 0 || (producto.entro || 0) > 0,
      )
      .reduce((sum, producto) => {
        // Si hay tope aplicado, usar precio con tope
        const precioConTope =
          topesPrecios[producto.producto] &&
          topesPrecios[producto.producto] < producto.precio
            ? topesPrecios[producto.producto]
            : null;

        // Si hay tope, calcular con precio con tope, sino usar monto_vendido real (que ya incluye ofertas)
        const montoFinal = precioConTope
          ? (producto.vendio || 0) * precioConTope
          : producto.monto_vendido || 0;

        return sum + montoFinal;
      }, 0);

    return (
      <View style={styles.ipvContainer}>
        {/* Card de Navegación */}
        <View style={styles.navigationCard}>
          {/* Paginación de meses */}
          <View style={styles.paginacionMesesContainer}>
            <Text style={styles.paginacionMesesTitle}>
              Navegación por meses:
            </Text>
            <View style={styles.paginacionMesesContent}>
              <TouchableOpacity
                style={styles.mesButton}
                onPress={() => cambiarMes(-1)}
              >
                <Ionicons name="chevron-back" size={20} color="#3b82f6" />
              </TouchableOpacity>
              <Text style={styles.mesActualText}>
                {obtenerNombreMes(mesActual)} {añoActual}
              </Text>
              <TouchableOpacity
                style={styles.mesButton}
                onPress={() => cambiarMes(1)}
              >
                <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.hoyButton} onPress={irHoy}>
                <Text style={styles.hoyButtonText}>Hoy</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Paginación de días */}
          <View style={styles.paginacionDiasContainer}>
            <Text style={styles.paginacionDiasTitle}>Navegación por días:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.paginacionDiasScroll}
              contentContainerStyle={styles.paginacionDiasContent}
            >
              {obtenerDiasDelMes().map((dia) => (
                <TouchableOpacity
                  key={dia}
                  style={[
                    styles.diaButton,
                    dia === diaActual && styles.diaButtonActive,
                  ]}
                  onPress={() => cambiarDia(dia)}
                >
                  <Text
                    style={[
                      styles.diaButtonText,
                      dia === diaActual && styles.diaButtonTextActive,
                    ]}
                  >
                    {dia}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Card de Tabla IPV */}
        <View style={styles.tableCard}>
          {diaActual === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyStateText}>
                Selecciona un día para ver el inventario
              </Text>
            </View>
          ) : loadingIPV ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Cargando datos del IPV...</Text>
            </View>
          ) : (
            // Tabla IPV cuando hay día seleccionado
            <View>
              {/* Cabecera de la tabla */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.colProducto]}>
                  Producto
                </Text>
                <Text style={[styles.tableHeaderText, styles.colPrecio]}>
                  Pv
                </Text>
                <Text style={[styles.tableHeaderText, styles.colCantidad]}>
                  Inicio
                </Text>
                <Text style={[styles.tableHeaderText, styles.colCantidad]}>
                  Entró
                </Text>
                <Text style={[styles.tableHeaderText, styles.colCantidad]}>
                  Vendió
                </Text>
                <Text style={[styles.tableHeaderText, styles.colCantidad]}>
                  Quedó
                </Text>
                <Text style={[styles.tableHeaderText, styles.colVendido]}>
                  Total
                </Text>
              </View>

              {/* Filas de productos */}
              <ScrollView style={styles.tableBody}>
                {datosIPVMostrados
                  .filter(
                    (producto) =>
                      (producto.inicio || 0) > 0 ||
                      (producto.entro || 0) > 0 ||
                      (producto.vendio || 0) > 0,
                  )
                  .map((producto) => (
                    <View key={producto.producto} style={styles.tableRow}>
                      <Text style={[styles.tableCellText, styles.colProducto]}>
                        {producto.producto}
                      </Text>
                      <Text style={[styles.tableCellText, styles.colPrecio]}>
                        $
                        {(topesPrecios[producto.producto] &&
                        topesPrecios[producto.producto] < producto.precio
                          ? topesPrecios[producto.producto]
                          : producto.precio
                        )?.toFixed(2) || "0.00"}
                      </Text>
                      <Text style={[styles.tableCellText, styles.colCantidad]}>
                        {producto.inicio || 0}
                      </Text>
                      <Text style={[styles.tableCellText, styles.colCantidad]}>
                        {producto.entro || 0}
                      </Text>
                      <Text style={[styles.tableCellText, styles.colCantidad]}>
                        {producto.vendio || 0}
                      </Text>
                      <Text style={[styles.tableCellText, styles.colCantidad]}>
                        {producto.quedo_visual !== undefined
                          ? producto.quedo_visual
                          : producto.quedo || 0}
                      </Text>
                      <Text style={[styles.tableCellText, styles.colVendido]}>
                        $
                        {(() => {
                          // Si hay tope aplicado, usar precio con tope
                          const precioConTope =
                            topesPrecios[producto.producto] &&
                            topesPrecios[producto.producto] < producto.precio
                              ? topesPrecios[producto.producto]
                              : null;

                          // Si hay tope, calcular con precio con tope, sino usar monto_vendido real
                          const montoFinal = precioConTope
                            ? (producto.vendio || 0) * precioConTope
                            : producto.monto_vendido || 0;

                          return montoFinal.toFixed(2) || "0.00";
                        })()}
                      </Text>
                    </View>
                  ))}
              </ScrollView>

              {/* Total */}
              {datosIPVMostrados.filter(
                (producto) =>
                  (producto.inicio || 0) > 0 || (producto.entro || 0) > 0,
              ).length > 0 && (
                <View style={styles.totalContainer}>
                  <Text style={styles.totalLabel}>TOTAL VENTAS:</Text>
                  <Text style={[styles.totalValue, { fontWeight: "bold" }]}>
                    ${totalVentas.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderGastosPorCategoria = () => {
    if (gastosPorCategoria.length === 0) {
      return (
        <View>
          <Text>No hay gastos registrados</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Gastos por Categoría</Text>
          <TouchableOpacity onPress={refreshGastosPorCategoria}>
            <Ionicons name="refresh" size={20} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {gastosPorCategoria.map((categoria, index) => (
          <View key={index} style={styles.categoriaCard}>
            <View style={styles.categoriaHeader}>
              <View style={styles.categoriaInfo}>
                <Text style={styles.categoriaNombre}>
                  {categoria.categoria.charAt(0).toUpperCase() +
                    categoria.categoria.slice(1)}
                </Text>
                <Text style={styles.categoriaStats}>
                  {categoria.cantidad}{" "}
                  {categoria.cantidad === 1 ? "gasto" : "gastos"}
                </Text>
              </View>
              <View style={styles.categoriaTotal}>
                <Text style={styles.categoriaTotalText}>
                  {formatearMoneda(categoria.total)}
                </Text>
              </View>
            </View>

            {/* Desglose para salarios */}
            {categoria.categoria === "Salario" && categoria.detalles && (
              <View style={styles.salarioDesglose}>
                <Text style={styles.desgloseTitle}>
                  Desglose por trabajador:
                </Text>
                {categoria.detalles.map((detalle, detalleIndex) => (
                  <View key={detalleIndex} style={styles.salarioItem}>
                    <View style={styles.salarioInfo}>
                      <Text style={styles.salarioNombre}>{detalle.nombre}</Text>
                      {detalle.descripcion && (
                        <Text style={styles.salarioDescripcion}>
                          {detalle.descripcion}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.salarioMonto}>
                      {formatearMoneda(detalle.monto)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderBotonesAccion = () => (
    <View style={styles.botonesContainer}>
      <TouchableOpacity
        style={styles.botonAccionMejorado}
        onPress={() => {
          establecerPeriodoPredefinido("dia");
          setMostrarModalPeriodo(true);
        }}
      >
        <View style={styles.botonContent}>
          <Ionicons name="calendar-outline" size={20} color="white" />
          <View style={styles.botonTextContainer}>
            <Text style={styles.botonTitulo}>Ganancias</Text>
            <Text style={styles.botonSubtitulo}>por período</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botonAccionMejorado}
        onPress={() => setMostrarModalComparacion(true)}
      >
        <View style={styles.botonContent}>
          <Ionicons name="bar-chart-outline" size={20} color="white" />
          <View style={styles.botonTextContainer}>
            <Text style={styles.botonTitulo}>Comparar</Text>
            <Text style={styles.botonSubtitulo}>períodos</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderModalPeriodo = () => (
    <Modal
      visible={mostrarModalPeriodo}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setMostrarModalPeriodo(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentWhite}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ganancias por Período</Text>
            <TouchableOpacity onPress={() => setMostrarModalPeriodo(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <View style={styles.periodoButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.periodoButtonMejorado,
                  tipoPeriodo === "dia" && styles.periodoButtonActive,
                ]}
                onPress={() => togglePeriodo("dia")}
              >
                <Ionicons
                  name="sunny-outline"
                  size={18}
                  color={tipoPeriodo === "dia" ? "white" : "#3b82f6"}
                />
                <Text
                  style={[
                    styles.periodoButtonTextMejorado,
                    tipoPeriodo === "dia" && styles.periodoButtonTextActive,
                  ]}
                >
                  Hoy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodoButtonMejorado,
                  tipoPeriodo === "semana" && styles.periodoButtonActive,
                ]}
                onPress={() => togglePeriodo("semana")}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={tipoPeriodo === "semana" ? "white" : "#3b82f6"}
                />
                <Text
                  style={[
                    styles.periodoButtonTextMejorado,
                    tipoPeriodo === "semana" && styles.periodoButtonTextActive,
                  ]}
                >
                  Última Semana
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodoButtonMejorado,
                  tipoPeriodo === "mes" && styles.periodoButtonActive,
                ]}
                onPress={() => togglePeriodo("mes")}
              >
                <Ionicons
                  name="calendar-number-outline"
                  size={18}
                  color={tipoPeriodo === "mes" ? "white" : "#3b82f6"}
                />
                <Text
                  style={[
                    styles.periodoButtonTextMejorado,
                    tipoPeriodo === "mes" && styles.periodoButtonTextActive,
                  ]}
                >
                  Este Mes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodoButtonMejorado,
                  tipoPeriodo === "personalizado" && styles.periodoButtonActive,
                ]}
                onPress={() => togglePeriodo("personalizado")}
              >
                <Ionicons
                  name="calendar-clear-outline"
                  size={18}
                  color={tipoPeriodo === "personalizado" ? "white" : "#3b82f6"}
                />
                <Text
                  style={[
                    styles.periodoButtonTextMejorado,
                    tipoPeriodo === "personalizado" &&
                      styles.periodoButtonTextActive,
                  ]}
                >
                  Personalizado
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>
                Fecha Inicio:{" "}
                {tipoPeriodo !== "personalizado" &&
                  "(Solo para período personalizado)"}
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  tipoPeriodo !== "personalizado" && styles.dateButtonDisabled,
                ]}
                onPress={() =>
                  tipoPeriodo === "personalizado" &&
                  setMostrarDatePickerInicio(true)
                }
                disabled={tipoPeriodo !== "personalizado"}
              >
                <Text
                  style={[
                    styles.dateText,
                    tipoPeriodo !== "personalizado" && styles.dateTextDisabled,
                  ]}
                >
                  {fechaInicio
                    ? fechaInicio.toLocaleDateString()
                    : "Seleccionar"}
                </Text>
                <Ionicons
                  name="calendar"
                  size={20}
                  color={
                    tipoPeriodo === "personalizado" ? "#3b82f6" : "#9ca3af"
                  }
                />
              </TouchableOpacity>
            </View>

            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>
                Fecha Fin:{" "}
                {tipoPeriodo !== "personalizado" &&
                  "(Solo para período personalizado)"}
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  tipoPeriodo !== "personalizado" && styles.dateButtonDisabled,
                ]}
                onPress={() =>
                  tipoPeriodo === "personalizado" &&
                  setMostrarDatePickerFin(true)
                }
                disabled={tipoPeriodo !== "personalizado"}
              >
                <Text
                  style={[
                    styles.dateText,
                    tipoPeriodo !== "personalizado" && styles.dateTextDisabled,
                  ]}
                >
                  {fechaFin ? fechaFin.toLocaleDateString() : "Seleccionar"}
                </Text>
                <Ionicons
                  name="calendar"
                  size={20}
                  color={
                    tipoPeriodo === "personalizado" ? "#3b82f6" : "#9ca3af"
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Botón "Calcular Ganancias" siempre visible */}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={calcularGananciaPeriodoActual}
            >
              <Text style={styles.modalButtonText}>Calcular Ganancias</Text>
            </TouchableOpacity>

            {mostrarDatePickerInicio && (
              <DateTimePicker
                value={fechaInicio || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePickerInicio(false);
                  if (selectedDate) setFechaInicio(selectedDate);
                }}
              />
            )}

            {mostrarDatePickerFin && (
              <DateTimePicker
                value={fechaFin || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePickerFin(false);
                  if (selectedDate) setFechaFin(selectedDate);
                }}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderModalComparacion = () => (
    <Modal
      visible={mostrarModalComparacion}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setMostrarModalComparacion(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentWhite}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comparar Períodos</Text>
            <TouchableOpacity onPress={() => setMostrarModalComparacion(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <Text style={styles.comparacionSectionTitle}>Período 1</Text>
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Inicio:</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setMostrarDatePicker1Inicio(true)}
              >
                <Text style={styles.dateText}>
                  {periodo1Inicio
                    ? periodo1Inicio.toLocaleDateString()
                    : "Seleccionar"}
                </Text>
                <Ionicons name="calendar" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Fin:</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setMostrarDatePicker1Fin(true)}
              >
                <Text style={styles.dateText}>
                  {periodo1Fin
                    ? periodo1Fin.toLocaleDateString()
                    : "Seleccionar"}
                </Text>
                <Ionicons name="calendar" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>

            <Text style={styles.comparacionSectionTitle}>Período 2</Text>
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Inicio:</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setMostrarDatePicker2Inicio(true)}
              >
                <Text style={styles.dateText}>
                  {periodo2Inicio
                    ? periodo2Inicio.toLocaleDateString()
                    : "Seleccionar"}
                </Text>
                <Ionicons name="calendar" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Fin:</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setMostrarDatePicker2Fin(true)}
              >
                <Text style={styles.dateText}>
                  {periodo2Fin
                    ? periodo2Fin.toLocaleDateString()
                    : "Seleccionar"}
                </Text>
                <Ionicons name="calendar" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>

            {/* Selector de tipo de comparación */}
            <Text style={styles.comparacionSectionTitle}>
              Tipo de Comparación
            </Text>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkboxOption}
                onPress={() => setTipoComparacion("ganancias")}
              >
                <View
                  style={[
                    styles.checkbox,
                    tipoComparacion === "ganancias" && styles.checkboxChecked,
                  ]}
                >
                  {tipoComparacion === "ganancias" && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Ganancias</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxOption}
                onPress={() => setTipoComparacion("ventas")}
              >
                <View
                  style={[
                    styles.checkbox,
                    tipoComparacion === "ventas" && styles.checkboxChecked,
                  ]}
                >
                  {tipoComparacion === "ventas" && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Ventas</Text>
              </TouchableOpacity>
            </View>

            {/* Botones de acción */}
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setComparacionPeriodos(null);
                  setPeriodo1Inicio(null);
                  setPeriodo1Fin(null);
                  setPeriodo2Inicio(null);
                  setPeriodo2Fin(null);
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Limpiar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={cargarComparacionPeriodos}
              >
                <Text style={styles.modalButtonText}>Comparar</Text>
              </TouchableOpacity>
            </View>

            {/* Resultados de comparación */}
            {comparacionPeriodos && (
              <View style={styles.comparacionResult}>
                <Text style={styles.comparacionSectionTitle}>Resultados</Text>

                <View style={styles.comparacionVisualContainer}>
                  <View style={styles.comparacionPeriod}>
                    <Text style={styles.comparacionLabel}>Período 1</Text>
                    <Text style={styles.comparacionValue}>
                      {formatearMoneda(
                        comparacionPeriodos.tipoComparacion === "ventas"
                          ? comparacionPeriodos.periodo1.ventas || 0
                          : comparacionPeriodos.periodo1.ganancias,
                      )}
                    </Text>
                  </View>
                  <View style={styles.comparacionPeriod}>
                    <Text style={styles.comparacionLabel}>Período 2</Text>
                    <Text style={styles.comparacionValue}>
                      {formatearMoneda(
                        comparacionPeriodos.tipoComparacion === "ventas"
                          ? comparacionPeriodos.periodo2.ventas || 0
                          : comparacionPeriodos.periodo2.ganancias,
                      )}
                    </Text>
                  </View>
                </View>

                {/* Gráfica de barras comparativa mejorada */}
                <View style={styles.comparacionChartContainer}>
                  <Text style={styles.comparacionSectionTitle}>
                    Comparación Visual
                  </Text>

                  {/* Escala de referencia */}
                  <View style={styles.comparacionScale}>
                    <Text style={styles.scaleLabel}>0%</Text>
                    <Text style={styles.scaleLabel}>50%</Text>
                    <Text style={styles.scaleLabel}>100%</Text>
                  </View>

                  <View style={styles.comparacionBarContainer}>
                    <View style={styles.comparacionBarInfo}>
                      <Text style={styles.comparacionPeriodLabel}>
                        Período 1
                      </Text>
                      <Text style={styles.comparacionPeriodAmount}>
                        {formatearMoneda(
                          comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo1.ventas || 0
                            : comparacionPeriodos.periodo1.ganancias,
                        )}
                      </Text>
                    </View>
                    <View style={styles.comparacionBar}>
                      <View
                        style={[
                          styles.comparacionBarFill,
                          styles.comparacionBarFill1,
                          {
                            width: `${Math.round(
                              ((comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo1.ventas || 0
                                : comparacionPeriodos.periodo1.ganancias) /
                                Math.max(
                                  comparacionPeriodos.tipoComparacion ===
                                    "ventas"
                                    ? comparacionPeriodos.periodo1.ventas || 0
                                    : comparacionPeriodos.periodo1.ganancias,
                                  comparacionPeriodos.tipoComparacion ===
                                    "ventas"
                                    ? comparacionPeriodos.periodo2.ventas || 0
                                    : comparacionPeriodos.periodo2.ganancias,
                                )) *
                                100,
                            )}%`,
                          },
                        ]}
                      ></View>
                      <Text style={styles.comparacionBarPercentage}>
                        {Math.round(
                          ((comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo1.ventas || 0
                            : comparacionPeriodos.periodo1.ganancias) /
                            Math.max(
                              comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo1.ventas || 0
                                : comparacionPeriodos.periodo1.ganancias,
                              comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo2.ventas || 0
                                : comparacionPeriodos.periodo2.ganancias,
                            )) *
                            100,
                        )}
                        %
                      </Text>
                    </View>
                  </View>

                  <View style={styles.comparacionBarContainer}>
                    <View style={styles.comparacionBarInfo}>
                      <Text style={styles.comparacionPeriodLabel}>
                        Período 2
                      </Text>
                      <Text style={styles.comparacionPeriodAmount}>
                        {formatearMoneda(
                          comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo2.ventas || 0
                            : comparacionPeriodos.periodo2.ganancias,
                        )}
                      </Text>
                    </View>
                    <View style={styles.comparacionBar}>
                      <View
                        style={[
                          styles.comparacionBarFill,
                          styles.comparacionBarFill2,
                          {
                            width: `${Math.round(
                              ((comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo2.ventas || 0
                                : comparacionPeriodos.periodo2.ganancias) /
                                Math.max(
                                  comparacionPeriodos.tipoComparacion ===
                                    "ventas"
                                    ? comparacionPeriodos.periodo1.ventas || 0
                                    : comparacionPeriodos.periodo1.ganancias,
                                  comparacionPeriodos.tipoComparacion ===
                                    "ventas"
                                    ? comparacionPeriodos.periodo2.ventas || 0
                                    : comparacionPeriodos.periodo2.ganancias,
                                )) *
                                100,
                            )}%`,
                          },
                        ]}
                      ></View>
                      <Text style={styles.comparacionBarPercentage}>
                        {Math.round(
                          ((comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo2.ventas || 0
                            : comparacionPeriodos.periodo2.ganancias) /
                            Math.max(
                              comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo1.ventas || 0
                                : comparacionPeriodos.periodo1.ganancias,
                              comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo2.ventas || 0
                                : comparacionPeriodos.periodo2.ganancias,
                            )) *
                            100,
                        )}
                        %
                      </Text>
                    </View>
                  </View>

                  {/* Línea de diferencia */}
                  <View style={styles.diferenciaVisualContainer}>
                    <View style={styles.diferenciaLine}>
                      <View
                        style={[
                          styles.diferenciaLineFill,
                          {
                            width: `${Math.abs(
                              Math.round(
                                (comparacionPeriodos.diferencia /
                                  Math.max(
                                    comparacionPeriodos.tipoComparacion ===
                                      "ventas"
                                      ? comparacionPeriodos.periodo1.ventas || 0
                                      : comparacionPeriodos.periodo1.ganancias,
                                    comparacionPeriodos.tipoComparacion ===
                                      "ventas"
                                      ? comparacionPeriodos.periodo2.ventas || 0
                                      : comparacionPeriodos.periodo2.ganancias,
                                  )) *
                                  100,
                              ),
                            )}%`,
                            backgroundColor:
                              comparacionPeriodos.diferencia >= 0
                                ? "#10b981"
                                : "#ef4444",
                          },
                        ]}
                      ></View>
                    </View>
                    <Text style={styles.diferenciaLineLabel}>
                      {comparacionPeriodos.diferencia >= 0 ? "↑" : "↓"}{" "}
                      Diferencia:{" "}
                      {Math.abs(
                        Math.round(
                          (comparacionPeriodos.diferencia /
                            Math.max(
                              comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo1.ventas || 0
                                : comparacionPeriodos.periodo1.ganancias,
                              comparacionPeriodos.tipoComparacion === "ventas"
                                ? comparacionPeriodos.periodo2.ventas || 0
                                : comparacionPeriodos.periodo2.ganancias,
                            )) *
                            100,
                        ),
                      )}
                      %
                    </Text>
                  </View>
                </View>

                {/* Explicación del cálculo */}
                <View style={styles.explicacionContainer}>
                  <Text style={styles.explicacionTitle}>¿Cómo se calcula?</Text>
                  <Text style={styles.explicacionTexto}>
                    • <Text style={styles.explicacionNegrita}>Barras:</Text> Se
                    basan en el valor más alto (100%)
                  </Text>
                  <Text style={styles.explicacionTexto}>
                    • <Text style={styles.explicacionNegrita}>Período 1:</Text>{" "}
                    {formatearMoneda(
                      comparacionPeriodos.tipoComparacion === "ventas"
                        ? comparacionPeriodos.periodo1.ventas || 0
                        : comparacionPeriodos.periodo1.ganancias,
                    )}{" "}
                    (
                    {Math.round(
                      ((comparacionPeriodos.tipoComparacion === "ventas"
                        ? comparacionPeriodos.periodo1.ventas || 0
                        : comparacionPeriodos.periodo1.ganancias) /
                        Math.max(
                          comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo1.ventas || 0
                            : comparacionPeriodos.periodo1.ganancias,
                          comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo2.ventas || 0
                            : comparacionPeriodos.periodo2.ganancias,
                        )) *
                        100,
                    )}
                    %)
                  </Text>
                  <Text style={styles.explicacionTexto}>
                    • <Text style={styles.explicacionNegrita}>Período 2:</Text>{" "}
                    {formatearMoneda(
                      comparacionPeriodos.tipoComparacion === "ventas"
                        ? comparacionPeriodos.periodo2.ventas || 0
                        : comparacionPeriodos.periodo2.ganancias,
                    )}{" "}
                    (
                    {Math.round(
                      ((comparacionPeriodos.tipoComparacion === "ventas"
                        ? comparacionPeriodos.periodo2.ventas || 0
                        : comparacionPeriodos.periodo2.ganancias) /
                        Math.max(
                          comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo1.ventas || 0
                            : comparacionPeriodos.periodo1.ganancias,
                          comparacionPeriodos.tipoComparacion === "ventas"
                            ? comparacionPeriodos.periodo2.ventas || 0
                            : comparacionPeriodos.periodo2.ganancias,
                        )) *
                        100,
                    )}
                    %)
                  </Text>
                  <Text style={styles.explicacionTexto}>
                    • <Text style={styles.explicacionNegrita}>Diferencia:</Text>{" "}
                    {comparacionPeriodos.diferencia >= 0
                      ? comparacionPeriodos.tipoComparacion === "ventas"
                        ? "Más ventas"
                        : "Más ganancias"
                      : comparacionPeriodos.tipoComparacion === "ventas"
                        ? "Menos ventas"
                        : "Menos ganancias"}{" "}
                    {formatearMoneda(Math.abs(comparacionPeriodos.diferencia))}{" "}
                    ({comparacionPeriodos.porcentaje >= 0 ? "+" : ""}
                    {comparacionPeriodos.porcentaje.toFixed(1)}%)
                  </Text>
                </View>

                <View style={styles.comparacionDiferencia}>
                  <Text style={styles.comparacionLabel}>Diferencia:</Text>
                  <Text
                    style={[
                      styles.comparacionValue,
                      comparacionPeriodos.diferencia >= 0
                        ? styles.positivo
                        : styles.negativo,
                    ]}
                  >
                    {comparacionPeriodos.diferencia >= 0 ? "+" : ""}
                    {formatearMoneda(comparacionPeriodos.diferencia)} (
                    {comparacionPeriodos.porcentaje.toFixed(1)}%)
                  </Text>
                </View>
              </View>
            )}

            {/* Date Pickers */}
            {mostrarDatePicker1Inicio && (
              <DateTimePicker
                value={periodo1Inicio || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePicker1Inicio(false);
                  if (selectedDate) setPeriodo1Inicio(selectedDate);
                }}
              />
            )}
            {mostrarDatePicker1Fin && (
              <DateTimePicker
                value={periodo1Fin || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePicker1Fin(false);
                  if (selectedDate) setPeriodo1Fin(selectedDate);
                }}
              />
            )}
            {mostrarDatePicker2Inicio && (
              <DateTimePicker
                value={periodo2Inicio || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePicker2Inicio(false);
                  if (selectedDate) setPeriodo2Inicio(selectedDate);
                }}
              />
            )}
            {mostrarDatePicker2Fin && (
              <DateTimePicker
                value={periodo2Fin || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePicker2Fin(false);
                  if (selectedDate) setPeriodo2Fin(selectedDate);
                }}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderModalGananciasCompartidas = () => (
    <Modal
      visible={mostrarModalGananciasCompartidas}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setMostrarModalGananciasCompartidas(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentWhite}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ganancias Compartidas</Text>
            <TouchableOpacity
              onPress={() => setMostrarModalGananciasCompartidas(false)}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {/* Lista de personas existentes */}
            {personasCompartidas.length > 0 && (
              <View style={styles.personasContainer}>
                <Text style={styles.sectionTitle}>Personas Configuradas</Text>
                {personasCompartidas.map((persona, index) => (
                  <View key={index} style={styles.personaCard}>
                    <View style={styles.personaInfo}>
                      <Text style={styles.personaNombre}>{persona.nombre}</Text>
                      <Text style={styles.personaTipo}>
                        {persona.tipo_comparticion === "porcentaje"
                          ? `${persona.valor}% de las ganancias`
                          : `${formatearMoneda(persona.valor)} fijos`}
                      </Text>
                    </View>
                    <View style={styles.personaActions}>
                      <TouchableOpacity
                        style={styles.editarButton}
                        onPress={() => abrirModalEditarPersona(persona)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={18}
                          color="#3b82f6"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.eliminarButton}
                        onPress={() =>
                          eliminarPersonaCompartida(persona.id!, persona.nombre)
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#ef4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Formulario para nueva persona */}
            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>
                {personasCompartidas.length > 0
                  ? "Agregar Nueva Persona"
                  : "Configurar Primera Persona"}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre de la persona"
                  value={formDataPersona.nombre}
                  onChangeText={(text) =>
                    setFormDataPersona({ ...formDataPersona, nombre: text })
                  }
                />
              </View>

              <View style={styles.segmentContainer}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formDataPersona.tipo_comparticion === "porcentaje" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() =>
                    setFormDataPersona({
                      ...formDataPersona,
                      tipo_comparticion: "porcentaje",
                    })
                  }
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formDataPersona.tipo_comparticion === "porcentaje" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Porcentaje
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formDataPersona.tipo_comparticion === "cantidad_fija" &&
                      styles.segmentButtonActive,
                  ]}
                  onPress={() =>
                    setFormDataPersona({
                      ...formDataPersona,
                      tipo_comparticion: "cantidad_fija",
                    })
                  }
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formDataPersona.tipo_comparticion === "cantidad_fija" &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    Cantidad Fija
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {formDataPersona.tipo_comparticion === "porcentaje"
                    ? "Porcentaje (%):"
                    : "Cantidad:"}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    formDataPersona.tipo_comparticion === "porcentaje"
                      ? "Ej: 50"
                      : "Ej: 100"
                  }
                  value={formDataPersona.valor}
                  onChangeText={(text) =>
                    setFormDataPersona({ ...formDataPersona, valor: text })
                  }
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity
                style={styles.crearButton}
                onPress={crearPersonaCompartida}
              >
                <Text style={styles.crearButtonText}>Crear Persona</Text>
              </TouchableOpacity>
            </View>

            {/* Vista previa de distribución */}
            {distribucionGanancias.length > 0 && (
              <View style={styles.previewContainer}>
                <Text style={styles.sectionTitle}>Vista Previa</Text>
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>
                    Ganancia Total: {formatearMoneda(gananciaActual)}
                  </Text>
                  {distribucionGanancias.map((dist, index) => (
                    <View key={index} style={styles.previewItem}>
                      <Text style={styles.previewPersona}>
                        {dist.persona.nombre}:
                      </Text>
                      <Text style={styles.previewMonto}>
                        {formatearMoneda(dist.monto_a_recibir)}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.previewItem, styles.previewTotal]}>
                    <Text style={styles.previewPersona}>Para ti:</Text>
                    <Text style={styles.previewMonto}>
                      {formatearMoneda(totalUsuario)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderModalEditarPersona = () => (
    <Modal
      visible={mostrarModalEditarPersona}
      transparent={true}
      animationType="slide"
      onRequestClose={cerrarModalEditarPersona}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.modalEditarPersona]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Persona</Text>
            <TouchableOpacity onPress={cerrarModalEditarPersona}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre:</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre de la persona"
                value={formDataEditPersona.nombre}
                onChangeText={(text) =>
                  setFormDataEditPersona({
                    ...formDataEditPersona,
                    nombre: text,
                  })
                }
              />
            </View>

            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  formDataEditPersona.tipo_comparticion === "porcentaje" &&
                    styles.segmentButtonActive,
                ]}
                onPress={() =>
                  setFormDataEditPersona({
                    ...formDataEditPersona,
                    tipo_comparticion: "porcentaje",
                  })
                }
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    formDataEditPersona.tipo_comparticion === "porcentaje" &&
                      styles.segmentButtonTextActive,
                  ]}
                >
                  Porcentaje
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  formDataEditPersona.tipo_comparticion === "cantidad_fija" &&
                    styles.segmentButtonActive,
                ]}
                onPress={() =>
                  setFormDataEditPersona({
                    ...formDataEditPersona,
                    tipo_comparticion: "cantidad_fija",
                  })
                }
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    formDataEditPersona.tipo_comparticion === "cantidad_fija" &&
                      styles.segmentButtonTextActive,
                  ]}
                >
                  Cantidad Fija
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formDataEditPersona.tipo_comparticion === "porcentaje"
                  ? "Porcentaje (%):"
                  : "Cantidad:"}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={
                  formDataEditPersona.tipo_comparticion === "porcentaje"
                    ? "Ej: 50"
                    : "Ej: 100"
                }
                value={formDataEditPersona.valor}
                onChangeText={(text) =>
                  setFormDataEditPersona({
                    ...formDataEditPersona,
                    valor: text,
                  })
                }
                keyboardType="numeric"
              />
            </View>

            <View style={styles.editarButtonsContainer}>
              <TouchableOpacity
                style={[styles.crearButton, styles.cancelarButton]}
                onPress={cerrarModalEditarPersona}
              >
                <Text
                  style={[styles.crearButtonText, styles.cancelarButtonText]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.crearButton}
                onPress={actualizarPersonaCompartida}
              >
                <Text style={styles.crearButtonText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Función de autenticación
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

  // Si no está autenticado, mostrar modal de acceso
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Cargando datos de ganancias...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderHeader()}
        {modoVista === "ganancias"
          ? renderGananciaActual()
          : renderIPVToolbar()}
        {modoVista === "ipv" && renderIPV()}
        {modoVista === "ganancias" && renderBotonesAccion()}
        {modoVista === "ganancias" && <View style={styles.espaciador} />}
        {modoVista === "ganancias" && renderGastosPorCategoria()}
        {modoVista === "ganancias" && <View style={styles.espaciador} />}
        {modoVista === "ganancias" && renderProductosVendidos()}
        {modoVista === "ganancias" && <View style={styles.espaciador} />}
        {modoVista === "ganancias" && renderProductosMenosVendidos()}
        {modoVista === "ganancias" && <View style={styles.espaciador} />}
        {modoVista === "ganancias" && renderProductosTodosVendidos()}
      </ScrollView>

      {/* Modales */}
      {renderModalPeriodo()}
      {renderModalComparacion()}
      {renderModalGananciasCompartidas()}
      {renderModalEditarPersona()}

      {/* Modal para gestión de topes */}
      <Modal
        visible={mostrarModalTopes}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setMostrarModalTopes(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestión de Topes de Precios</Text>
              <TouchableOpacity onPress={() => setMostrarModalTopes(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>Producto:</Text>
              <ScrollView style={{ maxHeight: 150, marginBottom: 16 }}>
                {datosIPVMostrados
                  .filter(
                    (producto) =>
                      (producto.inicio || 0) > 0 || (producto.entro || 0) > 0,
                  )
                  .map((producto, index) => (
                    <View key={index} style={styles.productoItem}>
                      <TouchableOpacity
                        style={[
                          styles.productoOption,
                          productoSeleccionado === producto.producto &&
                            styles.productoOptionSelected,
                        ]}
                        onPress={() =>
                          setProductoSeleccionado(producto.producto)
                        }
                      >
                        <Text style={styles.productoOptionText}>
                          {producto.producto} - ${producto.precio?.toFixed(2)}
                        </Text>
                        {topesPrecios[producto.producto] && (
                          <Text style={styles.topeActualText}>
                            Tope: ${topesPrecios[producto.producto].toFixed(2)}
                          </Text>
                        )}
                      </TouchableOpacity>
                      {topesPrecios[producto.producto] && (
                        <TouchableOpacity
                          style={styles.eliminarTopeButton}
                          onPress={() => {
                            Alert.alert(
                              "Eliminar Tope",
                              `¿Desea eliminar el tope de "${producto.producto}"?`,
                              [
                                { text: "Cancelar", style: "cancel" },
                                {
                                  text: "Eliminar",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      const exito =
                                        await TopePrecioGananciaService.eliminarTope(
                                          puntoId!,
                                          producto.producto,
                                        );
                                      if (exito) {
                                        const nuevosTopes = { ...topesPrecios };
                                        delete nuevosTopes[producto.producto];
                                        setTopesPrecios(nuevosTopes);

                                        // Recalcular datos IPV sin el tope eliminado
                                        const datosActualizados =
                                          datosIPVMostrados.map((p) => ({
                                            ...p,
                                            precio_con_tope: p.precio,
                                            monto_vendido_con_tope:
                                              p.monto_vendido || 0,
                                          }));
                                        // Nota: Los topes se aplican solo en visualización
                                        // setDatosIPV(datosActualizados); // ❌ PROHIBIDO

                                        Alert.alert(
                                          "Éxito",
                                          "Tope eliminado correctamente",
                                        );
                                      }
                                    } catch {
                                      Alert.alert(
                                        "Error",
                                        "No se pudo eliminar el tope",
                                      );
                                    }
                                  },
                                },
                              ],
                            );
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Nuevo Tope:</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={[styles.modalInput, styles.inputWithPrefix]}
                  value={precioTope}
                  onChangeText={setPrecioTope}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  Alert.alert(
                    "Limpiar Topes",
                    "¿Desea eliminar todos los topes de precios?",
                    [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Limpiar",
                        style: "destructive",
                        onPress: limpiarTodosTopes,
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>
                  Limpiar Todo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={aplicarTopePrecio}
              >
                <Text style={styles.modalButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para reductor */}
      <Modal
        visible={mostrarModalReductor}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setMostrarModalReductor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reducción Mensual</Text>
              <TouchableOpacity onPress={() => setMostrarModalReductor(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>Factor de reducción:</Text>
              <Text style={styles.modalSubtitle}>
                Ingresa el factor de reducción (ej: 0.2 para restar el 20% de
                las ventas)
              </Text>
              <TextInput
                style={styles.modalInput}
                value={rejuego}
                onChangeText={setRejuego}
                placeholder="Ej: 0.2 para 20%"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={aplicarReduccionMensual}
              >
                <Text style={styles.modalButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de progreso para generación de PDF */}
      {mostrarModalProgreso && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="document-text" size={24} color="#3b82f6" />
                <Text style={styles.modalTitle}>Generando PDF</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                Informe de Productos Vendidos
              </Text>
            </View>

            <View style={styles.modalContent}>
              {/* Contenedor principal con animación visual */}
              <View style={styles.progresoMainContainer}>
                {/* Icono animado de progreso */}
                <View style={styles.iconContainer}>
                  <Ionicons
                    name="document-attach"
                    size={48}
                    color="#3b82f6"
                    style={[
                      styles.progresoIcon,
                      progresoPDF > 0 && styles.progresoIconAnimated,
                    ]}
                  />
                </View>

                {/* Porcentaje grande y animado */}
                <View style={styles.percentageContainer}>
                  <Text style={styles.percentageText}>
                    {progresoPDF}
                    <Text style={styles.percentageSymbol}>%</Text>
                  </Text>
                  <Text style={styles.percentageLabel}>Completado</Text>
                </View>

                {/* Barra de progreso mejorada */}
                <View style={styles.progresoBarWrapper}>
                  <View style={styles.progresoBarContainer}>
                    <View
                      style={[
                        styles.progresoBar,
                        {
                          width: `${progresoPDF}%`,
                          backgroundColor:
                            progresoPDF === 100 ? "#10b981" : "#3b82f6",
                        },
                      ]}
                    />
                    {/* Efecto de brillo en la barra */}
                    {progresoPDF > 0 && (
                      <View
                        style={[
                          styles.progresoBarGlow,
                          {
                            width: `${progresoPDF}%`,
                            opacity: progresoPDF === 100 ? 0.3 : 0.6,
                          },
                        ]}
                      />
                    )}
                  </View>
                  {/* Indicadores de progreso */}
                  <View style={styles.progressIndicators}>
                    <View style={styles.progressIndicator} />
                    <View style={styles.progressIndicator} />
                    <View style={styles.progressIndicator} />
                    <View style={styles.progressIndicator} />
                  </View>
                </View>

                {/* Estado dinámico */}
                <View style={styles.statusContainer}>
                  <Text style={styles.statusText}>
                    {progresoPDF === 0 && "🔄 Iniciando generación..."}
                    {progresoPDF > 0 &&
                      progresoPDF < 25 &&
                      "📄 Procesando página 1..."}
                    {progresoPDF >= 25 &&
                      progresoPDF < 50 &&
                      "📄📄 Procesando páginas 1-2..."}
                    {progresoPDF >= 50 &&
                      progresoPDF < 75 &&
                      "📄📄📄 Procesando páginas 1-3..."}
                    {progresoPDF >= 75 &&
                      progresoPDF < 100 &&
                      "📄📄📄📄 Finalizando últimas páginas..."}
                    {progresoPDF === 100 && "✅ PDF generado exitosamente"}
                  </Text>
                </View>
              </View>

              {/* Tarjeta de estadísticas mejorada */}
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>📊 Estadísticas del PDF</Text>

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                      <Ionicons name="cube-outline" size={20} color="#6366f1" />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statValue}>
                        {datosIPVMostrados.length}
                      </Text>
                      <Text style={styles.statLabel}>Productos</Text>
                    </View>
                  </View>

                  <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                      <Ionicons
                        name="document-outline"
                        size={20}
                        color="#8b5cf6"
                      />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statValue}>
                        {Math.ceil(datosIPVMostrados.length / 25)}
                      </Text>
                      <Text style={styles.statLabel}>Páginas</Text>
                    </View>
                  </View>

                  <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                      <Ionicons name="grid-outline" size={20} color="#10b981" />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statValue}>25</Text>
                      <Text style={styles.statLabel}>Por página</Text>
                    </View>
                  </View>

                  <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                      <Ionicons name="time-outline" size={20} color="#f59e0b" />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statValue}>
                        {progresoPDF === 0
                          ? "--"
                          : `${Math.ceil((progresoPDF / 100) * Math.ceil(datosIPVMostrados.length / 25))}`}
                      </Text>
                      <Text style={styles.statLabel}>Procesadas</Text>
                    </View>
                  </View>
                </View>

                {/* Barra de progreso secundaria */}
                <View style={styles.secondaryProgressContainer}>
                  <Text style={styles.secondaryProgressLabel}>
                    Página{" "}
                    {Math.ceil(
                      (progresoPDF / 100) *
                        Math.ceil(datosIPVMostrados.length / 25),
                    )}{" "}
                    de {Math.ceil(datosIPVMostrados.length / 25)}
                  </Text>
                  <View style={styles.secondaryProgressBar}>
                    <View
                      style={[
                        styles.secondaryProgressFill,
                        {
                          width: `${(Math.ceil((progresoPDF / 100) * Math.ceil(datosIPVMostrados.length / 25)) / Math.ceil(datosIPVMostrados.length / 25)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

              {/* Mensaje informativo */}
              <View style={styles.infoContainer}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#6b7280"
                />
                <Text style={styles.infoText}>
                  {progresoPDF < 100
                    ? "El PDF se está generando en segundo plano. Por favor, espera a que termine."
                    : "El PDF ha sido generado exitosamente. La ventana se cerrará automáticamente."}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Modal de selección de período para PDF */}
      <Modal
        visible={mostrarModalPeriodoPDF}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMostrarModalPeriodoPDF(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentPeriodoPDF}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Seleccionar Período para PDF
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setMostrarModalPeriodoPDF(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Seleccione el período que desea incluir en el informe de
                productos vendidos (IPV):
              </Text>

              <TouchableOpacity
                style={styles.periodoOption}
                onPress={() => {
                  setMostrarModalPeriodoPDF(false);
                  generarPDFDia();
                }}
                disabled={generatingPDF}
              >
                <View style={styles.periodoOptionContent}>
                  <View style={styles.periodoOptionIcon}>
                    <Ionicons name="today" size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.periodoOptionText}>
                    <Text style={styles.periodoOptionTitle}>Día Actual</Text>
                    <Text style={styles.periodoOptionDescription}>
                      Generar PDF con los productos vendidos hoy
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.periodoOption}
                onPress={() => {
                  setMostrarModalPeriodoPDF(false);
                  generarPDFMes();
                }}
                disabled={generatingPDF}
              >
                <View style={styles.periodoOptionContent}>
                  <View style={styles.periodoOptionIcon}>
                    <Ionicons name="calendar" size={24} color="#10b981" />
                  </View>
                  <View style={styles.periodoOptionText}>
                    <Text style={styles.periodoOptionTitle}>Mes Actual</Text>
                    <Text style={styles.periodoOptionDescription}>
                      Generar PDF con todos los productos vendidos durante el
                      mes
                    </Text>
                  </View>
                </View>
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
    marginTop: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 12,
    textAlign: "center",
  },

  // Header
  header: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    // backgroundColor: "#f0f9ff", // Eliminado el fondo azul
  },

  // Cards
  card: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  gananciaActual: {
    fontSize: 32,
    fontWeight: "800",
    color: "#10b981",
    marginVertical: 8,
  },
  gananciaNegativa: {
    color: "#ef4444",
  },

  // Desglose de ganancias
  gananciaDesglose: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  gananciaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  gananciaItemTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  gananciaItemLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  gananciaItemLabelTotal: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  gananciaItemValue: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
  },
  gananciaItemValueTotal: {
    fontSize: 16,
    color: "#10b981",
    fontWeight: "700",
  },
  gastosValue: {
    color: "#ef4444",
  },
  gananciaItemGastos: {
    // Hereda estilos de gananciaItem pero sin estilos específicos
  },

  // Sections
  section: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
  },

  // Productos
  productoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  productoInfo: {
    flex: 1,
  },
  productoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  productoCategoria: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  productoStats: {
    alignItems: "flex-end",
  },
  productoCantidad: {
    fontSize: 14,
    color: "#6b7280",
  },
  productoTotal: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 20,
  },

  // Espaciador
  espaciador: {
    height: 16,
  },

  // Botones de acción
  botonesContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  botonAccion: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  botonAccionMejorado: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  botonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  botonTextContainer: {
    alignItems: "flex-start",
  },
  botonTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    lineHeight: 18,
  },
  botonSubtitulo: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  botonTexto: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    maxHeight: "60%",
  },
  modalContentWhite: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    flex: 1,
  },
  modalButtonSecondary: {
    backgroundColor: "#6b7280",
  },
  modalButtonSuccess: {
    backgroundColor: "#10b981",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  modalButtonTextSecondary: {
    color: "white",
  },

  // Estilos para modal de autenticación
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
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

  // Comparación visual mejorada
  comparacionChartContainer: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  comparacionBarContainer: {
    marginBottom: 12,
  },
  comparacionBar: {
    height: 32,
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
    position: "relative",
  },
  comparacionBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  comparacionBarValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
    lineHeight: 32,
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  comparacionPeriodLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
  },

  // Nuevos estilos para gráfico mejorado
  comparacionScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  scaleLabel: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "500",
  },
  comparacionBarInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  comparacionPeriodAmount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  comparacionBarFill1: {
    backgroundColor: "#3b82f6",
  },
  comparacionBarFill2: {
    backgroundColor: "#10b981",
  },
  comparacionBarPercentage: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    position: "absolute",
    right: 8,
    top: 8,
  },
  diferenciaVisualContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  diferenciaLine: {
    height: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",

    // Estilos para explicación
    explicacionContainer: {
      backgroundColor: "#fef3c7",
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: "#f59e0b",
    },
    explicacionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: "#92400e",
      marginBottom: 8,
    },
    explicacionTexto: {
      fontSize: 12,
      color: "#78350f",
      marginBottom: 4,
      lineHeight: 16,
    },
    explicacionNegrita: {
      fontWeight: "600",
      color: "#92400e",
    },
    comparacionNumerosContainer: {
      backgroundColor: "#f1f5f9",
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  comparacionNumerosContainer: {
    backgroundColor: "#f1f5f9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },

  // Período buttons
  periodoButtons: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 8,
  },
  periodoButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  periodoButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  periodoButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  periodoButtonTextActive: {
    color: "white",
  },

  // Período buttons mejorados
  periodoButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  periodoButtonMejorado: {
    flex: 1,
    aspectRatio: 1, // Hace que sea un cuadrado perfecto
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    minHeight: 100,
    paddingHorizontal: 8,
  },
  periodoButtonTextMejorado: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 14,
  },

  // Comparación visual mejorada
  comparacionVisualContainer: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },

  // Date containers
  dateContainer: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
  },
  dateButtonDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  dateText: {
    fontSize: 16,
    color: "#111827",
  },
  dateTextDisabled: {
    color: "#9ca3af",
  },

  // Results
  resultContainer: {
    backgroundColor: "#f0f9ff",
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  resultLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#10b981",
  },

  // Comparación
  comparacionSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 20,
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  checkboxOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "white",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  comparacionResult: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  comparacionPeriod: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  comparacionDiferencia: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  comparacionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  comparacionValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  positivo: {
    color: "#10b981",
  },
  negativo: {
    color: "#ef4444",
  },

  // Estilos para cards de gastos por categoría
  categoriaCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  categoriaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoriaInfo: {
    flex: 1,
  },
  categoriaNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#991b1b",
    marginBottom: 2,
  },
  categoriaStats: {
    fontSize: 12,
    color: "#7f1d1d",
  },
  categoriaTotal: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoriaTotalText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  salarioDesglose: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  desgloseTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 8,
  },
  salarioItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  salarioInfo: {
    flex: 1,
  },
  salarioNombre: {
    fontSize: 14,
    fontWeight: "500",
    color: "#78350f",
  },
  salarioDescripcion: {
    fontSize: 11,
    color: "#92400e",
    fontStyle: "italic",
    marginTop: 2,
  },
  salarioMonto: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },

  // Estilos para ganancias compartidas
  personasContainer: {
    marginBottom: 24,
  },
  personaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  personaInfo: {
    flex: 1,
  },
  personaNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  personaTipo: {
    fontSize: 14,
    color: "#6b7280",
  },
  eliminarButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
  },
  personaActions: {
    flexDirection: "row",
    gap: 8,
  },
  editarButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
  },
  formContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
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
    backgroundColor: "#ffffff",
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
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
  crearButton: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  crearButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  previewContainer: {
    marginBottom: 24,
  },
  previewCard: {
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  previewTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: "#3b82f6",
    paddingTop: 12,
    marginTop: 4,
  },
  previewPersona: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  previewMonto: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e40af",
  },
  distribucionContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  distribucionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 8,
  },
  distribucionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  distribucionPersona: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  distribucionMonto: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e40af",
  },
  modalEditarPersona: {
    maxHeight: "80%",
  },
  editarButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelarButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  cancelarButtonText: {
    color: "#6b7280",
  },

  // Estilos para paginación
  paginacionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  paginacionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  paginacionButtonDisabled: {
    backgroundColor: "#f9fafb",
    opacity: 0.6,
  },
  paginacionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3b82f6",
  },
  paginacionButtonTextDisabled: {
    color: "#9ca3af",
  },
  paginacionInfo: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },

  // Estilos para barra de herramientas IPV
  ipvToolbarContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ipvToolbarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
    textAlign: "center",
  },
  ipvToolbarButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    gap: 8,
  },
  ipvToolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  ipvToolbarButtonIcon: {
    // Sin cambios necesarios
  },
  ipvToolbarButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
  },
  ipvToolbarButtonPrimary: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  ipvToolbarButtonTextPrimary: {
    color: "#ffffff",
  },
  ipvToolbarButtonSecondary: {
    backgroundColor: "#6b7280",
    borderColor: "#6b7280",
  },
  ipvToolbarButtonTextSecondary: {
    color: "#ffffff",
  },
  ipvToolbarButtonPDF: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  ipvToolbarButtonTextPDF: {
    color: "#ffffff",
  },
  ipvToolbarButtonTopes: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },
  ipvToolbarButtonTextTopes: {
    color: "#ffffff",
  },
  ipvToolbarButtonRestore: {
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
  },
  ipvToolbarButtonTextRestore: {
    color: "#ffffff",
  },
  ipvToolbarButtonClear: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  ipvToolbarButtonTextClear: {
    color: "#ffffff",
  },

  // Estilos para botones de modo Ganancias/IPV
  modoFilter: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  modoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  modoButtonActive: {
    backgroundColor: "#3b82f6",
  },
  modoButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modoButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  modoButtonTextActive: {
    color: "#ffffff",
  },

  // Estilos para la tabla IPV
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  tableRowEven: {
    backgroundColor: "#f9fafb",
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "center",
  },
  tableCellText: {
    fontSize: 13,
    color: "#374151",
    textAlign: "center",
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  colProducto: {
    flex: 3,
    textAlign: "left",
    fontWeight: "600",
  },
  colPrecio: {
    flex: 1.5,
  },
  colCantidad: {
    flex: 1,
  },
  colVendido: {
    flex: 1.5,
    fontWeight: "600",
    color: "#059669",
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    padding: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0ea5e9",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0c4a6e",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0c4a6e",
  },
  productoOptionSelected: {
    backgroundColor: "#dbeafe",
    borderColor: "#3b82f6",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "white",
  },
  inputPrefix: {
    fontSize: 16,
    color: "#6b7280",
    paddingHorizontal: 12,
    fontWeight: "600",
  },
  inputWithPrefix: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  // Estilos para botones adicionales
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#3b82f6",
  },
  buttonSecondary: {
    backgroundColor: "#6b7280",
  },
  buttonPDF: {
    backgroundColor: "#059669",
  },
  buttonTopes: {
    backgroundColor: "#dc2626",
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  // Estilos para date picker
  datePickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f9fafb",
  },
  datePickerText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  // Estilos para gestión de topes
  productoOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "white",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonPrimary: {
    backgroundColor: "#3b82f6",
  },
  actionButtonSecondary: {
    backgroundColor: "#6b7280",
  },
  actionButtonPDF: {
    backgroundColor: "#059669",
  },
  actionButtonTopes: {
    backgroundColor: "#dc2626",
  },
  actionButtonRestore: {
    backgroundColor: "#f59e0b",
  },
  // Estilos para paginación de días
  ipvContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  navigationCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
    minHeight: 400,
  },
  fechaInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  fechaInfoText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  diaActualText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  paginacionDiasContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  paginacionDiasTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  paginacionDiasScroll: {
    maxHeight: 50,
  },
  paginacionDiasContent: {
    paddingHorizontal: 8,
  },
  diaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  diaButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  diaButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  diaButtonTextActive: {
    color: "white",
  },
  // Estilos para paginación de meses
  paginacionMesesContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  paginacionMesesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  paginacionMesesContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  mesNavButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  mesActualContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  mesActualText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  // Estilos para indicador de estado
  filtroDatosContainer: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 8,
    marginLeft: 8,
  },
  indicadorEstado: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  indicadorTexto: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
    color: "#374151",
  },
  // Estilos para modal de progreso PDF - Diseño Mejorado
  modalTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progresoMainContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#eff6ff",
    borderRadius: 50,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  progresoIcon: {
    opacity: 0.8,
  },
  progresoIconAnimated: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  percentageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  percentageText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#1f2937",
    lineHeight: 48,
  },
  percentageSymbol: {
    fontSize: 24,
    color: "#6b7280",
    fontWeight: "normal",
  },
  percentageLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    fontWeight: "500",
  },
  progresoBarWrapper: {
    width: "100%",
    marginBottom: 16,
  },
  progresoBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  progresoBar: {
    height: "100%",
    borderRadius: 4,
    transition: "all 0.3s ease",
  },
  progresoBarGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "#93c5fd",
    borderRadius: 4,
    filter: "blur(2px)",
  },
  progressIndicators: {
    position: "absolute",
    top: -2,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  progressIndicator: {
    width: 4,
    height: 12,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
  },
  statusContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statusText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    fontWeight: "500",
  },
  statsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    width: "48%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statContent: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  secondaryProgressContainer: {
    width: "100%",
  },
  secondaryProgressLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
    textAlign: "center",
    fontWeight: "500",
  },
  secondaryProgressBar: {
    height: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 2,
    overflow: "hidden",
  },
  secondaryProgressFill: {
    height: "100%",
    backgroundColor: "#8b5cf6",
    borderRadius: 2,
    transition: "all 0.3s ease",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#92400e",
    flex: 1,
    lineHeight: 16,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    paddingVertical: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },
  modalContentPeriodoPDF: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  periodoOption: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  periodoOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  periodoOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0f9ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  periodoOptionText: {
    flex: 1,
  },
  periodoOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  periodoOptionDescription: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
});
