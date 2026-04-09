// src/db/services/license_service.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const LICENSE_KEY = "GESTOMAX_LICENSE";
const INSTALL_DATE_KEY = "GESTOMAX_INSTALL_DATE";
const USER_CODE_KEY = "GESTOMAX_USER_CODE";
const TRIAL_DAYS = 30;

export interface LicenseInfo {
  userCode: string;
  installDate: string;
  licenseKey?: string;
  isActivated: boolean;
  isBlocked: boolean;
  daysRemaining: number;
  activationDate?: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  isBlocked: boolean;
  isActivated: boolean;
  daysRemaining: number;
  needsActivation: boolean;
  message: string;
  canUseApp: boolean;
}

export class LicenseService {
  // ===== ALFABETO Y CIFRADO CESAR =====

  private static readonly ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Aplicar cifrado Cesar
  private static applyCaesarCipher(text: string, shift: number): string {
    const effectiveShift = shift % 26;
    return text
      .split("")
      .map((char) => {
        const index = this.ALPHABET.indexOf(char);
        if (index === -1) return char; // Mantener caracteres no alfabéticos
        const newIndex = (index + effectiveShift) % 26;
        return this.ALPHABET[newIndex];
      })
      .join("");
  }

  // Descifrar Cesar
  private static decipherCaesar(text: string, shift: number): string {
    const effectiveShift = shift % 26;
    return this.applyCaesarCipher(text, 26 - effectiveShift);
  }

  // Calcular desplazamiento desde los primeros 2 caracteres
  private static calculateShift(firstTwo: string): number {
    let shift = 0;
    for (let i = 0; i < firstTwo.length; i++) {
      const char = firstTwo[i].toUpperCase();
      const index = this.ALPHABET.indexOf(char);
      if (index !== -1) {
        shift += index + 1; // +1 porque A=1, B=2, etc.
      }
    }
    return shift;
  }

  // ===== INICIALIZACIÓN DEL SISTEMA =====

  // Generar código de usuario aleatorio de 8 caracteres
  static async generateUserCode(): Promise<string> {
    try {
      // Generar 2 letras para el desplazamiento
      const firstTwo = this.generateRandomLetters(2);

      // Generar 6 letras aleatorias adicionales
      const remaining = this.generateRandomLetters(6);

      // Combinar: XX-XXX-XXX (formato para mejor legibilidad)
      return `${firstTwo}-${remaining.substring(0, 3)}-${remaining.substring(3)}`;
    } catch (error) {
      console.error("Error generando user code:", error);
      // Fallback: generar código aleatorio
      const random = Math.random().toString(36).substring(2, 10).toUpperCase();
      return `${random.substring(0, 2)}-${random.substring(2, 5)}-${random.substring(5, 8)}`;
    }
  }

  // Generar letras aleatorias
  private static generateRandomLetters(count: number): string {
    let result = "";
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * 26);
      result += this.ALPHABET[randomIndex];
    }
    return result;
  }

  // Obtener o generar código del usuario
  static async getUserCode(): Promise<string> {
    try {
      let userCode = await AsyncStorage.getItem(USER_CODE_KEY);

      if (!userCode) {
        userCode = await this.generateUserCode();
        await AsyncStorage.setItem(USER_CODE_KEY, userCode);
        console.log("🔑 Nuevo User Code generado:", userCode);
      }

      return userCode;
    } catch (error) {
      console.error("Error obteniendo user code:", error);
      throw new Error("No se pudo obtener el código del usuario");
    }
  }

  // Registrar instalación inicial
  static async registerInstallation(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const userCode = await this.getUserCode();
      const installDate = new Date().toISOString();

      // Guardar información de instalación
      await AsyncStorage.setItem(INSTALL_DATE_KEY, installDate);

      // Crear licencia inicial
      const licenseInfo: LicenseInfo = {
        userCode,
        installDate,
        isActivated: false,
        isBlocked: false,
        daysRemaining: TRIAL_DAYS,
      };

      await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify(licenseInfo));

      console.log("✅ Instalación registrada:", {
        userCode,
        installDate,
        trialDays: TRIAL_DAYS,
      });

      return {
        success: true,
        message: `Instalación registrada. Tienes ${TRIAL_DAYS} días de prueba.\n\nTu código es: ${userCode}`,
      };
    } catch (error) {
      console.error("Error registrando instalación:", error);
      return {
        success: false,
        message: "Error al registrar la instalación",
      };
    }
  }

  // ===== VALIDACIÓN DE LICENCIA =====

  // Obtener información de licencia
  static async getLicenseInfo(): Promise<LicenseInfo | null> {
    try {
      const licenseData = await AsyncStorage.getItem(LICENSE_KEY);
      return licenseData ? JSON.parse(licenseData) : null;
    } catch (error) {
      console.error("Error obteniendo información de licencia:", error);
      return null;
    }
  }

  // Calcular días restantes
  static calculateDaysRemaining(installDate: string): number {
    const install = new Date(installDate);
    const now = new Date();
    const diffTime =
      install.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000 - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  // Validar licencia actual
  static async validateLicense(): Promise<LicenseValidationResult> {
    try {
      const licenseInfo = await this.getLicenseInfo();

      // Si no hay información de licencia, registrar nueva instalación
      if (!licenseInfo) {
        const installResult = await this.registerInstallation();
        if (!installResult.success) {
          return {
            isValid: false,
            isBlocked: true,
            isActivated: false,
            daysRemaining: 0,
            needsActivation: true,
            message: "Error al inicializar la licencia",
            canUseApp: false,
          };
        }

        // Obtener la licencia recién creada
        const newLicenseInfo = await this.getLicenseInfo();
        if (!newLicenseInfo) {
          return {
            isValid: false,
            isBlocked: true,
            isActivated: false,
            daysRemaining: 0,
            needsActivation: true,
            message: "Error crítico en la licencia",
            canUseApp: false,
          };
        }

        return {
          isValid: true,
          isBlocked: false,
          isActivated: false,
          daysRemaining: newLicenseInfo.daysRemaining,
          needsActivation: false,
          message: `Licencia de prueba válida por ${newLicenseInfo.daysRemaining} días`,
          canUseApp: true,
        };
      }

      // Si está activada permanentemente
      if (licenseInfo.isActivated && licenseInfo.licenseKey) {
        return {
          isValid: true,
          isBlocked: false,
          isActivated: true,
          daysRemaining: -1, // -1 significa ilimitado
          needsActivation: false,
          message: "Licencia activada permanentemente",
          canUseApp: true,
        };
      }

      // Calcular días restantes del período de prueba
      const daysRemaining = this.calculateDaysRemaining(
        licenseInfo.installDate,
      );

      // Si el período de prueba ha expirado
      if (daysRemaining <= 0) {
        // Actualizar estado a bloqueado
        const updatedLicense: LicenseInfo = {
          ...licenseInfo,
          isBlocked: true,
          daysRemaining: 0,
        };
        await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify(updatedLicense));

        return {
          isValid: false,
          isBlocked: true,
          isActivated: false,
          daysRemaining: 0,
          needsActivation: true,
          message:
            "Período de prueba expirado. Contacta al desarrollador para activar.",
          canUseApp: false,
        };
      }

      // Licencia de prueba válida
      return {
        isValid: true,
        isBlocked: false,
        isActivated: false,
        daysRemaining,
        needsActivation: daysRemaining <= 7, // Mostrar advertencia si quedan 7 días o menos
        message:
          daysRemaining > 7
            ? `Licencia de prueba válida por ${daysRemaining} días`
            : `¡Atención! Quedan ${daysRemaining} días de prueba`,
        canUseApp: true,
      };
    } catch (error) {
      console.error("Error validando licencia:", error);
      return {
        isValid: false,
        isBlocked: true,
        isActivated: false,
        daysRemaining: 0,
        needsActivation: true,
        message: "Error al validar la licencia",
        canUseApp: false,
      };
    }
  }

  // ===== ACTIVACIÓN DE LICENCIA =====

  // Generar clave de licencia usando cifrado Cesar
  static generateLicenseKey(userCode: string): string {
    try {
      // Extraer las letras del user code (eliminar guiones)
      const cleanCode = userCode.replace(/-/g, "").toUpperCase();

      if (cleanCode.length !== 8) {
        throw new Error("Código de usuario inválido");
      }

      // Los primeros 2 caracteres determinan el desplazamiento
      const firstTwo = cleanCode.substring(0, 2);
      const remaining = cleanCode.substring(2);

      // Calcular desplazamiento
      const shift = this.calculateShift(firstTwo);

      // Aplicar cifrado Cesar al resto
      const encrypted = this.applyCaesarCipher(remaining, shift);

      // Formatear clave: XX-XXX-XXX
      return `${firstTwo}-${encrypted.substring(0, 3)}-${encrypted.substring(3)}`;
    } catch (error) {
      console.error("Error generando clave de licencia:", error);
      throw error;
    }
  }

  // Validar clave de licencia con cifrado Cesar
  static validateLicenseKey(licenseKey: string, userCode: string): boolean {
    try {
      // Verificar formato básico
      if (!licenseKey || licenseKey.split("-").length !== 3) {
        return false;
      }

      // Extraer las letras (eliminar guiones)
      const cleanLicenseKey = licenseKey.replace(/-/g, "").toUpperCase();
      const cleanUserCode = userCode.replace(/-/g, "").toUpperCase();

      if (cleanLicenseKey.length !== 8 || cleanUserCode.length !== 8) {
        return false;
      }

      // Los primeros 2 caracteres deben ser iguales
      const licenseFirstTwo = cleanLicenseKey.substring(0, 2);
      const userFirstTwo = cleanUserCode.substring(0, 2);

      if (licenseFirstTwo !== userFirstTwo) {
        return false;
      }

      // Calcular desplazamiento
      const shift = this.calculateShift(licenseFirstTwo);

      // Descifrar el resto de la clave
      const licenseRemaining = cleanLicenseKey.substring(2);
      const userRemaining = cleanUserCode.substring(2);

      const deciphered = this.decipherCaesar(licenseRemaining, shift);

      // Verificar que coincidan
      return deciphered === userRemaining;
    } catch (error) {
      console.error("Error validando clave de licencia:", error);
      return false;
    }
  }

  // Activar licencia con clave
  static async activateLicense(
    licenseKey: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userCode = await this.getUserCode();
      const licenseInfo = await this.getLicenseInfo();

      if (!licenseInfo) {
        return {
          success: false,
          message:
            "No se encontró información de licencia. Reinstala la aplicación.",
        };
      }

      // Validar la clave
      if (!this.validateLicenseKey(licenseKey, userCode)) {
        return {
          success: false,
          message: "Clave de licencia inválida para este código",
        };
      }

      // Activar la licencia
      const activatedLicense: LicenseInfo = {
        ...licenseInfo,
        licenseKey,
        isActivated: true,
        isBlocked: false,
        daysRemaining: -1, // Ilimitado
        activationDate: new Date().toISOString(),
      };

      await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify(activatedLicense));

      console.log("✅ Licencia activada:", {
        userCode,
        licenseKey,
        activationDate: activatedLicense.activationDate,
      });

      return {
        success: true,
        message:
          "¡Licencia activada permanentemente! Gracias por usar GestoMax.",
      };
    } catch (error) {
      console.error("Error activando licencia:", error);
      return {
        success: false,
        message: "Error al activar la licencia",
      };
    }
  }

  // ===== UTILIDADES =====

  // Obtener estado completo de la licencia
  static async getLicenseStatus(): Promise<{
    isInstalled: boolean;
    isActivated: boolean;
    isBlocked: boolean;
    daysRemaining: number;
    installDate: string | null;
    userCode: string | null;
    activationDate: string | null;
  }> {
    try {
      const [licenseInfo, userCode] = await Promise.all([
        this.getLicenseInfo(),
        this.getUserCode(),
      ]);

      return {
        isInstalled: !!licenseInfo,
        isActivated: licenseInfo?.isActivated || false,
        isBlocked: licenseInfo?.isBlocked || false,
        daysRemaining: licenseInfo?.daysRemaining || 0,
        installDate: licenseInfo?.installDate || null,
        userCode,
        activationDate: licenseInfo?.activationDate || null,
      };
    } catch (error) {
      console.error("Error obteniendo estado de licencia:", error);
      return {
        isInstalled: false,
        isActivated: false,
        isBlocked: false,
        daysRemaining: 0,
        installDate: null,
        userCode: null,
        activationDate: null,
      };
    }
  }

  // Resetear licencia (solo para desarrollo)
  static async resetLicense(): Promise<{ success: boolean; message: string }> {
    try {
      await AsyncStorage.multiRemove([
        LICENSE_KEY,
        INSTALL_DATE_KEY,
        USER_CODE_KEY,
      ]);

      return {
        success: true,
        message:
          "Licencia reseteada. Reinicia la aplicación para comenzar nuevo período de prueba.",
      };
    } catch (error) {
      console.error("Error reseteando licencia:", error);
      return {
        success: false,
        message: "Error al resetear la licencia",
      };
    }
  }

  // Verificar si debe mostrar advertencia de activación
  static async shouldShowActivationWarning(): Promise<boolean> {
    try {
      const validation = await this.validateLicense();
      return validation.needsActivation && !validation.isBlocked;
    } catch (error) {
      console.error("Error verificando advertencia de activación:", error);
      return false;
    }
  }

  // Obtener mensaje para UI
  static async getLicenseMessage(): Promise<string> {
    try {
      const validation = await this.validateLicense();
      return validation.message;
    } catch (error) {
      console.error("Error obteniendo mensaje de licencia:", error);
      return "Estado de licencia desconocido";
    }
  }
}

export default LicenseService;
