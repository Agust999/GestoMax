/**
 * Migration: Add 'creacion' to HistorialInventario tipo_movimiento CHECK constraint
 *
 * This migration updates the HistorialInventario table to allow 'creacion' as a valid
 * tipo_movimiento value alongside the existing values.
 */

import { executeNonQuery } from "../database";

export async function migrateAddCreacionToHistorialInventario(): Promise<void> {
  try {
    console.log(
      "🔄 Starting migration: Add 'creacion' to HistorialInventario.tipo_movimiento",
    );

    // 1. Create the new table with the updated constraint
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS HistorialInventario_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        almacen_id INTEGER,
        punto_id INTEGER,
        zona_id INTEGER,
        tipo_movimiento TEXT NOT NULL CHECK(tipo_movimiento IN ('transferencia', 'venta', 'ajuste', 'cierre', 'devolucion', 'merma', 'produccion', 'creacion')),
        cantidad_variacion INTEGER NOT NULL,
        stock_anterior INTEGER NOT NULL DEFAULT 0,
        stock_nuevo INTEGER NOT NULL DEFAULT 0,
        entidad_origen_destino TEXT,
        notas TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
        FOREIGN KEY (almacen_id) REFERENCES Almacenes(id) ON DELETE SET NULL,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE SET NULL
      )
    `);

    // 2. Copy data from old table to new table
    await executeNonQuery(`
      INSERT INTO HistorialInventario_new (
        id, producto_id, almacen_id, punto_id, zona_id, 
        tipo_movimiento, cantidad_variacion, stock_anterior, stock_nuevo,
        entidad_origen_destino, notas, creado_en
      )
      SELECT 
        id, producto_id, almacen_id, punto_id, zona_id, 
        tipo_movimiento, cantidad_variacion, stock_anterior, stock_nuevo,
        entidad_origen_destino, notas, creado_en
      FROM HistorialInventario
    `);

    // 3. Drop the old table
    await executeNonQuery("DROP TABLE HistorialInventario");

    // 4. Rename the new table to the original name
    await executeNonQuery(
      "ALTER TABLE HistorialInventario_new RENAME TO HistorialInventario",
    );

    // 5. Recreate indexes if they exist
    await executeNonQuery(`
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_producto_id 
      ON HistorialInventario(producto_id)
    `);

    await executeNonQuery(`
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_almacen_id 
      ON HistorialInventario(almacen_id)
    `);

    await executeNonQuery(`
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_punto_id 
      ON HistorialInventario(punto_id)
    `);

    await executeNonQuery(`
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_tipo_movimiento 
      ON HistorialInventario(tipo_movimiento)
    `);

    await executeNonQuery(`
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_creado_en 
      ON HistorialInventario(creado_en)
    `);

    console.log(
      "✅ Migration completed successfully: 'creacion' added to HistorialInventario.tipo_movimiento",
    );
  } catch (error) {
    console.error(
      "❌ Error in migration add_creacion_to_historial_inventario:",
      error,
    );
    throw error;
  }
}
