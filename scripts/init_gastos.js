// scripts/init_gastos.js - Script para inicializar tabla Gastos
const SQLite = require("expo-sqlite");

function initGastosTable() {
  const db = SQLite.openDatabaseSync("gestion_almacen.db");

  try {
    // Verificar si la tabla existe
    const result = db.getAllSync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='Gastos'
    `);

    if (result.length === 0) {
      console.log("🔨 Creando tabla Gastos...");

      // Crear la tabla Gastos
      db.execSync(`
        CREATE TABLE Gastos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          precio REAL NOT NULL,
          punto_id INTEGER NOT NULL,
          tipo TEXT NOT NULL CHECK(tipo IN ('casual', 'pasivo')) DEFAULT 'casual',
          categoria TEXT DEFAULT 'general',
          descripcion TEXT,
          fecha_gasto DATE NOT NULL,
          recurrente BOOLEAN DEFAULT FALSE,
          periodicidad TEXT CHECK(periodicidad IN ('diario', 'semanal', 'mensual')),
          activo BOOLEAN DEFAULT TRUE,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
        )
      `);

      console.log("✅ Tabla Gastos creada correctamente");
    } else {
      console.log("ℹ️  Tabla Gastos ya existe");
    }
  } catch (error) {
    console.error("❌ Error creando tabla Gastos:", error);
  }
}

// Ejecutar la inicialización
initGastosTable();
console.log("🎉 Inicialización de Gastos completada");
