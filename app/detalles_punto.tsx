// app/detalles_punto.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DetallesPuntoScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Detalles del Punto</Text>
        <Text style={styles.subtitle}>Información detallada</Text>
        <Text style={styles.description}>
          Aquí podrás ver información detallada del punto de venta, estadísticas
          avanzadas y configuraciones específicas.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    color: "#666",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "#777",
    lineHeight: 24,
  },
});
