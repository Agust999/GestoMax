// components/LicenseValidator.tsx
import React, { useCallback, useEffect, useState } from "react";
import { Alert, AppState, StyleSheet, Text, View } from "react-native";
import LicenseService, { LicenseValidationResult } from "../src/db/services/license_service";


interface LicenseValidatorProps {
  children: React.ReactNode;
  onLicenseValid?: () => void;
  onLicenseBlocked?: () => void;
  onLicenseWarning?: (daysRemaining: number) => void;
}

export default function LicenseValidator({
  children,
  onLicenseValid,
  onLicenseBlocked,
  onLicenseWarning,
}: LicenseValidatorProps) {
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);

  const validateLicensePeriodically = useCallback(async () => {
    try {
      setIsLoading(true);
      const validation = await LicenseService.validateLicense();
      setLicenseStatus(validation);

      // Manejar diferentes estados de licencia
      if (!validation.canUseApp) {
        // Licencia bloqueada - no mostrar advertencia, solo bloquear
        onLicenseBlocked?.();
      } else if (validation.needsActivation) {
        // Advertencia de activación
        if (validation.daysRemaining <= 7) {
          setShowWarning(true);
          onLicenseWarning?.(validation.daysRemaining);

          // Mostrar alerta de advertencia
          Alert.alert(
            "Advertencia de Licencia",
            `Tu período de prueba termina en ${validation.daysRemaining} días. Contacta al desarrollador para obtener tu clave de activación.`,
            [{ text: "Entendido" }],
          );
        }
      } else {
        // Licencia válida
        onLicenseValid?.();
      }
    } catch (error) {
      console.error("Error validando licencia:", error);
      // En caso de error, bloquear por seguridad
      onLicenseBlocked?.();
    } finally {
      setIsLoading(false);
    }
  }, [onLicenseBlocked, onLicenseWarning, onLicenseValid]);

  useEffect(() => {
    validateLicensePeriodically();
  }, [validateLicensePeriodically]);

  // Validar licencia cada vez que la app viene a primer plano
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        validateLicensePeriodically();
      }
    });

    return () => subscription?.remove();
  }, [validateLicensePeriodically]);

  // Validar licencia cada hora
  useEffect(() => {
    const interval = setInterval(validateLicensePeriodically, 60 * 60 * 1000); // 1 hora
    return () => clearInterval(interval);
  }, [validateLicensePeriodically]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Validando licencia...</Text>
      </View>
    );
  }

  if (!licenseStatus || !licenseStatus.canUseApp) {
    // La app está bloqueada, el componente LicenseBlockScreen se encargará
    return null;
  }

  // Mostrar advertencia si es necesario
  if (showWarning && licenseStatus.daysRemaining <= 7) {
    return (
      <View style={styles.container}>
        {showWarning && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ Quedan {licenseStatus.daysRemaining} días de prueba
            </Text>
          </View>
        )}
        {children}
      </View>
    );
  }

  // Licencia válida, mostrar children normalmente
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#151718",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#ECEDEE",
    fontSize: 16,
  },
  warningBanner: {
    backgroundColor: "#2d1b1b",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f59e0b",
  },
  warningText: {
    color: "#f59e0b",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
});
