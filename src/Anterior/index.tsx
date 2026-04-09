// app/index.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { initDatabase } from "../src/db/database";
import {
    OfertaHelper,
    PrestamoDeudaHelper,
    ProductoHelper,
    PuntoHelper,
} from "../src/db/databaseHelper";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalDineroAlmacen, setTotalDineroAlmacen] = useState(0);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [productosVencidos, setProductosVencidos] = useState(0);
  const [productosPorVencer, setProductosPorVencer] = useState(0);
  const [prestamosVencidos, setPrestamosVencidos] = useState(0);
  const [prestamosProximos, setPrestamosProximos] = useState(0);
  const [totalPrestamosPendientes, setTotalPrestamosPendientes] = useState(0);
  const router = useRouter();

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
      const vencidos = productosProximosAVencer.filter(
        (p) => p.dias_restantes <= 0,
      );
      const porVencer = productosProximosAVencer.filter(
        (p) => p.dias_restantes > 0 && p.dias_restantes <= 30,
      );

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

        // Cargar datos
        await fetchData();
      } catch (error) {
        console.error("❌ Error initializing app:", error);
        Alert.alert("Error", "No se pudo inicializar la aplicación");
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const navegarAPunto = () => {
    router.push("/punto");
  };

  const navegarAPrestamos = () => {
    router.push("/prestamos");
  };

  const navegarAAlmacenes = () => {
    router.push("/almacenes");
  };

  const recargarDatos = () => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
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

  const stats = [
    {
      label: "Dinero en Almacén",
      value: formatMoneda(totalDineroAlmacen),
      icon: "💰",
    },
    { label: "Ventas Hoy", value: formatMoneda(ventasHoy), icon: "📈" },
    { label: "Gastos Hoy", value: formatMoneda(0), icon: "💸" },
    {
      label: "Última Actualización",
      value: formatHora(new Date()),
      icon: "⏰",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
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
                <Text style={styles.statusText}>Conectado</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={recargarDatos}>
              <Text style={styles.refreshIcon}>↻</Text>
            </TouchableOpacity>
            <View style={styles.userAvatar}>
              <Text style={styles.userIcon}>👤</Text>
            </View>
          </View>
        </View>
      </View>

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
        {/* Stats Cards */}
        <View
          style={[
            styles.statsGrid,
            isDesktop
              ? styles.statsGridDesktop
              : isTablet
                ? styles.statsGridTablet
                : {},
          ]}
        >
          {stats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <View style={styles.statContent}>
                <View>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statIcon}>{stat.icon}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Botones Principales - ALMACENES, PUNTO DE VENTA Y PRÉSTAMOS/DEUDA */}
        <View
          style={[
            styles.mainButtonsGrid,
            isTablet && styles.mainButtonsGridTablet,
          ]}
        >
          {/* Botón Almacenes */}
          <TouchableOpacity
            style={styles.buttonCardContainer}
            onPress={navegarAAlmacenes}
            activeOpacity={0.9}
          >
            <View style={[styles.buttonCard, styles.buttonCardAlmacenes]}>
              <View style={styles.buttonCardHeader}>
                <View style={styles.buttonIconCircleAlmacenes}>
                  <Text style={styles.buttonIcon}>📦</Text>
                </View>
                <View style={styles.buttonCardBadgeAlmacenes}>
                  <Text style={styles.buttonCardBadgeAlmacenesText}>
                    INVENTARIO
                  </Text>
                </View>
              </View>
              <View style={styles.buttonCardContent}>
                <Text style={styles.buttonCardTitle}>Almacenes</Text>
                <Text style={styles.buttonCardDescription}>
                  Gestiona múltiples almacenes, controla inventario,
                  transferencias entre almacenes y puntos. Administra tu stock
                  centralizado.
                </Text>
                <View style={styles.buttonCardFeatures}>
                  <View style={styles.featureBadgeAlmacenes}>
                    <Text style={styles.featureBadgeAlmacenesText}>
                      📦 Múltiples
                    </Text>
                  </View>
                  <View style={styles.featureBadgeAlmacenes}>
                    <Text style={styles.featureBadgeAlmacenesText}>
                      🔄 Transferencias
                    </Text>
                  </View>
                  <View style={styles.featureBadgeAlmacenes}>
                    <Text style={styles.featureBadgeAlmacenesText}>
                      📊 Inventario
                    </Text>
                  </View>
                  <View style={styles.featureBadgeAlmacenes}>
                    <Text style={styles.featureBadgeAlmacenesText}>
                      🏭 Centralizado
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.buttonCardFooter}>
                <Text style={styles.buttonActionText}>Gestionar ahora</Text>
                <View style={styles.buttonArrowContainer}>
                  <Text style={styles.buttonArrow}>→</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Botón Punto de Venta */}
          <TouchableOpacity
            style={styles.buttonCardContainer}
            onPress={navegarAPunto}
            activeOpacity={0.9}
          >
            <View style={styles.buttonCard}>
              <View style={styles.buttonCardHeader}>
                <View style={styles.buttonIconCirclePunto}>
                  <Text style={styles.buttonIcon}>🏪</Text>
                </View>
                <View style={styles.buttonCardBadgePunto}>
                  <Text style={styles.buttonCardBadgePuntoText}>PRINCIPAL</Text>
                </View>
              </View>
              <View style={styles.buttonCardContent}>
                <Text style={styles.buttonCardTitle}>Punto de Venta</Text>
                <Text style={styles.buttonCardDescription}>
                  Controla almacen, ventas, ganancias, cierres de caja, listas
                  de precios, ONAT, gestiona todos tus gastos, prestamos y
                  deudas.
                </Text>
                <View style={styles.buttonCardFeatures}>
                  <View style={styles.featureBadgePunto}>
                    <Text style={styles.featureBadgePuntoText}>🛒 Ventas</Text>
                  </View>
                  <View style={styles.featureBadgePunto}>
                    <Text style={styles.featureBadgePuntoText}>
                      📊 Ganancia
                    </Text>
                  </View>
                  <View style={styles.featureBadgePunto}>
                    <Text style={styles.featureBadgePuntoText}>🧮 Cierre</Text>
                  </View>
                  <View style={styles.featureBadgePunto}>
                    <Text style={styles.featureBadgePuntoText}>🏛️ ONAT</Text>
                  </View>
                </View>
              </View>
              <View style={styles.buttonCardFooter}>
                <Text style={styles.buttonActionText}>Acceder ahora</Text>
                <View style={styles.buttonArrowContainer}>
                  <Text style={styles.buttonArrow}>→</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Botón Préstamos/Deuda */}
          <TouchableOpacity
            style={styles.buttonCardContainer}
            onPress={navegarAPrestamos}
            activeOpacity={0.9}
          >
            <View style={[styles.buttonCard, styles.buttonCardPrestamos]}>
              <View style={styles.buttonCardHeader}>
                <View style={styles.buttonIconCirclePrestamos}>
                  <Text style={styles.buttonIcon}>🤝</Text>
                </View>
                <View style={styles.buttonCardBadgePrestamos}>
                  <Text style={styles.buttonCardBadgePrestamosText}>
                    FINANZAS
                  </Text>
                </View>
              </View>
              <View style={styles.buttonCardContent}>
                <Text style={styles.buttonCardTitle}>Préstamos / Deuda</Text>
                <Text style={styles.buttonCardDescription}>
                  Gestiona todos tus préstamos, deudas, pagos y cobros. Controla
                  intereses, plazos y estado de cada operación financiera.
                </Text>
                <View style={styles.buttonCardFeatures}>
                  <View style={styles.featureBadgePrestamos}>
                    <Text style={styles.featureBadgePrestamosText}>
                      💳 Préstamos
                    </Text>
                  </View>
                  <View style={styles.featureBadgePrestamos}>
                    <Text style={styles.featureBadgePrestamosText}>
                      📋 Deudas
                    </Text>
                  </View>
                  <View style={styles.featureBadgePrestamos}>
                    <Text style={styles.featureBadgePrestamosText}>
                      📅 Pagos
                    </Text>
                  </View>
                  <View style={styles.featureBadgePrestamos}>
                    <Text style={styles.featureBadgePrestamosText}>
                      📊 Estado
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.buttonCardFooter}>
                <Text style={styles.buttonActionText}>Gestionar ahora</Text>
                <View style={styles.buttonArrowContainer}>
                  <Text style={styles.buttonArrow}>→</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Panel de Alertas de Productos */}
        <View style={styles.alertPanel}>
          <View
            style={[
              styles.alertPanelHeader,
              isTablet && styles.alertPanelHeaderTablet,
            ]}
          >
            <View style={styles.alertPanelTitle}>
              <View style={styles.alertIconContainer}>
                <Text style={styles.alertIcon}>⚠️</Text>
              </View>
              <View>
                <Text style={styles.alertPanelTitleText}>
                  Alertas de Productos
                </Text>
                <Text style={styles.alertPanelSubtitle}>
                  Productos que requieren atención inmediata
                </Text>
              </View>
            </View>

            <View style={styles.alertBadges}>
              <View style={styles.badgeDanger}>
                <Text style={styles.badgeIcon}>🔴</Text>
                <Text style={styles.badgeText}>
                  {productosVencidos} VENCIDOS
                </Text>
              </View>
              <View style={styles.badgeWarning}>
                <Text style={styles.badgeIcon}>🟠</Text>
                <Text style={[styles.badgeText, styles.badgeWarningText]}>
                  {productosPorVencer} POR VENCER
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.alertPanelBody}>
            {productosVencidos === 0 && productosPorVencer === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconContainer}>
                  <Text style={styles.emptyStateIcon}>✅</Text>
                </View>
                <Text style={styles.emptyStateTitle}>¡Todo en orden!</Text>
                <Text style={styles.emptyStateText}>
                  No hay productos vencidos o por vencer en el sistema
                </Text>
              </View>
            ) : (
              <View style={styles.alertList}>
                <Text style={styles.alertListTitle}>
                  Productos que necesitan atención:
                </Text>
                {productosVencidos > 0 && (
                  <View style={styles.alertItemDanger}>
                    <Text style={styles.alertItemIcon}>🔴</Text>
                    <Text style={styles.alertItemText}>
                      {productosVencidos} producto(s) vencido(s)
                    </Text>
                  </View>
                )}
                {productosPorVencer > 0 && (
                  <View style={styles.alertItemWarning}>
                    <Text style={styles.alertItemIcon}>🟠</Text>
                    <Text style={styles.alertItemText}>
                      {productosPorVencer} producto(s) por vencer en los
                      próximos 30 días
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View
            style={[
              styles.alertPanelFooter,
              isTablet && styles.alertPanelFooterTablet,
            ]}
          >
            <View style={styles.footerInfo}>
              <View
                style={[styles.statusIndicator, { backgroundColor: "#10b981" }]}
              />
              <Text style={styles.footerStatusText}>💾 Datos locales</Text>
              <Text style={styles.footerUpdateText}>
                Actualizado: {formatHora(new Date())}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={recargarDatos}
            >
              <Text style={styles.refreshButtonIcon}>↻</Text>
              <Text style={styles.refreshButtonText}>Actualizar ahora</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Panel de Alertas de Deudas/Préstamos */}
        <View style={styles.alertPanel}>
          <View
            style={[
              styles.alertPanelHeader,
              isTablet && styles.alertPanelHeaderTablet,
            ]}
          >
            <View style={styles.alertPanelTitle}>
              <View
                style={[
                  styles.alertIconContainer,
                  styles.alertIconContainerPrestamos,
                ]}
              >
                <Text style={styles.alertIcon}>💰</Text>
              </View>
              <View>
                <Text style={styles.alertPanelTitleText}>
                  Alertas de Deudas/Préstamos
                </Text>
                <Text style={styles.alertPanelSubtitle}>
                  Finanzas pendientes que requieren atención
                </Text>
              </View>
            </View>

            <View style={styles.alertBadges}>
              <View style={styles.badgeDanger}>
                <Text style={styles.badgeIcon}>🔴</Text>
                <Text style={styles.badgeText}>
                  {prestamosVencidos} VENCIDOS
                </Text>
              </View>
              <View style={styles.badgeWarning}>
                <Text style={styles.badgeIcon}>🟠</Text>
                <Text style={[styles.badgeText, styles.badgeWarningText]}>
                  {prestamosProximos} POR VENCER
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.alertPanelBody}>
            {prestamosVencidos === 0 && prestamosProximos === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyStateIconContainer,
                    styles.emptyStateIconContainerPrestamos,
                  ]}
                >
                  <Text style={styles.emptyStateIcon}>✅</Text>
                </View>
                <Text style={styles.emptyStateTitle}>¡Todo en orden!</Text>
                <Text style={styles.emptyStateText}>
                  No hay deudas o préstamos vencidos o por vencer
                </Text>
              </View>
            ) : (
              <View style={styles.alertList}>
                <Text style={styles.alertListTitle}>Finanzas pendientes:</Text>
                {prestamosVencidos > 0 && (
                  <View style={styles.alertItemDanger}>
                    <Text style={styles.alertItemIcon}>🔴</Text>
                    <Text style={styles.alertItemText}>
                      {prestamosVencidos} préstamo(s)/deuda(s) vencido(s)
                    </Text>
                  </View>
                )}
                {prestamosProximos > 0 && (
                  <View style={styles.alertItemWarning}>
                    <Text style={styles.alertItemIcon}>🟠</Text>
                    <Text style={styles.alertItemText}>
                      {prestamosProximos} préstamo(s)/deuda(s) por vencer en los
                      próximos 7 días
                    </Text>
                  </View>
                )}
                {totalPrestamosPendientes > 0 && (
                  <View style={styles.alertItemInfo}>
                    <Text style={styles.alertItemIcon}>💵</Text>
                    <Text style={styles.alertItemText}>
                      Total pendiente: {formatMoneda(totalPrestamosPendientes)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View
            style={[
              styles.alertPanelFooter,
              isTablet && styles.alertPanelFooterTablet,
            ]}
          >
            <View style={styles.footerInfo}>
              <Text style={styles.footerStatusText}>
                💸 Total pendiente: {formatMoneda(totalPrestamosPendientes)}
              </Text>
              <Text style={styles.footerUpdateText}>Moneda: CUP</Text>
            </View>
            <TouchableOpacity
              style={[styles.refreshButton, styles.refreshButtonPrestamos]}
              onPress={navegarAPrestamos}
            >
              <Text style={styles.refreshButtonIcon}>📋</Text>
              <Text style={styles.refreshButtonText}>Ver detalles</Text>
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
              <Text style={styles.systemInfoIcon}>🚀</Text>
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
                <Text style={styles.footerTitle}>GestoMax PWA</Text>
                <Text style={styles.footerSubtitle}>
                  Gestión 100% Offline • iOS Optimizado
                </Text>
              </View>
            </View>
            <View style={styles.footerStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {productosVencidos +
                    productosPorVencer +
                    prestamosVencidos +
                    prestamosProximos}
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
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 44,
    height: 44,
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
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  refreshIcon: {
    fontSize: 18,
    color: "#6b7280",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  userIcon: {
    fontSize: 20,
  },
  // Stats Cards
  statsGrid: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
    gap: 16,
  },
  statsGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statsGridDesktop: {
    flexDirection: "row",
  },
  statCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  statIconContainer: {
    backgroundColor: "#f3f4f6",
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statIcon: {
    fontSize: 24,
  },
  // Botones Principales
  mainButtonsGrid: {
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 24,
  },
  mainButtonsGridTablet: {
    flexDirection: "row",
  },
  buttonCardContainer: {
    flex: 1,
  },
  buttonCard: {
    backgroundColor: "white",
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
    fontSize: 18,
    fontWeight: "700",
    color: "#6b7280",
  },
  // Panel de Alertas
  alertPanel: {
    backgroundColor: "white",
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  alertPanelHeader: {
    padding: 24,
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
    maxHeight: 400,
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
});
