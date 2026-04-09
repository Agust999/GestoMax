import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

interface NavigationState {
  currentRoute: string;
  params?: any;
  timestamp: number;
}

// Exportar las constantes para que puedan ser usadas en otros archivos
export const NAVIGATION_STATE_KEY = "app_navigation_state";
export const APP_STATE_KEY = "app_last_state";
export const BACKGROUND_TIMESTAMP_KEY = "app_background_timestamp";

// Hook para detectar estado de la app
export const useAppState = () => {
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log("🔄 Estado de app cambió:", nextAppState);
      setAppState(nextAppState);

      // Guardar estado de la app y timestamp cuando va a background
      if (nextAppState === "background") {
        AsyncStorage.setItem(APP_STATE_KEY, "background");
        AsyncStorage.setItem(BACKGROUND_TIMESTAMP_KEY, Date.now().toString());
        console.log("📍 App pasó a background, guardando timestamp");
      } else if (nextAppState === "active") {
        AsyncStorage.setItem(APP_STATE_KEY, "active");
        console.log("📍 App pasó a active");
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  return appState;
};

// Detectar si la app está iniciando fresca (no viene de background)
export const detectarInicioFresco = async (): Promise<boolean> => {
  try {
    const backgroundTimestamp = await AsyncStorage.getItem(
      BACKGROUND_TIMESTAMP_KEY,
    );
    const lastAppState = await AsyncStorage.getItem(APP_STATE_KEY);

    if (!backgroundTimestamp || !lastAppState) {
      console.log(
        "📍 No hay timestamp o estado previo, asumiendo inicio fresco",
      );
      return true;
    }

    const tiempoEnBackground = Date.now() - parseInt(backgroundTimestamp);
    const LIMITE_INICIO_FRESCO = 30 * 60 * 1000; // 30 minutos

    // Si el tiempo en background es mayor a 30 minutos, considerar como inicio fresco
    if (tiempoEnBackground > LIMITE_INICIO_FRESCO) {
      console.log(
        `📍 App en background por ${Math.round(tiempoEnBackground / 60000)}min > 30min, inicio fresco detectado`,
      );
      return true;
    } else {
      console.log(
        `📍 App en background por ${Math.round(tiempoEnBackground / 1000)}s <= 30min, restauración rápida`,
      );
      return false;
    }
  } catch (error) {
    console.error("Error detectando inicio fresco:", error);
    return true; // En caso de error, asumir inicio fresco por seguridad
  }
};

// Guardar estado de navegación
export const saveNavigationState = async (route: string, params?: any) => {
  try {
    const state: NavigationState = {
      currentRoute: route,
      params,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
    console.log(`📍 Navegación guardada: ${route}`, params);
  } catch (error) {
    console.error("Error guardando estado de navegación:", error);
  }
};

// Restaurar estado de navegación (versión que no usa hooks)
export const restoreNavigationState = async (
  router?: any,
): Promise<boolean> => {
  try {
    // Primero verificar si es un inicio fresco
    const esInicioFresco = await detectarInicioFresco();

    if (esInicioFresco) {
      console.log(
        "📍 Inicio fresco detectado, limpiando estado y no restaurando",
      );
      await clearNavigationState();
      return false;
    }

    const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);

    if (!savedState) {
      console.log("📍 No hay estado de navegación guardado");
      return false;
    }

    const state: NavigationState = JSON.parse(savedState);

    // Verificar si el estado es reciente (menos de 2 horas)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    if (state.timestamp < twoHoursAgo) {
      console.log(
        "📍 Estado de navegación muy antiguo (más de 2 horas), ignorando",
      );
      await clearNavigationState();
      return false;
    }

    // Evitar restaurar si ya estamos en la ruta actual
    if (state.currentRoute === "/") {
      console.log("📍 Ya estamos en index, no restaurar");
      await clearNavigationState();
      return false;
    }

    console.log(
      `📍 Restaurando navegación a: ${state.currentRoute}`,
      state.params,
    );

    // Si no se proporciona router, devolver el estado para que el componente lo maneje
    if (!router) {
      console.log("📍 Router no proporcionado, devolviendo estado");
      return false;
    }

    // Navegar a la ruta guardada con sus parámetros
    if (state.params) {
      router.push({
        pathname: state.currentRoute as any,
        params: state.params,
      });
    } else {
      router.push(state.currentRoute as any);
    }

    return true;
  } catch (error) {
    console.error("Error restaurando estado de navegación:", error);
    return false;
  }
};

// Limpiar estado de navegación
export const clearNavigationState = async () => {
  try {
    await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
    console.log("📍 Estado de navegación limpiado");
  } catch (error) {
    console.error("Error limpiando estado de navegación:", error);
  }
};

// Hook para pantallas que necesitan guardar su estado
export const useSaveNavigationState = (route: string, params?: any) => {
  const router = useRouter();

  useEffect(() => {
    // Guardar estado cuando la pantalla se monta
    saveNavigationState(route, params);
  }, [route, params]);

  // Función para navegar guardando estado
  const navigateWithSave = (newRoute: string, newParams?: any) => {
    saveNavigationState(newRoute, newParams);
    if (newParams) {
      router.push({ pathname: newRoute as any, params: newParams });
    } else {
      router.push(newRoute as any);
    }
  };

  return { navigateWithSave };
};
