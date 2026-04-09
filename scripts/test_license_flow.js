// scripts/test_license_flow.js
/**
 * Script para probar el flujo completo de licenciamiento de GestoMax
 *
 * Este script simula:
 * 1. Instalación inicial
 * 2. Uso durante período de prueba
 * 3. Expiración y bloqueo
 * 4. Activación con clave
 */

const LicenseService =
  require("../src/db/services/license_service").LicenseService;

// Mock de AsyncStorage para testing
class MockAsyncStorage {
  constructor() {
    this.data = {};
  }

  async getItem(key) {
    return this.data[key] || null;
  }

  async setItem(key, value) {
    this.data[key] = value;
  }

  async multiRemove(keys) {
    keys.forEach((key) => delete this.data[key]);
  }
}

// Reemplazar AsyncStorage con mock
global.AsyncStorage = new MockAsyncStorage();

async function testLicenseFlow() {
  console.log("🚀 Iniciando prueba del flujo de licenciamiento...\n");

  try {
    // Paso 1: Simular instalación inicial
    console.log("📦 Paso 1: Simulando instalación inicial...");
    const installResult = await LicenseService.registerInstallation();
    console.log("Resultado:", installResult);

    // Obtener deviceId para generar clave
    const deviceId = await LicenseService.getDeviceId();
    console.log("Device ID generado:", deviceId);

    // Paso 2: Validar licencia durante período de prueba
    console.log("\n✅ Paso 2: Validando licencia (período de prueba)...");
    const validation1 = await LicenseService.validateLicense();
    console.log("Estado de licencia:", validation1);

    // Paso 3: Simular paso del tiempo (modificar fecha de instalación)
    console.log("\n⏰ Paso 3: Simulando paso del tiempo...");

    // Modificar fecha de instalación a hace 35 días (expirado)
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 35);

    await global.AsyncStorage.setItem(
      "GESTOMAX_INSTALL_DATE",
      expiredDate.toISOString(),
    );

    // Paso 4: Validar licencia expirada
    console.log("\n🔒 Paso 4: Validando licencia expirada...");
    const validation2 = await LicenseService.validateLicense();
    console.log("Estado de licencia:", validation2);

    // Paso 5: Generar clave de licencia
    console.log("\n🔑 Paso 5: Generando clave de licencia...");
    const licenseKey = LicenseService.generateLicenseKey(deviceId);
    console.log("Clave generada:", licenseKey);

    // Paso 6: Activar licencia
    console.log("\n✨ Paso 6: Activando licencia...");
    const activationResult = await LicenseService.activateLicense(licenseKey);
    console.log("Resultado de activación:", activationResult);

    // Paso 7: Validar licencia activada
    console.log("\n🎉 Paso 7: Validando licencia activada...");
    const validation3 = await LicenseService.validateLicense();
    console.log("Estado final de licencia:", validation3);

    // Paso 8: Obtener estado completo
    console.log("\n📊 Paso 8: Estado completo del sistema...");
    const status = await LicenseService.getLicenseStatus();
    console.log("Estado completo:", status);

    console.log("\n✅ Prueba completada exitosamente!");
  } catch (error) {
    console.error("❌ Error en la prueba:", error);
  }
}

async function testKeyGeneration() {
  console.log("\n🔑 Probando generación de claves...\n");

  const testDevices = [
    "GM-ANDROID-A1B2C3D4",
    "GM-IOS-E5F6G7H8",
    "GM-WINDOWS-I9J0K1L2",
  ];

  testDevices.forEach((deviceId) => {
    const licenseKey = LicenseService.generateLicenseKey(deviceId);
    const isValid = LicenseService.validateLicenseKey(licenseKey, deviceId);

    console.log(`Device: ${deviceId}`);
    console.log(`Key: ${licenseKey}`);
    console.log(`Valid: ${isValid ? "✅" : "❌"}`);
    console.log("---");
  });
}

async function testEdgeCases() {
  console.log("\n🧪 Probando casos límite...\n");

  // Test 1: Clave inválida
  console.log("Test 1: Clave inválida");
  const invalidKey = "INVALID-KEY-FORMAT";
  const deviceId = "GM-ANDROID-A1B2C3D4";
  const isValid1 = LicenseService.validateLicenseKey(invalidKey, deviceId);
  console.log("Clave inválida válida:", isValid1 ? "❌" : "✅");

  // Test 2: Clave para dispositivo incorrecto
  console.log("\nTest 2: Clave para dispositivo incorrecto");
  const wrongDeviceKey = LicenseService.generateLicenseKey("GM-IOS-E5F6G7H8");
  const isValid2 = LicenseService.validateLicenseKey(wrongDeviceKey, deviceId);
  console.log("Clave wrong device válida:", isValid2 ? "❌" : "✅");

  // Test 3: Reset de licencia
  console.log("\nTest 3: Reset de licencia");
  const resetResult = await LicenseService.resetLicense();
  console.log("Reset resultado:", resetResult);
}

// Función principal
async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--flow" || args[0] === "-f") {
    await testLicenseFlow();
  } else if (args[0] === "--keys" || args[0] === "-k") {
    await testKeyGeneration();
  } else if (args[0] === "--edge" || args[0] === "-e") {
    await testEdgeCases();
  } else if (args[0] === "--all" || args[0] === "-a") {
    await testKeyGeneration();
    await testLicenseFlow();
    await testEdgeCases();
  } else {
    console.log("🧪 Testing Suite para GestoMax License System");
    console.log("===========================================");
    console.log("");
    console.log("Uso:");
    console.log(
      "  node scripts/test_license_flow.js --flow     # Probar flujo completo",
    );
    console.log(
      "  node scripts/test_license_flow.js --keys     # Probar generación de claves",
    );
    console.log(
      "  node scripts/test_license_flow.js --edge     # Probar casos límite",
    );
    console.log("  node scripts/test_license_flow.js --all      # Probar todo");
    console.log("");
    console.log("Ejemplos:");
    console.log("  node scripts/test_license_flow.js -f");
    console.log("  node scripts/test_license_flow.js -k");
    console.log("  node scripts/test_license_flow.js -e");
    console.log("  node scripts/test_license_flow.js -a");
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testLicenseFlow,
  testKeyGeneration,
  testEdgeCases,
};
