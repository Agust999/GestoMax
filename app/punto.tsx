// app/(tabs)/punto.tsx
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import {
    ProductoHelper,
    PuntoHelper,
    type Punto,
} from "../src/db/databaseHelper";
import { OfertaService } from "../src/db/services/oferta_service";
import { ProductoService } from "../src/db/services/producto_services";
import { getFechaLocal } from "../src/utils/dateUtils";

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

// Define los tipos de navegación CORREGIDOS con parámetros
type StackParamList = {
  almacen: {
    puntoId: number;
    puntoNombre: string;
    puntoTipo: "punto" | "panaderia";
  };
  venta: { puntoId: number; puntoNombre: string };
  ganancia: { puntoId: number; puntoNombre: string };
  cierre: { puntoId: number; puntoNombre: string };
  precios: { puntoId: number; puntoNombre: string };
  onat: { puntoId: number; puntoNombre: string };
  ingresos_gastos: { puntoId: number; puntoNombre: string };
  gastos: { puntoId: number; puntoNombre: string };
  ofertas: { puntoId: number; puntoNombre: string };
  detalles_punto: { puntoId: number };
  actividad_completa: { puntoId: number };
  prestamos: undefined;
};

// Navigation type
type NavigationProp = NativeStackNavigationProp<StackParamList>;

// Iconos válidos para Ionicons
type IoniconsName =
  | "home"
  | "storefront"
  | "add"
  | "trash-outline"
  | "create-outline"
  | "cube-outline"
  | "cart-outline"
  | "trending-up-outline"
  | "calculator-outline"
  | "list-outline"
  | "business-outline"
  | "cash-outline"
  | "gift-outline"
  | "basket"
  | "close"
  | "search"
  | "trending-up"
  | "trending-down"
  | "ellipsis-vertical"
  | "eye-outline"
  | "time-outline"
  | "close-circle"
  | "pricetag-outline"
  | "information-circle-outline"
  | "calendar-outline"
  | "chevron-forward"
  | "wallet-outline";

// Tipo para oferta activa
interface Oferta {
  id?: number;
  activa: boolean;
  tipo: "porcentaje" | "valor";
  valor: number;
  metodo_pago: "transferencia" | "efectivo" | "todos";
  descripcion?: string;
}

// Tipo para actividad reciente
interface ActividadReciente {
  id: number;
  tipo: string;
  descripcion: string;
  tiempo: string;
  icono: IoniconsName;
  color: string;
  creado_en?: string;
}

export default function PuntoScreen() {
  const navigation = useNavigation<NavigationProp>();

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/punto");

  // Estados
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<Punto | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalOfertaVisible, setModalOfertaVisible] = useState(false);
  const [modalActividadVisible, setModalActividadVisible] = useState(false);
  const [modalOfertasActivasVisible, setModalOfertasActivasVisible] =
    useState(false);
  const [ofertasActivas, setOfertasActivas] = useState<any[]>([]);
  const [cargandoOfertasActivas, setCargandoOfertasActivas] = useState(false);
  const [modalType, setModalType] = useState<"crear" | "editar">("crear");
  const [formData, setFormData] = useState({
    nombre: "",
    tipo_negocio: "punto" as "punto" | "panaderia",
  });
  const [ofertaFormData, setOfertaFormData] = useState({
    tipo: "porcentaje" as "porcentaje" | "valor",
    valor: "",
    descripcion: "",
    metodo_pago: "transferencia" as "transferencia" | "efectivo" | "todos",
    dias_validez: "7",
  });

  // Estados nuevos para el sistema de ofertas mejorado
  const [ofertaMejoradaData, setOfertaMejoradaData] = useState({
    nombre: "",
    descripcion: "",
    dias_ilimitados: false,
    dias_validez: "7",
    metodo_pago: "transferencia" as "transferencia" | "efectivo" | "todos",
    aplica_a_todos: true,
    tipo_descuento_todos: "porcentaje" as "porcentaje" | "valor",
    valor_descuento_todos: "",
  });
  const [productosPunto, setProductosPunto] = useState<any[]>([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState<any[]>(
    [],
  );
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [mostrarSelectorProductos, setMostrarSelectorProductos] =
    useState(false);

  // Estados para el modal de selección de productos
  const [modalSeleccionProductosVisible, setModalSeleccionProductosVisible] =
    useState(false);
  const [productosAgrupados, setProductosAgrupados] = useState<any[]>([]);
  const [productosSeleccionadosModal, setProductosSeleccionadosModal] =
    useState<any[]>([]);
  const [busquedaProductos, setBusquedaProductos] = useState("");
  const [cargandoProductosModal, setCargandoProductosModal] = useState(false);

  // Nuevos estados
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "punto" | "panaderia">(
    "todos",
  );
  const [ofertaActiva, setOfertaActiva] = useState<Oferta | null>(null);
  const [costoTotal, setCostoTotal] = useState(0);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [salarioHoy, setSalarioHoy] = useState(0);
  const [productosEnPunto, setProductosEnPunto] = useState(0);
  const [mostrarPanelInfo, setMostrarPanelInfo] = useState(false);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(false);
  const [actividadReciente, setActividadReciente] = useState<
    ActividadReciente[]
  >([]);
  const [cargandoActividad, setCargandoActividad] = useState(false);
  const [ventasPorTipo, setVentasPorTipo] = useState({
    efectivo: 0,
    transferencia: 0,
    mixto: 0,
  });
  const [productosMasVendidos, setProductosMasVendidos] = useState<any[]>([]);

  // Estados para el modal de actividad paginada
  const [actividadCompleta, setActividadCompleta] = useState<
    ActividadReciente[]
  >([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargandoActividadCompleta, setCargandoActividadCompleta] =
    useState(false);
  const ITEMS_POR_PAGINA = 10;

  // Estados para el modal de entrada directa (ahora para crear productos)
  const [modalEntradaDirectaVisible, setModalEntradaDirectaVisible] =
    useState(false);
  const [productosExistentes, setProductosExistentes] = useState<any[]>([]);
  const [busquedaProductoExistente, setBusquedaProductoExistente] =
    useState("");
  const [cargandoProductosExistentes, setCargandoProductosExistentes] =
    useState(false);
  const [productoSeleccionadoPlantilla, setProductoSeleccionadoPlantilla] =
    useState<any | null>(null);

  // Estados para el formulario de nuevo producto
  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState("");
  const [formSubcategoria, setFormSubcategoria] = useState("");
  const [formPrecioCoste, setFormPrecioCoste] = useState("");
  const [formPrecioVenta, setFormPrecioVenta] = useState("");
  const [formCantidad, setFormCantidad] = useState("");
  const [formFechaCaducidad, setFormFechaCaducidad] = useState("");
  const [formFormatoAlmacen, setFormFormatoAlmacen] = useState("");
  const [formUnidadesPorFormato, setFormUnidadesPorFormato] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modalFormatoAlmacenamiento, setModalFormatoAlmacenamiento] =
    useState(false);

  // Cargar productos del punto para el selector de ofertas
  const cargarProductosPunto = async (puntoId: number) => {
    setCargandoProductos(true);
    try {
      const productos = await OfertaService.getProductosDisponibles(puntoId);
      setProductosPunto(productos);
    } catch (error) {
      console.error("Error cargando productos del punto:", error);
      Alert.alert("Error", "No se pudieron cargar los productos");
    } finally {
      setCargandoProductos(false);
    }
  };

  // Abrir modal de selección de productos
  const abrirModalSeleccionProductos = async () => {
    if (!puntoSeleccionado) return;

    setCargandoProductosModal(true);
    setModalSeleccionProductosVisible(true);
    setBusquedaProductos("");

    try {
      const productos = await OfertaService.getProductosDisponibles(
        puntoSeleccionado.id,
      );

      // Agrupar productos por nombre
      const productosMap = new Map();
      productos.forEach((producto: any) => {
        const nombre = producto.nombre.toLowerCase();
        if (productosMap.has(nombre)) {
          const existente = productosMap.get(nombre);
          existente.cantidad_total += producto.cantidad_en_punto || 0;
          existente.ids.push(producto.id);
        } else {
          productosMap.set(nombre, {
            ...producto,
            cantidad_total: producto.cantidad_en_punto || 0,
            ids: [producto.id],
            nombre_normalizado: nombre,
          });
        }
      });

      const productosAgrupadosArray = Array.from(productosMap.values());
      setProductosAgrupados(productosAgrupadosArray);

      // Inicializar productos seleccionados en el modal
      const seleccionadosModal = productosAgrupadosArray.filter((producto) =>
        productosSeleccionados.some((p) => producto.ids.includes(p.id)),
      );
      setProductosSeleccionadosModal(seleccionadosModal);
    } catch (error) {
      console.error("Error cargando productos para selección:", error);
      Alert.alert("Error", "No se pudieron cargar los productos");
    } finally {
      setCargandoProductosModal(false);
    }
  };

  // Filtrar productos por búsqueda
  const productosFiltrados = productosAgrupados.filter((producto) =>
    producto.nombre.toLowerCase().includes(busquedaProductos.toLowerCase()),
  );

  // Toggle selección de producto en el modal
  const toggleProductoModal = (producto: any) => {
    const yaSeleccionado = productosSeleccionadosModal.find(
      (p) => p.nombre_normalizado === producto.nombre_normalizado,
    );

    if (yaSeleccionado) {
      setProductosSeleccionadosModal(
        productosSeleccionadosModal.filter(
          (p) => p.nombre_normalizado !== producto.nombre_normalizado,
        ),
      );
    } else {
      setProductosSeleccionadosModal([
        ...productosSeleccionadosModal,
        {
          ...producto,
          tipo_descuento: "porcentaje",
          valor_descuento: "5",
        },
      ]);
    }
  };

  // Confirmar selección del modal
  const confirmarSeleccionProductos = () => {
    // Convertir productos seleccionados del modal al formato original
    const nuevosSeleccionados = productosSeleccionadosModal.flatMap(
      (producto) =>
        producto.ids.map((id: number) => ({
          ...producto,
          id,
          tipo_descuento: producto.tipo_descuento || "porcentaje",
          valor_descuento: producto.valor_descuento || "5",
        })),
    );

    setProductosSeleccionados(nuevosSeleccionados);
    setModalSeleccionProductosVisible(false);
  };

  // Toggle selección de producto
  const toggleProductoSeleccionado = (producto: any) => {
    const yaSeleccionado = productosSeleccionados.find(
      (p) => p.id === producto.id,
    );

    if (yaSeleccionado) {
      // Quitar de la selección
      setProductosSeleccionados(
        productosSeleccionados.filter((p) => p.id !== producto.id),
      );
    } else {
      // Agregar a la selección con descuento por defecto
      setProductosSeleccionados([
        ...productosSeleccionados,
        {
          ...producto,
          tipo_descuento: "porcentaje",
          valor_descuento: "5",
        },
      ]);
    }
  };

  // Actualizar descuento de un producto seleccionado
  const actualizarDescuentoProducto = (
    productoId: number,
    campo: string,
    valor: string,
  ) => {
    setProductosSeleccionados(
      productosSeleccionados.map((p) =>
        p.id === productoId ? { ...p, [campo]: valor } : p,
      ),
    );
  };

  // Crear oferta mejorada
  const crearOfertaMejorada = async () => {
    if (!puntoSeleccionado) {
      Alert.alert("Error", "Selecciona un punto primero");
      return;
    }

    if (!ofertaMejoradaData.nombre.trim()) {
      Alert.alert("Error", "El nombre de la oferta es requerido");
      return;
    }

    if (
      !ofertaMejoradaData.dias_ilimitados &&
      !ofertaMejoradaData.dias_validez.trim()
    ) {
      Alert.alert("Error", "Los días de validez son requeridos");
      return;
    }

    if (
      !ofertaMejoradaData.aplica_a_todos &&
      productosSeleccionados.length === 0
    ) {
      Alert.alert("Error", "Debes seleccionar al menos un producto");
      return;
    }

    // Validar descuentos de productos seleccionados
    if (!ofertaMejoradaData.aplica_a_todos) {
      for (const producto of productosSeleccionados) {
        if (
          !producto.valor_descuento ||
          parseFloat(producto.valor_descuento) <= 0
        ) {
          Alert.alert(
            "Error",
            `El descuento para ${producto.nombre} no es válido`,
          );
          return;
        }
      }
    }

    try {
      const productosOferta = !ofertaMejoradaData.aplica_a_todos
        ? productosSeleccionados.map((p) => ({
            producto_id: p.id,
            tipo_descuento: ofertaMejoradaData.tipo_descuento_todos,
            valor_descuento:
              parseFloat(ofertaMejoradaData.valor_descuento_todos) || 5,
          }))
        : [
            {
              producto_id: 0, // Se ignora cuando aplica_a_todos es true
              tipo_descuento: "porcentaje",
              valor_descuento: 5, // Valor por defecto cuando aplica a todos
            },
          ];

      await OfertaService.crearOferta({
        punto_id: puntoSeleccionado.id,
        nombre: ofertaMejoradaData.nombre,
        descripcion: ofertaMejoradaData.descripcion,
        dias_ilimitados: ofertaMejoradaData.dias_ilimitados,
        dias_validez: ofertaMejoradaData.dias_ilimitados
          ? null
          : parseInt(ofertaMejoradaData.dias_validez),
        fecha_inicio: getFechaLocal(),
        activa: true,
        aplica_a_todos: ofertaMejoradaData.aplica_a_todos,
        metodo_pago: ofertaMejoradaData.metodo_pago,
        productos: productosOferta,
      });

      // Recargar estadísticas
      await cargarEstadisticasPunto(puntoSeleccionado.id);

      // Cerrar modal y limpiar formulario
      setModalOfertaVisible(false);
      setOfertaMejoradaData({
        nombre: "",
        descripcion: "",
        dias_ilimitados: false,
        dias_validez: "7",
        metodo_pago: "transferencia",
        aplica_a_todos: true,
        tipo_descuento_todos: "porcentaje",
        valor_descuento_todos: "",
      });
      setProductosSeleccionados([]);
      setMostrarSelectorProductos(false);

      Alert.alert("Éxito", "Oferta creada correctamente");
    } catch (error) {
      console.error("Error creando oferta mejorada:", error);
      Alert.alert("Error", "No se pudo crear la oferta");
    }
  };

  // Abrir modal de ofertas con carga de productos
  const abrirModalOfertas = async () => {
    if (!puntoSeleccionado) return;

    await cargarProductosPunto(puntoSeleccionado.id);
    setModalOfertaVisible(true);
  };

  // Abrir modal de entrada directa al punto (ahora para crear productos)
  const abrirModalEntradaDirecta = async () => {
    if (!puntoSeleccionado) return;

    setCargandoProductosExistentes(true);
    setModalEntradaDirectaVisible(true);
    setBusquedaProductoExistente("");
    setProductoSeleccionadoPlantilla(null);

    // Resetear formulario
    setFormNombre("");
    setFormCategoria("");
    setFormSubcategoria("");
    setFormPrecioCoste("");
    setFormPrecioVenta("");
    setFormCantidad("");
    setFormFechaCaducidad("");
    setFormFormatoAlmacen("");
    setFormUnidadesPorFormato("");

    try {
      // Cargar productos existentes para usar como plantilla
      const productos = await ProductoHelper.getAll(200);
      setProductosExistentes(productos);
    } catch (error) {
      console.error("Error cargando productos existentes:", error);
      Alert.alert("Error", "No se pudieron cargar los productos");
    } finally {
      setCargandoProductosExistentes(false);
    }
  };

  // Seleccionar producto existente como plantilla
  const seleccionarProductoPlantilla = (producto: any) => {
    setProductoSeleccionadoPlantilla(producto);
    setFormNombre(producto.nombre);
    setFormCategoria(producto.categoria);
    setFormSubcategoria(producto.subcategoria || "");
    setFormPrecioCoste(producto.precio_coste.toString());
    // Calcular precio de venta sugerido (mantiene 30% de margen)
    const precioVentaSugerido = (producto.precio_coste / 0.7).toFixed(2);
    setFormPrecioVenta(precioVentaSugerido);
    setFormCantidad("1");
    setFormFechaCaducidad(producto.fecha_caducidad || "");
    setFormFormatoAlmacen(producto.formato_almacen || "");
    setFormUnidadesPorFormato(producto.unidades_por_formato?.toString() || "");
  };

  // Limpiar selección de plantilla y empezar desde cero
  const limpiarPlantilla = () => {
    setProductoSeleccionadoPlantilla(null);
    setFormNombre("");
    setFormCategoria("");
    setFormSubcategoria("");
    setFormPrecioCoste("");
    setFormPrecioVenta("");
    setFormCantidad("");
    setFormFechaCaducidad("");
    setFormFormatoAlmacen("");
    setFormUnidadesPorFormato("");
  };

  // Filtrar productos existentes por búsqueda
  const productosExistentesFiltrados = productosExistentes.filter((producto) =>
    producto.nombre
      .toLowerCase()
      .includes(busquedaProductoExistente.toLowerCase()),
  );

  // Actualizar precio de venta sugerido cuando cambia el precio de coste
  const actualizarPrecioVentaSugerido = (precioCosteText: string) => {
    setFormPrecioCoste(precioCosteText);
    const precioCoste = parseFloat(precioCosteText);
    if (!isNaN(precioCoste) && precioCoste > 0) {
      const precioVentaSugerido = (precioCoste / 0.7).toFixed(2);
      setFormPrecioVenta(precioVentaSugerido);
    } else {
      setFormPrecioVenta("");
    }
    // Resetear campos de formato cuando cambia el precio
    setFormFormatoAlmacen("");
    setFormUnidadesPorFormato("");
  };

  // Crear nuevo producto y agregarlo directamente a la zona de venta del punto
  const crearProductoDirecto = async () => {
    if (!puntoSeleccionado) {
      Alert.alert("Error", "Selecciona un punto primero");
      return;
    }

    // Validar campos requeridos
    if (
      !formNombre.trim() ||
      !formCategoria.trim() ||
      !formPrecioCoste ||
      !formPrecioVenta ||
      !formCantidad ||
      !formFechaCaducidad
    ) {
      Alert.alert("Error", "Complete todos los campos requeridos");
      return;
    }

    const precioCoste = parseFloat(formPrecioCoste);
    const precioVenta = parseFloat(formPrecioVenta);
    let cantidad = parseInt(formCantidad);

    // Calcular unidades totales si se usa formato
    let unidadesTotales = cantidad;
    if (formFormatoAlmacen && formUnidadesPorFormato) {
      const unidadesPorFormato = parseInt(formUnidadesPorFormato);
      unidadesTotales = cantidad * unidadesPorFormato;
    }

    if (isNaN(precioCoste) || precioCoste <= 0) {
      Alert.alert("Error", "El precio de coste debe ser un número positivo");
      return;
    }

    if (isNaN(precioVenta) || precioVenta <= 0) {
      Alert.alert("Error", "El precio de venta debe ser un número positivo");
      return;
    }

    Alert.alert(
      "Confirmar Creación Directa",
      `¿Crear el producto "${formNombre}" directamente en la zona de venta del punto "${puntoSeleccionado.nombre}"?\n\n` +
        `• Precio coste: $${precioCoste.toFixed(2)}\n` +
        `• Precio venta: $${precioVenta.toFixed(2)}\n` +
        `• Categoría: ${formCategoria}\n` +
        `${formSubcategoria ? `• Subcategoría: ${formSubcategoria}\n` : ""}` +
        `• Fecha de caducidad: ${formFechaCaducidad}\n` +
        `${
          formFormatoAlmacen && formUnidadesPorFormato
            ? `• Cantidad: ${cantidad} ${formFormatoAlmacen} (${unidadesTotales} unidades)\n`
            : `• Cantidad: ${unidadesTotales} unidades\n`
        }` +
        `${formFormatoAlmacen ? `• Formato: ${getFormatLabel(formFormatoAlmacen, true)} (${formUnidadesPorFormato} unidades por ${getFormatLabel(formFormatoAlmacen, false)})\n` : ""}` +
        `• El producto estará disponible para venta inmediata\n` +
        `• No pasará por almacén previamente`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Crear y Agregar",
          onPress: async () => {
            try {
              // Importar el servicio de productos
              const { ProductoService } =
                await import("../src/db/services/producto_services");

              // Crear el producto directamente en la zona de venta del punto
              const resultado =
                await ProductoService.createProductoDirectoEnZonaVenta(
                  formNombre.trim(),
                  formCategoria.trim(),
                  formSubcategoria.trim(),
                  precioCoste,
                  unidadesTotales, // Usar unidades totales calculadas
                  puntoSeleccionado.id, // ID del punto
                  precioVenta, // Precio de venta directamente
                  formFechaCaducidad || undefined,
                  formFormatoAlmacen || undefined,
                  formUnidadesPorFormato
                    ? parseInt(formUnidadesPorFormato)
                    : undefined,
                );

              if (!resultado.success) {
                throw new Error(resultado.message);
              }

              Alert.alert(
                "Éxito",
                `Producto "${formNombre}" creado y agregado correctamente a la zona de venta del punto "${puntoSeleccionado.nombre}"`,
              );

              // Cerrar modal y limpiar
              setModalEntradaDirectaVisible(false);
              limpiarPlantilla();

              // Recargar estadísticas del punto
              await cargarEstadisticasPunto(puntoSeleccionado.id);
            } catch (error: any) {
              console.error("Error creando producto:", error);
              Alert.alert(
                "Error",
                error.message || "No se pudo crear el producto",
              );
            }
          },
        },
      ],
    );
  };
  const cargarPuntos = async () => {
    try {
      const data = await PuntoHelper.getAll();
      setPuntos(data);
    } catch (error) {
      console.error("Error cargando puntos:", error);
      Alert.alert("Error", "No se pudieron cargar los puntos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Formatear tiempo relativo
  const formatTiempoRelativo = (fechaString: string): string => {
    const fechaCreacion = new Date(fechaString);
    const ahora = new Date();
    const diferenciaMs = ahora.getTime() - fechaCreacion.getTime();
    const diferenciaHoras = Math.floor(diferenciaMs / (1000 * 60 * 60));

    if (diferenciaHoras < 1) {
      const diferenciaMinutos = Math.floor(diferenciaMs / (1000 * 60));
      return diferenciaMinutos <= 1
        ? "Hace 1 minuto"
        : `Hace ${diferenciaMinutos} minutos`;
    } else if (diferenciaHoras === 1) {
      return "Hace 1 hora";
    } else if (diferenciaHoras < 24) {
      return `Hace ${diferenciaHoras} horas`;
    } else {
      const diferenciaDias = Math.floor(diferenciaHoras / 24);
      return diferenciaDias === 1
        ? "Hace 1 día"
        : `Hace ${diferenciaDias} días`;
    }
  };

  // Cargar todas las ofertas activas del punto con stock de productos
  const cargarOfertasActivas = async (puntoId: number) => {
    setCargandoOfertasActivas(true);
    try {
      const ofertas = await OfertaService.getOfertasActivas(puntoId);

      // Para cada oferta que no aplica a todos, obtener el stock de sus productos
      const ofertasConStock = await Promise.all(
        ofertas.map(async (oferta) => {
          if (
            !oferta.aplica_a_todos &&
            oferta.productos &&
            oferta.productos.length > 0
          ) {
            // Obtener stock para cada producto
            const productosConStock = await Promise.all(
              oferta.productos.map(async (producto) => {
                try {
                  // Obtener stock del producto en este punto
                  const stockQuery =
                    await ProductoService.getStockProductoEnPunto(
                      producto.producto_id,
                      puntoId,
                    );
                  return {
                    ...producto,
                    stock_en_punto: stockQuery || 0,
                  };
                } catch (error) {
                  console.log(
                    `Error obteniendo stock para producto ${producto.producto_id}:`,
                    error,
                  );
                  return {
                    ...producto,
                    stock_en_punto: 0,
                  };
                }
              }),
            );

            return {
              ...oferta,
              productos: productosConStock,
            };
          }
          return oferta;
        }),
      );

      setOfertasActivas(ofertasConStock);
    } catch (error) {
      console.error("Error cargando ofertas activas:", error);
      setOfertasActivas([]);
    } finally {
      setCargandoOfertasActivas(false);
    }
  };

  // Abrir modal de ofertas activas
  const abrirModalOfertasActivas = async () => {
    if (!puntoSeleccionado) return;
    await cargarOfertasActivas(puntoSeleccionado.id);
    setModalOfertasActivasVisible(true);
  };
  const cargarActividadReciente = async (puntoId: number) => {
    setCargandoActividad(true);
    try {
      const actividadDB = await PuntoHelper.getActividadReciente(puntoId, 5);

      const actividadFormateada: ActividadReciente[] = actividadDB.map(
        (item) => {
          // Mapear iconos según tipo de actividad
          let icono: IoniconsName = "time-outline";
          let color = "#6b7280";

          switch (item.tipo) {
            case "venta":
              icono = "cart-outline";
              color = "#10b981";
              break;
            case "transferencia":
              icono = "cube-outline";
              color = "#3b82f6";
              break;
            case "cierre":
              icono = "calculator-outline";
              color = "#f59e0b";
              break;
            default:
              icono = "time-outline";
              color = "#6b7280";
          }

          return {
            id: item.id,
            tipo: item.tipo,
            descripcion: item.descripcion,
            tiempo: formatTiempoRelativo(item.creado_en),
            icono,
            color,
            creado_en: item.creado_en,
          };
        },
      );

      setActividadReciente(actividadFormateada);

      // Cargar ventas por tipo de pago
      const ventasTipo = await PuntoHelper.getVentasHoyPorTipo(puntoId);
      setVentasPorTipo(ventasTipo);

      // Cargar productos más vendidos hoy
      const productosVendidos = await PuntoHelper.getProductosMasVendidosHoy(
        puntoId,
        3,
      );
      setProductosMasVendidos(productosVendidos);
    } catch (error) {
      console.error("Error cargando actividad reciente:", error);
      setActividadReciente([]);
      setVentasPorTipo({ efectivo: 0, transferencia: 0, mixto: 0 });
      setProductosMasVendidos([]);
    } finally {
      setCargandoActividad(false);
    }
  };

  // Cargar actividad completa con paginación
  const cargarActividadCompleta = async (
    puntoId: number,
    pagina: number = 1,
  ) => {
    setCargandoActividadCompleta(true);
    try {
      const actividadDB = await PuntoHelper.getActividadReciente(puntoId, 50); // Cargar más items para paginación

      const actividadFormateada: ActividadReciente[] = actividadDB.map(
        (item) => {
          // Mapear iconos según tipo de actividad
          let icono: IoniconsName = "time-outline";
          let color = "#6b7280";

          switch (item.tipo) {
            case "venta":
              icono = "cart-outline";
              color = "#10b981";
              break;
            case "transferencia":
              icono = "cube-outline";
              color = "#3b82f6";
              break;
            case "cierre":
              icono = "calculator-outline";
              color = "#f59e0b";
              break;
            default:
              icono = "time-outline";
              color = "#6b7280";
          }

          return {
            id: item.id,
            tipo: item.tipo,
            descripcion: item.descripcion,
            tiempo: formatTiempoRelativo(item.creado_en),
            icono,
            color,
            creado_en: item.creado_en,
          };
        },
      );

      // Calcular paginación
      const totalItems = actividadFormateada.length;
      const totalPages = Math.ceil(totalItems / ITEMS_POR_PAGINA);
      const startIndex = (pagina - 1) * ITEMS_POR_PAGINA;
      const endIndex = startIndex + ITEMS_POR_PAGINA;
      const itemsPagina = actividadFormateada.slice(startIndex, endIndex);

      setActividadCompleta(itemsPagina);
      setTotalPaginas(totalPages);
      setPaginaActual(pagina);
    } catch (error) {
      console.error("Error cargando actividad completa:", error);
      setActividadCompleta([]);
      setTotalPaginas(1);
    } finally {
      setCargandoActividadCompleta(false);
    }
  };

  // Cargar estadísticas del punto seleccionado
  const cargarEstadisticasPunto = async (puntoId: number) => {
    setCargandoEstadisticas(true);
    try {
      // Calcular costo total del punto
      const costo = await PuntoHelper.getPrecioCostePunto(puntoId);
      setCostoTotal(costo);

      // Obtener ventas y salario de hoy
      const ventas = await PuntoHelper.getVentasHoy(puntoId);

      // Importar GastoService para calcular salario de hoy
      const { GastoService } = await import("../src/db/services/gasto_service");
      const salario = await GastoService.obtenerSalarioTotalHoy(puntoId);

      setVentasHoy(ventas);
      setSalarioHoy(salario);

      // Obtener cantidad de productos en punto
      const productos = await PuntoHelper.getCantidadProductosEnPunto(puntoId);
      setProductosEnPunto(productos);

      // Obtener oferta activa - CON MANEJO DE ERROR
      try {
        const ofertas = await OfertaService.getOfertasActivas(puntoId);
        if (ofertas.length > 0) {
          const oferta = ofertas[0]; // Tomar la primera oferta activa
          setOfertaActiva({
            id: oferta.id,
            activa: oferta.activa,
            tipo: "porcentaje", // Por defecto, ya que el nuevo servicio maneja esto diferente
            valor: 5, // Valor por defecto
            metodo_pago: oferta.metodo_pago,
            descripcion: oferta.descripcion,
          });
        } else {
          setOfertaActiva(null);
        }
      } catch (ofertaError: any) {
        // Si la tabla no existe, ignorar el error
        console.log("Tabla Oferta no disponible aún");
        setOfertaActiva(null);
      }

      // Cargar actividad reciente y datos adicionales
      await cargarActividadReciente(puntoId);
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
      // Valores por defecto en caso de error
      setCostoTotal(0);
      setVentasHoy(0);
      setSalarioHoy(0);
      setProductosEnPunto(0);
      setOfertaActiva(null);
      setActividadReciente([]);
      setVentasPorTipo({ efectivo: 0, transferencia: 0, mixto: 0 });
      setProductosMasVendidos([]);
    } finally {
      setCargandoEstadisticas(false);
    }
  };

  useEffect(() => {
    cargarPuntos();
    // Inicializar tabla de ofertas con el esquema actualizado
    OfertaService.initializeTables();
  }, []);

  // Filtrar puntos basados en búsqueda y filtro
  const puntosFiltrados = puntos.filter((punto) => {
    const coincideBusqueda = punto.nombre
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const coincideTipo =
      tipoFiltro === "todos" || punto.tipo_negocio === tipoFiltro;
    return coincideBusqueda && coincideTipo;
  });

  // Función para refrescar
  const onRefresh = () => {
    setRefreshing(true);
    cargarPuntos();
    // Si hay un punto seleccionado, recargar sus estadísticas también
    if (puntoSeleccionado) {
      cargarEstadisticasPunto(puntoSeleccionado.id);
    }
  };

  // Funciones CRUD para puntos
  const crearPunto = async () => {
    if (!formData.nombre.trim()) {
      Alert.alert("Error", "El nombre es requerido");
      return;
    }

    try {
      // Verificar si ya existe un punto con ese nombre
      const existe = await PuntoHelper.existsByName(formData.nombre);
      if (existe) {
        Alert.alert("Error", "Ya existe un punto con ese nombre");
        return;
      }

      await PuntoHelper.create(formData.nombre, formData.tipo_negocio);
      setModalVisible(false);
      setFormData({ nombre: "", tipo_negocio: "punto" });
      await cargarPuntos();
      Alert.alert("Éxito", "Punto creado correctamente");
    } catch (error) {
      console.error("Error creando punto:", error);
      Alert.alert("Error", "No se pudo crear el punto");
    }
  };

  const editarPunto = async () => {
    if (!puntoSeleccionado || !formData.nombre.trim()) {
      Alert.alert("Error", "El nombre es requerido");
      return;
    }

    try {
      // Verificar si ya existe otro punto con ese nombre
      const existe = await PuntoHelper.existsByName(
        formData.nombre,
        puntoSeleccionado.id,
      );
      if (existe) {
        Alert.alert("Error", "Ya existe otro punto con ese nombre");
        return;
      }

      await PuntoHelper.update(
        puntoSeleccionado.id,
        formData.nombre,
        formData.tipo_negocio,
      );

      // Actualizar el punto localmente
      const puntosActualizados = puntos.map((p) =>
        p.id === puntoSeleccionado.id
          ? {
              ...p,
              nombre: formData.nombre,
              tipo_negocio: formData.tipo_negocio,
            }
          : p,
      );
      setPuntos(puntosActualizados);

      // Actualizar el punto seleccionado
      setPuntoSeleccionado({
        ...puntoSeleccionado,
        nombre: formData.nombre,
        tipo_negocio: formData.tipo_negocio,
      });

      Alert.alert("Éxito", "Punto actualizado correctamente");
      setModalVisible(false);
      setFormData({ nombre: "", tipo_negocio: "punto" });
    } catch (error) {
      console.error("Error editando punto:", error);
      Alert.alert("Error", "No se pudo actualizar el punto");
    }
  };

  const eliminarPunto = async (id: number, nombre: string) => {
    Alert.alert(
      "Confirmar eliminación",
      `¿Estás seguro de eliminar el punto "${nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await PuntoHelper.delete(id);

              // Eliminamos el punto localmente
              const puntosActualizados = puntos.filter((p) => p.id !== id);
              setPuntos(puntosActualizados);

              // Si eliminamos el punto seleccionado, cerrar el panel
              if (puntoSeleccionado?.id === id) {
                setPuntoSeleccionado(null);
                setMostrarPanelInfo(false);
              }

              Alert.alert("Éxito", "Punto eliminado correctamente");
            } catch (error) {
              console.error("Error eliminando punto:", error);
              Alert.alert("Error", "No se pudo eliminar el punto");
            }
          },
        },
      ],
    );
  };

  // Crear oferta
  const crearOferta = async () => {
    if (!puntoSeleccionado) {
      Alert.alert("Error", "Selecciona un punto primero");
      return;
    }

    if (!ofertaFormData.valor.trim()) {
      Alert.alert("Error", "El valor es requerido");
      return;
    }

    const valor = parseFloat(ofertaFormData.valor);
    if (isNaN(valor) || valor <= 0) {
      Alert.alert("Error", "El valor debe ser un número positivo");
      return;
    }

    const diasValidez = parseInt(ofertaFormData.dias_validez);
    if (isNaN(diasValidez) || diasValidez < 1) {
      Alert.alert("Error", "La validez debe ser de al menos 1 día");
      return;
    }

    try {
      const fechaInicio = getFechaLocal();
      const fechaFin = new Date(Date.now() + diasValidez * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      await OfertaService.crearOferta({
        punto_id: puntoSeleccionado.id,
        nombre:
          ofertaFormData.descripcion ||
          `${ofertaFormData.tipo === "porcentaje" ? valor + "%" : "$" + valor} de descuento`,
        descripcion: ofertaFormData.descripcion,
        dias_ilimitados: false,
        dias_validez: diasValidez,
        metodo_pago: ofertaFormData.metodo_pago,
        aplica_a_todos: true,
      });

      // Recargar estadísticas para actualizar oferta
      await cargarEstadisticasPunto(puntoSeleccionado.id);

      setModalOfertaVisible(false);
      setOfertaFormData({
        tipo: "porcentaje",
        valor: "",
        descripcion: "",
        metodo_pago: "transferencia",
        dias_validez: "7",
      });

      Alert.alert("Éxito", "Oferta creada correctamente");
    } catch (error) {
      console.error("Error creando oferta:", error);
      Alert.alert("Error", "No se pudo crear la oferta");
    }
  };

  // Desactivar oferta
  const desactivarOferta = async () => {
    if (!puntoSeleccionado || !ofertaActiva?.id) {
      return;
    }

    Alert.alert(
      "Desactivar oferta",
      "¿Estás seguro de desactivar esta oferta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desactivar",
          style: "destructive",
          onPress: async () => {
            try {
              await OfertaService.toggleActiva(ofertaActiva.id!, false);
              await cargarEstadisticasPunto(puntoSeleccionado.id);
              Alert.alert("Éxito", "Oferta desactivada correctamente");
            } catch (error) {
              console.error("Error desactivando oferta:", error);
              Alert.alert("Error", "No se pudo desactivar la oferta");
            }
          },
        },
      ],
    );
  };

  // Mostrar información del punto
  const mostrarInformacionPunto = async (punto: Punto) => {
    setPuntoSeleccionado(punto);
    setMostrarPanelInfo(true);
    await cargarEstadisticasPunto(punto.id);
  };

  // Cerrar panel de información
  const cerrarPanelInfo = () => {
    setMostrarPanelInfo(false);
    setPuntoSeleccionado(null);
  };

  // Navegar a diferentes módulos - CORREGIDO CON PARÁMETROS
  const navegarAModulo = (modulo: keyof StackParamList) => {
    if (!puntoSeleccionado) {
      Alert.alert(
        "Selecciona un punto",
        "Primero selecciona un punto de la lista",
      );
      return;
    }

    // Usar un switch para navegar a cada módulo específico CON PARÁMETROS (SIN ALMACÉN)
    switch (modulo) {
      case "venta":
        navigation.navigate("venta", {
          puntoId: puntoSeleccionado.id,
          puntoNombre: puntoSeleccionado.nombre,
        });
        break;
      case "ganancia":
        navigation.navigate("ganancia", {
          puntoId: puntoSeleccionado.id,
          puntoNombre: puntoSeleccionado.nombre,
        });
        break;
      case "cierre":
        navigation.navigate("cierre", {
          puntoId: puntoSeleccionado.id,
          puntoNombre: puntoSeleccionado.nombre,
        });
        break;
      case "precios":
        navigation.navigate("precios", {
          puntoId: puntoSeleccionado.id,
          puntoNombre: puntoSeleccionado.nombre,
        });
        break;
      case "onat":
        navigation.navigate("onat", {
          puntoId: puntoSeleccionado.id,
          puntoNombre: puntoSeleccionado.nombre,
        });
        break;
      case "ingresos_gastos":
        navigation.navigate("ingresos_gastos", {
          puntoId: puntoSeleccionado.id,
          puntoNombre: puntoSeleccionado.nombre,
        });
        break;
      case "gastos":
        navigation.navigate("gastos", {
          puntoId: puntoSeleccionado.id,
          puntoNombre: puntoSeleccionado.nombre,
        });
        break;
      case "ofertas":
        // Navegar a la pantalla de ofertas
        if (puntoSeleccionado) {
          navigation.navigate("ofertas" as any, {
            puntoId: puntoSeleccionado.id,
            puntoNombre: puntoSeleccionado.nombre,
          });
        }
        break;
      case "detalles_punto":
        navigation.navigate("detalles_punto", {
          puntoId: puntoSeleccionado.id,
        });
        break;
      case "actividad_completa":
        navigation.navigate("actividad_completa", {
          puntoId: puntoSeleccionado.id,
        });
        break;
      case "prestamos":
        navigation.navigate("prestamos");
        break;
    }
  };

  // Manejar press largo en punto (menú contextual)
  const handleLongPressPunto = (punto: Punto) => {
    Alert.alert(
      "Opciones del Punto",
      `¿Qué deseas hacer con "${punto.nombre}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Editar Punto",
          onPress: () => {
            setPuntoSeleccionado(punto);
            setFormData({
              nombre: punto.nombre,
              tipo_negocio: punto.tipo_negocio,
            });
            setModalType("editar");
            setModalVisible(true);
          },
        },
        {
          text: "Eliminar Punto",
          style: "destructive",
          onPress: () => eliminarPunto(punto.id, punto.nombre),
        },
      ],
    );
  };

  // Renderizar item de punto
  const renderPuntoItem = ({ item }: { item: Punto }) => {
    const iconName: IoniconsName =
      item.tipo_negocio === "panaderia" ? "basket" : "storefront";

    return (
      <TouchableOpacity
        style={[
          styles.puntoItem,
          puntoSeleccionado?.id === item.id && styles.puntoItemSeleccionado,
        ]}
        onLongPress={() => handleLongPressPunto(item)}
        activeOpacity={0.7}
        delayLongPress={500}
      >
        <View style={styles.puntoItemContent}>
          <View style={styles.puntoIconContainer}>
            <Ionicons
              name={iconName}
              size={24}
              color={puntoSeleccionado?.id === item.id ? "#3b82f6" : "#6b7280"}
            />
          </View>
          <View style={styles.puntoInfo}>
            <Text style={styles.puntoNombre}>{item.nombre}</Text>
            <Text style={styles.puntoTipo}>
              {item.tipo_negocio === "panaderia"
                ? "Panadería"
                : "Punto de Venta"}
            </Text>
            <Text style={styles.puntoFecha}>
              Creado: {new Date(item.creado_en).toLocaleDateString("es-ES")}
            </Text>
          </View>
        </View>
        <View style={styles.puntoActions}>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => mostrarInformacionPunto(item)}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#3b82f6"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => handleLongPressPunto(item)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Módulos disponibles - Actualizado con color para préstamos (SIN ALMACÉN)
  const modulos: {
    icon: IoniconsName;
    label: string;
    color: string;
    key: keyof StackParamList;
    badge?: string;
  }[] = [
    { icon: "cart-outline", label: "Venta", color: "#10b981", key: "venta" },
    {
      icon: "calculator-outline",
      label: "Cierre/Apertura",
      color: "#f59e0b",
      key: "cierre",
    },
    {
      icon: "trending-up-outline",
      label: "Ganancia",
      color: "#8b5cf6",
      key: "ganancia",
    },
    {
      icon: "list-outline",
      label: "Precios",
      color: "#ef4444",
      key: "precios",
    },
    {
      icon: "receipt-outline",
      label: "Ingresos/Gasto",
      color: "#ea580c",
      key: "ingresos_gastos",
    },
    { icon: "business-outline", label: "ONAT", color: "#6366f1", key: "onat" },
    { icon: "cash-outline", label: "Gastos", color: "#ec4899", key: "gastos" },
    {
      icon: "gift-outline",
      label: "Ofertas",
      color: "#06b6d4",
      key: "ofertas",
      badge: ofertaActiva ? "Activa" : undefined,
    },
    {
      icon: "wallet-outline",
      label: "Préstamos/Deudas",
      color: "#8B4513",
      key: "prestamos",
    },
  ];

  // Si está cargando
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando puntos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Puntos de Venta</Text>
            <Text style={styles.headerSubtitle}>
              {puntos.length} {puntos.length === 1 ? "punto" : "puntos"}{" "}
              disponibles
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setModalType("crear");
              setFormData({ nombre: "", tipo_negocio: "punto" });
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Búsqueda */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar punto por nombre..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              tipoFiltro === "todos" && styles.filterButtonActive,
            ]}
            onPress={() => setTipoFiltro("todos")}
          >
            <Text
              style={[
                styles.filterText,
                tipoFiltro === "todos" && styles.filterTextActive,
              ]}
            >
              Todos ({puntos.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              tipoFiltro === "punto" && styles.filterButtonActive,
            ]}
            onPress={() => setTipoFiltro("punto")}
          >
            <Ionicons
              name="storefront"
              size={16}
              color={tipoFiltro === "punto" ? "#3b82f6" : "#6b7280"}
            />
            <Text
              style={[
                styles.filterText,
                tipoFiltro === "punto" && styles.filterTextActive,
              ]}
            >
              Puntos ({puntos.filter((p) => p.tipo_negocio === "punto").length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              tipoFiltro === "panaderia" && styles.filterButtonActive,
            ]}
            onPress={() => setTipoFiltro("panaderia")}
          >
            <Ionicons
              name="basket"
              size={16}
              color={tipoFiltro === "panaderia" ? "#3b82f6" : "#6b7280"}
            />
            <Text
              style={[
                styles.filterText,
                tipoFiltro === "panaderia" && styles.filterTextActive,
              ]}
            >
              Panaderías (
              {puntos.filter((p) => p.tipo_negocio === "panaderia").length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista de Puntos */}
      <FlatList
        data={puntosFiltrados}
        renderItem={renderPuntoItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.puntosList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {searchQuery
                ? "No se encontraron puntos"
                : "No hay puntos creados"}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? "Intenta con otro nombre o limpia la búsqueda"
                : 'Presiona el botón "+" para crear tu primer punto'}
            </Text>
            {searchQuery && (
              <TouchableOpacity
                style={styles.limpiarBusquedaButton}
                onPress={() => setSearchQuery("")}
              >
                <Text style={styles.limpiarBusquedaText}>Limpiar búsqueda</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Panel de Punto Seleccionado */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mostrarPanelInfo}
        onRequestClose={cerrarPanelInfo}
      >
        <View style={styles.modalPanelOverlay}>
          <View style={styles.panelContainer}>
            {/* Cabecera del panel con botón de cerrar */}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleContainer}>
                <Ionicons
                  name={
                    puntoSeleccionado?.tipo_negocio === "panaderia"
                      ? "basket"
                      : "storefront"
                  }
                  size={28}
                  color="#3b82f6"
                />
                <View>
                  <Text style={styles.panelTitle}>
                    {puntoSeleccionado?.nombre || "Punto"}
                  </Text>
                  <Text style={styles.panelSubtitle}>
                    {puntoSeleccionado?.tipo_negocio === "panaderia"
                      ? "Panadería"
                      : "Punto de Venta"}{" "}
                    • ID: {puntoSeleccionado?.id || "N/A"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closePanelButton}
                onPress={cerrarPanelInfo}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {cargandoEstadisticas ? (
              <View style={styles.loadingStatsContainer}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.loadingStatsText}>
                  Cargando estadísticas...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.panelScrollView}
                showsVerticalScrollIndicator={true}
              >
                {/* Módulos del Punto */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.modulosContainer}
                >
                  {modulos.map((modulo) => {
                    if (
                      puntoSeleccionado?.tipo_negocio === "panaderia" &&
                      modulo.key === "precios"
                    ) {
                      return null;
                    }

                    return (
                      <TouchableOpacity
                        key={modulo.key}
                        style={styles.moduloCard}
                        onPress={() => navegarAModulo(modulo.key)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.moduloIcon,
                            { backgroundColor: `${modulo.color}20` },
                          ]}
                        >
                          <Ionicons
                            name={modulo.icon}
                            size={32}
                            color={modulo.color}
                          />
                          {modulo.badge && (
                            <View style={styles.moduloBadge}>
                              <Text style={styles.moduloBadgeText}>
                                {modulo.badge}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.moduloLabel}>{modulo.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Estadísticas del Punto */}
                <View style={styles.statsContainer}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Costo Total</Text>
                    <Text style={styles.statValue}>
                      ${costoTotal.toFixed(2)}
                    </Text>
                    <View style={styles.statChangeContainer}>
                      <Ionicons name="trending-up" size={12} color="#10b981" />
                      <Text style={styles.statChange}>En inventario</Text>
                    </View>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Productos</Text>
                    <Text style={styles.statValue}>{productosEnPunto}</Text>
                    <View style={styles.statChangeContainer}>
                      <Ionicons name="cube-outline" size={12} color="#3b82f6" />
                      <Text style={styles.statChange}>En punto</Text>
                    </View>
                  </View>
                  <View style={[styles.statCard, styles.ofertaCard]}>
                    <TouchableOpacity onPress={abrirModalOfertasActivas}>
                      <Text style={styles.statLabel}>Oferta Activa</Text>
                      {ofertaActiva ? (
                        <Text style={styles.ofertaActivaText}>
                          Sí hay oferta activa
                        </Text>
                      ) : (
                        <Text style={styles.ofertaInactiva}>Sin Oferta</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.activarOfertaBtn}
                      onPress={abrirModalOfertas}
                    >
                      <Ionicons name="gift-outline" size={14} color="white" />
                      <Text style={styles.activarOfertaText}>Crear oferta</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Más estadísticas */}
                <View style={[styles.statsContainer, { marginTop: 0 }]}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Ventas Hoy</Text>
                    <Text style={styles.statValue}>
                      ${(ventasHoy || 0).toFixed(2)}
                    </Text>
                    <View style={styles.statChangeContainer}>
                      <Ionicons name="cart-outline" size={12} color="#10b981" />
                      <Text style={styles.statChange}>Hoy</Text>
                    </View>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Salario Hoy</Text>
                    <Text style={styles.statValue}>
                      ${(salarioHoy || 0).toFixed(2)}
                    </Text>
                    <View style={styles.statChangeContainer}>
                      <Ionicons
                        name="trending-up-outline"
                        size={12}
                        color="#10b981"
                      />
                      <Text style={styles.statChange}>Hoy</Text>
                    </View>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Entrada Directa</Text>
                    <TouchableOpacity
                      style={styles.entradaDirectaButton}
                      onPress={() => abrirModalEntradaDirecta()}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="white"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Ventas por tipo de pago */}
                <View style={styles.tipoPagoContainer}>
                  <Text style={styles.tipoPagoTitle}>
                    Ventas por Tipo de Pago
                  </Text>
                  <View style={styles.tipoPagoStats}>
                    <View
                      style={[
                        styles.tipoPagoItem,
                        { backgroundColor: "#10b98120" },
                      ]}
                    >
                      <Text
                        style={[styles.tipoPagoLabel, { color: "#10b981" }]}
                      >
                        Efectivo
                      </Text>
                      <Text
                        style={[styles.tipoPagoValue, { color: "#10b981" }]}
                      >
                        ${(ventasPorTipo.efectivo || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.tipoPagoItem,
                        { backgroundColor: "#3b82f620" },
                      ]}
                    >
                      <Text
                        style={[styles.tipoPagoLabel, { color: "#3b82f6" }]}
                      >
                        Transferencia
                      </Text>
                      <Text
                        style={[styles.tipoPagoValue, { color: "#3b82f6" }]}
                      >
                        ${(ventasPorTipo.transferencia || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.tipoPagoItem,
                        { backgroundColor: "#f59e0b20" },
                      ]}
                    >
                      <Text
                        style={[styles.tipoPagoLabel, { color: "#f59e0b" }]}
                      >
                        Mixto
                      </Text>
                      <Text
                        style={[styles.tipoPagoValue, { color: "#f59e0b" }]}
                      >
                        ${(ventasPorTipo.mixto || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Productos más vendidos hoy */}
                {productosMasVendidos.length > 0 && (
                  <View style={styles.productosVendidosContainer}>
                    <Text style={styles.productosVendidosTitle}>
                      Productos más vendidos hoy
                    </Text>
                    {productosMasVendidos.map((producto, index) => (
                      <View key={index} style={styles.productoVendidoItem}>
                        <View style={styles.productoVendidoInfo}>
                          <Text style={styles.productoVendidoNombre}>
                            {producto.nombre}
                          </Text>
                          <Text style={styles.productoVendidoCantidad}>
                            {producto.cantidad_vendida} unidades
                          </Text>
                        </View>
                        <Text style={styles.productoVendidoTotal}>
                          ${producto.total_vendido.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Actividad Reciente */}
                <View style={styles.activityContainer}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle}>Actividad Reciente</Text>
                  </View>

                  {cargandoActividad ? (
                    <View style={styles.loadingActivityContainer}>
                      <ActivityIndicator size="small" color="#3b82f6" />
                      <Text style={styles.loadingActivityText}>
                        Cargando actividad...
                      </Text>
                    </View>
                  ) : actividadReciente.length > 0 ? (
                    <>
                      {actividadReciente.map((actividad, index) => (
                        <View
                          key={`${actividad.tipo}-${actividad.id}-${index}`}
                          style={styles.activityItem}
                        >
                          <View
                            style={[
                              styles.activityIcon,
                              { backgroundColor: `${actividad.color}20` },
                            ]}
                          >
                            <Ionicons
                              name={actividad.icono}
                              size={16}
                              color={actividad.color}
                            />
                          </View>
                          <View style={styles.activityContent}>
                            <Text style={styles.activityText}>
                              {actividad.descripcion}
                            </Text>
                            <View style={styles.activityTimeContainer}>
                              <Ionicons
                                name="time-outline"
                                size={12}
                                color="#9ca3af"
                              />
                              <Text style={styles.activityTime}>
                                {actividad.tiempo}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}

                      {actividadReciente.length >= 5 && (
                        <TouchableOpacity
                          style={styles.moreActivityButton}
                          onPress={() => {
                            if (puntoSeleccionado) {
                              setPaginaActual(1);
                              cargarActividadCompleta(puntoSeleccionado.id, 1);
                              setModalActividadVisible(true);
                            }
                          }}
                        >
                          <Text style={styles.moreActivityText}>
                            Ver más actividad
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#3b82f6"
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyActivityContainer}>
                      <Ionicons name="time-outline" size={32} color="#d1d5db" />
                      <Text style={styles.emptyActivityText}>
                        No hay actividad reciente
                      </Text>
                      <Text style={styles.emptyActivitySubtext}>
                        Las ventas, transferencias y otras actividades
                        aparecerán aquí
                      </Text>
                    </View>
                  )}
                </View>

                {/* Información adicional del punto */}
                <View style={styles.additionalInfoContainer}>
                  <Text style={styles.additionalInfoTitle}>
                    Información del Punto
                  </Text>
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#6b7280"
                    />
                    <Text style={styles.infoLabel}>Fecha de creación:</Text>
                    <Text style={styles.infoValue}>
                      {puntoSeleccionado?.creado_en
                        ? new Date(
                            puntoSeleccionado.creado_en,
                          ).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "No disponible"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={16} color="#6b7280" />
                    <Text style={styles.infoLabel}>Última actualización:</Text>
                    <Text style={styles.infoValue}>
                      {puntoSeleccionado?.actualizado_en
                        ? new Date(
                            puntoSeleccionado.actualizado_en,
                          ).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "No disponible"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="cash-outline" size={16} color="#6b7280" />
                    <Text style={styles.infoLabel}>
                      Costo total inventario:
                    </Text>
                    <Text
                      style={[
                        styles.infoValue,
                        { color: "#059669", fontWeight: "600" },
                      ]}
                    >
                      ${costoTotal.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="trending-up-outline"
                      size={16}
                      color="#6b7280"
                    />
                    <Text style={styles.infoLabel}>Rentabilidad estimada:</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        {
                          color: salarioHoy > 0 ? "#059669" : "#dc2626",
                          fontWeight: "600",
                        },
                      ]}
                    >
                      {salarioHoy > 0 ? "+" : ""}${salarioHoy.toFixed(2)} hoy
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal para Crear/Editar Punto */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === "crear" ? "Crear Nuevo Punto" : "Editar Punto"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView}>
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>Nombre del Punto *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.nombre}
                  onChangeText={(text) =>
                    setFormData({ ...formData, nombre: text })
                  }
                  placeholder="Ej: Tienda Central, Panadería Dulce"
                  placeholderTextColor="#9ca3af"
                  maxLength={50}
                />

                <Text style={styles.inputLabel}>Tipo de Negocio *</Text>
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    style={[
                      styles.radioButton,
                      formData.tipo_negocio === "punto" &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, tipo_negocio: "punto" })
                    }
                  >
                    <Ionicons
                      name="storefront"
                      size={20}
                      color={
                        formData.tipo_negocio === "punto"
                          ? "#3b82f6"
                          : "#6b7280"
                      }
                    />
                    <View style={styles.radioInfo}>
                      <Text
                        style={[
                          styles.radioLabel,
                          formData.tipo_negocio === "punto" &&
                            styles.radioLabelSelected,
                        ]}
                      >
                        Punto de Venta
                      </Text>
                      <Text style={styles.radioDescription}>
                        Venta de productos generales
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButton,
                      formData.tipo_negocio === "panaderia" &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, tipo_negocio: "panaderia" })
                    }
                  >
                    <Ionicons
                      name="basket"
                      size={20}
                      color={
                        formData.tipo_negocio === "panaderia"
                          ? "#3b82f6"
                          : "#6b7280"
                      }
                    />
                    <View style={styles.radioInfo}>
                      <Text
                        style={[
                          styles.radioLabel,
                          formData.tipo_negocio === "panaderia" &&
                            styles.radioLabelSelected,
                        ]}
                      >
                        Panadería
                      </Text>
                      <Text style={styles.radioDescription}>
                        Productos de panadería y repostería
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.requiredNote}>
                  <Text style={styles.requiredNoteText}>
                    * Campos requeridos
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={modalType === "crear" ? crearPunto : editarPunto}
                  >
                    <Text style={styles.saveButtonText}>
                      {modalType === "crear"
                        ? "Crear Punto"
                        : "Guardar Cambios"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Crear Oferta Mejorada */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalOfertaVisible}
        onRequestClose={() => setModalOfertaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nueva Oferta</Text>
              <TouchableOpacity onPress={() => setModalOfertaVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView}>
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>Nombre de la Oferta *</Text>
                <TextInput
                  style={styles.input}
                  value={ofertaMejoradaData.nombre}
                  onChangeText={(text) =>
                    setOfertaMejoradaData({
                      ...ofertaMejoradaData,
                      nombre: text,
                    })
                  }
                  placeholder="Ej: Descuento especial de fin de semana"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={ofertaMejoradaData.descripcion}
                  onChangeText={(text) =>
                    setOfertaMejoradaData({
                      ...ofertaMejoradaData,
                      descripcion: text,
                    })
                  }
                  placeholder="Describe los detalles de tu oferta..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.inputLabel}>Método de Pago *</Text>
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.metodo_pago === "transferencia" &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        metodo_pago: "transferencia",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.metodo_pago === "transferencia" &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Solo Transferencia
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.metodo_pago === "efectivo" &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        metodo_pago: "efectivo",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.metodo_pago === "efectivo" &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      En Efectivo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.metodo_pago === "todos" &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        metodo_pago: "todos",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.metodo_pago === "todos" &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Todos los Métodos
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Validez de la Oferta *</Text>
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        dias_ilimitados: !ofertaMejoradaData.dias_ilimitados,
                      })
                    }
                  >
                    <Ionicons
                      name={
                        ofertaMejoradaData.dias_ilimitados
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={20}
                      color={
                        ofertaMejoradaData.dias_ilimitados
                          ? "#06b6d4"
                          : "#6b7280"
                      }
                    />
                    <Text style={styles.checkboxLabel}>Días ilimitados</Text>
                  </TouchableOpacity>
                </View>

                {!ofertaMejoradaData.dias_ilimitados && (
                  <TextInput
                    style={styles.input}
                    value={ofertaMejoradaData.dias_validez}
                    onChangeText={(text) =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        dias_validez: text,
                      })
                    }
                    placeholder="Ej: 7 (días)"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                )}

                <Text style={styles.inputLabel}>Ámbito de la Oferta *</Text>
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    style={[
                      styles.radioButton,
                      ofertaMejoradaData.aplica_a_todos &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        aplica_a_todos: true,
                      })
                    }
                  >
                    <Ionicons
                      name="pricetag-outline"
                      size={20}
                      color={
                        ofertaMejoradaData.aplica_a_todos
                          ? "#06b6d4"
                          : "#6b7280"
                      }
                    />
                    <View style={styles.radioInfo}>
                      <Text
                        style={[
                          styles.radioLabel,
                          ofertaMejoradaData.aplica_a_todos &&
                            styles.radioLabelSelected,
                        ]}
                      >
                        Todos los Productos
                      </Text>
                      <Text style={styles.radioDescription}>
                        Aplicar el mismo descuento a todos los productos del
                        punto
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButton,
                      !ofertaMejoradaData.aplica_a_todos &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        aplica_a_todos: false,
                      })
                    }
                  >
                    <Ionicons
                      name="list-outline"
                      size={20}
                      color={
                        !ofertaMejoradaData.aplica_a_todos
                          ? "#06b6d4"
                          : "#6b7280"
                      }
                    />
                    <View style={styles.radioInfo}>
                      <Text
                        style={[
                          styles.radioLabel,
                          !ofertaMejoradaData.aplica_a_todos &&
                            styles.radioLabelSelected,
                        ]}
                      >
                        Productos Específicos
                      </Text>
                      <Text style={styles.radioDescription}>
                        Seleccionar productos y descuentos individuales
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {ofertaMejoradaData.aplica_a_todos && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.inputLabel}>Tipo de Descuento *</Text>
                    <View style={styles.radioContainer}>
                      <TouchableOpacity
                        style={[
                          styles.radioButtonSmall,
                          ofertaMejoradaData.tipo_descuento_todos ===
                            "porcentaje" && styles.radioButtonSelected,
                        ]}
                        onPress={() =>
                          setOfertaMejoradaData({
                            ...ofertaMejoradaData,
                            tipo_descuento_todos: "porcentaje",
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.radioLabelSmall,
                            ofertaMejoradaData.tipo_descuento_todos ===
                              "porcentaje" && styles.radioLabelSelected,
                          ]}
                        >
                          Porcentaje
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.radioButtonSmall,
                          ofertaMejoradaData.tipo_descuento_todos === "valor" &&
                            styles.radioButtonSelected,
                        ]}
                        onPress={() =>
                          setOfertaMejoradaData({
                            ...ofertaMejoradaData,
                            tipo_descuento_todos: "valor",
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.radioLabelSmall,
                            ofertaMejoradaData.tipo_descuento_todos ===
                              "valor" && styles.radioLabelSelected,
                          ]}
                        >
                          Cantidad Fija
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>
                      {ofertaMejoradaData.tipo_descuento_todos === "porcentaje"
                        ? "Porcentaje de Descuento *"
                        : "Monto de Descuento *"}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={ofertaMejoradaData.valor_descuento_todos}
                      onChangeText={(text) =>
                        setOfertaMejoradaData({
                          ...ofertaMejoradaData,
                          valor_descuento_todos: text,
                        })
                      }
                      placeholder={
                        ofertaMejoradaData.tipo_descuento_todos === "porcentaje"
                          ? "Ej: 10"
                          : "Ej: 5.00"
                      }
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputHint}>
                      {ofertaMejoradaData.tipo_descuento_todos === "porcentaje"
                        ? "Ej: 10 = 10% de descuento en todos los productos"
                        : "Ej: 5.00 = $5.00 de descuento en todos los productos"}
                    </Text>
                  </View>
                )}

                {!ofertaMejoradaData.aplica_a_todos && (
                  <View>
                    <View style={styles.productosSelectorHeader}>
                      <Text style={styles.inputLabel}>
                        Seleccionar Productos
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.selectProductosButton}
                      onPress={abrirModalSeleccionProductos}
                    >
                      <Ionicons name="cube-outline" size={16} color="white" />
                      <Text style={styles.selectProductosText}>
                        Seleccionar Productos
                      </Text>
                    </TouchableOpacity>

                    {mostrarSelectorProductos && (
                      <View style={styles.productosList}>
                        {cargandoProductos ? (
                          <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#06b6d4" />
                            <Text style={styles.loadingText}>
                              Cargando productos...
                            </Text>
                          </View>
                        ) : (
                          <>
                            {productosPunto.map((producto) => {
                              const seleccionado = productosSeleccionados.find(
                                (p) => p.id === producto.id,
                              );
                              return (
                                <TouchableOpacity
                                  key={producto.id}
                                  style={[
                                    styles.productoItem,
                                    seleccionado && styles.productoItemSelected,
                                  ]}
                                  onPress={() =>
                                    toggleProductoSeleccionado(producto)
                                  }
                                >
                                  <View style={styles.productoInfo}>
                                    <Text style={styles.productoNombre}>
                                      {producto.nombre}
                                    </Text>
                                    <Text style={styles.productoCantidad}>
                                      {producto.cantidad_en_punto} disponibles
                                    </Text>
                                  </View>
                                  <Ionicons
                                    name={
                                      seleccionado
                                        ? "checkmark-circle"
                                        : "ellipse-outline"
                                    }
                                    size={20}
                                    color={seleccionado ? "#06b6d4" : "#6b7280"}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </>
                        )}
                      </View>
                    )}

                    {productosSeleccionados.length > 0 && (
                      <View style={styles.seleccionadosContainer}>
                        <Text style={styles.inputLabel}>
                          Productos Seleccionados
                        </Text>
                        {productosSeleccionados.map((producto) => (
                          <View
                            key={producto.id}
                            style={styles.productoSeleccionadoCard}
                          >
                            <View style={styles.productoSeleccionadoInfo}>
                              <Text style={styles.productoSeleccionadoNombre}>
                                {producto.nombre}
                              </Text>
                              <View style={styles.descuentoInputs}>
                                <TouchableOpacity
                                  style={[
                                    styles.descuentoTipoButton,
                                    producto.tipo_descuento === "porcentaje" &&
                                      styles.descuentoTipoSelected,
                                  ]}
                                  onPress={() =>
                                    actualizarDescuentoProducto(
                                      producto.id,
                                      "tipo_descuento",
                                      producto.tipo_descuento === "porcentaje"
                                        ? "valor"
                                        : "porcentaje",
                                    )
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.descuentoTipoText,
                                      producto.tipo_descuento ===
                                        "porcentaje" &&
                                        styles.descuentoTipoSelected,
                                    ]}
                                  >
                                    {producto.tipo_descuento === "porcentaje"
                                      ? "%"
                                      : "$"}
                                  </Text>
                                </TouchableOpacity>
                                <TextInput
                                  style={styles.descuentoInput}
                                  value={producto.valor_descuento}
                                  onChangeText={(text) =>
                                    actualizarDescuentoProducto(
                                      producto.id,
                                      "valor_descuento",
                                      text,
                                    )
                                  }
                                  placeholder="0"
                                  keyboardType="numeric"
                                />
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.quitarProductoButton}
                              onPress={() =>
                                toggleProductoSeleccionado(producto)
                              }
                            >
                              <Ionicons
                                name="close-circle"
                                size={20}
                                color="#ef4444"
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.requiredNote}>
                  <Text style={styles.requiredNoteText}>
                    * Campos requeridos
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setModalOfertaVisible(false);
                      setOfertaMejoradaData({
                        nombre: "",
                        descripcion: "",
                        dias_ilimitados: false,
                        dias_validez: "7",
                        metodo_pago: "transferencia",
                        aplica_a_todos: true,
                        tipo_descuento_todos: "porcentaje",
                        valor_descuento_todos: "",
                      });
                      setProductosSeleccionados([]);
                      setMostrarSelectorProductos(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: "#06b6d4" }]}
                    onPress={crearOfertaMejorada}
                  >
                    <Text style={styles.saveButtonText}>Crear Oferta</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Productos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalSeleccionProductosVisible}
        onRequestClose={() => setModalSeleccionProductosVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Productos</Text>
              <TouchableOpacity
                onPress={() => setModalSeleccionProductosVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              {/* Barra de búsqueda */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#6b7280" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar productos por nombre..."
                  placeholderTextColor="#9ca3af"
                  value={busquedaProductos}
                  onChangeText={setBusquedaProductos}
                />
                {busquedaProductos.length > 0 && (
                  <TouchableOpacity onPress={() => setBusquedaProductos("")}>
                    <Ionicons name="close-circle" size={20} color="#6b7280" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Lista de productos */}
              <ScrollView style={styles.productosModalList}>
                {cargandoProductosModal ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                    <Text style={styles.loadingText}>
                      Cargando productos...
                    </Text>
                  </View>
                ) : productosFiltrados.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="cube-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>
                      {busquedaProductos
                        ? "No se encontraron productos"
                        : "No hay productos disponibles"}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {busquedaProductos
                        ? "Intenta con otro nombre"
                        : "No hay productos en la zona de venta"}
                    </Text>
                  </View>
                ) : (
                  productosFiltrados.map((producto) => {
                    const seleccionado = productosSeleccionadosModal.find(
                      (p) =>
                        p.nombre_normalizado === producto.nombre_normalizado,
                    );
                    return (
                      <TouchableOpacity
                        key={producto.nombre_normalizado}
                        style={[
                          styles.productoModalItem,
                          seleccionado && styles.productoModalItemSelected,
                        ]}
                        onPress={() => toggleProductoModal(producto)}
                      >
                        <View style={styles.productoModalInfo}>
                          <Text style={styles.productoModalNombre}>
                            {producto.nombre}
                          </Text>
                          <Text style={styles.productoModalCantidad}>
                            {producto.cantidad_total} disponibles
                            {producto.ids.length > 1 && (
                              <Text style={styles.productoModalVariants}>
                                {" "}
                                ({producto.ids.length} variantes)
                              </Text>
                            )}
                          </Text>
                        </View>
                        <Ionicons
                          name={
                            seleccionado
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={24}
                          color={seleccionado ? "#06b6d4" : "#6b7280"}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              {/* Botones de acción */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalSeleccionProductosVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: "#06b6d4" },
                    productosSeleccionadosModal.length === 0 &&
                      styles.saveButtonDisabled,
                  ]}
                  onPress={confirmarSeleccionProductos}
                  disabled={productosSeleccionadosModal.length === 0}
                >
                  <Text style={styles.saveButtonText}>
                    Confirmar ({productosSeleccionadosModal.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Entrada Directa al Punto */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEntradaDirectaVisible}
        onRequestClose={() => setModalEntradaDirectaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Entrada Directa - {puntoSeleccionado?.nombre}
              </Text>
              <TouchableOpacity
                onPress={() => setModalEntradaDirectaVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView}>
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>
                  Crea un producto nuevo directamente en la zona de venta. Los
                  productos existentes se muestran como plantilla para ahorrar
                  tiempo.
                </Text>

                {/* Búsqueda de productos */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color="#6b7280" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar producto existente..."
                    placeholderTextColor="#9ca3af"
                    value={busquedaProductoExistente}
                    onChangeText={setBusquedaProductoExistente}
                  />
                  {busquedaProductoExistente.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setBusquedaProductoExistente("")}
                    >
                      <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Lista de productos */}
                {cargandoProductosExistentes ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>
                      Cargando productos...
                    </Text>
                  </View>
                ) : productosExistentesFiltrados.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="cube-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>
                      {busquedaProductoExistente
                        ? "No se encontraron productos"
                        : "No hay productos disponibles"}
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.productosListContainer}>
                    {productosExistentesFiltrados
                      .slice(0, 5)
                      .map((producto: any) => (
                        <TouchableOpacity
                          key={producto.id}
                          style={styles.productoExistenteItem}
                          onPress={() => seleccionarProductoPlantilla(producto)}
                        >
                          <View style={styles.productoExistenteInfo}>
                            <Text style={styles.productoExistenteNombre}>
                              {producto.nombre}
                            </Text>
                            <Text style={styles.productoExistenteDetalles}>
                              {producto.categoria} • $
                              {producto.precio_coste.toFixed(2)}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color="#6b7280"
                          />
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                )}

                {/* Botón para crear desde cero */}
                <TouchableOpacity
                  style={styles.crearDesdeCeroButton}
                  onPress={limpiarPlantilla}
                >
                  <Ionicons name="add-circle-outline" size={20} color="white" />
                  <Text style={styles.crearDesdeCeroText}>
                    Crear producto desde cero
                  </Text>
                </TouchableOpacity>

                {/* Formulario de producto */}
                <View style={styles.formularioProducto}>
                  <Text style={styles.formSectionTitle}>
                    Datos del Producto
                  </Text>

                  <Text style={styles.inputLabel}>Nombre del Producto *</Text>
                  <TextInput
                    style={styles.input}
                    value={formNombre}
                    onChangeText={setFormNombre}
                    placeholder="Ej: Leche Entera"
                    placeholderTextColor="#9ca3af"
                  />

                  <Text style={styles.inputLabel}>Categoría *</Text>
                  <TextInput
                    style={styles.input}
                    value={formCategoria}
                    onChangeText={setFormCategoria}
                    placeholder="Ej: Lácteos"
                    placeholderTextColor="#9ca3af"
                  />

                  <Text style={styles.inputLabel}>Subcategoría (Opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={formSubcategoria}
                    onChangeText={setFormSubcategoria}
                    placeholder="Ej: Leche"
                    placeholderTextColor="#9ca3af"
                  />

                  <Text style={styles.inputLabel}>Precio de Coste *</Text>
                  <TextInput
                    style={styles.input}
                    value={formPrecioCoste}
                    onChangeText={actualizarPrecioVentaSugerido}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.inputLabel}>
                    Precio de Venta *
                    {formPrecioCoste && (
                      <Text style={styles.inputHelper}>
                        {" "}
                        (Máximo: $
                        {(parseFloat(formPrecioCoste) / 0.7).toFixed(2)})
                      </Text>
                    )}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={formPrecioVenta}
                    onChangeText={setFormPrecioVenta}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.inputLabel}>Cantidad *</Text>
                  <TextInput
                    style={styles.input}
                    value={formCantidad}
                    onChangeText={setFormCantidad}
                    placeholder={
                      formFormatoAlmacen && formUnidadesPorFormato
                        ? `Ej: 5 (${getFormatLabel(formFormatoAlmacen, true)} de ${formUnidadesPorFormato} unid. = ${parseInt(formCantidad || "0") * parseInt(formUnidadesPorFormato || "0")} unidades)`
                        : "0"
                    }
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                  {formFormatoAlmacen && formUnidadesPorFormato && (
                    <Text style={styles.inputHelper}>
                      {parseInt(formCantidad || "0") > 0
                        ? `${parseInt(formCantidad || "0")} ${getFormatLabel(formFormatoAlmacen, true)} × ${formUnidadesPorFormato} unidades = ${parseInt(formCantidad || "0") * parseInt(formUnidadesPorFormato)} unidades totales`
                        : `Ingrese cantidad de ${getFormatLabel(formFormatoAlmacen, true)} para calcular unidades totales`}
                    </Text>
                  )}

                  <Text style={styles.inputLabel}>Fecha de Caducidad *</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text
                      style={
                        formFechaCaducidad
                          ? styles.dateInputText
                          : styles.dateInputPlaceholder
                      }
                    >
                      {formFechaCaducidad || "Seleccionar fecha"}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#6b7280"
                    />
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>Formato de Almacen</Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 15,
                      },
                    ]}
                    onPress={() => setModalFormatoAlmacenamiento(true)}
                  >
                    <Text
                      style={
                        formFormatoAlmacen
                          ? styles.inputText
                          : styles.inputPlaceholder
                      }
                    >
                      {formFormatoAlmacen
                        ? getFormatLabel(formFormatoAlmacen, true)
                        : "Seleccionar formato"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#6b7280" />
                  </TouchableOpacity>

                  {formFormatoAlmacen && (
                    <Text style={styles.inputLabel}>
                      Unidades por {getFormatLabel(formFormatoAlmacen, false)}
                    </Text>
                  )}
                  {formFormatoAlmacen && (
                    <TextInput
                      style={styles.input}
                      value={formUnidadesPorFormato}
                      onChangeText={setFormUnidadesPorFormato}
                      placeholder="Ej: 24"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  )}

                  {showDatePicker && (
                    <DateTimePicker
                      value={
                        formFechaCaducidad
                          ? new Date(formFechaCaducidad)
                          : new Date()
                      }
                      mode="date"
                      display="spinner"
                      onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) {
                          // Formatear la fecha seleccionada por el usuario
                          const año = date.getFullYear();
                          const mes = String(date.getMonth() + 1).padStart(
                            2,
                            "0",
                          );
                          const día = String(date.getDate()).padStart(2, "0");
                          const formattedDate = `${año}-${mes}-${día}`;
                          setFormFechaCaducidad(formattedDate);
                        }
                      }}
                    />
                  )}
                </View>

                {/* Botones de acción */}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalEntradaDirectaVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      { backgroundColor: "#10b981" },
                      (!formNombre.trim() ||
                        !formCategoria.trim() ||
                        !formPrecioCoste ||
                        !formPrecioVenta ||
                        !formCantidad ||
                        !formFechaCaducidad) &&
                        styles.saveButtonDisabled,
                    ]}
                    onPress={crearProductoDirecto}
                    disabled={
                      !formNombre.trim() ||
                      !formCategoria.trim() ||
                      !formPrecioCoste ||
                      !formPrecioVenta ||
                      !formCantidad ||
                      !formFechaCaducidad
                    }
                  >
                    <Text style={styles.saveButtonText}>Crear y Agregar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Actividad Completa Paginada */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalActividadVisible}
        onRequestClose={() => setModalActividadVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Actividad Completa del Día</Text>
              <TouchableOpacity onPress={() => setModalActividadVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {cargandoActividadCompleta ? (
                <View style={styles.loadingActivityContainer}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.loadingActivityText}>
                    Cargando actividad...
                  </Text>
                </View>
              ) : actividadCompleta.length > 0 ? (
                <>
                  {actividadCompleta.map((actividad) => (
                    <View key={actividad.id} style={styles.activityItem}>
                      <View
                        style={[
                          styles.activityIcon,
                          { backgroundColor: `${actividad.color}20` },
                        ]}
                      >
                        <Ionicons
                          name={actividad.icono}
                          size={16}
                          color={actividad.color}
                        />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityText}>
                          {actividad.descripcion}
                        </Text>
                        <View style={styles.activityTimeContainer}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color="#9ca3af"
                          />
                          <Text style={styles.activityTime}>
                            {actividad.tiempo}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  {/* Paginación */}
                  {totalPaginas > 1 && (
                    <View style={styles.paginationContainer}>
                      <TouchableOpacity
                        style={[
                          styles.paginationButton,
                          paginaActual === 1 && styles.paginationButtonDisabled,
                        ]}
                        onPress={() => {
                          if (paginaActual > 1 && puntoSeleccionado) {
                            const nuevaPagina = paginaActual - 1;
                            setPaginaActual(nuevaPagina);
                            cargarActividadCompleta(
                              puntoSeleccionado.id,
                              nuevaPagina,
                            );
                          }
                        }}
                        disabled={paginaActual === 1}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={16}
                          color="#3b82f6"
                        />
                      </TouchableOpacity>

                      <Text style={styles.paginationText}>
                        Página {paginaActual} de {totalPaginas}
                      </Text>

                      <TouchableOpacity
                        style={[
                          styles.paginationButton,
                          paginaActual === totalPaginas &&
                            styles.paginationButtonDisabled,
                        ]}
                        onPress={() => {
                          if (
                            paginaActual < totalPaginas &&
                            puntoSeleccionado
                          ) {
                            const nuevaPagina = paginaActual + 1;
                            setPaginaActual(nuevaPagina);
                            cargarActividadCompleta(
                              puntoSeleccionado.id,
                              nuevaPagina,
                            );
                          }
                        }}
                        disabled={paginaActual === totalPaginas}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#3b82f6"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyActivityContainer}>
                  <Ionicons name="time-outline" size={32} color="#d1d5db" />
                  <Text style={styles.emptyActivityText}>
                    No hay actividad para mostrar
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Ofertas Activas */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalOfertasActivasVisible}
        onRequestClose={() => setModalOfertasActivasVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ofertas Activas</Text>
              <TouchableOpacity
                onPress={() => setModalOfertasActivasVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {cargandoOfertasActivas ? (
                <View style={styles.loadingActivityContainer}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.loadingActivityText}>
                    Cargando ofertas activas...
                  </Text>
                </View>
              ) : ofertasActivas.length > 0 ? (
                ofertasActivas.map((oferta) => (
                  <View key={oferta.id} style={styles.ofertaActivaCard}>
                    <View style={styles.ofertaActivaHeader}>
                      <Text style={styles.ofertaActivaNombre}>
                        {oferta.nombre}
                      </Text>
                      <View style={styles.ofertaActivaBadge}>
                        <Text style={styles.ofertaActivaBadgeText}>Activa</Text>
                      </View>
                    </View>

                    {oferta.descripcion && (
                      <Text style={styles.ofertaActivaDescripcion}>
                        {oferta.descripcion}
                      </Text>
                    )}

                    <View style={styles.ofertaActivaDetalles}>
                      <View style={styles.ofertaActivaDetalle}>
                        <Ionicons
                          name="pricetag-outline"
                          size={16}
                          color="#6b7280"
                        />
                        <Text style={styles.ofertaActivaDetalleText}>
                          {oferta.aplica_a_todos
                            ? "Todos los productos"
                            : `${oferta.productos?.length || 0} productos`}
                        </Text>
                      </View>

                      <View style={styles.ofertaActivaDetalle}>
                        <Ionicons
                          name="card-outline"
                          size={16}
                          color="#6b7280"
                        />
                        <Text style={styles.ofertaActivaDetalleText}>
                          {oferta.metodo_pago === "todos"
                            ? "Todos los métodos"
                            : oferta.metodo_pago === "efectivo"
                              ? "Efectivo"
                              : "Transferencia"}
                        </Text>
                      </View>

                      <View style={styles.ofertaActivaDetalle}>
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color="#6b7280"
                        />
                        <Text style={styles.ofertaActivaDetalleText}>
                          {oferta.dias_ilimitados
                            ? "Vigencia ilimitada"
                            : `Válida por ${oferta.dias_validez} días`}
                        </Text>
                      </View>

                      <View style={styles.ofertaActivaDetalle}>
                        <Ionicons
                          name="gift-outline"
                          size={16}
                          color="#06b6d4"
                        />
                        <Text style={styles.ofertaActivaDescuentoText}>
                          {oferta.aplica_a_todos
                            ? oferta.tipo_descuento_todos === "porcentaje"
                              ? `${oferta.valor_descuento_todos || 0}% de descuento`
                              : `$${(oferta.valor_descuento_todos || 0).toFixed(2)} de descuento`
                            : oferta.productos && oferta.productos.length > 0
                              ? `${
                                  oferta.productos[0].tipo_descuento ===
                                  "porcentaje"
                                    ? oferta.productos[0].valor_descuento + "%"
                                    : "$" +
                                      oferta.productos[0].valor_descuento.toFixed(
                                        2,
                                      )
                                } de descuento`
                              : "Descuento variable"}
                        </Text>
                      </View>
                    </View>

                    {!oferta.aplica_a_todos &&
                      oferta.productos &&
                      oferta.productos.length > 0 && (
                        <View style={styles.ofertaActivaProductos}>
                          <Text style={styles.ofertaActivaProductosTitle}>
                            Productos:
                          </Text>
                          {oferta.productos.map((producto: any) => (
                            <View
                              key={producto.producto_id}
                              style={styles.ofertaActivaProductoContainer}
                            >
                              <Text style={styles.ofertaActivaProductoItem}>
                                • {producto.producto_nombre}
                              </Text>
                              <View style={styles.ofertaActivaProductoInfo}>
                                <Text style={styles.ofertaActivaProductoStock}>
                                  Stock: {producto.stock_en_punto || 0}
                                </Text>
                                <Text
                                  style={styles.ofertaActivaProductoDescuento}
                                >
                                  {producto.tipo_descuento === "porcentaje"
                                    ? `-${producto.valor_descuento}%`
                                    : `-$${producto.valor_descuento.toFixed(2)}`}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyActivityContainer}>
                  <Ionicons name="gift-outline" size={32} color="#d1d5db" />
                  <Text style={styles.emptyActivityText}>
                    No hay ofertas activas
                  </Text>
                  <Text style={styles.emptyActivitySubtext}>
                    Crea una nueva oferta para verla aquí
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Formato */}
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
              <TouchableOpacity
                onPress={() => setModalFormatoAlmacenamiento(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
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
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    backgroundColor: "white",
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: "#111827",
  },
  filterContainer: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 0,
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  filterButtonActive: {
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  filterTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  ofertaInactiva: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  ofertaActivaText: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "600",
    marginBottom: 8,
  },
  puntosList: {
    padding: 20,
    paddingBottom: 100,
  },
  puntoItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  puntoItemSeleccionado: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
    shadowColor: "#3b82f6",
    shadowOpacity: 0.1,
  },
  puntoItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  puntoIconContainer: {
    marginRight: 12,
  },
  puntoInfo: {
    flex: 1,
  },
  puntoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  puntoTipo: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  puntoFecha: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  puntoActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoButton: {
    padding: 8,
    marginRight: 4,
  },
  menuButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
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
    marginTop: 16,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  limpiarBusquedaText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  modalPanelOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  panelContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  panelScrollView: {
    maxHeight: "100%",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  panelTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginLeft: 12,
  },
  panelSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 12,
    marginTop: 2,
  },
  closePanelButton: {
    padding: 8,
  },
  loadingStatsContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingStatsText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  modulosContainer: {
    marginBottom: 20,
  },
  moduloCard: {
    alignItems: "center",
    marginRight: 16,
    width: 80,
    position: "relative",
  },
  moduloIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  moduloBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
  },
  moduloBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  moduloLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    flex: 1,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  ofertaCard: {
    backgroundColor: "#f0f9ff",
    borderColor: "#06b6d4",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  ofertaValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0891b2",
    marginBottom: 4,
  },
  ofertaDescripcion: {
    fontSize: 11,
    color: "#0891b2",
    marginBottom: 8,
    lineHeight: 14,
  },
  statChangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statChange: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  activarOfertaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#06b6d4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  activarOfertaText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  desactivarOfertaBtn: {
    backgroundColor: "#fecaca",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  desactivarOfertaText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#6b7280",
  },
  detallesButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  detallesButtonText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
  },
  // Nuevos estilos para ventas por tipo de pago
  tipoPagoContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  tipoPagoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  tipoPagoStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  tipoPagoItem: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  tipoPagoLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  tipoPagoValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  // Nuevos estilos para productos vendidos
  productosVendidosContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  productosVendidosTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  productoVendidoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  productoVendidoInfo: {
    flex: 1,
  },
  productoVendidoNombre: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 2,
  },
  productoVendidoCantidad: {
    fontSize: 12,
    color: "#6b7280",
  },
  productoVendidoTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },
  // Estilos para actividad reciente
  activityContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  verTodoText: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "600",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  activityTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: "#9ca3af",
  },
  moreActivityButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 4,
  },
  moreActivityText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  // Estilos para actividad vacía
  emptyActivityContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyActivityText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  emptyActivitySubtext: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 16,
  },
  // Estilos para carga de actividad
  loadingActivityContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingActivityText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
  },
  additionalInfoContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  additionalInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "400",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
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
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  formScrollView: {
    maxHeight: "80%",
  },
  formContainer: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#111827",
    marginBottom: 20,
  },
  dateInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInputText: {
    fontSize: 16,
    color: "#111827",
  },
  dateInputPlaceholder: {
    fontSize: 16,
    color: "#9ca3af",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  radioContainer: {
    gap: 12,
    marginBottom: 24,
  },
  radioButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  radioButtonSmall: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  radioButtonSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  radioInfo: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 2,
  },
  radioLabelSmall: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  radioLabelSelected: {
    color: "#3b82f6",
  },
  radioDescription: {
    fontSize: 12,
    color: "#9ca3af",
  },
  requiredNote: {
    marginBottom: 20,
  },
  requiredNoteText: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  // Estilos nuevos para el modal de ofertas mejorado
  checkboxContainer: {
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  productosSelectorHeader: {
    marginBottom: 12,
  },
  selectProductosButton: {
    backgroundColor: "#06b6d4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  selectProductosText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  inputHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    marginBottom: 8,
  },
  productosList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 16,
  },
  productoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  productoItemSelected: {
    backgroundColor: "#f0f9ff",
  },
  productoInfo: {
    flex: 1,
  },
  productoNombre: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  productoCantidad: {
    fontSize: 12,
    color: "#6b7280",
  },
  seleccionadosContainer: {
    marginTop: 16,
  },
  productoSeleccionadoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  productoSeleccionadoInfo: {
    flex: 1,
  },
  productoSeleccionadoNombre: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  descuentoInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  descuentoTipoButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  descuentoTipoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  descuentoTipoSelected: {
    backgroundColor: "#06b6d4",
    color: "white",
  },
  descuentoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  quitarProductoButton: {
    padding: 4,
  },
  // Estilos para el modal de selección de productos
  productosModalList: {
    maxHeight: 400,
    marginVertical: 16,
  },
  productoModalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  productoModalItemSelected: {
    backgroundColor: "#f0f9ff",
    borderColor: "#06b6d4",
  },
  productoModalInfo: {
    flex: 1,
  },
  productoModalNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  productoModalCantidad: {
    fontSize: 14,
    color: "#6b7280",
  },
  productoModalVariants: {
    fontSize: 12,
    color: "#06b6d4",
    fontStyle: "italic",
  },
  saveButtonDisabled: {
    backgroundColor: "#d1d5db",
    opacity: 0.6,
  },
  // Estilos para el modal de entrada directa
  entradaDirectaButton: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  entradaDirectaText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  inputSubtext: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 16,
    fontStyle: "italic",
  },
  productosListContainer: {
    maxHeight: 200,
    marginVertical: 16,
  },
  productoExistenteItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  productoExistenteInfo: {
    flex: 1,
  },
  productoExistenteNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  productoExistenteDetalles: {
    fontSize: 14,
    color: "#6b7280",
  },
  noProductosText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    fontStyle: "italic",
    marginVertical: 16,
  },
  crearDesdeCeroButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10b981",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  crearDesdeCeroText: {
    fontSize: 14,
    color: "white",
    fontWeight: "600",
  },
  pickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 6,
    marginTop: 8,
    marginBottom: 16,
    gap: 4,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center",
  },
  pickerOptionSelected: {
    backgroundColor: "#3b82f6",
  },
  pickerOptionText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
  formularioProducto: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  inputLabelSmall: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  inputSmall: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    marginLeft: 8,
    textAlign: "right",
  },
  inputHelper: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "normal",
    fontStyle: "italic",
    marginTop: 4,
    marginBottom: 8,
  },
  // Estilos para modal de actividad paginada
  modalContentLarge: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "90%",
    maxWidth: 500,
    maxHeight: "80%",
    marginHorizontal: 20,
  },
  modalScrollView: {
    maxHeight: 400,
    paddingHorizontal: 16,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: 16,
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  // Estilos para el modal de ofertas activas
  ofertaActivaCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#06b6d4",
  },
  ofertaActivaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ofertaActivaNombre: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  ofertaActivaBadge: {
    backgroundColor: "#06b6d4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ofertaActivaBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  ofertaActivaDescripcion: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
    lineHeight: 20,
  },
  ofertaActivaDetalles: {
    gap: 8,
  },
  ofertaActivaDetalle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ofertaActivaDetalleText: {
    fontSize: 13,
    color: "#6b7280",
    flex: 1,
  },
  ofertaActivaDescuentoText: {
    fontSize: 13,
    color: "#06b6d4",
    fontWeight: "600",
    flex: 1,
  },
  ofertaActivaProductos: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  ofertaActivaProductosTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  ofertaActivaProductoItem: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
    paddingLeft: 8,
  },
  ofertaActivaProductoContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#06b6d4",
  },
  ofertaActivaProductoInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  ofertaActivaProductoStock: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ofertaActivaProductoDescuento: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Estilos para el modal de selección de formato
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  almacenSelectModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "90%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  almacenSelectTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  almacenSelectList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  zonaOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  zonaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
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
    color: "#111827",
    marginBottom: 4,
  },
  zonaDescription: {
    fontSize: 14,
    color: "#6b7280",
  },
  inputText: {
    fontSize: 16,
    color: "#111827",
  },
  inputPlaceholder: {
    fontSize: 16,
    color: "#9ca3af",
  },
});
