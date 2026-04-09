// src/services/almacenes.service.ts
import {
    executeNonQuery,
    executeQuery,
    getFirst,
    getSingleValue,
    SQLiteRunResult,
} from "../database";

// Interface para Almacén
export interface Almacen {
  id: number;
  nombre: string;
  descripcion?: string;
  ubicacion?: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

// Interface para estadísticas de almacén
export interface EstadisticasAlmacen {
  totalProductos: number;
  totalDinero: number;
  productosConStock: number;
  productosSinStock: number;
  productosVencidos: number;
  productosPorVencer: number;
}

export class AlmacenesService {
  // 1. CREAR ALMACÉN
  static async createAlmacen(
    nombre: string,
    descripcion?: string,
    ubicacion?: string,
  ): Promise<SQLiteRunResult> {
    try {
      const result = await executeNonQuery(
        `INSERT INTO Almacenes (nombre, descripcion, ubicacion) 
         VALUES (?, ?, ?)`,
        [nombre, descripcion || null, ubicacion || null],
      );
      return result;
    } catch (error) {
      console.error("Error en AlmacenesService.createAlmacen:", error);
      throw error;
    }
  }

  // 2. OBTENER TODOS LOS ALMACENES
  static async getAllAlmacenes(): Promise<Almacen[]> {
    try {
      const almacenes = await executeQuery<any>(`
        SELECT * FROM Almacenes 
        ORDER BY nombre ASC
      `);

      return almacenes.map((almacen) => ({
        ...almacen,
        activo: Boolean(almacen.activo),
      }));
    } catch (error) {
      console.error("Error en AlmacenesService.getAllAlmacenes:", error);
      return [];
    }
  }

  // 3. OBTENER ALMACÉN POR ID
  static async getAlmacenById(id: number): Promise<Almacen | null> {
    try {
      const almacen = await getFirst<any>(
        `
        SELECT * FROM Almacenes WHERE id = ?
      `,
        [id],
      );

      if (!almacen) return null;

      return {
        ...almacen,
        activo: Boolean(almacen.activo),
      };
    } catch (error) {
      console.error("Error en AlmacenesService.getAlmacenById:", error);
      return null;
    }
  }

  // 4. ACTUALIZAR ALMACÉN
  static async updateAlmacen(
    id: number,
    nombre: string,
    descripcion?: string,
    ubicacion?: string,
    activo?: boolean,
  ): Promise<SQLiteRunResult> {
    try {
      // Importar función de fecha local para consistencia
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const result = await executeNonQuery(
        `UPDATE Almacenes 
         SET nombre = ?, descripcion = ?, ubicacion = ?, activo = ?, 
             actualizado_en = ? 
         WHERE id = ?`,
        [
          nombre,
          descripcion || null,
          ubicacion || null,
          activo !== false ? 1 : 0,
          ahora, // Usar fecha local en lugar de CURRENT_TIMESTAMP
          id,
        ],
      );
      return result;
    } catch (error) {
      console.error("Error en AlmacenesService.updateAlmacen:", error);
      throw error;
    }
  }

  // 5. ELIMINAR ALMACÉN
  static async deleteAlmacen(id: number): Promise<SQLiteRunResult> {
    try {
      // Primero verificar si hay productos en este almacén
      const productosCount = await getSingleValue<number>(
        "SELECT COUNT(*) FROM AlmacenProducto WHERE almacen_id = ?",
        [id],
      );

      if (productosCount && productosCount > 0) {
        throw new Error(
          `No se puede eliminar el almacén porque tiene ${productosCount} productos asociados`,
        );
      }

      const result = await executeNonQuery(
        "DELETE FROM Almacenes WHERE id = ?",
        [id],
      );
      return result;
    } catch (error) {
      console.error("Error en AlmacenesService.deleteAlmacen:", error);
      throw error;
    }
  }

  // 6. ACTIVAR/DESACTIVAR ALMACÉN
  static async toggleAlmacen(
    id: number,
    activo: boolean,
  ): Promise<SQLiteRunResult> {
    try {
      // Importar función de fecha local para consistencia
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const result = await executeNonQuery(
        "UPDATE Almacenes SET activo = ?, actualizado_en = ? WHERE id = ?",
        [activo ? 1 : 0, ahora, id],
      );
      return result;
    } catch (error) {
      console.error("Error en AlmacenesService.toggleAlmacen:", error);
      throw error;
    }
  }

  // 7. OBTENER ESTADÍSTICAS DE UN ALMACÉN
  static async getEstadisticasAlmacen(
    almacenId: number,
  ): Promise<EstadisticasAlmacen> {
    try {
      const [
        totalProductos,
        totalDinero,
        productosConStock,
        productosSinStock,
        productosVencidos,
        productosPorVencer,
      ] = await Promise.all([
        // Total de productos únicos en el almacén
        getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenProducto WHERE almacen_id = ?",
          [almacenId],
        ),
        // Valor total del inventario
        getSingleValue<number>(
          `SELECT COALESCE(SUM(ap.cantidad * p.precio_coste), 0) 
           FROM AlmacenProducto ap 
           INNER JOIN Producto p ON ap.producto_id = p.id 
           WHERE ap.almacen_id = ?`,
          [almacenId],
        ),
        // Productos con stock
        getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenProducto WHERE almacen_id = ? AND cantidad > 0",
          [almacenId],
        ),
        // Productos sin stock
        getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenProducto WHERE almacen_id = ? AND cantidad <= 0",
          [almacenId],
        ),
        // Productos vencidos
        getSingleValue<number>(
          `SELECT COUNT(*) 
           FROM AlmacenProducto ap 
           INNER JOIN Producto p ON ap.producto_id = p.id 
           WHERE ap.almacen_id = ? 
             AND p.fecha_caducidad IS NOT NULL 
             AND DATE(p.fecha_caducidad) < DATE('now')`,
          [almacenId],
        ),
        // Productos por vencer (próximos 30 días)
        getSingleValue<number>(
          `SELECT COUNT(*) 
           FROM AlmacenProducto ap 
           INNER JOIN Producto p ON ap.producto_id = p.id 
           WHERE ap.almacen_id = ? 
             AND p.fecha_caducidad IS NOT NULL 
             AND DATE(p.fecha_caducidad) BETWEEN DATE('now') AND DATE('now', '+30 days')`,
          [almacenId],
        ),
      ]);

      return {
        totalProductos: totalProductos || 0,
        totalDinero: totalDinero || 0,
        productosConStock: productosConStock || 0,
        productosSinStock: productosSinStock || 0,
        productosVencidos: productosVencidos || 0,
        productosPorVencer: productosPorVencer || 0,
      };
    } catch (error) {
      console.error("Error en AlmacenesService.getEstadisticasAlmacen:", error);
      return {
        totalProductos: 0,
        totalDinero: 0,
        productosConStock: 0,
        productosSinStock: 0,
        productosVencidos: 0,
        productosPorVencer: 0,
      };
    }
  }

  // 8. VERIFICAR SI EXISTE ALMACÉN CON ESE NOMBRE
  static async existsNombre(
    nombre: string,
    excludeId?: number,
  ): Promise<boolean> {
    try {
      let query = "SELECT COUNT(*) FROM Almacenes WHERE nombre = ?";
      const params: any[] = [nombre];

      if (excludeId) {
        query += " AND id != ?";
        params.push(excludeId);
      }

      const count = await getSingleValue<number>(query, params);
      return (count || 0) > 0;
    } catch (error) {
      console.error("Error en AlmacenesService.existsNombre:", error);
      return false;
    }
  }

  // 9. OBTENER ALMACENES ACTIVOS
  static async getAlmacenesActivos(): Promise<Almacen[]> {
    try {
      const almacenes = await executeQuery<any>(`
        SELECT * FROM Almacenes 
        WHERE activo = 1 
        ORDER BY nombre ASC
      `);

      return almacenes.map((almacen) => ({
        ...almacen,
        activo: Boolean(almacen.activo),
      }));
    } catch (error) {
      console.error("Error en AlmacenesService.getAlmacenesActivos:", error);
      return [];
    }
  }

  // 10. CONTAR TOTAL DE ALMACENES
  static async countAlmacenes(): Promise<number> {
    try {
      const count = await getSingleValue<number>(
        "SELECT COUNT(*) FROM Almacenes",
      );
      return count || 0;
    } catch (error) {
      console.error("Error en AlmacenesService.countAlmacenes:", error);
      return 0;
    }
  }

  // 11. CONTAR ALMACENES ACTIVOS
  static async countAlmacenesActivos(): Promise<number> {
    try {
      const count = await getSingleValue<number>(
        "SELECT COUNT(*) FROM Almacenes WHERE activo = 1",
      );
      return count || 0;
    } catch (error) {
      console.error("Error en AlmacenesService.countAlmacenesActivos:", error);
      return 0;
    }
  }
}
