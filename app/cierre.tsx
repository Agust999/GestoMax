// app/cierre.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import { getFirst, getSingleValue } from "../src/db/database";
import { PuntoHelper } from "../src/db/databaseHelper";
import {
  CierreService,
  ProductoInventario,
  ResumenCierre,
} from "../src/db/services/cierre_service";
import { GastoService } from "../src/db/services/gasto_service";
import { getFechaLocal } from "../src/utils/dateUtils";

interface Punto {
  id: number;
  nombre: string;
  tipo_negocio: string;
}

export default function CierreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/cierre", params);

  const puntoId = params.puntoId ? parseInt(params.puntoId as string) : null;
  const puntoNombre = (params.puntoNombre as string) || "Punto";

  // Estado para cambiar entre apertura y cierre
  const [modo, setModo] = useState<"apertura" | "cierre">("cierre");
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [resumen, setResumen] = useState<ResumenCierre | null>(null);
  const [montoExtraido, setMontoExtraido] = useState<string>("0");
  const [fondoCaja, setFondoCaja] = useState<string>("0");
  const [observaciones, setObservaciones] = useState<string>("");
  const [mostrarModalExtraer, setMostrarModalExtraer] = useState(false);
  const [mostrarModalFondoCaja, setMostrarModalFondoCaja] = useState(false);
  const [mostrarModalDineroFisico, setMostrarModalDineroFisico] =
    useState(false);
  const [dineroFisico, setDineroFisico] = useState<{ [key: number]: number }>({
    1: 0,
    3: 0,
    5: 0,
    10: 0,
    20: 0,
    50: 0,
    100: 0,
    200: 0,
    500: 0,
    1000: 0,
  });
  const [editandoDenominacion, setEditandoDenominacion] = useState<
    number | null
  >(null);
  const [valorTemporal, setValorTemporal] = useState<string>("");
  const [tecladoVisible, setTecladoVisible] = useState(false);
  const [realizandoOperacion, setRealizandoOperacion] = useState(false);
  const [yaCerradoHoy, setYaCerradoHoy] = useState(false);
  const [yaAbiertoHoy, setYaAbiertoHoy] = useState(false);
  const [ultimoCierreHoy, setUltimoCierreHoy] = useState<any>(null);
  const [ultimaAperturaHoy, setUltimaAperturaHoy] = useState<any>(null);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [historialCierres, setHistorialCierres] = useState<CierreCaja[]>([]);
  const [paginaActual, setPaginaActual] = useState(0);
  const [totalCierres, setTotalCierres] = useState(0);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const cierresPorPagina = 10;
  const [historialAperturas, setHistorialAperturas] = useState<any[]>([]);
  const [mostrarModalHistorialAperturas, setMostrarModalHistorialAperturas] =
    useState(false);
  const [paginaActualAperturas, setPaginaActualAperturas] = useState(0);
  const [totalAperturas, setTotalAperturas] = useState(0);
  const [cargandoAperturas, setCargandoAperturas] = useState(false);
  const aperturasPorPagina = 10;
  const [cambiosPrecioCierre, setCambiosPrecioCierre] = useState<any[]>([]);
  const [mostrarCambiosPrecio, setMostrarCambiosPrecio] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<any>(null);
  const [gananciasReales, setGananciasReales] = useState<number>(0);
  const [gastosDesglosados, setGastosDesglosados] = useState<{
    total: number;
    salarios: number;
  }>({ total: 0, salarios: 0 });

  // Estados para selección de trabajador
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] =
    useState<any>(null);
  const [mostrarModalTrabajador, setMostrarModalTrabajador] = useState(false);
  const [trabajadoresDisponibles, setTrabajadoresDisponibles] = useState<any[]>(
    [],
  );
  const [cargandoTrabajadores, setCargandoTrabajadores] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [puntoId]);

  // Efecto para recargar resumen cuando cambia el modo
  useEffect(() => {
    if (modo === "cierre" && puntoId) {
      console.log("🔄 Cambiando a modo cierre, recargando resumen...");
      cargarResumenModoCierre();
    } else {
      console.log("🔄 Cambiando a modo apertura, limpiando resumen");
      setResumen(null);
    }
  }, [modo]);

  // Funciones para manejo de trabajadores
  const cargarTrabajadores = async () => {
    if (!puntoId) return;

    setCargandoTrabajadores(true);
    try {
      const GastoService = (await import("../src/db/services/gasto_service"))
        .GastoService;
      const trabajadores = await GastoService.obtenerSalariosActivos(puntoId);

      console.log("🔍 DEBUG: Trabajadores recibidos:", trabajadores);
      console.log("🔍 DEBUG: Longitud del array:", trabajadores.length);
      console.log("🔍 DEBUG: Primer trabajador:", trabajadores[0]);

      setTrabajadoresDisponibles(trabajadores);
      console.log(`👥 Cargados ${trabajadores.length} trabajadores activos`);
    } catch (error) {
      console.error("Error cargando trabajadores:", error);
      Alert.alert(
        "Error",
        "No se pudieron cargar los trabajadores disponibles",
      );
    } finally {
      setCargandoTrabajadores(false);
    }
  };

  const abrirModalTrabajador = async () => {
    await cargarTrabajadores();
    setMostrarModalTrabajador(true);
  };

  const seleccionarTrabajador = (trabajador: any) => {
    setTrabajadorSeleccionado(trabajador);
    setMostrarModalTrabajador(false);
    console.log(
      `✅ Trabajador seleccionado: ${trabajador.nombre} (${
        trabajador.es_porcentaje === 1
          ? `${trabajador.porcentaje}%`
          : `$${trabajador.salario_fijo || 0} sueldo diario`
      })`,
    );
  };

  const limpiarTrabajador = () => {
    setTrabajadorSeleccionado(null);
    console.log("🧹 Trabajador seleccionado limpiado");
  };

  // Función para cargar solo el resumen cuando cambia el modo
  const cargarResumenModoCierre = async () => {
    if (!puntoId) return;

    try {
      // Verificar si hay cierre hoy
      const cierreReal = await CierreService.getCierreHoy(puntoId);
      const existeCierre = !!cierreReal;

      console.log(
        "🔍 DEBUG: cargarResumenModoCierre - existeCierre:",
        existeCierre,
      );

      // Cargar productos para el cálculo
      const productosData = await CierreService.getProductosParaCierre(puntoId);
      setProductos(productosData);

      if (existeCierre) {
        console.log(
          "🔄 Hay cierre existente, usando datos del cierre guardado",
        );
        // Usar los datos del cierre guardado en lugar de recalcular
        if (cierreReal) {
          const resumenCierre = {
            total_ventas: cierreReal.total_ventas || 0,
            total_efectivo: cierreReal.total_efectivo || 0,
            total_transferencia: cierreReal.total_transferencia || 0,
            total_gastos: cierreReal.total_gastos || 0,
            total_ganancias: cierreReal.total_ganancias || 0,
            total_extraido: cierreReal.total_extraido || 0,
            total_perdidas: cierreReal.total_perdidas || 0,
            perdidas_inventario: cierreReal.perdidas_inventario || 0,
            deuda_pendiente: cierreReal.deuda_pendiente || 0,
            deuda_pagada: cierreReal.deuda_pagada || 0,
            productos_correctos: cierreReal.productos_correctos || 0,
            productos_incorrectos: cierreReal.productos_incorrectos || 0,
            cambios_precios: [], // Los cambios de precio se cargarían por separado si es necesario
            prestamos_dia: [], // Los préstamos se cargarían por separado si es necesario
            productos_baja: [], // Los productos dados de baja se cargarían por separado si es necesario
          };
          setResumen(resumenCierre);

          // Calcular y actualizar ganancias del día
          const gananciasDelDia = await calcularGananciasDia();
          setGananciasReales(gananciasDelDia);

          // Calcular y actualizar gastos desglosados
          const gastosDesglosadosDia = await calcularGastosDia();
          setGastosDesglosados(gastosDesglosadosDia);
        }
      } else {
        console.log("🔄 No hay cierre, obteniendo resumen básico");
        const resumenBasico = await obtenerResumenBasicoDia();
        setResumen(resumenBasico);

        // Calcular y actualizar ganancias del día
        const gananciasDelDia = await calcularGananciasDia();
        setGananciasReales(gananciasDelDia);

        // Calcular y actualizar gastos desglosados
        const gastosDesglosadosDia = await calcularGastosDia();
        setGastosDesglosados(gastosDesglosadosDia);
      }
    } catch (error) {
      console.error("Error cargando resumen al cambiar modo:", error);
    }
  };

  const cargarDatos = async () => {
    if (!puntoId) {
      Alert.alert("Error", "No se especificó el punto de venta");
      router.back();
      return;
    }

    try {
      setLoading(true);

      // Verificación directa en la base de datos para evitar condiciones de carrera
      const hoy = getFechaLocal();

      // Verificar si realmente hay apertura y cierre hoy (consulta directa)
      const aperturaReal = await CierreService.getAperturaHoy(puntoId!);
      const cierreReal = await CierreService.getCierreHoy(puntoId!);

      const existeApertura = !!aperturaReal;
      const existeCierre = !!cierreReal;

      console.log("🔍 DEBUG: cargarDatos - verificación directa:");
      console.log("- aperturaReal:", aperturaReal);
      console.log("- cierreReal:", cierreReal);
      console.log("- existeApertura:", existeApertura);
      console.log("- existeCierre:", existeCierre);

      setYaAbiertoHoy(existeApertura);
      setYaCerradoHoy(existeCierre);

      // Si ya hay apertura, obtener la última para mostrar información
      if (existeApertura) {
        const ultimaApertura = await CierreService.getAperturaHoy(puntoId!);
        setUltimaAperturaHoy(ultimaApertura);
        if (ultimaApertura) {
          setFondoCaja(ultimaApertura.fondo_caja.toString());
        }
      }

      // Si ya hay un cierre, obtener el último para mostrar información
      if (existeCierre) {
        const ultimoCierre = await CierreService.getCierreHoy(puntoId!);
        setUltimoCierreHoy(ultimoCierre);
      }

      // Cargar información del punto
      const puntoData = await PuntoHelper.getById(puntoId);
      if (!puntoData) {
        Alert.alert("Error", "Punto no encontrado");
        return;
      }
      setPunto(puntoData);

      // Cargar productos para ambos modos
      const productosData = await CierreService.getProductosParaCierre(puntoId);
      setProductos(productosData);

      // Calcular resumen inicial (siempre en modo cierre)
      if (modo === "cierre") {
        if (existeCierre) {
          console.log(
            "🔍 DEBUG: cargarDatos - existeCierre, usando datos del cierre guardado",
          );
          // Usar los datos del cierre guardado en lugar de recalcular
          if (cierreReal) {
            const resumenCierre = {
              total_ventas: cierreReal.total_ventas || 0,
              total_efectivo: cierreReal.total_efectivo || 0,
              total_transferencia: cierreReal.total_transferencia || 0,
              total_gastos: cierreReal.total_gastos || 0,
              total_ganancias: cierreReal.total_ganancias || 0,
              total_extraido: cierreReal.total_extraido || 0,
              total_perdidas: cierreReal.total_perdidas || 0,
              perdidas_inventario: cierreReal.perdidas_inventario || 0,
              deuda_pendiente: cierreReal.deuda_pendiente || 0,
              deuda_pagada: cierreReal.deuda_pagada || 0,
              productos_correctos: cierreReal.productos_correctos || 0,
              productos_incorrectos: cierreReal.productos_incorrectos || 0,
              cambios_precios: [], // Los cambios de precio se cargarían por separado si es necesario
              prestamos_dia: [], // Los préstamos se cargarían por separado si es necesario
              productos_baja: [], // Los productos dados de baja se cargarían por separado si es necesario
            };
            setResumen(resumenCierre);

            // Calcular y actualizar ganancias del día
            const gananciasDelDia = await calcularGananciasDia();
            setGananciasReales(gananciasDelDia);

            // Calcular y actualizar gastos desglosados
            const gastosDesglosadosDia = await calcularGastosDia();
            setGastosDesglosados(gastosDesglosadosDia);
          }
        } else {
          console.log(
            "🔍 DEBUG: cargarDatos - no hay cierre, obteniendo resumen básico",
          );
          // Obtener resumen básico del día para mostrar información
          const resumenBasico = await obtenerResumenBasicoDia();
          setResumen(resumenBasico);

          // Calcular y actualizar ganancias del día
          const gananciasDelDia = await calcularGananciasDia();
          setGananciasReales(gananciasDelDia);

          // Calcular y actualizar gastos desglosados
          const gastosDesglosadosDia = await calcularGastosDia();
          setGastosDesglosados(gastosDesglosadosDia);
        }
      } else {
        console.log("🔍 DEBUG: cargarDatos - modo apertura, limpiando resumen");
        // Limpiar resumen si no es modo cierre
        setResumen(null);
      }

      // Cargar historial de cierres y aperturas
      await cargarHistorialCierres();
      await cargarHistorialAperturas();
    } catch (error) {
      console.error("Error cargando datos:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorialAperturas = async (pagina: number = 0) => {
    try {
      setCargandoAperturas(true);
      const [aperturas, total] = await Promise.all([
        CierreService.obtenerHistorialAperturas(
          puntoId!,
          pagina,
          aperturasPorPagina,
        ),
        CierreService.obtenerTotalAperturas(puntoId!),
      ]);

      setHistorialAperturas(aperturas);
      setTotalAperturas(total);
      setPaginaActualAperturas(pagina);
    } catch (error) {
      console.error("Error cargando historial de aperturas:", error);
      Alert.alert("Error", "No se pudo cargar el historial de aperturas");
    } finally {
      setCargandoAperturas(false);
    }
  };

  const cargarHistorialCierres = async (pagina: number = 0) => {
    try {
      setCargandoHistorial(true);
      const [cierres, total] = await Promise.all([
        CierreService.obtenerHistorialCierres(
          puntoId!,
          pagina,
          cierresPorPagina,
        ),
        CierreService.obtenerTotalCierres(puntoId!),
      ]);

      setHistorialCierres(cierres);
      setTotalCierres(total);
      setPaginaActual(pagina);
    } catch (error) {
      console.error("Error cargando historial de cierres:", error);
      Alert.alert("Error", "No se pudo cargar el historial de cierres");
    } finally {
      setCargandoHistorial(false);
    }
  };

  const cargarCambiosPrecioDeCierre = async (cierreId: number) => {
    try {
      const cambios =
        await CierreService.obtenerCambiosPrecioDeCierre(cierreId);
      setCambiosPrecioCierre(cambios);
      setMostrarCambiosPrecio(true);
    } catch (error) {
      console.error("Error cargando cambios de precios del cierre:", error);
      Alert.alert("Error", "No se pudieron cargar los cambios de precios");
    }
  };

  const actualizarCantidadFisica = (productoId: number, cantidad: string) => {
    const cantidadNum = parseInt(cantidad) || 0;

    // Actualizar estado inmediatamente para la UI
    const productosActualizados = productos.map((p) =>
      p.id === productoId ? { ...p, cantidad_fisica: cantidadNum } : p,
    );
    setProductos(productosActualizados);

    // Limpiar timer anterior
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Configurar nuevo timer para actualizar el resumen
    const nuevoTimer = setTimeout(() => {
      console.log(
        "🔄 Actualizando resumen después de modificar cantidad física",
      );
      if (resumen || modo === "cierre") {
        calcularResumenActualizado(productosActualizados);
      }
    }, 500); // Esperar 500ms después de que el usuario deje de escribir

    setDebounceTimer(nuevoTimer);
  };

  const calcularResumenActualizado = async (
    productosActualizados: ProductoInventario[],
  ) => {
    try {
      console.log("🔍 DEBUG: calcularResumenActualizado llamado");

      if (!puntoId) {
        console.log("🚫 No hay puntoId, omitiendo cálculo de resumen");
        return;
      }

      // Si hay un cierre existente, usar el cálculo completo
      if (yaCerradoHoy) {
        console.log("🔄 Hay cierre existente, calculando resumen completo");
        const montoExtraidoNum = parseFloat(montoExtraido) || 0;
        const nuevoResumen = await CierreService.calcularResumen(
          puntoId,
          productosActualizados,
          montoExtraidoNum,
        );
        setResumen(nuevoResumen);
      } else {
        // Si no hay cierre, calcular resumen básico actualizado
        console.log("🔄 No hay cierre, calculando resumen básico actualizado");

        // Calcular pérdidas de inventario básicas con los productos actualizados
        let productosCorrectos = 0;
        let productosIncorrectos = 0;
        let totalPerdidas = 0;

        for (const producto of productosActualizados) {
          const cantidadFisica = producto.cantidad_fisica || 0;
          const diferencia = cantidadFisica - producto.cantidad_sistema;

          if (diferencia === 0) {
            productosCorrectos++;
          } else {
            productosIncorrectos++;
            if (diferencia < 0) {
              const perdidaProducto =
                Math.abs(diferencia) * producto.precio_coste;
              totalPerdidas += perdidaProducto;
            }
          }
        }

        // Obtener otros datos que no cambian con el inventario
        const hoy = getFechaLocal();
        const ventasDia = await getFirst<any>(
          `SELECT 
            COALESCE(SUM(total_venta), 0) as total_ventas,
            COALESCE(SUM(total_efectivo), 0) as total_efectivo,
            COALESCE(SUM(total_transferencia), 0) as total_transferencia
          FROM Venta 
          WHERE punto_id = ? AND DATE(creado_en) = ?`,
          [puntoId, hoy],
        );

        // Obtener gastos del período y calcular montos reales (como en gastos.tsx)
        const gastosPeriodo = await GastoService.obtenerGastosPorPeriodo(
          puntoId,
          "hoy",
        );

        let gastosDia = 0;
        for (const gasto of gastosPeriodo) {
          if (gasto.categoria === "General") {
            // Sumar gastos generales del día
            gastosDia += Math.abs(gasto.precio || 0);
          } else if (gasto.categoria === "Salario") {
            // Para salarios, calcular el monto real según el período y el tipo
            const esPorcentaje =
              gasto.es_porcentaje === 1 ||
              (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);

            if (esPorcentaje) {
              // Salario porcentual: calcular basado en ventas
              const montoReal =
                await GastoService.obtenerVentasTrabajadorPeriodo(
                  puntoId,
                  gasto.id!,
                  "hoy",
                );

              // Obtener porcentaje vigente para hoy
              const porcentajeVigente =
                await GastoService.obtenerPorcentajeVigenteEnFecha(
                  gasto.id!,
                  getFechaLocal(),
                );

              const salarioTeorico = (montoReal * porcentajeVigente) / 100;

              // Obtener consumos propios del trabajador de hoy
              const consumosPropios =
                await GastoService.obtenerConsumosPropiosPeriodo(
                  puntoId,
                  gasto.nombre || "Sin nombre",
                  "hoy",
                );

              // Salario final = teórico - consumos del día
              const salarioFinal = salarioTeorico - consumosPropios;
              gastosDia += salarioFinal;
            } else {
              // Salario fijo: usar el precio guardado
              gastosDia += gasto.precio || 0;
            }
          }
        }

        console.log(
          "🔍 DEBUG: Gastos del día (General + Salarios calculados):",
          gastosDia,
        );

        const gananciasDia = await getFirst<any>(
          `SELECT 
            COALESCE(SUM((dv.precio_unitario - COALESCE(dv.precio_coste_real, 0)) * dv.cantidad), 0) as total_ganancias
          FROM Venta v
          JOIN DetalleVenta dv ON v.id = dv.venta_id
          WHERE v.punto_id = ? AND DATE(v.creado_en) = ?`,
          [puntoId, hoy],
        );

        // Obtener productos dados de baja y préstamos (no cambian con el inventario)
        const productosBaja =
          await CierreService.getProductosDadosDeBaja(puntoId);
        const perdidasPorBaja = productosBaja.reduce(
          (total, producto) => total + producto.total_perdida,
          0,
        );

        const prestamosDia = await CierreService.getPrestamosDia(puntoId);
        const totalPrestamos = prestamosDia.reduce(
          (total, prestamo) => total + prestamo.monto,
          0,
        );

        // Calcular deuda pendiente y pagada del día
        const deudaPendiente = await getSingleValue(
          `SELECT COALESCE(SUM(monto), 0) 
           FROM PrestamoDeuda 
           WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pendiente' AND DATE(fecha_inicio) = ?`,
          [puntoId, hoy],
        );

        const deudaPagada = await getSingleValue(
          `SELECT COALESCE(SUM(monto), 0) 
           FROM PrestamoDeuda 
           WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pagado' AND DATE(actualizado_en) = ?`,
          [puntoId, hoy],
        );

        console.log("🔍 DEBUG: Ganancias del día (actualizado):", gananciasDia);
        console.log(
          "🔍 DEBUG: Ganancias netas (actualizado):",
          gananciasDia?.total_ganancias
            ? gananciasDia.total_ganancias -
                (totalPerdidas + perdidasPorBaja + (gastosDia || 0))
            : 0,
        );

        const resumenActualizado = {
          total_ventas: ventasDia?.total_ventas || 0,
          total_efectivo: ventasDia?.total_efectivo || 0,
          total_transferencia: ventasDia?.total_transferencia || 0,
          total_gastos: gastosDia || 0,
          total_ganancias: gananciasDia?.total_ganancias || 0,
          deuda_pendiente: deudaPendiente || 0,
          deuda_pagada: deudaPagada || 0,
          total_extraido: parseFloat(montoExtraido) || 0,
          productos_correctos: productosCorrectos,
          productos_incorrectos: productosIncorrectos,
          total_perdidas: totalPerdidas + perdidasPorBaja,
          perdidas_inventario: totalPerdidas,
          productos_baja: productosBaja,
          cambios_precios: [],
          prestamos_dia: prestamosDia,
          total_prestamos: totalPrestamos,
        };

        setResumen(resumenActualizado);
        console.log(
          "✅ Resumen básico actualizado con nuevas pérdidas:",
          totalPerdidas + perdidasPorBaja,
        );

        // Calcular y actualizar ganancias del día
        const gananciasDelDia = await calcularGananciasDia();
        setGananciasReales(gananciasDelDia);

        // Calcular y actualizar gastos desglosados
        const gastosDesglosadosDia = await calcularGastosDia();
        setGastosDesglosados(gastosDesglosadosDia);
      }
    } catch (error) {
      console.error("Error calculando resumen:", error);
    }
  };

  // Función para calcular ganancias del día (como en ganancia.tsx)
  const calcularGananciasDia = async (): Promise<number> => {
    if (!puntoId) return 0;

    try {
      const hoy = getFechaLocal();

      // Obtener ganancia bruta del día (igual que ganancia.tsx)
      const gananciaBrutaResult = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (p.precio_coste * dv.cantidad)), 0) as ganancias_periodo
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
         AND DATE(v.creado_en) = ?`,
        [puntoId, hoy],
      );

      return gananciaBrutaResult || 0;
    } catch (error) {
      console.error("Error calculando ganancias del día:", error);
      return 0;
    }
  };

  // Función para calcular gastos totales del día
  const calcularGastosDia = async (): Promise<{
    total: number;
    salarios: number;
  }> => {
    if (!puntoId) return { total: 0, salarios: 0 };

    try {
      // Obtener gastos del período
      const gastosPeriodo = await GastoService.obtenerGastosPorPeriodo(
        puntoId,
        "hoy",
      );

      let gastosDia = 0;
      let salariosDia = 0;

      for (const gasto of gastosPeriodo) {
        if (gasto.categoria === "General") {
          // Sumar gastos generales del día
          gastosDia += Math.abs(gasto.precio || 0);
        } else if (gasto.categoria === "Salario") {
          // Para salarios, calcular el monto real según el período y el tipo
          const esPorcentaje =
            gasto.es_porcentaje === 1 ||
            (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);

          if (esPorcentaje) {
            // Salario porcentual: calcular basado en ventas
            const montoReal = await GastoService.obtenerVentasTrabajadorPeriodo(
              puntoId,
              gasto.id!,
              "hoy",
            );

            // Obtener porcentaje vigente para hoy
            const porcentajeVigente =
              await GastoService.obtenerPorcentajeVigenteEnFecha(
                gasto.id!,
                getFechaLocal(),
              );

            const salarioTeorico = (montoReal * porcentajeVigente) / 100;

            // Obtener consumos propios del trabajador de hoy
            const consumosPropios =
              await GastoService.obtenerConsumosPropiosPeriodo(
                puntoId,
                gasto.nombre || "Sin nombre",
                "hoy",
              );

            // Salario final = teórico - consumos del día
            const salarioFinal = salarioTeorico - consumosPropios;
            gastosDia += salarioFinal;
            salariosDia += salarioFinal;
          } else {
            // Salario fijo: usar el precio guardado
            gastosDia += gasto.precio || 0;
            salariosDia += gasto.precio || 0;
          }
        }
      }

      return { total: gastosDia, salarios: salariosDia };
    } catch (error) {
      console.error("Error calculando gastos del día:", error);
      return { total: 0, salarios: 0 };
    }
  };

  const extraerDinero = () => {
    const monto = parseFloat(montoExtraido) || 0;
    if (monto <= 0) {
      Alert.alert("Error", "El monto a extraer debe ser mayor que 0");
      return;
    }

    if (
      !resumen ||
      monto > resumen.total_efectivo + resumen.total_transferencia
    ) {
      Alert.alert(
        "Error",
        "El monto a extraer no puede ser mayor al total de ventas",
      );
      return;
    }

    setMostrarModalExtraer(false);
    calcularResumenActualizado(productos);
  };

  const realizarApertura = async () => {
    if (!puntoId) return;

    const montoFondo = parseFloat(fondoCaja) || 0;
    if (montoFondo < 0) {
      Alert.alert("Error", "El fondo de caja no puede ser negativo");
      return;
    }

    // Advertir si ya existe una apertura hoy
    if (yaAbiertoHoy) {
      Alert.alert(
        "⚠️ Advertencia de Suplantación",
        `Ya se realizó una apertura hoy. Esta nueva apertura SUPLANTARÁ a la anterior.\n\n¿Desea continuar?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => realizarAperturaConfirmado() },
        ],
      );
    } else {
      realizarAperturaConfirmado();
    }
  };

  const realizarAperturaConfirmado = async () => {
    if (!puntoId) return;

    // Validaciones obligatorias
    if (!observaciones || observaciones.trim() === "") {
      Alert.alert(
        "Validación Requerida",
        "Debe ingresar una observación obligatoria para realizar la apertura.",
        [{ text: "OK" }],
      );
      return;
    }

    // Validar que el inventario físico esté completo
    const sinCantidadFisica = productos.filter(
      (p) =>
        p.cantidad_fisica === undefined ||
        p.cantidad_fisica === null ||
        p.cantidad_fisica === 0,
    );

    if (sinCantidadFisica.length > 0) {
      Alert.alert(
        "Validación Requerida",
        `Debe verificar el inventario físico de todos los productos. Faltan ${sinCantidadFisica.length} productos por verificar.`,
        [{ text: "OK" }],
      );
      return;
    }

    setRealizandoOperacion(true);

    try {
      const montoFondo = parseFloat(fondoCaja) || 0;

      console.log(
        `🔍 DEBUG apertura: trabajadorSeleccionado=`,
        trabajadorSeleccionado,
      );
      console.log(
        `🔍 DEBUG apertura: trabajadorSeleccionado?.id=`,
        trabajadorSeleccionado?.id,
      );
      console.log(
        `🔍 DEBUG apertura: puntoId=${puntoId}, montoFondo=${montoFondo}`,
      );

      const resultado = await CierreService.crearApertura(
        puntoId,
        montoFondo,
        observaciones,
        trabajadorSeleccionado?.id,
      );

      console.log(`🔍 DEBUG apertura: resultado=`, resultado);

      if (resultado.success) {
        Alert.alert(
          "¡Apertura Completa!",
          `La apertura se ha realizado correctamente.\n\n` +
            `Fondo de caja: $${montoFondo.toFixed(2)}\n` +
            `Trabajador: ${
              trabajadorSeleccionado
                ? `${trabajadorSeleccionado.nombre} (${
                    trabajadorSeleccionado.es_porcentaje === 1
                      ? `${trabajadorSeleccionado.porcentaje}%`
                      : `$${trabajadorSeleccionado.salario_fijo || 0} sueldo diario`
                  })`
                : "No asignado"
            }\n` +
            `Observaciones: ${observaciones}\n` +
            `Inventario verificado: ${productos.length} productos\n` +
            `\n¡Listo para comenzar a vender!` +
            (trabajadorSeleccionado
              ? `\n\n💰 Solo ${trabajadorSeleccionado.nombre} generará salario hoy.`
              : ""),
          [{ text: "OK", onPress: () => router.back() }],
        );

        // Recargar datos para actualizar el historial
        await cargarDatos();
      } else {
        Alert.alert("Error", resultado.message);
      }
    } catch (error) {
      console.error("Error realizando apertura:", error);
      Alert.alert("Error", "No se pudo realizar la apertura");
    } finally {
      setRealizandoOperacion(false);
    }
  };

  const realizarCierre = async () => {
    if (!puntoId) return;

    // Advertir si ya existe un cierre hoy
    if (yaCerradoHoy) {
      Alert.alert(
        "⚠️ Advertencia de Suplantación",
        `Ya se realizó un cierre hoy a las ${ultimoCierreHoy ? new Date(ultimoCierreHoy.fecha_cierre).toLocaleTimeString() : ""}.\n\nEste nuevo cierre SUPLANTARÁ al anterior y reemplazará todos los datos.\n\n¿Desea continuar?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => realizarCierreConfirmado() },
        ],
      );
    } else {
      realizarCierreConfirmado();
    }
  };

  const realizarCierreConfirmado = async () => {
    if (!puntoId) return;

    // Validaciones obligatorias
    if (!observaciones || observaciones.trim() === "") {
      Alert.alert(
        "Validación Requerida",
        "Debe ingresar una observación obligatoria para realizar el cierre.",
        [{ text: "OK" }],
      );
      return;
    }

    // Validar que todos los productos tengan cantidad física
    const sinCantidadFisica = productos.filter(
      (p) =>
        p.cantidad_fisica === undefined ||
        p.cantidad_fisica === null ||
        p.cantidad_fisica === 0,
    );
    if (sinCantidadFisica.length > 0) {
      Alert.alert(
        "Validación Requerida",
        `Debe verificar el inventario físico de todos los productos. Faltan ${sinCantidadFisica.length} productos por verificar.`,
        [{ text: "OK" }],
      );
      return;
    }

    // Validar que no haya una preorden activa (en BD o en AsyncStorage)
    const hoy = getFechaLocal();
    const preordenActiva = await getFirst<any>(
      "SELECT * FROM PrestamoDeuda WHERE punto_id = ? AND tipo = 'preorden' AND estado = 'activa' AND DATE(fecha_inicio) = ?",
      [puntoId!, hoy],
    );

    // También verificar preordenes guardadas en AsyncStorage
    const preordenesStorage = await AsyncStorage.getItem(
      `preordenes_${puntoId}`,
    );
    const tienePreordenesStorage =
      preordenesStorage && JSON.parse(preordenesStorage).length > 0;

    console.log(
      "🔍 DEBUG: Validación de preorden en cierre - puntoId:",
      puntoId,
      "hoy:",
      hoy,
    );
    console.log("🔍 DEBUG: Preorden activa encontrada (BD):", preordenActiva);
    console.log(
      "🔍 DEBUG: Preordenes en AsyncStorage:",
      tienePreordenesStorage,
    );

    if (preordenActiva || tienePreordenesStorage) {
      Alert.alert(
        "⚠️ Preorden Activa",
        "Hay una preorden activa. No se puede realizar el cierre hasta completar la preorden.",
        [{ text: "OK" }],
      );
      return;
    }

    setRealizandoOperacion(true);

    try {
      const montoExtraidoNum = parseFloat(montoExtraido) || 0;
      const resultado = await CierreService.crearCierre(
        puntoId,
        productos,
        montoExtraidoNum,
        observaciones,
      );

      if (resultado.success) {
        Alert.alert(
          "¡Cierre Completo!",
          `El cierre se ha realizado correctamente.\n\n` +
            `📊 RESUMEN DEL DÍA\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Total Ventas: $${resumen?.total_ventas?.toFixed(2) || "0.00"}\n` +
            `Efectivo: $${resumen?.total_efectivo?.toFixed(2) || "0.00"}\n` +
            `Transferencia: $${resumen?.total_transferencia?.toFixed(2) || "0.00"}\n` +
            `Ventas - Gastos: $${resumen && gastosDesglosados ? (resumen.total_ventas - gastosDesglosados.total).toFixed(2) : "0.00"}\n` +
            `Gastos (Salario): $${gastosDesglosados ? gastosDesglosados.total.toFixed(2) : "0.00"}${gastosDesglosados && gastosDesglosados.salarios > 0 ? ` (Salario: $${gastosDesglosados.salarios.toFixed(2)})` : ""}\n` +
            `Dinero en Caja: $${resumen ? (resumen.total_efectivo + (ultimaAperturaHoy?.fondo_caja || parseFloat(fondoCaja) || 0) - (resumen.total_extraido || 0)).toFixed(2) : "0.00"}\n` +
            `Pérdidas: $${resumen ? (resumen.total_perdidas + (resumen.deuda_pendiente || 0)).toFixed(2) : "0.00"}\n` +
            `Fondo de caja: $${ultimaAperturaHoy?.fondo_caja ? ultimaAperturaHoy.fondo_caja.toFixed(2) : fondoCaja || "0.00"}\n` +
            `Extraído: $${resumen?.total_extraido?.toFixed(2) || montoExtraido || "0.00"}\n` +
            `Deuda Pendiente: $${resumen?.deuda_pendiente?.toFixed(2) || "0.00"}\n` +
            `Deuda Pagada: $${resumen?.deuda_pagada?.toFixed(2) || "0.00"}\n\n` +
            `📦 INVENTARIO\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Productos correctos: ${resultado.resumen?.productos_correctos || 0}\n` +
            `Productos con diferencia: ${resultado.resumen?.productos_incorrectos || 0}\n` +
            `Pérdidas por inventario: $${resultado.resumen?.total_perdidas?.toFixed(2) || "0.00"}`,
          [{ text: "OK", onPress: () => router.back() }],
        );

        // Recargar datos para actualizar el historial
        await cargarDatos();
      } else {
        Alert.alert("Error", resultado.message);
      }
    } catch (error) {
      console.error("Error realizando cierre:", error);
      Alert.alert("Error", "No se pudo realizar el cierre");
    } finally {
      setRealizandoOperacion(false);
    }
  };

  // Funciones para el modal de dinero físico
  const incrementarBillete = (denominacion: number) => {
    setDineroFisico((prev) => ({
      ...prev,
      [denominacion]: prev[denominacion] + 1,
    }));
  };

  const disminuirBillete = (denominacion: number) => {
    setDineroFisico((prev) => ({
      ...prev,
      [denominacion]: Math.max(0, prev[denominacion] - 1),
    }));
  };

  const actualizarCantidadManual = (denominacion: number, text: string) => {
    const cantidad = parseInt(text) || 0;
    if (cantidad >= 0 && cantidad <= 9999) {
      setDineroFisico((prev) => ({ ...prev, [denominacion]: cantidad }));
      setValorTemporal(text);
    }
  };

  const manejarFoco = (denominacion: number) => {
    setEditandoDenominacion(denominacion);
    setValorTemporal(dineroFisico[denominacion].toString());
  };

  const manejarPerdidaFoco = () => {
    setEditandoDenominacion(null);
    setValorTemporal("");
  };

  const calcularTotalDineroFisico = () => {
    return Object.entries(dineroFisico).reduce(
      (total, [denominacion, cantidad]) =>
        total + parseInt(denominacion) * cantidad,
      0,
    );
  };

  const verificarDineroFisico = () => {
    const totalFisico = calcularTotalDineroFisico();
    const totalSistema = resumen?.total_efectivo || 0;

    Alert.alert(
      "Verificación de Dinero",
      `Dinero en sistema: $${totalSistema.toFixed(2)}\nDinero físico: $${totalFisico.toFixed(2)}\nDiferencia: $${(totalFisico - totalSistema).toFixed(2)}`,
      [{ text: "OK", onPress: () => setMostrarModalDineroFisico(false) }],
    );
  };

  // === FUNCIÓN PARA OBTENER RESUMEN BÁSICO DEL DÍA ===
  const obtenerResumenBasicoDia = async () => {
    if (!puntoId) return null;

    try {
      const hoy = getFechaLocal();

      // Obtener totales del día
      const ventasDia = await getFirst<any>(
        `SELECT 
          COALESCE(SUM(total_venta), 0) as total_ventas,
          COALESCE(SUM(total_efectivo), 0) as total_efectivo,
          COALESCE(SUM(total_transferencia), 0) as total_transferencia
        FROM Venta 
        WHERE punto_id = ? AND DATE(creado_en) = ?`,
        [puntoId, hoy],
      );

      console.log("🔍 DEBUG: Ventas del día:", ventasDia);
      console.log("🔍 DEBUG: PuntoId:", puntoId, "Fecha:", hoy);

      // Obtener gastos del período y calcular montos reales (como en gastos.tsx)
      const gastosPeriodo = await GastoService.obtenerGastosPorPeriodo(
        puntoId,
        "hoy",
      );

      let gastosDia = 0;
      for (const gasto of gastosPeriodo) {
        if (gasto.categoria === "General") {
          // Sumar gastos generales del día
          gastosDia += Math.abs(gasto.precio || 0);
        } else if (gasto.categoria === "Salario") {
          // Para salarios, calcular el monto real según el período (como en gastos.tsx)
          const montoReal = await GastoService.obtenerVentasTrabajadorPeriodo(
            puntoId,
            gasto.id!,
            "hoy",
          );

          // Obtener porcentaje vigente para hoy
          const porcentajeVigente =
            await GastoService.obtenerPorcentajeVigenteEnFecha(
              gasto.id!,
              getFechaLocal(),
            );

          const salarioTeorico = (montoReal * porcentajeVigente) / 100;

          // Obtener consumos propios del trabajador de hoy
          const consumosPropios =
            await GastoService.obtenerConsumosPropiosPeriodo(
              puntoId,
              gasto.nombre || "Sin nombre",
              "hoy",
            );

          // Salario final = teórico - consumos del día
          const salarioFinal = salarioTeorico - consumosPropios;
          gastosDia += salarioFinal;
        }
      }

      console.log(
        "🔍 DEBUG: Gastos del día (General + Salarios calculados) - obtenerResumenBasicoDia:",
        gastosDia,
      );

      const gananciasDia = await getFirst<any>(
        `SELECT 
          COALESCE(SUM((dv.precio_unitario - COALESCE(dv.precio_coste_real, 0)) * dv.cantidad), 0) as total_ganancias
        FROM Venta v
        JOIN DetalleVenta dv ON v.id = dv.venta_id
        WHERE v.punto_id = ? AND DATE(v.creado_en) = ?`,
        [puntoId, hoy],
      );

      console.log("🔍 DEBUG: Ganancias del día:", gananciasDia);

      // Calcular pérdidas de inventario básicas
      let productosCorrectos = 0;
      let productosIncorrectos = 0;
      let totalPerdidas = 0;

      // Obtener productos del punto para calcular diferencias
      const productosData = await CierreService.getProductosParaCierre(puntoId);

      for (const producto of productosData) {
        const cantidadFisica = producto.cantidad_fisica || 0;
        const diferencia = cantidadFisica - producto.cantidad_sistema;

        if (diferencia === 0) {
          productosCorrectos++;
        } else {
          productosIncorrectos++;
          if (diferencia < 0) {
            const perdidaProducto =
              Math.abs(diferencia) * producto.precio_coste;
            totalPerdidas += perdidaProducto;
          }
        }
      }

      // Obtener productos dados de baja
      const productosBaja =
        await CierreService.getProductosDadosDeBaja(puntoId);
      const perdidasPorBaja = productosBaja.reduce(
        (total, producto) => total + producto.total_perdida,
        0,
      );

      console.log(
        "🔍 DEBUG: Ganancias netas (ganancias - pérdidas - gastos):",
        gananciasDia?.total_ganancias
          ? gananciasDia.total_ganancias -
              (totalPerdidas + perdidasPorBaja + (gastosDia || 0))
          : 0,
      );

      // Calcular dinero en caja esperado
      const dineroEnCaja = gananciasDia?.total_ganancias
        ? gananciasDia.total_ganancias -
          (totalPerdidas + perdidasPorBaja + (gastosDia || 0))
        : 0;
      console.log("🔍 DEBUG: Dinero en caja esperado:", dineroEnCaja);

      // Obtener préstamos del día
      const prestamosDia = await CierreService.getPrestamosDia(puntoId);
      const totalPrestamos = prestamosDia.reduce(
        (total, prestamo) => total + prestamo.monto,
        0,
      );

      // Calcular deuda pendiente y pagada del día
      const deudaPendiente = await getSingleValue(
        `SELECT COALESCE(SUM(monto), 0) 
         FROM PrestamoDeuda 
         WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pendiente' AND DATE(fecha_inicio) = ?`,
        [puntoId, hoy],
      );

      const deudaPagada = await getSingleValue(
        `SELECT COALESCE(SUM(monto), 0) 
         FROM PrestamoDeuda 
         WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pagado' AND DATE(actualizado_en) = ?`,
        [puntoId, hoy],
      );

      return {
        total_ventas: ventasDia?.total_ventas || 0,
        total_efectivo: ventasDia?.total_efectivo || 0,
        total_transferencia: ventasDia?.total_transferencia || 0,
        total_gastos: gastosDia || 0,
        total_ganancias: gananciasDia?.total_ganancias || 0,
        deuda_pendiente: deudaPendiente || 0,
        deuda_pagada: deudaPagada || 0,
        total_extraido: parseFloat(montoExtraido) || 0,
        productos_correctos: productosCorrectos,
        productos_incorrectos: productosIncorrectos,
        total_perdidas: totalPerdidas + perdidasPorBaja,
        perdidas_inventario: totalPerdidas,
        productos_baja: productosBaja,
        cambios_precios: [], // No calcular cambios de precios en resumen básico
        prestamos_dia: prestamosDia,
        total_prestamos: totalPrestamos,
      };
    } catch (error) {
      console.error("Error obteniendo resumen básico:", error);
      return null;
    }
  };

  const getEstadoProducto = (producto: ProductoInventario) => {
    const cantidadFisica = producto.cantidad_fisica || 0;
    const diferencia = cantidadFisica - producto.cantidad_sistema;

    if (diferencia === 0)
      return { estado: "correcto", color: "#4CAF50", texto: "Correcto" };
    if (diferencia < 0)
      return {
        estado: "faltante",
        color: "#F44336",
        texto: `Faltan ${Math.abs(diferencia)}`,
      };
    return {
      estado: "sobrante",
      color: "#FF9800",
      texto: `Sobran ${diferencia}`,
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Flecha de regresar a la izquierda */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>

          {/* Título centrado */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              {modo === "apertura" ? "Apertura de Caja" : "Cierre de Caja"}
            </Text>
          </View>

          {/* Espacio vacío a la derecha para balance */}
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* Filtro de modo */}
      <View style={styles.modoFilter}>
        <TouchableOpacity
          style={[
            styles.modoButton,
            modo === "apertura" && styles.modoButtonActive,
          ]}
          onPress={() => {
            setModo("apertura");
            cargarDatos();
          }}
        >
          <View style={styles.modoButtonContent}>
            <Ionicons
              name="cash-outline"
              size={20}
              color={modo === "apertura" ? "#fff" : "#007AFF"}
            />
            <Text
              style={[
                styles.modoButtonText,
                modo === "apertura" && styles.modoButtonTextActive,
              ]}
            >
              Apertura
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modoButton,
            modo === "cierre" && styles.modoButtonActive,
          ]}
          onPress={() => {
            setModo("cierre");
            cargarDatos();
          }}
        >
          <View style={styles.modoButtonContent}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={modo === "cierre" ? "#fff" : "#007AFF"}
            />
            <Text
              style={[
                styles.modoButtonText,
                modo === "cierre" && styles.modoButtonTextActive,
              ]}
            >
              Cierre
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Contenido específico para modo apertura */}
        {modo === "apertura" && (
          <>
            {/* Alerta si ya existe apertura */}
            {yaAbiertoHoy && (
              <View style={styles.alertaCierreCard}>
                <Text style={styles.alertaCierreTitle}>
                  ⚠️ Advertencia de Apertura
                </Text>
                <Text style={styles.alertaCierreText}>
                  Ya existe una apertura hoy a las{" "}
                  {ultimaAperturaHoy
                    ? new Date(
                        ultimaAperturaHoy.fecha_cierre,
                      ).toLocaleTimeString()
                    : ""}
                  . Si realiza una nueva apertura, esta suplantará a la
                  anterior.
                </Text>
                <Text style={styles.alertaCierreText}>
                  Última apertura: ${ultimaAperturaHoy?.fondo_caja.toFixed(2)}{" "}
                  en fondo de caja
                </Text>
              </View>
            )}

            {/* Card del punto de venta */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={styles.puntoInfo}>
                  <Text style={styles.puntoNombre}>{punto?.nombre}</Text>
                  <Text style={styles.puntoTipo}>{punto?.tipo_negocio}</Text>
                </View>

                {/* Botones de acción */}
                <View style={styles.infoCardButtons}>
                  {/* Botón de Ver Historial de Aperturas */}
                  <TouchableOpacity
                    style={[styles.iconButton, styles.historyIconButton]}
                    onPress={() => setMostrarModalHistorialAperturas(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Tarjeta de apertura */}
            <View style={styles.aperturaCard}>
              <Text style={styles.aperturaTitle}>Configurar Apertura</Text>

              <View style={styles.aperturaRow}>
                <Text style={styles.aperturaLabel}>Fondo de caja:</Text>
                <TouchableOpacity
                  style={styles.fondoIconButton}
                  onPress={() => setMostrarModalFondoCaja(true)}
                >
                  <Ionicons name="cash-outline" size={16} color="white" />
                  <Text style={styles.fondoIconText}>
                    ${fondoCaja || "0.00"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.aperturaRow}>
                <Text style={styles.aperturaLabel}>Trabajador:</Text>
                <TouchableOpacity
                  style={[
                    styles.trabajadorButton,
                    trabajadorSeleccionado
                      ? styles.trabajadorButtonSelected
                      : styles.trabajadorButtonEmpty,
                  ]}
                  onPress={abrirModalTrabajador}
                >
                  <Text
                    style={[
                      styles.trabajadorButtonText,
                      trabajadorSeleccionado
                        ? styles.trabajadorButtonTextSelected
                        : styles.trabajadorButtonTextEmpty,
                    ]}
                  >
                    {trabajadorSeleccionado
                      ? `${trabajadorSeleccionado.nombre} (${
                          trabajadorSeleccionado.es_porcentaje === 1
                            ? `${trabajadorSeleccionado.porcentaje}%`
                            : `$${trabajadorSeleccionado.salario_fijo || 0} sueldo diario`
                        })`
                      : "Seleccionar trabajador"}
                  </Text>
                  <Ionicons
                    name={
                      trabajadorSeleccionado
                        ? "checkmark-circle"
                        : "person-outline"
                    }
                    size={16}
                    color={trabajadorSeleccionado ? "white" : "#6b7280"}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.aperturaRow}>
                <Text style={styles.aperturaLabel}>Fecha:</Text>
                <Text style={styles.aperturaValue}>
                  {new Date().toLocaleDateString()}
                </Text>
              </View>
            </View>

            {/* Card de Inventario Físico */}
            <View style={styles.productosCard}>
              <Text style={styles.cardTitle}>Inventario Físico</Text>
              {productos.map((producto) => {
                const estado = getEstadoProducto(producto);
                return (
                  <View key={producto.id} style={styles.productoRow}>
                    <View style={styles.productoInfo}>
                      <Text style={styles.productoNombre}>
                        {producto.nombre}
                      </Text>
                      <Text style={styles.productoCategoria}>
                        {producto.categoria}
                      </Text>
                    </View>

                    <View style={styles.cantidadesContainer}>
                      <View style={styles.cantidadColumn}>
                        <Text style={styles.cantidadLabel}>Sistema</Text>
                        <Text style={styles.cantidadValor}>
                          {producto.cantidad_sistema}
                        </Text>
                      </View>

                      <View style={styles.cantidadColumn}>
                        <Text style={styles.cantidadLabel}>Físico</Text>
                        <TextInput
                          style={[
                            styles.cantidadInput,
                            { borderColor: estado.color },
                          ]}
                          value={producto.cantidad_fisica?.toString() || ""}
                          onChangeText={(text) => {
                            const newProductos = productos.map((p) =>
                              p.id === producto.id
                                ? {
                                    ...p,
                                    cantidad_fisica: parseInt(text) || 0,
                                  }
                                : p,
                            );
                            setProductos(newProductos);
                          }}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>

                      <View style={styles.estadoColumn}>
                        <Text
                          style={[styles.estadoTexto, { color: estado.color }]}
                        >
                          {estado.texto}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Card de Observaciones y Acción */}
            <View style={styles.aperturaCard}>
              {/* Observaciones */}
              <View style={styles.observacionesCard}>
                <Text style={styles.cardTitle}>Observaciones</Text>
                <TextInput
                  style={styles.observacionesInput}
                  value={observaciones}
                  onChangeText={setObservaciones}
                  placeholder="OBSERVACIONES OBLIGATORIAS - Ingrese detalles de la apertura..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Botón de apertura */}
              <TouchableOpacity
                style={[
                  styles.aperturaButton,
                  (realizandoOperacion || yaAbiertoHoy) &&
                    styles.aperturaButtonDisabled,
                ]}
                onPress={() => {
                  if (yaAbiertoHoy) {
                    Alert.alert(
                      "⚠️ Advertencia de Suplantación",
                      `Ya se realizó una apertura hoy. Esta nueva apertura SUPLANTARÁ a la anterior.\n\n¿Desea continuar?`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Continuar",
                          onPress: () => realizarApertura(),
                        },
                      ],
                    );
                  } else {
                    realizarApertura();
                  }
                }}
                disabled={realizandoOperacion}
              >
                <Text style={styles.aperturaButtonText}>
                  {realizandoOperacion
                    ? "Realizando Apertura..."
                    : yaAbiertoHoy
                      ? "Suplantar Apertura Anterior"
                      : "Realizar Apertura del Día"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {/* Contenido específico para modo cierre */}
        {modo === "cierre" && (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={styles.puntoInfo}>
                  <Text style={styles.puntoNombre}>{punto?.nombre}</Text>
                  <Text style={styles.puntoTipo}>{punto?.tipo_negocio}</Text>
                </View>

                {/* Botones de acción */}
                <View style={styles.infoCardButtons}>
                  {/* Botón de Fondo de Caja (solo en modo apertura) */}
                  {modo === "apertura" && (
                    <TouchableOpacity
                      style={[styles.iconButton, styles.fondoIconButton]}
                      onPress={() => setMostrarModalFondoCaja(true)}
                    >
                      <Ionicons name="cash-outline" size={20} color="white" />
                    </TouchableOpacity>
                  )}

                  {/* Botón de Extraer Dinero (solo en modo cierre) */}
                  {modo === "cierre" && (
                    <TouchableOpacity
                      style={[styles.iconButton, styles.extractIconButton]}
                      onPress={() => setMostrarModalExtraer(true)}
                    >
                      <Ionicons name="wallet-outline" size={20} color="white" />
                    </TouchableOpacity>
                  )}

                  {/* Botón de Verificar Dinero Físico (solo en modo cierre) */}
                  {modo === "cierre" && (
                    <TouchableOpacity
                      style={[styles.iconButton, styles.verifyIconButton]}
                      onPress={() => setMostrarModalDineroFisico(true)}
                    >
                      <Ionicons name="cash-outline" size={20} color="white" />
                    </TouchableOpacity>
                  )}

                  {/* Botón de Ver Historial */}
                  <TouchableOpacity
                    style={[styles.iconButton, styles.historyIconButton]}
                    onPress={() => setMostrarModalHistorial(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Resumen del día - siempre mostrar en modo cierre */}
            {modo === "cierre" && (
              <View style={styles.resumenCard}>
                <Text style={styles.cardTitle}>Resumen del Día</Text>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Total Ventas:</Text>
                  <Text style={styles.resumenValue}>
                    ${resumen ? resumen.total_ventas.toFixed(2) : "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Efectivo:</Text>
                  <Text style={styles.resumenValue}>
                    ${resumen ? resumen.total_efectivo.toFixed(2) : "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Transferencia:</Text>
                  <Text style={styles.resumenValue}>
                    ${resumen ? resumen.total_transferencia.toFixed(2) : "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Ventas - Gastos:</Text>
                  <Text
                    style={[
                      styles.resumenValue,
                      {
                        color:
                          resumen &&
                          gastosDesglosados &&
                          resumen.total_ventas - gastosDesglosados.total < 0
                            ? "#F44336"
                            : "#4CAF50",
                      },
                    ]}
                  >
                    $
                    {resumen && gastosDesglosados
                      ? (
                          resumen.total_ventas - gastosDesglosados.total
                        ).toFixed(2)
                      : "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Gastos (Salario):</Text>
                  <Text style={[styles.resumenValue, { color: "#F44336" }]}>
                    $
                    {gastosDesglosados
                      ? gastosDesglosados.total.toFixed(2)
                      : "0.00"}
                    {gastosDesglosados &&
                      gastosDesglosados.salarios > 0 &&
                      ` (${gastosDesglosados.salarios.toFixed(2)})`}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Dinero en Caja:</Text>
                  <Text style={[styles.resumenValue, { color: "#2196F3" }]}>
                    $
                    {resumen
                      ? (
                          resumen.total_efectivo +
                          (ultimaAperturaHoy?.fondo_caja ||
                            parseFloat(fondoCaja) ||
                            0) -
                          (resumen.total_extraido || 0)
                        ).toFixed(2)
                      : "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Pérdidas:</Text>
                  <Text style={[styles.resumenValue, { color: "#F44336" }]}>
                    $
                    {resumen
                      ? (
                          resumen.total_perdidas +
                          (resumen.deuda_pendiente || 0)
                        ).toFixed(2)
                      : "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Fondo de caja:</Text>
                  <Text style={styles.resumenValue}>
                    $
                    {ultimaAperturaHoy?.fondo_caja
                      ? ultimaAperturaHoy.fondo_caja.toFixed(2)
                      : fondoCaja || "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Extraído:</Text>
                  <Text
                    style={[
                      styles.resumenValue,
                      {
                        color:
                          resumen?.total_extraido && resumen.total_extraido > 0
                            ? "#F44336"
                            : "#000",
                      },
                    ]}
                  >
                    $
                    {resumen
                      ? resumen.total_extraido.toFixed(2)
                      : montoExtraido || "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Deuda Pendiente:</Text>
                  <Text style={[styles.resumenValue, { color: "#FF5722" }]}>
                    ${resumen ? resumen.deuda_pendiente.toFixed(2) : "0.00"}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Deuda Pagada:</Text>
                  <Text style={[styles.resumenValue, { color: "#4CAF50" }]}>
                    ${resumen ? resumen.deuda_pagada.toFixed(2) : "0.00"}
                  </Text>
                </View>
              </View>
            )}

            {/* Préstamos del día */}
            {resumen?.prestamos_dia && resumen.prestamos_dia.length > 0 && (
              <View style={styles.prestamosCard}>
                <Text style={styles.cardTitle}>
                  💰 Préstamos del Día (Dinero no disponible)
                </Text>
                {resumen.prestamos_dia.map((prestamo) => (
                  <View key={prestamo.id} style={styles.prestamoRow}>
                    <View style={styles.prestamoInfo}>
                      <View style={styles.prestamoHeader}>
                        <Text style={styles.prestamoDescripcion}>
                          {prestamo.descripcion}
                        </Text>
                        <View
                          style={[
                            styles.estadoBadge,
                            prestamo.estado === "pagado"
                              ? styles.estadoPagado
                              : styles.estadoPendiente,
                          ]}
                        >
                          <Text
                            style={[
                              styles.estadoBadgeText,
                              prestamo.estado === "pagado"
                                ? styles.estadoPagadoText
                                : styles.estadoPendienteText,
                            ]}
                          >
                            {prestamo.estado === "pagado"
                              ? "✅ Pagado"
                              : "⏳ Pendiente"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.prestamoFechas}>
                        Inicio:{" "}
                        {new Date(prestamo.fecha_inicio).toLocaleDateString()} -
                        Vence:{" "}
                        {new Date(
                          prestamo.fecha_vencimiento,
                        ).toLocaleDateString()}
                      </Text>
                      {prestamo.notas && (
                        <Text style={styles.prestamoNotas}>
                          Notas: {prestamo.notas}
                        </Text>
                      )}
                    </View>
                    <View style={styles.prestamoMonto}>
                      <Text
                        style={[
                          styles.prestamoMontoText,
                          prestamo.estado === "pagado" && styles.montoPagado,
                        ]}
                      >
                        ${prestamo.monto.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
                <View style={styles.totalPrestamosRow}>
                  <Text style={styles.totalPrestamosLabel}>
                    Total préstamos del día:
                  </Text>
                  <Text style={styles.totalPrestamosValue}>
                    ${resumen.total_prestamos.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Productos dados de baja */}
            {resumen?.productos_baja && resumen.productos_baja.length > 0 && (
              <View style={styles.productosBajaCard}>
                <Text style={styles.cardTitle}>
                  ⚠️ Productos Dados de Baja (Pérdidas)
                </Text>
                {resumen.productos_baja.map((producto) => (
                  <View key={producto.id} style={styles.productoBajaRow}>
                    <View style={styles.productoBajaInfo}>
                      <Text style={styles.productoBajaNombre}>
                        {producto.nombre}
                      </Text>
                      <Text style={styles.productoBajaCategoria}>
                        {producto.categoria}
                      </Text>
                    </View>
                    <View style={styles.productoBajaCantidad}>
                      <Text style={styles.productoBajaCantidadText}>
                        {producto.cantidad} unid.
                      </Text>
                    </View>
                    <View style={styles.productoBajaPerdida}>
                      <Text style={styles.productoBajaPerdidaText}>
                        ${producto.total_perdida.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
                <View style={styles.totalPerdidasBajaRow}>
                  <Text style={styles.totalPerdidasBajaLabel}>
                    Total pérdidas por baja:
                  </Text>
                  <Text style={styles.totalPerdidasBajaValue}>
                    $
                    {resumen.productos_baja
                      .reduce((total, p) => total + p.total_perdida, 0)
                      .toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Cambios de precios del día */}
            {resumen?.cambios_precios && resumen.cambios_precios.length > 0 && (
              <View style={styles.cambiosPrecioCard}>
                <Text style={styles.cardTitle}>
                  📈 Cambios de Precios del Día
                </Text>
                {resumen.cambios_precios.map((cambio) => (
                  <View key={cambio.id} style={styles.cambioPrecioRow}>
                    <View style={styles.cambioPrecioInfo}>
                      <Text style={styles.cambioPrecioNombre}>
                        {cambio.nombre_producto}
                      </Text>
                      <Text style={styles.cambioPrecioCategoria}>
                        {cambio.categoria_producto}
                      </Text>
                      <Text style={styles.cambioPrecioHora}>
                        {new Date(cambio.creado_en).toLocaleTimeString()}
                      </Text>
                    </View>
                    <View style={styles.cambioPrecioValores}>
                      <View style={styles.cambioPrecioValoresRow}>
                        <View style={styles.cambioPrecioValorAnterior}>
                          <Text style={styles.cambioPrecioValorAnteriorText}>
                            ${cambio.precio_anterior.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.cambioPrecioFlecha}>
                          <Text style={styles.cambioPrecioFlechaText}>→</Text>
                        </View>
                        <View style={styles.cambioPrecioValorNuevo}>
                          <Text
                            style={[
                              styles.cambioPrecioValorNuevoText,
                              {
                                color:
                                  cambio.diferencia > 0
                                    ? "#4CAF50"
                                    : cambio.diferencia < 0
                                      ? "#F44336"
                                      : "#666",
                              },
                            ]}
                          >
                            ${cambio.precio_nuevo.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
                <View style={styles.resumenCambiosPrecioRow}>
                  <Text style={styles.resumenCambiosPrecioLabel}>
                    Total cambios: {resumen.cambios_precios.length}
                  </Text>
                  <Text style={styles.resumenCambiosPrecioValue}>
                    Neto: $
                    {resumen.cambios_precios
                      .reduce((sum, c) => sum + c.diferencia, 0)
                      .toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Alerta de cierre si ya existe uno */}
            {yaCerradoHoy && (
              <View style={styles.alertaCierreCard}>
                <Text style={styles.alertaCierreTitle}>
                  ⚠️ Advertencia de Cierre
                </Text>
                <Text style={styles.alertaCierreText}>
                  Ya existe un cierre hoy a las{" "}
                  {ultimoCierreHoy
                    ? new Date(
                        ultimoCierreHoy.fecha_cierre,
                      ).toLocaleTimeString()
                    : ""}
                  . Si realiza un nuevo cierre, este suplantará al anterior.
                </Text>
                <Text style={styles.alertaCierreText}>
                  Último cierre: ${ultimoCierreHoy?.total_ventas.toFixed(2)} en
                  ventas
                </Text>
              </View>
            )}

            {/* Lista de productos */}
            <View style={styles.productosCard}>
              <Text style={styles.cardTitle}>Inventario Físico</Text>
              {productos.map((producto) => {
                const estado = getEstadoProducto(producto);
                return (
                  <View key={producto.id} style={styles.productoRow}>
                    <View style={styles.productoInfo}>
                      <Text style={styles.productoNombre}>
                        {producto.nombre}
                      </Text>
                      <Text style={styles.productoCategoria}>
                        {producto.categoria}
                      </Text>
                    </View>

                    <View style={styles.cantidadesContainer}>
                      <View style={styles.cantidadColumn}>
                        <Text style={styles.cantidadLabel}>Sistema</Text>
                        <Text style={styles.cantidadValor}>
                          {producto.cantidad_sistema}
                        </Text>
                      </View>

                      <View style={styles.cantidadColumn}>
                        <Text style={styles.cantidadLabel}>Físico</Text>
                        <TextInput
                          style={[
                            styles.cantidadInput,
                            { borderColor: estado.color },
                          ]}
                          value={producto.cantidad_fisica?.toString() || ""}
                          onChangeText={(text) =>
                            actualizarCantidadFisica(producto.id, text)
                          }
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>

                      <View style={styles.estadoColumn}>
                        <Text
                          style={[styles.estadoTexto, { color: estado.color }]}
                        >
                          {estado.texto}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Card de Observaciones y Acción */}
            <View style={styles.aperturaCard}>
              {/* Observaciones */}
              <View style={styles.observacionesCard}>
                <Text style={styles.cardTitle}>Observaciones</Text>
                <TextInput
                  style={styles.observacionesInput}
                  value={observaciones}
                  onChangeText={setObservaciones}
                  placeholder="OBSERVACIONES OBLIGATORIAS - Ingrese detalles del cierre..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Botón de cierre */}
              <TouchableOpacity
                style={[
                  styles.aperturaButton,
                  (realizandoOperacion || yaCerradoHoy) &&
                    styles.aperturaButtonDisabled,
                ]}
                onPress={() => {
                  if (yaCerradoHoy) {
                    Alert.alert(
                      "⚠️ Advertencia de Suplantación",
                      `Ya se realizó un cierre hoy. Este nuevo cierre SUPLANTARÁ al anterior.\n\n¿Desea continuar?`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        { text: "Continuar", onPress: () => realizarCierre() },
                      ],
                    );
                  } else {
                    realizarCierre();
                  }
                }}
                disabled={realizandoOperacion}
              >
                <Text style={styles.aperturaButtonText}>
                  {realizandoOperacion
                    ? "Realizando Cierre..."
                    : yaCerradoHoy
                      ? "Suplantar Cierre Anterior"
                      : "Realizar Cierre del Día"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal para selección de trabajador */}
      <Modal
        visible={mostrarModalTrabajador}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalTrabajador(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.trabajadorModalContent}>
            <View style={styles.trabajadorModalHeader}>
              <Text style={styles.trabajadorModalTitle}>
                Seleccionar Trabajador
              </Text>
              <TouchableOpacity
                style={styles.trabajadorCloseButton}
                onPress={() => setMostrarModalTrabajador(false)}
              >
                <Text style={styles.trabajadorCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.trabajadorModalSubtitle}>
              Seleccione el trabajador que estará a cargo hoy. Este trabajador
              recibirá el salario del día basado en las ventas totales.
            </Text>

            {cargandoTrabajadores ? (
              <View style={styles.trabajadorModalLoading}>
                <Text style={styles.trabajadorModalLoadingText}>
                  Cargando trabajadores...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.trabajadorModalList}>
                {trabajadoresDisponibles.map((trabajador) => (
                  <TouchableOpacity
                    key={trabajador.id}
                    style={styles.trabajadorModalItem}
                    onPress={() => seleccionarTrabajador(trabajador)}
                  >
                    <View style={styles.trabajadorModalItemContent}>
                      <Text style={styles.trabajadorModalItemName}>
                        {trabajador.nombre}
                      </Text>
                      <Text style={styles.trabajadorModalItemPercentage}>
                        {trabajador.es_porcentaje === 1
                          ? `${trabajador.porcentaje}% de las ventas`
                          : `$${trabajador.salario_fijo || 0} sueldo o`}
                      </Text>
                      {trabajador.descripcion && (
                        <Text style={styles.trabajadorModalItemDescription}>
                          {trabajador.descripcion}
                        </Text>
                      )}
                    </View>
                    <View style={styles.trabajadorModalItemArrow}>
                      <Text style={styles.trabajadorModalItemArrowText}>›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal para fondo de caja */}
      <Modal
        visible={mostrarModalFondoCaja}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarModalFondoCaja(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fondo de Caja</Text>
            <Text style={styles.modalSubtitle}>
              Ingrese el monto inicial para comenzar el día
            </Text>

            <TextInput
              style={styles.modalInput}
              value={fondoCaja}
              onChangeText={setFondoCaja}
              keyboardType="numeric"
              placeholder="0.00"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setMostrarModalFondoCaja(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  setMostrarModalFondoCaja(false);
                  // El fondo se guarda cuando se realiza la apertura
                }}
              >
                <Text style={styles.modalButtonText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para extraer dinero */}
      <Modal
        visible={mostrarModalExtraer}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarModalExtraer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Extraer Dinero</Text>
            <Text style={styles.modalSubtitle}>
              Ingrese el monto a extraer del total de ventas
            </Text>

            <TextInput
              style={styles.modalInput}
              value={montoExtraido}
              onChangeText={setMontoExtraido}
              keyboardType="numeric"
              placeholder="0.00"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setMostrarModalExtraer(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={extraerDinero}
              >
                <Text style={styles.modalButtonText}>Extraer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para verificar dinero físico */}
      <Modal
        visible={mostrarModalDineroFisico}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarModalDineroFisico(false)}
      >
        <View style={styles.calculoModalOverlay}>
          <View style={styles.calculoModalContent}>
            <Text style={styles.calculoModalTitle}>
              Verificar Dinero Físico
            </Text>
            <Text style={styles.calculoModalSubtitle}>
              Compare el dinero físico con el del sistema
            </Text>

            {/* Tabla de billetes */}
            <ScrollView
              style={styles.calculoTableScroll}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.calculoTable}>
                {/* Encabezado */}
                <View style={styles.calculoHeader}>
                  <Text style={styles.calculoHeaderCell}>Billetes</Text>
                  <Text style={styles.calculoHeaderCell}>Cantidad</Text>
                </View>

                {/* Filas de billetes */}
                {[1, 3, 5, 10, 20, 50, 100, 200, 500, 1000].map(
                  (denominacion) => (
                    <View key={denominacion} style={styles.calculoRow}>
                      <Text style={styles.calculoCell}>${denominacion}</Text>
                      <View style={styles.calculoCellLast}>
                        <View style={styles.billeteControls}>
                          <TouchableOpacity
                            style={styles.billeteButton}
                            onPress={() => disminuirBillete(denominacion)}
                          >
                            <Text style={styles.billeteButtonText}>-</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={[
                              styles.billeteCantidad,
                              editandoDenominacion === denominacion &&
                                styles.billeteCantidadEditing,
                            ]}
                            value={
                              editandoDenominacion === denominacion
                                ? valorTemporal
                                : dineroFisico[denominacion].toString()
                            }
                            onChangeText={(text) =>
                              actualizarCantidadManual(denominacion, text)
                            }
                            onFocus={() => manejarFoco(denominacion)}
                            onBlur={manejarPerdidaFoco}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                            maxLength={4}
                            selectTextOnFocus={true}
                          />
                          <TouchableOpacity
                            style={styles.billeteButton}
                            onPress={() => incrementarBillete(denominacion)}
                          >
                            <Text style={styles.billeteButtonText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ),
                )}
              </View>
            </ScrollView>

            {/* Totales */}
            <View style={styles.calculoTotals}>
              <View style={styles.calculoTotalRow}>
                <Text style={styles.calculoTotalLabel}>Dinero en sistema:</Text>
                <Text style={styles.calculoTotalValue}>
                  $
                  {(
                    (resumen?.total_efectivo || 0) -
                    (resumen?.total_extraido || 0)
                  ).toFixed(2)}
                </Text>
              </View>
              <View style={styles.calculoTotalRow}>
                <Text style={styles.calculoTotalLabel}>Dinero físico:</Text>
                <Text style={styles.calculoTotalValueHighlight}>
                  ${calcularTotalDineroFisico().toFixed(2)}
                </Text>
              </View>
              <View style={styles.calculoTotalRowLast}>
                <Text style={styles.calculoTotalLabel}>Diferencia:</Text>
                <Text
                  style={[
                    styles.calculoTotalValueHighlight,
                    calcularTotalDineroFisico() -
                      (resumen?.total_efectivo || 0) !==
                    0
                      ? styles.calculoVueltoPositive
                      : styles.calculoVueltoZero,
                  ]}
                >
                  $
                  {(
                    calcularTotalDineroFisico() - (resumen?.total_efectivo || 0)
                  ).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Botones */}
            <View style={styles.calculoModalFooter}>
              <TouchableOpacity
                style={styles.calculoCancelButton}
                onPress={() => setMostrarModalDineroFisico(false)}
              >
                <Text style={styles.calculoCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calculoConfirmButton}
                onPress={verificarDineroFisico}
              >
                <Text style={styles.calculoConfirmText}>Verificar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de historial de cierres */}
      <Modal
        visible={mostrarModalHistorial}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarModalHistorial(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historialModalContent}>
            <View style={styles.historialModalHeader}>
              <Text style={styles.historialModalTitle}>
                📋 Historial de Cierres
              </Text>
              <TouchableOpacity
                style={styles.historialCloseButton}
                onPress={() => setMostrarModalHistorial(false)}
              >
                <Text style={styles.historialCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.historialScroll}>
              {historialCierres.length === 0 ? (
                <View style={styles.historialEmpty}>
                  <Text style={styles.historialEmptyText}>
                    No hay cierres registrados
                  </Text>
                </View>
              ) : (
                historialCierres.map((cierre) => (
                  <View key={cierre.id} style={styles.historialItem}>
                    <View style={styles.historialHeader}>
                      <Text style={styles.historialDate}>
                        {new Date(cierre.fecha_cierre).toLocaleDateString()}
                      </Text>
                      <Text style={styles.historialDate}>
                        {new Date(cierre.fecha_cierre).toLocaleTimeString()}
                      </Text>
                    </View>

                    <View style={styles.historialDetails}>
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>Ventas:</Text>
                        <Text style={styles.historialValue}>
                          ${cierre.total_ventas.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>Efectivo:</Text>
                        <Text style={styles.historialValue}>
                          ${cierre.total_efectivo.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>
                          Transferencia:
                        </Text>
                        <Text style={styles.historialValue}>
                          ${cierre.total_transferencia.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>
                          Ventas - Gastos:
                        </Text>
                        <Text
                          style={[
                            styles.historialValue,
                            {
                              color:
                                (cierre.total_ventas || 0) -
                                  (cierre.total_gastos || 0) <
                                0
                                  ? "#F44336"
                                  : "#4CAF50",
                            },
                          ]}
                        >
                          $
                          {(
                            (cierre.total_ventas || 0) -
                            (cierre.total_gastos || 0)
                          ).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text
                          style={[styles.historialLabel, { color: "#F44336" }]}
                        >
                          Gastos Totales:
                        </Text>
                        <Text
                          style={[styles.historialValue, { color: "#F44336" }]}
                        >
                          ${(cierre.gastos_totales || 0).toFixed(2)}
                          {cierre.gastos_salarios > 0 &&
                            ` ($${cierre.gastos_salarios.toFixed(2)})`}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>
                          Dinero en Caja:
                        </Text>
                        <Text
                          style={[styles.historialValue, { color: "#2196F3" }]}
                        >
                          $
                          {(
                            cierre.total_efectivo +
                            (cierre.fondo_caja || 0) -
                            (cierre.total_extraido || 0)
                          ).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text
                          style={[styles.historialLabel, { color: "#F44336" }]}
                        >
                          Pérdidas:
                        </Text>
                        <Text
                          style={[styles.historialValue, { color: "#F44336" }]}
                        >
                          $
                          {(
                            (cierre.total_perdidas || 0) +
                            (cierre.deuda_pendiente || 0)
                          ).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>
                          Fondo de caja:
                        </Text>
                        <Text style={styles.historialValue}>
                          ${(cierre.fondo_caja || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>Extraído:</Text>
                        <Text style={styles.historialValue}>
                          ${(cierre.total_extraido || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text
                          style={[styles.historialLabel, { color: "#FF5722" }]}
                        >
                          Deuda Pendiente:
                        </Text>
                        <Text
                          style={[styles.historialValue, { color: "#FF5722" }]}
                        >
                          ${(cierre.deuda_pendiente || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.historialRow}>
                        <Text
                          style={[styles.historialLabel, { color: "#4CAF50" }]}
                        >
                          Deuda Pagada:
                        </Text>
                        <Text
                          style={[styles.historialValue, { color: "#4CAF50" }]}
                        >
                          ${(cierre.deuda_pagada || 0).toFixed(2)}
                        </Text>
                      </View>
                      {cierre.observaciones && (
                        <View style={styles.historialRow}>
                          <Text style={styles.historialLabel}>Obs:</Text>
                          <Text style={styles.historialObservaciones}>
                            {cierre.observaciones}
                          </Text>
                        </View>
                      )}
                      <View style={styles.historialRow}>
                        <TouchableOpacity
                          style={styles.verCambiosButton}
                          onPress={() => cargarCambiosPrecioDeCierre(cierre.id)}
                        >
                          <Text style={styles.verCambiosButtonText}>
                            📊 Ver Cambios de Precios
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Controles de paginación */}
            <View style={styles.paginacionContainer}>
              <Text style={styles.paginacionInfo}>
                Mostrando {historialCierres.length} de {totalCierres} cierres
              </Text>

              <View style={styles.paginacionButtons}>
                <TouchableOpacity
                  style={[
                    styles.paginacionButton,
                    paginaActual === 0 && styles.paginacionButtonDisabled,
                  ]}
                  onPress={() =>
                    cargarHistorialCierres(Math.max(0, paginaActual - 1))
                  }
                  disabled={paginaActual === 0 || cargandoHistorial}
                >
                  <Text style={styles.paginacionButtonText}>{"<"}</Text>
                </TouchableOpacity>

                <View style={styles.paginacionInfoContainer}>
                  <Text style={styles.paginacionPageInfo}>
                    {paginaActual + 1}/
                    {Math.ceil(totalCierres / cierresPorPagina) || 1}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.paginacionButton,
                    paginaActual + 1 >=
                      Math.ceil(totalCierres / cierresPorPagina) &&
                      styles.paginacionButtonDisabled,
                  ]}
                  onPress={() => cargarHistorialCierres(paginaActual + 1)}
                  disabled={
                    paginaActual + 1 >=
                      Math.ceil(totalCierres / cierresPorPagina) ||
                    cargandoHistorial
                  }
                >
                  <Text style={styles.paginacionButtonText}>{">"}</Text>
                </TouchableOpacity>
              </View>

              {cargandoHistorial && (
                <ActivityIndicator size="small" color="#007AFF" />
              )}
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setMostrarModalHistorial(false)}
            >
              <Text style={styles.modalButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para mostrar cambios de precios del cierre */}
      <Modal
        visible={mostrarCambiosPrecio}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarCambiosPrecio(false)}
      >
        <View style={styles.cambiosPrecioModalOverlay}>
          <View style={styles.cambiosPrecioModalContent}>
            <View style={styles.cambiosPrecioModalHeader}>
              <Text style={styles.cambiosPrecioModalTitle}>
                Cambios de Precios del Cierre
              </Text>
              <TouchableOpacity
                style={styles.cambiosPrecioCloseButton}
                onPress={() => setMostrarCambiosPrecio(false)}
              >
                <Text style={styles.cambiosPrecioCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cambiosPrecioModalScroll}>
              {cambiosPrecioCierre.length === 0 ? (
                <View style={styles.cambiosPrecioModalEmpty}>
                  <Text style={styles.cambiosPrecioModalEmptyText}>
                    No hubo cambios de precios en este cierre
                  </Text>
                </View>
              ) : (
                cambiosPrecioCierre.map((cambio) => (
                  <View key={cambio.id} style={styles.cambioPrecioRow}>
                    <View style={styles.cambioPrecioInfo}>
                      <Text style={styles.cambioPrecioNombre}>
                        {cambio.nombre_producto}
                      </Text>
                      <Text style={styles.cambioPrecioCategoria}>
                        {cambio.categoria_producto}
                      </Text>
                      <Text style={styles.cambioPrecioHora}>
                        {new Date(cambio.creado_en).toLocaleTimeString()}
                      </Text>
                    </View>
                    <View style={styles.cambioPrecioValores}>
                      <View style={styles.cambioPrecioValoresRow}>
                        <View style={styles.cambioPrecioValorAnterior}>
                          <Text style={styles.cambioPrecioValorAnteriorText}>
                            ${cambio.precio_anterior.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.cambioPrecioFlecha}>
                          <Text style={styles.cambioPrecioFlechaText}>→</Text>
                        </View>
                        <View style={styles.cambioPrecioValorNuevo}>
                          <Text
                            style={[
                              styles.cambioPrecioValorNuevoText,
                              {
                                color:
                                  cambio.diferencia > 0
                                    ? "#4CAF50"
                                    : cambio.diferencia < 0
                                      ? "#F44336"
                                      : "#666",
                              },
                            ]}
                          >
                            ${cambio.precio_nuevo.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.resumenCambiosPrecioRow}>
              <Text style={styles.resumenCambiosPrecioLabel}>
                Total cambios: {cambiosPrecioCierre.length}
              </Text>
              <Text style={styles.resumenCambiosPrecioValue}>
                Neto: $
                {cambiosPrecioCierre
                  .reduce((sum, c) => sum + c.diferencia, 0)
                  .toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.cambiosPrecioModalButton}
              onPress={() => setMostrarCambiosPrecio(false)}
            >
              <Text style={styles.cambiosPrecioModalButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de historial de aperturas */}
      <Modal
        visible={mostrarModalHistorialAperturas}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarModalHistorialAperturas(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historialModalContent}>
            <View style={styles.historialModalHeader}>
              <Text style={styles.historialModalTitle}>
                📋 Historial de Aperturas
              </Text>
              <TouchableOpacity
                style={styles.historialCloseButton}
                onPress={() => setMostrarModalHistorialAperturas(false)}
              >
                <Text style={styles.historialCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.historialScroll}>
              {historialAperturas.length === 0 ? (
                <View style={styles.historialEmpty}>
                  <Text style={styles.historialEmptyText}>
                    No hay aperturas registradas
                  </Text>
                </View>
              ) : (
                historialAperturas.map((apertura) => (
                  <View key={apertura.id} style={styles.historialItem}>
                    <View style={styles.historialModalContent}>
                      {/* FECHA */}
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>Fecha:</Text>
                        <Text style={styles.historialValue}>
                          {new Date(apertura.fecha_cierre).toLocaleDateString()}
                        </Text>
                      </View>

                      {/* HORA */}
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>Hora:</Text>
                        <Text style={styles.historialValue}>
                          {new Date(apertura.fecha_cierre).toLocaleTimeString()}
                        </Text>
                      </View>

                      {/* TRABAJADOR */}
                      {apertura.trabajador_nombre && (
                        <View style={styles.historialRow}>
                          <Text style={styles.historialLabel}>Trabajador:</Text>
                          <Text style={styles.historialTrabajadorValue}>
                            {apertura.trabajador_nombre}
                          </Text>
                        </View>
                      )}

                      {/* FONDO DE CAJA */}
                      <View style={styles.historialRow}>
                        <Text style={styles.historialLabel}>
                          Fondo de Caja:
                        </Text>
                        <Text style={styles.historialValue}>
                          $
                          {apertura.fondo_caja
                            ? apertura.fondo_caja.toFixed(2)
                            : "0.00"}
                        </Text>
                      </View>

                      {/* OBSERVACIONES */}
                      {apertura.observaciones && (
                        <View style={styles.historialRow}>
                          <Text style={styles.historialLabel}>
                            Observaciones:
                          </Text>
                          <Text style={styles.historialObservaciones}>
                            {apertura.observaciones}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Controles de paginación */}
            <View style={styles.paginacionContainer}>
              <Text style={styles.paginacionInfo}>
                Mostrando {historialAperturas.length} de {totalAperturas}{" "}
                aperturas
              </Text>

              <View style={styles.paginacionButtons}>
                <TouchableOpacity
                  style={[
                    styles.paginacionButton,
                    paginaActualAperturas === 0 &&
                      styles.paginacionButtonDisabled,
                  ]}
                  onPress={() =>
                    cargarHistorialAperturas(
                      Math.max(0, paginaActualAperturas - 1),
                    )
                  }
                  disabled={paginaActualAperturas === 0 || cargandoAperturas}
                >
                  <Text style={styles.paginacionButtonText}>{"<"}</Text>
                </TouchableOpacity>

                <View style={styles.paginacionInfoContainer}>
                  <Text style={styles.paginacionPageInfo}>
                    {paginaActualAperturas + 1}/
                    {Math.ceil(totalAperturas / aperturasPorPagina) || 1}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.paginacionButton,
                    paginaActualAperturas + 1 >=
                      Math.ceil(totalAperturas / aperturasPorPagina) &&
                      styles.paginacionButtonDisabled,
                  ]}
                  onPress={() =>
                    cargarHistorialAperturas(paginaActualAperturas + 1)
                  }
                  disabled={
                    paginaActualAperturas + 1 >=
                      Math.ceil(totalAperturas / aperturasPorPagina) ||
                    cargandoAperturas
                  }
                >
                  <Text style={styles.paginacionButtonText}>{">"}</Text>
                </TouchableOpacity>
              </View>

              {cargandoAperturas && (
                <ActivityIndicator size="small" color="#007AFF" />
              )}
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setMostrarModalHistorialAperturas(false)}
            >
              <Text style={styles.modalButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000000",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  puntoInfo: {
    flex: 1,
    alignItems: "center",
  },
  infoCardButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  puntoNombre: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  puntoTipo: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  resumenCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  resumenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resumenLabel: {
    fontSize: 14,
    color: "#666",
  },
  resumenValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  extractButton: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#059669",
  },
  extractButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  moneyVerifyButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  moneyVerifyButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  historyButton: {
    backgroundColor: "#8b5cf6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  historyButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  productosCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productoInfo: {
    flex: 1,
  },
  productoNombre: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  productoCategoria: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  cantidadesContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  cantidadColumn: {
    alignItems: "center",
    marginHorizontal: 5,
  },
  cantidadLabel: {
    fontSize: 10,
    color: "#666",
    marginBottom: 2,
  },
  cantidadValor: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
  },
  cantidadInput: {
    width: 70,
    height: 40,
    borderWidth: 1,
    borderRadius: 5,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    paddingHorizontal: 8,
  },
  estadoColumn: {
    marginHorizontal: 5,
  },
  estadoTexto: {
    fontSize: 10,
    fontWeight: "bold",
  },
  observacionesCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  observacionesInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  cierreButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cierreButtonDisabled: {
    backgroundColor: "#ccc",
  },
  cierreButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    margin: 20,
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  modalInfo: {
    marginBottom: 20,
  },
  modalInfoText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#ccc",
  },
  modalButtonConfirm: {
    backgroundColor: "#007AFF",
  },
  modalButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalNote: {
    fontSize: 12,
    color: "#F44336",
    fontStyle: "italic",
    marginTop: 10,
    textAlign: "center",
  },
  // Estilos para el modal de cálculo de dinero
  calculoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calculoModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    maxHeight: "85%",
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  calculoModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  calculoModalSubtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 20,
  },
  calculoTableScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  calculoTable: {
    display: "flex",
    flexDirection: "column",
  },
  calculoHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  calculoHeaderCell: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  calculoRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  calculoCell: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  calculoCellLast: {
    flex: 2,
    padding: 8,
    justifyContent: "center",
  },
  billeteControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  billeteButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  billeteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  billeteCantidad: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    textAlign: "center",
    fontSize: 14,
    color: "#374151",
    backgroundColor: "white",
  },
  billeteCantidadEditing: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  calculoTotals: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
    marginBottom: 16,
  },
  calculoTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  calculoTotalRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calculoTotalLabel: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  calculoTotalValue: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "600",
  },
  calculoTotalValueHighlight: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  calculoVueltoPositive: {
    color: "#059669",
  },
  calculoVueltoZero: {
    color: "#374151",
  },
  calculoModalFooter: {
    flexDirection: "row",
    gap: 12,
  },
  calculoCancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  calculoCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  calculoConfirmButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  calculoConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },
  // Estilos para productos dados de baja
  productosBajaCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productoBajaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productoBajaInfo: {
    flex: 2,
  },
  productoBajaNombre: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  productoBajaCategoria: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  productoBajaCantidad: {
    flex: 1,
    alignItems: "center",
  },
  productoBajaCantidadText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
  },
  productoBajaPerdida: {
    flex: 1,
    alignItems: "flex-end",
  },
  productoBajaPerdidaText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#F44336",
  },
  totalPerdidasBajaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  totalPerdidasBajaLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  totalPerdidasBajaValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#F44336",
  },
  // Estilos para alerta de cierre
  alertaCierreCard: {
    backgroundColor: "#FFF3CD",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#FFC107",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertaCierreTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#856404",
    marginBottom: 5,
  },
  alertaCierreText: {
    fontSize: 14,
    color: "#856404",
  },
  // Estilos para modal de historial - MEJORADOS
  historialModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    maxHeight: "85%",
    width: "95%",
    maxWidth: 500,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  historialModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  historialModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  historialCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  historialCloseIcon: {
    fontSize: 18,
    color: "#6b7280",
    fontWeight: "bold",
  },
  historialScroll: {
    maxHeight: 400,
    marginBottom: 20,
  },
  historialEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  historialEmptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  historialItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
  },
  historialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  historialTrabajadorBadge: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  historialTrabajadorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
  },
  historialTrabajadorValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3b82f6",
  },
  historialDate: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  historialDetails: {
    gap: 5,
  },
  historialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historialLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  historialValue: {
    fontSize: 13,
    color: "#333",
    fontWeight: "600",
  },
  historialObservaciones: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    flex: 1,
    textAlign: "right",
  },
  // Estilos para el header mejorado
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40, // Ancho aproximado del botón de regresar para balance
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  extractIconButton: {
    backgroundColor: "#10b981",
  },
  extractIcon: {
    fontSize: 20,
  },
  verifyIconButton: {
    backgroundColor: "#3b82f6",
  },
  verifyIcon: {
    fontSize: 20,
  },
  historyIconButton: {
    backgroundColor: "#8b5cf6",
  },
  historyIcon: {
    fontSize: 20,
  },
  // Estilos para cambios de precios
  cambiosPrecioCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#8b5cf6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cambioPrecioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  cambioPrecioInfo: {
    flex: 2,
    paddingRight: 12,
  },
  cambioPrecioNombre: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  cambioPrecioCategoria: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  cambioPrecioHora: {
    fontSize: 11,
    color: "#999",
  },
  cambioPrecioValores: {
    flex: 2,
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cambioPrecioValoresRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cambioPrecioValorAnterior: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    marginRight: 4,
  },
  cambioPrecioValorAnteriorText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666",
  },
  cambioPrecioFlecha: {
    marginHorizontal: 4,
  },
  cambioPrecioFlechaText: {
    fontSize: 16,
    color: "#999",
    fontWeight: "bold",
  },
  cambioPrecioValorNuevo: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    marginLeft: 4,
  },
  cambioPrecioValorNuevoText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cambioPrecioDiferencia: {
    flex: 1,
    alignItems: "flex-end",
  },
  cambioPrecioDiferenciaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  resumenCambiosPrecioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  resumenCambiosPrecioLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  resumenCambiosPrecioValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  verCambiosButton: {
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  verCambiosButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
    textAlign: "center",
  },
  cambiosPrecioModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  cambiosPrecioModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  cambiosPrecioModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cambiosPrecioModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  cambiosPrecioCloseButton: {
    padding: 4,
  },
  cambiosPrecioCloseIcon: {
    fontSize: 18,
    color: "#666",
  },
  cambiosPrecioModalScroll: {
    maxHeight: "60%",
  },
  cambiosPrecioModalEmpty: {
    padding: 40,
    alignItems: "center",
  },
  cambiosPrecioModalEmptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  cambiosPrecioModalButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  cambiosPrecioModalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  // Estilos para préstamos del día
  prestamosCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FF9800",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  prestamoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  prestamoInfo: {
    flex: 2,
    paddingRight: 16,
  },
  prestamoDescripcion: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  prestamoFechas: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  prestamoNotas: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  prestamoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  estadoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 85,
    alignItems: "center",
    marginLeft: 12,
  },
  estadoPendiente: {
    backgroundColor: "#FFF3CD",
    borderWidth: 1,
    borderColor: "#FFEAA7",
  },
  estadoPagado: {
    backgroundColor: "#D4EDDA",
    borderWidth: 1,
    borderColor: "#C3E6CB",
  },
  estadoBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  estadoPendienteText: {
    color: "#856404",
  },
  estadoPagadoText: {
    color: "#155724",
  },
  montoPagado: {
    textDecorationLine: "line-through",
    color: "#999",
  },
  prestamoMonto: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  prestamoMontoText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF9800",
  },
  totalPrestamosRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#FFE0B2",
  },
  totalPrestamosLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  totalPrestamosValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF9800",
  },
  // Estilos para filtro de modo
  modoFilter: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  modoButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  modoButtonActive: {
    backgroundColor: "#007AFF",
  },
  modoButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  modoButtonTextActive: {
    color: "white",
  },
  modoButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Estilos para modo apertura
  fondoIconButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  fondoIconText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  // Estilos para botón de trabajador
  trabajadorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    width: "60%",
  },
  trabajadorButtonEmpty: {
    backgroundColor: "#f8f9fa",
    borderColor: "#d1d5db",
  },
  trabajadorButtonSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  trabajadorButtonText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  trabajadorButtonTextEmpty: {
    color: "#6b7280",
  },
  trabajadorButtonTextSelected: {
    color: "white",
  },
  // Estilos para modal de trabajador (basados en venta.tsx)
  trabajadorModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    margin: 20,
    padding: 24,
    minWidth: 360,
    maxWidth: 400,
    maxHeight: "80%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  trabajadorModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trabajadorCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  trabajadorCloseIcon: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "bold",
  },
  trabajadorModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 8,
  },
  trabajadorModalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  trabajadorModalLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  trabajadorModalLoadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  trabajadorModalList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  trabajadorModalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  trabajadorModalItemContent: {
    flex: 1,
  },
  trabajadorModalItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  trabajadorModalItemPercentage: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "500",
    marginBottom: 2,
  },
  trabajadorModalItemDescription: {
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
  },
  trabajadorModalItemArrow: {
    marginLeft: 12,
  },
  trabajadorModalItemArrowText: {
    fontSize: 24,
    color: "#9ca3af",
    fontWeight: "300",
  },
  trabajadorModalButtonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  trabajadorModalCancelButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: "center",
  },
  trabajadorModalCancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  productosList: {
    gap: 12,
  },
  productoCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aperturaTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  aperturaCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aperturaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  aperturaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  aperturaLabel: {
    fontSize: 16,
    color: "#666",
  },
  aperturaValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  aperturaButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  aperturaButtonDisabled: {
    backgroundColor: "#ccc",
  },
  aperturaButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // Estilos temporales para limpieza (desarrollo)
  limpiezaButton: {
    backgroundColor: "#FF4444",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
    borderWidth: 2,
    borderColor: "#CC0000",
  },
  limpiezaButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  // Estilos para paginación del historial
  paginacionContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    alignItems: "center",
    gap: 12,
  },
  paginacionInfo: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  paginacionButtons: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  paginacionInfoContainer: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  paginacionButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: "center",
  },
  paginacionButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  paginacionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  paginacionPageInfo: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
});
