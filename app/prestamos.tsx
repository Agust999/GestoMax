// app/prestamos/index.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import { db, getFirst } from "../src/db/database";
import { PrestamoDeudaHelper, PuntoHelper } from "../src/db/databaseHelper";
import { AuthService } from "../src/db/services/auth_service";

const { width, height } = Dimensions.get("window");
const isTablet = width >= 768;

// Tipo para Préstamo/Deuda
interface PrestamoDeuda {
  id: number;
  tipo: "prestamo" | "deuda";
  descripcion: string;
  monto: number;
  moneda: string;
  punto_id: number | null;
  punto_nombre?: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  estado: "pendiente" | "pagado" | "vencido";
  notas?: string;
  creado_en: string;
  origen?: string;
  estado_actualizado?: string;
}

// Tipo para Punto
interface Punto {
  id: number;
  nombre: string;
  tipo_negocio: "punto" | "panaderia";
}

// Tipo para Producto
interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  stock_disponible: number;
  precio_venta?: number;
  seleccionado?: boolean;
  cantidadSeleccionada?: number;
}

// Componente memoizado para items
const PrestamoItem = React.memo(function PrestamoItem({
  item,
  onEdit,
  onDelete,
  onMarkAsPaid,
}: {
  item: PrestamoDeuda;
  onEdit: (item: PrestamoDeuda) => void;
  onDelete: (id: number) => void;
  onMarkAsPaid: (id: number, estado: "pendiente" | "pagado") => void;
}) {
  // Formatear moneda
  const formatMoneda = (monto: number) => {
    return new Intl.NumberFormat("es-CU", {
      style: "currency",
      currency: "CUP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  };

  // Formatear fecha
  const formatFecha = (fechaString: string) => {
    try {
      const fecha = new Date(fechaString);
      return fecha.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return fechaString;
    }
  };

  // Calcular días restantes - memoizado
  const diasRestantes = useMemo(() => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const vencimiento = new Date(item.fecha_vencimiento);
      vencimiento.setHours(0, 0, 0, 0);
      const diffTiempo = vencimiento.getTime() - hoy.getTime();
      return Math.ceil(diffTiempo / (1000 * 3600 * 24));
    } catch {
      return 0;
    }
  }, [item.fecha_vencimiento]);

  // Determinar si está vencido - memoizado
  const estaVencido = useMemo(() => {
    const estadoActual = item.estado_actualizado || item.estado;
    return estadoActual === "vencido" || diasRestantes < 0;
  }, [item.estado_actualizado, item.estado, diasRestantes]);

  const estadoActual = item.estado_actualizado || item.estado;

  return (
    <TouchableOpacity
      style={[
        styles.itemCard,
        estaVencido && styles.itemCardVencido,
        item.estado === "pagado" && styles.itemCardPagado,
      ]}
      onPress={() => onEdit(item)}
      activeOpacity={0.8}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemTipoContainer}>
          <View
            style={[
              styles.tipoBadge,
              item.tipo === "prestamo" ? styles.tipoPrestamo : styles.tipoDeuda,
            ]}
          >
            <Text style={styles.tipoBadgeText}>
              {item.tipo === "prestamo" ? "PRÉSTAMO" : "DEUDA"}
            </Text>
          </View>
          <View
            style={[
              styles.estadoBadge,
              estadoActual === "pendiente" && !estaVencido
                ? styles.estadoPendiente
                : estadoActual === "pagado"
                  ? styles.estadoPagado
                  : styles.estadoVencido,
            ]}
          >
            <Text style={styles.estadoBadgeText}>
              {estaVencido ? "VENCIDO" : estadoActual.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.itemMonto}>{formatMoneda(item.monto)}</Text>
      </View>

      <Text style={styles.itemDescripcion}>{item.descripcion}</Text>

      <View style={styles.itemInfoContainer}>
        <View style={styles.itemInfoRow}>
          <Ionicons name="business-outline" size={16} color="#6b7280" />
          <Text style={styles.itemInfoText}>
            {item.origen || (item.punto_nombre ? item.punto_nombre : "General")}
          </Text>
        </View>

        <View style={styles.itemInfoRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.itemInfoText}>
            Vence: {formatFecha(item.fecha_vencimiento)}
          </Text>
          {estadoActual === "pendiente" && !estaVencido && (
            <Text
              style={[
                styles.diasRestantes,
                diasRestantes <= 7 ? styles.diasPoco : styles.diasNormal,
              ]}
            >
              ({diasRestantes > 0 ? `${diasRestantes} días restantes` : "Hoy"})
            </Text>
          )}
          {estaVencido && (
            <Text style={[styles.diasRestantes, styles.diasVencido]}>
              (Vencido hace {Math.abs(diasRestantes)} días)
            </Text>
          )}
        </View>

        {item.notas ? (
          <View style={styles.itemInfoRow}>
            <Ionicons name="document-text-outline" size={16} color="#6b7280" />
            <Text style={styles.itemInfoText} numberOfLines={2}>
              {item.notas}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.itemActions}>
        {estadoActual === "pendiente" && !estaVencido && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onMarkAsPaid(item.id, "pagado")}
          >
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.actionButtonText}>Marcar como pagado</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDelete]}
          onPress={() => onDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text
            style={[styles.actionButtonText, styles.actionButtonDeleteText]}
          >
            Eliminar
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

// Función para formatear moneda (global para evitar recreación)
const formatMonedaGlobal = (monto: number) => {
  return new Intl.NumberFormat("es-CU", {
    style: "currency",
    currency: "CUP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
};

// Componente para estadísticas
const EstadisticasSection = React.memo(function EstadisticasSection({
  estadisticas,
}: {
  estadisticas: any;
}) {
  return (
    <View style={styles.statsWrapper}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[
          {
            key: "total_pendiente",
            value: formatMonedaGlobal(estadisticas.total_pendiente),
            label: "Total Pendiente",
          },
          {
            key: "total_prestamos",
            value: estadisticas.total_prestamos,
            label: "Préstamos",
          },
          {
            key: "total_deudas",
            value: estadisticas.total_deudas,
            label: "Deudas",
          },
          {
            key: "total_vencidos",
            value:
              estadisticas.prestamos_vencidos + estadisticas.deudas_vencidas,
            label: "Vencidos",
          },
        ]}
        renderItem={({ item }) => (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        )}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.statsContainer}
      />
    </View>
  );
});

// Componente para filtros activos
const FiltrosActivosSection = React.memo(function FiltrosActivosSection({
  filtroTipo,
  filtroEstado,
  filtroPunto,
  filtroFechaDesde,
  filtroFechaHasta,
  puntos,
  limpiarFiltros,
}: {
  filtroTipo: string;
  filtroEstado: string;
  filtroPunto: any;
  filtroFechaDesde: Date | null;
  filtroFechaHasta: Date | null;
  puntos: Punto[];
  limpiarFiltros: () => void;
}) {
  const hayFiltros =
    filtroTipo !== "todos" ||
    filtroEstado !== "todos" ||
    filtroPunto !== "todos" ||
    filtroFechaDesde ||
    filtroFechaHasta;

  if (!hayFiltros) return null;

  const getPuntoNombre = () => {
    if (filtroPunto === null) return "General";
    if (filtroPunto === "todos") return "";
    const punto = puntos.find((p) => p.id === filtroPunto);
    return punto ? punto.nombre : "Punto";
  };

  return (
    <View style={styles.filtrosActivosContainer}>
      <Text style={styles.filtrosActivosTitle}>Filtros aplicados:</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[
          ...(filtroTipo !== "todos"
            ? [
                {
                  id: "tipo",
                  text: `Tipo: ${filtroTipo === "prestamo" ? "Préstamos" : "Deudas"}`,
                },
              ]
            : []),
          ...(filtroEstado !== "todos"
            ? [{ id: "estado", text: `Estado: ${filtroEstado}` }]
            : []),
          ...(filtroPunto !== "todos"
            ? [{ id: "punto", text: getPuntoNombre() }]
            : []),
          ...(filtroFechaDesde || filtroFechaHasta
            ? [{ id: "fechas", text: "Fechas filtradas" }]
            : []),
        ]}
        renderItem={({ item }) => (
          <View style={styles.filtroBadge}>
            <Text style={styles.filtroBadgeText}>{item.text}</Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.filtrosActivosList}
      />
      <TouchableOpacity onPress={limpiarFiltros}>
        <Text style={styles.limpiarFiltrosText}>Limpiar filtros</Text>
      </TouchableOpacity>
    </View>
  );
});

// Componente para estado vacío
const EmptyListComponent = React.memo(function EmptyListComponent({
  filtroTipo,
  filtroEstado,
  filtroPunto,
  resetFormulario,
  setModalVisible,
}: {
  filtroTipo: string;
  filtroEstado: string;
  filtroPunto: any;
  resetFormulario: () => void;
  setModalVisible: (visible: boolean) => void;
}) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={64} color="#9ca3af" />
      <Text style={styles.emptyTitle}>No hay préstamos o deudas</Text>
      <Text style={styles.emptyText}>
        {filtroTipo !== "todos" ||
        filtroEstado !== "todos" ||
        filtroPunto !== "todos"
          ? "Intenta cambiar los filtros"
          : "Agrega tu primer préstamo o deuda"}
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => {
          resetFormulario();
          setModalVisible(true);
        }}
      >
        <Text style={styles.emptyButtonText}>Agregar nuevo</Text>
      </TouchableOpacity>
    </View>
  );
});

export default function PrestamosDeudasScreen() {
  const router = useRouter();

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/prestamos");

  const [prestamosDeudas, setPrestamosDeudas] = useState<PrestamoDeuda[]>([]);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [productosModalVisible, setProductosModalVisible] = useState(false);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados para formulario
  const [editando, setEditando] = useState(false);
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [tipo, setTipo] = useState<"prestamo" | "deuda">("prestamo");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [puntoId, setPuntoId] = useState<number | null>(null);
  const [fechaInicio, setFechaInicio] = useState(new Date());
  const [fechaVencimiento, setFechaVencimiento] = useState(new Date());
  const [notas, setNotas] = useState("");

  // Estados para productos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState<
    Producto[]
  >([]);

  // Estados para filtros
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "prestamo" | "deuda">(
    "todos",
  );
  const [filtroEstado, setFiltroEstado] = useState<
    "todos" | "pendiente" | "pagado" | "vencido"
  >("todos");
  const [filtroPunto, setFiltroPunto] = useState<number | null | "todos">(
    "todos",
  );
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<Date | null>(null);
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<Date | null>(null);

  // Refs para control
  const flatListRef = useRef<FlatList>(null);
  const filtrosActualesRef = useRef({
    tipo: filtroTipo,
    estado: filtroEstado,
    punto: filtroPunto,
    fechaDesde: filtroFechaDesde,
    fechaHasta: filtroFechaHasta,
  });

  // Cargar datos
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Cargar datos en paralelo con límites
      const [prestamosData, puntosData, statsData] = await Promise.all([
        PrestamoDeudaHelper.getAllWithPuntos(100).catch((e) => {
          console.error("Error cargando préstamos:", e);
          return [];
        }),
        PuntoHelper.getAll(50).catch((e) => {
          console.error("Error cargando puntos:", e);
          return [];
        }),
        PrestamoDeudaHelper.getEstadisticas().catch((e) => {
          console.error("Error cargando estadísticas:", e);
          return null;
        }),
      ]);

      setPrestamosDeudas(prestamosData);
      setPuntos(puntosData);
      setEstadisticas(statsData);
    } catch (error: any) {
      console.error("❌ Error crítico cargando datos:", error);
      Alert.alert(
        "Error",
        "No se pudieron cargar los datos. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [fetchData, isAuthenticated]);

  // Cargar productos del punto seleccionado
  const cargarProductosDelPunto = useCallback(async (puntoId: number) => {
    try {
      const productosData = await PrestamoDeudaHelper.getProductosPorPunto(
        puntoId,
        100,
      ).catch((e) => {
        console.error("Error cargando productos:", e);
        return [];
      });

      setProductos(
        productosData.map((p: any) => ({
          ...p,
          seleccionado: false,
          cantidadSeleccionada: 0,
        })),
      );
    } catch (error: any) {
      console.error("❌ Error cargando productos:", error);
      Alert.alert("Error", "No se pudieron cargar los productos");
    }
  }, []);

  // Resetear formulario
  const resetFormulario = useCallback(() => {
    setEditando(false);
    setIdEditando(null);
    setTipo("prestamo");
    setDescripcion("");
    setMonto("");
    setPuntoId(null);
    setFechaInicio(new Date());
    setFechaVencimiento(new Date());
    setNotas("");
    setProductos([]);
    setProductosSeleccionados([]);
  }, []);

  // Calcular monto total de productos seleccionados
  const calcularMontoProductos = useMemo(() => {
    return productosSeleccionados.reduce((total, producto) => {
      return (
        total + producto.precio_coste * (producto.cantidadSeleccionada || 1)
      );
    }, 0);
  }, [productosSeleccionados]);

  // Agregar/remover producto seleccionado
  const toggleProductoSeleccionado = useCallback((producto: Producto) => {
    setProductosSeleccionados((prev) => {
      const existeIndex = prev.findIndex((p) => p.id === producto.id);

      if (existeIndex !== -1) {
        // Remover producto
        const nuevos = [...prev];
        nuevos.splice(existeIndex, 1);
        return nuevos;
      } else {
        // Agregar producto con cantidad inicial 1
        return [
          ...prev,
          {
            ...producto,
            seleccionado: true,
            cantidadSeleccionada: 1,
          },
        ];
      }
    });

    // Actualizar lista de productos
    setProductos((prev) =>
      prev.map((p) =>
        p.id === producto.id ? { ...p, seleccionado: !p.seleccionado } : p,
      ),
    );
  }, []);

  // Actualizar cantidad de producto
  const actualizarCantidadProducto = useCallback(
    (productoId: number, cantidad: number) => {
      if (cantidad < 1) {
        Alert.alert("Error", "La cantidad no puede ser menor a 1");
        return;
      }

      const producto = productos.find((p) => p.id === productoId);
      if (!producto) {
        Alert.alert("Error", "Producto no encontrado");
        return;
      }

      if (cantidad > producto.stock_disponible) {
        Alert.alert(
          "Error",
          `Cantidad excede el stock disponible (${producto.stock_disponible})`,
        );
        return;
      }

      setProductosSeleccionados((prev) =>
        prev.map((p) =>
          p.id === productoId ? { ...p, cantidadSeleccionada: cantidad } : p,
        ),
      );

      setProductos((prev) =>
        prev.map((p) =>
          p.id === productoId ? { ...p, cantidadSeleccionada: cantidad } : p,
        ),
      );
    },
    [productos],
  );

  // Guardar préstamo/deuda
  const guardarPrestamoDeuda = useCallback(async () => {
    if (!descripcion.trim()) {
      Alert.alert("Error", "La descripción es requerida");
      return;
    }

    // Validar monto
    let montoFinal = 0;
    if (productosSeleccionados.length === 0) {
      const montoNum = parseFloat(monto);
      if (!monto || isNaN(montoNum) || montoNum <= 0) {
        Alert.alert("Error", "El monto debe ser mayor a 0");
        return;
      }
      montoFinal = montoNum;
    } else {
      montoFinal = calcularMontoProductos;
    }

    // Validar fecha
    if (fechaVencimiento < fechaInicio) {
      Alert.alert(
        "Error",
        "La fecha de vencimiento debe ser posterior a la fecha de inicio",
      );
      return;
    }

    try {
      setLoading(true);

      const fechaInicioStr = fechaInicio.toISOString().split("T")[0];
      const fechaVencimientoStr = fechaVencimiento.toISOString().split("T")[0];

      if (editando && idEditando) {
        if (productosSeleccionados.length > 0 && puntoId) {
          await PrestamoDeudaHelper.updateConProductos(
            idEditando,
            tipo,
            descripcion,
            montoFinal,
            fechaInicioStr,
            fechaVencimientoStr,
            puntoId,
            "CUP",
            notas,
            productosSeleccionados.map((p) => ({
              producto_id: p.id,
              cantidad: p.cantidadSeleccionada || 1,
            })),
          );
        } else {
          await PrestamoDeudaHelper.update(
            idEditando,
            tipo,
            descripcion,
            montoFinal,
            fechaInicioStr,
            fechaVencimientoStr,
            puntoId,
            "CUP",
            notas,
          );
        }
        Alert.alert("Éxito", "Préstamo/Deuda actualizado correctamente");
      } else {
        if (productosSeleccionados.length > 0 && puntoId) {
          await PrestamoDeudaHelper.createPrestamoConProductos(
            tipo,
            descripcion,
            puntoId,
            fechaInicioStr,
            fechaVencimientoStr,
            notas,
            productosSeleccionados.map((p) => ({
              producto_id: p.id,
              cantidad: p.cantidadSeleccionada || 1,
            })),
          );
        } else {
          await PrestamoDeudaHelper.create(
            tipo,
            descripcion,
            montoFinal,
            fechaInicioStr,
            fechaVencimientoStr,
            puntoId,
            "CUP",
            notas,
          );
        }
        Alert.alert("Éxito", "Préstamo/Deuda creado correctamente");
      }

      await fetchData();
      setModalVisible(false);
      resetFormulario();
    } catch (error: any) {
      console.error("❌ Error guardando:", error);
      Alert.alert(
        "Error",
        error.message || "No se pudo guardar el préstamo/deuda",
      );
    } finally {
      setLoading(false);
    }
  }, [
    descripcion,
    monto,
    productosSeleccionados,
    calcularMontoProductos,
    fechaVencimiento,
    fechaInicio,
    editando,
    idEditando,
    tipo,
    puntoId,
    notas,
    fetchData,
    resetFormulario,
  ]);

  // Editar préstamo/deuda
  const editarPrestamoDeuda = useCallback(
    (item: PrestamoDeuda) => {
      setEditando(true);
      setIdEditando(item.id);
      setTipo(item.tipo);
      setDescripcion(item.descripcion);
      setMonto(item.monto.toString());
      setPuntoId(item.punto_id);
      setFechaInicio(new Date(item.fecha_inicio));
      setFechaVencimiento(new Date(item.fecha_vencimiento));
      setNotas(item.notas || "");

      // Limpiar productos
      setProductos([]);
      setProductosSeleccionados([]);

      // Cargar productos async
      if (item.punto_id) {
        cargarProductosDelPunto(item.punto_id)
          .then(() => {
            // Cargar productos del préstamo después de cargar productos del punto
            PrestamoDeudaHelper.getProductosPrestamo(item.id, 50)
              .then((productosPrestamo) => {
                if (productosPrestamo.length > 0) {
                  setProductos((prev) => {
                    const nuevosProductos = prev.map((p) => {
                      const productoPrestamo = productosPrestamo.find(
                        (pp: any) => pp.producto_id === p.id,
                      );
                      if (productoPrestamo) {
                        return {
                          ...p,
                          seleccionado: true,
                          cantidadSeleccionada: productoPrestamo.cantidad,
                        };
                      }
                      return p;
                    });

                    // Actualizar productos seleccionados
                    setProductosSeleccionados(
                      nuevosProductos.filter((p) => p.seleccionado),
                    );
                    return nuevosProductos;
                  });
                }
              })
              .catch(console.error);
          })
          .catch(console.error);
      }

      setModalVisible(true);
    },
    [cargarProductosDelPunto],
  );

  // Cambiar estado
  const cambiarEstado = useCallback(
    async (id: number, nuevoEstado: "pendiente" | "pagado") => {
      try {
        if (nuevoEstado === "pagado") {
          // Primero obtener los detalles del préstamo para crear la venta
          const prestamo = await getFirst<any>(
            "SELECT * FROM PrestamoDeuda WHERE id = ?",
            [id],
          );

          if (prestamo) {
            // Crear la venta real cuando se paga el préstamo
            // Usar fecha local en lugar de UTC
            const { getFechaHoraLocalCompleta } =
              await import("../src/utils/dateUtils");
            const ahora = getFechaHoraLocalCompleta();

            const ventaResult = await db.runAsync(
              `
              INSERT INTO Venta (
                punto_id, total_venta, total_efectivo, total_transferencia,
                tipo_pago, creado_en
              ) VALUES (?, ?, ?, ?, 'efectivo', ?)
            `,
              [
                prestamo.punto_id,
                prestamo.monto,
                prestamo.monto, // Asumimos que se paga en efectivo
                0, // No hay transferencia
                ahora,
              ],
            );

            const ventaId = ventaResult.lastInsertRowId;

            // Crear detalle de venta (usamos el producto original del préstamo)
            const deudaInfo = await getFirst<any>(
              "SELECT producto_id FROM PrestamoDeuda WHERE id = ?",
              [id],
            );

            const productoIdUsar =
              deudaInfo?.producto_id ||
              (
                await getFirst<any>(
                  "SELECT id FROM Producto ORDER BY id LIMIT 1",
                )
              )?.id; // Usar el original o el primer producto como fallback

            await db.runAsync(
              `
              INSERT INTO DetalleVenta (
                venta_id, producto_id, cantidad, precio_unitario,
                precio_coste_real, subtotal
              ) VALUES (?, ?, ?, ?, ?, ?)
            `,
              [
                ventaId,
                productoIdUsar, // Usar el producto original del préstamo
                1, // Cantidad
                prestamo.monto, // Precio unitario igual al monto del préstamo
                0, // precio_coste_real = 0 para que la ganancia sea el 100%
                prestamo.monto,
              ],
            );

            console.log(
              `💰 DetalleVenta creado para pago de deuda: $${prestamo.monto} (ganancia 100%, producto_id: ${productoIdUsar})`,
            );

            // Ahora marcar el préstamo como pagado
            await PrestamoDeudaHelper.marcarComoPagado(id);
            Alert.alert(
              "Éxito",
              "Préstamo marcado como pagado y venta registrada",
            );
          }
        }

        // Actualizar localmente
        setPrestamosDeudas((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  estado: nuevoEstado,
                  estado_actualizado: nuevoEstado,
                }
              : item,
          ),
        );

        // Actualizar estadísticas
        const stats = await PrestamoDeudaHelper.getEstadisticas();
        setEstadisticas(stats);
      } catch (error: any) {
        console.error("❌ Error cambiando estado:", error);
        Alert.alert("Error", "No se pudo cambiar el estado");
      }
    },
    [],
  );

  // Eliminar préstamo/deuda
  const eliminarPrestamoDeuda = useCallback(async (id: number) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de que quieres eliminar este registro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await PrestamoDeudaHelper.delete(id);
              Alert.alert("Éxito", "Registro eliminado correctamente");

              // Actualizar lista localmente
              setPrestamosDeudas((prev) =>
                prev.filter((item) => item.id !== id),
              );

              // Actualizar estadísticas
              const stats = await PrestamoDeudaHelper.getEstadisticas();
              setEstadisticas(stats);
            } catch (error: any) {
              console.error("❌ Error eliminando:", error);
              Alert.alert("Error", "No se pudo eliminar el registro");
            }
          },
        },
      ],
    );
  }, []);

  // Aplicar filtros - OPTIMIZADO
  const prestamosFiltrados = useMemo(() => {
    // Actualizar ref
    filtrosActualesRef.current = {
      tipo: filtroTipo,
      estado: filtroEstado,
      punto: filtroPunto,
      fechaDesde: filtroFechaDesde,
      fechaHasta: filtroFechaHasta,
    };

    // Si no hay filtros activos, devolver todos
    const hayFiltros =
      filtroTipo !== "todos" ||
      filtroEstado !== "todos" ||
      filtroPunto !== "todos" ||
      filtroFechaDesde ||
      filtroFechaHasta;

    if (!hayFiltros) {
      return prestamosDeudas;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return prestamosDeudas.filter((item) => {
      // Filtro por tipo
      if (filtroTipo !== "todos" && item.tipo !== filtroTipo) return false;

      // Filtro por punto
      if (filtroPunto !== "todos") {
        if (filtroPunto === null) {
          if (item.punto_id !== null) return false;
        } else {
          if (item.punto_id !== filtroPunto) return false;
        }
      }

      // Filtro por estado
      if (filtroEstado !== "todos") {
        const estadoActual = item.estado_actualizado || item.estado;

        if (filtroEstado === "pagado") {
          if (estadoActual !== "pagado") return false;
        } else {
          try {
            const fechaVencimiento = new Date(item.fecha_vencimiento);
            fechaVencimiento.setHours(0, 0, 0, 0);
            const estaVencidoPorFecha =
              fechaVencimiento < hoy && item.estado === "pendiente";

            if (filtroEstado === "pendiente") {
              if (estadoActual !== "pendiente" || estaVencidoPorFecha)
                return false;
            } else if (filtroEstado === "vencido") {
              if (estadoActual !== "vencido" && !estaVencidoPorFecha)
                return false;
            }
          } catch {
            return false;
          }
        }
      }

      // Filtro por fecha
      if (filtroFechaDesde) {
        try {
          const fechaItem = new Date(item.fecha_vencimiento);
          fechaItem.setHours(0, 0, 0, 0);
          const fechaDesde = new Date(filtroFechaDesde);
          fechaDesde.setHours(0, 0, 0, 0);

          if (fechaItem < fechaDesde) return false;
        } catch {
          return false;
        }
      }

      if (filtroFechaHasta) {
        try {
          const fechaItem = new Date(item.fecha_vencimiento);
          fechaItem.setHours(0, 0, 0, 0);
          const fechaHasta = new Date(filtroFechaHasta);
          fechaHasta.setHours(0, 0, 0, 0);

          if (fechaItem > fechaHasta) return false;
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [
    prestamosDeudas,
    filtroTipo,
    filtroEstado,
    filtroPunto,
    filtroFechaDesde,
    filtroFechaHasta,
  ]);

  // Limpiar filtros
  const limpiarFiltros = useCallback(() => {
    setFiltroTipo("todos");
    setFiltroEstado("todos");
    setFiltroPunto("todos");
    setFiltroFechaDesde(null);
    setFiltroFechaHasta(null);

    // Scroll al top
    flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      setProductos([]);
      setProductosSeleccionados([]);
    };
  }, []);

  // Render principal
  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={prestamosFiltrados}
        renderItem={({ item }) => (
          <PrestamoItem
            item={item}
            onEdit={editarPrestamoDeuda}
            onDelete={eliminarPrestamoDeuda}
            onMarkAsPaid={cambiarEstado}
          />
        )}
        keyExtractor={(item) => `prestamo-${item.id}`}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        updateCellsBatchingPeriod={100}
        getItemLayout={(_, index) => ({
          length: 200,
          offset: 200 * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
        ListHeaderComponent={
          <>
            {/* Estadísticas */}
            {estadisticas && (
              <EstadisticasSection estadisticas={estadisticas} />
            )}

            {/* Filtros activos */}
            <FiltrosActivosSection
              filtroTipo={filtroTipo}
              filtroEstado={filtroEstado}
              filtroPunto={filtroPunto}
              filtroFechaDesde={filtroFechaDesde}
              filtroFechaHasta={filtroFechaHasta}
              puntos={puntos}
              limpiarFiltros={limpiarFiltros}
            />
          </>
        }
        ListEmptyComponent={
          <EmptyListComponent
            filtroTipo={filtroTipo}
            filtroEstado={filtroEstado}
            filtroPunto={filtroPunto}
            resetFormulario={resetFormulario}
            setModalVisible={setModalVisible}
          />
        }
      />
    );
  };

  // Estados para date pickers
  const [showFechaInicioPicker, setShowFechaInicioPicker] = useState(false);
  const [showFechaVencimientoPicker, setShowFechaVencimientoPicker] =
    useState(false);
  const [showFechaDesdePicker, setShowFechaDesdePicker] = useState(false);
  const [showFechaHastaPicker, setShowFechaHastaPicker] = useState(false);

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Préstamos & Deudas</Text>
            <Text style={styles.headerSubtitle}>
              Gestiona tus finanzas pendientes
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons name="filter" size={24} color="#3b82f6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                resetFormulario();
                setModalVisible(true);
              }}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {renderContent()}

      {/* Modal de formulario */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetFormulario();
        }}
        hardwareAccelerated={true}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editando ? "Editar" : "Nuevo"}{" "}
                {tipo === "prestamo" ? "Préstamo" : "Deuda"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetFormulario();
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[]}
              renderItem={() => null}
              ListHeaderComponent={
                <>
                  {/* Tipo */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Tipo *</Text>
                    <View style={styles.tipoSelector}>
                      <TouchableOpacity
                        style={[
                          styles.tipoOption,
                          tipo === "prestamo" && styles.tipoOptionSelected,
                        ]}
                        onPress={() => setTipo("prestamo")}
                      >
                        <Text
                          style={[
                            styles.tipoOptionText,
                            tipo === "prestamo" &&
                              styles.tipoOptionTextSelected,
                          ]}
                        >
                          Préstamo (Yo presto)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.tipoOption,
                          tipo === "deuda" && styles.tipoOptionSelected,
                        ]}
                        onPress={() => setTipo("deuda")}
                      >
                        <Text
                          style={[
                            styles.tipoOptionText,
                            tipo === "deuda" && styles.tipoOptionTextSelected,
                          ]}
                        >
                          Deuda (Yo debo)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Descripción */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Descripción *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={descripcion}
                      onChangeText={setDescripcion}
                      placeholder="Ej: Préstamo a Juan, Deuda de materiales..."
                      placeholderTextColor="#9ca3af"
                      maxLength={200}
                    />
                  </View>

                  {/* Monto - Solo si no hay productos seleccionados */}
                  {productosSeleccionados.length === 0 ? (
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Monto (CUP) *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={monto}
                        onChangeText={setMonto}
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                      />
                    </View>
                  ) : (
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>
                        Monto calculado (CUP)
                      </Text>
                      <Text style={styles.montoCalculado}>
                        {formatMonedaGlobal(calcularMontoProductos)}
                      </Text>
                      <Text style={styles.montoInfo}>
                        Total basado en productos seleccionados
                      </Text>
                    </View>
                  )}

                  {/* Punto */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Origen (Opcional)</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={puntoId === null ? "general" : puntoId}
                        onValueChange={async (itemValue: string | number) => {
                          if (itemValue === "general") {
                            setPuntoId(null);
                            setProductos([]);
                            setProductosSeleccionados([]);
                          } else {
                            const puntoIdNum = Number(itemValue);
                            setPuntoId(puntoIdNum);
                            await cargarProductosDelPunto(puntoIdNum);
                          }
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item
                          label="General (Personal)"
                          value="general"
                        />
                        <Picker.Item
                          label="Seleccionar punto..."
                          value=""
                          enabled={false}
                        />
                        {puntos.map((punto) => (
                          <Picker.Item
                            key={punto.id}
                            label={punto.nombre}
                            value={punto.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  {/* Seleccionar productos - Solo si se seleccionó un punto y es préstamo */}
                  {puntoId && tipo === "prestamo" && (
                    <View style={styles.formGroup}>
                      <View style={styles.productosHeader}>
                        <Text style={styles.formLabel}>
                          Productos (Opcional)
                        </Text>
                        <TouchableOpacity
                          style={styles.productosButton}
                          onPress={() => setProductosModalVisible(true)}
                        >
                          <Ionicons
                            name="cube-outline"
                            size={20}
                            color="#3b82f6"
                          />
                          <Text style={styles.productosButtonText}>
                            {productosSeleccionados.length > 0
                              ? `${productosSeleccionados.length} producto(s) seleccionado(s)`
                              : "Seleccionar productos"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {productosSeleccionados.length > 0 && (
                        <FlatList
                          data={productosSeleccionados}
                          renderItem={({ item, index }) => (
                            <View
                              key={item.id}
                              style={styles.productoResumenItem}
                            >
                              <View style={styles.productoResumenInfo}>
                                <Text style={styles.productoNombre}>
                                  {index + 1}. {item.nombre}
                                </Text>
                                <Text style={styles.productoDetalle}>
                                  {item.cantidadSeleccionada} x{" "}
                                  {formatMonedaGlobal(item.precio_coste)} ={" "}
                                  {formatMonedaGlobal(
                                    item.precio_coste *
                                      (item.cantidadSeleccionada || 1),
                                  )}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.eliminarProductoButton}
                                onPress={() => toggleProductoSeleccionado(item)}
                              >
                                <Ionicons
                                  name="close-circle"
                                  size={20}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                            </View>
                          )}
                          keyExtractor={(item) => item.id.toString()}
                          scrollEnabled={false}
                        />
                      )}
                    </View>
                  )}

                  {/* Fechas */}
                  <View style={[styles.formGroup, styles.fechasContainer]}>
                    <View style={styles.fechaGroup}>
                      <Text style={styles.formLabel}>Fecha inicio</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowFechaInicioPicker(true)}
                      >
                        <Ionicons name="calendar" size={20} color="#3b82f6" />
                        <Text style={styles.dateButtonText}>
                          {fechaInicio.toLocaleDateString("es-ES")}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fechaGroup}>
                      <Text style={styles.formLabel}>Fecha vencimiento *</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowFechaVencimientoPicker(true)}
                      >
                        <Ionicons name="calendar" size={20} color="#3b82f6" />
                        <Text style={styles.dateButtonText}>
                          {fechaVencimiento.toLocaleDateString("es-ES")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Notas */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Notas (Opcional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={notas}
                      onChangeText={setNotas}
                      placeholder="Información adicional..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      maxLength={500}
                    />
                  </View>
                </>
              }
              style={styles.modalContent}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  resetFormulario();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={guardarPrestamoDeuda}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {editando ? "Actualizar" : "Guardar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de productos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={productosModalVisible}
        onRequestClose={() => setProductosModalVisible(false)}
        hardwareAccelerated={true}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.productosModalContainer}>
            <View style={styles.productosModalHeader}>
              <Text style={styles.productosModalTitle}>
                Seleccionar Productos
              </Text>
              <TouchableOpacity
                onPress={() => setProductosModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.productosModalStats}>
              <View style={styles.productosModalStat}>
                <Text style={styles.productosModalStatValue}>
                  {productos.length}
                </Text>
                <Text style={styles.productosModalStatLabel}>Disponibles</Text>
              </View>
              <View style={styles.productosModalStat}>
                <Text style={styles.productosModalStatValue}>
                  {productosSeleccionados.length}
                </Text>
                <Text style={styles.productosModalStatLabel}>
                  Seleccionados
                </Text>
              </View>
              <View style={styles.productosModalStat}>
                <Text style={styles.productosModalStatValue}>
                  {formatMonedaGlobal(calcularMontoProductos)}
                </Text>
                <Text style={styles.productosModalStatLabel}>Total</Text>
              </View>
            </View>

            <FlatList
              data={productos}
              renderItem={({ item: producto }) => (
                <View
                  key={producto.id}
                  style={[
                    styles.productoCard,
                    producto.seleccionado && styles.productoCardSeleccionado,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.productoCardContent}
                    onPress={() => toggleProductoSeleccionado(producto)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.productoInfoRow}>
                      <View style={styles.productoInfo}>
                        <Text style={styles.productoNombre}>
                          {producto.nombre}
                        </Text>
                        <Text style={styles.productoCategoria}>
                          {producto.categoria} • Stock:{" "}
                          {producto.stock_disponible}
                        </Text>
                        <Text style={styles.productoPrecio}>
                          Precio costo:{" "}
                          {formatMonedaGlobal(producto.precio_coste)}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.seleccionCheckbox,
                          producto.seleccionado &&
                            styles.seleccionCheckboxActive,
                        ]}
                      >
                        {producto.seleccionado && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>
                    </View>

                    {producto.seleccionado && (
                      <View style={styles.cantidadControls}>
                        <Text style={styles.cantidadLabel}>Cantidad:</Text>
                        <View style={styles.cantidadButtonsContainer}>
                          <TouchableOpacity
                            style={[
                              styles.cantidadButton,
                              (producto.cantidadSeleccionada || 1) <= 1 &&
                                styles.cantidadButtonDisabled,
                            ]}
                            onPress={() =>
                              actualizarCantidadProducto(
                                producto.id,
                                (producto.cantidadSeleccionada || 1) - 1,
                              )
                            }
                            disabled={(producto.cantidadSeleccionada || 1) <= 1}
                          >
                            <Ionicons name="remove" size={20} color="#3b82f6" />
                          </TouchableOpacity>

                          <Text style={styles.cantidadValue}>
                            {producto.cantidadSeleccionada || 1}
                          </Text>

                          <TouchableOpacity
                            style={[
                              styles.cantidadButton,
                              (producto.cantidadSeleccionada || 1) >=
                                producto.stock_disponible &&
                                styles.cantidadButtonDisabled,
                            ]}
                            onPress={() =>
                              actualizarCantidadProducto(
                                producto.id,
                                (producto.cantidadSeleccionada || 1) + 1,
                              )
                            }
                            disabled={
                              (producto.cantidadSeleccionada || 1) >=
                              producto.stock_disponible
                            }
                          >
                            <Ionicons name="add" size={20} color="#3b82f6" />
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.subtotalText}>
                          Subtotal:{" "}
                          {formatMonedaGlobal(
                            producto.precio_coste *
                              (producto.cantidadSeleccionada || 1),
                          )}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              keyExtractor={(item) => item.id.toString()}
              style={styles.productosListScrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.productosListContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.productosEmptyContainer}>
                  <Ionicons name="cube-outline" size={64} color="#d1d5db" />
                  <Text style={styles.productosEmptyTitle}>
                    No hay productos disponibles
                  </Text>
                  <Text style={styles.productosEmptyText}>
                    Este punto no tiene productos en inventario
                  </Text>
                </View>
              }
            />

            <View style={styles.productosModalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, styles.productosCancelButton]}
                onPress={() => setProductosModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, styles.productosSaveButton]}
                onPress={() => {
                  setProductosModalVisible(false);
                }}
              >
                <Ionicons
                  name="checkmark"
                  size={20}
                  color="white"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.saveButtonText}>
                  Seleccionar ({productosSeleccionados.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de filtros */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
        hardwareAccelerated={true}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.filterModalContainer]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar resultados</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[]}
              renderItem={() => null}
              ListHeaderComponent={
                <>
                  {/* Tipo */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Tipo</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={filtroTipo}
                        onValueChange={setFiltroTipo}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todos" value="todos" />
                        <Picker.Item label="Préstamos" value="prestamo" />
                        <Picker.Item label="Deudas" value="deuda" />
                      </Picker>
                    </View>
                  </View>

                  {/* Estado */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Estado</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={filtroEstado}
                        onValueChange={setFiltroEstado}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todos" value="todos" />
                        <Picker.Item label="Pendiente" value="pendiente" />
                        <Picker.Item label="Pagado" value="pagado" />
                        <Picker.Item label="Vencido" value="vencido" />
                      </Picker>
                    </View>
                    <Text style={styles.filterHelpText}>
                      Vencido incluye préstamos con fecha pasada
                    </Text>
                  </View>

                  {/* Punto */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Origen</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={filtroPunto}
                        onValueChange={setFiltroPunto}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todos" value="todos" />
                        <Picker.Item label="General (Personal)" value={null} />
                        <Picker.Item
                          label="Seleccionar punto..."
                          value=""
                          enabled={false}
                        />
                        {puntos.map((punto) => (
                          <Picker.Item
                            key={punto.id}
                            label={punto.nombre}
                            value={punto.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  {/* Fechas */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Fecha desde</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFechaDesdePicker(true)}
                    >
                      <Ionicons name="calendar" size={20} color="#3b82f6" />
                      <Text style={styles.dateButtonText}>
                        {filtroFechaDesde
                          ? filtroFechaDesde.toLocaleDateString("es-ES")
                          : "Seleccionar fecha"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Fecha hasta</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFechaHastaPicker(true)}
                    >
                      <Ionicons name="calendar" size={20} color="#3b82f6" />
                      <Text style={styles.dateButtonText}>
                        {filtroFechaHasta
                          ? filtroFechaHasta.toLocaleDateString("es-ES")
                          : "Seleccionar fecha"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.limpiarFiltrosButton}
                    onPress={limpiarFiltros}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color="#6b7280"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.limpiarFiltrosButtonText}>
                      Limpiar todos los filtros
                    </Text>
                  </TouchableOpacity>
                </>
              }
              style={styles.modalContent}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.filterModalContent}
              keyboardShouldPersistTaps="handled"
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.saveButtonText}>Aplicar filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showFechaInicioPicker && (
        <DateTimePicker
          value={fechaInicio}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowFechaInicioPicker(false);
            if (selectedDate) {
              setFechaInicio(selectedDate);
              if (selectedDate > fechaVencimiento) {
                setFechaVencimiento(selectedDate);
              }
            }
          }}
        />
      )}

      {showFechaVencimientoPicker && (
        <DateTimePicker
          value={fechaVencimiento}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowFechaVencimientoPicker(false);
            if (selectedDate) {
              setFechaVencimiento(selectedDate);
            }
          }}
          minimumDate={fechaInicio}
        />
      )}

      {showFechaDesdePicker && (
        <DateTimePicker
          value={filtroFechaDesde || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowFechaDesdePicker(false);
            if (selectedDate) {
              setFiltroFechaDesde(selectedDate);
            }
          }}
        />
      )}

      {showFechaHastaPicker && (
        <DateTimePicker
          value={filtroFechaHasta || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowFechaHastaPicker(false);
            if (selectedDate) {
              setFiltroFechaHasta(selectedDate);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Mantén tus estilos iguales (no los he cambiado)
const styles = StyleSheet.create({
  safeArea: {
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
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
  },
  statsWrapper: {
    height: 120,
  },
  statsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    minWidth: "100%",
  },
  statCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  filtrosActivosContainer: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filtrosActivosTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  filtrosActivosList: {
    gap: 8,
  },
  filtroBadge: {
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filtroBadgeText: {
    fontSize: 12,
    color: "#4f46e5",
    fontWeight: "500",
  },
  limpiarFiltrosText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "500",
    marginTop: 8,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  itemCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  itemCardVencido: {
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  itemCardPagado: {
    opacity: 0.7,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemTipoContainer: {
    flexDirection: "row",
    gap: 8,
  },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tipoPrestamo: {
    backgroundColor: "#d1fae5",
  },
  tipoDeuda: {
    backgroundColor: "#fef3c7",
  },
  tipoBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065f46",
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  estadoPendiente: {
    backgroundColor: "#dbeafe",
  },
  estadoPagado: {
    backgroundColor: "#d1fae5",
  },
  estadoVencido: {
    backgroundColor: "#fee2e2",
  },
  estadoBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1e40af",
  },
  itemMonto: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  itemDescripcion: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  itemInfoContainer: {
    gap: 8,
    marginBottom: 16,
  },
  itemInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemInfoText: {
    fontSize: 14,
    color: "#6b7280",
    flex: 1,
  },
  diasRestantes: {
    fontSize: 12,
    fontWeight: "600",
  },
  diasPoco: {
    color: "#dc2626",
  },
  diasNormal: {
    color: "#059669",
  },
  diasVencido: {
    color: "#dc2626",
    fontStyle: "italic",
  },
  itemActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  actionButtonDelete: {
    backgroundColor: "#fef2f2",
  },
  actionButtonText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "500",
  },
  actionButtonDeleteText: {
    color: "#dc2626",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.9,
  },
  filterModalContainer: {
    maxHeight: height * 0.8,
  },
  productosModalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.85,
    width: "100%",
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
    fontWeight: "800",
    color: "#111827",
  },
  modalContent: {
    padding: 20,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  filterModalContent: {
    paddingBottom: 20,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 0,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  tipoSelector: {
    flexDirection: "row",
    gap: 8,
  },
  tipoOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  tipoOptionSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  tipoOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  tipoOptionTextSelected: {
    color: "white",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  fechasContainer: {
    flexDirection: isTablet ? "row" : "column",
    gap: 16,
  },
  fechaGroup: {
    flex: 1,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: "#111827",
  },
  limpiarFiltrosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  limpiarFiltrosButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  // Estilos para productos en el modal principal
  productosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productosButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
  },
  productosButtonText: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "500",
  },
  productosResumen: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  productosResumenTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  productoResumenItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  productoResumenInfo: {
    flex: 1,
  },
  productoNombre: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  productoDetalle: {
    fontSize: 12,
    color: "#6b7280",
  },
  eliminarProductoButton: {
    padding: 4,
  },
  montoCalculado: {
    fontSize: 20,
    fontWeight: "800",
    color: "#059669",
    marginBottom: 4,
  },
  montoInfo: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  // Estilos para el modal de productos
  productosModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  productosModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  closeButton: {
    padding: 4,
  },
  productosModalStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  productosModalStat: {
    alignItems: "center",
  },
  productosModalStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  productosModalStatLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  productosListScrollView: {
    flex: 1,
  },
  productosListContent: {
    padding: 20,
    paddingBottom: 20,
  },
  productoCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  productoCardSeleccionado: {
    borderColor: "#3b82f6",
    backgroundColor: "#f0f9ff",
  },
  productoCardContent: {
    padding: 16,
  },
  productoInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productoInfo: {
    flex: 1,
  },
  productoCategoria: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  productoPrecio: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "500",
  },
  seleccionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  seleccionCheckboxActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  cantidadControls: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  cantidadLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  cantidadButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    maxWidth: 150,
  },
  cantidadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  cantidadButtonDisabled: {
    backgroundColor: "#f3f4f6",
    opacity: 0.5,
  },
  cantidadValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    minWidth: 40,
    textAlign: "center",
  },
  subtotalText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
    textAlign: "right",
  },
  productosEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  productosEmptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  productosEmptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  productosModalFooter: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 0,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  productosCancelButton: {
    flex: 1,
  },
  productosSaveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  filterHelpText: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: 4,
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
