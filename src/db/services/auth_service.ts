// src/db/services/auth_service.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const PASSWORD_KEY = "GESTOMAX_PASSWORD";
const SECURITY_KEY = "GESTOMAX_SECURITY";
const RECOVERY_CODES_KEY = "GESTOMAX_RECOVERY_CODES";
const DEFAULT_PASSWORD = "1234";

// Preguntas de seguridad predefinidas
export const SECURITY_QUESTIONS = [
  "¿Cuál es el nombre de tu primera mascota?",
  "¿En qué ciudad naciste?",
  "¿Cuál es tu película favorita?",
  "¿Cuál es el nombre de tu mejor amigo(a)?",
  "¿Cuál fue tu primera escuela?",
  "¿Cuál es tu color favorito?",
  "¿En qué año te graduaste de la escuela?",
  "¿Cuál es el nombre de tu madre?",
];

interface SecurityData {
  password: string;
  securityQuestion: string;
  securityAnswer: string;
  recoveryHint: string;
  isSetup: boolean;
}

interface RecoveryResult {
  success: boolean;
  message: string;
  level?: number;
  data?: any;
}

export class AuthService {
  // ===== NIVEL 1: Contraseña actual (AsyncStorage) =====

  // Obtener contraseña guardada o retornar la por defecto
  static async getPassword(): Promise<string> {
    try {
      const savedPassword = await AsyncStorage.getItem(PASSWORD_KEY);
      return savedPassword || DEFAULT_PASSWORD;
    } catch (error) {
      console.error("Error obteniendo contraseña:", error);
      return DEFAULT_PASSWORD;
    }
  }

  // Guardar nueva contraseña
  static async setPassword(
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!newPassword || newPassword.trim().length === 0) {
        return {
          success: false,
          message: "La contraseña no puede estar vacía",
        };
      }

      if (newPassword.length < 4) {
        return {
          success: false,
          message: "La contraseña debe tener al menos 4 caracteres",
        };
      }

      await AsyncStorage.setItem(PASSWORD_KEY, newPassword.trim());
      return {
        success: true,
        message: "Contraseña actualizada correctamente",
      };
    } catch (error) {
      console.error("Error guardando contraseña:", error);
      return {
        success: false,
        message: "Error al guardar la contraseña",
      };
    }
  }

  // Verificar contraseña
  static async verifyPassword(inputPassword: string): Promise<boolean> {
    try {
      const currentPassword = await this.getPassword();
      return inputPassword === currentPassword;
    } catch (error) {
      console.error("Error verificando contraseña:", error);
      return false;
    }
  }

  // ===== NIVEL 2: Pregunta de seguridad =====

  // Configurar seguridad por primera vez
  static async setupSecurity(
    password: string,
    securityQuestion: string,
    securityAnswer: string,
    recoveryHint: string,
  ): Promise<{ success: boolean; message: string; recoveryCodes?: string[] }> {
    try {
      // Validar datos
      if (!password || password.trim().length === 0) {
        return {
          success: false,
          message: "La contraseña no puede estar vacía",
        };
      }

      if (!securityQuestion || securityAnswer.trim().length === 0) {
        return {
          success: false,
          message: "La pregunta y respuesta de seguridad son obligatorias",
        };
      }

      if (password.length < 4) {
        return {
          success: false,
          message: "La contraseña debe tener al menos 4 caracteres",
        };
      }

      // Guardar contraseña
      await this.setPassword(password);

      // Generar códigos de recuperación (solo si no existen)
      let recoveryCodes = await this.getRecoveryCodes();
      if (recoveryCodes.length === 0) {
        recoveryCodes = this.generateRecoveryCodes();

        // Guardar los códigos permanentemente
        await AsyncStorage.setItem(
          RECOVERY_CODES_KEY,
          JSON.stringify(recoveryCodes),
        );

        console.log("🔑 Códigos de recuperación generados permanentemente:");
        console.log("📋 Códigos:", recoveryCodes);
      } else {
        console.log(
          "🔑 Códigos de recuperación ya existen, manteniendo los actuales:",
        );
        console.log("📋 Códigos:", recoveryCodes);
      }

      // Guardar datos de seguridad
      const securityData: SecurityData = {
        password: password,
        securityQuestion: securityQuestion,
        securityAnswer: securityAnswer.toLowerCase().trim(),
        recoveryHint: recoveryHint,
        isSetup: true,
      };

      await AsyncStorage.setItem(SECURITY_KEY, JSON.stringify(securityData));

      return {
        success: true,
        message: "Seguridad configurada correctamente",
        recoveryCodes,
      };
    } catch (error) {
      console.error("Error configurando seguridad:", error);
      return {
        success: false,
        message: "Error al configurar la seguridad",
      };
    }
  }

  // Verificar si la seguridad está configurada
  static async isSecuritySetup(): Promise<boolean> {
    try {
      const securityData = await AsyncStorage.getItem(SECURITY_KEY);
      return securityData !== null;
    } catch (error) {
      console.error("Error verificando configuración de seguridad:", error);
      return false;
    }
  }

  // Obtener datos de seguridad
  static async getSecurityData(): Promise<SecurityData | null> {
    try {
      const securityData = await AsyncStorage.getItem(SECURITY_KEY);
      return securityData ? JSON.parse(securityData) : null;
    } catch (error) {
      console.error("Error obteniendo datos de seguridad:", error);
      return null;
    }
  }

  // Verificar respuesta de seguridad
  static async verifySecurityAnswer(answer: string): Promise<RecoveryResult> {
    try {
      const securityData = await this.getSecurityData();

      if (!securityData) {
        return {
          success: false,
          message: "No hay datos de seguridad configurados",
          level: 4,
        };
      }

      const normalizedAnswer = answer.toLowerCase().trim();

      if (normalizedAnswer === securityData.securityAnswer) {
        return {
          success: true,
          message: "Respuesta correcta. Puedes resetear tu contraseña.",
          level: 2,
          data: {
            hint: securityData.recoveryHint,
            question: securityData.securityQuestion,
          },
        };
      } else {
        return {
          success: false,
          message:
            "Respuesta incorrecta. Intenta de nuevo o usa un código de recuperación.",
          level: 3,
        };
      }
    } catch (error) {
      console.error("Error verificando respuesta de seguridad:", error);
      return {
        success: false,
        message: "Error al verificar la respuesta",
        level: 4,
      };
    }
  }

  // ===== NIVEL 3: Códigos de recuperación =====

  // Generar códigos de recuperación (solo si no existen)
  static generateRecoveryCodes(): string[] {
    // Generar códigos fijos basados en un patrón determinista
    // Esto asegura que siempre sean los mismos códigos
    const baseCodes = [
      "A1B2C3D4",
      "E5F6G7H8",
      "I9J0K1L2",
      "M3N4O5P6",
      "Q7R8S9T0",
    ];

    return baseCodes;
  }

  // Generar códigos aleatorios (solo para casos especiales)
  static generateRandomRecoveryCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 5; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  // Obtener códigos de recuperación
  static async getRecoveryCodes(): Promise<string[]> {
    try {
      const codes = await AsyncStorage.getItem(RECOVERY_CODES_KEY);
      return codes ? JSON.parse(codes) : [];
    } catch (error) {
      console.error("Error obteniendo códigos de recuperación:", error);
      return [];
    }
  }

  // Verificar código de recuperación
  static async verifyRecoveryCode(code: string): Promise<RecoveryResult> {
    try {
      const codes = await this.getRecoveryCodes();
      const normalizedCode = code.toUpperCase().trim();

      if (codes.includes(normalizedCode)) {
        return {
          success: true,
          message: "Código válido. Puedes resetear tu contraseña.",
          level: 3,
          data: { code: normalizedCode },
        };
      } else {
        return {
          success: false,
          message: "Código inválido. Verifica e intenta de nuevo.",
          level: 4,
        };
      }
    } catch (error) {
      console.error("Error verificando código de recuperación:", error);
      return {
        success: false,
        message: "Error al verificar el código",
        level: 4,
      };
    }
  }

  // ===== NIVEL 4: Reset a contraseña por defecto =====

  // Reset completo a valores por defecto (último recurso)
  static async resetToDefaults(): Promise<RecoveryResult> {
    try {
      // Eliminar todos los datos de seguridad
      await AsyncStorage.multiRemove([
        PASSWORD_KEY,
        SECURITY_KEY,
        RECOVERY_CODES_KEY,
      ]);

      return {
        success: true,
        message: "Sistema reseteado. Contraseña: 1234",
        level: 4,
        data: {
          defaultPassword: DEFAULT_PASSWORD,
          message: "Debes configurar la seguridad nuevamente",
        },
      };
    } catch (error) {
      console.error("Error reseteando a valores por defecto:", error);
      return {
        success: false,
        message: "Error al resetear el sistema",
        level: 4,
      };
    }
  }

  // Reset de contraseña (después de recuperación exitosa)
  static async resetPassword(newPassword?: string): Promise<RecoveryResult> {
    try {
      const finalPassword = newPassword || DEFAULT_PASSWORD;

      const result = await this.setPassword(finalPassword);

      if (result.success) {
        return {
          success: true,
          message: `Contraseña reseteada exitosamente a: ${finalPassword}`,
          level: 0,
          data: { newPassword: finalPassword },
        };
      } else {
        return {
          success: false,
          message: result.message,
          level: 4,
        };
      }
    } catch (error) {
      console.error("Error reseteando contraseña:", error);
      return {
        success: false,
        message: "Error al resetear la contraseña",
        level: 4,
      };
    }
  }

  // ===== Utilidades =====

  // Verificar si existe una contraseña personalizada
  static async hasCustomPassword(): Promise<boolean> {
    try {
      const savedPassword = await AsyncStorage.getItem(PASSWORD_KEY);
      return savedPassword !== null && savedPassword !== DEFAULT_PASSWORD;
    } catch (error) {
      console.error(
        "Error verificando si hay contraseña personalizada:",
        error,
      );
      return false;
    }
  }

  // Validar fortaleza de contraseña
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    isStrong: boolean;
    suggestions: string[];
  } {
    const hasMinLength = password.length >= 4;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    return {
      isValid: hasMinLength,
      isStrong: hasMinLength && hasLetter && hasNumber,
      suggestions: [
        !hasMinLength && "Mínimo 4 caracteres",
        !hasLetter && "Incluir al menos una letra",
        !hasNumber && "Incluir al menos un número",
      ].filter(Boolean) as string[],
    };
  }

  // Obtener estado completo del sistema
  static async getSecurityStatus(): Promise<{
    hasPassword: boolean;
    hasSecurity: boolean;
    hasRecoveryCodes: boolean;
    isCustomPassword: boolean;
  }> {
    try {
      const [hasPassword, hasSecurity, hasRecoveryCodes, isCustomPassword] =
        await Promise.all([
          AsyncStorage.getItem(PASSWORD_KEY).then((p) => p !== null),
          this.isSecuritySetup(),
          this.getRecoveryCodes().then((c) => c.length > 0),
          this.hasCustomPassword(),
        ]);

      return {
        hasPassword,
        hasSecurity,
        hasRecoveryCodes,
        isCustomPassword,
      };
    } catch (error) {
      console.error("Error obteniendo estado de seguridad:", error);
      return {
        hasPassword: false,
        hasSecurity: false,
        hasRecoveryCodes: false,
        isCustomPassword: false,
      };
    }
  }
}

// Exportar por defecto para compatibilidad
export default AuthService;
