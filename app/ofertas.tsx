// app/ofertas.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { AuthService } from "../src/db/services/auth_service";
import { OfertaService } from "../src/db/services/oferta_service";

export default function OfertasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/ofertas", params);

  const puntoId = parseInt((params.puntoId as string) || "0");
  const puntoNombre = (params.puntoNombre as string) || "Punto";

  // Estados de autenticación
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    "todos" | "activas" | "inactivas"
  >("todos");

  // Estados para modales
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [ofertaEnEdicion, setOfertaEnEdicion] = useState<any>(null);

  // Formulario
  const [ofertaMejoradaData, setOfertaMejoradaData] = useState({
    nombre: "",
    descripcion: "",
    dias_ilimitados: false,
    usar_dias_validez: false,
    dias_validez: "5",
    metodo_pago: "transferencia" as "transferencia" | "efectivo" | "todos",
    aplica_a_todos: true,
    tipo_descuento_todos: "porcentaje",
    valor_descuento_todos: "",
    // Nuevos campos para rango y repetición
    usar_rango_dias: false,
    dia_inicio: "",
    dia_fin: "",
    repetir: false,
    // Nuevos campos para calendario
    usar_calendario: false,
    fecha_inicio: "",
    fecha_fin: "",
    // Nuevo campo para días limitados
    dias_limitados: false,
  });

  // Estados para modales de calendario
  const [mostrarCalendarioInicio, setMostrarCalendarioInicio] = useState(false);
  const [mostrarCalendarioFin, setMostrarCalendarioFin] = useState(false);

  // Estados para fechas del calendario nativo
  const [fechaInicioSeleccionada, setFechaInicioSeleccionada] = useState(
    new Date(),
  );
  const [fechaFinSeleccionada, setFechaFinSeleccionada] = useState(new Date());

  // Estados para el calendario personalizado
  const [mesActualInicio, setMesActualInicio] = useState(new Date());
  const [mesActualFin, setMesActualFin] = useState(new Date());

  // Opciones de días de la semana
  const diasSemana = [
    { value: "lunes", label: "Lunes" },
    { value: "martes", label: "Martes" },
    { value: "miércoles", label: "Miércoles" },
    { value: "jueves", label: "Jueves" },
    { value: "viernes", label: "Viernes" },
    { value: "sábado", label: "Sábado" },
    { value: "domingo", label: "Domingo" },
  ];

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

  // Funciones para manejar fechas
  const formatearFecha = (fecha: Date | string) => {
    if (!fecha) return "";
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatearFechaParaDB = (fecha: Date) => {
    return getFechaLocal(); // YYYY-MM-DD local
  };

  const abrirCalendarioInicio = () => {
    // Si ya hay una fecha seleccionada, usarla, si no, usar hoy
    const fecha = ofertaMejoradaData.fecha_inicio
      ? new Date(ofertaMejoradaData.fecha_inicio)
      : new Date();
    setFechaInicioSeleccionada(fecha);
    setMostrarCalendarioInicio(true);
  };

  const abrirCalendarioFin = () => {
    // Si ya hay una fecha seleccionada, usarla, si no, usar hoy
    const fecha = ofertaMejoradaData.fecha_fin
      ? new Date(ofertaMejoradaData.fecha_fin)
      : new Date();
    setFechaFinSeleccionada(fecha);
    setMostrarCalendarioFin(true);
  };

  const seleccionarFechaInicio = () => {
    const fechaFormateada = formatearFechaParaDB(fechaInicioSeleccionada);
    setOfertaMejoradaData({
      ...ofertaMejoradaData,
      fecha_inicio: fechaFormateada,
    });
    setMostrarCalendarioInicio(false);
  };

  const seleccionarFechaFin = () => {
    const fechaFormateada = formatearFechaParaDB(fechaFinSeleccionada);
    setOfertaMejoradaData({
      ...ofertaMejoradaData,
      fecha_fin: fechaFormateada,
    });
    setMostrarCalendarioFin(false);
  };

  // Funciones para el calendario personalizado
  const generarDiasMes = (fecha: Date) => {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasMes = [];

    // Agregar días vacíos al inicio
    for (let i = 0; i < primerDia.getDay(); i++) {
      diasMes.push(null);
    }

    // Agregar todos los días del mes
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      diasMes.push(new Date(año, mes, dia));
    }

    return diasMes;
  };

  const cambiarMes = (fecha: Date, incrementar: boolean, esInicio: boolean) => {
    const nuevaFecha = new Date(fecha);
    nuevaFecha.setMonth(nuevaFecha.getMonth() + (incrementar ? 1 : -1));
    if (esInicio) {
      setMesActualInicio(nuevaFecha);
    } else {
      setMesActualFin(nuevaFecha);
    }
  };

  const seleccionarDia = (dia: Date, esInicio: boolean) => {
    if (esInicio) {
      setFechaInicioSeleccionada(dia);
    } else {
      setFechaFinSeleccionada(dia);
    }
  };

  const [productosSeleccionados, setProductosSeleccionados] = useState<any[]>(
    [],
  );
  const [mostrarSelectorProductos, setMostrarSelectorProductos] =
    useState(false);
  const [mostrarModalSelectorProductos, setMostrarModalSelectorProductos] =
    useState(false);

  // Filtrar ofertas según búsqueda y estado
  const ofertasFiltradas = ofertas.filter((oferta) => {
    const coincideBusqueda =
      (oferta.nombre &&
        oferta.nombre.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (oferta.descripcion &&
        oferta.descripcion.toLowerCase().includes(searchQuery.toLowerCase()));

    const coincideEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "activas" && oferta.activa) ||
      (filtroEstado === "inactivas" && !oferta.activa);

    return coincideBusqueda && coincideEstado;
  });

  const cargarDatos = useCallback(async () => {
    try {
      console.log(" Iniciando carga de datos para puntoId:", puntoId);

      const [ofertasData, productosData] = await Promise.all([
        OfertaService.getOfertasByPunto(puntoId),
        OfertaService.getProductosDisponibles(puntoId),
      ]);

      console.log(
        " Datos recibidos - Ofertas:",
        ofertasData.length,
        "Productos:",
        productosData.length,
      );

      setOfertas(ofertasData);
      setProductos(productosData);
    } catch (error) {
      console.error("Error cargando datos:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    }
  }, [puntoId]);

  // Cargar datos iniciales
  useEffect(() => {
    const inicializar = async () => {
      if (isAuthenticated) {
        // Inicializar tablas de ofertas primero
        OfertaService.initializeTables()
          .then(() => {
            console.log(" Tablas de ofertas inicializadas");
            cargarDatos();
          })
          .catch((error) => {
            console.error("Error inicializando tablas:", error);
            cargarDatos(); // Intentar cargar datos de todas formas
          });
      }
    };
    inicializar();
  }, [isAuthenticated, cargarDatos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarDatos();
    setRefreshing(false);
  };

  // Crear oferta mejorada - Versión simplificada y robusta
  const crearOfertaMejorada = async () => {
    if (!ofertaMejoradaData.nombre.trim()) {
      Alert.alert("Error", "El nombre de la oferta es requerido");
      return;
    }

    // Validar que si usa calendario, tenga fecha de inicio y fin
    if (
      ofertaMejoradaData.usar_calendario &&
      (!ofertaMejoradaData.fecha_inicio || !ofertaMejoradaData.fecha_fin)
    ) {
      Alert.alert(
        "Error",
        "Debe seleccionar fecha de inicio y fin para el calendario",
      );
      return;
    }

    // Validar que si usa rango de días, tenga día de inicio y fin
    if (
      ofertaMejoradaData.usar_rango_dias &&
      (!ofertaMejoradaData.dia_inicio || !ofertaMejoradaData.dia_fin)
    ) {
      Alert.alert(
        "Error",
        "Debe seleccionar día de inicio y fin para el rango",
      );
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
      console.log("🔧 Creando oferta:", {
        ...ofertaMejoradaData,
        productos: productosSeleccionados.map((p) => ({
          id: p.id,
          nombre: p.nombre,
        })),
      });

      const ofertaData = {
        punto_id: puntoId,
        nombre: ofertaMejoradaData.nombre,
        descripcion: ofertaMejoradaData.descripcion,
        // Solo una opción de validez debe estar activa
        dias_ilimitados: ofertaMejoradaData.dias_ilimitados,
        usar_calendario: ofertaMejoradaData.dias_ilimitados
          ? null
          : ofertaMejoradaData.usar_calendario
            ? true
            : null,
        dias_limitados: ofertaMejoradaData.dias_ilimitados
          ? null
          : ofertaMejoradaData.dias_limitados
            ? true
            : null,
        dias_validez: ofertaMejoradaData.dias_limitados
          ? parseInt(ofertaMejoradaData.dias_validez)
          : null,
        // Campos de calendario - solo si usar_calendario es true
        fecha_inicio:
          ofertaMejoradaData.usar_calendario && ofertaMejoradaData.fecha_inicio
            ? ofertaMejoradaData.fecha_inicio
            : null,
        fecha_fin:
          ofertaMejoradaData.usar_calendario && ofertaMejoradaData.fecha_fin
            ? ofertaMejoradaData.fecha_fin
            : null,
        // Campos de rango de días - independientes de días ilimitados
        usar_rango_dias: ofertaMejoradaData.usar_rango_dias ? true : false,
        dia_inicio: ofertaMejoradaData.usar_rango_dias
          ? ofertaMejoradaData.dia_inicio
          : null,
        dia_fin: ofertaMejoradaData.usar_rango_dias
          ? ofertaMejoradaData.dia_fin
          : null,
        repetir: ofertaMejoradaData.usar_rango_dias
          ? ofertaMejoradaData.repetir
          : false,
        // Campos restantes
        metodo_pago: ofertaMejoradaData.metodo_pago,
        aplica_a_todos: ofertaMejoradaData.aplica_a_todos,
        productos: !ofertaMejoradaData.aplica_a_todos
          ? productosSeleccionados.map((p) => {
              console.log(`🔍 Producto seleccionado para oferta:`, {
                id: p.id,
                nombre: p.nombre,
                tipo_descuento: p.tipo_descuento || "porcentaje",
                valor_descuento: parseFloat(p.valor_descuento) || 5,
              });
              return {
                producto_id: p.id,
                tipo_descuento: p.tipo_descuento || "porcentaje",
                valor_descuento: parseFloat(p.valor_descuento) || 5,
              };
            })
          : [],
        tipo_descuento_todos: ofertaMejoradaData.aplica_a_todos
          ? (ofertaMejoradaData.tipo_descuento_todos as "porcentaje" | "valor")
          : undefined,
        valor_descuento_todos: ofertaMejoradaData.aplica_a_todos
          ? ofertaMejoradaData.valor_descuento_todos &&
            ofertaMejoradaData.valor_descuento_todos.trim() !== ""
            ? parseFloat(ofertaMejoradaData.valor_descuento_todos)
            : 5
          : undefined,
      };

      console.log("🔍 Datos que se enviarán a crearOferta:", ofertaData);
      console.log(
        "🔍 Estado original de ofertaMejoradaData:",
        ofertaMejoradaData,
      );
      console.log("🔍 Productos seleccionados:", productosSeleccionados);

      await OfertaService.crearOferta(ofertaData);

      // Cerrar modal y limpiar formulario
      setMostrarModalCrear(false);
      setOfertaMejoradaData({
        nombre: "",
        descripcion: "",
        dias_ilimitados: false,
        usar_dias_validez: false,
        dias_validez: "5",
        metodo_pago: "transferencia",
        aplica_a_todos: true,
        tipo_descuento_todos: "porcentaje",
        valor_descuento_todos: "",
        usar_rango_dias: false,
        dia_inicio: "",
        dia_fin: "",
        repetir: false,
        usar_calendario: false,
        fecha_inicio: "",
        fecha_fin: "",
        dias_limitados: false,
      });
      setProductosSeleccionados([]);
      setMostrarSelectorProductos(false);

      Alert.alert("Éxito", "Oferta creada correctamente");
      await cargarDatos();
    } catch (error) {
      console.error("Error creando oferta mejorada:", error);
      Alert.alert("Error", "No se pudo crear la oferta");
    }
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

  // Activar/Desactivar oferta
  const toggleActivaOferta = async (oferta: any) => {
    try {
      console.log("🔄 Botón presionado para oferta:", {
        id: oferta.id,
        estado_actual: oferta.activa,
        nuevo_estado: !oferta.activa,
      });

      const nuevoEstado = !oferta.activa;
      await OfertaService.toggleActiva(oferta.id, nuevoEstado);

      Alert.alert(
        "Éxito",
        `Oferta ${nuevoEstado ? "activada" : "desactivada"} correctamente`,
      );
      await cargarDatos();
    } catch (error) {
      console.error("Error cambiando estado de oferta:", error);
      Alert.alert("Error", "No se pudo cambiar el estado de la oferta");
    }
  };

  // Eliminar oferta
  const eliminarOferta = async (ofertaId: number) => {
    Alert.alert("Eliminar Oferta", "¿Estás seguro de eliminar esta oferta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await OfertaService.eliminarOferta(ofertaId);
            Alert.alert("Éxito", "Oferta eliminada");
            await cargarDatos();
          } catch (err) {
            console.error("Error al eliminar oferta:", err);
            Alert.alert("Error", "No se pudo eliminar la oferta");
          }
        },
      },
    ]);
  };

  // Preparar edición de oferta
  const prepararEdicionOferta = async (oferta: any) => {
    try {
      console.log("🔧 Preparando edición para oferta:", oferta);

      // Cargar oferta completa con sus productos
      const ofertaCompleta = await OfertaService.getOfertaById(oferta.id);

      if (!ofertaCompleta) {
        Alert.alert("Error", "No se pudo cargar la oferta para editar");
        return;
      }

      setOfertaEnEdicion(ofertaCompleta);
      setOfertaMejoradaData({
        nombre: ofertaCompleta.nombre || "",
        descripcion: ofertaCompleta.descripcion || "",
        dias_ilimitados: ofertaCompleta.dias_ilimitados || false,
        usar_dias_validez: !!ofertaCompleta.dias_validez,
        dias_validez: ofertaCompleta.dias_validez?.toString() || "7",
        metodo_pago: ofertaCompleta.metodo_pago || "transferencia",
        aplica_a_todos: ofertaCompleta.aplica_a_todos || true,
        tipo_descuento_todos:
          ofertaCompleta.tipo_descuento_todos || "porcentaje",
        valor_descuento_todos:
          ofertaCompleta.valor_descuento_todos?.toString() || "",
        // Nuevos campos
        usar_rango_dias: !!(
          ofertaCompleta.dia_inicio && ofertaCompleta.dia_fin
        ),
        dia_inicio: ofertaCompleta.dia_inicio || "",
        dia_fin: ofertaCompleta.dia_fin || "",
        repetir: ofertaCompleta.repetir || false,
        // Nuevos campos de calendario - solo activar si realmente hay fechas Y no es días ilimitados
        usar_calendario: !!(
          !ofertaCompleta.dias_ilimitados &&
          ofertaCompleta.fecha_inicio &&
          ofertaCompleta.fecha_fin &&
          ofertaCompleta.fecha_inicio !== "" &&
          ofertaCompleta.fecha_fin !== "" &&
          ofertaCompleta.fecha_inicio !== "1970-01-01" &&
          ofertaCompleta.fecha_fin !== "2099-12-31"
        ),
        fecha_inicio: ofertaCompleta.fecha_inicio || "",
        fecha_fin: ofertaCompleta.fecha_fin || "",
        dias_limitados:
          !ofertaCompleta.dias_ilimitados &&
          !ofertaCompleta.usar_calendario &&
          !!ofertaCompleta.dias_validez,
      });

      // Mapear productos para que tengan la estructura correcta para el modal
      const productosMapeados = (ofertaCompleta.productos || []).map(
        (producto) => ({
          id: producto.producto_id,
          nombre: producto.producto_nombre,
          tipo_descuento: producto.tipo_descuento,
          valor_descuento: producto.valor_descuento.toString(),
        }),
      );

      setProductosSeleccionados(productosMapeados);
      setMostrarModalEditar(true);
    } catch (error) {
      console.error("Error preparando edición:", error);
      Alert.alert("Error", "No se pudo preparar la edición");
    }
  };

  // Editar oferta
  const editarOferta = async () => {
    if (!ofertaEnEdicion) {
      Alert.alert("Error", "No hay oferta en edición");
      return;
    }

    if (!ofertaMejoradaData.nombre.trim()) {
      Alert.alert("Error", "El nombre de la oferta es requerido");
      return;
    }

    // Validar que si usa calendario, tenga fecha de inicio y fin
    if (
      ofertaMejoradaData.usar_calendario &&
      (!ofertaMejoradaData.fecha_inicio || !ofertaMejoradaData.fecha_fin)
    ) {
      Alert.alert(
        "Error",
        "Debe seleccionar fecha de inicio y fin para el calendario",
      );
      return;
    }

    // Validar que si usa rango de días, tenga día de inicio y fin
    if (
      ofertaMejoradaData.usar_rango_dias &&
      (!ofertaMejoradaData.dia_inicio || !ofertaMejoradaData.dia_fin)
    ) {
      Alert.alert(
        "Error",
        "Debe seleccionar día de inicio y fin para el rango",
      );
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
      // Primero actualizar la oferta principal
      await OfertaService.actualizarOferta(ofertaEnEdicion.id, {
        nombre: ofertaMejoradaData.nombre,
        descripcion: ofertaMejoradaData.descripcion,
        // Solo una opción de validez debe estar activa
        dias_ilimitados: ofertaMejoradaData.dias_ilimitados,
        usar_calendario: ofertaMejoradaData.dias_ilimitados
          ? null
          : ofertaMejoradaData.usar_calendario
            ? true
            : null,
        dias_limitados: ofertaMejoradaData.dias_ilimitados
          ? null
          : ofertaMejoradaData.dias_limitados
            ? true
            : null,
        dias_validez: ofertaMejoradaData.dias_limitados
          ? parseInt(ofertaMejoradaData.dias_validez)
          : null,
        // Campos de calendario - solo si usar_calendario es true
        fecha_inicio:
          ofertaMejoradaData.usar_calendario && ofertaMejoradaData.fecha_inicio
            ? ofertaMejoradaData.fecha_inicio
            : null,
        fecha_fin:
          ofertaMejoradaData.usar_calendario && ofertaMejoradaData.fecha_fin
            ? ofertaMejoradaData.fecha_fin
            : null,
        // Campos de rango de días - independientes de días ilimitados
        usar_rango_dias: ofertaMejoradaData.usar_rango_dias ? true : false,
        dia_inicio: ofertaMejoradaData.usar_rango_dias
          ? ofertaMejoradaData.dia_inicio
          : null,
        dia_fin: ofertaMejoradaData.usar_rango_dias
          ? ofertaMejoradaData.dia_fin
          : null,
        repetir: ofertaMejoradaData.usar_rango_dias
          ? ofertaMejoradaData.repetir
          : false,
        // Campos restantes
        metodo_pago: ofertaMejoradaData.metodo_pago,
        aplica_a_todos: ofertaMejoradaData.aplica_a_todos,
      });

      // Si aplica a todos, también actualizar los campos de descuento
      if (ofertaMejoradaData.aplica_a_todos) {
        await OfertaService.actualizarOferta(ofertaEnEdicion.id, {
          tipo_descuento_todos: ofertaMejoradaData.tipo_descuento_todos as
            | "porcentaje"
            | "valor",
          valor_descuento_todos: ofertaMejoradaData.valor_descuento_todos
            ? parseFloat(ofertaMejoradaData.valor_descuento_todos)
            : undefined,
        });
      }

      // Luego actualizar los productos específicos
      if (!ofertaMejoradaData.aplica_a_todos) {
        await OfertaService.actualizarProductosOferta(
          ofertaEnEdicion.id,
          productosSeleccionados.map((p) => ({
            producto_id: p.id,
            tipo_descuento: p.tipo_descuento || "porcentaje",
            valor_descuento: parseFloat(p.valor_descuento) || 5,
          })),
        );
      }

      // Cerrar modal y limpiar formulario
      setMostrarModalEditar(false);
      setOfertaEnEdicion(null);
      setOfertaMejoradaData({
        nombre: "",
        descripcion: "",
        dias_ilimitados: false,
        usar_dias_validez: false,
        dias_validez: "5",
        metodo_pago: "transferencia",
        aplica_a_todos: true,
        tipo_descuento_todos: "porcentaje",
        valor_descuento_todos: "",
        usar_rango_dias: false,
        dia_inicio: "",
        dia_fin: "",
        repetir: false,
        usar_calendario: false,
        fecha_inicio: "",
        fecha_fin: "",
        dias_limitados: false,
      });
      setProductosSeleccionados([]);
      setMostrarSelectorProductos(false);

      Alert.alert("Éxito", "Oferta actualizada correctamente");
      await cargarDatos();
    } catch (error) {
      console.error("Error editando oferta:", error);
      Alert.alert("Error", "No se pudo actualizar la oferta");
    }
  };

  const renderOfertaItem = ({ item }: { item: any }) => (
    <View style={styles.ofertaItem}>
      <View style={styles.ofertaHeader}>
        <View style={styles.ofertaInfo}>
          <Text style={styles.ofertaNombre}>{item.nombre}</Text>
          <Text style={styles.ofertaDescripcion}>
            {item.descripcion || "Sin descripción"}
          </Text>

          {/* Mostrar información de validez */}
          <View style={styles.ofertaMeta}>
            <Text style={styles.ofertaFecha}>
              {item.dias_ilimitados
                ? "Vigencia: Ilimitada"
                : item.usar_dias_validez
                  ? `Vigencia: ${item.dias_validez || 5} días`
                  : item.dias_validez
                    ? `Vigencia: ${item.dias_validez} días`
                    : "Vigencia: No especificada"}
            </Text>

            {/* Mostrar rango de fechas si aplica */}
            {item.usar_calendario && item.fecha_inicio && item.fecha_fin && (
              <Text style={styles.ofertaFecha}>
                📅 {formatearFecha(item.fecha_inicio)} al{" "}
                {formatearFecha(item.fecha_fin)}
              </Text>
            )}

            {/* Mostrar programación de días si aplica */}
            {item.usar_rango_dias && item.dia_inicio && item.dia_fin && (
              <Text style={styles.ofertaFecha}>
                📅{" "}
                {diasSemana.find((d) => d.value === item.dia_inicio)?.label ||
                  item.dia_inicio}{" "}
                a{" "}
                {diasSemana.find((d) => d.value === item.dia_fin)?.label ||
                  item.dia_fin}
                {item.repetir ? <Text> (Repite semanalmente)</Text> : null}
              </Text>
            )}
          </View>
        </View>

        {/* Mostrar método de pago y estado */}
        <View style={styles.ofertaMeta}>
          <View
            style={[
              styles.estadoBadge,
              { backgroundColor: item.activa ? "#10b981" : "#ef4444" },
            ]}
          >
            <Text style={styles.estadoText}>
              {item.activa ? "Activa" : "Inactiva"}
            </Text>
          </View>
          <Text style={styles.ofertaMetodo}>
            {item.metodo_pago === "todos"
              ? "Todos los métodos"
              : item.metodo_pago === "efectivo"
                ? "Efectivo"
                : "Transferencia"}
          </Text>
        </View>
      </View>
      <View style={styles.ofertaActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleActivaOferta(item)}
        >
          <Ionicons
            name={item.activa ? "pause-circle" : "play-circle"}
            size={20}
            color={item.activa ? "#f59e0b" : "#10b981"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => prepararEdicionOferta(item)}
        >
          <Ionicons name="create-outline" size={20} color="#3b82f6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => eliminarOferta(item.id!)}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Mostrar información del descuento */}
      <View style={styles.descuentoInfo}>
        {item.aplica_a_todos ? (
          <View>
            <Text style={styles.aplicaTodos}>Aplica a todos los productos</Text>
            <Text style={styles.descuentoValor}>
              Descuento: {item.tipo_descuento_todos || "porcentaje"} -
              {item.tipo_descuento_todos === "porcentaje"
                ? `${item.valor_descuento_todos || 5}%`
                : `$${Math.abs(item.valor_descuento_todos || 5)}`}
            </Text>
          </View>
        ) : (
          <View style={styles.productosList}>
            <Text style={styles.productosTitle}>
              Productos con descuento ({item.productos?.length || 0}):
            </Text>
            {item.productos?.slice(0, 3).map((producto: any, index: number) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  backgroundColor: "#f9fafb",
                  borderRadius: 4,
                  marginBottom: 4,
                }}
              >
                <Text style={styles.productoItem}>
                  • {producto.producto_nombre || producto.nombre}
                </Text>
                <Text style={styles.productoDescuento}>
                  {producto.tipo_descuento === "porcentaje"
                    ? `${producto.valor_descuento}%`
                    : `-$${Math.abs(producto.valor_descuento)}`}
                </Text>
              </View>
            ))}
            {(item.productos?.length || 0) > 3 && (
              <Text style={styles.masProductos}>
                ...y {(item.productos?.length || 0) - 3} productos más
              </Text>
            )}
          </View>
        )}
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ofertas - {puntoNombre}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setMostrarModalCrear(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={ofertasFiltradas}
        renderItem={renderOfertaItem}
        keyExtractor={(item) => item.id!.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar ofertas..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filtroEstado === "todos" && styles.filterButtonActive,
                ]}
                onPress={() => setFiltroEstado("todos")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filtroEstado === "todos" && styles.filterButtonTextActive,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filtroEstado === "activas" && styles.filterButtonActive,
                ]}
                onPress={() => setFiltroEstado("activas")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filtroEstado === "activas" && styles.filterButtonTextActive,
                  ]}
                >
                  Activas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filtroEstado === "inactivas" && styles.filterButtonActive,
                ]}
                onPress={() => setFiltroEstado("inactivas")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filtroEstado === "inactivas" &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  Inactivas
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>
              {searchQuery || filtroEstado !== "todos"
                ? "No se encontraron ofertas"
                : "No hay ofertas"}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || filtroEstado !== "todos"
                ? "Intenta con otra búsqueda o filtro"
                : "Crea tu primera oferta"}
            </Text>
          </View>
        }
      />

      {/* Modal para Crear Oferta Mejorada - Copia exacta del que funciona en punto.tsx */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mostrarModalCrear}
        onRequestClose={() => setMostrarModalCrear(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nueva Oferta</Text>
              <TouchableOpacity onPress={() => setMostrarModalCrear(false)}>
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
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.dias_ilimitados &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        dias_ilimitados: true,
                        usar_calendario: false,
                        dias_limitados: false,
                        // Limpiar campos de otros modos de validez
                        fecha_inicio: "",
                        fecha_fin: "",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.dias_ilimitados &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Días ilimitados
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.usar_calendario &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        usar_calendario: true,
                        dias_ilimitados: false,
                        dias_limitados: false,
                        // Limpiar campos de otros modos de validez
                        fecha_inicio: "",
                        fecha_fin: "",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.usar_calendario &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Usar rango de fechas
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.dias_limitados &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        dias_limitados: true,
                        dias_ilimitados: false,
                        usar_calendario: false,
                        // Limpiar campos de otros modos de validez
                        fecha_inicio: "",
                        fecha_fin: "",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.dias_limitados &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Días limitados
                    </Text>
                  </TouchableOpacity>
                </View>

                {ofertaMejoradaData.dias_limitados && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.inputLabel}>Días de Validez *</Text>
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
                    <Text style={styles.inputHint}>
                      {ofertaMejoradaData.dias_validez
                        ? `La oferta estará vigente por ${ofertaMejoradaData.dias_validez} días`
                        : "Ingrese la cantidad de días de validez"}
                    </Text>
                  </View>
                )}

                {ofertaMejoradaData.usar_calendario && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.inputLabel}>Fecha de Inicio *</Text>
                    <TouchableOpacity
                      style={styles.fechaButton}
                      onPress={abrirCalendarioInicio}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#6b7280"
                      />
                      <Text style={styles.fechaButtonText}>
                        {ofertaMejoradaData.fecha_inicio
                          ? formatearFecha(ofertaMejoradaData.fecha_inicio)
                          : "Seleccionar fecha"}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.inputLabel}>Fecha de Fin *</Text>
                    <TouchableOpacity
                      style={styles.fechaButton}
                      onPress={abrirCalendarioFin}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#6b7280"
                      />
                      <Text style={styles.fechaButtonText}>
                        {ofertaMejoradaData.fecha_fin
                          ? formatearFecha(ofertaMejoradaData.fecha_fin)
                          : "Seleccionar fecha"}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.inputHint}>
                      {ofertaMejoradaData.fecha_inicio &&
                      ofertaMejoradaData.fecha_fin
                        ? `La oferta estará activa del ${formatearFecha(ofertaMejoradaData.fecha_inicio)} al ${formatearFecha(ofertaMejoradaData.fecha_fin)}`
                        : "Seleccione las fechas de inicio y fin"}
                    </Text>
                  </View>
                )}

                {/* Sección de Rango de Días y Repetición */}
                <Text style={styles.inputLabel}>Programación de Oferta</Text>
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        usar_rango_dias: !ofertaMejoradaData.usar_rango_dias,
                        // Si se desactiva, limpiar campos de rango
                        ...(ofertaMejoradaData.usar_rango_dias
                          ? {
                              dia_inicio: "",
                              dia_fin: "",
                              repetir: false,
                            }
                          : {}),
                      })
                    }
                  >
                    <Ionicons
                      name={
                        ofertaMejoradaData.usar_rango_dias
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={20}
                      color={
                        ofertaMejoradaData.usar_rango_dias
                          ? "#06b6d4"
                          : "#6b7280"
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Configurar rango de días
                    </Text>
                  </TouchableOpacity>
                </View>

                {ofertaMejoradaData.usar_rango_dias && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.inputLabel}>Día de Inicio *</Text>
                    <View style={styles.diasContainer}>
                      {diasSemana.map((dia) => (
                        <TouchableOpacity
                          key={dia.value}
                          style={[
                            styles.diaButton,
                            ofertaMejoradaData.dia_inicio === dia.value &&
                              styles.diaButtonSelected,
                          ]}
                          onPress={() =>
                            setOfertaMejoradaData({
                              ...ofertaMejoradaData,
                              dia_inicio: dia.value,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.diaButtonText,
                              ofertaMejoradaData.dia_inicio === dia.value &&
                                styles.diaButtonTextSelected,
                            ]}
                          >
                            {dia.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Día de Fin *</Text>
                    <View style={styles.diasContainer}>
                      {diasSemana.map((dia) => (
                        <TouchableOpacity
                          key={dia.value}
                          style={[
                            styles.diaButton,
                            ofertaMejoradaData.dia_fin === dia.value &&
                              styles.diaButtonSelected,
                          ]}
                          onPress={() =>
                            setOfertaMejoradaData({
                              ...ofertaMejoradaData,
                              dia_fin: dia.value,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.diaButtonText,
                              ofertaMejoradaData.dia_fin === dia.value &&
                                styles.diaButtonTextSelected,
                            ]}
                          >
                            {dia.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.checkboxContainer}>
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() =>
                          setOfertaMejoradaData({
                            ...ofertaMejoradaData,
                            repetir: !ofertaMejoradaData.repetir,
                          })
                        }
                      >
                        <Ionicons
                          name={
                            ofertaMejoradaData.repetir
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={20}
                          color={
                            ofertaMejoradaData.repetir ? "#06b6d4" : "#6b7280"
                          }
                        />
                        <Text style={styles.checkboxLabel}>
                          Repetir semanalmente
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputHint}>
                      {ofertaMejoradaData.dia_inicio &&
                      ofertaMejoradaData.dia_fin
                        ? `La oferta estará activa de ${diasSemana.find((d) => d.value === ofertaMejoradaData.dia_inicio)?.label || ofertaMejoradaData.dia_inicio} a ${diasSemana.find((d) => d.value === ofertaMejoradaData.dia_fin)?.label || ofertaMejoradaData.dia_fin}${ofertaMejoradaData.repetir ? " y se repetirá cada semana" : ""}`
                        : "Seleccione los días para activar la oferta"}
                    </Text>
                  </View>
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
                      onPress={() => setMostrarModalSelectorProductos(true)}
                    >
                      <Ionicons name="cube-outline" size={16} color="white" />
                      <Text style={styles.selectProductosText}>
                        Seleccionar Productos
                      </Text>
                    </TouchableOpacity>

                    {mostrarSelectorProductos && (
                      <View style={styles.productosSelectorList}>
                        {productos.length === 0 ? (
                          <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>
                              No hay productos disponibles
                            </Text>
                          </View>
                        ) : (
                          <>
                            {productos.map((producto: any) => {
                              const seleccionado = productosSeleccionados.find(
                                (p: any) => p.id === producto.id,
                              );
                              return (
                                <TouchableOpacity
                                  key={producto.id}
                                  style={[
                                    styles.productoSelectorItem,
                                    seleccionado &&
                                      styles.productoSelectorItemSelected,
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
                        {productosSeleccionados.map((producto: any) => (
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
                      setMostrarModalCrear(false);
                      setOfertaMejoradaData({
                        nombre: "",
                        descripcion: "",
                        dias_ilimitados: false,
                        usar_dias_validez: false,
                        dias_validez: "5",
                        metodo_pago: "transferencia",
                        aplica_a_todos: true,
                        tipo_descuento_todos: "porcentaje",
                        valor_descuento_todos: "",
                        usar_rango_dias: false,
                        dia_inicio: "",
                        dia_fin: "",
                        repetir: false,
                        usar_calendario: false,
                        fecha_inicio: "",
                        fecha_fin: "",
                        dias_limitados: false,
                      });
                      setProductosSeleccionados([]);
                      setMostrarSelectorProductos(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: "#10b981" }]}
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

      {/* Modal para Editar Oferta */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mostrarModalEditar}
        onRequestClose={() => setMostrarModalEditar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Actualizar Oferta</Text>
              <TouchableOpacity onPress={() => setMostrarModalEditar(false)}>
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
                      Todos los métodos
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Validez de la Oferta</Text>
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.dias_ilimitados &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        dias_ilimitados: true,
                        usar_calendario: false,
                        dias_limitados: false,
                        // Limpiar campos de otros modos de validez
                        fecha_inicio: "",
                        fecha_fin: "",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.dias_ilimitados &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Días ilimitados
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.usar_calendario &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        usar_calendario: true,
                        dias_ilimitados: false,
                        dias_limitados: false,
                        // Limpiar campos de otros modos de validez
                        fecha_inicio: "",
                        fecha_fin: "",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.usar_calendario &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Usar rango de fechas
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioButtonSmall,
                      ofertaMejoradaData.dias_limitados &&
                        styles.radioButtonSelected,
                    ]}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        dias_limitados: true,
                        dias_ilimitados: false,
                        usar_calendario: false,
                        // Limpiar campos de otros modos de validez
                        fecha_inicio: "",
                        fecha_fin: "",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.radioLabelSmall,
                        ofertaMejoradaData.dias_limitados &&
                          styles.radioLabelSelected,
                      ]}
                    >
                      Días limitados
                    </Text>
                  </TouchableOpacity>
                </View>

                {ofertaMejoradaData.dias_limitados && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.inputLabel}>Días de Validez *</Text>
                    <TextInput
                      style={styles.input}
                      value={ofertaMejoradaData.dias_validez}
                      onChangeText={(text) =>
                        setOfertaMejoradaData({
                          ...ofertaMejoradaData,
                          dias_validez: text,
                        })
                      }
                      placeholder="Ej: 5"
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputHint}>
                      La oferta estará activa durante esta cantidad de días
                      desde su creación
                    </Text>
                  </View>
                )}

                {ofertaMejoradaData.usar_calendario && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.inputLabel}>Fecha de Inicio *</Text>
                    <TouchableOpacity
                      style={styles.fechaButton}
                      onPress={abrirCalendarioInicio}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#6b7280"
                      />
                      <Text style={styles.fechaButtonText}>
                        {ofertaMejoradaData.fecha_inicio
                          ? formatearFecha(ofertaMejoradaData.fecha_inicio)
                          : "Seleccionar fecha"}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.inputLabel}>Fecha de Fin *</Text>
                    <TouchableOpacity
                      style={styles.fechaButton}
                      onPress={abrirCalendarioFin}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#6b7280"
                      />
                      <Text style={styles.fechaButtonText}>
                        {ofertaMejoradaData.fecha_fin
                          ? formatearFecha(ofertaMejoradaData.fecha_fin)
                          : "Seleccionar fecha"}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.inputHint}>
                      {ofertaMejoradaData.fecha_inicio &&
                      ofertaMejoradaData.fecha_fin
                        ? `La oferta estará activa del ${formatearFecha(ofertaMejoradaData.fecha_inicio)} al ${formatearFecha(ofertaMejoradaData.fecha_fin)}`
                        : "Seleccione las fechas de inicio y fin"}
                    </Text>
                  </View>
                )}

                {/* Sección de Programación de Oferta - Siempre visible */}
                <Text style={styles.inputLabel}>
                  Programación de Oferta (Opcional)
                </Text>
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() =>
                      setOfertaMejoradaData({
                        ...ofertaMejoradaData,
                        usar_rango_dias: !ofertaMejoradaData.usar_rango_dias,
                        // Si se desactiva, limpiar campos de rango
                        ...(ofertaMejoradaData.usar_rango_dias
                          ? {
                              dia_inicio: "",
                              dia_fin: "",
                              repetir: false,
                            }
                          : {}),
                      })
                    }
                  >
                    <Ionicons
                      name={
                        ofertaMejoradaData.usar_rango_dias
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={20}
                      color={
                        ofertaMejoradaData.usar_rango_dias
                          ? "#06b6d4"
                          : "#6b7280"
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Limitar a días específicos de la semana
                    </Text>
                  </TouchableOpacity>
                </View>

                {ofertaMejoradaData.usar_rango_dias && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.inputLabel}>Día de Inicio *</Text>
                    <View style={styles.diasContainer}>
                      {diasSemana.map((dia) => (
                        <TouchableOpacity
                          key={dia.value}
                          style={[
                            styles.diaButton,
                            ofertaMejoradaData.dia_inicio === dia.value &&
                              styles.diaButtonSelected,
                          ]}
                          onPress={() =>
                            setOfertaMejoradaData({
                              ...ofertaMejoradaData,
                              dia_inicio: dia.value,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.diaButtonText,
                              ofertaMejoradaData.dia_inicio === dia.value &&
                                styles.diaButtonTextSelected,
                            ]}
                          >
                            {dia.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Día de Fin *</Text>
                    <View style={styles.diasContainer}>
                      {diasSemana.map((dia) => (
                        <TouchableOpacity
                          key={dia.value}
                          style={[
                            styles.diaButton,
                            ofertaMejoradaData.dia_fin === dia.value &&
                              styles.diaButtonSelected,
                          ]}
                          onPress={() =>
                            setOfertaMejoradaData({
                              ...ofertaMejoradaData,
                              dia_fin: dia.value,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.diaButtonText,
                              ofertaMejoradaData.dia_fin === dia.value &&
                                styles.diaButtonTextSelected,
                            ]}
                          >
                            {dia.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.checkboxContainer}>
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() =>
                          setOfertaMejoradaData({
                            ...ofertaMejoradaData,
                            repetir: !ofertaMejoradaData.repetir,
                          })
                        }
                      >
                        <Ionicons
                          name={
                            ofertaMejoradaData.repetir
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={20}
                          color={
                            ofertaMejoradaData.repetir ? "#06b6d4" : "#6b7280"
                          }
                        />
                        <Text style={styles.checkboxLabel}>
                          Repetir semanalmente
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputHint}>
                      {ofertaMejoradaData.dia_inicio &&
                      ofertaMejoradaData.dia_fin
                        ? `La oferta estará activa solo de ${diasSemana.find((d) => d.value === ofertaMejoradaData.dia_inicio)?.label || ofertaMejoradaData.dia_inicio} a ${diasSemana.find((d) => d.value === ofertaMejoradaData.dia_fin)?.label || ofertaMejoradaData.dia_fin}${ofertaMejoradaData.repetir ? " y se repetirá cada semana" : ""}`
                        : "Seleccione los días de la semana para limitar la oferta"}
                    </Text>
                  </View>
                )}

                <Text
                  style={[
                    styles.inputHint,
                    { marginTop: 16, fontStyle: "italic" },
                  ]}
                >
                  💡 Puedes combinar estas opciones: Por ejemplo, una oferta
                  válida por 30 días, con rango de fechas específicas, y activa
                  solo los días lunes a miércoles.
                </Text>

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
                        Mismo descuento para todos los productos
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
                      name="cube-outline"
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
                      onPress={() => setMostrarModalSelectorProductos(true)}
                    >
                      <Ionicons name="cube-outline" size={16} color="white" />
                      <Text style={styles.selectProductosText}>
                        Seleccionar Productos
                      </Text>
                    </TouchableOpacity>

                    {mostrarSelectorProductos && (
                      <View style={styles.productosSelectorList}>
                        {productos.length === 0 ? (
                          <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>
                              No hay productos disponibles
                            </Text>
                          </View>
                        ) : (
                          <>
                            {productos.map((producto: any) => {
                              const seleccionado = productosSeleccionados.find(
                                (p: any) => p.id === producto.id,
                              );
                              return (
                                <TouchableOpacity
                                  key={producto.id}
                                  style={[
                                    styles.productoSelectorItem,
                                    seleccionado &&
                                      styles.productoSelectorItemSelected,
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
                        {productosSeleccionados.map((producto: any) => (
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
                      setMostrarModalEditar(false);
                      setOfertaEnEdicion(null);
                      setOfertaMejoradaData({
                        nombre: "",
                        descripcion: "",
                        dias_ilimitados: false,
                        usar_dias_validez: false,
                        dias_validez: "5",
                        metodo_pago: "transferencia",
                        aplica_a_todos: true,
                        tipo_descuento_todos: "porcentaje",
                        valor_descuento_todos: "",
                        usar_rango_dias: false,
                        dia_inicio: "",
                        dia_fin: "",
                        repetir: false,
                        usar_calendario: false,
                        fecha_inicio: "",
                        fecha_fin: "",
                        dias_limitados: false,
                      });
                      setProductosSeleccionados([]);
                      setMostrarSelectorProductos(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: "#f59e0b" }]}
                    onPress={editarOferta}
                  >
                    <Text style={styles.saveButtonText}>Actualizar Oferta</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Calendario Fecha Inicio */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mostrarCalendarioInicio}
        onRequestClose={() => setMostrarCalendarioInicio(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Fecha de Inicio</Text>
              <TouchableOpacity
                onPress={() => setMostrarCalendarioInicio(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarioContainer}>
              <Text style={styles.inputLabel}>
                Seleccione la fecha de inicio:
              </Text>

              {/* Navegación del mes */}
              <View style={styles.calendarioHeader}>
                <TouchableOpacity
                  style={styles.calendarioNavButton}
                  onPress={() => cambiarMes(mesActualInicio, false, true)}
                >
                  <Ionicons name="chevron-back" size={20} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.calendarioMes}>
                  {mesActualInicio.toLocaleDateString("es-ES", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <TouchableOpacity
                  style={styles.calendarioNavButton}
                  onPress={() => cambiarMes(mesActualInicio, true, true)}
                >
                  <Ionicons name="chevron-forward" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Días de la semana */}
              <View style={styles.calendarioDiasSemana}>
                {["D", "L", "M", "X", "J", "V", "S"].map((dia, index) => (
                  <Text key={index} style={styles.calendarioDiaSemana}>
                    {dia}
                  </Text>
                ))}
              </View>

              {/* Días del mes */}
              <View style={styles.calendarioDias}>
                {generarDiasMes(mesActualInicio).map((dia, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarioDia,
                      dia &&
                        dia.toDateString() ===
                          fechaInicioSeleccionada.toDateString() &&
                        styles.calendarioDiaSeleccionado,
                      !dia && styles.calendarioDiaVacio,
                    ]}
                    onPress={() => dia && seleccionarDia(dia, true)}
                    disabled={!dia}
                  >
                    <Text
                      style={[
                        styles.calendarioDiaTexto,
                        dia &&
                          dia.toDateString() ===
                            fechaInicioSeleccionada.toDateString() &&
                          styles.calendarioDiaTextoSeleccionado,
                      ]}
                    >
                      {dia ? dia.getDate() : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fechaSeleccionadaText}>
                Fecha seleccionada: {formatearFecha(fechaInicioSeleccionada)}
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setMostrarCalendarioInicio(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: "#06b6d4" }]}
                  onPress={seleccionarFechaInicio}
                >
                  <Text style={styles.saveButtonText}>Aceptar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Calendario Fecha Fin */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mostrarCalendarioFin}
        onRequestClose={() => setMostrarCalendarioFin(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Fecha de Fin</Text>
              <TouchableOpacity onPress={() => setMostrarCalendarioFin(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarioContainer}>
              <Text style={styles.inputLabel}>Seleccione la fecha de fin:</Text>

              {/* Navegación del mes */}
              <View style={styles.calendarioHeader}>
                <TouchableOpacity
                  style={styles.calendarioNavButton}
                  onPress={() => cambiarMes(mesActualFin, false, false)}
                >
                  <Ionicons name="chevron-back" size={20} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.calendarioMes}>
                  {mesActualFin.toLocaleDateString("es-ES", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <TouchableOpacity
                  style={styles.calendarioNavButton}
                  onPress={() => cambiarMes(mesActualFin, true, false)}
                >
                  <Ionicons name="chevron-forward" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Días de la semana */}
              <View style={styles.calendarioDiasSemana}>
                {["D", "L", "M", "X", "J", "V", "S"].map((dia, index) => (
                  <Text key={index} style={styles.calendarioDiaSemana}>
                    {dia}
                  </Text>
                ))}
              </View>

              {/* Días del mes */}
              <View style={styles.calendarioDias}>
                {generarDiasMes(mesActualFin).map((dia, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarioDia,
                      dia &&
                        dia.toDateString() ===
                          fechaFinSeleccionada.toDateString() &&
                        styles.calendarioDiaSeleccionado,
                      !dia && styles.calendarioDiaVacio,
                    ]}
                    onPress={() => dia && seleccionarDia(dia, false)}
                    disabled={!dia}
                  >
                    <Text
                      style={[
                        styles.calendarioDiaTexto,
                        dia &&
                          dia.toDateString() ===
                            fechaFinSeleccionada.toDateString() &&
                          styles.calendarioDiaTextoSeleccionado,
                      ]}
                    >
                      {dia ? dia.getDate() : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fechaSeleccionadaText}>
                Fecha seleccionada: {formatearFecha(fechaFinSeleccionada)}
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setMostrarCalendarioFin(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: "#06b6d4" }]}
                  onPress={seleccionarFechaFin}
                >
                  <Text style={styles.saveButtonText}>Aceptar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Seleccionar Productos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mostrarModalSelectorProductos}
        onRequestClose={() => setMostrarModalSelectorProductos(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Productos</Text>
              <TouchableOpacity
                onPress={() => setMostrarModalSelectorProductos(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView}>
              <View style={styles.formContainer}>
                {productos.length === 0 ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>
                      No hay productos disponibles
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>
                      Selecciona los productos para esta oferta:
                    </Text>
                    {productos.map((producto: any) => {
                      const seleccionado = productosSeleccionados.find(
                        (p: any) => p.id === producto.id,
                      );
                      return (
                        <View
                          key={producto.id}
                          style={styles.productoSelectorCard}
                        >
                          <View style={styles.productoCardHeader}>
                            <TouchableOpacity
                              style={[
                                styles.productoSelectorItem,
                                seleccionado &&
                                  styles.productoSelectorItemSelected,
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
                          </View>

                          {seleccionado && (
                            <View style={styles.descuentoConfig}>
                              <View style={styles.descuentoRow}>
                                <Text style={styles.inputLabel}>Tipo:</Text>
                                <View style={styles.tipoDescuentoButtons}>
                                  <TouchableOpacity
                                    style={[
                                      styles.tipoDescuentoButton,
                                      seleccionado.tipo_descuento ===
                                        "porcentaje" &&
                                        styles.tipoDescuentoButtonActive,
                                    ]}
                                    onPress={() =>
                                      actualizarDescuentoProducto(
                                        producto.id,
                                        "tipo_descuento",
                                        "porcentaje",
                                      )
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.tipoDescuentoButtonText,
                                        seleccionado.tipo_descuento ===
                                          "porcentaje" &&
                                          styles.tipoDescuentoButtonTextActive,
                                      ]}
                                    >
                                      %
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.tipoDescuentoButton,
                                      seleccionado.tipo_descuento === "valor" &&
                                        styles.tipoDescuentoButtonActive,
                                    ]}
                                    onPress={() =>
                                      actualizarDescuentoProducto(
                                        producto.id,
                                        "tipo_descuento",
                                        "valor",
                                      )
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.tipoDescuentoButtonText,
                                        seleccionado.tipo_descuento ===
                                          "valor" &&
                                          styles.tipoDescuentoButtonTextActive,
                                      ]}
                                    >
                                      $
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              <View style={styles.descuentoRow}>
                                <Text style={styles.inputLabel}>Valor:</Text>
                                <TextInput
                                  style={styles.descuentoInput}
                                  value={
                                    seleccionado.valor_descuento?.toString() ||
                                    ""
                                  }
                                  onChangeText={(text) =>
                                    actualizarDescuentoProducto(
                                      producto.id,
                                      "valor_descuento",
                                      text,
                                    )
                                  }
                                  placeholder={
                                    seleccionado.tipo_descuento === "porcentaje"
                                      ? "Ej: 10"
                                      : "Ej: 5.00"
                                  }
                                  placeholderTextColor="#9ca3af"
                                  keyboardType="numeric"
                                />
                                <Text style={styles.descuentoSuffix}>
                                  {seleccionado.tipo_descuento === "porcentaje"
                                    ? "%"
                                    : ""}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setMostrarModalSelectorProductos(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setMostrarModalSelectorProductos(false)}
                  >
                    <Text style={styles.confirmButtonText}>
                      Confirmar Selección ({productosSeleccionados.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  addButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 20,
  },
  searchContainer: {
    backgroundColor: "white",
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#111827",
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  filterButtonTextActive: {
    color: "white",
  },
  ofertaItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  ofertaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ofertaInfo: {
    flex: 1,
  },
  ofertaNombre: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  ofertaDescripcion: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  ofertaMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  estadoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  ofertaMetodo: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  ofertaActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  aplicaTodos: {
    fontSize: 14,
    color: "#10b981",
    fontWeight: "600",
    marginTop: 8,
  },
  productosList: {
    marginTop: 8,
  },
  productosTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  productoItem: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
  },
  masProductos: {
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },
  // Estilos del modal - Copia exacta de punto.tsx
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    marginBottom: 16,
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
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#374151",
    marginLeft: 8,
  },
  // Estilos adicionales para productos específicos
  productosSelectorHeader: {
    marginBottom: 12,
  },
  selectProductosButton: {
    backgroundColor: "#06b6d4",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  selectProductosText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  productosSelectorList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  productoSelectorItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  productoSelectorItemSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  productoInfo: {
    flex: 1,
  },
  productoNombre: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  productoCantidad: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  seleccionadosContainer: {
    marginTop: 16,
  },
  productoSeleccionadoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  productoSeleccionadoInfo: {
    flex: 1,
  },
  productoSeleccionadoNombre: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  descuentoInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  descuentoTipoButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: "center",
  },
  descuentoTipoSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  descuentoTipoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  descuentoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
  quitarProductoButton: {
    padding: 4,
  },
  requiredNote: {
    marginTop: 16,
    marginBottom: 8,
  },
  requiredNoteText: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  inputHint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: -8,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
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
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  // Estilos adicionales para mostrar información completa
  ofertaFecha: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  descuentoInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  descuentoValor: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
    marginTop: 4,
  },
  productoDescuento: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
  },
  // Estilos para días de la semana
  diasContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  diaButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: "center",
  },
  diaButtonSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  diaButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  diaButtonTextSelected: {
    color: "white",
  },
  // Estilos para calendario
  fechaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  fechaButtonText: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  calendarioContainer: {
    padding: 20,
  },
  // Estilos para calendario personalizado
  calendarioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarioNavButton: {
    padding: 8,
  },
  calendarioMes: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
  },
  calendarioDiasSemana: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calendarioDiaSemana: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    width: 40,
    textAlign: "center",
  },
  calendarioDias: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  calendarioDia: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    margin: 2,
  },
  calendarioDiaSeleccionado: {
    backgroundColor: "#3b82f6",
  },
  calendarioDiaVacio: {
    backgroundColor: "transparent",
  },
  calendarioDiaTexto: {
    fontSize: 14,
    color: "#374151",
  },
  calendarioDiaTextoSeleccionado: {
    color: "white",
    fontWeight: "600",
  },
  fechaSeleccionadaText: {
    fontSize: 16,
    color: "#374151",
    marginTop: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  // Estilos para DateTimePicker nativo
  datePicker: {
    width: "100%",
    height: 300,
    marginTop: 16,
    marginBottom: 16,
  },
  // Estilos para el modal de selector de productos
  productoSelectorCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  productoCardHeader: {
    padding: 12,
  },
  descuentoConfig: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  descuentoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tipoDescuentoButtons: {
    flexDirection: "row",
    marginLeft: 8,
  },
  tipoDescuentoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    marginRight: 8,
  },
  tipoDescuentoButtonActive: {
    backgroundColor: "#06b6d4",
  },
  tipoDescuentoButtonText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  tipoDescuentoButtonTextActive: {
    color: "white",
  },
  descuentoSuffix: {
    marginLeft: 4,
    fontSize: 14,
    color: "#6b7280",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#06b6d4",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
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
