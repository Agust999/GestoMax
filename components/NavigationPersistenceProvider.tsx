import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { createContext, useContext, useEffect } from "react";
import {
    APP_STATE_KEY,
    BACKGROUND_TIMESTAMP_KEY,
    NAVIGATION_STATE_KEY,
} from "./NavigationPersistence";

interface NavigationState {
  currentRoute: string;
  params?: any;
  timestamp: number;
}

interface NavigationContextType {
  saveNavigationState: (route: string, params?: any) => void;
  restoreNavigationState: () => Promise<boolean>;
  clearNavigationState: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
);

// Detectar si la app está iniciando fresca (no viene de background)
const detectarInicioFrescoLocal = async (): Promise<boolean> => {
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

export function NavigationPersistenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const saveNavigationState = async (route: string, params?: any) => {
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

  const restoreNavigationState = async (): Promise<boolean> => {
    try {
      // Primero verificar si es un inicio fresco
      const esInicioFresco = await detectarInicioFrescoLocal();

      if (esInicioFresco) {
        console.log(
          "📍 Inicio fresco detectado en Provider, limpiando estado y no restaurando",
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

      console.log(
        `📍 Restaurando navegación a: ${state.currentRoute}`,
        state.params,
      );

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

  const clearNavigationState = async () => {
    try {
      await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
      console.log("📍 Estado de navegación limpiado");
    } catch (error) {
      console.error("Error limpiando estado de navegación:", error);
    }
  };

  // Limpiar estado antiguo al iniciar
  useEffect(() => {
    const cleanupOldState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
        if (savedState) {
          const state: NavigationState = JSON.parse(savedState);
          const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

          if (state.timestamp < thirtyMinutesAgo) {
            await clearNavigationState();
          }
        }
      } catch (error) {
        console.error("Error limpiando estado antiguo:", error);
      }
    };

    cleanupOldState();
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        saveNavigationState,
        restoreNavigationState,
        clearNavigationState,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationPersistence() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error(
      "useNavigationPersistence debe usarse dentro de NavigationPersistenceProvider",
    );
  }
  return context;
}

// Hook para pantallas que necesitan guardar su estado
export function useSaveNavigationState(route: string, params?: any) {
  const { saveNavigationState } = useNavigationPersistence();
  const router = useRouter();

  useEffect(() => {
    // Guardar estado cuando la pantalla se monta
    saveNavigationState(route, params);
  }, [route, params, saveNavigationState]);

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
}
