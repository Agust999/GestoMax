// src/db/migrations/add_consumo_propio_to_venta.ts
// Migración para agregar campos de consumo propio a la tabla Venta

import {
    executeNonQuery,
    getSingleValue,
    verificarTablaExiste,
} from "../database";

export const migrateAddConsumoPropioToVenta = async (): Promise<void> => {
  try {
    console.log(
      "🔄 Iniciando migración: agregar campos de consumo propio a Venta",
    );

    // Verificar si la tabla Venta existe
    const tablaExiste = await verificarTablaExiste("Venta");
    if (!tablaExiste) {
      console.log("❌ La tabla Venta no existe, omitiendo migración");
      return;
    }

    // Verificar si la columna ya existe
    const columnaConsumoPropioExiste = await getSingleValue<number>(
      `SELECT COUNT(*) as count FROM pragma_table_info('Venta') WHERE name = 'es_consumo_propio'`,
    );

    if ((columnaConsumoPropioExiste ?? 0) > 0) {
      console.log("✅ La columna 'es_consumo_propio' ya existe en Venta");
    } else {
      // Agregar columna es_consumo_propio
      await executeNonQuery(`
        ALTER TABLE Venta ADD COLUMN es_consumo_propio BOOLEAN DEFAULT 0
      `);
      console.log("✅ Columna 'es_consumo_propio' agregada a Venta");
    }

    // Verificar si la columna trabajador_id ya existe
    const columnaTrabajadorExiste = await getSingleValue<number>(
      `SELECT COUNT(*) as count FROM pragma_table_info('Venta') WHERE name = 'trabajador_id'`,
    );

    if ((columnaTrabajadorExiste ?? 0) > 0) {
      console.log("✅ La columna 'trabajador_id' ya existe en Venta");
    } else {
      // Agregar columna trabajador_id
      await executeNonQuery(`
        ALTER TABLE Venta ADD COLUMN trabajador_id INTEGER
      `);
      console.log("✅ Columna 'trabajador_id' agregada a Venta");
    }

    // Verificar si la columna metodo_consumo ya existe
    const columnaMetodoConsumoExiste = await getSingleValue<number>(
      `SELECT COUNT(*) as count FROM pragma_table_info('Venta') WHERE name = 'metodo_consumo'`,
    );

    if ((columnaMetodoConsumoExiste ?? 0) > 0) {
      console.log("✅ La columna 'metodo_consumo' ya existe en Venta");
    } else {
      // Agregar columna metodo_consumo
      await executeNonQuery(`
        ALTER TABLE Venta ADD COLUMN metodo_consumo TEXT CHECK(metodo_consumo IN ('coste', 'porcentual', 'fijo', NULL))
      `);
      console.log("✅ Columna 'metodo_consumo' agregada a Venta");
    }

    // Verificar si la columna valor_descuento ya existe
    const columnaValorDescuentoExiste = await getSingleValue<number>(
      `SELECT COUNT(*) as count FROM pragma_table_info('Venta') WHERE name = 'valor_descuento'`,
    );

    if ((columnaValorDescuentoExiste ?? 0) > 0) {
      console.log("✅ La columna 'valor_descuento' ya existe en Venta");
    } else {
      // Agregar columna valor_descuento
      await executeNonQuery(`
        ALTER TABLE Venta ADD COLUMN valor_descuento TEXT
      `);
      console.log("✅ Columna 'valor_descuento' agregada a Venta");
    }

    console.log(
      "✅ Migración completada: campos de consumo propio agregados a Venta",
    );
  } catch (error) {
    console.error("❌ Error en migración de consumo propio a Venta:", error);
    throw error;
  }
};
