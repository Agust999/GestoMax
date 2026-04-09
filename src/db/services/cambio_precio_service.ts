// src/db/services/cambio_precio_service.ts
import { getFechaLocal } from "../../utils/dateUtils";
import { executeNonQuery, executeQuery, getFirst } from "../database";

export interface CambioPrecio {
  id: number;
  producto_id: number;
  punto_id: number;
  precio_anterior: number;
  precio_nuevo: number;
  diferencia: number;
  motivo: string;
  creado_en: string;
}

export interface CambioPrecioConInfo extends CambioPrecio {
  nombre_producto: string;
  categoria_producto: string;
}

export const CambioPrecioService = {
  // Registrar un cambio de precio
  async registrarCambio(
    productoId: number,
    puntoId: number,
    precioAnterior: number,
    precioNuevo: number,
    motivo: string = "Edición manual",
  ): Promise<{ success: boolean; message: string }> {
    try {
      const diferencia = precioNuevo - precioAnterior;

      await executeNonQuery(
        `
        INSERT INTO CambioPrecio (
          producto_id, punto_id, precio_anterior, precio_nuevo, diferencia, motivo
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
        [productoId, puntoId, precioAnterior, precioNuevo, diferencia, motivo],
      );

      return {
        success: true,
        message: "Cambio de precio registrado correctamente",
      };
    } catch (error) {
      console.error("Error registrando cambio de precio:", error);
      return {
        success: false,
        message: "Error al registrar cambio de precio",
      };
    }
  },

  // Obtener cambios de precios del día para un punto
  async getCambiosDelDia(puntoId: number): Promise<CambioPrecioConInfo[]> {
    try {
      const hoy = getFechaLocal();

      const query = `
        SELECT 
          cp.*,
          p.nombre as nombre_producto,
          p.categoria as categoria_producto
        FROM CambioPrecio cp
        JOIN Producto p ON cp.producto_id = p.id
        WHERE cp.punto_id = ? AND DATE(cp.creado_en) = ?
        ORDER BY cp.creado_en DESC
      `;

      return await executeQuery<CambioPrecioConInfo>(query, [puntoId, hoy]);
    } catch (error) {
      console.error("Error obteniendo cambios del día:", error);
      return [];
    }
  },

  // Obtener cambios de precios en un rango de fechas
  async getCambiosPorRangoFechas(
    puntoId: number,
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<CambioPrecioConInfo[]> {
    try {
      const query = `
        SELECT 
          cp.*,
          p.nombre as nombre_producto,
          p.categoria as categoria_producto
        FROM CambioPrecio cp
        JOIN Producto p ON cp.producto_id = p.id
        WHERE cp.punto_id = ? AND DATE(cp.creado_en) BETWEEN ? AND ?
        ORDER BY cp.creado_en DESC
      `;

      return await executeQuery<CambioPrecioConInfo>(query, [
        puntoId,
        fechaDesde,
        fechaHasta,
      ]);
    } catch (error) {
      console.error("Error obteniendo cambios por rango de fechas:", error);
      return [];
    }
  },

  // Obtener historial de cambios de un producto específico
  async getHistorialProducto(
    productoId: number,
    puntoId: number,
    limite: number = 10,
  ): Promise<CambioPrecioConInfo[]> {
    try {
      const query = `
        SELECT 
          cp.*,
          p.nombre as nombre_producto,
          p.categoria as categoria_producto
        FROM CambioPrecio cp
        JOIN Producto p ON cp.producto_id = p.id
        WHERE cp.producto_id = ? AND cp.punto_id = ?
        ORDER BY cp.creado_en DESC
        LIMIT ?
      `;

      return await executeQuery<CambioPrecioConInfo>(query, [
        productoId,
        puntoId,
        limite,
      ]);
    } catch (error) {
      console.error("Error obteniendo historial del producto:", error);
      return [];
    }
  },

  // Verificar si un producto tuvo cambios de precios en el día
  async tieneCambiosHoy(puntoId: number): Promise<boolean> {
    try {
      const hoy = getFechaLocal();
      const resultado = await getFirst<any>(
        "SELECT COUNT(*) as count FROM CambioPrecio WHERE punto_id = ? AND DATE(creado_en) = ?",
        [puntoId, hoy],
      );
      return (resultado?.count || 0) > 0;
    } catch (error) {
      console.error("Error verificando cambios de hoy:", error);
      return false;
    }
  },

  // Obtener resumen de cambios del día
  async getResumenCambiosDia(puntoId: number): Promise<{
    total_cambios: number;
    productos_modificados: number;
    aumento_total: number;
    disminucion_total: number;
    neto: number;
  }> {
    try {
      const hoy = getFechaLocal();

      const resultado = await getFirst<any>(
        `
        SELECT 
          COUNT(*) as total_cambios,
          COUNT(DISTINCT producto_id) as productos_modificados,
          SUM(CASE WHEN diferencia > 0 THEN diferencia ELSE 0 END) as aumento_total,
          SUM(CASE WHEN diferencia < 0 THEN ABS(diferencia) ELSE 0 END) as disminucion_total,
          SUM(diferencia) as neto
        FROM CambioPrecio 
        WHERE punto_id = ? AND DATE(creado_en) = ?
      `,
        [puntoId, hoy],
      );

      return {
        total_cambios: resultado?.total_cambios || 0,
        productos_modificados: resultado?.productos_modificados || 0,
        aumento_total: resultado?.aumento_total || 0,
        disminucion_total: resultado?.disminucion_total || 0,
        neto: resultado?.neto || 0,
      };
    } catch (error) {
      console.error("Error obteniendo resumen de cambios:", error);
      return {
        total_cambios: 0,
        productos_modificados: 0,
        aumento_total: 0,
        disminucion_total: 0,
        neto: 0,
      };
    }
  },

  // Eliminar cambios antiguos (mantener solo N días)
  async limpiarCambiosAntiguos(
    dias: number = 30,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - dias);
      const fechaLimiteStr = fechaLimite.toISOString().split("T")[0];

      const resultado = await executeNonQuery(
        "DELETE FROM CambioPrecio WHERE DATE(creado_en) < ?",
        [fechaLimiteStr],
      );

      return {
        success: true,
        message: `Se eliminaron ${resultado.changes} cambios antiguos`,
      };
    } catch (error) {
      console.error("Error limpiando cambios antiguos:", error);
      return {
        success: false,
        message: "Error al limpiar cambios antiguos",
      };
    }
  },
};
