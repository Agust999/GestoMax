// app/actividad_completa.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ActividadCompletaScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Actividad Completa</Text>
        <Text style={styles.subtitle}>Historial completo</Text>
        <Text style={styles.description}>
          Aquí podrás ver el historial completo de actividades del punto, con
          filtros avanzados y exportación de datos.
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
