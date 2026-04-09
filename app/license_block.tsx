// app/license_block.tsx
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LicenseService, {
  LicenseValidationResult,
} from "../src/db/services/license_service";

const { width, height } = Dimensions.get("window");

export default function LicenseBlockScreen() {
  const [licenseKey, setLicenseKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseValidationResult | null>(null);
  const [userCode, setUserCode] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    loadLicenseStatus();
  }, []);

  const loadLicenseStatus = async () => {
    try {
      const status = await LicenseService.validateLicense();
      const userCode = await LicenseService.getUserCode();

      setLicenseStatus(status);
      setUserCode(userCode);
    } catch (error) {
      console.error("Error cargando estado de licencia:", error);
    }
  };

  const handleActivation = async () => {
    if (!licenseKey.trim()) {
      Alert.alert("Error", "Por favor ingresa una clave de licencia válida");
      return;
    }

    setIsLoading(true);

    try {
      const result = await LicenseService.activateLicense(licenseKey.trim());

      if (result.success) {
        Alert.alert("¡Activación Exitosa!", result.message, [
          {
            text: "OK",
            onPress: () => {
              // Redirigir automáticamente a la pantalla principal
              router.push("/");
            },
          },
        ]);
      } else {
        Alert.alert("Error de Activación", result.message);
      }
    } catch (error) {
      console.error("Error en activación:", error);
      Alert.alert("Error", "Ocurrió un error al activar la licencia");
    } finally {
      setIsLoading(false);
    }
  };

  const copyUserCode = () => {
    // Aquí podrías usar Clipboard.setString si tienes acceso
    Alert.alert(
      "Código de Usuario",
      `Tu código es: ${userCode}\n\nCopia este código y envíaselo al desarrollador para obtener tu clave de activación.\n\nFormato: ${userCode}`,
      [{ text: "OK" }],
    );
  };

  const contactarSoporte = async () => {
    try {
      const numeroWhatsApp = "+5356924418"; // Número sin espacios ni guiones
      const mensaje = `Hola, necesito soporte con GestoMax. Mi código de usuario es: ${userCode}`;

      // Crear URL de WhatsApp
      const url = `whatsapp://send?phone=${numeroWhatsApp}&text=${encodeURIComponent(mensaje)}`;

      // Intentar abrir WhatsApp
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback: abrir en navegador web de WhatsApp
        const webUrl = `https://wa.me/${numeroWhatsApp.replace("+", "")}?text=${encodeURIComponent(mensaje)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error("Error abriendo WhatsApp:", error);

      // Fallback final: mostrar mensaje con número
      Alert.alert(
        "Contactar Soporte",
        `Por favor, contacta al soporte técnico:\n\n📞 WhatsApp: +53 56924418\n📧 Código de usuario: ${userCode}\n\nPuedes copiar este código y enviarlo directamente por WhatsApp.`,
        [{ text: "OK" }],
      );
    }
  };

  const renderBlockedContent = () => (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>GM</Text>
          </View>
          <Text style={styles.appName}>GestoMax</Text>
          <Text style={styles.subtitle}>Sistema de Gestión Empresarial</Text>
        </View>

        {/* Bloque Message */}
        <View style={styles.blockContainer}>
          <View style={styles.iconContainer}>
            <Text style={styles.blockIcon}>🔒</Text>
          </View>
          <Text style={styles.blockTitle}>Período de Prueba Expirado</Text>
          <Text style={styles.blockMessage}>
            Tu período de prueba de 30 días ha finalizado. Para continuar usando
            GestoMax, necesitas activar tu licencia permanente.
          </Text>
        </View>

        {/* User Info */}
        <View style={styles.deviceContainer}>
          <Text style={styles.deviceTitle}>Información del Usuario</Text>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceLabel}>Código de Usuario:</Text>
            <Text style={styles.deviceId}>{userCode}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyUserCode}>
              <Text style={styles.copyButtonText}>📋 Copiar Código</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Activation Form */}
        <View style={styles.activationContainer}>
          <Text style={styles.activationTitle}>Activar Licencia</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Clave de Licencia</Text>
            <TextInput
              style={styles.input}
              value={licenseKey}
              onChangeText={setLicenseKey}
              placeholder="XX-XXX-XXX"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.activateButton, isLoading && styles.buttonDisabled]}
            onPress={handleActivation}
            disabled={isLoading}
          >
            <Text style={styles.activateButtonText}>
              {isLoading ? "Activando..." : "Activar Licencia"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <TouchableOpacity
            style={styles.instructionsHeader}
            onPress={() => setShowInstructions(!showInstructions)}
          >
            <Text style={styles.instructionsTitle}>
              ¿Cómo obtener tu clave?
            </Text>
            <Text style={styles.instructionsArrow}>
              {showInstructions ? "▼" : "▶"}
            </Text>
          </TouchableOpacity>

          {showInstructions && (
            <View style={styles.instructionsContent}>
              <Text style={styles.instructionStep}>
                1. Copia tu código de usuario (mostrado arriba)
              </Text>
              <Text style={styles.instructionStep}>
                2. Contacta al desarrollador con tu código
              </Text>
              <Text style={styles.instructionStep}>
                3. Recibirás una clave única para tu código
              </Text>
              <Text style={styles.instructionStep}>
                4. Ingresa la clave en el campo superior y activa
              </Text>
              <Text style={styles.instructionNote}>
                Nota: Cada clave funciona solo para este código específico.
              </Text>
            </View>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.contactContainer}>
          <Text style={styles.contactTitle}>¿Necesitas Ayuda?</Text>
          <Text style={styles.contactText}>
            Contacta al desarrollador para soporte técnico y activación
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={contactarSoporte}
          >
            <Text style={styles.contactButtonText}>📧 Contactar Soporte</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            GestoMax © 2026 - Todos los derechos reservados
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderWarningContent = () => (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>GM</Text>
          </View>
          <Text style={styles.appName}>GestoMax</Text>
          <Text style={styles.subtitle}>Sistema de Gestión Empresarial</Text>
        </View>

        {/* Warning Message */}
        <View style={styles.warningContainer}>
          <View style={styles.iconContainer}>
            <Text style={styles.warningIcon}>⚠️</Text>
          </View>
          <Text style={styles.warningTitle}>¡Tu Prueba Pronto Expira!</Text>
          <Text style={styles.warningMessage}>
            Tu período de prueba termina en {licenseStatus?.daysRemaining} días.
            Activa tu licencia ahora para continuar usando GestoMax sin
            interrupciones.
          </Text>
        </View>

        {/* Skip & Continue Button */}
        <TouchableOpacity
          style={styles.contactButton}
          onPress={contactarSoporte}
        >
          <Text style={styles.contactButtonText}>📧 Contactar Soporte</Text>
        </TouchableOpacity>

        {/* User Info */}
        <View style={styles.deviceContainer}>
          <Text style={styles.deviceTitle}>Información del Usuario</Text>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceLabel}>Código de Usuario:</Text>
            <Text style={styles.deviceId}>{userCode}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyUserCode}>
              <Text style={styles.copyButtonText}>📋 Copiar Código</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Activation Form */}
        <View style={styles.activationContainer}>
          <Text style={styles.activationTitle}>Activar Licencia Ahora</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Clave de Licencia</Text>
            <TextInput
              style={styles.input}
              value={licenseKey}
              onChangeText={setLicenseKey}
              placeholder="XX-XXX-XXX"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.activateButton, isLoading && styles.buttonDisabled]}
            onPress={handleActivation}
            disabled={isLoading}
          >
            <Text style={styles.activateButtonText}>
              {isLoading ? "Activando..." : "Activar Licencia"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <TouchableOpacity
            style={styles.instructionsHeader}
            onPress={() => setShowInstructions(!showInstructions)}
          >
            <Text style={styles.instructionsTitle}>
              ¿Cómo obtener tu clave?
            </Text>
            <Text style={styles.instructionsArrow}>
              {showInstructions ? "▼" : "▶"}
            </Text>
          </TouchableOpacity>

          {showInstructions && (
            <View style={styles.instructionsContent}>
              <Text style={styles.instructionStep}>
                1. Copia tu código de usuario (mostrado arriba)
              </Text>
              <Text style={styles.instructionStep}>
                2. Contacta al desarrollador con tu código
              </Text>
              <Text style={styles.instructionStep}>
                3. Recibirás una clave única para tu código
              </Text>
              <Text style={styles.instructionStep}>
                4. Ingresa la clave en el campo superior y activa
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            GestoMax © 2026 - Todos los derechos reservados
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  if (!licenseStatus) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  // Si está bloqueado, mostrar pantalla de bloqueo
  if (licenseStatus.isBlocked) {
    return renderBlockedContent();
  }

  // Si necesita activación pero no está bloqueado, mostrar advertencia
  if (licenseStatus.needsActivation) {
    return renderWarningContent();
  }

  // Si todo está bien, no debería llegar aquí, pero por si acaso
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Licencia válida. Redirigiendo...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#151718",
    minHeight: height,
    padding: 20,
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
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#0a7ea4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  logo: {
    color: "#ECEDEE",
    fontSize: 32,
    fontWeight: "bold",
  },
  appName: {
    color: "#ECEDEE",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    color: "#687076",
    fontSize: 14,
    textAlign: "center",
  },
  blockContainer: {
    backgroundColor: "#1a1d1e",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  warningContainer: {
    backgroundColor: "#2d1b1b",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  iconContainer: {
    marginBottom: 15,
  },
  blockIcon: {
    fontSize: 48,
  },
  warningIcon: {
    fontSize: 48,
  },
  blockTitle: {
    color: "#ECEDEE",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  warningTitle: {
    color: "#f59e0b",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  blockMessage: {
    color: "#687076",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  warningMessage: {
    color: "#ECEDEE",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  skipButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#0a7ea4",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  skipButtonText: {
    color: "#0a7ea4",
    fontSize: 16,
    fontWeight: "600",
  },
  deviceContainer: {
    backgroundColor: "#1a1d1e",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  deviceTitle: {
    color: "#ECEDEE",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 15,
  },
  deviceInfo: {
    backgroundColor: "#0a7ea4",
    borderRadius: 8,
    padding: 15,
  },
  deviceLabel: {
    color: "#ECEDEE",
    fontSize: 12,
    marginBottom: 5,
  },
  deviceId: {
    color: "#ECEDEE",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    fontFamily: "monospace",
  },
  copyButton: {
    backgroundColor: "rgba(236, 237, 238, 0.1)",
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  copyButtonText: {
    color: "#ECEDEE",
    fontSize: 12,
  },
  activationContainer: {
    backgroundColor: "#1a1d1e",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  activationTitle: {
    color: "#ECEDEE",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    color: "#ECEDEE",
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0a7ea4",
    color: "#ECEDEE",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "monospace",
  },
  activateButton: {
    backgroundColor: "#10b981",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#374151",
  },
  activateButtonText: {
    color: "#ECEDEE",
    fontSize: 16,
    fontWeight: "bold",
  },
  instructionsContainer: {
    backgroundColor: "#1a1d1e",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  instructionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  instructionsTitle: {
    color: "#ECEDEE",
    fontSize: 16,
    fontWeight: "600",
  },
  instructionsArrow: {
    color: "#0a7ea4",
    fontSize: 16,
  },
  instructionsContent: {
    marginTop: 15,
  },
  instructionStep: {
    color: "#687076",
    fontSize: 14,
    marginBottom: 8,
    paddingLeft: 20,
  },
  instructionNote: {
    color: "#f59e0b",
    fontSize: 12,
    marginTop: 10,
    fontStyle: "italic",
  },
  contactContainer: {
    backgroundColor: "#1a1d1e",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  contactTitle: {
    color: "#ECEDEE",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  contactText: {
    color: "#687076",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 15,
  },
  contactButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  contactButtonText: {
    color: "#ECEDEE",
    fontSize: 14,
  },
  footer: {
    alignItems: "center",
    paddingTop: 20,
  },
  footerText: {
    color: "#687076",
    fontSize: 12,
  },
});
