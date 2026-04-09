// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import DatabaseFix from "../components/DatabaseFix";
import LicenseManager from "../components/LicenseManager";

export default function RootLayout() {
  return (
    <>
      <StatusBar hidden={true} style="light" />
      <LicenseManager>
        <DatabaseFix />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="punto" />
          <Stack.Screen name="prestamos" />
          <Stack.Screen
            name="almacen"
            options={{
              presentation: "modal", // Opcional: abre como modal
              animation: "slide_from_right",
            }}
          />
          {/* Agregar las otras pantallas con sus tipos de parámetros */}
          <Stack.Screen name="venta" />
          <Stack.Screen name="ganancia" />
          <Stack.Screen name="cierre" />
          <Stack.Screen name="precios" />
          <Stack.Screen name="onat" />
          <Stack.Screen name="gastos" />
          <Stack.Screen name="ofertas" />
          <Stack.Screen name="detalles_punto" />
          <Stack.Screen name="actividad_completa" />
          {/* Pantalla de licencia (sin header) */}
          <Stack.Screen
            name="license_block"
            options={{
              headerShown: false,
              presentation: "modal",
            }}
          />
        </Stack>
      </LicenseManager>
    </>
  );
}
