// app/agenda.tsx
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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import { PuntoHelper } from "../src/db/databaseHelper";
import {
  AgendaService,
  EventoAgenda,
  NuevoEvento,
} from "../src/db/services/agenda_service";
import { AuthService } from "../src/db/services/auth_service";

const { width } = Dimensions.get("window");

// Tipo para Punto
interface Punto {
  id: number;
  nombre: string;
  tipo_negocio: "punto" | "panaderia";
}

// Componente memoizado para items
const EventoItem = React.memo(function EventoItem({
  item,
  onEdit,
  onDelete,
  onToggleComplete,
}: {
  item: EventoAgenda;
  onEdit: (item: EventoAgenda) => void;
  onDelete: (id: number) => void;
  onToggleComplete: (id: number, estado: "pendiente" | "completado") => void;
}) {
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

  // Formatear hora
  const formatHora = (horaString: string) => {
    try {
      const [horas, minutos] = horaString.split(":");
      return `${horas}:${minutos}`;
    } catch {
      return horaString;
    }
  };

  // Determinar si está para hoy
  const esHoy = useMemo(() => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaEvento = new Date(item.fecha);
      fechaEvento.setHours(0, 0, 0, 0);
      return fechaEvento.getTime() === hoy.getTime();
    } catch {
      return false;
    }
  }, [item.fecha]);

  const estadoActual = item.estado;

  return (
    <TouchableOpacity
      style={[
        styles.itemCard,
        estadoActual === "completado" && styles.itemCardCompletado,
        estadoActual === "cancelado" && styles.itemCardCancelado,
        esHoy && styles.itemCardHoy,
      ]}
      onPress={() => onEdit(item)}
      activeOpacity={0.8}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemTipoContainer}>
          <View
            style={[
              styles.tipoBadge,
              item.tipo === "cita"
                ? styles.tipoCita
                : item.tipo === "recordatorio"
                  ? styles.tipoRecordatorio
                  : styles.tipoEvento,
            ]}
          >
            <Text style={styles.tipoBadgeText}>
              {item.tipo === "cita"
                ? "CITA"
                : item.tipo === "recordatorio"
                  ? "RECORDATORIO"
                  : "EVENTO"}
            </Text>
          </View>
          <View
            style={[
              styles.prioridadBadge,
              item.prioridad === "alta"
                ? styles.prioridadAlta
                : item.prioridad === "media"
                  ? styles.prioridadMedia
                  : styles.prioridadBaja,
            ]}
          >
            <Text style={styles.prioridadBadgeText}>
              {item.prioridad.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.itemFechaContainer}>
          <Text style={styles.itemFecha}>{formatFecha(item.fecha)}</Text>
          <Text style={styles.itemHora}>{formatHora(item.hora)}</Text>
        </View>
      </View>

      <View style={styles.itemTitleContainer}>
        <Text style={styles.itemTitulo}>{item.titulo}</Text>
        {item.es_recurrente === 1 && (
          <View style={styles.recurrenteBadge}>
            <Ionicons name="repeat" size={12} color="#8b5cf6" />
            <Text style={styles.recurrenteBadgeText}>
              {item.tipo_repeticion === "mensual" ? "Mensual" : "Semanal"}
            </Text>
          </View>
        )}
      </View>

      {item.descripcion && (
        <Text style={styles.itemDescripcion} numberOfLines={2}>
          {item.descripcion}
        </Text>
      )}

      <View style={styles.itemInfoContainer}>
        {item.ubicacion && (
          <View style={styles.itemInfoRow}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.itemInfoText}>{item.ubicacion}</Text>
          </View>
        )}

        <View style={styles.itemInfoRow}>
          <Ionicons name="business-outline" size={16} color="#6b7280" />
          <Text style={styles.itemInfoText}>
            {item.punto_nombre || "General"}
          </Text>
        </View>

        <View style={styles.itemInfoRow}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.itemInfoText}>
            {esHoy ? "Hoy" : `Programado`}
          </Text>
          <View
            style={[
              styles.estadoIndicator,
              estadoActual === "pendiente"
                ? styles.estadoPendiente
                : estadoActual === "completado"
                  ? styles.estadoCompletado
                  : styles.estadoCancelado,
            ]}
          />
        </View>
      </View>

      <View style={styles.itemActions}>
        {estadoActual === "pendiente" && item.es_recurrente === 0 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onToggleComplete(item.id, "completado")}
          >
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.actionButtonText}>Completar</Text>
          </TouchableOpacity>
        )}

        {estadoActual === "completado" && item.es_recurrente === 0 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onToggleComplete(item.id, "pendiente")}
          >
            <Ionicons name="refresh-circle" size={20} color="#f59e0b" />
            <Text style={styles.actionButtonText}>Reabrir</Text>
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
            key: "total_pendientes",
            value: estadisticas.total_pendientes,
            label: "Pendientes",
          },
          {
            key: "total_hoy",
            value: estadisticas.total_hoy,
            label: "Hoy",
          },
          {
            key: "total_semana",
            value: estadisticas.total_semana,
            label: "Esta Semana",
          },
          {
            key: "total_completados",
            value: estadisticas.total_completados,
            label: "Completados",
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
  filtroFecha,
  puntos,
  limpiarFiltros,
}: {
  filtroTipo: string;
  filtroEstado: string;
  filtroPunto: any;
  filtroFecha: string;
  puntos: Punto[];
  limpiarFiltros: () => void;
}) {
  const hayFiltros =
    filtroTipo !== "todos" ||
    filtroEstado !== "todos" ||
    filtroPunto !== "todos" ||
    filtroFecha !== "todos";

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
                  text: `Tipo: ${filtroTipo === "cita" ? "Citas" : filtroTipo === "recordatorio" ? "Recordatorios" : "Eventos"}`,
                },
              ]
            : []),
          ...(filtroEstado !== "todos"
            ? [{ id: "estado", text: `Estado: ${filtroEstado}` }]
            : []),
          ...(filtroPunto !== "todos"
            ? [{ id: "punto", text: getPuntoNombre() }]
            : []),
          ...(filtroFecha !== "todos"
            ? [{ id: "fecha", text: `Fecha: ${filtroFecha}` }]
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
      <Ionicons name="calendar-outline" size={64} color="#9ca3af" />
      <Text style={styles.emptyTitle}>No hay eventos</Text>
      <Text style={styles.emptyText}>
        {filtroTipo !== "todos" ||
        filtroEstado !== "todos" ||
        filtroPunto !== "todos"
          ? "Intenta cambiar los filtros"
          : "Agrega tu primer evento a la agenda"}
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

export default function AgendaScreen() {
  const router = useRouter();

  // Guardar estado de navegación automáticamente
  useSaveNavigationState("/agenda");

  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados para formulario
  const [editando, setEditando] = useState(false);
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<"cita" | "recordatorio" | "evento">("cita");
  const [fecha, setFecha] = useState(new Date());
  const [hora, setHora] = useState("12:00");
  const [puntoId, setPuntoId] = useState<number | null>(null);
  const [ubicacion, setUbicacion] = useState("");
  const [prioridad, setPrioridad] = useState<"baja" | "media" | "alta">(
    "media",
  );
  const [notas, setNotas] = useState("");

  // Estados para repetición y selector de hora
  const [repetir, setRepetir] = useState(false);
  const [tipoRepeticion, setTipoRepeticion] = useState<"mensual" | "diario">(
    "mensual",
  );
  const [diaSemana, setDiaSemana] = useState<string>("lunes");
  const [showHoraPicker, setShowHoraPicker] = useState(false);
  const [horaSeleccionada, setHoraSeleccionada] = useState(new Date());

  // Estados para filtros
  const [filtroTipo, setFiltroTipo] = useState<
    "todos" | "cita" | "recordatorio" | "evento"
  >("todos");
  const [filtroEstado, setFiltroEstado] = useState<
    "todos" | "pendiente" | "completado" | "cancelado"
  >("todos");
  const [filtroPunto, setFiltroPunto] = useState<number | null | "todos">(
    "todos",
  );
  const [filtroFecha, setFiltroFecha] = useState<
    "todos" | "hoy" | "semana" | "mes"
  >("todos");

  // Refs para control
  const flatListRef = useRef<FlatList>(null);
  const filtrosActualesRef = useRef({
    tipo: filtroTipo,
    estado: filtroEstado,
    punto: filtroPunto,
    fecha: filtroFecha,
  });

  // Cargar datos
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Cargar datos en paralelo con límites
      const [eventosData, puntosData, statsData] = await Promise.all([
        // Usar helper real de AgendaService
        AgendaService.getAll(100).catch((e) => {
          console.error("Error cargando eventos:", e);
          return [] as EventoAgenda[];
        }),
        PuntoHelper.getAll(50).catch((e) => {
          console.error("Error cargando puntos:", e);
          return [];
        }),
        // Usar helper real de estadísticas
        AgendaService.getEstadisticas().catch((e) => {
          console.error("Error cargando estadísticas:", e);
          return null;
        }),
      ]);

      setEventos(eventosData as EventoAgenda[]);
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

  // Resetear formulario
  const resetFormulario = useCallback(() => {
    setEditando(false);
    setIdEditando(null);
    setTitulo("");
    setDescripcion("");
    setTipo("cita");
    setFecha(new Date());
    setHora("12:00");
    setPuntoId(null);
    setUbicacion("");
    setPrioridad("media");
    setNotas("");
    // Resetear estados de repetición
    setRepetir(false);
    setTipoRepeticion("mensual");
    setDiaSemana("lunes");
    setHoraSeleccionada(new Date());
  }, []);

  // Guardar evento
  const guardarEvento = useCallback(async () => {
    if (!titulo.trim()) {
      Alert.alert("Error", "El título es requerido");
      return;
    }

    try {
      setLoading(true);

      const fechaStr = fecha.toISOString().split("T")[0];

      if (editando && idEditando) {
        // Actualizar evento usando AgendaService
        const exitoso = await AgendaService.update(idEditando, {
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          tipo,
          fecha: fechaStr,
          hora,
          punto_id: puntoId,
          ubicacion: ubicacion.trim(),
          prioridad,
          notas: notas.trim(),
        });

        if (exitoso) {
          Alert.alert("Éxito", "Evento actualizado correctamente");
        } else {
          throw new Error("No se pudo actualizar el evento");
        }
      } else {
        // Crear evento usando AgendaService
        const nuevoEvento: NuevoEvento = {
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          tipo,
          fecha: fechaStr,
          hora,
          punto_id: puntoId,
          ubicacion: ubicacion.trim(),
          prioridad,
          notas: notas.trim(),
          es_recurrente: repetir ? 1 : 0,
          tipo_repeticion: repetir ? tipoRepeticion : undefined,
          dia_semana:
            repetir && tipoRepeticion === "diario" ? diaSemana : undefined,
        };

        const id = await AgendaService.create(nuevoEvento);
        if (!id) {
          throw new Error("No se pudo crear el evento");
        }

        Alert.alert("Éxito", "Evento creado correctamente");
      }

      await fetchData();
      setModalVisible(false);
      resetFormulario();
    } catch (error: any) {
      console.error("❌ Error guardando evento:", error);
      Alert.alert("Error", error.message || "No se pudo guardar el evento");
    } finally {
      setLoading(false);
    }
  }, [
    titulo,
    descripcion,
    tipo,
    fecha,
    hora,
    puntoId,
    ubicacion,
    prioridad,
    notas,
    repetir,
    tipoRepeticion,
    diaSemana,
    editando,
    idEditando,
    fetchData,
    resetFormulario,
  ]);

  // Editar evento
  const editarEvento = useCallback((item: EventoAgenda) => {
    setEditando(true);
    setIdEditando(item.id);
    setTitulo(item.titulo);
    setDescripcion(item.descripcion || "");
    setTipo(item.tipo);
    setFecha(new Date(item.fecha));
    setHora(item.hora);
    setPuntoId(item.punto_id);
    setUbicacion(item.ubicacion || "");
    setPrioridad(item.prioridad);
    setNotas(item.notas || "");
    setModalVisible(true);
  }, []);

  // Cambiar estado
  const cambiarEstado = useCallback(
    async (id: number, nuevoEstado: "pendiente" | "completado") => {
      try {
        const exitoso = await AgendaService.update(id, { estado: nuevoEstado });

        if (exitoso) {
          // Actualizar localmente
          setEventos((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    estado: nuevoEstado,
                    actualizado_en: new Date().toISOString(),
                  }
                : item,
            ),
          );

          // Actualizar estadísticas
          await fetchData();

          Alert.alert(
            "Éxito",
            nuevoEstado === "completado"
              ? "Evento marcado como completado"
              : "Evento reabierto",
          );
        } else {
          Alert.alert("Error", "No se pudo actualizar el estado del evento");
        }
      } catch (error: any) {
        console.error("❌ Error cambiando estado:", error);
        Alert.alert("Error", "No se pudo cambiar el estado");
      }
    },
    [],
  );

  // Eliminar evento
  const eliminarEvento = useCallback(async (id: number) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de que quieres eliminar este evento?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const exitoso = await AgendaService.delete(id);
              if (exitoso) {
                Alert.alert("Éxito", "Evento eliminado correctamente");

                // Actualizar lista localmente
                setEventos((prev) => prev.filter((item) => item.id !== id));

                // Actualizar estadísticas
                await fetchData();
              } else {
                Alert.alert("Error", "No se encontró el evento para eliminar");
              }
            } catch (error: any) {
              console.error("❌ Error eliminando:", error);
              Alert.alert("Error", "No se pudo eliminar el evento");
            }
          },
        },
      ],
    );
  }, []);

  // Aplicar filtros
  const eventosFiltrados = useMemo(() => {
    // Actualizar ref
    filtrosActualesRef.current = {
      tipo: filtroTipo,
      estado: filtroEstado,
      punto: filtroPunto,
      fecha: filtroFecha,
    };

    // Si no hay filtros activos, devolver todos
    const hayFiltros =
      filtroTipo !== "todos" ||
      filtroEstado !== "todos" ||
      filtroPunto !== "todos" ||
      filtroFecha !== "todos";

    if (!hayFiltros) {
      return eventos;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return eventos.filter((item) => {
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
      if (filtroEstado !== "todos" && item.estado !== filtroEstado)
        return false;

      // Filtro por fecha
      if (filtroFecha !== "todos") {
        try {
          const fechaItem = new Date(item.fecha);
          fechaItem.setHours(0, 0, 0, 0);

          if (filtroFecha === "hoy") {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            if (fechaItem.getTime() !== hoy.getTime()) return false;
          } else if (filtroFecha === "semana") {
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - hoy.getDay());
            inicioSemana.setHours(0, 0, 0, 0);
            const finSemana = new Date(inicioSemana);
            finSemana.setDate(inicioSemana.getDate() + 6);
            finSemana.setHours(23, 59, 59, 999);
            if (fechaItem < inicioSemana || fechaItem > finSemana) return false;
          } else if (filtroFecha === "mes") {
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            if (fechaItem < inicioMes || fechaItem > finMes) return false;
          }
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [eventos, filtroTipo, filtroEstado, filtroPunto, filtroFecha]);

  // Limpiar filtros
  const limpiarFiltros = useCallback(() => {
    setFiltroTipo("todos");
    setFiltroEstado("todos");
    setFiltroPunto("todos");
    setFiltroFecha("todos");

    // Scroll al top
    flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
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
        data={eventosFiltrados}
        renderItem={({ item }) => (
          <EventoItem
            item={item}
            onEdit={editarEvento}
            onDelete={eliminarEvento}
            onToggleComplete={cambiarEstado}
          />
        )}
        keyExtractor={(item) => `evento-${item.id}`}
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
              filtroFecha={filtroFecha}
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
  const [showFechaPicker, setShowFechaPicker] = useState(false);

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
            <Text style={styles.headerTitle}>Agenda</Text>
            <Text style={styles.headerSubtitle}>
              Gestiona tus citas y recordatorios
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
          <View style={styles.formModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editando ? "Editar" : "Nuevo"}{" "}
                {tipo === "cita"
                  ? "Cita"
                  : tipo === "recordatorio"
                    ? "Recordatorio"
                    : "Evento"}
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

            <ScrollView
              style={styles.formModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Título *</Text>
                <TextInput
                  style={styles.formInput}
                  value={titulo}
                  onChangeText={setTitulo}
                  placeholder="Ej: Reunión con cliente"
                  maxLength={100}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Descripción</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  placeholder="Detalles adicionales..."
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Tipo</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={tipo}
                      onValueChange={setTipo}
                      style={styles.picker}
                    >
                      <Picker.Item label="Cita" value="cita" />
                      <Picker.Item label="Recordatorio" value="recordatorio" />
                      <Picker.Item label="Evento" value="evento" />
                    </Picker>
                  </View>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Prioridad</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={prioridad}
                      onValueChange={setPrioridad}
                      style={styles.picker}
                    >
                      <Picker.Item label="Baja" value="baja" />
                      <Picker.Item label="Media" value="media" />
                      <Picker.Item label="Alta" value="alta" />
                    </Picker>
                  </View>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Fecha</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowFechaPicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {fecha.toLocaleDateString("es-ES")}
                    </Text>
                    <Ionicons name="calendar" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Hora</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowHoraPicker(true)}
                  >
                    <Text style={styles.dateButtonText}>{hora}</Text>
                    <Ionicons name="time-outline" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Punto de Venta</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={puntoId}
                    onValueChange={setPuntoId}
                    style={styles.picker}
                  >
                    <Picker.Item label="General" value={null} />
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

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ubicación</Text>
                <TextInput
                  style={styles.formInput}
                  value={ubicacion}
                  onChangeText={setUbicacion}
                  placeholder="Ej: Oficina principal, Tienda..."
                  maxLength={100}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notas adicionales</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={notas}
                  onChangeText={setNotas}
                  placeholder="Información extra..."
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>

              {/* Sección de repetición */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.formLabel}>Repetir evento</Text>
                  <TouchableOpacity
                    style={[styles.switch, repetir && styles.switchActive]}
                    onPress={() => setRepetir(!repetir)}
                  >
                    <View
                      style={[
                        styles.switchThumb,
                        repetir && styles.switchThumbActive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {repetir && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Tipo de repetición</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={tipoRepeticion}
                        onValueChange={setTipoRepeticion}
                        style={styles.picker}
                      >
                        <Picker.Item label="Mensual" value="mensual" />
                        <Picker.Item label="Semanal" value="diario" />
                      </Picker>
                    </View>
                  </View>

                  {tipoRepeticion === "diario" && (
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Día de la semana</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={diaSemana}
                          onValueChange={setDiaSemana}
                          style={styles.picker}
                        >
                          <Picker.Item label="Lunes" value="lunes" />
                          <Picker.Item label="Martes" value="martes" />
                          <Picker.Item label="Miércoles" value="miércoles" />
                          <Picker.Item label="Jueves" value="jueves" />
                          <Picker.Item label="Viernes" value="viernes" />
                          <Picker.Item label="Sábado" value="sábado" />
                          <Picker.Item label="Domingo" value="domingo" />
                        </Picker>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.formModalFooter}>
              <TouchableOpacity
                style={[styles.formModalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  resetFormulario();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formModalButton, styles.saveButton]}
                onPress={guardarEvento}
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

      {/* Modal de filtros */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity
                  onPress={async () => {
                    // Resetear filtros
                    setFiltroTipo("todos");
                    setFiltroEstado("todos");
                    setFiltroPunto("todos");
                    setFiltroFecha("todos");

                    // Recargar todos los eventos
                    try {
                      setLoading(true);
                      await fetchData();
                    } catch (error) {
                      console.error("Error limpiando filtros:", error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={styles.filterResetButton}
                >
                  <Ionicons name="refresh-outline" size={20} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.filterModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={filtroTipo}
                    onValueChange={setFiltroTipo}
                    style={styles.picker}
                  >
                    <Picker.Item label="Todos" value="todos" />
                    <Picker.Item label="Citas" value="cita" />
                    <Picker.Item label="Recordatorios" value="recordatorio" />
                    <Picker.Item label="Eventos" value="evento" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Estado</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={filtroEstado}
                    onValueChange={setFiltroEstado}
                    style={styles.picker}
                  >
                    <Picker.Item label="Todos" value="todos" />
                    <Picker.Item label="Pendientes" value="pendiente" />
                    <Picker.Item label="Completados" value="completado" />
                    <Picker.Item label="Cancelados" value="cancelado" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Punto de Venta</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={filtroPunto}
                    onValueChange={setFiltroPunto}
                    style={styles.picker}
                  >
                    <Picker.Item label="Todos" value="todos" />
                    <Picker.Item label="General" value={null} />
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

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fecha</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={filtroFecha}
                    onValueChange={setFiltroFecha}
                    style={styles.picker}
                  >
                    <Picker.Item label="Todos" value="todos" />
                    <Picker.Item label="Hoy" value="hoy" />
                    <Picker.Item label="Esta Semana" value="semana" />
                    <Picker.Item label="Este Mes" value="mes" />
                  </Picker>
                </View>
              </View>
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={async () => {
                  try {
                    setLoading(true);
                    const filtros: FiltrosAgenda = {
                      tipo: filtroTipo as any,
                      estado: filtroEstado as any,
                      punto_id: filtroPunto as any,
                      fecha: filtroFecha as any,
                    };

                    const eventosFiltrados = await AgendaService.getAll(
                      100,
                      filtros,
                    );
                    setEventos(eventosFiltrados);
                    setFilterModalVisible(false);
                  } catch (error: any) {
                    console.error("❌ Error aplicando filtros:", error);
                    Alert.alert("Error", "No se pudieron aplicar los filtros");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {showFechaPicker && (
        <DateTimePicker
          value={fecha}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowFechaPicker(Platform.OS === "ios");
            if (selectedDate) {
              setFecha(selectedDate);
            }
          }}
        />
      )}

      {/* Time Picker Modal */}
      {showHoraPicker && (
        <DateTimePicker
          value={horaSeleccionada}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedTime) => {
            setShowHoraPicker(Platform.OS === "ios");
            if (selectedTime) {
              setHoraSeleccionada(selectedTime);
              // Formatear hora a HH:MM
              const horas = selectedTime.getHours().toString().padStart(2, "0");
              const minutos = selectedTime
                .getMinutes()
                .toString()
                .padStart(2, "0");
              setHora(`${horas}:${minutos}`);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  filterButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
  },
  addButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
  },
  listContainer: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  itemCardCompletado: {
    opacity: 0.7,
    borderLeftColor: "#10b981",
  },
  itemCardCancelado: {
    opacity: 0.5,
    borderLeftColor: "#ef4444",
  },
  itemCardHoy: {
    backgroundColor: "#fef3c7",
    borderLeftColor: "#f59e0b",
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
    borderRadius: 12,
    minWidth: 60,
    alignItems: "center",
  },
  tipoCita: {
    backgroundColor: "#dbeafe",
  },
  tipoRecordatorio: {
    backgroundColor: "#fce7f3",
  },
  tipoEvento: {
    backgroundColor: "#e0e7ff",
  },
  tipoBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1e40af",
  },
  prioridadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 40,
    alignItems: "center",
  },
  prioridadAlta: {
    backgroundColor: "#fee2e2",
  },
  prioridadMedia: {
    backgroundColor: "#fef3c7",
  },
  prioridadBaja: {
    backgroundColor: "#f0fdf4",
  },
  prioridadBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#374151",
  },
  itemFechaContainer: {
    alignItems: "flex-end",
  },
  itemFecha: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  itemHora: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  itemTitulo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  itemDescripcion: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  itemInfoContainer: {
    gap: 8,
    marginBottom: 12,
  },
  itemInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemInfoText: {
    fontSize: 13,
    color: "#6b7280",
    flex: 1,
  },
  estadoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estadoPendiente: {
    backgroundColor: "#f59e0b",
  },
  estadoCompletado: {
    backgroundColor: "#10b981",
  },
  estadoCancelado: {
    backgroundColor: "#ef4444",
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  actionButtonDelete: {
    backgroundColor: "#fef2f2",
  },
  actionButtonDeleteText: {
    color: "#ef4444",
  },
  statsWrapper: {
    marginBottom: 16,
  },
  statsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    minWidth: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  filtrosActivosContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  filtrosActivosTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  filtrosActivosList: {
    gap: 8,
  },
  filtroBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filtroBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1e40af",
  },
  limpiarFiltrosText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
    textAlign: "center",
    marginTop: 12,
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
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },
  emptyButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
  },
  formModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 20,
    maxHeight: "85%",
    width: "90%",
  },
  filterModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 20,
    maxHeight: "85%",
    width: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterResetButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  modalContent: {
    padding: 20,
    maxHeight: "60%",
  },
  formModalContent: {
    padding: 20,
    paddingBottom: 8,
    maxHeight: "75%",
  },
  filterModalContent: {
    padding: 20,
    maxHeight: "75%",
  },
  formModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 12,
  },
  filterModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  formModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
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
  applyButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  applyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: "row",
    gap: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1f2937",
  },
  formInputMultiline: {
    height: 80,
    textAlignVertical: "top",
  },
  pickerContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  dateButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateButtonText: {
    fontSize: 14,
    color: "#1f2937",
  },
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
  // Estilos para switch de repetición
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switch: {
    width: 48,
    height: 28,
    backgroundColor: "#d1d5db",
    borderRadius: 14,
    padding: 2,
    justifyContent: "center",
  },
  switchActive: {
    backgroundColor: "#3b82f6",
  },
  switchThumb: {
    width: 24,
    height: 24,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  // Estilos para eventos recurrentes
  itemTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  recurrenteBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede9fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  recurrenteBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8b5cf6",
  },
});
