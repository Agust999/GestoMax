// src/services/history_service.ts - Versión limpia y funcional
import { executeQuery } from "../database";

// Interface para movimientos de productos
export interface MovimientoProducto {
  id: number;
  tipo:
    | "transferencia_punto"
    | "transferencia_almacen"
    | "venta_directa"
    | "creacion"
    | "eliminacion"
    | "ajuste";
  producto_id: number;
  producto_nombre: string;
  producto_categoria: string;
  cantidad: number;
  precio_coste: number;
  precio_venta?: number;
  ganancia?: number;
  punto_origen_id?: number;
  punto_destino_id?: number;
  punto_origen_nombre?: string;
  punto_destino_nombre?: string;
  almacen_origen_id?: number;
  almacen_destino_id?: number;
  almacen_origen_nombre?: string;
  almacen_destino_nombre?: string;
  zona_origen?: number;
  zona_destino?: number;
  notas?: string;
  creado_en: string;
  usuario?: string;
}

// Interface para filtros de historial
export interface FiltrosHistorial {
  fechaDesde?: string;
  fechaHasta?: string;
  tipoMovimiento?: string;
  productoId?: number;
  puntoId?: number;
  almacenId?: number;
  limit?: number;
  offset?: number;
}

// Interface para estadísticas de movimientos
export interface EstadisticasMovimientos {
  totalMovimientos: number;
  totalEntradas: number;
  totalSalidas: number;
  totalTransferencias: number;
  totalVentasDirectas: number;
  totalProductosCreados: number;
  totalProductosEliminados: number;
  valorTotalEntradas: number;
  valorTotalSalidas: number;
  valorTotalGanancias: number;
}

export class HistoryService {
  // Función para obtener las ventas realizadas (usada por venta.tsx)
  static async getVentasRealizadas(
    puntoId: number,
    limit?: number,
  ): Promise<MovimientoProducto[]> {
    try {
      console.log("🔍 Buscando ventas realizadas para puntoId:", puntoId);

      // Construcción explícita de la consulta para evitar problemas de cache
      const query = `
        SELECT 
          dv.id,
          'venta' as tipo,
          dv.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          dv.cantidad,
          COALESCE(dv.precio_coste_real, p.precio_coste) as precio_coste,
          dv.precio_unitario as precio_venta,
          (dv.precio_unitario - COALESCE(dv.precio_coste_real, p.precio_coste)) * dv.cantidad as ganancia,
          NULL as punto_origen_id,
          v.punto_id as punto_destino_id,
          NULL as punto_origen_nombre,
          pt.nombre as punto_destino_nombre,
          NULL as almacen_origen_id,
          NULL as almacen_destino_id,
          NULL as almacen_origen_nombre,
          NULL as almacen_destino_nombre,
          NULL as zona_origen,
          NULL as zona_destino,
          'Venta Normal' as notas,
          v.creado_en,
          NULL as usuario
        FROM DetalleVenta dv
        LEFT JOIN Venta v ON dv.venta_id = v.id
        LEFT JOIN Producto p ON dv.producto_id = p.id
        LEFT JOIN Punto pt ON v.punto_id = pt.id
        WHERE v.punto_id = ?
        ORDER BY v.creado_en DESC
        ${limit ? "LIMIT ?" : ""}
      `;

      const params = limit ? [puntoId, limit] : [puntoId];

      console.log("📋 Ejecutando consulta de ventas...");
      const resultados = await executeQuery(query, params);
      console.log("✅ Ventas obtenidas:", resultados.length);

      // Procesar resultados
      const resultadoFinal = resultados.map((row: any) => ({
        ...row,
        cantidad: parseInt(row.cantidad) || 0,
        precio_coste: parseFloat(row.precio_coste) || 0,
        precio_venta: row.precio_venta
          ? parseFloat(row.precio_venta)
          : undefined,
        ganancia: row.ganancia ? parseFloat(row.ganancia) : undefined,
      })) as MovimientoProducto[];

      console.log("🎯 Ventas procesadas:", resultadoFinal.length);
      if (resultadoFinal.length > 0) {
        console.log("📋 Primera venta:", resultadoFinal[0]);
      }

      return resultadoFinal;
    } catch (error) {
      console.error("❌ Error en HistoryService.getVentasRealizadas:", error);
      return [];
    }
  }

  // Función principal para obtener productos de entrada directa
  static async getProductosEntradaDirecta(
    puntoId: number,
    limit?: number,
  ): Promise<MovimientoProducto[]> {
    try {
      console.log("🔍 Buscando entradas directas para puntoId:", puntoId);

      // Buscar en LogTransferencia (tabla principal y única que existe)
      const query = `
        SELECT 
          lt.id,
          'transferencia' as tipo,
          lt.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          lt.cantidad,
          lt.precio_coste_real as precio_coste,
          lt.precio_venta,
          (lt.precio_venta - lt.precio_coste_real) * lt.cantidad as ganancia,
          NULL as punto_origen_id,
          lt.punto_id as punto_destino_id,
          NULL as punto_origen_nombre,
          pt.nombre as punto_destino_nombre,
          0 as almacen_origen_id,
          NULL as almacen_destino_id,
          'Entrada Directa' as almacen_origen_nombre,
          NULL as almacen_destino_nombre,
          NULL as zona_origen,
          1 as zona_destino,
          'Entrada Directa' as notas,
          lt.creado_en,
          NULL as usuario
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        LEFT JOIN Punto pt ON lt.punto_id = pt.id
        WHERE lt.punto_id = ?
        ORDER BY lt.creado_en DESC
        ${limit ? "LIMIT ?" : ""}
      `;

      const params = limit ? [puntoId, limit] : [puntoId];

      console.log("📋 Ejecutando consulta (LogTransferencia)...");
      const resultados = await executeQuery(query, params);
      console.log("✅ Resultados obtenidos:", resultados.length);

      // Procesar resultados
      const resultadoFinal = resultados.map((row: any) => ({
        ...row,
        cantidad: parseInt(row.cantidad) || 0,
        precio_coste: parseFloat(row.precio_coste) || 0,
        precio_venta: row.precio_venta
          ? parseFloat(row.precio_venta)
          : undefined,
        ganancia: row.ganancia ? parseFloat(row.ganancia) : undefined,
      })) as MovimientoProducto[];

      console.log("🎯 Resultado final procesado:", resultadoFinal.length);
      if (resultadoFinal.length > 0) {
        console.log("📋 Primer resultado:", resultadoFinal[0]);
      }

      return resultadoFinal;
    } catch (error) {
      console.error(
        "❌ Error en HistoryService.getProductosEntradaDirecta:",
        error,
      );
      return [];
    }
  }

  // Función para obtener movimientos generales (usada por almacen.tsx) - VERSIÓN CORREGIDA
  static async getMovimientosHistorialAlmacen(
    filtros?: FiltrosHistorial,
  ): Promise<MovimientoProducto[]> {
    try {
      console.log(
        "🔥🔥🔥 VERSIÓN CORREGIDA - Obteniendo movimientos de historial con filtros:",
        filtros,
      );

      const almacenId = filtros?.almacenId ?? 0;
      const puntoId = filtros?.puntoId;

      // Usamos la tabla LogTransferencia con todas las columnas nuevas
      let query = `
        SELECT 
          lt.id,
          COALESCE(lt.tipo_movimiento, 'transferencia_punto') as tipo,
          CASE 
            WHEN lt.tipo_movimiento = 'transferencia_almacen' THEN 'transferencia_almacen'
            WHEN lt.punto_id = 0 THEN 'transferencia_almacen'
            ELSE 'transferencia_punto'
          END as tipo_original,
          lt.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          lt.cantidad,
          lt.precio_coste_real as precio_coste,
          lt.precio_venta,
          (lt.precio_venta - lt.precio_coste_real) * lt.cantidad as ganancia,
          lt.almacen_origen_id as punto_origen_id,
          lt.punto_id as punto_destino_id,
          CASE 
            WHEN lt.tipo_movimiento = 'transferencia_almacen' THEN 
              CASE 
                WHEN lt.almacen_origen_id IS NULL THEN 'Almacén General'
                ELSE 'Almacén ' || lt.almacen_origen_id
              END
            ELSE NULL
          END as punto_origen_nombre,
          CASE 
            WHEN lt.tipo_movimiento = 'transferencia_almacen' THEN NULL
            ELSE pt.nombre
          END as punto_destino_nombre,
          lt.almacen_origen_id,
          lt.almacen_destino_id,
          CASE 
            WHEN lt.almacen_origen_id IS NULL THEN 'Almacén General'
            ELSE 'Almacén ' || lt.almacen_origen_id
          END as almacen_origen_nombre,
          CASE 
            WHEN lt.almacen_destino_id IS NULL THEN NULL
            ELSE 'Almacén ' || lt.almacen_destino_id
          END as almacen_destino_nombre,
          NULL as zona_origen,
          CASE 
            WHEN lt.tipo_movimiento = 'transferencia_almacen' THEN NULL
            ELSE 1
          END as zona_destino,
          lt.notas,
          lt.creado_en,
          NULL as usuario
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        LEFT JOIN Punto pt ON lt.punto_id = pt.id AND lt.punto_id > 0
        WHERE 1=1
      `;

      const params: any[] = [];

      // Aplicar filtros
      if (puntoId) {
        query += ` AND (lt.punto_id = ? OR lt.almacen_destino_id = ?)`;
        params.push(puntoId, puntoId);
      }

      if (almacenId > 0) {
        query += ` AND (lt.almacen_origen_id = ? OR lt.almacen_destino_id = ?)`;
        params.push(almacenId, almacenId);
      }

      if (filtros?.productoId) {
        query += ` AND lt.producto_id = ?`;
        params.push(filtros.productoId);
      }

      if (filtros?.fechaDesde) {
        query += ` AND lt.creado_en >= ?`;
        params.push(filtros.fechaDesde);
      }

      if (filtros?.fechaHasta) {
        query += ` AND lt.creado_en <= ?`;
        params.push(filtros.fechaHasta);
      }

      if (filtros?.tipoMovimiento) {
        if (filtros.tipoMovimiento === "transferencia_almacen") {
          query += ` AND (lt.tipo_movimiento = 'transferencia_almacen' OR lt.punto_id = 0)`;
        } else if (filtros.tipoMovimiento === "transferencia_punto") {
          query += ` AND (lt.tipo_movimiento = 'transferencia_punto' OR lt.punto_id > 0)`;
        } else {
          query += ` AND COALESCE(lt.tipo_movimiento, 'transferencia_punto') = ?`;
          params.push(filtros.tipoMovimiento);
        }
      }

      query += " ORDER BY lt.creado_en DESC";

      if (filtros?.limit) {
        query += " LIMIT ?";
        params.push(filtros.limit);
      }

      console.log("🔥🔥🔥 QUERY FINAL CORREGIDA:", query);
      console.log("📋 Params:", params);

      const resultados = await executeQuery(query, params);
      console.log("✅ Resultados obtenidos:", resultados.length);

      const processedResults = resultados.map((row: any) => ({
        ...row,
        tipo: row.tipo_original || row.tipo,
        cantidad: parseInt(row.cantidad) || 0,
        precio_coste: parseFloat(row.precio_coste) || 0,
        precio_venta: row.precio_venta
          ? parseFloat(row.precio_venta)
          : undefined,
        ganancia: row.ganancia ? parseFloat(row.ganancia) : undefined,
      }));

      console.log("🎯 Resultados procesados:", processedResults.length);
      if (processedResults.length > 0) {
        console.log("📋 Primer resultado:", processedResults[0]);
      }

      return processedResults as MovimientoProducto[];
    } catch (error) {
      console.error(
        "❌ Error en HistoryService.getMovimientosHistorialAlmacen:",
        error,
      );
      return [];
    }
  }

  // Función original mantenida para compatibilidad
  static async getMovimientosHistorial(
    filtros?: FiltrosHistorial,
  ): Promise<MovimientoProducto[]> {
    return this.getMovimientosHistorialAlmacen(filtros);
  }

  // Función para obtener estadísticas
  static async getEstadisticasMovimientos(
    filtros?: FiltrosHistorial,
  ): Promise<EstadisticasMovimientos> {
    try {
      const movimientos = await this.getMovimientosHistorial(filtros);

      const estadisticas: EstadisticasMovimientos = {
        totalMovimientos: movimientos.length,
        totalEntradas: 0,
        totalSalidas: 0,
        totalTransferencias: 0,
        totalVentasDirectas: 0,
        totalProductosCreados: 0,
        totalProductosEliminados: 0,
        valorTotalEntradas: 0,
        valorTotalSalidas: 0,
        valorTotalGanancias: 0,
      };

      movimientos.forEach((mov) => {
        switch (mov.tipo) {
          case "transferencia_punto":
          case "transferencia_almacen":
            estadisticas.totalTransferencias++;
            estadisticas.totalSalidas += mov.cantidad;
            estadisticas.valorTotalSalidas += mov.cantidad * mov.precio_coste;
            if (mov.ganancia) {
              estadisticas.valorTotalGanancias += mov.ganancia;
            }
            break;
          case "venta_directa":
            estadisticas.totalVentasDirectas++;
            estadisticas.totalSalidas += mov.cantidad;
            estadisticas.valorTotalSalidas += mov.cantidad * mov.precio_coste;
            if (mov.ganancia) {
              estadisticas.valorTotalGanancias += mov.ganancia;
            }
            break;
        }
      });

      return estadisticas;
    } catch (error) {
      console.error(
        "Error en HistoryService.getEstadisticasMovimientos:",
        error,
      );
      return {
        totalMovimientos: 0,
        totalEntradas: 0,
        totalSalidas: 0,
        totalTransferencias: 0,
        totalVentasDirectas: 0,
        totalProductosCreados: 0,
        totalProductosEliminados: 0,
        valorTotalEntradas: 0,
        valorTotalSalidas: 0,
        valorTotalGanancias: 0,
      };
    }
  }

  // Funciones auxiliares
  static async getMovimientosPorProducto(
    productoId: number,
    limit?: number,
  ): Promise<MovimientoProducto[]> {
    return this.getMovimientosHistorial({
      productoId,
      limit: limit || 50,
    });
  }

  static async getMovimientosPorPunto(
    puntoId: number,
    limit?: number,
  ): Promise<MovimientoProducto[]> {
    return this.getMovimientosHistorial({
      puntoId,
      limit: limit || 50,
    });
  }

  static async getMovimientosPorFecha(
    fechaDesde: string,
    fechaHasta?: string,
  ): Promise<MovimientoProducto[]> {
    return this.getMovimientosHistorial({
      fechaDesde,
      fechaHasta: fechaHasta || fechaDesde,
    });
  }
}
