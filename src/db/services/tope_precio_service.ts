// src/db/services/tope_precio_service.ts - Servicio para gestión de topes de precios por punto

import { executeNonQuery, executeQuery, getFirst } from "../database";

export interface TopePrecio {
  id?: number;
  punto_id: number;
  nombre_producto: string;
  precio_tope: number;
  creado_en?: string;
  actualizado_en?: string;
}

export class TopePrecioService {
  // Crear tabla de topes de precios si no existe
  static async crearTabla(): Promise<void> {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS TopePrecio (
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
      console.log("✅ Tabla TopePrecio creada o verificada");
    } catch (error) {
      console.error("❌ Error creando tabla TopePrecio:", error);
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
        FROM TopePrecio
        WHERE punto_id = ?
      `;

      const topes = await executeQuery(query, [puntoId]);
      const topesMap: { [key: string]: number } = {};

      if (Array.isArray(topes)) {
        topes.forEach((tope: any) => {
          topesMap[tope.nombre_producto] = tope.precio_tope;
        });
      }

      console.log(`✅ Topes cargados para punto ${puntoId}:`, topesMap);
      return topesMap;
    } catch (error) {
      console.error("❌ Error obteniendo topes:", error);
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
        INSERT OR REPLACE INTO TopePrecio (punto_id, nombre_producto, precio_tope, actualizado_en)
        VALUES (?, ?, ?, ?)
      `;

      await executeNonQuery(query, [
        puntoId,
        nombreProducto,
        precioTope,
        ahora,
      ]);
      console.log(
        `✅ Tope guardado: ${nombreProducto} = $${precioTope.toFixed(2)} para punto ${puntoId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Error guardando tope:", error);
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
        DELETE FROM TopePrecio
        WHERE punto_id = ? AND nombre_producto = ?
      `;

      await executeNonQuery(query, [puntoId, nombreProducto]);
      console.log(`✅ Tope eliminado: ${nombreProducto} para punto ${puntoId}`);
      return true;
    } catch (error) {
      console.error("❌ Error eliminando tope:", error);
      return false;
    }
  }

  // Eliminar todos los topes de un punto
  static async limpiarTopesPorPunto(puntoId: number): Promise<boolean> {
    try {
      const query = `
        DELETE FROM TopePrecio
        WHERE punto_id = ?
      `;

      await executeNonQuery(query, [puntoId]);
      console.log(`✅ Todos los topes eliminados para punto ${puntoId}`);
      return true;
    } catch (error) {
      console.error("❌ Error limpiando topes:", error);
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
        `✅ ${Object.keys(topes).length} topes guardados para punto ${puntoId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Error guardando múltiples topes:", error);
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
        FROM TopePrecio
        WHERE punto_id = ? AND nombre_producto = ?
      `;

      const resultado = await getFirst(query, [puntoId, nombreProducto]);
      return resultado ? resultado.precio_tope : null;
    } catch (error) {
      console.error("❌ Error obteniendo tope específico:", error);
      return null;
    }
  }
}
