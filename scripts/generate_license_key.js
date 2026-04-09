// scripts/generate_license_key.js
/**
 * Herramienta para generar claves de licencia para GestoMax
 *
 * Uso:
 * node scripts/generate_license_key.js <DEVICE_ID>
 *
 * Ejemplo:
 * node scripts/generate_license_key.js GM-ANDROID-A1B2C3D4
 */

const crypto = require("crypto");

function generateLicenseKey(deviceId) {
  if (!deviceId) {
    console.error("❌ Error: Debes proporcionar el Device ID");
    console.log("Uso: node scripts/generate_license_key.js <DEVICE_ID>");
    console.log(
      "Ejemplo: node scripts/generate_license_key.js GM-ANDROID-A1B2C3D4",
    );
    process.exit(1);
  }

  // Validar formato del deviceId
  if (!deviceId.startsWith("GM-") || deviceId.split("-").length !== 3) {
    console.error("❌ Error: Formato de Device ID inválido");
    console.log("Formato esperado: GM-<PLATFORM>-<HASH>");
    console.log("Ejemplo: GM-ANDROID-A1B2C3D4");
    process.exit(1);
  }

  try {
    // Extraer partes del deviceId
    const parts = deviceId.split("-");
    const platform = parts[1];
    const deviceHash = parts[2];

    // Generar timestamp y parte aleatoria
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();

    // Obtener año actual
    const year = new Date().getFullYear().toString().slice(-2);

    // Generar clave de licencia
    const licenseKey =
      `GM-${year}-${deviceHash}-${randomPart}-${timestamp}`.toUpperCase();

    console.log("\n🎉 CLAVE DE LICENCIA GENERADA");
    console.log("================================");
    console.log(`📱 Device ID: ${deviceId}`);
    console.log(`🔑 License Key: ${licenseKey}`);
    console.log(`📅 Generated: ${new Date().toLocaleString()}`);
    console.log(`🖥️  Platform: ${platform}`);
    console.log("\n✅ Instrucciones para el usuario:");
    console.log("1. Abre GestoMax en el dispositivo bloqueado");
    console.log('2. Ingresa esta clave en el campo "Clave de Licencia"');
    console.log('3. Presiona "Activar Licencia"');
    console.log("4. ¡Listo! La app quedará activada permanentemente");
    console.log(
      "\n⚠️  Importante: Esta clave solo funciona para este dispositivo específico",
    );

    // Guardar en archivo de registro
    const logEntry = {
      deviceId,
      licenseKey,
      generatedAt: new Date().toISOString(),
      platform,
    };

    // Aquí podrías guardar en una base de datos o archivo CSV
    console.log("\n📝 Registro guardado para tu control");
  } catch (error) {
    console.error("❌ Error generando la clave:", error.message);
    process.exit(1);
  }
}

// Función para validar una clave de licencia
function validateLicenseKey(licenseKey, deviceId) {
  try {
    if (!licenseKey || !licenseKey.startsWith("GM-")) {
      return { valid: false, error: "Formato inválido" };
    }

    const parts = licenseKey.split("-");
    if (parts.length !== 4) {
      return { valid: false, error: "Formato inválido" };
    }

    const deviceHash = deviceId.split("-")[2] || "XXXX";
    if (parts[1] !== deviceHash) {
      return { valid: false, error: "Device ID no coincide" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Función para generar múltiples claves (para testing)
function generateMultipleKeys(count = 5) {
  console.log(`\n🔑 Generando ${count} claves de prueba...`);

  for (let i = 0; i < count; i++) {
    const testDeviceId = `GM-ANDROID-TEST${i.toString().padStart(4, "0")}`;
    const licenseKey = generateLicenseKey(testDeviceId);
    console.log(`${i + 1}. ${testDeviceId} -> ${licenseKey}`);
  }
}

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);

if (args[0] === "--test" || args[0] === "-t") {
  const count = parseInt(args[1]) || 5;
  generateMultipleKeys(count);
} else if (args[0] === "--validate" || args[0] === "-v") {
  if (args.length < 3) {
    console.error("❌ Error: Debes proporcionar licenseKey y deviceId");
    console.log(
      "Uso: node scripts/generate_license_key.js --validate <LICENSE_KEY> <DEVICE_ID>",
    );
    process.exit(1);
  }

  const validation = validateLicenseKey(args[1], args[2]);
  if (validation.valid) {
    console.log("✅ Clave válida para este dispositivo");
  } else {
    console.log("❌ Clave inválida:", validation.error);
  }
} else {
  generateLicenseKey(args[0]);
}

module.exports = {
  generateLicenseKey,
  validateLicenseKey,
};
