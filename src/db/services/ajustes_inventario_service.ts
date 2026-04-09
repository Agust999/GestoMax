import { executeNonQuery, executeQuery } from "../database";

class AjustesInventarioService {
  static async crearTabla(): Promise<void> {
    try {
      // Verificar si la tabla ya existe con la estructura correcta
      const checkQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='ajustes_inventario'
      `;

      const resultado = await executeQuery(checkQuery);

      if (resultado.length > 0) {
        // La tabla existe, verificar si tiene la columna correcta
        const columnCheckQuery = `
          PRAGMA table_info(ajustes_inventario)
        `;

        const columnas = await executeQuery(columnCheckQuery);
        const tieneCantidadAjuste = columnas.some(
          (col: any) => col.name === "cantidad_ajuste",
        );

        if (tieneCantidadAjuste) {
          console.log(
            "✅ Tabla ajustes_inventario ya existe con estructura correcta",
          );
          return;
        }
      }

      // Si no existe o no tiene la estructura correcta, recrearla
      console.log("🔄 Creando tabla ajustes_inventario...");
      const dropQuery = `DROP TABLE IF EXISTS ajustes_inventario`;
      await executeNonQuery(dropQuery);

      const query = `
        CREATE TABLE ajustes_inventario (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          punto_id INTEGER NOT NULL,
          producto_id INTEGER NOT NULL,
          cantidad_ajuste INTEGER NOT NULL,
          fecha DATE NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(punto_id, producto_id, fecha),
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE,
          FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
        );
      `;

      await executeNonQuery(query);
      console.log("✅ Tabla ajustes_inventario creada correctamente");
    } catch (error: any) {
      console.error("❌ Error creando tabla ajustes_inventario:", error);
      // Si es error de tabla bloqueada, no lanzar el error para evitar crashes
      if (error.message && error.message.includes("database table is locked")) {
        console.log("⚠️ Tabla bloqueada, intentando más tarde...");
        return;
      }
      throw error;
    }
  }

  static async guardarAjustes(
    puntoId: number,
    fecha: string,
    ajustes: { [productoId: number]: number },
  ): Promise<{ success: boolean; message: string }> {
    try {
      for (const [productoId, cantidad] of Object.entries(ajustes)) {
        if (cantidad !== 0) {
          await executeNonQuery(
            `INSERT OR REPLACE INTO ajustes_inventario 
             (punto_id, producto_id, cantidad_ajuste, fecha) 
             VALUES (?, ?, ?, ?)`,
            [puntoId, parseInt(productoId), cantidad, fecha],
          );
        }
      }

      return { success: true, message: "Ajustes guardados correctamente" };
    } catch (error: any) {
      console.error("Error guardando ajustes:", error);
      return {
        success: false,
        message: error.message || "Error guardando ajustes",
      };
    }
  }

  static async obtenerAjusteFecha(
    puntoId: number,
    fecha: string,
  ): Promise<{ [productoId: number]: number }> {
    try {
      // Intentar crear la tabla solo si es necesario
      try {
        await this.crearTabla();
      } catch (error: any) {
        // Si hay error de bloqueo, continuar con la consulta
        if (
          !error.message ||
          !error.message.includes("database table is locked")
        ) {
          throw error;
        }
        console.log("⚠️ Tabla bloqueada, continuando con consulta...");
      }

      const query = `
        SELECT producto_id, cantidad_ajuste
        FROM ajustes_inventario
        WHERE punto_id = ? AND fecha = ?
      `;

      const resultados = await executeQuery(query, [puntoId, fecha]);

      const ajustes: { [productoId: number]: number } = {};
      resultados.forEach((row: any) => {
        ajustes[row.producto_id] = row.cantidad_ajuste;
      });

      return ajustes;
    } catch (error: any) {
      console.error("Error obteniendo ajustes de fecha:", error);
      // Si hay un error de columna no existente, devolver vacío
      if (error.message && error.message.includes("no such column")) {
        console.log(
          "⚠️ Tabla ajustes_inventario con estructura incorrecta, recreando...",
        );
        try {
          await this.crearTabla();
        } catch (createError: any) {
          console.log("⚠️ No se pudo recrear la tabla, continuando...");
        }
        return {};
      }
      // Si es error de bloqueo, devolver vacío y continuar
      if (error.message && error.message.includes("database table is locked")) {
        console.log("⚠️ Base de datos bloqueada, devolviendo vacío...");
        return {};
      }
      return {};
    }
  }

  static async obtenerAjustesAcumulados(
    puntoId: number,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<{ [productoId: number]: number }> {
    try {
      // Intentar crear la tabla solo si es necesario
      try {
        await this.crearTabla();
      } catch (error: any) {
        // Si hay error de bloqueo, continuar con la consulta
        if (
          !error.message ||
          !error.message.includes("database table is locked")
        ) {
          throw error;
        }
        console.log("⚠️ Tabla bloqueada, continuando con consulta...");
      }

      const query = `
        SELECT producto_id, SUM(cantidad_ajuste) as total_ajuste
        FROM ajustes_inventario
        WHERE punto_id = ? AND fecha >= ? AND fecha <= ?
        GROUP BY producto_id
      `;

      const resultados = await executeQuery(query, [
        puntoId,
        fechaInicio,
        fechaFin,
      ]);

      const ajustes: { [productoId: number]: number } = {};
      resultados.forEach((row: any) => {
        ajustes[row.producto_id] = row.total_ajuste || 0;
      });

      return ajustes;
    } catch (error: any) {
      console.error("Error obteniendo ajustes acumulados:", error);
      // Si hay un error de columna no existente, devolver vacío
      if (error.message && error.message.includes("no such column")) {
        console.log(
          "⚠️ Tabla ajustes_inventario con estructura incorrecta, recreando...",
        );
        try {
          await this.crearTabla();
        } catch (createError: any) {
          console.log("⚠️ No se pudo recrear la tabla, continuando...");
        }
        return {};
      }
      // Si es error de bloqueo, devolver vacío y continuar
      if (error.message && error.message.includes("database table is locked")) {
        console.log("⚠️ Base de datos bloqueada, devolviendo vacío...");
        return {};
      }
      return {};
    }
  }

  static async limpiarAjustesMes(
    puntoId: number,
    año: number,
    mes: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const query = `
        DELETE FROM ajustes_inventario
        WHERE punto_id = ? AND strftime('%Y', fecha) = ? AND strftime('%m', fecha) = ?
      `;

      await executeNonQuery(query, [
        puntoId,
        año.toString(),
        mes.toString().padStart(2, "0"),
      ]);

      return {
        success: true,
        message: "Ajustes del mes eliminados correctamente",
      };
    } catch (error: any) {
      console.error("Error limpiando ajustes del mes:", error);
      return {
        success: false,
        message: error.message || "Error limpiando ajustes",
      };
    }
  }
}

export default AjustesInventarioService;
