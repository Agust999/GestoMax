// src/db/services/historial_inventario_service.ts
import { executeQuery, getSingleValue } from "../database";

export interface HistorialInventarioItem {
  id: number;
  producto_id: number;
  producto_nombre?: string;
  almacen_id: number | null;
  almacen_nombre?: string;
  punto_id: number | null;
  punto_nombre?: string;
  zona_id: number | null;
  tipo_movimiento: string;
  cantidad_variacion: number;
  stock_anterior: number;
  stock_nuevo: number;
  stock_total?: number; // Stock total agregado por nombre de producto
  entidad_origen_destino: string | null;
  notas: string | null;
  creado_en: string;
  // Propiedades adicionales para compatibilidad con el frontend
  tipo?: string; // Alias para tipo_movimiento
  cantidad?: number; // Alias para cantidad_variacion (valor absoluto)
  cantidad_antes?: number; // Alias para stock_anterior
  cantidad_despues?: number; // Alias para stock_nuevo
  punto_destino_nombre?: string; // Alias para punto_nombre cuando es destino
  almacen_destino_nombre?: string; // Alias para almacen_nombre cuando es destino
  producto_categoria?: string; // Categoría del producto
}

export interface FiltrosHistorialInventario {
  producto_id?: number;
  almacen_id?: number;
  almacen_id_relacionado?: number; // Nuevo filtro para transferencias relacionadas
  punto_id?: number;
  zona_id?: number;
  tipo_movimiento?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  limite?: number;
}

export class HistorialInventarioService {
  // Obtener movimientos del historial de inventario con información de productos y ubicaciones
  static async getMovimientosHistorial(
    filtros: FiltrosHistorialInventario = {},
  ): Promise<HistorialInventarioItem[]> {
    try {
      let query = `
        SELECT 
          hi.*,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          a.nombre as almacen_nombre,
          pu.nombre as punto_nombre,
          hi.tipo_movimiento as tipo,
          ABS(hi.cantidad_variacion) as cantidad,
          hi.stock_anterior as cantidad_antes,
          hi.stock_nuevo as cantidad_despues,
          CASE 
            WHEN hi.punto_id IS NOT NULL THEN pu.nombre
            WHEN hi.almacen_id IS NOT NULL THEN a.nombre
            ELSE NULL
          END as punto_destino_nombre,
          CASE 
            WHEN hi.almacen_id IS NOT NULL THEN a.nombre
            ELSE NULL
          END as almacen_destino_nombre,
          -- Stock total del producto por nombre (agregado)
          (
            SELECT COALESCE(SUM(cantidad), 0)
            FROM (
              SELECT COALESCE(cantidad, 0) as cantidad FROM Almacen WHERE producto_id = hi.producto_id
              UNION ALL
              SELECT COALESCE(cantidad, 0) as cantidad FROM AlmacenProducto WHERE producto_id = hi.producto_id
              UNION ALL
              SELECT COALESCE(cantidad, 0) as cantidad FROM AlmacenZona WHERE producto_id = hi.producto_id
            ) as stock_subquery
          ) as stock_total
        FROM HistorialInventario hi
        LEFT JOIN Producto p ON hi.producto_id = p.id
        LEFT JOIN Almacenes a ON hi.almacen_id = a.id
        LEFT JOIN Punto pu ON hi.punto_id = pu.id
        WHERE 1=1
      `;

      const params: any[] = [];

      // Aplicar filtros
      if (filtros.producto_id) {
        query += " AND hi.producto_id = ?";
        params.push(filtros.producto_id);
      }

      if (filtros.almacen_id) {
        query += " AND hi.almacen_id = ?";
        params.push(filtros.almacen_id);
      }

      if (filtros.almacen_id_relacionado) {
        // Para transferencias relacionadas con un almacén específico
        // Incluir SOLO movimientos que realmente afectan a este almacén:
        // 1. Movimientos directos en este almacén (almacen_id = ID)
        // 2. Transferencias SALIENTE desde este almacén (entidad_origen_destino contiene "Almacén ID")
        // 3. Transferencias ENTRADAS a este almacén (entidad_origen_destino contiene "desde Almacén ID")
        // EXCLUIR: movimientos que solo son de otros almacenes/puntos
        console.log(
          `🔍 Filtrando por almacén ID: ${filtros.almacen_id_relacionado} - SOLO movimientos que afectan a este almacén`,
        );
        query += ` AND (
          hi.almacen_id = ? 
          OR hi.entidad_origen_destino LIKE ?
          OR hi.notas LIKE ?
          OR (hi.almacen_id IS NULL AND hi.punto_id IS NOT NULL AND hi.entidad_origen_destino LIKE ?)
        )`;
        params.push(
          filtros.almacen_id_relacionado,
          `Almacén ${filtros.almacen_id_relacionado}%`, // Salidas desde este almacén
          `%Almacén ${filtros.almacen_id_relacionado}%`, // Salidas desde este almacén
          `desde Almacén ${filtros.almacen_id_relacionado}%`, // Entradas a este almacén
          // `Almacén General%`  // Entradas desde almacén general
        );
      }

      if (filtros.punto_id) {
        query += " AND hi.punto_id = ?";
        params.push(filtros.punto_id);
      }

      if (filtros.zona_id) {
        query += " AND hi.zona_id = ?";
        params.push(filtros.zona_id);
      }

      if (filtros.tipo_movimiento) {
        query += " AND hi.tipo_movimiento = ?";
        params.push(filtros.tipo_movimiento);
      }

      if (filtros.fecha_inicio && filtros.fecha_fin) {
        query += " AND DATE(hi.creado_en) BETWEEN DATE(?) AND DATE(?)";
        params.push(filtros.fecha_inicio, filtros.fecha_fin);
      } else if (filtros.fecha_inicio) {
        query += " AND DATE(hi.creado_en) >= DATE(?)";
        params.push(filtros.fecha_inicio);
      } else if (filtros.fecha_fin) {
        query += " AND DATE(hi.creado_en) <= DATE(?)";
        params.push(filtros.fecha_fin);
      }

      // Ordenar por fecha descendente (más reciente primero)
      query += " ORDER BY hi.creado_en DESC";

      // Aplicar límite si se especifica
      if (filtros.limite) {
        query += " LIMIT ?";
        params.push(filtros.limite);
      }

      const resultados = await executeQuery<HistorialInventarioItem>(
        query,
        params,
      );
      console.log(
        `📊 Obtenidos ${resultados.length} movimientos del historial de inventario`,
      );

      return resultados;
    } catch (error) {
      console.error("Error en getMovimientosHistorial:", error);
      return [];
    }
  }

  // Obtener movimiento por ID
  static async getMovimientoPorId(
    id: number,
  ): Promise<HistorialInventarioItem | null> {
    try {
      const query = `
        SELECT 
          hi.*,
          p.nombre as producto_nombre,
          a.nombre as almacen_nombre,
          pu.nombre as punto_nombre
        FROM HistorialInventario hi
        LEFT JOIN Producto p ON hi.producto_id = p.id
        LEFT JOIN Almacenes a ON hi.almacen_id = a.id
        LEFT JOIN Punto pu ON hi.punto_id = pu.id
        WHERE hi.id = ?
      `;

      const resultados = await executeQuery<HistorialInventarioItem>(query, [
        id,
      ]);
      return resultados.length > 0 ? resultados[0] : null;
    } catch (error) {
      console.error("Error en getMovimientoPorId:", error);
      return null;
    }
  }

  // Obtener resumen de movimientos por producto
  static async getResumenPorProducto(
    productoId: number,
    filtros: Omit<FiltrosHistorialInventario, "producto_id"> = {},
  ): Promise<{
    total_entradas: number;
    total_salidas: number;
    saldo_actual: number;
    primer_movimiento: string | null;
    ultimo_movimiento: string | null;
  }> {
    try {
      let query = `
        SELECT 
          SUM(CASE WHEN cantidad_variacion > 0 THEN cantidad_variacion ELSE 0 END) as total_entradas,
          SUM(CASE WHEN cantidad_variacion < 0 THEN ABS(cantidad_variacion) ELSE 0 END) as total_salidas,
          MAX(stock_nuevo) as saldo_actual,
          MIN(creado_en) as primer_movimiento,
          MAX(creado_en) as ultimo_movimiento
        FROM HistorialInventario 
        WHERE producto_id = ?
      `;

      const params: any[] = [productoId];

      // Aplicar filtros adicionales
      if (filtros.almacen_id) {
        query += " AND almacen_id = ?";
        params.push(filtros.almacen_id);
      }

      if (filtros.punto_id) {
        query += " AND punto_id = ?";
        params.push(filtros.punto_id);
      }

      if (filtros.zona_id) {
        query += " AND zona_id = ?";
        params.push(filtros.zona_id);
      }

      if (filtros.fecha_inicio && filtros.fecha_fin) {
        query += " AND DATE(creado_en) BETWEEN DATE(?) AND DATE(?)";
        params.push(filtros.fecha_inicio, filtros.fecha_fin);
      }

      const resultado = await executeQuery<any>(query, params);

      if (resultado.length > 0) {
        return {
          total_entradas: resultado[0].total_entradas || 0,
          total_salidas: resultado[0].total_salidas || 0,
          saldo_actual: resultado[0].saldo_actual || 0,
          primer_movimiento: resultado[0].primer_movimiento,
          ultimo_movimiento: resultado[0].ultimo_movimiento,
        };
      }

      return {
        total_entradas: 0,
        total_salidas: 0,
        saldo_actual: 0,
        primer_movimiento: null,
        ultimo_movimiento: null,
      };
    } catch (error) {
      console.error("Error en getResumenPorProducto:", error);
      return {
        total_entradas: 0,
        total_salidas: 0,
        saldo_actual: 0,
        primer_movimiento: null,
        ultimo_movimiento: null,
      };
    }
  }

  // Obtener stock actual de un producto en una ubicación específica
  static async getStockActual(
    productoId: number,
    almacenId?: number,
    puntoId?: number,
    zonaId?: number,
  ): Promise<number> {
    try {
      let query = `
        SELECT MAX(stock_nuevo) as stock_actual
        FROM HistorialInventario 
        WHERE producto_id = ?
      `;

      const params: any[] = [productoId];

      if (almacenId) {
        query += " AND almacen_id = ?";
        params.push(almacenId);
      }

      if (puntoId) {
        query += " AND punto_id = ?";
        params.push(puntoId);
      }

      if (zonaId) {
        query += " AND zona_id = ?";
        params.push(zonaId);
      }

      query += " ORDER BY creado_en DESC LIMIT 1";

      const resultado = await getSingleValue<number>(query, params);
      return resultado || 0;
    } catch (error) {
      console.error("Error en getStockActual:", error);
      return 0;
    }
  }
}
