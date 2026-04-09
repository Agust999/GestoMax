// components/LicenseManager.tsx
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import LicenseBlockScreen from "../app/license_block";
import LicenseService, {
    LicenseValidationResult,
} from "../src/db/services/license_service";
import LicenseValidator from "./LicenseValidator";

interface LicenseManagerProps {
  children: React.ReactNode;
}

export default function LicenseManager({ children }: LicenseManagerProps) {
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBlockScreen, setShowBlockScreen] = useState(false);

  useEffect(() => {
    checkInitialLicenseStatus();
  }, []);

  const checkInitialLicenseStatus = async () => {
    try {
      setIsLoading(true);
      const validation = await LicenseService.validateLicense();
      setLicenseStatus(validation);

      // Si la licencia está bloqueada, mostrar pantalla de bloqueo
      if (!validation.canUseApp) {
        setShowBlockScreen(true);
      }
    } catch (error) {
      console.error("Error checking initial license status:", error);
      setShowBlockScreen(true); // Bloquear por seguridad
    } finally {
      setIsLoading(false);
    }
  };

  const handleLicenseValid = () => {
    console.log("✅ Licencia válida - App disponible");
    setShowBlockScreen(false);
  };

  const handleLicenseBlocked = () => {
    console.log("🔒 Licencia bloqueada - Mostrando pantalla de bloqueo");
    setShowBlockScreen(true);
  };

  const handleLicenseWarning = (daysRemaining: number) => {
    console.log(`⚠️ Advertencia: Quedan ${daysRemaining} días de prueba`);
  };

  const handleLicenseActivated = () => {
    // Después de activar la licencia, verificar estado
    checkInitialLicenseStatus();
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#151718" }}>
        {/* Loading state handled by LicenseValidator */}
      </View>
    );
  }

  // Si la licencia está bloqueada o necesita activación, mostrar pantalla de bloqueo
  if (showBlockScreen) {
    return <LicenseBlockScreen />;
  }

  // Si la licencia es válida, envolver children con LicenseValidator
  return (
    <LicenseValidator
      onLicenseValid={handleLicenseValid}
      onLicenseBlocked={handleLicenseBlocked}
      onLicenseWarning={handleLicenseWarning}
    >
      {children}
    </LicenseValidator>
  );
}
