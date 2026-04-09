// Script para agregar columna salario_fijo usando las funciones existentes
import { initializeDatabase } from "./src/db/database";

console.log("🔧 AGREGANDO COLUMNA salario_fijo A TABLA GASTOS\n");

async function fixSalarioFijoColumn() {
  try {
    console.log("📋 Inicializando base de datos...");
    const db = await initializeDatabase();

    console.log("📝 Verificando si la columna salario_fijo existe...");

    // Verificar si la columna ya existe
    const result = await db.getFirstAsync(`
      SELECT name FROM pragma_table_info('Gastos') WHERE name = 'salario_fijo'
    `);

    if (result) {
      console.log("✅ La columna salario_fijo ya existe en la tabla Gastos");
      return;
    }

    console.log("📝 Agregando columna salario_fijo...");

    // Agregar la columna
    await db.runAsync("ALTER TABLE Gastos ADD COLUMN salario_fijo REAL");

    console.log("✅ Columna salario_fijo agregada exitosamente");
    console.log("🎉 El problema debería estar resuelto ahora");
    console.log(
      "📋 Reinicia la aplicación y prueba entrar en la pantalla de gastos",
    );
  } catch (error) {
    console.error("❌ Error al agregar columna salario_fijo:", error);
    console.log("📋 Si el error persiste, ejecuta manualmente:");
    console.log("   ALTER TABLE Gastos ADD COLUMN salario_fijo REAL;");
  }
}

// Ejecutar la función
fixSalarioFijoColumn();
