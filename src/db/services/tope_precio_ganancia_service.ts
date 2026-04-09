// src/db/services/tope_precio_ganancia_service.ts - Servicio para gestión de topes de precios en pantalla de ganancia

import { executeNonQuery, executeQuery, getFirst } from "../database";

export interface TopePrecioGanancia {
  id?: number;
  punto_id: number;
  nombre_producto: string;
  precio_tope: number;
  creado_en?: string;
  actualizado_en?: string;
}

export class TopePrecioGananciaService {
  // Crear tabla de topes de precios de ganancia si no existe
  static async crearTabla(): Promise<void> {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS TopePrecioGanancia (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          punto_id INTEGER NOT NULL,
          nombre_producto TEXT NOT NULL,
          precio_tope REAL NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(punto_id, nombre_producto),
          FOREIGN KEY (punto_id) REFERENCES Punto(id)
        );
      `;

      await executeNonQuery(query);
      console.log("✅ Tabla TopePrecioGanancia creada o verificada");
    } catch (error) {
      console.error("❌ Error creando tabla TopePrecioGanancia:", error);
      throw error;
    }
  }

  // Obtener todos los topes de un punto
  static async obtenerTopesPorPunto(
    puntoId: number,
  ): Promise<{ [key: string]: number }> {
    try {
      const query = `
        SELECT nombre_producto, precio_tope
        FROM TopePrecioGanancia
        WHERE punto_id = ?
      `;

      const topes = await executeQuery(query, [puntoId]);
      const topesMap: { [key: string]: number } = {};

      if (Array.isArray(topes)) {
        topes.forEach((tope: any) => {
          topesMap[tope.nombre_producto] = tope.precio_tope;
        });
      }

      console.log(
        `✅ Topes de ganancia cargados para punto ${puntoId}:`,
        topesMap,
      );
      return topesMap;
    } catch (error) {
      console.error("❌ Error obteniendo topes de ganancia:", error);
      return {};
    }
  }

  // Guardar o actualizar un tope de precio
  static async guardarTope(
    puntoId: number,
    nombreProducto: string,
    precioTope: number,
  ): Promise<boolean> {
    try {
      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const query = `
        INSERT OR REPLACE INTO TopePrecioGanancia (punto_id, nombre_producto, precio_tope, actualizado_en)
        VALUES (?, ?, ?, ?)
      `;

      await executeNonQuery(query, [
        puntoId,
        nombreProducto,
        precioTope,
        ahora,
      ]);
      console.log(
        `✅ Tope de ganancia guardado: ${nombreProducto} = $${precioTope.toFixed(2)} para punto ${puntoId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Error guardando tope de ganancia:", error);
      return false;
    }
  }

  // Eliminar un tope específico
  static async eliminarTope(
    puntoId: number,
    nombreProducto: string,
  ): Promise<boolean> {
    try {
      const query = `
        DELETE FROM TopePrecioGanancia
        WHERE punto_id = ? AND nombre_producto = ?
      `;

      await executeNonQuery(query, [puntoId, nombreProducto]);
      console.log(
        `✅ Tope de ganancia eliminado: ${nombreProducto} para punto ${puntoId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Error eliminando tope de ganancia:", error);
      return false;
    }
  }

  // Eliminar todos los topes de un punto
  static async limpiarTopesPorPunto(puntoId: number): Promise<boolean> {
    try {
      const query = `
        DELETE FROM TopePrecioGanancia
        WHERE punto_id = ?
      `;

      await executeNonQuery(query, [puntoId]);
      console.log(
        `✅ Todos los topes de ganancia eliminados para punto ${puntoId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Error limpiando topes de ganancia:", error);
      return false;
    }
  }

  // Guardar múltiples topes a la vez
  static async guardarMultipleTopes(
    puntoId: number,
    topes: { [key: string]: number },
  ): Promise<boolean> {
    try {
      // Primero limpiar todos los topes existentes
      await this.limpiarTopesPorPunto(puntoId);

      // Luego guardar los nuevos topes
      for (const [nombreProducto, precioTope] of Object.entries(topes)) {
        await this.guardarTope(puntoId, nombreProducto, precioTope);
      }

      console.log(
        `✅ ${Object.keys(topes).length} topes de ganancia guardados para punto ${puntoId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Error guardando múltiples topes de ganancia:", error);
      return false;
    }
  }

  // Obtener un tope específico
  static async obtenerTope(
    puntoId: number,
    nombreProducto: string,
  ): Promise<number | null> {
    try {
      const query = `
        SELECT precio_tope
        FROM TopePrecioGanancia
        WHERE punto_id = ? AND nombre_producto = ?
      `;

      const resultado = await getFirst(query, [puntoId, nombreProducto]);
      return resultado ? resultado.precio_tope : null;
    } catch (error) {
      console.error("❌ Error obteniendo tope específico de ganancia:", error);
      return null;
    }
  }

  // Verificar si un producto tiene tope aplicado
  static async tieneTope(
    puntoId: number,
    nombreProducto: string,
  ): Promise<boolean> {
    const tope = await this.obtenerTope(puntoId, nombreProducto);
    return tope !== null;
  }

  // Obtener todos los productos con tope de un punto como lista
  static async obtenerListaTopesPorPunto(
    puntoId: number,
  ): Promise<TopePrecioGanancia[]> {
    try {
      const query = `
        SELECT id, punto_id, nombre_producto, precio_tope, creado_en, actualizado_en
        FROM TopePrecioGanancia
        WHERE punto_id = ?
        ORDER BY nombre_producto
      `;

      const topes = await executeQuery(query, [puntoId]);
      return Array.isArray(topes) ? topes : [];
    } catch (error) {
      console.error("❌ Error obteniendo lista de topes de ganancia:", error);
      return [];
    }
  }
}
