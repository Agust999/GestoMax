// app/venta.tsx - VERSIÓN CON HEADER MEJORADO
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import * as ExpoPrint from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

// Importar servicios
import { useSaveNavigationState } from "../components/NavigationPersistence";
import {
  db,
  executeNonQuery,
  getFirst,
  getProductosEnZonaVenta,
} from "../src/db/database";
import {
  PrestamoDeudaHelper,
  PuntoHelper,
  VentaHelper,
} from "../src/db/databaseHelper";
import { CambioPrecioService } from "../src/db/services/cambio_precio_service";
import { GastoService } from "../src/db/services/gasto_service";
import { OfertaService } from "../src/db/services/oferta_service";
import { VentaHistoryService } from "../src/db/services/venta_history_service";
import { BluetoothPrinterService } from "../src/services/bluetooth_printer_simple";
import { getFechaDentroDeDias, getFechaLocal } from "../src/utils/dateUtils";

// Tipos
interface ProductoVenta {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  precio_venta: number;
  ganancia: number;
  cantidad: number;
  cantidadSeleccionada: number;
  disponible: number;
  precio_coste_real?: number;
  estado_vencimiento?:
    | "vencido"
    | "por_vencer_rojo"
    | "por_vencer_naranja"
    | "seguro";
  dias_restantes?: number;
  seleccionado?: boolean; // Nuevo campo para selección múltiple
  formato_almacen?: string; // Formato de almacenamiento (caja, paquete, etc.)
  unidades_por_formato?: number; // Unidades por cada formato
  formatoActivo?: boolean; // Estado del modo formato
}

interface ItemOrden {
  productoId: number;
  nombre: string;
  precioVenta: number;
  cantidad: number;
  subtotal: number;
  tipoPago?: string;
  metodoTransferencia?: string;
  precioCostoReal?: number;
  montoTransferencia?: number; // Para pagos mixtos
  montoEfectivo?: number; // Para pagos mixtos
  productosTemporales?: ItemOrden[]; // Para preordenes
  deudaId?: number; // Para pagos de deudas
  descripcionDeuda?: string; // Para pagos de deudas
}

export default function VentaScreen() {
  const dimensions = useWindowDimensions();
  const width = dimensions?.width || 0;
  const height = dimensions?.height || 0;
  const router = useRouter();
  const params = useLocalSearchParams();

  // Obtener parámetros de Expo Router
  const puntoId = params.puntoId ? parseInt(params.puntoId as string) : null;
  const puntoNombre = (params.puntoNombre as string) || "Punto";

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/venta", params);

  // Estados
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<ProductoVenta[]>([]);
  const [productosNuevos, setProductosNuevos] = useState<ProductoVenta[]>([]);
  const [orden, setOrden] = useState<ItemOrden[]>([]);
  const [mostrarModalOrden, setMostrarModalOrden] = useState(false);
  const [mostrarModalOrdenDetalles, setMostrarModalOrdenDetalles] =
    useState(false);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [productoParaPago, setProductoParaPago] = useState<ItemOrden | null>(
    null,
  );
  const [esModalPreorden, setEsModalPreorden] = useState(false);
  const [flujoOrigen, setFlujoOrigen] = useState<
    "calcular" | "confirmar" | "pago_deuda" | null
  >(null);
  const [tipoPagoSeleccionado, setTipoPagoSeleccionado] = useState<string>("");
  const [metodoTransferencia, setMetodoTransferencia] = useState<string>("");
  const [descripcionPrestamo, setDescripcionPrestamo] = useState<string>("");
  const [montoTransferenciaMixto, setMontoTransferenciaMixto] =
    useState<string>("");
  const [mostrarCampoTransferenciaMixto, setMostrarCampoTransferenciaMixto] =
    useState(false);
  const [totalOrden, setTotalOrden] = useState(0);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [filtroNombre, setFiltroNombre] = useState<string>("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [punto, setPunto] = useState<any>(null);
  const [ofertasActivas, setOfertasActivas] = useState<any[]>([]);
  const [ofertasSeleccionadas, setOfertasSeleccionadas] = useState<{
    [key: number]: boolean;
  }>({});
  const [ofertasDisponibles, setOfertasDisponibles] = useState<{
    [key: number]: any;
  }>({});
  const [totalConOfertas, setTotalConOfertas] = useState(0);
  const [consumoPropioActivo, setConsumoPropioActivo] = useState(false);
  const [mostrarModalSeleccionOfertas, setMostrarModalSeleccionOfertas] =
    useState(false);

  // Estados para el modal de selección de trabajador (Consumo Propio)
  const [mostrarModalSeleccionTrabajador, setMostrarModalSeleccionTrabajador] =
    useState(false);
  const [trabajadores, setTrabajadores] = useState<any[]>([]);
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] =
    useState<any>(null);
  const [cargandoTrabajadores, setCargandoTrabajadores] = useState(false);

  // Estados para el modal de selección de precio (Consumo Propio)
  const [mostrarModalSeleccionPrecio, setMostrarModalSeleccionPrecio] =
    useState(false);
  const [tipoDescuento, setTipoDescuento] = useState<
    "coste" | "porcentual" | "fijo"
  >("coste");
  const [valorDescuento, setValorDescuento] = useState("");

  // Estados para el modal de editar precio
  const [mostrarModalEditarPrecio, setMostrarModalEditarPrecio] =
    useState(false);
  const [productoEditando, setProductoEditando] =
    useState<ProductoVenta | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState("");

  // Estados para el modal de cálculo de billetes
  const [mostrarModalCalculo, setMostrarModalCalculo] = useState(false);
  const [billetes, setBilletes] = useState<{ [key: number]: number }>({
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
  const [tecladoVisible, setTecladoVisible] = useState<boolean>(false);

  // Estados para el modal de historial de entradas directas
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [historialEntradas, setHistorialEntradas] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialFiltrado, setHistorialFiltrado] = useState<any[]>([]);
  const [tipoHistorial, setTipoHistorial] = useState<"venta" | "entrada">(
    "venta",
  );

  // Estados para selección múltiple de productos
  const [modoSeleccionMultiple, setModoSeleccionMultiple] = useState(true);
  const [productosSeleccionados, setProductosSeleccionados] = useState<{
    [key: number]: boolean;
  }>({});

  // Estados para preorden
  const [preordenActiva, setPreordenActiva] = useState(false);
  const [preordenGuardada, setPreordenGuardada] = useState<ItemOrden[]>([]);
  const [preordenesGuardadas, setPreordenesGuardadas] = useState<ItemOrden[][]>(
    [],
  );
  const [mostrarListaPreordenes, setMostrarListaPreordenes] = useState(false);

  // Estado para generación de PDF
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");

  // Estados para impresora Bluetooth
  const [printerService] = useState(() =>
    BluetoothPrinterService.getInstance(),
  );
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Estados para filtrado por fecha
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null);
  const [mostrarDatePickerDesde, setMostrarDatePickerDesde] = useState(false);
  const [mostrarDatePickerHasta, setMostrarDatePickerHasta] = useState(false);

  // Estados para el modal de dar de baja con cantidad
  const [mostrarModalBajaCantidad, setMostrarModalBajaCantidad] =
    useState(false);
  const [productoParaBaja, setProductoParaBaja] =
    useState<ProductoVenta | null>(null);
  const [cantidadBaja, setCantidadBaja] = useState("");

  // Estados para el modal de gestión de deudas
  const [mostrarModalGestionDeudas, setMostrarModalGestionDeudas] =
    useState(false);
  const [deudasPunto, setDeudasPunto] = useState<any[]>([]);
  const [cargandoDeudas, setCargandoDeudas] = useState(false);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  // Cargar preordenes guardadas desde AsyncStorage
  useEffect(() => {
    cargarPreordenesGuardadas();
  }, []);

  // Guardar preordenes en AsyncStorage cuando cambian
  useEffect(() => {
    if (preordenesGuardadas.length > 0) {
      guardarPreordenesEnStorage();
    }
  }, [preordenesGuardadas]);

  const cargarPreordenesGuardadas = async () => {
    try {
      const preordenesGuardadasStorage = await AsyncStorage.getItem(
        `preordenes_${puntoId}`,
      );
      if (preordenesGuardadasStorage) {
        const preordenes = JSON.parse(preordenesGuardadasStorage);
        setPreordenesGuardadas(preordenes);
        console.log("Preordenes cargadas desde storage:", preordenes);
      }
    } catch (error) {
      console.error("Error cargando preordenes desde storage:", error);
    }
  };

  const guardarPreordenesEnStorage = async () => {
    try {
      await AsyncStorage.setItem(
        `preordenes_${puntoId}`,
        JSON.stringify(preordenesGuardadas),
      );
      console.log("Preordenes guardadas en storage:", preordenesGuardadas);
    } catch (error) {
      console.error("Error guardando preordenes en storage:", error);
    }
  };

  // Cargar datos - SOLO PRODUCTOS EN ZONA DE VENTA
  useEffect(() => {
    if (puntoId) {
      cargarDatos();
    } else {
      Alert.alert("Error", "No se especificó el punto de venta");
      router.back();
    }
  }, [puntoId]);

  // Calcular total automáticamente cuando cambia la orden
  useEffect(() => {
    const total = orden
      .filter((item) => item && item.subtotal)
      .reduce((sum, item) => sum + item.subtotal, 0);
    console.log("Total actualizado:", { orden, total });
    setTotalOrden(total);
  }, [orden]);

  // Configurar listeners del teclado
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setTecladoVisible(true);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setTecladoVisible(false);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Filtrar cuando cambian las fechas
  useEffect(() => {
    filtrarPorFechas();
  }, [fechaDesde, fechaHasta, historialEntradas]);

  const cargarDatos = async () => {
    try {
      // Verificar si hay apertura del día
      const hoy = getFechaLocal();
      const aperturaHoy = await getFirst<any>(
        "SELECT * FROM CierreCaja WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ?",
        [puntoId!, hoy],
      );

      // Verificar si hay una preorden activa (en BD o en AsyncStorage)
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
        "🔍 DEBUG: Validación de preorden - puntoId:",
        puntoId,
        "hoy:",
        hoy,
      );
      console.log("🔍 DEBUG: Preorden activa encontrada (BD):", preordenActiva);
      console.log(
        "🔍 DEBUG: Preordenes en AsyncStorage:",
        tienePreordenesStorage,
      );

      if (!aperturaHoy) {
        Alert.alert(
          "⚠️ Apertura Requerida",
          "Debe realizar una apertura del día antes de poder acceder a las ventas.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      // Las preordenes no bloquean las ventas, solo bloquean el cierre
      // Las preordenes son pedidos que deben completarse ANTES del cierre
      console.log(
        "🔍 DEBUG: Preordenes encontradas (permiten ventas):",
        tienePreordenesStorage,
      );

      // Cargar información del punto
      const puntoData = await PuntoHelper.getById(puntoId!);
      setPunto(puntoData);

      // **IMPORTANTE: OBTENER SOLO PRODUCTOS EN ZONA DE VENTA (zona_id = 1)**
      const productosZonaVenta = await getProductosEnZonaVenta(puntoId!);

      // Separar productos con y sin precio de venta
      const conPrecio = productosZonaVenta.filter(
        (p) => p.precio_venta && p.precio_venta > 0,
      );
      const sinPrecio = productosZonaVenta.filter(
        (p) => !p.precio_venta || p.precio_venta === 0,
      );

      // Transformar datos para la venta
      const productosTransformados: ProductoVenta[] = conPrecio.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        precio_coste: p.precio_coste_real || 0, // Mostrar precio real
        precio_venta: p.precio_venta || 0,
        ganancia: p.ganancia || 0,
        cantidad: p.cantidad || 0,
        cantidadSeleccionada: 0,
        disponible: p.cantidad || 0,
        precio_coste_real: p.precio_coste_real,
        estado_vencimiento: p.estado_vencimiento,
        dias_restantes: p.dias_restantes,
        formato_almacen: p.formato_almacen,
        unidades_por_formato: p.unidades_por_formato,
        formatoActivo: false, // Inicializar modo formato como desactivado
        seleccionado: false, // Inicializar como no seleccionado
      }));

      const nuevosTransformados: ProductoVenta[] = sinPrecio.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        precio_coste: p.precio_coste_real || 0,
        precio_venta: 0,
        ganancia: 0,
        cantidad: p.cantidad || 0,
        cantidadSeleccionada: 0,
        disponible: p.cantidad || 0,
        precio_coste_real: p.precio_coste_real,
        estado_vencimiento: p.estado_vencimiento,
        dias_restantes: p.dias_restantes,
        formato_almacen: p.formato_almacen,
        unidades_por_formato: p.unidades_por_formato,
        formatoActivo: false, // Inicializar modo formato como desactivado
        seleccionado: false, // Inicializar como no seleccionado
      }));

      setProductos(productosTransformados);
      setProductosNuevos(nuevosTransformados);

      // Extraer categorías únicas
      const cats = [...new Set(productosTransformados.map((p) => p.categoria))];
      setCategorias(cats);

      // Cargar ofertas activas para el punto
      const ofertas = await OfertaService.getOfertasByPunto(puntoId!);
      const ofertasActivasFiltradas = ofertas.filter((o) => o.activa === true);
      console.log(
        "Ofertas cargadas para punto",
        puntoId,
        ":",
        ofertasActivasFiltradas,
      );
      setOfertasActivas(ofertasActivasFiltradas);
    } catch (error) {
      console.error("Error cargando datos:", error);
      Alert.alert("Error", "No se pudieron cargar los productos de venta");
    } finally {
      setLoading(false);
    }
  };

  // Toggle modo de formato para un producto
  const toggleModoFormato = (productoId: number) => {
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id === productoId) {
          const nuevoEstadoFormato = !(p.formatoActivo || false);
          return { ...p, formatoActivo: nuevoEstadoFormato };
        }
        return p;
      }),
    );
  };

  // Vender producto por formato de almacenamiento
  const venderPorFormato = (producto: ProductoVenta) => {
    if (!producto.formato_almacen || !producto.unidades_por_formato) {
      Alert.alert(
        "Información",
        "Este producto no tiene configurado un formato de almacenamiento.",
      );
      return;
    }

    Alert.prompt(
      `Vender por ${producto.formato_almacen}`,
      `¿Cuántos ${producto.formato_almacen.toLowerCase()}(s) deseas vender?\n\nCada ${producto.formato_almacen.toLowerCase()} contiene ${producto.unidades_por_formato} unidades.\n\nStock disponible: ${producto.disponible} unidades (${Math.floor(producto.disponible / producto.unidades_por_formato)} ${producto.formato_almacen.toLowerCase()}(s) completos)`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Vender",
          onPress: (cantidadStr?: string) => {
            if (!cantidadStr) {
              Alert.alert("Error", "Ingresa una cantidad válida");
              return;
            }

            const cantidadFormatos = parseInt(cantidadStr);
            if (isNaN(cantidadFormatos) || cantidadFormatos <= 0) {
              Alert.alert("Error", "Ingresa una cantidad válida mayor a 0");
              return;
            }

            const totalUnidades =
              cantidadFormatos * producto.unidades_por_formato;

            if (totalUnidades > producto.disponible) {
              Alert.alert(
                "Error",
                `No hay suficiente stock.\n\nDisponible: ${producto.disponible} unidades\nSolicitado: ${totalUnidades} unidades (${cantidadFormatos} ${producto.formato_almacen.toLowerCase()}(s))`,
              );
              return;
            }

            // Actualizar cantidad seleccionada
            setProductos((prev) =>
              prev.map((p) => {
                if (p.id === producto.id) {
                  const nuevaCantidad = totalUnidades;

                  // Si está en modo selección múltiple, seleccionar automáticamente
                  if (modoSeleccionMultiple && nuevaCantidad > 0) {
                    setProductosSeleccionados((prevSeleccionados) => ({
                      ...prevSeleccionados,
                      [producto.id]: true,
                    }));
                    return {
                      ...p,
                      cantidadSeleccionada: nuevaCantidad,
                      seleccionado: true,
                    };
                  }

                  return { ...p, cantidadSeleccionada: nuevaCantidad };
                }
                return p;
              }),
            );

            Alert.alert(
              "✅ Cantidad Actualizada",
              `Se han seleccionado ${cantidadFormatos} ${producto.formato_almacen.toLowerCase()}(s) (${totalUnidades} unidades).\n\nPuedes usar "Añadir" para agregar a la orden o "Vender seleccionados" si está en modo selección múltiple.`,
            );
          },
        },
      ],
      "plain-text",
      "",
      "numeric",
    );
  };

  // Calcular cuántas unidades de un producto están en preordenes
  const calcularUnidadesEnPreordenes = (productoId: number): number => {
    let totalUnidades = 0;

    preordenesGuardadas.forEach((preorden) => {
      preorden.forEach((item) => {
        if (item.productoId === productoId) {
          totalUnidades += item.cantidad;
        }
      });
    });

    return totalUnidades;
  };

  // Actualizar cantidad seleccionada
  const actualizarCantidad = (productoId: number, incremento: number) => {
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id === productoId) {
          let nuevaCantidad: number;

          // Si el modo formato está activo, usar unidades por formato
          if (
            (p.formatoActivo || false) &&
            p.formato_almacen &&
            p.unidades_por_formato
          ) {
            nuevaCantidad = Math.max(
              0,
              Math.min(
                p.disponible,
                p.cantidadSeleccionada + incremento * p.unidades_por_formato,
              ),
            );
          } else {
            // Modo normal: usar unidades individuales
            nuevaCantidad = Math.max(
              0,
              Math.min(p.disponible, p.cantidadSeleccionada + incremento),
            );
          }

          // Si está en modo selección múltiple y la cantidad es mayor a 0, seleccionar automáticamente
          if (modoSeleccionMultiple && nuevaCantidad > 0) {
            setProductosSeleccionados((prevSeleccionados) => ({
              ...prevSeleccionados,
              [productoId]: true,
            }));
            return {
              ...p,
              cantidadSeleccionada: nuevaCantidad,
              seleccionado: true,
            };
          }

          // Si la cantidad es 0, deseleccionar automáticamente
          if (modoSeleccionMultiple && nuevaCantidad === 0) {
            setProductosSeleccionados((prevSeleccionados) => {
              const nuevosSeleccionados = { ...prevSeleccionados };
              delete nuevosSeleccionados[productoId];
              return nuevosSeleccionados;
            });
            return {
              ...p,
              cantidadSeleccionada: nuevaCantidad,
              seleccionado: false,
            };
          }

          return { ...p, cantidadSeleccionada: nuevaCantidad };
        }
        return p;
      }),
    );
  };

  // Funciones para selección múltiple
  const toggleSeleccionMultiple = () => {
    setModoSeleccionMultiple(!modoSeleccionMultiple);
    if (modoSeleccionMultiple) {
      // Si se desactiva el modo, limpiar selecciones
      setProductosSeleccionados({});
      setProductos((prev) => prev.map((p) => ({ ...p, seleccionado: false })));
    }
  };

  const toggleProductoSeleccionado = (productoId: number) => {
    setProductosSeleccionados((prev) => ({
      ...prev,
      [productoId]: !prev[productoId],
    }));

    setProductos((prev) =>
      prev.map((p) => {
        if (p.id === productoId) {
          return { ...p, seleccionado: !p.seleccionado };
        }
        return p;
      }),
    );
  };

  const seleccionarTodos = () => {
    const nuevosSeleccionados: { [key: number]: boolean } = {};
    productos.forEach((p) => {
      if (p.disponible > 0) {
        nuevosSeleccionados[p.id] = true;
      }
    });
    setProductosSeleccionados(nuevosSeleccionados);
    setProductos((prev) =>
      prev.map((p) => ({
        ...p,
        seleccionado: p.disponible > 0,
      })),
    );
  };

  const limpiarSeleccion = () => {
    setProductosSeleccionados({});
    setProductos((prev) => prev.map((p) => ({ ...p, seleccionado: false })));
  };

  // Obtener productos seleccionados con cantidades
  const getProductosSeleccionadosConCantidad = () => {
    return productos.filter(
      (p) => p.seleccionado && p.cantidadSeleccionada > 0,
    );
  };

  // Calcular total de productos seleccionados
  const calcularTotalSeleccionados = () => {
    return getProductosSeleccionadosConCantidad().reduce((total, producto) => {
      const precioUsar = calcularPrecioConsumoPropio(producto);
      return total + precioUsar * producto.cantidadSeleccionada;
    }, 0);
  };

  // Funciones para manejar preordenes
  const cerrarPreorden = () => {
    const productosConCantidad = getProductosSeleccionadosConCantidad();

    if (productosConCantidad.length === 0 && orden.length === 0) {
      Alert.alert("Atención", "No hay productos en la preorden");
      return;
    }

    // Combinar productos de selección múltiple con los de la orden actual
    let itemsPreorden: ItemOrden[] = [];

    // Agregar productos de selección múltiple
    if (productosConCantidad.length > 0) {
      productosConCantidad.forEach((producto) => {
        const precioUsar = calcularPrecioConsumoPropio(producto);

        const itemExistente = orden.find(
          (item) => item.productoId === producto.id,
        );

        if (itemExistente) {
          itemExistente.cantidad += producto.cantidadSeleccionada;
          itemExistente.subtotal =
            itemExistente.cantidad * itemExistente.precioVenta;
        } else {
          orden.push({
            productoId: producto.id,
            nombre: producto.nombre,
            precioVenta: precioUsar,
            cantidad: producto.cantidadSeleccionada,
            subtotal: precioUsar * producto.cantidadSeleccionada,
            precioCostoReal:
              producto.precio_coste_real || producto.precio_coste,
          });
        }

        // Resetear selección
        producto.cantidadSeleccionada = 0;
        producto.seleccionado = false;
      });
    }

    itemsPreorden = [...itemsPreorden, ...orden];

    // Guardar preorden en la lista de preordenes
    setPreordenesGuardadas((prev) => [...prev, itemsPreorden]);
    setPreordenGuardada(itemsPreorden);
    setPreordenActiva(true);
    setTotalOrden(
      itemsPreorden
        .filter((item) => item && item.subtotal)
        .reduce((sum, item) => sum + item.subtotal, 0),
    );

    // Limpiar estados DESPUÉS de guardar los productos
    if (productosConCantidad.length > 0) {
      setProductosSeleccionados({});
      setProductos((prev) =>
        prev.map((p) => ({
          ...p,
          seleccionado: false,
          cantidadSeleccionada: 0,
        })),
      );
      // No desactivar el modo de selección múltiple - mantener activo
    }

    if (orden.length > 0) {
      setOrden([]);
    }

    Alert.alert(
      "✅ Preorden Guardada",
      `Se han guardado ${itemsPreorden.length} productos en la preorden.\n\nTienes ${preordenesGuardadas.length + 1} preordenes guardadas.\n\nPodrás reanudar esta preorden más tarde para completar la venta.`,
      [{ text: "OK" }],
    );
  };

  // Función para guardar preorden con método de pago
  const guardarPreordenConPago = () => {
    if (!productoParaPago || !tipoPagoSeleccionado) {
      Alert.alert("Atención", "Selecciona un método de pago");
      return;
    }

    if (tipoPagoSeleccionado === "transferencia" && !metodoTransferencia) {
      Alert.alert("Atención", "Selecciona un método de transferencia");
      return;
    }

    if (tipoPagoSeleccionado === "mixto") {
      if (!metodoTransferencia) {
        Alert.alert("Atención", "Selecciona un método de transferencia");
        return;
      }
      if (
        !montoTransferenciaMixto ||
        parseFloat(montoTransferenciaMixto) <= 0
      ) {
        Alert.alert("Atención", "Ingresa un monto de transferencia válido");
        return;
      }
      if (parseFloat(montoTransferenciaMixto) > productoParaPago.subtotal) {
        Alert.alert(
          "Atención",
          "El monto de transferencia no puede exceder el total",
        );
        return;
      }
    }

    // Obtener productos guardados desde productosTemporales
    let itemsPreorden: ItemOrden[] = [];

    if (
      productoParaPago.productosTemporales &&
      productoParaPago.productosTemporales.length > 0
    ) {
      // Usar los productos guardados temporalmente
      itemsPreorden = productoParaPago.productosTemporales.map((item) => ({
        ...item,
        tipoPago: tipoPagoSeleccionado,
        metodoTransferencia:
          tipoPagoSeleccionado === "transferencia" ||
          tipoPagoSeleccionado === "mixto"
            ? metodoTransferencia
            : undefined,
        montoTransferencia:
          tipoPagoSeleccionado === "mixto"
            ? item.subtotal *
              (parseFloat(montoTransferenciaMixto!) / productoParaPago.subtotal)
            : undefined,
        montoEfectivo:
          tipoPagoSeleccionado === "mixto"
            ? item.subtotal *
              (1 -
                parseFloat(montoTransferenciaMixto!) /
                  productoParaPago.subtotal)
            : undefined,
      }));
    } else {
      // Si no hay productos temporales, intentar obtenerlos de la forma anterior (fallback)
      const productosConCantidad = getProductosSeleccionadosConCantidad();
      if (productosConCantidad.length > 0) {
        productosConCantidad.forEach((producto) => {
          const precioUsar = calcularPrecioConsumoPropio(producto);

          const subtotal = precioUsar * producto.cantidadSeleccionada;

          itemsPreorden.push({
            productoId: producto.id,
            nombre: producto.nombre,
            precioVenta: precioUsar,
            cantidad: producto.cantidadSeleccionada,
            subtotal: subtotal,
            precioCostoReal: producto.precio_coste_real,
            tipoPago: tipoPagoSeleccionado,
            metodoTransferencia:
              tipoPagoSeleccionado === "transferencia" ||
              tipoPagoSeleccionado === "mixto"
                ? metodoTransferencia
                : undefined,
            montoTransferencia:
              tipoPagoSeleccionado === "mixto"
                ? subtotal *
                  (parseFloat(montoTransferenciaMixto!) /
                    productoParaPago.subtotal)
                : undefined,
            montoEfectivo:
              tipoPagoSeleccionado === "mixto"
                ? subtotal *
                  (1 -
                    parseFloat(montoTransferenciaMixto!) /
                      productoParaPago.subtotal)
                : undefined,
          });
        });
      }

      // Si es preorden desde orden actual
      if (orden.length > 0) {
        itemsPreorden = orden
          .filter((item) => item && item.nombre)
          .map((item) => ({
            ...item,
            tipoPago: tipoPagoSeleccionado,
            metodoTransferencia:
              tipoPagoSeleccionado === "transferencia" ||
              tipoPagoSeleccionado === "mixto"
                ? metodoTransferencia
                : undefined,
            montoTransferencia:
              tipoPagoSeleccionado === "mixto"
                ? item.subtotal *
                  (parseFloat(montoTransferenciaMixto!) /
                    productoParaPago.subtotal)
                : undefined,
            montoEfectivo:
              tipoPagoSeleccionado === "mixto"
                ? item.subtotal *
                  (1 -
                    parseFloat(montoTransferenciaMixto!) /
                      productoParaPago.subtotal)
                : undefined,
          }));
      }
    }

    // Guardar preorden en la lista de preordenes
    setPreordenesGuardadas((prev) => [...prev, itemsPreorden]);
    setPreordenGuardada(itemsPreorden);
    setPreordenActiva(true);
    setTotalOrden(
      itemsPreorden
        .filter((item) => item && item.subtotal)
        .reduce((sum, item) => sum + item.subtotal, 0),
    );

    // Limpiar modal de pago
    setMostrarModalPago(false);
    setTipoPagoSeleccionado("");
    setMetodoTransferencia("");
    setMontoTransferenciaMixto("");
    setProductoParaPago(null);

    Alert.alert(
      esModalPreorden ? "✅ Preorden Guardada" : "✅ Orden Creada",
      esModalPreorden
        ? `Se han guardado ${itemsPreorden.length} productos en la preorden con método de pago: ${tipoPagoSeleccionado}.\n\nTienes ${preordenesGuardadas.length + 1} preordenes guardadas.`
        : `Se han agregado ${itemsPreorden.length} productos a la orden con método de pago: ${tipoPagoSeleccionado}.`,
      [{ text: "OK" }],
    );
  };

  const reanudarPreorden = (indice: number) => {
    const preordenSeleccionada = preordenesGuardadas[indice];
    if (!preordenSeleccionada) return;

    // Mostrar alerta de confirmación antes de reanudar
    Alert.alert(
      "⚠️ Reanudar Preorden",
      `¿Estás seguro de que deseas reanudar esta preorden?\n\n\u26a0\ufe0f **Importante**: Al reanudar esta preorden, será eliminada permanentemente de la lista de preordenes guardadas.\n\nEsta acción no se puede deshacer.\n\nProductos: ${preordenSeleccionada.length}\nTotal: ${formatMoneda(preordenSeleccionada.reduce((sum, item) => sum + item.subtotal, 0))}`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => {
            console.log("❌ Reanudación de preorden cancelada");
          },
        },
        {
          text: "Reanudar y Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Reanudar la preorden como una orden normal
              setOrden(preordenSeleccionada);
              setTotalOrden(
                preordenSeleccionada.reduce(
                  (sum, item) => sum + item.subtotal,
                  0,
                ),
              );
              setPreordenActiva(false);
              setPreordenGuardada([]);
              setMostrarListaPreordenes(false);
              setMostrarResumen(true); // Mostrar el resumen automáticamente

              // Eliminar la preorden de la lista
              const nuevasPreordenes = preordenesGuardadas.filter(
                (_, i) => i !== indice,
              );
              setPreordenesGuardadas(nuevasPreordenes);

              // Guardar en AsyncStorage
              await AsyncStorage.setItem(
                `preordenes_${puntoId}`,
                JSON.stringify(nuevasPreordenes),
              );

              Alert.alert(
                "✅ Preorden Reanudada",
                `Se han restaurado ${preordenSeleccionada.length} productos a la orden.\n\nLa preorden ha sido eliminada permanentemente.\n\nPuedes usar "Calcular" y "Confirmar Venta" normalmente.`,
                [{ text: "OK" }],
              );

              console.log("✅ Preorden reanudada y eliminada permanentemente");
            } catch (error) {
              console.error("Error reanudando preorden:", error);
              Alert.alert(
                "Error",
                "No se pudo reanudar la preorden. Inténtalo de nuevo.",
              );
            }
          },
        },
      ],
    );
  };

  const eliminarPreorden = async (indice: number) => {
    Alert.alert(
      "Eliminar Preorden",
      "¿Estás seguro de que deseas eliminar esta preorden?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Eliminar del estado
              const nuevasPreordenes = preordenesGuardadas.filter(
                (_, i) => i !== indice,
              );
              setPreordenesGuardadas(nuevasPreordenes);

              // Guardar en AsyncStorage
              await AsyncStorage.setItem(
                `preordenes_${puntoId}`,
                JSON.stringify(nuevasPreordenes),
              );

              // Si eliminamos la preorden activa, la desactivamos
              if (
                preordenActiva &&
                preordenesGuardadas[indice] === preordenGuardada
              ) {
                setPreordenActiva(false);
                setPreordenGuardada([]);
                setOrden([]);
                setTotalOrden(0);
              }

              Alert.alert(
                "Preorden Eliminada",
                "La preorden ha sido eliminada permanentemente.",
              );
            } catch (error) {
              console.error("Error eliminando preorden:", error);
              Alert.alert(
                "Error",
                "No se pudo eliminar la preorden. Inténtalo de nuevo.",
              );
            }
          },
        },
      ],
    );
  };

  const cancelarPreorden = () => {
    Alert.alert(
      "Cancelar Preorden",
      "¿Estás seguro de que deseas cancelar la preorden guardada?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: () => {
            setPreordenGuardada([]);
            setPreordenActiva(false);
            Alert.alert("Preorden Cancelada", "La preorden ha sido eliminada.");
          },
        },
      ],
    );
  };

  // Filtrar productos
  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria =
      !filtroCategoria || p.categoria === filtroCategoria;
    const coincideNombre =
      !filtroNombre ||
      p.nombre.toLowerCase().includes(filtroNombre.toLowerCase());
    return coincideCategoria && coincideNombre;
  });

  // Agregar a la orden
  const agregarALaOrden = (producto: ProductoVenta) => {
    if (producto.cantidadSeleccionada === 0) {
      Alert.alert("Atención", "Selecciona al menos 1 unidad");
      return;
    }

    // Determinar el precio a usar según el modo de Consumo Propio
    const precioUsar = calcularPrecioConsumoPropio(producto);

    const subtotal = precioUsar * producto.cantidadSeleccionada;

    // Si ya hay una orden activa, agregar directamente sin mostrar modal de pago
    if (orden.length > 0) {
      const nuevoItem: ItemOrden = {
        productoId: producto.id,
        nombre: producto.nombre,
        precioVenta: precioUsar,
        cantidad: producto.cantidadSeleccionada,
        subtotal: subtotal,
        precioCostoReal: producto.precio_coste_real,
      };

      // Agregar a la orden existente
      setOrden([...orden, nuevoItem]);

      // Resetear la cantidad seleccionada del producto
      setProductos((prev) =>
        prev.map((p) =>
          p.id === producto.id
            ? { ...p, cantidadSeleccionada: 0, seleccionado: false }
            : p,
        ),
      );

      // Mostrar confirmación
      Alert.alert(
        "✅ Producto Agregado",
        `${producto.nombre} (${producto.cantidadSeleccionada} unidades) se ha agregado a la orden existente.`,
        [{ text: "OK" }],
      );
    } else {
      // Si no hay orden activa, mostrar el modal de pago como antes
      setProductoParaPago({
        productoId: producto.id,
        nombre: producto.nombre,
        precioVenta: precioUsar,
        cantidad: producto.cantidadSeleccionada,
        subtotal: subtotal,
        precioCostoReal: producto.precio_coste_real,
      });
      setMostrarModalPago(true);
    }
  };

  // Vender múltiples productos seleccionados
  const venderProductosSeleccionados = () => {
    const productosConCantidad = getProductosSeleccionadosConCantidad();

    if (productosConCantidad.length === 0) {
      Alert.alert(
        "Atención",
        "Debes seleccionar al menos un producto y establecer cantidades mayores a 0",
      );
      return;
    }

    // Preparar información para el modal de pago
    const total = calcularTotalSeleccionados();

    setProductoParaPago({
      productoId: 0, // ID especial para indicar venta múltiple
      nombre: `Múltiples productos (${productosConCantidad.length})`,
      precioVenta: total,
      cantidad: productosConCantidad.reduce(
        (sum, p) => sum + p.cantidadSeleccionada,
        0,
      ),
      subtotal: total,
      precioCostoReal: 0,
      // Guardar los productos como metadata para agregar después
      productosTemporales: productosConCantidad.map((producto) => {
        const precioUsar = calcularPrecioConsumoPropio(producto);

        return {
          productoId: producto.id,
          nombre: producto.nombre,
          precioVenta: precioUsar,
          cantidad: producto.cantidadSeleccionada,
          subtotal: precioUsar * producto.cantidadSeleccionada,
          precioCostoReal: producto.precio_coste_real,
        };
      }),
    });
    setEsModalPreorden(false); // Indicar que es para agregar a orden, no preorden
    console.log(
      "🔍 Debug - venderProductosSeleccionados - esModalPreorden establecido en false",
    );
    setMostrarModalPago(true);
  };

  // Confirmar método de pago
  const confirmarMetodoPago = async () => {
    if (!productoParaPago) return;

    // Verificar si es un pago de deuda (productoId === -1)
    if (productoParaPago.productoId === -1 && flujoOrigen === "pago_deuda") {
      console.log("💰 Procesando pago de deuda:", productoParaPago);

      try {
        // Registrar el pago como una venta especial para que se refleje en el resumen del cierre
        const montoEfectivo =
          tipoPagoSeleccionado === "efectivo"
            ? productoParaPago.subtotal
            : tipoPagoSeleccionado === "mixto"
              ? productoParaPago.subtotal -
                parseFloat(montoTransferenciaMixto || "0")
              : 0;

        const montoTransferencia =
          tipoPagoSeleccionado === "transferencia"
            ? productoParaPago.subtotal
            : tipoPagoSeleccionado === "mixto"
              ? parseFloat(montoTransferenciaMixto || "0")
              : 0;

        // Crear venta especial para pago de deuda
        const ventaResult = await VentaHelper.crearVenta(
          puntoId!,
          productoParaPago.subtotal,
          tipoPagoSeleccionado as "efectivo" | "transferencia" | "mixto",
          montoEfectivo,
          montoTransferencia,
          metodoTransferencia,
        );

        const ventaId = ventaResult.lastInsertRowId;

        // Crear detalle de venta para registrar la ganancia
        // Usar el producto original del préstamo para que aparezca en el IPV
        if (ventaId) {
          // Obtener el producto_id original de la deuda
          const deudaInfo = await getFirst<any>(
            "SELECT producto_id FROM PrestamoDeuda WHERE id = ?",
            [productoParaPago.deudaId!],
          );

          const productoIdUsar = deudaInfo?.producto_id || -1; // Usar el original o -1 como fallback

          await executeNonQuery(
            `INSERT INTO DetalleVenta (
              venta_id, producto_id, cantidad, precio_unitario,
              precio_coste_real, subtotal
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              ventaId,
              productoIdUsar, // Usar el producto original del préstamo
              1, // Cantidad
              productoParaPago.subtotal, // Precio unitario igual al monto del pago
              0, // precio_coste_real = 0 para que la ganancia sea el 100%
              productoParaPago.subtotal,
            ],
          );

          console.log(
            `💰 DetalleVenta creado para pago de deuda: $${productoParaPago.subtotal} (ganancia 100%, producto_id: ${productoIdUsar})`,
          );
        }

        // Marcar la deuda como pagada
        const result = await PrestamoDeudaHelper.marcarComoPagado(
          productoParaPago.deudaId!,
        );

        if (result.changes > 0) {
          // Limpiar modal de pago
          setMostrarModalPago(false);
          setTipoPagoSeleccionado("");
          setMetodoTransferencia("");
          setMontoTransferenciaMixto("");
          setProductoParaPago(null);
          setFlujoOrigen(null);

          Alert.alert(
            "✅ Pago Registrado",
            `Deuda "${productoParaPago.descripcionDeuda}" marcada como pagada con método: ${tipoPagoSeleccionado}\n\n💰 Ganancia de $${productoParaPago.subtotal} registrada correctamente.\n\nEl pago se ha registrado en el resumen del día.`,
            [{ text: "OK" }],
          );

          // Recargar la lista de deudas
          await abrirModalGestionDeudas();
        } else {
          Alert.alert("Error", "No se pudo marcar la deuda como pagada");
        }
      } catch (error) {
        console.error("Error procesando pago de deuda:", error);
        Alert.alert("Error", "No se pudo procesar el pago de la deuda");
      }
      return;
    }

    if (tipoPagoSeleccionado === "transferencia" && !metodoTransferencia) {
      Alert.alert("Atención", "Selecciona un método de transferencia");
      return;
    }

    if (tipoPagoSeleccionado === "mixto") {
      if (!metodoTransferencia) {
        Alert.alert("Atención", "Selecciona un método de transferencia");
        return;
      }
      if (
        !montoTransferenciaMixto ||
        parseFloat(montoTransferenciaMixto) <= 0
      ) {
        Alert.alert("Atención", "Ingresa un monto de transferencia válido");
        return;
      }
      if (parseFloat(montoTransferenciaMixto) > productoParaPago.subtotal) {
        Alert.alert(
          "Atención",
          "El monto de transferencia no puede exceder el total",
        );
        return;
      }
    }

    if (tipoPagoSeleccionado === "deuda" && !descripcionPrestamo.trim()) {
      Alert.alert("Atención", "Ingresa una descripción para el préstamo");
      return;
    }

    // Si es deuda, crear préstamo/deuda
    if (tipoPagoSeleccionado === "deuda") {
      await crearDeuda(productoParaPago);
      return;
    }

    // Verificar si es venta múltiple (productoId === 0)
    if (productoParaPago.productoId === 0) {
      console.log("🔍 Debug - esModalPreorden:", esModalPreorden);
      console.log("🔍 Debug - productoParaPago:", productoParaPago);

      if (esModalPreorden) {
        // Es preorden reanudada - actualizar la orden existente con método de pago
        console.log("📦 Actualizando preorden reanudada con método de pago...");

        const ordenActualizada = (
          productoParaPago.productosTemporales || []
        ).map((item) => ({
          ...item,
          tipoPago: tipoPagoSeleccionado,
          metodoTransferencia:
            tipoPagoSeleccionado === "transferencia" ||
            tipoPagoSeleccionado === "mixto"
              ? metodoTransferencia
              : undefined,
          montoTransferencia:
            tipoPagoSeleccionado === "mixto"
              ? item.subtotal *
                (parseFloat(montoTransferenciaMixto!) /
                  productoParaPago.subtotal)
              : tipoPagoSeleccionado === "transferencia"
                ? item.subtotal
                : undefined,
          montoEfectivo:
            tipoPagoSeleccionado === "mixto"
              ? item.subtotal *
                (1 -
                  parseFloat(montoTransferenciaMixto!) /
                    productoParaPago.subtotal)
              : tipoPagoSeleccionado === "efectivo"
                ? item.subtotal
                : undefined,
        }));

        setOrden(ordenActualizada);

        // Limpiar modal de pago
        setMostrarModalPago(false);
        setTipoPagoSeleccionado("");
        setMetodoTransferencia("");
        setMontoTransferenciaMixto("");
        setProductoParaPago(null);
        setEsModalPreorden(false);
        setFlujoOrigen(null);

        Alert.alert(
          "✅ Método de Pago Asignado",
          `Se ha asignado el método de pago ${tipoPagoSeleccionado} a la orden.\n\nAhora puedes continuar con el proceso de venta.`,
          [{ text: "OK" }],
        );

        // Continuar automáticamente según el origen del flujo
        setTimeout(() => {
          if (flujoOrigen === "calcular") {
            // Si viene de Calcular, preparar ofertas y mostrar el modal de selección de ofertas
            // Preparar ofertas disponibles para cada producto
            const ofertasPorProducto: { [key: number]: any } = {};
            const seleccionadasIniciales: { [key: number]: boolean } = {};

            orden.forEach((item) => {
              // Buscar si hay ofertas aplicables a este producto
              const ofertaAplicable = ofertasActivas.find((oferta) => {
                // La oferta debe estar activa
                if (!oferta.activa) return false;

                // Si la oferta aplica a todos los productos
                if (oferta.aplica_a_todos) return true;

                // Si la oferta tiene productos específicos, verificar si incluye este producto
                if (oferta.productos && oferta.productos.length > 0) {
                  const incluyeProducto = oferta.productos.some(
                    (p) => p.producto_id === item.productoId,
                  );
                  if (incluyeProducto) return true;
                }

                return false;
              });

              if (ofertaAplicable) {
                ofertasPorProducto[item.productoId] = ofertaAplicable;
                // Mantener el estado previo si existe
                if (!(item.productoId in ofertasSeleccionadas)) {
                  seleccionadasIniciales[item.productoId] = false;
                }
              }
            });

            setOfertasDisponibles(ofertasPorProducto);

            // Solo actualizar ofertasSeleccionadas si hay nuevos productos
            const productosActuales = Object.keys(ofertasPorProducto).map(
              (id) => parseInt(id),
            );
            const productosPrevios = Object.keys(ofertasSeleccionadas).map(
              (id) => parseInt(id),
            );

            if (productosActuales.length !== productosPrevios.length) {
              // Hay nuevos productos, inicializar todos
              setOfertasSeleccionadas(seleccionadasIniciales);
            } else {
              // Mismo número de productos, mantener estado previo
              const nuevoEstado = { ...ofertasSeleccionadas };
              productosActuales.forEach((productoId) => {
                if (!(productoId in nuevoEstado)) {
                  nuevoEstado[productoId] = false;
                }
              });
              setOfertasSeleccionadas(nuevoEstado);
            }

            // Mostrar el modal de selección de ofertas
            setMostrarModalSeleccionOfertas(true);
          } else if (flujoOrigen === "confirmar") {
            // Si viene de Confirmar Venta, ir directamente al modal de Confirmar Orden
            // Preparar ofertas disponibles primero
            const ofertasPorProducto: { [key: number]: any } = {};
            const seleccionadasIniciales: { [key: number]: boolean } = {};

            orden.forEach((item) => {
              // Buscar si hay ofertas aplicables a este producto
              const ofertaAplicable = ofertasActivas.find((oferta) => {
                if (!oferta.activa) return false;
                if (oferta.aplica_a_todos) return true;
                if (oferta.productos && oferta.productos.length > 0) {
                  return oferta.productos.some(
                    (p) => p.producto_id === item.productoId,
                  );
                }
                return false;
              });

              if (ofertaAplicable) {
                ofertasPorProducto[item.productoId] = ofertaAplicable;
                if (!(item.productoId in ofertasSeleccionadas)) {
                  seleccionadasIniciales[item.productoId] = false;
                }
              }
            });

            setOfertasDisponibles(ofertasPorProducto);

            // Actualizar ofertasSeleccionadas si es necesario
            const productosActuales = Object.keys(ofertasPorProducto).map(
              (id) => parseInt(id),
            );
            const productosPrevios = Object.keys(ofertasSeleccionadas).map(
              (id) => parseInt(id),
            );

            if (productosActuales.length !== productosPrevios.length) {
              setOfertasSeleccionadas(seleccionadasIniciales);
            } else {
              const nuevoEstado = { ...ofertasSeleccionadas };
              productosActuales.forEach((productoId) => {
                if (!(productoId in nuevoEstado)) {
                  nuevoEstado[productoId] = false;
                }
              });
              setOfertasSeleccionadas(nuevoEstado);
            }

            // Mostrar directamente el modal de Confirmar Orden
            setMostrarModalOrden(true);
          }
        }, 500);
        return;
      }

      console.log("🛒 Agregando a orden directa...");

      // Es venta múltiple - usar productos guardados en productosTemporales
      const productosParaAgregar = productoParaPago.productosTemporales || [];

      for (const productoItem of productosParaAgregar) {
        let subtotalFinal = productoItem.subtotal;
        let montoTransferenciaAmount = 0;
        let montoEfectivoAmount = 0;

        if (tipoPagoSeleccionado === "mixto") {
          const montoTransferenciaMixtoNum = parseFloat(
            montoTransferenciaMixto,
          );
          const proporcionTransferencia =
            montoTransferenciaMixtoNum / productoParaPago.subtotal;
          montoTransferenciaAmount = subtotalFinal * proporcionTransferencia;
          montoEfectivoAmount = subtotalFinal - montoTransferenciaAmount;
        }

        const nuevoItem: ItemOrden = {
          productoId: productoItem.productoId,
          nombre: productoItem.nombre,
          precioVenta: productoItem.precioVenta,
          cantidad: productoItem.cantidad,
          subtotal: subtotalFinal,
          tipoPago: tipoPagoSeleccionado,
          metodoTransferencia:
            tipoPagoSeleccionado === "transferencia" ||
            tipoPagoSeleccionado === "mixto"
              ? metodoTransferencia
              : undefined,
          montoTransferencia:
            tipoPagoSeleccionado === "mixto"
              ? montoTransferenciaAmount
              : undefined,
          montoEfectivo:
            tipoPagoSeleccionado === "mixto" ? montoEfectivoAmount : undefined,
          precioCostoReal: productoItem.precioCostoReal,
        };

        setOrden((prev) => [...prev, nuevoItem]);
      }

      // Limpiar selecciones y resetear productos
      setProductosSeleccionados({});
      setProductos((prev) =>
        prev.map((p) => ({
          ...p,
          cantidadSeleccionada: 0,
          seleccionado: false,
        })),
      );
      // No desactivar el modo de selección múltiple - mantener activo

      // Resetear estados del modal
      resetearDespuesDePago(0);

      // Si el pago es por transferencia, ir directamente a confirmar orden
      if (tipoPagoSeleccionado === "transferencia") {
        setTimeout(() => {
          confirmarOrden();
        }, 100);
      }
    } else {
      // Es venta individual - procesar normalmente
      let subtotalFinal = productoParaPago.subtotal;
      let montoTransferenciaAmount = 0;
      let montoEfectivoAmount = 0;

      if (tipoPagoSeleccionado === "mixto") {
        montoTransferenciaAmount = parseFloat(montoTransferenciaMixto);
        montoEfectivoAmount = subtotalFinal - montoTransferenciaAmount;
      }

      const nuevoItem: ItemOrden = {
        ...productoParaPago,
        subtotal: subtotalFinal,
        tipoPago: tipoPagoSeleccionado,
        metodoTransferencia:
          tipoPagoSeleccionado === "transferencia" ||
          tipoPagoSeleccionado === "mixto"
            ? metodoTransferencia
            : undefined,
        montoTransferencia:
          tipoPagoSeleccionado === "mixto"
            ? montoTransferenciaAmount
            : undefined,
        montoEfectivo:
          tipoPagoSeleccionado === "mixto" ? montoEfectivoAmount : undefined,
      };

      setOrden((prev) => [...prev, nuevoItem]);
      // El total se actualizará automáticamente por el useEffect

      // Resetear estados
      resetearDespuesDePago(productoParaPago.productoId);

      // Si el pago es por transferencia, omitir el modal de cálculo y ir directamente a confirmar orden
      if (tipoPagoSeleccionado === "transferencia") {
        // Pequeña delay para asegurar que el estado se actualice
        setTimeout(() => {
          confirmarOrden();
        }, 100);
      }
    }
  };

  // Crear deuda (ahora será préstamo)
  const crearDeuda = async (item: ItemOrden) => {
    if (isProcessingSale) {
      console.log("⚠️ Venta ya en proceso, evitando ejecución duplicada");
      return;
    }

    setIsProcessingSale(true);

    try {
      console.log(
        "🚀 Iniciando proceso de préstamo con",
        item.cantidad,
        "unidades de",
        item.nombre,
      );
      console.log("🔍 DEBUG - Item recibido:", item);
      console.log("🔍 DEBUG - productoId:", item.productoId);
      console.log("🔍 DEBUG - cantidad:", item.cantidad);

      // Crear préstamo usando PrestamoDeudaHelper
      let productoIdOriginal = item.productoId;

      // Si es venta múltiple, guardar el primer producto como referencia
      if (
        item.productoId === 0 &&
        item.productosTemporales &&
        item.productosTemporales.length > 0
      ) {
        productoIdOriginal = item.productosTemporales[0].productoId;
      }

      const result = await PrestamoDeudaHelper.create(
        "prestamo", // Cambiado de "deuda" a "préstamo"
        descripcionPrestamo.trim(), // Usar la descripción personalizada
        item.subtotal,
        getFechaLocal(), // fecha_inicio hoy
        getFechaDentroDeDias(7), // vence en 7 días (una semana)
        puntoId!,
        "CUP",
        `Préstamo por venta: ${item.nombre}`,
        productoIdOriginal, // Guardar el producto original
      );
      if (result.lastInsertRowId > 0) {
        console.log("✅ Préstamo creado con ID:", result.lastInsertRowId);

        // Actualizar stock del producto usando la misma lógica que finalizarVenta
        console.log(
          "🔄 Actualizando stock - productoId:",
          item.productoId,
          "cantidad:",
          item.cantidad,
          "puntoId:",
          puntoId,
        );

        if (item.productoId === 0 && item.productosTemporales) {
          // Es venta múltiple - actualizar cada producto individualmente
          console.log(
            "📦 Venta múltiple detectada - actualizando",
            item.productosTemporales.length,
            "productos",
          );

          for (const producto of item.productosTemporales) {
            console.log(
              "🔄 Actualizando producto individual:",
              producto.nombre,
              "ID:",
              producto.productoId,
              "cantidad:",
              producto.cantidad,
            );

            await executeDbOperationWithRetry(async () => {
              const updateResult = await db.runAsync(
                "UPDATE AlmacenZona SET cantidad = cantidad - ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
                [producto.cantidad, producto.productoId, puntoId!],
              );
              console.log(
                "🔍 DEBUG - Update result for",
                producto.nombre,
                ":",
                updateResult,
              );
              console.log(
                `✅ Stock actualizado para ${producto.nombre}: -${producto.cantidad} unidades`,
              );
              return updateResult;
            });
          }
        } else {
          // Es producto individual - actualizar normalmente
          await executeDbOperationWithRetry(async () => {
            const updateResult = await db.runAsync(
              "UPDATE AlmacenZona SET cantidad = cantidad - ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
              [item.cantidad, item.productoId, puntoId!],
            );
            console.log("🔍 DEBUG - Update result:", updateResult);
            console.log(
              `✅ Stock actualizado para ${item.nombre}: -${item.cantidad} unidades`,
            );
            return updateResult;
          });
        }

        Alert.alert(
          "Éxito",
          "Préstamo registrado correctamente. Se contabilizará como venta cuando sea pagado.",
          [
            {
              text: "OK",
              onPress: async () => {
                setIsProcessingSale(false);
                resetearDespuesDePago(item.productoId);
                cargarDatos(); // Recargar disponibilidad
              },
            },
          ],
        );
      } else {
        throw new Error("No se pudo crear el préstamo");
      }
    } catch (error: any) {
      console.error("Error creando préstamo:", error);
      Alert.alert(
        "Error",
        "No se pudo registrar el préstamo: " + error.message,
      );
      setIsProcessingSale(false);
    }
  };

  // Resetear estados después del pago
  const resetearDespuesDePago = (productoId: number) => {
    setProductoParaPago(null);
    setTipoPagoSeleccionado("");
    setMetodoTransferencia("");
    setDescripcionPrestamo("");
    setMontoTransferenciaMixto("");
    setMostrarCampoTransferenciaMixto(false);
    setMostrarModalPago(false);
    setEsModalPreorden(false); // Resetear estado de modal preorden

    // Resetear cantidad seleccionada
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id === productoId) {
          return { ...p, cantidadSeleccionada: 0 };
        }
        return p;
      }),
    );
  };

  // Calcular total de la orden (ya no se usa manualmente, lo hace el useEffect)
  // const calcularTotal = () => {
  //   const total = orden.reduce((sum, item) => sum + item.subtotal, 0);
  //   console.log("Calculando total manualmente:", { orden, total });
  //   setTotalOrden(total);
  // };

  // Calcular total de billetes en tiempo real
  const calcularTotalBilletes = () => {
    return Object.entries(billetes).reduce(
      (total, [denominacion, cantidad]) => {
        return total + parseInt(denominacion) * cantidad;
      },
      0,
    );
  };

  // Calcular monto total que se debe pagar en efectivo
  const calcularMontoEfectivoRequerido = () => {
    const totalEfectivo = orden
      .filter((o) => o.tipoPago === "efectivo")
      .reduce((sum, o) => sum + calcularPrecioConOferta(o), 0);

    const totalMixtoEfectivo = orden
      .filter((o) => o.tipoPago === "mixto")
      .reduce((sum, o) => {
        const descuentoInfo = calcularDescuentoMixto(o);
        return sum + descuentoInfo.precioFinalEfectivo;
      }, 0);

    return totalEfectivo + totalMixtoEfectivo;
  };

  // Calcular vuelto (dinámico: negativo si falta dinero, positivo si hay que dar vuelto)
  const calcularVuelto = () => {
    const totalRecibido = calcularTotalBilletes();
    // CORRECCIÓN: Calcular vuelto solo sobre el monto efectivo requerido
    // La parte de transferencia no necesita ser contada en billetes
    const montoEfectivoRequerido = calcularMontoEfectivoRequerido();
    const vuelto = totalRecibido - montoEfectivoRequerido;
    // Ahora devuelve el valor real: puede ser negativo (falta dinero) o positivo (hay que dar vuelto)
    return vuelto;
  };

  // Incrementar cantidad de billetes
  const incrementarBillete = (denominacion: number) => {
    setBilletes((prev) => ({
      ...prev,
      [denominacion]: prev[denominacion] + 1,
    }));
  };

  // Disminuir cantidad de billetes
  const disminuirBillete = (denominacion: number) => {
    setBilletes((prev) => ({
      ...prev,
      [denominacion]: Math.max(0, prev[denominacion] - 1),
    }));
  };

  // Actualizar cantidad de billetes manualmente
  const actualizarCantidadManual = (denominacion: number, valor: string) => {
    setValorTemporal(valor);
    const cantidad = parseInt(valor) || 0;
    setBilletes((prev) => ({
      ...prev,
      [denominacion]: Math.max(0, cantidad),
    }));
  };

  // Manejar el foco del TextInput
  const manejarFoco = (denominacion: number) => {
    setEditandoDenominacion(denominacion);
    setValorTemporal((billetes[denominacion] || 0).toString());
  };

  // Manejar la pérdida de foco
  const manejarPerdidaFoco = () => {
    setEditandoDenominacion(null);
    setValorTemporal("");
  };

  // Remover item de la orden
  const removerDeOrden = (index: number) => {
    const nuevaOrden = [...orden];
    nuevaOrden.splice(index, 1);
    setOrden(nuevaOrden);
    // El total se actualizará automáticamente por el useEffect
  };

  // Mostrar modal de selección de ofertas
  const mostrarSeleccionOfertas = () => {
    if (orden.length === 0) {
      Alert.alert("Atención", "No hay productos en la orden");
      return;
    }

    // Verificar si hay productos sin método de pago (viene de preorden reanudada)
    const sinMetodoPago = orden.some((item) => !item.tipoPago);

    if (sinMetodoPago) {
      // Mostrar modal para seleccionar método de pago primero
      setProductoParaPago({
        productoId: 0, // ID especial para preorden
        nombre: `Preorden Reanudada (${orden.length} productos)`,
        precioVenta: orden.reduce((sum, item) => sum + item.subtotal, 0),
        cantidad: orden.reduce((sum, item) => sum + item.cantidad, 0),
        subtotal: orden.reduce((sum, item) => sum + item.subtotal, 0),
        precioCostoReal: 0,
        productosTemporales: orden,
      });
      setEsModalPreorden(true); // Indicar que es para preorden reanudada
      setFlujoOrigen("calcular"); // Establecer que viene del botón Calcular
      setMostrarModalPago(true);
      return;
    }

    // IMPORTANTE: Preparar ofertas disponibles antes de mostrar el modal
    // Esto asegura que los checkboxes tengan el estado correcto
    const ofertasPorProducto: { [key: number]: any } = {};
    const seleccionadasIniciales: { [key: number]: boolean } = {};

    orden.forEach((item) => {
      // Buscar si hay ofertas aplicables a este producto
      const ofertaAplicable = ofertasActivas.find((oferta) => {
        console.log(
          "Verificando oferta para producto",
          item.productoId,
          "oferta:",
          oferta,
        );

        // La oferta debe estar activa
        if (!oferta.activa) {
          console.log("Oferta no está activa");
          return false;
        }

        // Si la oferta aplica a todos los productos
        if (oferta.aplica_a_todos) {
          console.log("Oferta aplica a todos los productos");
          return true;
        }

        // Si la oferta tiene productos específicos, verificar si incluye este producto
        if (oferta.productos && oferta.productos.length > 0) {
          const incluyeProducto = oferta.productos.some(
            (p) => p.producto_id === item.productoId,
          );
          console.log(
            "Verificando productos específicos:",
            oferta.productos.map((p) => p.producto_id),
            "incluye producto:",
            incluyeProducto,
          );
          if (incluyeProducto) return true;
        }

        return false;
      });

      console.log(
        "Oferta aplicable para producto",
        item.productoId,
        ":",
        ofertaAplicable,
      );

      if (ofertaAplicable) {
        ofertasPorProducto[item.productoId] = ofertaAplicable;
        // Mantener el estado previo si existe
        if (!(item.productoId in ofertasSeleccionadas)) {
          seleccionadasIniciales[item.productoId] = false;
        }
      }
    });

    setOfertasDisponibles(ofertasPorProducto);

    // Solo actualizar ofertasSeleccionadas si hay nuevos productos
    const productosActuales = Object.keys(ofertasPorProducto).map((id) =>
      parseInt(id),
    );
    const productosPrevios = Object.keys(ofertasSeleccionadas).map((id) =>
      parseInt(id),
    );

    if (productosActuales.length !== productosPrevios.length) {
      // Hay nuevos productos, inicializar todos
      setOfertasSeleccionadas(seleccionadasIniciales);
    } else {
      // Mismo número de productos, mantener estado previo
      const nuevoEstado = { ...ofertasSeleccionadas };
      productosActuales.forEach((productoId) => {
        if (!(productoId in nuevoEstado)) {
          nuevoEstado[productoId] = false;
        }
      });
      setOfertasSeleccionadas(nuevoEstado);
    }

    setMostrarModalSeleccionOfertas(true);
  };

  // Confirmar selección de ofertas y pasar al cálculo de dinero
  const confirmarSeleccionOfertas = () => {
    setMostrarModalSeleccionOfertas(false);

    // Verificar si TODOS los pagos son por transferencia pura para omitir el modal de cálculo
    const todosTransferenciaPura = orden.every(
      (item) => item.tipoPago === "transferencia",
    );

    if (todosTransferenciaPura) {
      // Si todos son transferencia pura, ir directamente a finalizar la venta
      setTimeout(() => {
        finalizarVenta();
      }, 100);
    } else {
      // Si hay algún pago en efectivo o mixto, mostrar el modal de cálculo para contar el efectivo
      setMostrarModalCalculo(true);
    }
  };

  // Confirmar orden
  const confirmarOrden = () => {
    if (orden.length === 0) {
      Alert.alert("Atención", "No hay productos en la orden");
      return;
    }

    // Verificar si hay productos sin método de pago (viene de preorden reanudada)
    const sinMetodoPago = orden.some((item) => !item.tipoPago);

    if (sinMetodoPago) {
      // Mostrar modal para seleccionar método de pago primero
      setProductoParaPago({
        productoId: 0, // ID especial para preorden
        nombre: `Preorden Reanudada (${orden.length} productos)`,
        precioVenta: orden.reduce((sum, item) => sum + item.subtotal, 0),
        cantidad: orden.reduce((sum, item) => sum + item.cantidad, 0),
        subtotal: orden.reduce((sum, item) => sum + item.subtotal, 0),
        precioCostoReal: 0,
        productosTemporales: orden,
      });
      setEsModalPreorden(true); // Indicar que es para preorden reanudada
      setFlujoOrigen("confirmar"); // Establecer que viene del botón Confirmar Venta
      setMostrarModalPago(true);
      return;
    }

    // Preparar ofertas disponibles para cada producto (trabajo individual)
    const ofertasPorProducto: { [key: number]: any } = {};

    orden.forEach((item) => {
      // Buscar si hay ofertas aplicables a este producto
      const ofertaAplicable = ofertasActivas.find((oferta) => {
        console.log(
          "Verificando oferta para producto",
          item.productoId,
          "oferta:",
          oferta,
        );

        // La oferta debe estar activa
        if (!oferta.activa) {
          console.log("Oferta no está activa");
          return false;
        }

        // Si la oferta aplica a todos los productos
        if (oferta.aplica_a_todos) {
          console.log("Oferta aplica a todos los productos");
          return true;
        }

        // Si la oferta tiene productos específicos, verificar si incluye este producto
        if (oferta.productos && oferta.productos.length > 0) {
          const incluyeProducto = oferta.productos.some(
            (p) => p.producto_id === item.productoId,
          );
          console.log(
            "Verificando productos específicos:",
            oferta.productos.map((p) => p.producto_id),
            "incluye producto:",
            incluyeProducto,
          );
          if (incluyeProducto) return true;
        }

        return false;
      });

      console.log(
        "Oferta aplicable para producto",
        item.productoId,
        ":",
        ofertaAplicable,
      );

      if (ofertaAplicable) {
        ofertasPorProducto[item.productoId] = ofertaAplicable;
      }
    });

    // IMPORTANTE: Solo inicializar ofertas seleccionadas si no hay estado previo
    // Esto evita que se reseteen los checkboxes al volver a entrar
    const hayEstadoPrevio = Object.keys(ofertasSeleccionadas).length > 0;
    if (!hayEstadoPrevio) {
      const seleccionadasIniciales: { [key: number]: boolean } = {};
      Object.keys(ofertasPorProducto).forEach((productoId) => {
        seleccionadasIniciales[parseInt(productoId)] = false; // Por defecto no seleccionada
      });
      setOfertasSeleccionadas(seleccionadasIniciales);
    }

    setOfertasDisponibles(ofertasPorProducto);
    setMostrarModalOrden(true);
  };

  // Calcular precio con descuento para un producto
  const calcularPrecioConOferta = (item: ItemOrden | undefined): number => {
    if (!item || !item.subtotal) {
      return 0;
    }
    const oferta = ofertasDisponibles[item.productoId];
    if (!oferta || !ofertasSeleccionadas[item.productoId]) {
      return item.subtotal;
    }

    // Para pagos mixtos, usar la distribución de descuentos
    if (item.tipoPago === "mixto") {
      const descuentoInfo = calcularDescuentoMixto(item);
      return (
        descuentoInfo.precioFinalEfectivo +
        descuentoInfo.precioFinalTransferencia
      );
    }

    // Si la oferta aplica a todos, usar el descuento general
    if (oferta.aplica_a_todos) {
      // Usar el descuento general de la oferta
      if (
        oferta.tipo_descuento_todos === "porcentaje" &&
        oferta.valor_descuento_todos
      ) {
        const precioUnitarioConDescuento =
          item.precioVenta * (1 - oferta.valor_descuento_todos / 100);
        return precioUnitarioConDescuento * item.cantidad;
      } else if (
        oferta.tipo_descuento_todos === "valor" &&
        oferta.valor_descuento_todos
      ) {
        const precioUnitarioConDescuento = Math.max(
          0,
          item.precioVenta - oferta.valor_descuento_todos,
        );
        return precioUnitarioConDescuento * item.cantidad;
      }

      // Si no hay descuento general configurado, retornar subtotal normal
      return item.subtotal;
    }

    // Si la oferta tiene productos específicos, buscar el descuento para este producto
    if (oferta.productos && oferta.productos.length > 0) {
      const productoOferta = oferta.productos.find(
        (p) => p.producto_id === item.productoId,
      );
      if (productoOferta) {
        if (productoOferta.tipo_descuento === "porcentaje") {
          // CORRECCIÓN: Calcular descuento por unidad y luego multiplicar por cantidad
          const precioUnitarioConDescuento =
            item.precioVenta * (1 - productoOferta.valor_descuento / 100);
          return precioUnitarioConDescuento * item.cantidad;
        } else if (productoOferta.tipo_descuento === "valor") {
          // CORRECCIÓN: Calcular descuento por unidad y luego multiplicar por cantidad
          const precioUnitarioConDescuento = Math.max(
            0,
            item.precioVenta - productoOferta.valor_descuento,
          );
          return precioUnitarioConDescuento * item.cantidad;
        }
      }
    }

    return item.subtotal;
  };

  // Calcular precio con descuento para productos en la lista (antes de agregar a la orden)
  const calcularPrecioConOfertaProducto = (
    producto: ProductoVenta | undefined,
  ): number => {
    if (!producto) {
      return 0;
    }
    const oferta = ofertasDisponibles[producto.id];
    if (!oferta || !ofertasSeleccionadas[producto.id]) {
      return consumoPropioActivo
        ? producto.precio_coste_real || producto.precio_coste || 0
        : producto.precio_venta || 0;
    }

    // Si la oferta aplica a todos, usar el descuento general
    if (oferta.aplica_a_todos) {
      const precioBase = consumoPropioActivo
        ? producto.precio_coste_real || producto.precio_coste || 0
        : producto.precio_venta || 0;

      // Usar el descuento general de la oferta
      if (
        oferta.tipo_descuento_todos === "porcentaje" &&
        oferta.valor_descuento_todos
      ) {
        return precioBase * (1 - oferta.valor_descuento_todos / 100);
      } else if (
        oferta.tipo_descuento_todos === "valor" &&
        oferta.valor_descuento_todos
      ) {
        return Math.max(0, precioBase - oferta.valor_descuento_todos);
      }

      // Si no hay descuento general configurado, retornar precio normal
      return precioBase;
    }

    // Si la oferta tiene productos específicos, buscar el descuento para este producto
    if (oferta.productos && oferta.productos.length > 0) {
      const productoOferta = oferta.productos.find(
        (p) => p.producto_id === producto.id,
      );
      if (productoOferta) {
        const precioBase = consumoPropioActivo
          ? producto.precio_coste_real || producto.precio_coste
          : producto.precio_venta;

        if (productoOferta.tipo_descuento === "porcentaje") {
          return precioBase * (1 - productoOferta.valor_descuento / 100);
        } else if (productoOferta.tipo_descuento === "valor") {
          return Math.max(0, precioBase - productoOferta.valor_descuento);
        }
      }
    }

    return consumoPropioActivo
      ? producto.precio_coste_real || producto.precio_coste
      : producto.precio_venta;
  };

  // Calcular descuento distribuido para pagos mixtos
  const calcularDescuentoMixto = (
    item: ItemOrden,
  ): {
    descuentoTotal: number;
    descuentoEfectivo: number;
    descuentoTransferencia: number;
    precioFinalEfectivo: number;
    precioFinalTransferencia: number;
  } => {
    const oferta = ofertasDisponibles[item.productoId];
    if (!oferta || !ofertasSeleccionadas[item.productoId]) {
      return {
        descuentoTotal: 0,
        descuentoEfectivo: 0,
        descuentoTransferencia: 0,
        precioFinalEfectivo: item.montoEfectivo || 0,
        precioFinalTransferencia: item.montoTransferencia || 0,
      };
    }

    // Calcular descuento total
    let descuentoTotal = 0;
    const precioBase = consumoPropioActivo
      ? item.precioCostoReal || item.precioVenta
      : item.precioVenta;

    if (oferta.aplica_a_todos) {
      if (
        oferta.tipo_descuento_todos === "porcentaje" &&
        oferta.valor_descuento_todos
      ) {
        descuentoTotal =
          precioBase * item.cantidad * (oferta.valor_descuento_todos / 100);
      } else if (
        oferta.tipo_descuento_todos === "valor" &&
        oferta.valor_descuento_todos
      ) {
        descuentoTotal = Math.min(
          precioBase * item.cantidad,
          oferta.valor_descuento_todos * item.cantidad,
        );
      }
    }

    // Para pagos mixtos, el descuento se aplica primero al efectivo
    if (item.tipoPago === "mixto") {
      const montoEfectivo = item.montoEfectivo || 0;
      const montoTransferencia = item.montoTransferencia || 0;

      // El descuento se reduce del efectivo primero
      const descuentoEfectivo = Math.min(descuentoTotal, montoEfectivo);
      const descuentoTransferencia = descuentoTotal - descuentoEfectivo;

      return {
        descuentoTotal,
        descuentoEfectivo,
        descuentoTransferencia,
        precioFinalEfectivo: montoEfectivo - descuentoEfectivo,
        precioFinalTransferencia: montoTransferencia - descuentoTransferencia,
      };
    }

    // Para pagos únicos (efectivo o transferencia)
    if (item.tipoPago === "efectivo") {
      return {
        descuentoTotal,
        descuentoEfectivo: descuentoTotal,
        descuentoTransferencia: 0,
        precioFinalEfectivo: item.subtotal - descuentoTotal,
        precioFinalTransferencia: 0,
      };
    } else {
      return {
        descuentoTotal,
        descuentoEfectivo: 0,
        descuentoTransferencia: descuentoTotal,
        precioFinalEfectivo: 0,
        precioFinalTransferencia: item.subtotal - descuentoTotal,
      };
    }
  };

  // Toggle selección de oferta para un producto
  const toggleOfertaProducto = (productoId: number) => {
    setOfertasSeleccionadas((prev) => ({
      ...prev,
      [productoId]: !prev[productoId],
    }));
  };

  // Calcular total con ofertas
  useEffect(() => {
    const total = orden
      .filter((item) => item && item.subtotal)
      .reduce((sum, item) => {
        return sum + calcularPrecioConOferta(item);
      }, 0);
    setTotalConOfertas(total);
  }, [orden, ofertasSeleccionadas, ofertasDisponibles]);

  // Función helper para ejecutar operaciones de BD con retry
  const executeDbOperationWithRetry = async (
    operation: () => Promise<any>,
    maxRetries: number = 3,
    initialDelay: number = 500,
  ): Promise<any> => {
    let intentos = 0;
    let esperaMs = initialDelay;

    while (intentos < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        intentos++;

        if (
          error instanceof Error &&
          (error.message.includes("database is locked") ||
            error.message.includes("locked") ||
            error.message.includes("finalizeAsync"))
        ) {
          console.error(
            `❌ Error de BD (intento ${intentos}/${maxRetries}):`,
            error.message,
          );

          if (intentos < maxRetries) {
            console.log(
              ` Base de datos bloqueada, reintentando en ${esperaMs}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, esperaMs));
            esperaMs = Math.min(esperaMs * 2, 2000);
            continue;
          } else {
            console.error("❌ Máximo de intentos alcanzado");
            throw new Error(
              `Base de datos bloqueada después de ${maxRetries} intentos: ${error.message}`,
            );
          }
        }

        // Si no es un error de bloqueo, lanzar el error inmediatamente
        throw error;
      }
    }
  };

  // Exportar orden actual a PDF
  const exportarOrdenPDF = async () => {
    try {
      // Abrir modal para pedir nombre del cliente
      setMostrarModalCliente(true);
    } catch (error) {
      console.error("Error en exportación PDF:", error);
      Alert.alert("Error", "No se pudo generar el archivo PDF");
      setGeneratingPDF(false);
    }
  };

  // Función para generar el PDF después de obtener el nombre del cliente
  const generarPDFConNombre = async () => {
    if (!nombreCliente || nombreCliente.trim() === "") {
      Alert.alert("Error", "El nombre del cliente es requerido");
      return;
    }

    try {
      setGeneratingPDF(true);
      setMostrarModalCliente(false);

      // Generar HTML del PDF con precios de ofertas si están aplicadas
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Conduce - ${nombreCliente}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1f2937; padding-bottom: 15px; }
            .header h1 { color: #1f2937; margin: 0; font-size: 20px; font-weight: bold; }
            .header p { color: #6b7280; margin: 5px 0 0 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background-color: #1f2937; color: white; padding: 10px; text-align: center; font-weight: bold; border: 1px solid #374151; }
            td { padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .total-row { background-color: #e0e7ff; font-weight: bold; }
            .total-row td { color: #4f46e5; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; }
            .footer p { color: #6b7280; font-size: 11px; margin: 5px 0; }
            .precio-original { text-decoration: line-through; color: #9ca3af; font-size: 11px; }
            .precio-con-descuento { color: #059669; font-weight: bold; }
            .descuento-info { color: #dc2626; font-size: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Conduce - Orden #${orden.length > 0 ? orden[0].productoId + Date.now() : "N/A"}</h1>
            <p>Fecha: ${new Date().toLocaleDateString("es-ES")}</p>
            <p>Nombre de la Tienda: ${puntoNombre}</p>
            <p>Nombre del Cliente: ${nombreCliente}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${orden
                .map((item) => {
                  const precioConOferta = calcularPrecioConOferta(item);
                  const precioUnitarioConOferta =
                    precioConOferta / item.cantidad;

                  return `
                <tr>
                  <td style="text-align: left;">${item.nombre}</td>
                  <td>${item.cantidad}</td>
                  <td style="color: #374151; font-weight: normal;">
                    ${formatMoneda(precioUnitarioConOferta)}
                  </td>
                  <td style="color: #374151; font-weight: normal;">
                    ${formatMoneda(precioConOferta)}
                  </td>
                </tr>
              `;
                })
                .join("")}
              <tr class="total-row">
                <td style="text-align: left;" colspan="3">Total</td>
                <td>${formatMoneda(totalConOfertas)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>¡Gracias por tu compra! Vuelve pronto.</p>
          </div>
        </body>
        </html>
      `;

      // Generar PDF
      const { uri } = await ExpoPrint.printToFileAsync({ html: htmlContent });

      const fechaActual = new Date()
        .toLocaleDateString("es-ES")
        .replace(/\//g, "-");
      const nombreArchivo = `CONDUCE_${nombreCliente.replace(/\s+/g, "_")}_${fechaActual}.pdf`;

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
      setNombreCliente("");
    }
  };

  // 🧩 PARTE 1: FUNCIÓN DE GENERACIÓN DE TICKET
  const generarTicketTexto = (
    orden: ItemOrden[],
    total: number,
    puntoNombre: string,
    nombreCliente?: string,
  ): string => {
    const fechaActual = new Date().toLocaleDateString("es-ES");
    const horaActual = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Función interna para generar el contenido básico del ticket
    const generarContenidoTicket = (titulo: string): string => {
      let ticket = "";

      // Encabezado del ticket - formato para impresoras térmicas
      ticket += "================================\n";
      ticket += `           ${titulo}\n`;
      ticket += "================================\n";
      ticket += `${puntoNombre}\n`;
      ticket += `Fecha: ${fechaActual} ${horaActual}\n`;
      ticket += "================================\n\n";

      // Agregar productos con formato optimizado para 58mm
      orden.forEach((item) => {
        const precioConOferta = calcularPrecioConOferta(item);
        const precioUnitarioConOferta = precioConOferta / item.cantidad;

        // Nombre del producto (limitado a 20 caracteres)
        const nombre =
          item.nombre.length > 20 ? item.nombre.substring(0, 20) : item.nombre;

        // Formatear cantidades y precios
        const cantidad = item.cantidad.toString().padStart(2);
        const precioUnitario = precioUnitarioConOferta.toFixed(2).padStart(7);
        const subtotal = precioConOferta.toFixed(2).padStart(8);

        ticket += `${nombre}\n`;
        ticket += `  ${cantidad} x $${precioUnitario} $${subtotal}\n`;
      });

      ticket += "\n--------------------------------\n";

      // Total con formato destacado
      ticket += `TOTAL: $${total.toFixed(2).padStart(15)}\n`;
      ticket += "================================\n";

      // Información del cliente si existe
      if (nombreCliente && nombreCliente.trim()) {
        ticket += `Cliente: ${nombreCliente}\n`;
        ticket += "================================\n";
      }

      // Pie del ticket
      ticket += "\n     GRACIAS POR SU COMPRA\n";
      ticket += "        VUELVA PRONTO\n";
      ticket += "================================\n";

      return ticket;
    };

    // Generar FACTURA
    const factura = generarContenidoTicket("FACTURA");

    // Generar RECIBO VENDEDOR con margen grande
    const margenGrande = "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n";
    const reciboVendedor =
      margenGrande + generarContenidoTicket("RECIBO VENDEDOR");

    return factura + reciboVendedor;
  };

  // 🧩 PARTE 2: FUNCIÓN PARA IMPRIMIR TICKET (BLUETOOTH REAL)
  const imprimirTicket = async () => {
    // Validar que orden no esté vacía
    if (orden.length === 0) {
      Alert.alert("Error", "No hay productos en la orden para generar ticket");
      return;
    }

    try {
      setIsPrinting(true);
      console.log("🖨️ Iniciando impresión con GOOJPRT PT210_9465...");

      // Generar el ticket usando generarTicketTexto
      const ticket = generarTicketTexto(
        orden,
        totalConOfertas,
        puntoNombre,
        nombreCliente,
      );

      // Crear archivo temporal del ticket
      const fechaActual = new Date()
        .toLocaleDateString("es-ES")
        .replace(/\//g, "-");
      const horaActual = new Date()
        .toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(/:/g, "-");
      const nombreArchivo = `TICKET_${nombreCliente.replace(/\s+/g, "_")}_${fechaActual}_${horaActual}.txt`;

      // Escribir el ticket en un archivo temporal usando FileSystem
      const fileUri = `${FileSystem.documentDirectory}${nombreArchivo}`;

      await FileSystem.writeAsStringAsync(fileUri, ticket, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log("📄 Ticket generado en:", fileUri);
      console.log("📋 Contenido del ticket:");
      console.log(ticket);

      // Usar Sharing para compartir el archivo
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert(
          "No Disponible",
          "No hay aplicaciones disponibles para compartir archivos.",
          [{ text: "OK" }],
        );
        return;
      }

      // Compartir el archivo del ticket con más opciones
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/plain",
        dialogTitle: "Imprimir Ticket - GOOJPRT PT210_9465",
        UTI: "public.text",
      });

      console.log("✅ Ticket enviado para compartir/imprimir");

      Alert.alert(
        "Ticket Enviado",
        "El ticket ha sido enviado. Para imprimir:\n\n1. Seleccione su impresora PT210_9465\n2. Espere a que se conecte\n3. El ticket se imprimirá automáticamente\n\nSi no imprime, intente:\n• Asegurarse que la impresora esté encendida\n• Verificar que esté emparejada vía Bluetooth\n• Revisar que tenga papel",
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("❌ Error en proceso de impresión:", error);

      // Mensaje de error más detallado
      let errorMessage =
        "No se pudo enviar el ticket a la impresora. Intente nuevamente.";

      if (error.message && error.message.includes("sharing")) {
        errorMessage =
          "No se puede compartir el archivo. Verifique que tenga aplicaciones de compartir instaladas.";
      } else if (error.message && error.message.includes("file")) {
        errorMessage =
          "No se pudo crear el archivo del ticket. Verifique el espacio de almacenamiento.";
      }

      Alert.alert("Error de Impresión", errorMessage, [{ text: "OK" }]);
    } finally {
      setIsPrinting(false);
    }
  };

  // Función para resetear completamente todos los modales y la orden
  const resetearCompletoVenta = () => {
    // Cerrar todos los modales
    setMostrarModalOrden(false);
    setMostrarModalOrdenDetalles(false);
    setMostrarModalPago(false);
    setMostrarResumen(false);
    setMostrarModalSeleccionOfertas(false);
    setMostrarModalSeleccionTrabajador(false);
    setMostrarModalEditarPrecio(false);
    setMostrarModalCalculo(false);
    setMostrarModalHistorial(false);
    setMostrarModalCliente(false);
    setMostrarModalBajaCantidad(false);

    // Resetear orden y estados relacionados
    setOrden([]);
    setTotalOrden(0);
    setTotalConOfertas(0);
    setOfertasSeleccionadas({});
    setOfertasDisponibles({});
    setEsModalPreorden(false);
    setFlujoOrigen(null);
    setProductoParaPago(null);
    setTipoPagoSeleccionado("");
    setMetodoTransferencia("");
    setMontoTransferenciaMixto("");
    setMostrarCampoTransferenciaMixto(false);
    setConsumoPropioActivo(false);
    setTrabajadorSeleccionado(null);

    // Resetear otros estados
    setBilletes({ 1: 0, 3: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 });
    setNombreCliente("");
    setProductoEditando(null);
    setNuevoPrecio("");
    setProductoParaBaja(null);
    setCantidadBaja("");

    console.log(
      "🔄 Todos los modales cerrados y orden reseteada completamente",
    );
  };

  // Finalizar venta
  const finalizarVenta = async () => {
    if (isProcessingSale) {
      console.log("⚠️ Venta ya en proceso, evitando ejecución duplicada");
      return;
    }

    setIsProcessingSale(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log(
        "🚀 Iniciando proceso de venta con",
        orden.length,
        "productos",
      );

      // Calcular totales con descuentos aplicados
      const totalConDescuentos =
        totalConOfertas < totalOrden ? totalConOfertas : totalOrden;

      const ventasEfectivo = orden
        .filter((o) => o && o.tipoPago === "efectivo")
        .reduce((sum, o) => sum + calcularPrecioConOferta(o), 0);
      const ventasTransferencia = orden
        .filter((o) => o && o.tipoPago === "transferencia")
        .reduce((sum, o) => sum + calcularPrecioConOferta(o), 0);

      const ventasMixtoTransferencia = orden
        .filter((o) => o && o.tipoPago === "mixto")
        .reduce((sum, o) => sum + (o.montoTransferencia || 0), 0);

      const ventasMixtoEfectivo = orden
        .filter((o) => o && o.tipoPago === "mixto")
        .reduce((sum, o) => sum + (o.montoEfectivo || 0), 0);

      const totalTransferencia = ventasTransferencia + ventasMixtoTransferencia;
      const totalEfectivo = ventasEfectivo + ventasMixtoEfectivo;

      console.log("💰 Totales calculados:", {
        totalConDescuentos,
        totalEfectivo,
        totalTransferencia,
      });

      let tipoPagoGeneral: "efectivo" | "transferencia" | "mixto" = "efectivo";
      if (totalEfectivo > 0 && totalTransferencia > 0) {
        tipoPagoGeneral = "mixto";
      } else if (totalTransferencia > 0) {
        tipoPagoGeneral = "transferencia";
      }

      let metodoTransferenciaGeneral: string | undefined = undefined;
      if (tipoPagoGeneral === "transferencia" || tipoPagoGeneral === "mixto") {
        const primerItemTransferencia = orden.find(
          (o) => o.tipoPago === "transferencia" || o.tipoPago === "mixto",
        );
        metodoTransferenciaGeneral =
          primerItemTransferencia?.metodoTransferencia;
      }

      console.log("📝 Creando venta principal...");
      // Importar función de fecha local para consistencia de timezone
      const { getFechaHoraLocalCompleta } =
        await import("../src/utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const ventaResult = await executeDbOperationWithRetry(async () => {
        return await db.runAsync(
          `INSERT INTO Venta (
            punto_id, total_venta, tipo_pago, 
            total_efectivo, total_transferencia, metodo_transferencia, creado_en,
            es_consumo_propio, trabajador_id, metodo_consumo, valor_descuento
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            puntoId!,
            totalConDescuentos,
            tipoPagoGeneral,
            totalEfectivo,
            totalTransferencia,
            metodoTransferenciaGeneral,
            ahora, // ✅ Usar fecha local en lugar de CURRENT_TIMESTAMP
            consumoPropioActivo ? 1 : 0,
            consumoPropioActivo ? trabajadorSeleccionado?.id : null,
            consumoPropioActivo ? tipoDescuento : null,
            consumoPropioActivo ? valorDescuento : null,
          ],
        );
      });

      const ventaId = ventaResult.lastInsertRowId;
      console.log("✅ Venta creada con ID:", ventaId);

      // Procesar cada item con retry individual
      console.log("📦 Procesando", orden.length, "productos...");
      for (const item of orden) {
        const precioConDescuento = calcularPrecioConOferta(item);
        const precioUnitarioConDescuento = precioConDescuento / item.cantidad;

        console.log(
          `🔄 Procesando producto: ${item.nombre} (${item.cantidad} unidades)`,
        );

        // Insertar detalle con retry
        await executeDbOperationWithRetry(async () => {
          return await db.runAsync(
            "INSERT INTO DetalleVenta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)",
            [
              ventaId,
              item.productoId,
              item.cantidad,
              precioUnitarioConDescuento,
              precioConDescuento,
            ],
          );
        });

        // Actualizar stock con retry
        await executeDbOperationWithRetry(async () => {
          return await db.runAsync(
            "UPDATE AlmacenZona SET cantidad = cantidad - ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
            [item.cantidad, item.productoId, puntoId!],
          );
        });

        console.log(`✅ Producto ${item.nombre} procesado correctamente`);
      }

      // Determinar si se aplicaron descuentos
      const seAplicaronDescuentos = totalConDescuentos < totalOrden;
      const montoDescuento = seAplicaronDescuentos
        ? totalOrden - totalConDescuentos
        : 0;

      // Si es Consumo Propio, descontar del salario del trabajador
      if (consumoPropioActivo && trabajadorSeleccionado) {
        try {
          const resultadoDescuento = await descontarConsumoPropioTemp(
            puntoId!,
            trabajadorSeleccionado.id,
            totalConDescuentos,
            ventaId,
          );

          if (resultadoDescuento.success) {
            console.log(`✅ ${resultadoDescuento.message}`);
          } else {
            console.error(
              `⚠️ Error descontando consumo: ${resultadoDescuento.message}`,
            );
            Alert.alert(
              "Advertencia",
              `La venta se completó pero hubo un error descontando del salario: ${resultadoDescuento.message}`,
            );
          }
        } catch (error) {
          console.error("Error descontando consumo propio:", error);
          Alert.alert(
            "Advertencia",
            "La venta se completó pero no se pudo descontar del salario. Contacte al administrador.",
          );
        }
      }

      Alert.alert(
        consumoPropioActivo
          ? "¡Consumo Propio Confirmado!"
          : "¡Venta Confirmada!",
        `${consumoPropioActivo ? "Consumo Propio" : "Total"}: ${formatMoneda(totalConDescuentos)}${seAplicaronDescuentos ? `\nDescuento aplicado: ${formatMoneda(montoDescuento)}` : ""}\nProductos: ${orden.length}\nVenta ID: ${ventaId}${consumoPropioActivo ? `\n\nTrabajador: ${trabajadorSeleccionado?.nombre || "No seleccionado"}\nEsta cantidad será descontada de su salario.` : ""}`,
        [
          {
            text: "OK",
            onPress: async () => {
              // NOTA: Las preordenes guardadas NUNCA se eliminan automáticamente
              // Solo se eliminan manualmente por el usuario desde la lista de preordenes
              console.log(
                "ℹ️ Venta completada - preordenes guardadas permanecen intactas",
              );
              setIsProcessingSale(false);
              resetearCompletoVenta();
              cargarDatos();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Error finalizando venta:", error);
      Alert.alert("Error", "No se pudo completar la venta: " + error.message);
      setIsProcessingSale(false);
      resetearCompletoVenta();
    }
  };

  // Dar de baja producto de la zona de venta
  const darDeBajaProducto = (producto: ProductoVenta) => {
    setProductoParaBaja(producto);
    setCantidadBaja(producto.cantidad.toString()); // Por defecto, la cantidad total
    setMostrarModalBajaCantidad(true);
  };

  // Ejecutar la baja con la cantidad especificada
  const ejecutarBajaCantidad = async () => {
    if (!productoParaBaja || !cantidadBaja) {
      Alert.alert("Error", "Por favor ingresa una cantidad válida");
      return;
    }

    const cantidad = parseInt(cantidadBaja);
    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert("Error", "La cantidad debe ser un número mayor a 0");
      return;
    }

    if (cantidad > productoParaBaja.cantidad) {
      Alert.alert(
        "Error",
        `No puedes dar de baja más de ${productoParaBaja.cantidad} unidades`,
      );
      return;
    }

    try {
      if (cantidad === productoParaBaja.cantidad) {
        // Si es la cantidad total, mover todo el registro a zona 2
        await db.runAsync(
          `
          UPDATE AlmacenZona 
          SET zona_id = 2 
          WHERE producto_id = ? AND punto_id = ? AND zona_id = 1
        `,
          [productoParaBaja.id, puntoId!],
        );
      } else {
        // Si es cantidad parcial, reducir la cantidad en zona 1 y agregar/actualizar en zona 2
        await db.runAsync("BEGIN TRANSACTION");

        try {
          // Reducir cantidad en zona de venta
          await db.runAsync(
            `
            UPDATE AlmacenZona 
            SET cantidad = cantidad - ? 
            WHERE producto_id = ? AND punto_id = ? AND zona_id = 1
          `,
            [cantidad, productoParaBaja.id, puntoId!],
          );

          // Verificar si ya existe el producto en almacén (zona 2)
          const existeEnAlmacen = await db.getFirstAsync(
            `
            SELECT id, cantidad FROM AlmacenZona 
            WHERE producto_id = ? AND punto_id = ? AND zona_id = 2
          `,
            [productoParaBaja.id, puntoId!],
          );

          if (existeEnAlmacen) {
            // Actualizar cantidad existente en almacén
            await db.runAsync(
              `
              UPDATE AlmacenZona 
              SET cantidad = cantidad + ? 
              WHERE producto_id = ? AND punto_id = ? AND zona_id = 2
            `,
              [cantidad, productoParaBaja.id, puntoId!],
            );
          } else {
            // Insertar nuevo registro en almacén
            await db.runAsync(
              `
              INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia)
              VALUES (?, ?, 2, ?, ?, ?)
            `,
              [
                productoParaBaja.id,
                puntoId!,
                cantidad,
                productoParaBaja.precio_venta,
                productoParaBaja.ganancia,
              ],
            );
          }

          await db.runAsync("COMMIT");
        } catch (error) {
          await db.runAsync("ROLLBACK");
          throw error;
        }
      }

      Alert.alert(
        "Éxito",
        `Se dio de baja ${cantidad} unidad(es) del producto`,
      );
      setMostrarModalBajaCantidad(false);
      setProductoParaBaja(null);
      setCantidadBaja("");
      cargarDatos();
    } catch (error) {
      console.error("Error dando de baja:", error);
      Alert.alert("Error", "No se pudo dar de baja el producto");
    }
  };

  // Establecer precio de venta para producto nuevo
  const establecerPrecioVenta = (producto: ProductoVenta) => {
    setProductoEditando(producto);
    setNuevoPrecio("");
    setMostrarModalEditarPrecio(true);
  };

  // Editar precio de venta para producto existente
  const editarPrecioVenta = (producto: ProductoVenta) => {
    setProductoEditando(producto);
    setNuevoPrecio(producto.precio_venta.toString());
    setMostrarModalEditarPrecio(true);
  };

  // Guardar el nuevo precio editado
  const guardarPrecioEditado = async () => {
    if (!productoEditando || !nuevoPrecio) return;

    const precio = parseFloat(nuevoPrecio);
    if (isNaN(precio) || precio <= 0) {
      Alert.alert("Error", "Ingresa un precio válido");
      return;
    }

    try {
      // Obtener el precio anterior antes de actualizar
      const precioAnterior = productoEditando.precio_venta || 0;

      // Calcular ganancia
      const costo =
        productoEditando.precio_coste_real ||
        productoEditando.precio_coste ||
        0;
      const ganancia = precio - costo;

      // Actualizar precio de venta y ganancia en ZONA DE VENTA
      await db.runAsync(
        "UPDATE AlmacenZona SET precio_venta = ?, ganancia = ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
        [precio, ganancia, productoEditando.id, puntoId!],
      );

      // Registrar el cambio de precio si es diferente
      if (precioAnterior !== precio) {
        const resultado = await CambioPrecioService.registrarCambio(
          productoEditando.id,
          puntoId!,
          precioAnterior,
          precio,
          precioAnterior === 0
            ? "Establecimiento de precio inicial"
            : "Edición manual en venta",
        );

        if (resultado.success) {
          console.log("✅ Cambio de precio registrado:", {
            producto: productoEditando.nombre,
            precioAnterior,
            precioNuevo: precio,
            diferencia: precio - precioAnterior,
          });
        } else {
          console.warn(
            "⚠️ No se pudo registrar el cambio de precio:",
            resultado.message,
          );
        }
      }

      const mensaje =
        precioAnterior === 0
          ? `Precio establecido: ${formatMoneda(precio)}\nGanancia: ${formatMoneda(ganancia)}`
          : `Precio actualizado: ${formatMoneda(precio)}`;

      Alert.alert("Éxito", mensaje);
      setMostrarModalEditarPrecio(false);
      setProductoEditando(null);
      setNuevoPrecio("");
      cargarDatos();
    } catch (error) {
      console.error("Error actualizando precio:", error);
      Alert.alert("Error", "No se pudo actualizar el precio");
    }
  };

  // Función temporal para obtener salarios activos (solución alternativa)
  const obtenerSalariosActivosTemp = async (puntoId: number) => {
    try {
      const salarios = await GastoService.read_gasto(puntoId);
      const salariosActivos = salarios.filter(
        (gasto: any) =>
          gasto.categoria === "Salario" &&
          gasto.activo === 1 &&
          ((gasto.es_porcentaje === 1 && gasto.porcentaje > 0) ||
            (gasto.es_porcentaje === 0 && gasto.salario_fijo > 0)),
      );
      console.log(`👥 Salarios activos (temp): ${salariosActivos.length}`);
      return salariosActivos;
    } catch (error) {
      console.error("Error en obtenerSalariosActivosTemp:", error);
      throw error;
    }
  };

  // Función para obtener el trabajador asignado hoy en la apertura
  const obtenerTrabajadorAperturaHoy = async (puntoId: number) => {
    try {
      const CierreService = (await import("../src/db/services/cierre_service"))
        .CierreService;
      const trabajadorId =
        await CierreService.getTrabajadorAperturaHoy(puntoId);

      if (!trabajadorId) {
        console.log("🔍 No hay trabajador asignado en la apertura de hoy");
        return null;
      }

      // Obtener detalles del trabajador
      const salarios = await obtenerSalariosActivosTemp(puntoId);
      const trabajadorAsignado = salarios.find((s) => s.id === trabajadorId);

      console.log(
        "👤 Trabajador asignado hoy:",
        trabajadorAsignado?.nombre || "No encontrado",
      );
      return trabajadorAsignado;
    } catch (error) {
      console.error("Error obteniendo trabajador de apertura:", error);
      return null;
    }
  };

  // Función temporal para descontar consumo propio (solución alternativa)
  const descontarConsumoPropioTemp = async (
    puntoId: number,
    gastoId: number,
    montoConsumo: number,
  ) => {
    try {
      // Obtener información del trabajador
      const gastos = await GastoService.read_gasto(puntoId);
      const trabajador = gastos.find(
        (g: any) =>
          g.id === gastoId && g.categoria === "Salario" && g.activo === 1,
      );

      if (!trabajador) {
        return {
          success: false,
          message: "No se encontró el trabajador",
        };
      }

      console.log(
        `💰 Registrando consumo en salario: ${trabajador.nombre} - $${montoConsumo.toFixed(2)}`,
      );

      // Usar el nuevo método que registra consumo directamente en el salario
      const resultado = await GastoService.registrarConsumoEnSalario(
        puntoId,
        gastoId,
        montoConsumo,
      );

      if (resultado.success) {
        console.log(
          `✅ Consumo registrado en salario: ${trabajador.nombre} - $${montoConsumo.toFixed(2)}`,
        );

        return {
          success: true,
          message: `Consumo de $${montoConsumo.toFixed(2)} registrado en el salario de ${trabajador.nombre}`,
          data: {
            trabajadorNombre: trabajador.nombre,
            montoDescontado: montoConsumo,
          },
        };
      } else {
        return {
          success: false,
          message: "No se pudo registrar el consumo en el salario",
        };
      }
    } catch (error: any) {
      console.error("Error en descontarConsumoPropioTemp:", error);
      return {
        success: false,
        message: error.message || "Error al registrar consumo en salario",
      };
    }
  };

  // Función para manejar el toggle de Consumo Propio
  const toggleConsumoPropio = async () => {
    if (!consumoPropioActivo) {
      // Si se está activando, obtener trabajador de hoy automáticamente
      try {
        setCargandoTrabajadores(true);

        // Primero intentar obtener el trabajador asignado hoy
        const trabajadorHoy = await obtenerTrabajadorAperturaHoy(puntoId);

        if (trabajadorHoy) {
          // Si hay trabajador asignado hoy, seleccionarlo automáticamente
          setTrabajadorSeleccionado(trabajadorHoy);
          console.log(
            `✅ Trabajador de hoy seleccionado automáticamente: ${trabajadorHoy.nombre}`,
          );

          // Mostrar modal de selección de precio
          setMostrarModalSeleccionPrecio(true);
        } else {
          // Si no hay trabajador asignado, mostrar lista de trabajadores disponibles
          const salarios = await obtenerSalariosActivosTemp(puntoId);

          if (salarios.length === 0) {
            Alert.alert(
              "Sin Trabajadores",
              "No hay trabajadores con salarios configurados para este punto. Por favor, configure los salarios primero.",
              [{ text: "OK" }],
            );
            return;
          }

          setTrabajadores(salarios);
          setMostrarModalSeleccionTrabajador(true);
        }
      } catch (error) {
        console.error("Error activando consumo propio:", error);
        Alert.alert("Error", "No se pudo activar el consumo propio");
      } finally {
        setCargandoTrabajadores(false);
      }
    } else {
      // Si se está desactivando, simplemente cambiar el estado
      setConsumoPropioActivo(false);
      setTrabajadorSeleccionado(null);
      setTipoDescuento("coste");
      setValorDescuento("");
    }
  };

  // Función para seleccionar trabajador
  const seleccionarTrabajador = (trabajador: any) => {
    setTrabajadorSeleccionado(trabajador);
    setMostrarModalSeleccionTrabajador(false);
    // Mostrar modal de selección de precio en lugar de activar directamente
    setMostrarModalSeleccionPrecio(true);
  };

  // Función para confirmar selección de precio y activar consumo propio
  const confirmarSeleccionPrecio = () => {
    if (!trabajadorSeleccionado) return;

    // Validar descuento si es porcentual o fijo
    if (tipoDescuento === "porcentual") {
      const porcentaje = parseFloat(valorDescuento);
      if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        Alert.alert("Error", "Ingrese un porcentaje válido entre 0 y 100");
        return;
      }
    } else if (tipoDescuento === "fijo") {
      const monto = parseFloat(valorDescuento);
      if (isNaN(monto) || monto < 0) {
        Alert.alert("Error", "Ingrese un monto válido mayor o igual a 0");
        return;
      }
    }

    // Activar consumo propio
    setConsumoPropioActivo(true);
    setMostrarModalSeleccionPrecio(false);

    let mensajeDescuento = "";
    if (tipoDescuento === "coste") {
      mensajeDescuento = "usando precio de costo";
    } else if (tipoDescuento === "porcentual") {
      mensajeDescuento = `con ${valorDescuento}% de descuento sobre precio de venta`;
    } else if (tipoDescuento === "fijo") {
      mensajeDescuento = `con $${valorDescuento} de descuento fijo`;
    }

    Alert.alert(
      "Consumo Propio Activado",
      `Consumo Propio activado para ${trabajadorSeleccionado.nombre}\n${mensajeDescuento}\nLas ventas se descontarán de su salario.`,
      [{ text: "OK" }],
    );
  };

  // Función para cancelar selección de precio
  const cancelarSeleccionPrecio = () => {
    setMostrarModalSeleccionPrecio(false);
    setTrabajadorSeleccionado(null);
    setTipoDescuento("coste");
    setValorDescuento("");
  };

  // Función para calcular precio con descuento para consumo propio
  const calcularPrecioConsumoPropio = (producto: ProductoVenta) => {
    if (!consumoPropioActivo) {
      return producto.precio_venta;
    }

    const precioCosto = producto.precio_coste_real || producto.precio_coste;

    if (tipoDescuento === "coste") {
      return precioCosto;
    } else if (tipoDescuento === "porcentual") {
      const porcentaje = parseFloat(valorDescuento) || 0;
      return producto.precio_venta * (1 - porcentaje / 100);
    } else if (tipoDescuento === "fijo") {
      const descuento = parseFloat(valorDescuento) || 0;
      return Math.max(0, producto.precio_venta - descuento);
    }

    return precioCosto; // Default a precio de costo
  };

  // Función para cambiar de modo y limpiar estados
  const cambiarModoHistorial = async (nuevoModo: "venta" | "entrada") => {
    if (nuevoModo === tipoHistorial) return; // No hacer nada si es el mismo modo

    console.log("🔄 CAMBIANDO MODO de", tipoHistorial, "a", nuevoModo);

    // 1. Actualizar estado inmediatamente
    setTipoHistorial(nuevoModo);

    // 2. Limpiar estados inmediatamente
    setHistorialEntradas([]);
    setHistorialFiltrado([]);
    setFechaDesde(null);
    setFechaHasta(null);
    setCargandoHistorial(true);

    // 3. Esperar un ciclo de render para asegurar que el estado se actualizó
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 4. Cargar datos con el nuevo estado ya actualizado
    console.log("📊 Cargando datos para modo:", nuevoModo);
    await cargarHistorialVentas(nuevoModo);
  };

  // Cargar historial de ventas realizadas
  const cargarHistorialVentas = async (forzarModo?: "venta" | "entrada") => {
    if (!puntoId) return;

    // Usar el modo forzado o el estado actual
    const modoActual = forzarModo || tipoHistorial;

    setCargandoHistorial(true);
    try {
      console.log("🔄 Iniciando carga de historial para puntoId:", puntoId);
      console.log("📊 MODO USADO - tipoHistorial =", modoActual);

      let historial;
      if (modoActual === "venta") {
        console.log("🔍 MODO VENTA - Buscando en tabla DetalleVenta");
        historial = await VentaHistoryService.getVentasRealizadas(puntoId, 50);
        console.log("📊 DATOS DE VENTAS - Tabla: DetalleVenta");
      } else {
        console.log("🔍 MODO ENTRADA - Buscando en tabla LogTransferencia");
        historial = await VentaHistoryService.getTodasEntradasPunto(
          puntoId,
          50,
        );
        console.log("📊 DATOS DE ENTRADAS - Tabla: LogTransferencia");
      }

      console.log("📋 RESULTADOS OBTENIDOS:", historial.length, "elementos");
      console.log("📋 MUESTRA DE DATOS:", historial.slice(0, 2)); // Mostrar solo primeros 2
      setHistorialEntradas(historial);
      setHistorialFiltrado(historial);
    } catch (error) {
      console.error("Error cargando historial:", error);
      Alert.alert(
        "Error",
        `No se pudo cargar el historial de ${modoActual === "venta" ? "ventas" : "entradas"}`,
      );
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Filtrar historial por fechas
  const filtrarPorFechas = () => {
    if (!fechaDesde && !fechaHasta) {
      setHistorialFiltrado(historialEntradas);
      return;
    }

    const filtrados = historialEntradas.filter((item) => {
      const fechaItem = new Date(item.creado_en);

      if (fechaDesde && fechaHasta) {
        return fechaItem >= fechaDesde && fechaItem <= fechaHasta;
      } else if (fechaDesde) {
        return fechaItem >= fechaDesde;
      } else if (fechaHasta) {
        return fechaItem <= fechaHasta;
      }

      return true;
    });

    setHistorialFiltrado(filtrados);
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFechaDesde(null);
    setFechaHasta(null);
    setHistorialFiltrado(historialEntradas);
  };

  // Abrir modal de historial
  const abrirModalHistorial = () => {
    setMostrarModalHistorial(true);
    setHistorialEntradas([]); // Limpiar estado anterior
    setHistorialFiltrado([]); // Limpiar también el filtrado
    setTipoHistorial("venta"); // Siempre empezar en modo venta
    cargarHistorialVentas();
  };

  // Abrir modal de gestión de deudas
  const abrirModalGestionDeudas = async () => {
    setMostrarModalGestionDeudas(true);
    setCargandoDeudas(true);
    try {
      // Obtener deudas del punto actual
      const deudas = await PrestamoDeudaHelper.getAllWithPuntos(100);
      const deudasFiltradas = deudas.filter(
        (deuda) => deuda.punto_id === puntoId && deuda.estado === "pendiente",
      );
      setDeudasPunto(deudasFiltradas);
    } catch (error) {
      console.error("Error cargando deudas del punto:", error);
      Alert.alert("Error", "No se pudieron cargar las deudas del punto");
    } finally {
      setCargandoDeudas(false);
    }
  };

  // Marcar deuda como pagada hoy
  const marcarDeudaComoPagada = async (
    deudaId: number,
    descripcion: string,
    monto: number,
  ) => {
    try {
      // Preparar la información para el modal de pago
      setProductoParaPago({
        productoId: -1, // ID especial para identificar pago de deuda
        nombre: `Pago de Deuda: ${descripcion}`,
        cantidad: 1,
        subtotal: monto,
        precioVenta: monto,
        precioCostoReal: 0,
        deudaId: deudaId, // Guardar referencia a la deuda
        descripcionDeuda: descripcion, // Guardar descripción
      });
      setEsModalPreorden(false);
      setFlujoOrigen("pago_deuda"); // Nuevo flujo para pago de deudas
      setMostrarModalPago(true);
    } catch (error) {
      console.error("Error preparando pago de deuda:", error);
      Alert.alert("Error", "No se pudo preparar el pago de la deuda");
    }
  };

  // Formatear moneda
  const formatMoneda = (monto: number | undefined | null) => {
    if (monto === undefined || monto === null || isNaN(monto)) {
      return new Intl.NumberFormat("es-CU", {
        style: "currency",
        currency: "CUP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(0);
    }
    return new Intl.NumberFormat("es-CU", {
      style: "currency",
      currency: "CUP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  };

  // Obtener color según estado de vencimiento
  const getColorVencimiento = (estado?: string) => {
    switch (estado) {
      case "vencido":
        return "#ef4444";
      case "por_vencer_rojo":
        return "#ef4444";
      case "por_vencer_naranja":
        return "#f59e0b";
      case "seguro":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  // Obtener emoji según categoría
  const getEmojiCategoria = (categoria: string | undefined) => {
    if (!categoria) return "🛒";
    switch (categoria.toLowerCase()) {
      case "panadería":
      case "pan":
        return "🥖";
      case "bebidas":
        return "🥤";
      case "lácteos":
      case "leche":
        return "🥛";
      case "frutas":
        return "🍎";
      case "verduras":
        return "🥬";
      case "carnes":
        return "🥩";
      case "pescado":
        return "🐟";
      case "huevos":
        return "🥚";
      case "aceite":
        return "🫒";
      case "arroz":
        return "🍚";
      case "azúcar":
        return "🍬";
      case "sal":
        return "🧂";
      case "café":
        return "☕";
      case "dulces":
        return "🍫";
      default:
        return "🛒";
    }
  };

  // Obtener texto de vencimiento
  const getTextoVencimiento = (estado?: string, dias?: number) => {
    if (!estado) return "";

    switch (estado) {
      case "vencido":
        return `VENCIDO hace ${Math.abs(dias || 0)} días`;
      case "por_vencer_rojo":
        return `VENCE en ${dias || 0} días`;
      case "por_vencer_naranja":
        return `VENCE en ${dias || 0} días`;
      case "seguro":
        return `VENCE en ${dias || 0}+ días`;
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando productos de venta...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header MODIFICADO - Sin botón Volver */}
      {/* Header con título y botones */}
      <View style={styles.header}>
        {/* Título con flecha de regreso */}
        <View style={styles.titleContainer}>
          {/* Título */}
          <Text style={styles.title}>Punto de Venta</Text>
          <Text style={styles.subtitle}>{puntoNombre}</Text>
        </View>

        {/* Botones de acción */}
        <View style={styles.buttonsContainer}>
          {/* Botón de Preordenes */}
          <TouchableOpacity
            style={styles.preordenesButton}
            onPress={() => setMostrarListaPreordenes(true)}
          >
            {preordenesGuardadas.length > 0 && (
              <View style={styles.preordenesBadge}>
                <Text style={styles.preordenesBadgeText}>
                  {preordenesGuardadas.length}
                </Text>
              </View>
            )}
            <Ionicons name="document-text-outline" size={20} color="white" />
            <Text style={styles.orderText}>Preordenes</Text>
          </TouchableOpacity>

          {/* Botón de Orden */}
          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => setMostrarModalOrdenDetalles(true)}
          >
            {orden.length > 0 && (
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>{orden.length}</Text>
              </View>
            )}
            <Ionicons name="cart-outline" size={20} color="white" />
            <Text style={styles.orderText}>Orden</Text>
          </TouchableOpacity>

          {/* Botón de Historial */}
          <TouchableOpacity
            style={styles.historyButton}
            onPress={abrirModalHistorial}
          >
            <Ionicons name="time-outline" size={20} color="white" />
          </TouchableOpacity>

          {/* Botón de Gestión de Deudas */}
          <TouchableOpacity
            style={styles.deudasButton}
            onPress={abrirModalGestionDeudas}
          >
            <Ionicons name="wallet-outline" size={20} color="white" />
            <Text style={styles.orderText}>Deudas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Filtros */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Buscar Productos</Text>
          <View style={styles.filtersGrid}>
            <View style={styles.filterInput}>
              <TextInput
                style={styles.input}
                placeholder="Buscar producto por nombre..."
                value={filtroNombre}
                onChangeText={setFiltroNombre}
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.filterInput}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                <View style={styles.categoryButtons}>
                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      !filtroCategoria && styles.categoryButtonActive,
                    ]}
                    onPress={() => setFiltroCategoria("")}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        !filtroCategoria && styles.categoryButtonTextActive,
                      ]}
                    >
                      Todos
                    </Text>
                  </TouchableOpacity>

                  {categorias
                    .filter((cat) => cat)
                    .slice(0, 8)
                    .map((cat, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.categoryButton,
                          filtroCategoria === cat &&
                            styles.categoryButtonActive,
                        ]}
                        onPress={() =>
                          setFiltroCategoria(filtroCategoria === cat ? "" : cat)
                        }
                      >
                        <Text
                          style={[
                            styles.categoryButtonText,
                            filtroCategoria === cat &&
                              styles.categoryButtonTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {cat.length > 12 ? cat.substring(0, 12) + "..." : cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>

        {/* Contador de productos y controles de selección múltiple */}
        <View style={styles.contadorContainer}>
          <View style={styles.contadorLeft}>
            <Text style={styles.contadorText}>
              {productosFiltrados.length} productos disponibles
              {productosFiltrados.length < productos.length && (
                <Text style={styles.contadorSubtext}>
                  {" "}
                  ({productosFiltrados.length} de {productos.length} productos)
                </Text>
              )}
            </Text>
          </View>

          {/* Botón de modo selección múltiple */}
          <TouchableOpacity
            style={[
              styles.seleccionMultipleButton,
              modoSeleccionMultiple && styles.seleccionMultipleButtonActive,
            ]}
            onPress={toggleSeleccionMultiple}
          >
            <Text
              style={[
                styles.seleccionMultipleButtonText,
                modoSeleccionMultiple &&
                  styles.seleccionMultipleButtonTextActive,
              ]}
            >
              {modoSeleccionMultiple
                ? "✓ Selección múltiple"
                : "☐ Selección múltiple"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Controles de selección múltiple */}
        {modoSeleccionMultiple && (
          <View style={styles.seleccionMultipleControls}>
            <View style={styles.seleccionMultipleInfo}>
              <Text style={styles.seleccionMultipleInfoText}>
                {Object.values(productosSeleccionados).filter(Boolean).length}{" "}
                productos seleccionados
              </Text>
              <Text style={styles.seleccionMultipleSubtext}>
                Total: {formatMoneda(calcularTotalSeleccionados())}
              </Text>
            </View>

            {/* Botones de acción en diseño vertical */}
            <View style={styles.seleccionMultipleActionsVertical}>
              <TouchableOpacity
                style={styles.seleccionMultipleActionButton}
                onPress={seleccionarTodos}
              >
                <Text style={styles.seleccionMultipleActionText}>
                  Seleccionar todos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.seleccionMultipleActionButton}
                onPress={limpiarSeleccion}
              >
                <Text style={styles.seleccionMultipleActionText}>Limpiar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.seleccionMultipleActionButton,
                  styles.seleccionMultipleSellButton,
                  Object.values(productosSeleccionados).filter(Boolean)
                    .length === 0 && styles.seleccionMultipleSellButtonDisabled,
                ]}
                onPress={venderProductosSeleccionados}
                disabled={
                  Object.values(productosSeleccionados).filter(Boolean)
                    .length === 0
                }
              >
                <Text
                  style={[
                    styles.seleccionMultipleActionText,
                    styles.seleccionMultipleSellText,
                  ]}
                >
                  Vender seleccionados
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.seleccionMultipleActionButton,
                  styles.preordenButton,
                ]}
                onPress={cerrarPreorden}
              >
                <Text
                  style={[
                    styles.seleccionMultipleActionText,
                    styles.preordenButtonText,
                  ]}
                >
                  🛒 Cerrar Preorden
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Productos Disponibles */}
        {productosFiltrados.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>
              {filtroNombre || filtroCategoria
                ? "No se encontraron productos"
                : "No hay productos en venta"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filtroNombre || filtroCategoria
                ? "Intenta con otros filtros"
                : "Transfiere productos desde el almacén"}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() =>
                navigateWithSave(
                  `/almacen?puntoId=${puntoId}&puntoNombre=${puntoNombre}`,
                )
              }
            >
              <Text style={styles.emptyButtonText}>Ir al Almacén</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.productsSection}>
            <View style={styles.productsGrid}>
              {productosFiltrados
                .filter((p) => p && p.id)
                .map((producto) => (
                  <View key={producto.id} style={styles.productCard}>
                    {/* ENCABEZADO DE CARD */}
                    <View style={styles.productCardHeader}>
                      <View style={styles.productHeaderLeft}>
                        <View style={styles.productIcon}>
                          <Text style={styles.productIconText}>
                            {getEmojiCategoria(producto.categoria)}
                          </Text>
                        </View>
                        <View style={styles.productHeaderInfo}>
                          <Text style={styles.productName} numberOfLines={2}>
                            {producto.nombre}
                          </Text>
                          <View style={styles.productCategoryRow}>
                            <View style={styles.categoriaBadge}>
                              <Text style={styles.categoriaText}>
                                {producto.categoria}
                              </Text>
                            </View>
                            <Text style={styles.productSubcategory}>
                              {producto.subcategoria}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Botones de acción (ocultar en modo selección) */}
                      {!modoSeleccionMultiple && (
                        <View style={styles.productCardButtons}>
                          {/* Botón de editar precio */}
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => editarPrecioVenta(producto)}
                          >
                            <Text style={styles.editIcon}>✏️</Text>
                          </TouchableOpacity>

                          {/* Botón de dar de baja */}
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => darDeBajaProducto(producto)}
                          >
                            <Text style={styles.deleteIcon}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* CUERPO DE CARD */}
                    <View style={styles.productCardBody}>
                      {/* Indicador de unidades en preordenes */}
                      {(() => {
                        const unidadesEnPreordenes =
                          calcularUnidadesEnPreordenes(producto.id);
                        if (unidadesEnPreordenes > 0) {
                          return (
                            <View style={styles.preordenIndicatorCard}>
                              <Text style={styles.preordenIndicatorCardText}>
                                ⚠️ {unidadesEnPreordenes} en preordenes
                              </Text>
                            </View>
                          );
                        }
                        return null;
                      })()}

                      {/* Estado de vencimiento */}
                      {producto.estado_vencimiento && (
                        <View
                          style={[
                            styles.vencimientoContainer,
                            {
                              backgroundColor:
                                getColorVencimiento(
                                  producto.estado_vencimiento,
                                ) + "15",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.vencimientoDot,
                              {
                                backgroundColor: getColorVencimiento(
                                  producto.estado_vencimiento,
                                ),
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.vencimientoText,
                              {
                                color: getColorVencimiento(
                                  producto.estado_vencimiento,
                                ),
                              },
                            ]}
                          >
                            {getTextoVencimiento(
                              producto.estado_vencimiento,
                              producto.dias_restantes,
                            )}
                          </Text>
                        </View>
                      )}

                      {/* Precios */}
                      <View style={styles.pricesContainer}>
                        {consumoPropioActivo && (
                          <View style={styles.consumoPropioAlert}>
                            <Text style={styles.consumoPropioAlertText}>
                              🏠 Modo Consumo Propio -{" "}
                              {trabajadorSeleccionado?.nombre ||
                                "Trabajador no seleccionado"}
                            </Text>
                            <Text style={styles.consumoPropioAlertSubText}>
                              Usando precio de costo - Se descontará del salario
                            </Text>
                          </View>
                        )}
                        {!consumoPropioActivo &&
                          ofertasDisponibles[producto.id] &&
                          ofertasSeleccionadas[producto.id] && (
                            <View style={styles.ofertaActivaAlert}>
                              <Text style={styles.ofertaActivaAlertText}>
                                🎉 Oferta activa aplicada
                              </Text>
                            </View>
                          )}
                        <View style={styles.priceRowMain}>
                          <View style={styles.priceColumn}>
                            <Text style={styles.priceLabel}>
                              {consumoPropioActivo
                                ? tipoDescuento === "coste"
                                  ? "Precio de costo"
                                  : tipoDescuento === "porcentual"
                                    ? `Precio con ${valorDescuento}% desc`
                                    : tipoDescuento === "fijo"
                                      ? `Precio con $${valorDescuento} desc`
                                      : "Precio consumo"
                                : "Precio de venta"}
                            </Text>
                            <Text style={styles.salePrice}>
                              {formatMoneda(
                                consumoPropioActivo
                                  ? calcularPrecioConsumoPropio(producto)
                                  : calcularPrecioConOfertaProducto(producto),
                              )}
                            </Text>
                          </View>
                          <View style={styles.priceColumn}>
                            <Text style={styles.priceLabel}>
                              {consumoPropioActivo
                                ? "Ahorro por unidad"
                                : "Ganancia por unidad"}
                            </Text>
                            <Text
                              style={[
                                styles.profitPrice,
                                (consumoPropioActivo
                                  ? producto.precio_venta -
                                    calcularPrecioConsumoPropio(producto)
                                  : calcularPrecioConOfertaProducto(producto) -
                                    (producto.precio_coste_real ||
                                      producto.precio_coste)) < 0 &&
                                  styles.profitNegative,
                              ]}
                            >
                              {formatMoneda(
                                consumoPropioActivo
                                  ? producto.precio_venta -
                                      calcularPrecioConsumoPropio(producto)
                                  : calcularPrecioConOfertaProducto(producto) -
                                      (producto.precio_coste_real ||
                                        producto.precio_coste),
                              )}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.costRow}>
                          <Text style={styles.costLabel}>
                            {consumoPropioActivo
                              ? "Precio normal:"
                              : "Costo unitario:"}
                          </Text>
                          <Text style={styles.costPrice}>
                            {formatMoneda(
                              consumoPropioActivo
                                ? producto.precio_venta
                                : producto.precio_coste,
                            )}
                          </Text>
                        </View>
                      </View>

                      {/* Stock y Controles */}
                      <View style={styles.stockControlsContainer}>
                        <View style={styles.stockInfo}>
                          <Text style={styles.stockLabel}>
                            Stock disponible:
                          </Text>
                          <Text
                            style={[
                              styles.stockAmount,
                              producto.disponible === 0 && styles.stockEmpty,
                              producto.disponible <= 5 &&
                                producto.disponible > 0 &&
                                styles.stockLow,
                            ]}
                          >
                            {producto.disponible} unidades
                          </Text>
                        </View>

                        <View style={styles.quantitySection}>
                          <Text style={styles.quantityLabel}>
                            Cantidad a vender:
                          </Text>
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              style={[
                                styles.quantityButton,
                                styles.quantityButtonMinus,
                                producto.cantidadSeleccionada === 0 &&
                                  styles.quantityButtonDisabled,
                              ]}
                              onPress={() =>
                                actualizarCantidad(producto.id, -1)
                              }
                              disabled={producto.cantidadSeleccionada === 0}
                            >
                              <Text
                                style={[
                                  styles.quantityButtonText,
                                  producto.cantidadSeleccionada === 0 &&
                                    styles.quantityButtonTextDisabled,
                                ]}
                              >
                                −
                              </Text>
                            </TouchableOpacity>

                            <TextInput
                              style={styles.quantityInput}
                              value={producto.cantidadSeleccionada.toString()}
                              onChangeText={(text) => {
                                const cantidad = parseInt(text) || 0;
                                const cantidadValida = Math.max(
                                  0,
                                  Math.min(producto.disponible, cantidad),
                                );
                                setProductos((prev) =>
                                  prev.map((p) =>
                                    p.id === producto.id
                                      ? {
                                          ...p,
                                          cantidadSeleccionada: cantidadValida,
                                        }
                                      : p,
                                  ),
                                );
                              }}
                              keyboardType="numeric"
                              maxLength={4}
                              placeholder="0"
                            />

                            <TouchableOpacity
                              style={[
                                styles.quantityButton,
                                styles.quantityButtonPlus,
                                producto.cantidadSeleccionada >=
                                  producto.disponible &&
                                  styles.quantityButtonDisabled,
                              ]}
                              onPress={() => actualizarCantidad(producto.id, 1)}
                              disabled={
                                producto.cantidadSeleccionada >=
                                producto.disponible
                              }
                            >
                              <Text
                                style={[
                                  styles.quantityButtonText,
                                  producto.cantidadSeleccionada >=
                                    producto.disponible &&
                                    styles.quantityButtonTextDisabled,
                                ]}
                              >
                                +
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Botón de vender por formato (siempre visible) */}
                          {producto.formato_almacen &&
                            producto.unidades_por_formato && (
                              <View style={styles.formatButtonContainer}>
                                <TouchableOpacity
                                  style={[
                                    styles.formatButton,
                                    producto.formatoActivo &&
                                      styles.formatButtonActive,
                                  ]}
                                  onPress={() => toggleModoFormato(producto.id)}
                                >
                                  <Text
                                    style={[
                                      styles.formatButtonText,
                                      producto.formatoActivo &&
                                        styles.formatButtonTextActive,
                                    ]}
                                  >
                                    📦 {producto.formato_almacen}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                        </View>
                      </View>
                    </View>

                    {/* BOTÓN DE AÑADIR */}
                    <View style={styles.addToOrderContainer}>
                      <TouchableOpacity
                        style={[
                          styles.addToOrderButton,
                          modoSeleccionMultiple
                            ? styles.addToOrderButtonInactive
                            : producto.cantidadSeleccionada === 0
                              ? styles.addToOrderButtonInactive
                              : styles.addToOrderButtonActive,
                        ]}
                        onPress={() => agregarALaOrden(producto)}
                        disabled={
                          modoSeleccionMultiple ||
                          producto.cantidadSeleccionada === 0
                        }
                      >
                        <View style={styles.addToOrderLeft}>
                          <Text style={styles.addToOrderIcon}>
                            {modoSeleccionMultiple ? "☐" : "🛒"}
                          </Text>
                          <Text
                            style={[
                              styles.addToOrderText,
                              modoSeleccionMultiple ||
                              producto.cantidadSeleccionada === 0
                                ? styles.addToOrderTextInactive
                                : styles.addToOrderTextActive,
                            ]}
                          >
                            {modoSeleccionMultiple
                              ? ""
                              : producto.cantidadSeleccionada === 0
                                ? "Seleccionar cantidad primero"
                                : `Añadir ${producto.cantidadSeleccionada} unidades`}
                          </Text>
                        </View>
                        {!modoSeleccionMultiple &&
                          producto.cantidadSeleccionada > 0 && (
                            <Text style={styles.addToOrderSubtotal}>
                              {formatMoneda(
                                calcularPrecioConOfertaProducto(producto) *
                                  producto.cantidadSeleccionada,
                              )}
                            </Text>
                          )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Productos Nuevos (sin precio) */}
        {productosNuevos.length > 0 && (
          <View style={styles.newProductsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWithBadge}>
                <Text style={styles.sectionTitle}>Productos Sin Precio</Text>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>
                    {productosNuevos.length}
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                Establece precio de venta para vender
              </Text>
            </View>

            <View style={styles.newProductsList}>
              {productosNuevos
                .filter((p) => p && p.id)
                .map((producto) => (
                  <View key={producto.id} style={styles.newProductItem}>
                    <View style={styles.newProductInfo}>
                      <View style={styles.newProductHeader}>
                        <Text style={styles.newProductName}>
                          {producto.nombre}
                        </Text>
                        {producto.estado_vencimiento && (
                          <View style={styles.newProductVencimiento}>
                            <View
                              style={[
                                styles.newProductVencimientoDot,
                                {
                                  backgroundColor: getColorVencimiento(
                                    producto.estado_vencimiento,
                                  ),
                                },
                              ]}
                            />
                          </View>
                        )}
                      </View>
                      <Text style={styles.newProductCategory}>
                        {producto.categoria} • Stock: {producto.cantidad}{" "}
                        unidades
                      </Text>
                      <Text style={styles.newProductCost}>
                        Costo: {formatMoneda(producto.precio_coste)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.setPriceButton}
                      onPress={() => establecerPrecioVenta(producto)}
                    >
                      <Text style={styles.setPriceText}>Establecer precio</Text>
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Espacio al final */}
        <View style={styles.bottomSpacer} />

        {/* Botón de Consumo Propio */}
        <View style={styles.consumoPropioContainer}>
          <TouchableOpacity
            style={[
              styles.consumoPropioButton,
              consumoPropioActivo && styles.consumoPropioButtonActive,
            ]}
            onPress={toggleConsumoPropio}
          >
            <View style={styles.consumoPropioContent}>
              <View style={styles.consumoPropioToggle}>
                <View
                  style={[
                    styles.consumoPropioToggleCircle,
                    consumoPropioActivo &&
                      styles.consumoPropioToggleCircleActive,
                  ]}
                />
              </View>
              <View style={styles.consumoPropioTextContainer}>
                <Text
                  style={[
                    styles.consumoPropioTitle,
                    consumoPropioActivo && styles.consumoPropioTitleActive,
                  ]}
                >
                  Consumo Propio
                </Text>
                <Text style={styles.consumoPropioSubtitle}>
                  {consumoPropioActivo
                    ? "Las ventas usarán precio de costo (descuentará del salario)"
                    : "Las ventas usarán precio de venta normal"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Editar Precio */}
      <Modal
        visible={mostrarModalEditarPrecio}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalEditarPrecio(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editarPrecioModalContent}>
            {/* Header con X para cerrar */}
            <View style={styles.editarPrecioModalHeader}>
              <Text style={styles.editarPrecioModalTitle}>
                {productoEditando?.precio_venta &&
                productoEditando.precio_venta > 0
                  ? "Editar Precio"
                  : "Establecer Precio"}
              </Text>
              <TouchableOpacity
                style={styles.editarPrecioCloseButton}
                onPress={() => setMostrarModalEditarPrecio(false)}
              >
                <Text style={styles.editarPrecioCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Contenido del modal con ScrollView */}
            <ScrollView
              style={styles.editarPrecioScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.editarPrecioScrollContainer}
            >
              <View style={styles.editarPrecioModalBody}>
                <View style={styles.editarPrecioProductInfo}>
                  <Text style={styles.editarPrecioProductName}>
                    {productoEditando?.nombre}
                  </Text>
                  <Text style={styles.editarPrecioProductCategory}>
                    {productoEditando?.categoria} •{" "}
                    {productoEditando?.subcategoria}
                  </Text>
                </View>

                <View style={styles.editarPrecioInfoContainer}>
                  <View style={styles.editarPrecioInfoRow}>
                    <Text style={styles.editarPrecioInfoLabel}>
                      Precio de costo:
                    </Text>
                    <Text style={styles.editarPrecioInfoValue}>
                      {formatMoneda(productoEditando?.precio_coste || 0)}
                    </Text>
                  </View>
                  <View style={styles.editarPrecioInfoRow}>
                    <Text style={styles.editarPrecioInfoLabel}>
                      Precio actual:
                    </Text>
                    <Text style={styles.editarPrecioInfoValue}>
                      {formatMoneda(productoEditando?.precio_venta || 0)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.editarPrecioInfoRow,
                      styles.editarPrecioSugerenciaRow,
                    ]}
                  >
                    <View style={styles.editarPrecioSugerenciaContent}>
                      <Text style={styles.editarPrecioSugerenciaLabel}>
                        💡 Precio máximo sugerido:
                      </Text>
                      <Text style={styles.editarPrecioSugerenciaValue}>
                        {formatMoneda(
                          (productoEditando?.precio_coste || 0) / 0.7,
                        )}
                      </Text>
                      <Text style={styles.editarPrecioSugerenciaNota}>
                        (30% de ganancia)
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.editarPrecioInputContainer}>
                  <Text style={styles.editarPrecioInputLabel}>
                    Nuevo precio de venta:
                  </Text>
                  <TextInput
                    style={styles.editarPrecioInput}
                    value={nuevoPrecio}
                    onChangeText={setNuevoPrecio}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Footer fijo con botón */}
            <View style={styles.editarPrecioModalFooter}>
              <TouchableOpacity
                style={styles.editarPrecioSaveButton}
                onPress={guardarPrecioEditado}
              >
                <Text style={styles.editarPrecioSaveText}>
                  {productoEditando?.precio_venta &&
                  productoEditando.precio_venta > 0
                    ? "Actualizar Precio"
                    : "Establecer Precio"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Lista de Preordenes */}
      <Modal
        visible={mostrarListaPreordenes}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarListaPreordenes(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.listaPreordenesModalContent}>
            {/* Header del modal */}
            <View style={styles.listaPreordenesModalHeader}>
              <Text style={styles.listaPreordenesModalTitle}>
                🛒 Preordenes Guardadas
              </Text>
              <TouchableOpacity
                style={styles.listaPreordenesCloseButton}
                onPress={() => setMostrarListaPreordenes(false)}
              >
                <Text style={styles.listaPreordenesCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Lista de preordenes */}
            <ScrollView
              style={styles.listaPreordenesScroll}
              showsVerticalScrollIndicator={false}
            >
              {preordenesGuardadas.length === 0 ? (
                <View style={styles.listaPreordenesEmpty}>
                  <Text style={styles.listaPreordenesEmptyIcon}>📋</Text>
                  <Text style={styles.listaPreordenesEmptyText}>
                    No hay preordenes guardadas
                  </Text>
                  <Text style={styles.listaPreordenesEmptySubtext}>
                    Cierra productos para crear una preorden
                  </Text>
                </View>
              ) : (
                preordenesGuardadas.map((preorden, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.listaPreordenesItem}
                    onPress={() => reanudarPreorden(index)}
                  >
                    <View style={styles.listaPreordenesItemContent}>
                      <View style={styles.listaPreordenesItemHeader}>
                        <Text style={styles.listaPreordenesItemTitle}>
                          Preorden #{index + 1}
                        </Text>
                        <View style={styles.listaPreordenesItemActions}>
                          <TouchableOpacity
                            style={styles.listaPreordenesDeleteButton}
                            onPress={() => eliminarPreorden(index)}
                          >
                            <Text style={styles.listaPreordenesDeleteIcon}>
                              🗑️
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.listaPreordenesItemDetails}>
                        <Text style={styles.listaPreordenesItemCount}>
                          {preorden.length} productos
                        </Text>
                        <Text style={styles.listaPreordenesItemTotal}>
                          Total:{" "}
                          {formatMoneda(
                            preorden.reduce(
                              (sum, item) => sum + item.subtotal,
                              0,
                            ),
                          )}
                        </Text>
                      </View>

                      {/* Lista de productos */}
                      <View style={styles.listaPreordenesProducts}>
                        {preorden.slice(0, 3).map((item, itemIndex) => (
                          <Text
                            key={itemIndex}
                            style={styles.listaPreordenesProductItem}
                          >
                            • {item.cantidad}x {item.nombre}
                          </Text>
                        ))}
                        {preorden.length > 3 && (
                          <Text style={styles.listaPreordenesProductMore}>
                            +{preorden.length - 3} más...
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación de Pago */}
      <Modal
        visible={mostrarModalPago}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalPago(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>Método de Pago</Text>
              <Text style={styles.modalSubtitle}>
                {productoParaPago?.nombre} • {productoParaPago?.cantidad}{" "}
                unidades
              </Text>

              <View style={styles.paymentOptions}>
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    tipoPagoSeleccionado === "efectivo" &&
                      styles.paymentOptionSelected,
                  ]}
                  onPress={() => {
                    setTipoPagoSeleccionado("efectivo");
                    setMetodoTransferencia("");
                  }}
                >
                  <Text style={styles.paymentOptionIcon}>💵</Text>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>Efectivo</Text>
                    <Text style={styles.paymentOptionDescription}>
                      Pago en billetes físicos
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    tipoPagoSeleccionado === "transferencia" &&
                      styles.paymentOptionSelected,
                  ]}
                  onPress={() => setTipoPagoSeleccionado("transferencia")}
                >
                  <Text style={styles.paymentOptionIcon}>📱</Text>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>Transferencia</Text>
                    <Text style={styles.paymentOptionDescription}>
                      Pago digital
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    tipoPagoSeleccionado === "mixto" &&
                      styles.paymentOptionSelected,
                  ]}
                  onPress={() => {
                    setTipoPagoSeleccionado("mixto");
                    setMostrarCampoTransferenciaMixto(true);
                  }}
                >
                  <Text style={styles.paymentOptionIcon}>💰</Text>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>Mixto</Text>
                    <Text style={styles.paymentOptionDescription}>
                      Transferencia + Efectivo
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    tipoPagoSeleccionado === "deuda" &&
                      styles.paymentOptionSelected,
                  ]}
                  onPress={() => {
                    setTipoPagoSeleccionado("deuda");
                    setMetodoTransferencia("");
                  }}
                >
                  <Text style={styles.paymentOptionIcon}>🤝</Text>
                  <View style={styles.paymentOptionInfo}>
                    <Text style={styles.paymentOptionTitle}>Préstamo</Text>
                    <Text style={styles.paymentOptionDescription}>
                      Registrar como préstamo a cliente
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Opciones de transferencia */}
              {tipoPagoSeleccionado === "transferencia" && (
                <View style={styles.transferMethods}>
                  <Text style={styles.transferTitle}>
                    Método de transferencia:
                  </Text>
                  <View style={styles.transferButtons}>
                    {["ENZONA", "TRANSFERMOVIL", "TARJETA"].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.transferButton,
                          metodoTransferencia === method &&
                            styles.transferButtonSelected,
                        ]}
                        onPress={() => setMetodoTransferencia(method)}
                      >
                        <Text
                          style={[
                            styles.transferButtonText,
                            metodoTransferencia === method &&
                              styles.transferButtonTextSelected,
                          ]}
                        >
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Opciones para pago mixto */}
              {tipoPagoSeleccionado === "mixto" && (
                <View style={styles.mixedPaymentContainer}>
                  <Text style={styles.transferTitle}>
                    Método de transferencia:
                  </Text>
                  <View style={styles.transferButtons}>
                    {["ENZONA", "TRANSFERMOVIL", "TARJETA"].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.transferButton,
                          metodoTransferencia === method &&
                            styles.transferButtonSelected,
                        ]}
                        onPress={() => setMetodoTransferencia(method)}
                      >
                        <Text
                          style={[
                            styles.transferButtonText,
                            metodoTransferencia === method &&
                              styles.transferButtonTextSelected,
                          ]}
                        >
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.mixedPaymentAmountContainer}>
                    <Text style={styles.mixedPaymentLabel}>
                      Monto por transferencia:
                    </Text>
                    <TextInput
                      style={styles.mixedPaymentInput}
                      placeholder="0.00"
                      value={montoTransferenciaMixto}
                      onChangeText={setMontoTransferenciaMixto}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                    <Text style={styles.mixedPaymentInfo}>
                      Total: {formatMoneda(productoParaPago?.subtotal || 0)}
                    </Text>
                    <Text style={styles.mixedPaymentRemaining}>
                      Restante (efectivo):{" "}
                      {formatMoneda(
                        (productoParaPago?.subtotal || 0) -
                          parseFloat(montoTransferenciaMixto || "0"),
                      )}
                    </Text>
                  </View>
                </View>
              )}

              {/* Campo de descripción para préstamo */}
              {tipoPagoSeleccionado === "deuda" && (
                <View style={styles.loanDescriptionContainer}>
                  <Text style={styles.loanDescriptionLabel}>
                    Descripción del préstamo:
                  </Text>
                  <TextInput
                    style={styles.loanDescriptionInput}
                    placeholder="Describe los detalles del préstamo..."
                    value={descripcionPrestamo}
                    onChangeText={setDescripcionPrestamo}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setMostrarModalPago(false);
                  setTipoPagoSeleccionado("");
                  setMetodoTransferencia("");
                  setMontoTransferenciaMixto("");
                  setProductoParaPago(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              {/* Botón especial para preorden */}
              {productoParaPago?.productoId === 0 && (
                <TouchableOpacity
                  style={[
                    styles.modalConfirmButton,
                    (!tipoPagoSeleccionado ||
                      (tipoPagoSeleccionado === "transferencia" &&
                        !metodoTransferencia) ||
                      (tipoPagoSeleccionado === "mixto" &&
                        (!metodoTransferencia ||
                          !montoTransferenciaMixto ||
                          parseFloat(montoTransferenciaMixto || "0") <= 0)) ||
                      (tipoPagoSeleccionado === "deuda" &&
                        !descripcionPrestamo.trim())) &&
                      styles.modalConfirmButtonDisabled,
                  ]}
                  onPress={confirmarMetodoPago}
                  disabled={
                    !tipoPagoSeleccionado ||
                    (tipoPagoSeleccionado === "transferencia" &&
                      !metodoTransferencia) ||
                    (tipoPagoSeleccionado === "mixto" &&
                      (!metodoTransferencia ||
                        !montoTransferenciaMixto ||
                        parseFloat(montoTransferenciaMixto || "0") <= 0)) ||
                    (tipoPagoSeleccionado === "deuda" &&
                      !descripcionPrestamo.trim())
                  }
                >
                  <Text style={styles.modalConfirmText}>
                    {esModalPreorden ? "Siguiente" : "Guardar Orden"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Botón normal para venta */}
              {productoParaPago?.productoId !== 0 && (
                <TouchableOpacity
                  style={[
                    styles.modalConfirmButton,
                    (!tipoPagoSeleccionado ||
                      (tipoPagoSeleccionado === "transferencia" &&
                        !metodoTransferencia) ||
                      (tipoPagoSeleccionado === "mixto" &&
                        (!metodoTransferencia ||
                          !montoTransferenciaMixto ||
                          parseFloat(montoTransferenciaMixto || "0") <= 0)) ||
                      (tipoPagoSeleccionado === "deuda" &&
                        !descripcionPrestamo.trim())) &&
                      styles.modalConfirmButtonDisabled,
                  ]}
                  onPress={confirmarMetodoPago}
                  disabled={
                    !tipoPagoSeleccionado ||
                    (tipoPagoSeleccionado === "transferencia" &&
                      !metodoTransferencia) ||
                    (tipoPagoSeleccionado === "mixto" &&
                      (!metodoTransferencia ||
                        !montoTransferenciaMixto ||
                        parseFloat(montoTransferenciaMixto || "0") <= 0)) ||
                    (tipoPagoSeleccionado === "deuda" &&
                      !descripcionPrestamo.trim())
                  }
                >
                  <Text style={styles.modalConfirmText}>
                    {tipoPagoSeleccionado === "deuda"
                      ? "Registrar Préstamo"
                      : "Confirmar Pago"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Detalles de Orden */}
      <Modal
        visible={mostrarModalOrdenDetalles}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalOrdenDetalles(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.listaPreordenesModalContent}>
            {/* Header del modal */}
            <View style={styles.listaPreordenesModalHeader}>
              <Text style={styles.listaPreordenesModalTitle}>
                🛒 Orden Actual
              </Text>
              <TouchableOpacity
                style={styles.listaPreordenesCloseButton}
                onPress={() => setMostrarModalOrdenDetalles(false)}
              >
                <Text style={styles.listaPreordenesCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Contenido de la orden */}
            <View style={{ flex: 1 }}>
              <ScrollView
                style={styles.listaPreordenesScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {orden.length === 0 ? (
                  <View style={styles.listaPreordenesEmpty}>
                    <Text style={styles.listaPreordenesEmptyIcon}>🛒</Text>
                    <Text style={styles.listaPreordenesEmptyText}>
                      No hay productos en la orden
                    </Text>
                    <Text style={styles.listaPreordenesEmptySubtext}>
                      Agrega productos para verlos aquí
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Resumen del total */}
                    <View style={styles.resumenHeader}>
                      <Text style={styles.resumenTitle}>Total de la Orden</Text>
                      <Text style={styles.resumenTotalAmount}>
                        {formatMoneda(totalOrden)}
                      </Text>
                    </View>

                    {/* Lista de productos */}
                    <View style={styles.listaPreordenesItemContent}>
                      <Text style={styles.listaPreordenesItemTitle}>
                        Productos ({orden.length})
                      </Text>

                      {orden
                        .filter((item) => item && item.nombre)
                        .map((item, index) => (
                          <View key={index} style={styles.resumenItem}>
                            <View style={styles.resumenItemHeader}>
                              <Text
                                style={styles.resumenItemName}
                                numberOfLines={2}
                              >
                                {item.nombre}
                              </Text>
                              <View style={styles.resumenItemControls}>
                                <TouchableOpacity
                                  style={styles.resumenItemButton}
                                  onPress={() => {
                                    // Disminuir cantidad
                                    if (item.cantidad > 1) {
                                      const nuevaCantidad = item.cantidad - 1;
                                      const nuevoSubtotal =
                                        nuevaCantidad * item.precioVenta;

                                      const ordenActualizada = orden
                                        .filter((item) => item && item.nombre)
                                        .map((ordenItem, idx) =>
                                          idx === index
                                            ? {
                                                ...ordenItem,
                                                cantidad: nuevaCantidad,
                                                subtotal: nuevoSubtotal,
                                              }
                                            : ordenItem,
                                        );
                                      setOrden(ordenActualizada);
                                    }
                                  }}
                                  disabled={item.cantidad <= 1}
                                >
                                  <Text
                                    style={[
                                      styles.resumenItemButtonText,
                                      item.cantidad <= 1 &&
                                        styles.resumenItemButtonTextDisabled,
                                    ]}
                                  >
                                    -
                                  </Text>
                                </TouchableOpacity>

                                <Text style={styles.resumenItemQuantity}>
                                  {item.cantidad}
                                </Text>

                                <TouchableOpacity
                                  style={[
                                    styles.resumenItemButton,
                                    (() => {
                                      const productoOriginal = productos.find(
                                        (p) => p.id === item.productoId,
                                      );
                                      const stockDisponible = productoOriginal
                                        ? productoOriginal.disponible
                                        : 0;
                                      return (
                                        item.cantidad >= stockDisponible &&
                                        styles.resumenItemButtonDisabled
                                      );
                                    })(),
                                  ]}
                                  onPress={() => {
                                    // Aumentar cantidad - verificar stock disponible
                                    const productoOriginal = productos.find(
                                      (p) => p.id === item.productoId,
                                    );
                                    const stockDisponible = productoOriginal
                                      ? productoOriginal.disponible
                                      : 0;

                                    if (item.cantidad < stockDisponible) {
                                      const nuevaCantidad = item.cantidad + 1;
                                      const nuevoSubtotal =
                                        nuevaCantidad * item.precioVenta;

                                      const ordenActualizada = orden
                                        .filter((item) => item && item.nombre)
                                        .map((ordenItem, idx) =>
                                          idx === index
                                            ? {
                                                ...ordenItem,
                                                cantidad: nuevaCantidad,
                                                subtotal: nuevoSubtotal,
                                              }
                                            : ordenItem,
                                        );
                                      setOrden(ordenActualizada);
                                    } else {
                                      Alert.alert(
                                        "Stock Insuficiente",
                                        `No puedes agregar más de ${stockDisponible} unidades de "${item.nombre}".\n\nStock disponible: ${stockDisponible} unidades`,
                                      );
                                    }
                                  }}
                                  disabled={(() => {
                                    const productoOriginal = productos.find(
                                      (p) => p.id === item.productoId,
                                    );
                                    const stockDisponible = productoOriginal
                                      ? productoOriginal.disponible
                                      : 0;
                                    return item.cantidad >= stockDisponible;
                                  })()}
                                >
                                  <Text
                                    style={[
                                      styles.resumenItemButtonText,
                                      (() => {
                                        const productoOriginal = productos.find(
                                          (p) => p.id === item.productoId,
                                        );
                                        const stockDisponible = productoOriginal
                                          ? productoOriginal.disponible
                                          : 0;
                                        return (
                                          item.cantidad >= stockDisponible &&
                                          styles.resumenItemButtonTextDisabled
                                        );
                                      })(),
                                    ]}
                                  >
                                    +
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                            <Text style={styles.resumenItemDetails}>
                              {item.cantidad} x {formatMoneda(item.precioVenta)}
                            </Text>
                            <Text style={styles.resumenItemSubtotal}>
                              Subtotal: {formatMoneda(item.subtotal)}
                            </Text>
                            {item.tipoPago && (
                              <Text style={styles.resumenItemPago}>
                                Pago: {item.tipoPago}
                              </Text>
                            )}
                          </View>
                        ))}
                    </View>
                  </>
                )}
              </ScrollView>

              {/* Botones fijos en la parte inferior */}
              {orden.length > 0 && (
                <View
                  style={{
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "#e5e7eb",
                    paddingHorizontal: 20,
                  }}
                >
                  {/* Botones de acción */}
                  <View style={styles.resumenActions}>
                    <TouchableOpacity
                      onPress={mostrarSeleccionOfertas}
                      style={[styles.calcularButton, { maxWidth: 120 }]}
                    >
                      <Text style={styles.calcularButtonText}>Calcular</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setOrden([])}
                      style={[styles.resumenClearButton, { maxWidth: 120 }]}
                    >
                      <Text style={styles.resumenClear}>Limpiar</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.confirmarButton,
                      { marginHorizontal: 20, marginBottom: 10 },
                    ]}
                    onPress={confirmarOrden}
                  >
                    <Text style={styles.confirmarButtonText}>
                      Confirmar Venta ({orden.length} items)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación de Orden */}
      <Modal
        visible={mostrarModalOrden}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalOrden(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalTitle}>Confirmar Orden</Text>
              <TouchableOpacity
                style={[
                  styles.circularPdfButton,
                  { backgroundColor: "#3b82f6" },
                ]}
                onPress={exportarOrdenPDF}
                disabled={generatingPDF || orden.length === 0}
              >
                <Text style={styles.circularPdfButtonText}>
                  {generatingPDF ? "..." : "📄"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.confirmModalSubtitle}>
              Revisa los detalles de la venta
            </Text>

            <ScrollView style={styles.confirmOrderList}>
              {orden
                .filter((item) => item && item.nombre)
                .map((item, index) => {
                  const tieneOferta = ofertasDisponibles[item.productoId];
                  const precioConOferta = calcularPrecioConOferta(item);
                  const ofertaseleccionada =
                    ofertasSeleccionadas[item.productoId];

                  return (
                    <View key={index} style={styles.confirmOrderItem}>
                      <View style={styles.confirmOrderItemLeft}>
                        <View style={styles.confirmOrderItemHeader}>
                          <Text style={styles.confirmOrderItemName}>
                            {item.nombre}
                          </Text>
                          {/* Checkbox de ofertas - habilitado individualmente por producto */}
                          <TouchableOpacity
                            style={[
                              styles.ofertaCheckbox,
                              tieneOferta
                                ? ofertaseleccionada
                                  ? styles.ofertaCheckboxSelected
                                  : styles.ofertaCheckboxUnselected
                                : styles.ofertaCheckboxDisabled,
                            ]}
                            onPress={() =>
                              tieneOferta &&
                              toggleOfertaProducto(item.productoId)
                            }
                            disabled={!tieneOferta}
                          >
                            <Text
                              style={[
                                styles.ofertaCheckboxText,
                                tieneOferta
                                  ? ofertaseleccionada
                                    ? styles.ofertaCheckboxTextSelected
                                    : styles.ofertaCheckboxTextUnselected
                                  : styles.ofertaCheckboxTextDisabled,
                              ]}
                            >
                              {tieneOferta && ofertaseleccionada ? "✓" : ""}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.confirmOrderItemDetails}>
                          {item.cantidad} x {formatMoneda(item.precioVenta)}
                          {item.tipoPago &&
                            ` • ${item.tipoPago}${item.metodoTransferencia ? ` (${item.metodoTransferencia})` : ""}`}
                        </Text>
                        {tieneOferta && ofertaseleccionada && (
                          <View style={styles.ofertaAplicadaInfo}>
                            <Text style={styles.ofertaAplicadaText}>
                              Oferta aplicada: {formatMoneda(item.subtotal)} →{" "}
                              {formatMoneda(precioConOferta)}
                            </Text>
                          </View>
                        )}
                        {!tieneOferta && (
                          <View style={styles.sinOfertaInfo}>
                            <Text style={styles.sinOfertaText}>
                              Sin ofertas disponibles
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.confirmOrderItemPriceContainer}>
                        {tieneOferta && ofertaseleccionada ? (
                          <>
                            <Text
                              style={styles.confirmOrderItemSubtotalOriginal}
                            >
                              {formatMoneda(item.subtotal)}
                            </Text>
                            <Text
                              style={styles.confirmOrderItemSubtotalWithOffer}
                            >
                              {formatMoneda(precioConOferta)}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.confirmOrderItemSubtotal}>
                            {formatMoneda(item.subtotal)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
            </ScrollView>

            <View style={styles.confirmOrderTotalOriginal}>
              <Text style={styles.confirmOrderTotalLabel}>Total original:</Text>
              <Text style={styles.confirmOrderTotalAmountOriginal}>
                {formatMoneda(totalOrden)}
              </Text>
            </View>

            {totalConOfertas < totalOrden && (
              <View style={styles.confirmOrderDiscount}>
                <Text style={styles.confirmOrderDiscountLabel}>
                  Descuento aplicado:
                </Text>
                <Text style={styles.confirmOrderDiscountAmount}>
                  -{formatMoneda(totalOrden - totalConOfertas)}
                </Text>
              </View>
            )}

            <View style={styles.confirmOrderTotalFinal}>
              <Text style={styles.confirmOrderTotalLabelFinal}>
                Total a cobrar:
              </Text>
              <Text style={styles.confirmOrderTotalAmountFinal}>
                {formatMoneda(totalConOfertas)}
              </Text>
            </View>

            <View
              style={[styles.confirmModalFooter, { paddingHorizontal: 24 }]}
            >
              <TouchableOpacity
                style={[
                  styles.confirmModalCancelButton,
                  { flex: 1, justifyContent: "center", alignItems: "center" },
                ]}
                onPress={() => setMostrarModalOrden(false)}
              >
                <Text
                  style={[
                    styles.confirmModalCancelText,
                    { textAlign: "center" },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmModalConfirmButton,
                  { flex: 1, justifyContent: "center", alignItems: "center" },
                ]}
                onPress={finalizarVenta}
              >
                <Text
                  style={[
                    styles.confirmModalConfirmText,
                    { textAlign: "center" },
                  ]}
                >
                  Confirmar Venta
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Ofertas */}
      <Modal
        visible={mostrarModalSeleccionOfertas}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalSeleccionOfertas(false)}
      >
        <View style={styles.calculoModalOverlay}>
          <View style={styles.calculoModalContent}>
            <View style={styles.calculoModalHeader}>
              <Text style={styles.calculoModalTitle}>Seleccionar Ofertas</Text>
              <TouchableOpacity
                style={[
                  styles.circularPdfButton,
                  { backgroundColor: "#3b82f6" },
                ]}
                onPress={exportarOrdenPDF}
                disabled={generatingPDF || orden.length === 0}
              >
                <Text style={styles.circularPdfButtonText}>
                  {generatingPDF ? "..." : "📄"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.calculoModalSubtitle}>
              Elige qué ofertas deseas aplicar a los productos
            </Text>

            <ScrollView style={styles.confirmOrderList}>
              {orden
                .filter((item) => item && item.nombre)
                .map((item, index) => {
                  const tieneOferta = ofertasDisponibles[item.productoId];
                  const precioConOferta = calcularPrecioConOferta(item);
                  const ofertaseleccionada =
                    ofertasSeleccionadas[item.productoId];

                  return (
                    <View key={index} style={styles.confirmOrderItem}>
                      <View style={styles.confirmOrderItemLeft}>
                        <View style={styles.confirmOrderItemHeader}>
                          <Text style={styles.confirmOrderItemName}>
                            {item.nombre}
                          </Text>
                          {/* Checkbox de ofertas - habilitado individualmente por producto */}
                          <TouchableOpacity
                            style={[
                              styles.ofertaCheckbox,
                              tieneOferta
                                ? ofertaseleccionada
                                  ? styles.ofertaCheckboxSelected
                                  : styles.ofertaCheckboxUnselected
                                : styles.ofertaCheckboxDisabled,
                            ]}
                            onPress={() =>
                              tieneOferta &&
                              toggleOfertaProducto(item.productoId)
                            }
                            disabled={!tieneOferta}
                          >
                            <Text
                              style={[
                                styles.ofertaCheckboxText,
                                tieneOferta
                                  ? ofertaseleccionada
                                    ? styles.ofertaCheckboxTextSelected
                                    : styles.ofertaCheckboxTextUnselected
                                  : styles.ofertaCheckboxTextDisabled,
                              ]}
                            >
                              {tieneOferta && ofertaseleccionada ? "✓" : ""}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.confirmOrderItemDetails}>
                          {item.cantidad} x {formatMoneda(item.precioVenta)}
                          {item.tipoPago &&
                            ` • ${item.tipoPago}${item.metodoTransferencia ? ` (${item.metodoTransferencia})` : ""}`}
                        </Text>
                        {tieneOferta && ofertaseleccionada && (
                          <View style={styles.ofertaAplicadaInfo}>
                            <Text style={styles.ofertaAplicadaText}>
                              Oferta aplicada: {formatMoneda(item.subtotal)} →{" "}
                              {formatMoneda(precioConOferta)}
                            </Text>
                          </View>
                        )}
                        {!tieneOferta && (
                          <View style={styles.sinOfertaInfo}>
                            <Text style={styles.sinOfertaText}>
                              Sin ofertas disponibles
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.confirmOrderItemPriceContainer}>
                        {tieneOferta && ofertaseleccionada ? (
                          <>
                            <Text
                              style={styles.confirmOrderItemSubtotalOriginal}
                            >
                              {formatMoneda(item.subtotal)}
                            </Text>
                            <Text
                              style={styles.confirmOrderItemSubtotalWithOffer}
                            >
                              {formatMoneda(precioConOferta)}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.confirmOrderItemSubtotal}>
                            {formatMoneda(item.subtotal)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
            </ScrollView>

            <View style={styles.confirmOrderTotalOriginal}>
              <Text style={styles.confirmOrderTotalLabel}>Total original:</Text>
              <Text style={styles.confirmOrderTotalAmountOriginal}>
                {formatMoneda(totalOrden)}
              </Text>
            </View>

            {totalConOfertas < totalOrden && (
              <View style={styles.confirmOrderDiscount}>
                <Text style={styles.confirmOrderDiscountLabel}>
                  Descuento aplicado:
                </Text>
                <Text style={styles.confirmOrderDiscountAmount}>
                  -{formatMoneda(totalOrden - totalConOfertas)}
                </Text>
              </View>
            )}

            <View style={styles.confirmOrderTotalFinal}>
              <Text style={styles.confirmOrderTotalLabelFinal}>
                Total con ofertas:
              </Text>
              <Text style={styles.confirmOrderTotalAmountFinal}>
                {formatMoneda(totalConOfertas)}
              </Text>
            </View>

            <View style={styles.confirmModalFooter}>
              <TouchableOpacity
                style={[
                  styles.confirmModalCancelButton,
                  { flex: 1, justifyContent: "center", alignItems: "center" },
                ]}
                onPress={() => setMostrarModalSeleccionOfertas(false)}
              >
                <Text
                  style={[
                    styles.confirmModalCancelText,
                    { textAlign: "center" },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmModalConfirmButton,
                  { flex: 1, justifyContent: "center", alignItems: "center" },
                ]}
                onPress={confirmarSeleccionOfertas}
              >
                <Text
                  style={[
                    styles.confirmModalConfirmText,
                    { textAlign: "center" },
                  ]}
                >
                  Aplicar y Calcular Dinero
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Cálculo de Billetes */}
      <Modal
        visible={mostrarModalCalculo}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalCalculo(false)}
      >
        <View style={styles.calculoModalOverlay}>
          <View style={styles.calculoModalContent}>
            <Text style={styles.calculoModalTitle}>Calcular Dinero</Text>

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
                                : (billetes[denominacion] || 0).toString()
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

            {/* Sección inferior - Totales y Botones (se oculta con el teclado) */}
            {!tecladoVisible && (
              <View>
                {/* Totales */}
                <View style={styles.calculoTotals}>
                  <View style={styles.calculoTotalRow}>
                    <Text style={styles.calculoTotalLabel}>
                      Total a recibir:
                    </Text>
                    <Text style={styles.calculoTotalValue}>
                      {formatMoneda(calcularMontoEfectivoRequerido())}
                    </Text>
                  </View>
                  <View style={styles.calculoTotalRow}>
                    <Text style={styles.calculoTotalLabel}>
                      Dinero verificado:
                    </Text>
                    <Text style={styles.calculoTotalValueHighlight}>
                      {formatMoneda(calcularTotalBilletes())}
                    </Text>
                  </View>
                  <View style={styles.calculoTotalRowLast}>
                    <Text style={styles.calculoTotalLabel}>Vuelto:</Text>
                    <Text
                      style={[
                        styles.calculoTotalValueHighlight,
                        calcularVuelto() > 0
                          ? styles.calculoVueltoPositive
                          : calcularVuelto() < 0
                            ? styles.calculoVueltoNegative
                            : styles.calculoVueltoZero,
                      ]}
                    >
                      {formatMoneda(calcularVuelto())}
                    </Text>
                  </View>
                </View>

                {/* Botones */}
                <View style={styles.calculoModalFooter}>
                  <TouchableOpacity
                    style={styles.calculoCancelButton}
                    onPress={() => setMostrarModalCalculo(false)}
                  >
                    <Text style={styles.calculoCancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.calculoConfirmButton}
                    onPress={() => {
                      const vuelto = calcularVuelto();
                      if (vuelto > 0) {
                        Alert.alert(
                          "Verificación Completada",
                          `Dinero verificado: ${formatMoneda(calcularTotalBilletes())}\nEfectivo requerido: ${formatMoneda(calcularMontoEfectivoRequerido())}\nVuelto: ${formatMoneda(vuelto)}${totalConOfertas < totalOrden ? `\nDescuento aplicado: ${formatMoneda(totalOrden - totalConOfertas)}` : ""}`,
                          [
                            {
                              text: "OK",
                              onPress: () => {
                                // Resetear cantidades y cerrar modal de cálculo
                                setBilletes({
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
                                setMostrarModalCalculo(false);
                                // Mostrar modal de orden para confirmación final
                                setMostrarModalOrden(true);
                              },
                            },
                          ],
                        );
                      } else {
                        Alert.alert(
                          "Verificación Completada",
                          `Dinero verificado: ${formatMoneda(calcularTotalBilletes())}\nEfectivo requerido: ${formatMoneda(calcularMontoEfectivoRequerido())}`,
                          [
                            {
                              text: "OK",
                              onPress: () => {
                                // Resetear cantidades y cerrar modal de cálculo
                                setBilletes({
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
                                setMostrarModalCalculo(false);
                                // Mostrar modal de orden para confirmación final
                                setMostrarModalOrden(true);
                              },
                            },
                          ],
                        );
                      }
                    }}
                  >
                    <Text style={styles.calculoConfirmText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Historial de Ventas */}
      <Modal
        visible={mostrarModalHistorial}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalHistorial(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModalContent}>
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle}>
                {tipoHistorial === "venta"
                  ? "Historial de Ventas"
                  : "Historial de Entradas"}
              </Text>
              <TouchableOpacity
                style={styles.historyCloseButton}
                onPress={() => setMostrarModalHistorial(false)}
              >
                <Text style={styles.historyCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.historyModalBody}>
              {/* Selector de tipo de historial */}
              <View style={styles.tipoHistorialSelector}>
                <Text style={styles.tipoHistorialLabel}>Ver:</Text>
                <View style={styles.tipoHistorialButtons}>
                  <TouchableOpacity
                    style={[
                      styles.tipoHistorialButton,
                      tipoHistorial === "venta" &&
                        styles.tipoHistorialButtonActive,
                    ]}
                    onPress={() => cambiarModoHistorial("venta")}
                  >
                    <Text
                      style={[
                        styles.tipoHistorialButtonText,
                        tipoHistorial === "venta" &&
                          styles.tipoHistorialButtonTextActive,
                      ]}
                    >
                      Ventas
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.tipoHistorialButton,
                      tipoHistorial === "entrada" &&
                        styles.tipoHistorialButtonActive,
                    ]}
                    onPress={() => cambiarModoHistorial("entrada")}
                  >
                    <Text
                      style={[
                        styles.tipoHistorialButtonText,
                        tipoHistorial === "entrada" &&
                          styles.tipoHistorialButtonTextActive,
                      ]}
                    >
                      Entradas
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filtros de fecha */}
              <View style={styles.filtrosContainer}>
                <View style={styles.filtrosHeader}>
                  <Text style={styles.filtrosTitle}>Filtrar por fecha</Text>
                  <TouchableOpacity
                    style={styles.limpiarFiltrosButton}
                    onPress={limpiarFiltros}
                  >
                    <Text style={styles.limpiarFiltrosText}>Limpiar</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.fechasContainer}>
                  <TouchableOpacity
                    style={styles.fechaButton}
                    onPress={() => setMostrarDatePickerDesde(true)}
                  >
                    <Text style={styles.fechaLabel}>Desde:</Text>
                    <Text style={styles.fechaValor}>
                      {fechaDesde
                        ? fechaDesde.toLocaleDateString("es-CU")
                        : "Seleccionar fecha"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.fechaButton}
                    onPress={() => setMostrarDatePickerHasta(true)}
                  >
                    <Text style={styles.fechaLabel}>Hasta:</Text>
                    <Text style={styles.fechaValor}>
                      {fechaHasta
                        ? fechaHasta.toLocaleDateString("es-CU")
                        : "Seleccionar fecha"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {cargandoHistorial ? (
                <View style={styles.historyLoadingContainer}>
                  <Text style={styles.historyLoadingText}>
                    Cargando {tipoHistorial === "venta" ? "ventas" : "entradas"}
                    ...
                  </Text>
                </View>
              ) : historialFiltrado.length === 0 ? (
                <View style={styles.historyEmptyContainer}>
                  <Text style={styles.historyEmptyIcon}>📋</Text>
                  <Text style={styles.historyEmptyTitle}>
                    No hay {tipoHistorial === "venta" ? "ventas" : "entradas"}
                  </Text>
                  <Text style={styles.historyEmptySubtitle}>
                    {historialEntradas.length > 0
                      ? `No hay ${tipoHistorial === "venta" ? "ventas" : "entradas"} en el rango de fechas seleccionado`
                      : `No se encontraron ${tipoHistorial === "venta" ? "ventas realizadas" : "entradas de productos"}`}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.historyScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.historyListContent}
                >
                  {historialFiltrado.map((item, index) => (
                    <View key={index} style={styles.historyItem}>
                      <View style={styles.historyItemHeader}>
                        <View style={styles.historyItemInfo}>
                          <Text style={styles.historyItemName}>
                            {item.producto_nombre}
                          </Text>
                          <Text style={styles.historyItemDateText}>
                            {(() => {
                              try {
                                if (!item.creado_en)
                                  return "Fecha no disponible";
                                const fecha = new Date(item.creado_en);
                                if (isNaN(fecha.getTime()))
                                  return "Fecha inválida";
                                // Ya no se necesita parche de -4 horas porque ahora las fechas están en zona horaria local
                                return `${fecha.toLocaleDateString("es-CU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })} ${fecha.toLocaleTimeString("es-CU", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}`;
                              } catch (error) {
                                console.error("Error fecha:", error);
                                return "Fecha inválida";
                              }
                            })()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historyItemDetails}>
                        {tipoHistorial === "venta" ? (
                          <>
                            {/* Mostrar información de consumo propio si aplica */}
                            {item.tipo === "consumo_propio" && (
                              <View
                                style={[
                                  styles.historyDetailRow,
                                  styles.consumoPropioInfo,
                                ]}
                              >
                                <View style={styles.consumoPropioHeader}>
                                  <Text style={styles.consumoPropioBadge}>
                                    🏠 CONSUMO PROPIO
                                  </Text>
                                  <Text style={styles.consumoPropioTrabajador}>
                                    Trabajador:{" "}
                                    {item.trabajador_nombre || "No asignado"}
                                  </Text>
                                </View>
                              </View>
                            )}

                            <View style={styles.historyDetailRow}>
                              <Text style={styles.historyDetailLabel}>
                                Cantidad:
                              </Text>
                              <Text style={styles.historyDetailValue}>
                                {item.cantidad} unidades
                              </Text>
                            </View>

                            {/* Mostrar método de consumo propio */}
                            {item.tipo === "consumo_propio" &&
                              item.metodo_consumo && (
                                <View style={styles.historyDetailRow}>
                                  <Text style={styles.historyDetailLabel}>
                                    Método:
                                  </Text>
                                  <Text
                                    style={[
                                      styles.historyDetailValue,
                                      styles.consumoPropioMethod,
                                    ]}
                                  >
                                    {item.metodo_consumo === "coste" &&
                                      "Precio de costo"}
                                    {item.metodo_consumo === "porcentual" &&
                                      `${item.valor_descuento}% de descuento`}
                                    {item.metodo_consumo === "fijo" &&
                                      `$${item.valor_descuento} de descuento fijo`}
                                  </Text>
                                </View>
                              )}

                            <View style={styles.historyDetailRow}>
                              <Text style={styles.historyDetailLabel}>
                                {item.tipo === "consumo_propio"
                                  ? "Precio pagado:"
                                  : "Precio Venta:"}
                              </Text>
                              <Text
                                style={[
                                  styles.historyDetailValue,
                                  item.tipo === "consumo_propio"
                                    ? styles.consumoPropioPrice
                                    : styles.normalPrice,
                                ]}
                              >
                                ${item.precio_venta?.toFixed(2) || "0.00"}
                              </Text>
                            </View>

                            {/* Mostrar precio original para consumo propio */}
                            {item.tipo === "consumo_propio" && (
                              <View style={styles.historyDetailRow}>
                                <Text style={styles.historyDetailLabel}>
                                  Precio original:
                                </Text>
                                <Text
                                  style={[
                                    styles.historyDetailValue,
                                    styles.originalPrice,
                                  ]}
                                >
                                  $
                                  {item.precio_venta_original?.toFixed(2) ||
                                    "0.00"}
                                </Text>
                              </View>
                            )}

                            <View style={styles.historyDetailRow}>
                              <Text style={styles.historyDetailLabel}>
                                Subtotal:
                              </Text>
                              <Text style={styles.historyDetailValue}>
                                $
                                {(item.precio_venta * item.cantidad).toFixed(2)}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <View style={styles.historyDetailRow}>
                              <Text style={styles.historyDetailLabel}>
                                Cantidad Recibida:
                              </Text>
                              <Text style={styles.historyDetailValue}>
                                {item.cantidad} unidades
                              </Text>
                            </View>
                            <View style={styles.historyDetailRow}>
                              <Text style={styles.historyDetailLabel}>
                                Precio Costo:
                              </Text>
                              <Text style={styles.historyDetailValue}>
                                ${item.precio_coste?.toFixed(2) || "0.00"}
                              </Text>
                            </View>
                            {item.precio_venta && item.precio_venta > 0 && (
                              <View style={styles.historyDetailRow}>
                                <Text style={styles.historyDetailLabel}>
                                  Precio Venta:
                                </Text>
                                <Text style={styles.historyDetailValue}>
                                  ${item.precio_venta.toFixed(2)}
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* DatePicker para fecha desde */}
      {mostrarDatePickerDesde && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setMostrarDatePickerDesde(false)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContent}>
              <Text style={styles.datePickerTitle}>
                Seleccionar fecha desde
              </Text>
              <DateTimePicker
                value={fechaDesde || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePickerDesde(false);
                  if (selectedDate) {
                    setFechaDesde(selectedDate);
                  }
                }}
                style={styles.datePicker}
              />
              <TouchableOpacity
                style={styles.datePickerCancelButton}
                onPress={() => setMostrarDatePickerDesde(false)}
              >
                <Text style={styles.datePickerCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* DatePicker para fecha hasta */}
      {mostrarDatePickerHasta && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setMostrarDatePickerHasta(false)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContent}>
              <Text style={styles.datePickerTitle}>
                Seleccionar fecha hasta
              </Text>
              <DateTimePicker
                value={fechaHasta || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarDatePickerHasta(false);
                  if (selectedDate) {
                    setFechaHasta(selectedDate);
                  }
                }}
                style={styles.datePicker}
              />
              <TouchableOpacity
                onPress={() => setMostrarDatePickerHasta(false)}
              >
                <Text style={styles.datePickerCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal para Nombre del Cliente (PDF) */}
      <Modal
        visible={mostrarModalCliente}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalCliente(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.clienteModalContent}>
            <View style={styles.clienteModalHeader}>
              <Text style={styles.clienteModalTitle}>Nombre del Cliente</Text>
              <TouchableOpacity
                style={styles.clienteModalCloseButton}
                onPress={() => {
                  setMostrarModalCliente(false);
                  setNombreCliente("");
                  setGeneratingPDF(false);
                }}
              >
                <Text style={styles.clienteModalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.clienteModalBody}>
              <Text style={styles.clienteModalDescription}>
                Por favor, ingresa el nombre del cliente para generar el PDF:
              </Text>
              <TextInput
                style={styles.clienteModalInput}
                placeholder="Nombre del cliente"
                value={nombreCliente}
                onChangeText={setNombreCliente}
                autoFocus
                multiline={false}
              />
            </View>

            <View style={styles.clienteModalFooter}>
              <TouchableOpacity
                style={[
                  styles.clienteModalButton,
                  styles.clienteModalConfirmButton,
                  !nombreCliente.trim() &&
                    styles.clienteModalConfirmButtonDisabled,
                ]}
                onPress={generarPDFConNombre}
                disabled={!nombreCliente.trim()}
              >
                <Text
                  style={[
                    styles.clienteModalConfirmText,
                    !nombreCliente.trim() &&
                      styles.clienteModalConfirmTextDisabled,
                  ]}
                >
                  Generar PDF
                </Text>
              </TouchableOpacity>

              {/* 🧩 PARTE 3: BOTÓN DE IMPRIMIR TICKET */}
              <TouchableOpacity
                style={[
                  styles.botonTicket,
                  (isPrinting || !nombreCliente.trim()) &&
                    styles.botonTicketDisabled,
                ]}
                onPress={imprimirTicket}
                disabled={isPrinting || !nombreCliente.trim()}
              >
                <Text
                  style={[
                    styles.textoBoton,
                    (isPrinting || !nombreCliente.trim()) &&
                      styles.textoBotonDisabled,
                  ]}
                >
                  {isPrinting ? "Imprimiendo..." : "Imprimir Ticket"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Dar de Baja con Cantidad */}
      <Modal
        visible={mostrarModalBajaCantidad}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalBajaCantidad(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bajaModalContent}>
            <Text style={styles.bajaModalTitle}>Dar de Baja</Text>

            {productoParaBaja && (
              <>
                <Text style={styles.bajaModalProductText}>
                  {productoParaBaja.nombre}
                </Text>
                <Text style={styles.bajaModalStockText}>
                  Stock: {productoParaBaja.cantidad} unidades
                </Text>

                <TextInput
                  style={styles.bajaModalInput}
                  value={cantidadBaja}
                  onChangeText={setCantidadBaja}
                  placeholder="Cantidad a dar de baja"
                  keyboardType="numeric"
                  maxLength={6}
                />

                <View style={styles.bajaModalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.bajaModalButton, styles.bajaCancelButton]}
                    onPress={() => {
                      setMostrarModalBajaCantidad(false);
                      setProductoParaBaja(null);
                      setCantidadBaja("");
                    }}
                  >
                    <Text style={styles.bajaCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bajaModalButton, styles.bajaConfirmButton]}
                    onPress={ejecutarBajaCantidad}
                  >
                    <Text style={styles.bajaConfirmButtonText}>
                      Dar de Baja
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Trabajador (Consumo Propio) */}
      <Modal
        visible={mostrarModalSeleccionTrabajador}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalSeleccionTrabajador(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.trabajadorModalContent}>
            <Text style={styles.trabajadorModalTitle}>
              Seleccionar Trabajador
            </Text>
            <Text style={styles.trabajadorModalSubtitle}>
              Elige el trabajador cuyo salario será descontado por el consumo
              propio
            </Text>

            {cargandoTrabajadores ? (
              <View style={styles.trabajadorModalLoading}>
                <Text style={styles.trabajadorModalLoadingText}>
                  Cargando trabajadores...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.trabajadorModalList}>
                {trabajadores.map((trabajador) => (
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
                        {trabajador.porcentaje}% de las ventas
                      </Text>
                      <Text style={styles.trabajadorModalItemDescription}>
                        {trabajador.descripcion && (
                          <Text style={styles.trabajadorModalItemDescription}>
                            {trabajador.descripcion}
                          </Text>
                        )}
                      </Text>
                      <Text style={styles.trabajadorModalItemArrowText}>
                        {trabajador.es_porcentaje === 1 ? "Porcentaje" : "Fijo"}{" "}
                        - {trabajador.porcentaje}% de las ventas
                      </Text>
                    </View>
                    <View style={styles.trabajadorModalItemArrow}>
                      <Text style={styles.trabajadorModalItemArrowText}>›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.trabajadorModalButtonContainer}>
              <TouchableOpacity
                style={styles.trabajadorModalCancelButton}
                onPress={() => setMostrarModalSeleccionTrabajador(false)}
              >
                <Text style={styles.trabajadorModalCancelButtonText}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Precio (Consumo Propio) */}
      <Modal
        visible={mostrarModalSeleccionPrecio}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalSeleccionPrecio(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.precioModalContent}>
            <View style={styles.precioModalHeader}>
              <Text style={styles.precioModalTitle}>
                Selección de Precio - Consumo Propio
              </Text>
              <Text style={styles.precioModalSubtitle}>
                {trabajadorSeleccionado?.nombre || "Trabajador seleccionado"}
              </Text>
            </View>

            <View style={styles.precioModalBody}>
              <Text style={styles.precioModalLabel}>
                ¿Cómo desea calcular el precio de los productos?
              </Text>

              {/* Opción 1: Precio de costo */}
              <TouchableOpacity
                style={[
                  styles.precioOption,
                  tipoDescuento === "coste" && styles.precioOptionSelected,
                ]}
                onPress={() => setTipoDescuento("coste")}
              >
                <View style={styles.precioOptionRadio}>
                  <View
                    style={[
                      styles.precioOptionRadioDot,
                      tipoDescuento === "coste" &&
                        styles.precioOptionRadioDotSelected,
                    ]}
                  />
                </View>
                <Text style={styles.precioOptionText}>Precio de costo</Text>
              </TouchableOpacity>

              {/* Opción 2: Descuento porcentual */}
              <TouchableOpacity
                style={[
                  styles.precioOption,
                  tipoDescuento === "porcentual" && styles.precioOptionSelected,
                ]}
                onPress={() => setTipoDescuento("porcentual")}
              >
                <View style={styles.precioOptionRadio}>
                  <View
                    style={[
                      styles.precioOptionRadioDot,
                      tipoDescuento === "porcentual" &&
                        styles.precioOptionRadioDotSelected,
                    ]}
                  />
                </View>
                <Text style={styles.precioOptionText}>
                  Descuento porcentual
                </Text>
              </TouchableOpacity>

              {/* Campo para descuento porcentual */}
              {tipoDescuento === "porcentual" && (
                <View
                  style={[
                    styles.precioInputContainer,
                    styles.precioInputContainerMargin,
                  ]}
                >
                  <Text style={styles.precioInputLabel}>Porcentaje:</Text>
                  <TextInput
                    style={styles.precioInputSmall}
                    value={valorDescuento}
                    onChangeText={setValorDescuento}
                    placeholder="10"
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={styles.precioInputSuffix}>%</Text>
                </View>
              )}

              {/* Opción 3: Descuento fijo */}
              <TouchableOpacity
                style={[
                  styles.precioOption,
                  tipoDescuento === "fijo" && styles.precioOptionSelected,
                ]}
                onPress={() => setTipoDescuento("fijo")}
              >
                <View style={styles.precioOptionRadio}>
                  <View
                    style={[
                      styles.precioOptionRadioDot,
                      tipoDescuento === "fijo" &&
                        styles.precioOptionRadioDotSelected,
                    ]}
                  />
                </View>
                <Text style={styles.precioOptionText}>Descuento fijo</Text>
              </TouchableOpacity>

              {/* Campo para descuento fijo */}
              {tipoDescuento === "fijo" && (
                <View style={styles.precioInputContainer}>
                  <Text style={styles.precioInputLabel}>Monto:</Text>
                  <TextInput
                    style={styles.precioInputSmall}
                    value={valorDescuento}
                    onChangeText={setValorDescuento}
                    placeholder="5.50"
                    keyboardType="numeric"
                  />
                  <Text style={styles.precioInputSuffix}>$</Text>
                </View>
              )}
            </View>

            <View style={styles.precioModalButtonContainer}>
              <TouchableOpacity
                style={styles.precioModalCancelButton}
                onPress={cancelarSeleccionPrecio}
              >
                <Text style={styles.precioModalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.precioModalConfirmButton}
                onPress={confirmarSeleccionPrecio}
              >
                <Text style={styles.precioModalConfirmButtonText}>
                  Siguiente
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Gestión de Deudas */}
      <Modal
        visible={mostrarModalGestionDeudas}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarModalGestionDeudas(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deudasModalContent}>
            <View style={styles.deudasModalHeader}>
              <Text style={styles.deudasModalTitle}>Gestionar Deudas</Text>
              <TouchableOpacity
                style={styles.deudasCloseButton}
                onPress={() => setMostrarModalGestionDeudas(false)}
              >
                <Text style={styles.deudasCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.deudasListContainer}>
              {cargandoDeudas ? (
                <View style={styles.deudasLoadingContainer}>
                  <Text style={styles.deudasLoadingText}>
                    Cargando deudas...
                  </Text>
                </View>
              ) : deudasPunto.length === 0 ? (
                <View style={styles.deudasEmptyContainer}>
                  <Text style={styles.deudasEmptyText}>
                    No hay deudas pendientes
                  </Text>
                </View>
              ) : (
                deudasPunto.map((deuda) => (
                  <View key={deuda.id} style={styles.deudaItem}>
                    <View style={styles.deudaInfo}>
                      <Text style={styles.deudaDescription}>
                        {deuda.descripcion}
                      </Text>
                      <Text style={styles.deudaMonto}>
                        {formatMoneda(deuda.monto)}
                      </Text>
                      <Text style={styles.deudaFecha}>
                        Vence: {deuda.fecha_vencimiento}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deudaPayButton}
                      onPress={() =>
                        marcarDeudaComoPagada(
                          deuda.id,
                          deuda.descripcion,
                          deuda.monto,
                        )
                      }
                    >
                      <Text style={styles.deudaPayButtonText}>
                        Marcar Pagada
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
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
  },
  scrollContent: {
    paddingBottom: 30,
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

  // Header MODIFICADO - Sin botón Volver
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
  titleContainer: {
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: -20,
    top: -2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#6b7280",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
  },
  deudasButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f59e0b",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  historyIcon: {
    fontSize: 20,
    color: "white",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  orderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    justifyContent: "center",
    position: "relative",
    minWidth: 100,
  },
  preordenesButton: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    minWidth: 100,
  },
  preordenesIcon: {
    fontSize: 20,
    color: "white",
  },
  preordenesBadge: {
    backgroundColor: "white",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: -8,
    left: -8,
    zIndex: 1,
    borderWidth: 2,
    borderColor: "#10b981",
  },
  preordenesBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#10b981",
  },
  orderBadge: {
    backgroundColor: "white",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: -8,
    left: -8,
    zIndex: 1,
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3b82f6",
  },
  orderIcon: {
    fontSize: 20,
    color: "white",
  },
  orderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "white",
  },

  // Resumen rápido
  resumenRapido: {
    backgroundColor: "#fef3c7",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fcd34d",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  resumenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resumenTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400e",
  },
  resumenTotalAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#059669",
  },
  resumenActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  resumenClearButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    flex: 1,
    alignItems: "center",
  },
  resumenClear: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "600",
  },
  resumenList: {
    marginBottom: 16,
  },
  resumenItem: {
    backgroundColor: "white",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 10,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "#fde68a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resumenItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  resumenItemDetails: {
    fontSize: 12,
    color: "#6b7280",
  },
  resumenItemSubtotal: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "500",
  },
  resumenItemPago: {
    fontSize: 10,
    color: "#7c3aed",
    fontWeight: "500",
  },
  resumenItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  resumenItemControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 4,
  },
  resumenItemButton: {
    backgroundColor: "#3b82f6",
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
  resumenItemButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 20,
  },
  resumenItemButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  resumenItemButtonTextDisabled: {
    color: "#9ca3af",
  },
  resumenItemQuantity: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    minWidth: 30,
    textAlign: "center",
  },
  confirmarButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmarButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "white",
  },

  // Filtros
  filtersSection: {
    backgroundColor: "white",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },
  filtersGrid: {
    gap: 16,
  },
  filterInput: {},
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#111827",
  },
  categoryScroll: {
    maxHeight: 44,
  },
  categoryButtons: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 2,
  },
  categoryButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryButtonActive: {
    backgroundColor: "#3b82f6",
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
  },
  categoryButtonTextActive: {
    color: "white",
  },

  // Contador
  contadorContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contadorLeft: {
    flex: 1,
  },
  contadorText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  contadorSubtext: {
    fontSize: 13,
    color: "#6b7280",
  },

  // Selección múltiple
  seleccionMultipleButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  seleccionMultipleButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#2563eb",
  },
  seleccionMultipleButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  seleccionMultipleButtonTextActive: {
    color: "white",
  },
  seleccionMultipleControls: {
    backgroundColor: "white",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  seleccionMultipleInfo: {
    marginBottom: 16,
  },
  seleccionMultipleInfoText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  seleccionMultipleSubtext: {
    fontSize: 14,
    color: "#6b7280",
  },
  seleccionMultipleActions: {
    flexDirection: "row",
    gap: 10,
  },
  seleccionMultipleActionsVertical: {
    flexDirection: "column",
    gap: 8,
    marginTop: 12,
  },
  seleccionMultipleActionButton: {
    flex: 1,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  seleccionMultipleSellButton: {
    backgroundColor: "#10b981",
    borderColor: "#059669",
  },
  seleccionMultipleSellButtonDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
  },
  seleccionMultipleActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  seleccionMultipleSellText: {
    color: "white",
  },
  preordenButton: {
    backgroundColor: "#8b5cf6",
    borderColor: "#7c3aed",
  },
  preordenButtonText: {
    color: "white",
  },
  reanudarButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
    flex: 1,
  },
  reanudarButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelarPreordenButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  cancelarPreordenButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  // Estilos para modal de lista de preordenes
  listaPreordenesModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    margin: 20,
    maxHeight: Dimensions.get("window").height * 0.8,
    flex: 1,
  },
  listaPreordenesModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  listaPreordenesModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  listaPreordenesCloseButton: {
    padding: 8,
    borderRadius: 15,
    backgroundColor: "#f3f4f6",
  },
  listaPreordenesCloseIcon: {
    fontSize: 18,
    color: "#6b7280",
    fontWeight: "700",
  },
  listaPreordenesScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listaPreordenesEmpty: {
    alignItems: "center",
    paddingVertical: 60,
  },
  listaPreordenesEmptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  listaPreordenesEmptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  listaPreordenesEmptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  listaPreordenesItem: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  listaPreordenesItemContent: {
    gap: 12,
  },
  listaPreordenesItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listaPreordenesItemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  listaPreordenesItemActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  listaPreordenesDeleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  listaPreordenesDeleteIcon: {
    fontSize: 16,
  },
  listaPreordenesItemDetails: {
    gap: 4,
  },
  listaPreordenesItemCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  listaPreordenesItemTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
  },
  listaPreordenesProducts: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  listaPreordenesProductItem: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  listaPreordenesProductMore: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  listaPreordenesModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  listaPreordenesCloseFooterButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  listaPreordenesCloseFooterText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  checkboxContainer: {
    padding: 4,
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#3b82f6",
    borderColor: "#2563eb",
  },
  checkboxCheck: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  // Productos
  productsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  productsGrid: {
    gap: 20,
  },
  productCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  // Encabezado de card
  productCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  productHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    flex: 1,
  },
  productIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
  },
  productIconText: {
    fontSize: 28,
  },
  productHeaderInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    lineHeight: 22,
  },
  productCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoriaBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoriaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3b82f6",
  },
  productSubcategory: {
    fontSize: 13,
    color: "#6b7280",
  },
  deleteButton: {
    padding: 8,
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    marginLeft: 10,
  },
  deleteIcon: {
    fontSize: 18,
    color: "#dc2626",
  },
  productCardButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  editButton: {
    padding: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    marginLeft: 4,
  },
  formatButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 120,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  formatButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#2563eb",
  },
  formatButtonContainer: {
    marginTop: 8,
    alignItems: "center",
  },
  formatButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
  },
  formatButtonTextActive: {
    color: "white",
  },
  editIcon: {
    fontSize: 18,
    color: "#d97706",
  },

  // Cuerpo de card
  productCardBody: {
    padding: 20,
    paddingTop: 16,
  },

  // Vencimiento
  vencimientoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  vencimientoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vencimientoText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  // Precios
  pricesContainer: {
    marginBottom: 20,
  },
  priceRowMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  priceColumn: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
    fontWeight: "500",
  },
  salePrice: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  profitPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10b981",
  },
  profitNegative: {
    color: "#ef4444",
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  costLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  costPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },

  // Stock y controles
  stockControlsContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  stockInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  stockLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  stockAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  stockEmpty: {
    color: "#ef4444",
  },
  stockLow: {
    color: "#f59e0b",
  },
  preordenIndicator: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  preordenIndicatorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#dc2626",
    textAlign: "center",
  },
  preordenIndicatorCard: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  preordenIndicatorCardText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
    textAlign: "center",
  },
  quantitySection: {
    marginTop: 8,
  },
  quantityLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  quantityButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  quantityButtonMinus: {
    backgroundColor: "#fee2e2",
  },
  quantityButtonPlus: {
    backgroundColor: "#d1fae5",
  },
  quantityButtonDisabled: {
    backgroundColor: "#f3f4f6",
    shadowOpacity: 0,
    elevation: 0,
  },
  quantityButtonText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  quantityButtonTextDisabled: {
    color: "#9ca3af",
  },
  quantityInput: {
    width: 80,
    height: 52,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    paddingHorizontal: 8,
  },

  // Botón añadir
  addToOrderContainer: {
    padding: 20,
    paddingTop: 0,
  },
  addToOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addToOrderButtonInactive: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  addToOrderButtonActive: {
    backgroundColor: "#3b82f6",
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  addToOrderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  addToOrderIcon: {
    fontSize: 22,
  },
  addToOrderText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  addToOrderTextInactive: {
    color: "#6b7280",
  },
  addToOrderTextActive: {
    color: "white",
  },
  addToOrderSubtotal: {
    fontSize: 18,
    fontWeight: "800",
    color: "white",
    marginLeft: 10,
  },

  // Productos nuevos
  newProductsSection: {
    backgroundColor: "white",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  newBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#d97706",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  newProductsList: {
    gap: 14,
    marginTop: 12,
  },
  newProductItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  newProductInfo: {
    flex: 1,
  },
  newProductHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  newProductName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  newProductVencimiento: {
    padding: 4,
  },
  newProductVencimientoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  newProductCategory: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  newProductCost: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  setPriceButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 130,
    alignItems: "center",
  },
  setPriceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "white",
  },

  // Estado vacío
  emptyState: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: 20,
    color: "#9ca3af",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },

  // Info Box
  infoBox: {
    backgroundColor: "#f0f9ff",
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  infoIcon: {
    fontSize: 26,
    color: "#0ea5e9",
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0369a1",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#0369a1",
    lineHeight: 20,
  },
  infoHighlight: {
    fontWeight: "700",
  },
  bottomSpacer: {
    height: 40,
  },

  // Modal de Pago
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 24,
    maxHeight: "85%",
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    flex: 1,
    justifyContent: "space-between",
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 24,
  },
  paymentOptions: {
    gap: 12,
    marginBottom: 24,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  paymentOptionSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  paymentOptionIcon: {
    fontSize: 28,
  },
  paymentOptionInfo: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  paymentOptionDescription: {
    fontSize: 14,
    color: "#6b7280",
  },
  transferMethods: {
    marginBottom: 16,
  },
  transferTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  transferButtons: {
    flexDirection: "row",
    gap: 8,
  },
  transferButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  transferButtonSelected: {
    backgroundColor: "#3b82f6",
  },
  transferButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  transferButtonTextSelected: {
    color: "white",
  },
  loanDescriptionContainer: {
    marginBottom: 16,
  },
  loanDescriptionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  loanDescriptionInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#374151",
    minHeight: 80,
  },
  mixedPaymentContainer: {
    marginBottom: 16,
  },
  mixedPaymentAmountContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  mixedPaymentLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  mixedPaymentInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#374151",
    marginBottom: 12,
  },
  mixedPaymentInfo: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  mixedPaymentRemaining: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  modalConfirmButton: {
    flex: 2,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalConfirmButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },

  // Modal de confirmación de orden
  confirmModalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "90%",
  },
  confirmModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  confirmModalSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
  },
  confirmOrderList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  confirmOrderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  confirmOrderItemLeft: {
    flex: 1,
  },
  confirmOrderItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  confirmOrderItemDetails: {
    fontSize: 13,
    color: "#6b7280",
  },
  confirmOrderItemSubtotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  confirmOrderTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: "#e5e7eb",
    marginBottom: 24,
  },
  confirmOrderTotalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  confirmOrderTotalAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#10b981",
  },
  confirmModalFooter: {
    flexDirection: "row",
    gap: 12,
  },
  confirmModalCancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmModalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  confirmModalConfirmButton: {
    flex: 2,
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmModalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },

  // Estilos para el botón Calcular
  calcularButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: "center",
  },
  calcularButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },

  // Estilos para el modal de cálculo de billetes
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
    margin: 20,
    height: "85%",
    width: "95%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    display: "flex",
    flexDirection: "column",
  },
  calculoModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calculoModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  circularPdfButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  circularPdfButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  calculoModalSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
    textAlign: "center",
  },
  calculoTableScroll: {
    maxHeight: "50%",
    marginBottom: 16,
  },
  calculoTable: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  calculoHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
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
    borderBottomColor: "#f3f4f6",
  },
  calculoCell: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#f3f4f6",
  },
  calculoCellLast: {
    flex: 1,
    padding: 8,
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  calculoInput: {
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "white",
    minWidth: 80,
    height: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  billeteControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  billeteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  billeteButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    lineHeight: 20,
  },
  billeteCantidad: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    minWidth: 40,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  billeteCantidadEditing: {
    backgroundColor: "#f3f4f6",
    borderColor: "#3b82f6",
    borderWidth: 2,
    borderRadius: 6,
    color: "#1f2937",
  },
  calculoTotals: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginTop: 0,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  calculoTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
  },
  calculoTotalRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
    paddingVertical: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    marginHorizontal: -4,
  },
  calculoTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  calculoTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  calculoTotalValueHighlight: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  calculoVueltoPositive: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10b981",
  },
  calculoVueltoZero: {
    fontSize: 18,
    fontWeight: "800",
    color: "#6b7280",
  },
  calculoVueltoNegative: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ef4444",
  },
  calculoModalFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  calculoCancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  calculoCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  calculoConfirmButton: {
    flex: 2,
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  calculoConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },

  // Estilos para los botones del header
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    editButton: {
      backgroundColor: "#3b82f6",
      width: 32,
      height: 32,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 4,
    },
    formatButton: {
      backgroundColor: "#10b981",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginLeft: 4,
      minWidth: 60,
      alignItems: "center",
    },
    formatButtonText: {
      fontSize: 10,
      fontWeight: "600",
      color: "white",
      textAlign: "center",
    },
    historyIconButton: {
      backgroundColor: "#8b5cf6",
    },
  },

  // Estilos para el modal de historial - MEJORADOS
  historyModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 0,
    height: "80%",
    width: "95%",
    maxWidth: 500,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  historyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  historyCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  historyCloseIcon: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
  },
  historyModalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 0,
  },
  tipoHistorialSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  tipoHistorialLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  tipoHistorialButtons: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    padding: 2,
  },
  tipoHistorialButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  tipoHistorialButtonActive: {
    backgroundColor: "#8b5cf6",
  },
  tipoHistorialButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  tipoHistorialButtonTextActive: {
    color: "white",
  },
  historyLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  historyLoadingText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  historyEmptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  historyEmptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  historyEmptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    textAlign: "center",
  },
  historyEmptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  historyListContent: {
    paddingBottom: 20,
  },
  historyScroll: {
    flex: 1,
    width: "100%",
  },
  historyItem: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  historyItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  historyItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
    lineHeight: 22,
  },
  historyItemCategory: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  historyItemDate: {
    alignItems: "flex-end",
  },
  historyItemDateText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  historyItemDetails: {
    gap: 8,
  },
  historyDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyDetailLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  historyDetailValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  historyDetailGain: {
    color: "#10b981",
  },

  // Estilos para filtros de fecha
  filtrosContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filtrosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filtrosTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  limpiarFiltrosButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ef4444",
    borderRadius: 6,
  },
  limpiarFiltrosText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  fechasContainer: {
    gap: 12,
  },
  fechaButton: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fechaLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  fechaValor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "right",
  },

  // Estilos para DatePicker
  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 320,
    alignItems: "center",
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
  },
  datePicker: {
    width: "100%",
    height: 200,
    marginBottom: 16,
  },
  datePickerCancelButton: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  datePickerCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  historyNotesContainer: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  historyNotesLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 4,
  },
  historyNotesText: {
    fontSize: 13,
    color: "#1e40af",
    lineHeight: 18,
  },
  historyModalFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
  },
  historyCloseButtonFooter: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  historyCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },

  // Estilos para checkboxes de ofertas en modal de confirmación
  confirmOrderItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  ofertaCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  ofertaCheckboxUnselected: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
  },
  ofertaCheckboxDisabled: {
    backgroundColor: "#e5e7eb",
    borderColor: "#9ca3af",
  },
  ofertaCheckboxSelected: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  ofertaCheckboxText: {
    fontSize: 14,
    fontWeight: "700",
  },
  ofertaCheckboxTextUnselected: {
    color: "#9ca3af",
  },
  ofertaCheckboxTextDisabled: {
    color: "#9ca3af",
  },
  ofertaCheckboxTextSelected: {
    color: "white",
  },
  ofertaAplicadaInfo: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#d1fae5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  ofertaAplicadaText: {
    fontSize: 12,
    color: "#065f46",
    fontWeight: "600",
  },
  sinOfertaInfo: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sinOfertaText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  confirmOrderItemPriceContainer: {
    alignItems: "flex-end",
  },
  confirmOrderItemSubtotalOriginal: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9ca3af",
    textDecorationLine: "line-through",
    marginBottom: 2,
  },
  confirmOrderItemSubtotalWithOffer: {
    fontSize: 15,
    fontWeight: "700",
    color: "#10b981",
  },
  confirmOrderTotalOriginal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginBottom: 8,
  },
  confirmOrderTotalAmountOriginal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6b7280",
    textDecorationLine: "line-through",
  },
  confirmOrderDiscount: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  confirmOrderDiscountLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
  },
  confirmOrderDiscountAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10b981",
  },
  confirmOrderTotalFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: "#e5e7eb",
    marginBottom: 24,
  },
  confirmOrderTotalLabelFinal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  confirmOrderTotalAmountFinal: {
    fontSize: 24,
    fontWeight: "800",
    color: "#10b981",
  },

  // Estilos para Consumo Propio
  consumoPropioContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  consumoPropioButton: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  consumoPropioButtonActive: {
    borderColor: "#10b981",
    backgroundColor: "#f0fdf4",
  },
  consumoPropioContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  consumoPropioToggle: {
    width: 52,
    height: 28,
    backgroundColor: "#d1d5db",
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 4,
    marginRight: 16,
  },
  consumoPropioToggleCircle: {
    width: 20,
    height: 20,
    backgroundColor: "white",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  consumoPropioToggleCircleActive: {
    backgroundColor: "#10b981",
    marginLeft: 24,
  },
  consumoPropioTextContainer: {
    flex: 1,
  },
  consumoPropioTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  consumoPropioTitleActive: {
    color: "#059669",
  },
  consumoPropioSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  consumoPropioAlert: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  consumoPropioAlertText: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: "600",
    textAlign: "center",
  },
  consumoPropioAlertSubText: {
    fontSize: 11,
    color: "#a16207",
    textAlign: "center",
    marginTop: 2,
  },
  ofertaActivaAlert: {
    backgroundColor: "#d1fae5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#34d399",
  },
  ofertaActivaAlertText: {
    fontSize: 13,
    color: "#065f46",
    fontWeight: "600",
    textAlign: "center",
  },

  // Estilos para el modal de editar precio
  editarPrecioModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    margin: 20,
    maxHeight: "85%",
    minHeight: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    display: "flex",
    flexDirection: "column",
  },
  editarPrecioModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  editarPrecioModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  editarPrecioCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  editarPrecioCloseIcon: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
  },
  editarPrecioScrollContent: {
    flex: 1,
    maxHeight: 300,
  },
  editarPrecioScrollContainer: {
    paddingBottom: 20,
  },
  editarPrecioModalBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  editarPrecioProductInfo: {
    marginBottom: 20,
  },
  editarPrecioProductName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  editarPrecioProductCategory: {
    fontSize: 14,
    color: "#6b7280",
  },
  editarPrecioInfoContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  editarPrecioInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  editarPrecioInfoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  editarPrecioInfoValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  editarPrecioSugerenciaRow: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  editarPrecioSugerenciaContent: {
    flex: 1,
  },
  editarPrecioSugerenciaLabel: {
    fontSize: 14,
    color: "#0369a1",
    fontWeight: "600",
    marginBottom: 4,
  },
  editarPrecioSugerenciaValue: {
    fontSize: 18,
    color: "#0c4a6e",
    fontWeight: "700",
    marginBottom: 2,
  },
  editarPrecioSugerenciaNota: {
    fontSize: 12,
    color: "#0284c7",
    fontWeight: "500",
  },
  editarPrecioInputContainer: {
    marginBottom: 20,
  },
  editarPrecioInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  editarPrecioInput: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  editarPrecioModalFooter: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "white",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  editarPrecioSaveButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  editarPrecioSaveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },

  // Estilos adicionales para el historial mejorado
  historyItemNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  historyTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: "600",
  },
  consumoPropioBadge: {
    backgroundColor: "#fef3c7",
  },
  ventaNormalBadge: {
    backgroundColor: "#dbeafe",
  },
  historyTypeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  consumoPropioText: {
    color: "#d97706",
  },
  ventaNormalText: {
    color: "#1d4ed8",
  },
  consumoPropioPrice: {
    color: "#d97706",
    fontWeight: "600",
  },
  // Estilos adicionales para consumo propio en historial
  consumoPropioInfo: {
    backgroundColor: "#fef3c7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  consumoPropioHeader: {
    flexDirection: "column",
    gap: 4,
  },
  consumoPropioBadge: {
    backgroundColor: "#f59e0b",
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  consumoPropioTrabajador: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: "600",
  },
  consumoPropioMethod: {
    color: "#dc2626",
    fontWeight: "600",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
  },
  originalPrice: {
    color: "#6b7280",
    fontSize: 12,
    textDecorationLine: "line-through",
    fontStyle: "italic",
  },
  normalPrice: {
    color: "#059669",
    fontWeight: "600",
  },
  positiveGanancia: {
    color: "#059669",
    fontWeight: "600",
  },
  neutralGanancia: {
    color: "#6b7280",
    fontWeight: "500",
  },

  // Estilos específicos para modal de nombre del cliente (PDF)
  clienteModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    margin: 20,
    padding: 0,
    maxWidth: 400,
    width: "90%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  clienteModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  clienteModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  clienteModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  clienteModalCloseIcon: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  clienteModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  clienteModalDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 20,
    textAlign: "center",
  },
  clienteModalInput: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
    fontWeight: "500",
  },
  clienteModalInputFocused: {
    borderColor: "#3b82f6",
    backgroundColor: "white",
  },
  clienteModalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#f8fafc",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  clienteModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    fontWeight: "600",
    fontSize: 15,
  },
  clienteModalCancelButton: {
    backgroundColor: "#f8fafc",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 12,
    minWidth: 80,
  },
  clienteModalCancelText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  clienteModalConfirmButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  clienteModalConfirmText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  clienteModalConfirmButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  clienteModalConfirmTextDisabled: {
    color: "#94a3b8",
  },

  // Estilos para el modal de Dar de Baja con Cantidad
  bajaModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    margin: 20,
    padding: 20,
    minWidth: 360,
    maxWidth: 400,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  bajaModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
  },
  bajaModalProductText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  bajaModalStockText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    textAlign: "center",
  },
  bajaModalInput: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#ffffff",
    marginBottom: 20,
    textAlign: "center",
  },
  bajaModalButtonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  bajaModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bajaCancelButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  bajaCancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  bajaConfirmButton: {
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bajaConfirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },

  // Estilos para el modal de selección de trabajador
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

  // Estilos para el modal de selección de precio
  precioModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    width: "90%",
    alignSelf: "center",
  },
  precioModalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  precioModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  precioModalSubtitle: {
    fontSize: 16,
    color: "#3b82f6",
    fontWeight: "600",
    textAlign: "center",
  },
  precioModalBody: {
    marginBottom: 24,
  },
  precioModalLabel: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  precioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  precioOptionSelected: {
    backgroundColor: "#dbeafe",
    borderColor: "#3b82f6",
  },
  precioOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  precioOptionRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d1d5db",
  },
  precioOptionRadioDotSelected: {
    backgroundColor: "#3b82f6",
  },
  precioOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  precioInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  precioInputContainerMargin: {
    marginBottom: 24,
  },
  precioInputLabel: {
    fontSize: 14,
    color: "#374151",
    marginRight: 8,
    flex: 1,
  },
  precioInput: {
    fontSize: 16,
    color: "#1f2937",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 2,
    textAlign: "center",
    backgroundColor: "white",
  },
  precioInputSmall: {
    fontSize: 16,
    color: "#1f2937",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 80,
    textAlign: "center",
    backgroundColor: "white",
  },
  precioInputSuffix: {
    fontSize: 16,
    color: "#6b7280",
    marginLeft: 8,
    fontWeight: "600",
  },
  precioModalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  precioModalCancelButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
    alignItems: "center",
  },
  precioModalCancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  precioModalConfirmButton: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
    alignItems: "center",
  },
  precioModalConfirmButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "white",
  },

  // 🧩 PARTE 4: ESTILOS PARA BOTÓN DE TICKET
  botonTicket: {
    backgroundColor: "#2c3e50",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  botonTicketDisabled: {
    backgroundColor: "#95a5a6",
    opacity: 0.6,
  },
  textoBotonDisabled: {
    color: "#7f8c8d",
  },
  textoBoton: {
    color: "#fff",
    fontWeight: "bold",
  },

  // Estilos para el modal de Gestión de Deudas
  deudasModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    marginHorizontal: 5,
    marginVertical: 20,
    maxHeight: "80%",
    minHeight: 400,
    minWidth: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  deudasModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  deudasModalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  deudasCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  deudasCloseIcon: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
  },
  deudasListContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  deudasLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  deudasLoadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  deudasEmptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  deudasEmptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  deudaItem: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  deudaInfo: {
    flex: 1,
    marginBottom: 12,
  },
  deudaDescription: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  deudaMonto: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ef4444",
    marginBottom: 4,
  },
  deudaFecha: {
    fontSize: 14,
    color: "#6b7280",
  },
  deudaPayButton: {
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  deudaPayButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});
