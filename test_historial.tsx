// Script de prueba para historial de almacén - compatible con React Native
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import type { MovimientoAlmacen } from "./src/db/services/almacen_history_service";
import { AlmacenHistoryService } from "./src/db/services/almacen_history_service";

export default function TestHistorialScreen() {
  const [movimientos, setMovimientos] = useState<MovimientoAlmacen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    probarHistorial();
  }, []);

  const probarHistorial = async () => {
    try {
      setLoading(true);
      console.log("🔍 Iniciando prueba del historial de almacén...");

      // Probar con Almacén General (ID: 0)
      const historial =
        await AlmacenHistoryService.getMovimientosHistorialAlmacen({
          almacenId: 0,
          limit: 20,
        });

      console.log("✅ Movimientos obtenidos:", historial.length);

      // Agrupar por tipo para mostrar resumen
      const resumen = historial.reduce(
        (acc, movimiento) => {
          acc[movimiento.tipo] = (acc[movimiento.tipo] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      console.log("📊 Resumen por tipo:", resumen);

      // Mostrar detalles de primeros movimientos
      historial.slice(0, 5).forEach((mov, index) => {
        console.log(
          `\n${index + 1}. ${mov.tipo.toUpperCase()}: ${mov.producto_nombre}`,
        );
        console.log(`   Cantidad: ${mov.cantidad}`);
        console.log(
          `   Fecha: ${new Date(mov.creado_en).toLocaleString("es-ES")}`,
        );
        console.log(`   Notas: ${mov.notas}`);
        if (mov.cantidad_inicial) {
          console.log(`   Cantidad inicial: ${mov.cantidad_inicial}`);
        }
        if (mov.precio_coste) {
          console.log(`   Costo: ${mov.precio_coste}`);
        }
        if (mov.precio_venta) {
          console.log(`   Venta: ${mov.precio_venta}`);
        }
        if (mov.ganancia) {
          console.log(`   Ganancia: ${mov.ganancia}`);
        }
      });

      setMovimientos(historial);

      Alert.alert(
        "Prueba Completada",
        `Se encontraron ${historial.length} movimientos\n\nResumen:\n${Object.entries(
          resumen,
        )
          .map(([tipo, count]) => `${tipo}: ${count}`)
          .join("\n")}`,
        [{ text: "OK", style: "default" }],
      );
    } catch (error) {
      console.error("❌ Error en la prueba:", error);
      Alert.alert("Error", "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Cargando prueba de historial...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 20 }}>
        📋 Historial de Almacén - Prueba
      </Text>

      <Text style={{ fontSize: 16, marginBottom: 10 }}>
        Total de movimientos: {movimientos.length}
      </Text>

      <ScrollView style={{ flex: 1 }}>
        {movimientos.map((item, index) => (
          <View
            key={`${item.id}-${item.tipo}-${index}`}
            style={{
              backgroundColor: "#f9fafb",
              padding: 12,
              marginBottom: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "bold", color: "#1f2937" }}
            >
              {item.producto_nombre}
            </Text>

            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              Tipo: {item.tipo.toUpperCase()}
            </Text>

            <Text style={{ fontSize: 12, color: "#6b7280" }}>
              Cantidad: {item.cantidad}
              {item.cantidad_inicial &&
                item.cantidad_inicial !== item.cantidad &&
                ` (inicial: ${item.cantidad_inicial})`}
            </Text>

            {item.notas && (
              <Text
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  marginTop: 2,
                  fontStyle: "italic",
                }}
              >
                {item.notas}
              </Text>
            )}

            <Text style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
              {new Date(item.creado_en).toLocaleString("es-ES")}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
