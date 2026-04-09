import { executeNonQuery, executeQuery } from "../database";

// Tabla para guardar datos reducidos del IPV
const crearTablaDatosReducidos = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS ipv_datos_reducidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      punto_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      inicio INTEGER NOT NULL,
      entro INTEGER NOT NULL,
      vendio INTEGER NOT NULL,
      quedo INTEGER NOT NULL,
      precio_venta REAL NOT NULL,
      monto_vendido REAL NOT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(punto_id, producto_id, fecha),
      FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
    );
  `;
  await executeNonQuery(query);
};

// Función para guardar o actualizar datos reducidos
export const guardarDatosReducidos = async (
  puntoId: number,
  fecha: string,
  productos: any[],
) => {
  try {
    await crearTablaDatosReducidos();

    await executeNonQuery("BEGIN TRANSACTION");

    // Eliminar datos existentes para esa fecha y punto
    await executeNonQuery(
      "DELETE FROM ipv_datos_reducidos WHERE punto_id = ? AND fecha = ?",
      [puntoId, fecha],
    );

    // Insertar nuevos datos reducidos
    for (const producto of productos) {
      await executeNonQuery(
        `INSERT INTO ipv_datos_reducidos 
         (punto_id, producto_id, fecha, inicio, entro, vendio, quedo, precio_venta, monto_vendido) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          puntoId,
          producto.id,
          fecha,
          producto.inicio,
          producto.entro,
          producto.vendio,
          producto.quedo,
          producto.precio,
          producto.monto_vendido,
        ],
      );
    }

    await executeNonQuery("COMMIT");
    return {
      success: true,
      message: "Datos reducidos guardados correctamente",
    };
  } catch (error: any) {
    await executeNonQuery("ROLLBACK");
    console.error("Error guardando datos reducidos:", error);
    return {
      success: false,
      message: error.message || "Error guardando datos reducidos",
    };
  }
};

// Función para obtener datos reducidos de una fecha
export const obtenerDatosReducidos = async (puntoId: number, fecha: string) => {
  try {
    await crearTablaDatosReducidos();

    const query = `
      SELECT 
        dr.id, dr.punto_id, dr.producto_id, dr.fecha,
        dr.inicio, dr.entro, dr.vendio, dr.quedo,
        dr.precio_venta as precio, dr.monto_vendido,
        p.nombre as producto
      FROM ipv_datos_reducidos dr
      INNER JOIN Producto p ON p.id = dr.producto_id
      WHERE dr.punto_id = ? AND dr.fecha = ?
      ORDER BY p.nombre
    `;

    const resultados = await executeQuery(query, [puntoId, fecha]);
    return resultados || [];
  } catch (error: any) {
    console.error("Error obteniendo datos reducidos:", error);
    return [];
  }
};

// Función para verificar si existen datos reducidos para una fecha
export const existeDatosReducidos = async (
  puntoId: number,
  fecha: string,
): Promise<boolean> => {
  try {
    await crearTablaDatosReducidos();

    const query = `
      SELECT COUNT(*) as count
      FROM ipv_datos_reducidos
      WHERE punto_id = ? AND fecha = ?
    `;

    const resultado = await executeQuery(query, [puntoId, fecha]);
    return resultado[0]?.count > 0;
  } catch (error: any) {
    console.error("Error verificando datos reducidos:", error);
    return false;
  }
};

// Función para eliminar datos reducidos de un mes
export const eliminarDatosReducidosMes = async (
  puntoId: number,
  año: number,
  mes: number,
) => {
  try {
    await crearTablaDatosReducidos();

    const query = `
      DELETE FROM ipv_datos_reducidos
      WHERE punto_id = ? 
      AND strftime('%Y', fecha) = ? 
      AND strftime('%m', fecha) = ?
    `;

    await executeNonQuery(query, [
      puntoId,
      año.toString(),
      mes.toString().padStart(2, "0"),
    ]);

    return { success: true, message: "Datos reducidos del mes eliminados" };
  } catch (error: any) {
    console.error("Error eliminando datos reducidos del mes:", error);
    return {
      success: false,
      message: error.message || "Error eliminando datos reducidos",
    };
  }
};
