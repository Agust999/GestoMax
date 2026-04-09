// src/services/venta_history_service.ts - Servicio especializado para historial de ventas
import { executeQuery } from "../database";

// Interface para movimientos de ventas
export interface MovimientoVenta {
  id: number;
  tipo: "venta" | "consumo_propio";
  producto_id: number;
  producto_nombre: string;
  producto_categoria: string;
  cantidad: number;
  precio_coste: number;
  precio_venta: number;
  precio_venta_original?: number;
  ganancia?: number;
  punto_destino_id: number;
  punto_destino_nombre: string;
  notas?: string;
  creado_en: string;
  usuario?: string;
  // Campos para consumo propio
  es_consumo_propio?: boolean;
  trabajador_id?: number;
  metodo_consumo?: "coste" | "porcentual" | "fijo" | null;
  valor_descuento?: string;
  trabajador_nombre?: string;
}

// Interface para filtros de historial de ventas
export interface FiltrosHistorialVentas {
  fechaDesde?: string;
  fechaHasta?: string;
  productoId?: number;
  puntoId?: number;
  tipoVenta?: "venta" | "consumo_propio" | "todos";
  limit?: number;
  offset?: number;
}

// Interface para estadísticas de ventas
export interface EstadisticasVentas {
  totalVentas: number;
  totalConsumoPropio: number;
  totalIngresos: number;
  totalCostos: number;
  totalGanancias: number;
  totalProductosVendidos: number;
  promedioVenta: number;
  ventaMasAlta: number;
  ventaMasBaja: number;
}

export class VentaHistoryService {
  // Función principal para obtener las ventas realizadas en un punto (transacciones individuales)
  static async getVentasRealizadas(
    puntoId: number,
    limit?: number,
  ): Promise<MovimientoVenta[]> {
    try {
      console.log("🔍 Buscando ventas realizadas para puntoId:", puntoId);

      // Consulta para obtener cada venta individual (sin agrupar)
      const query = `
        SELECT 
          dv.id,
          CASE WHEN v.es_consumo_propio = 1 THEN 'consumo_propio' ELSE 'venta' END as tipo,
          dv.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          dv.cantidad,
          COALESCE(dv.precio_coste_real, p.precio_coste) as precio_coste,
          dv.precio_unitario as precio_venta,
          az.precio_venta as precio_venta_original,
          (dv.precio_unitario - COALESCE(dv.precio_coste_real, p.precio_coste)) * dv.cantidad as ganancia_total,
          v.punto_id as punto_destino_id,
          pt.nombre as punto_destino_nombre,
          CASE 
            WHEN v.es_consumo_propio = 1 THEN 
              CASE v.metodo_consumo
                WHEN 'coste' THEN 'Consumo Propio - Precio de costo'
                WHEN 'porcentual' THEN 'Consumo Propio - ' || v.valor_descuento || '% de descuento'
                WHEN 'fijo' THEN 'Consumo Propio - $' || v.valor_descuento || ' de descuento fijo'
                ELSE 'Consumo Propio'
              END
            ELSE 'Venta Normal'
          END as notas,
          v.creado_en,
          NULL as usuario,
          v.es_consumo_propio,
          v.trabajador_id,
          v.metodo_consumo,
          v.valor_descuento,
          g.nombre as trabajador_nombre
        FROM DetalleVenta dv
        LEFT JOIN Venta v ON dv.venta_id = v.id
        LEFT JOIN Producto p ON dv.producto_id = p.id
        LEFT JOIN Punto pt ON v.punto_id = pt.id
        LEFT JOIN AlmacenZona az ON dv.producto_id = az.producto_id AND v.punto_id = az.punto_id AND az.zona_id = 1
        LEFT JOIN Gastos g ON v.trabajador_id = g.id AND g.categoria = 'Salario'
        WHERE v.punto_id = ?
        ORDER BY v.creado_en DESC
        ${limit ? "LIMIT ?" : ""}
      `;

      const params = limit ? [puntoId, limit] : [puntoId];

      console.log("📋 Ejecutando consulta de ventas individuales...");
      console.log("🔍 QUERY VENTAS:", query);
      console.log("📋 Params:", params);
      const resultados = await executeQuery(query, params);
      console.log("✅ Ventas obtenidas:", resultados.length);
      console.log("📋 Datos crudos de ventas:", resultados);

      // Procesar resultados
      const resultadoFinal = resultados.map((row: any) => {
        const cantidad = parseInt(row.cantidad) || 0;
        const precio_coste = parseFloat(row.precio_coste) || 0;
        const precio_venta = row.precio_venta
          ? parseFloat(row.precio_venta)
          : 0;

        // Calcular ganancia manualmente para asegurar precisión
        const ganancia_unitaria = precio_venta - precio_coste;
        const ganancia_total = ganancia_unitaria * cantidad;

        return {
          ...row,
          cantidad,
          precio_coste,
          precio_venta,
          precio_venta_original: row.precio_venta_original
            ? parseFloat(row.precio_venta_original)
            : undefined,
          ganancia: ganancia_total,
          es_consumo_propio: row.es_consumo_propio === 1,
          trabajador_id: row.trabajador_id
            ? parseInt(row.trabajador_id)
            : undefined,
          metodo_consumo: row.metodo_consumo,
          valor_descuento: row.valor_descuento,
          trabajador_nombre: row.trabajador_nombre,
        };
      }) as MovimientoVenta[];

      console.log("🎯 Ventas procesadas:", resultadoFinal.length);
      if (resultadoFinal.length > 0) {
        console.log("📋 Primera venta:", resultadoFinal[0]);
        console.log(
          "💰 Cálculo de ganancia - Precio Venta:",
          resultadoFinal[0].precio_venta,
          "Precio Coste:",
          resultadoFinal[0].precio_coste,
          "Cantidad:",
          resultadoFinal[0].cantidad,
        );
        console.log(
          "💰 Ganancia unitaria:",
          resultadoFinal[0].precio_venta,
          "-",
          resultadoFinal[0].precio_coste,
          "=",
          resultadoFinal[0].precio_venta - resultadoFinal[0].precio_coste,
        );
        console.log(
          "💰 Ganancia total:",
          resultadoFinal[0].precio_venta - resultadoFinal[0].precio_coste,
          "*",
          resultadoFinal[0].cantidad,
          "=",
          resultadoFinal[0].ganancia,
        );
      }

      return resultadoFinal;
    } catch (error) {
      console.error(
        "❌ Error en VentaHistoryService.getVentasRealizadas:",
        error,
      );
      return [];
    }
  }

  // Función para obtener ventas con filtros avanzados
  static async getVentasConFiltros(
    filtros: FiltrosHistorialVentas,
  ): Promise<MovimientoVenta[]> {
    try {
      console.log("🔍 Buscando ventas con filtros:", filtros);

      let query = `
        SELECT 
          dv.id,
          CASE WHEN v.es_consumo_propio = 1 THEN 'consumo_propio' ELSE 'venta' END as tipo,
          dv.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          dv.cantidad,
          COALESCE(dv.precio_coste_real, p.precio_coste) as precio_coste,
          dv.precio_unitario as precio_venta,
          az.precio_venta as precio_venta_original,
          (dv.precio_unitario - COALESCE(dv.precio_coste_real, p.precio_coste)) * dv.cantidad as ganancia,
          v.punto_id as punto_destino_id,
          pt.nombre as punto_destino_nombre,
          CASE 
            WHEN v.es_consumo_propio = 1 THEN 
              CASE v.metodo_consumo
                WHEN 'coste' THEN 'Consumo Propio - Precio de costo'
                WHEN 'porcentual' THEN 'Consumo Propio - ' || v.valor_descuento || '% de descuento'
                WHEN 'fijo' THEN 'Consumo Propio - $' || v.valor_descuento || ' de descuento fijo'
                ELSE 'Consumo Propio'
              END
            ELSE 'Venta Normal'
          END as notas,
          v.creado_en,
          NULL as usuario,
          v.es_consumo_propio,
          v.trabajador_id,
          v.metodo_consumo,
          v.valor_descuento,
          g.nombre as trabajador_nombre
        FROM DetalleVenta dv
        LEFT JOIN Venta v ON dv.venta_id = v.id
        LEFT JOIN Producto p ON dv.producto_id = p.id
        LEFT JOIN Punto pt ON v.punto_id = pt.id
        LEFT JOIN AlmacenZona az ON dv.producto_id = az.producto_id AND v.punto_id = az.punto_id AND az.zona_id = 1
        LEFT JOIN Gastos g ON v.trabajador_id = g.id AND g.categoria = 'Salario'
        WHERE 1=1
      `;

      const params: any[] = [];

      // Aplicar filtros
      if (filtros.puntoId) {
        query += ` AND v.punto_id = ?`;
        params.push(filtros.puntoId);
      }

      if (filtros.productoId) {
        query += ` AND dv.producto_id = ?`;
        params.push(filtros.productoId);
      }

      if (filtros.fechaDesde) {
        query += ` AND v.creado_en >= ?`;
        params.push(filtros.fechaDesde);
      }

      if (filtros.fechaHasta) {
        query += ` AND v.creado_en <= ?`;
        params.push(filtros.fechaHasta);
      }

      if (filtros.tipoVenta === "venta") {
        query += ` AND v.es_consumo_propio = 0`;
      } else if (filtros.tipoVenta === "consumo_propio") {
        query += ` AND v.es_consumo_propio = 1`;
      }

      query += " ORDER BY v.creado_en DESC";

      if (filtros.limit) {
        query += " LIMIT ?";
        params.push(filtros.limit);
      }

      console.log("🔥 QUERY VENTAS:", query);
      console.log("📋 Params:", params);

      const resultados = await executeQuery(query, params);
      console.log("✅ Ventas filtradas obtenidas:", resultados.length);

      return resultados.map((row: any) => ({
        ...row,
        cantidad: parseInt(row.cantidad) || 0,
        precio_coste: parseFloat(row.precio_coste) || 0,
        precio_venta: row.precio_venta ? parseFloat(row.precio_venta) : 0,
        precio_venta_original: row.precio_venta_original
          ? parseFloat(row.precio_venta_original)
          : undefined,
        ganancia: row.ganancia ? parseFloat(row.ganancia) : undefined,
        es_consumo_propio: row.es_consumo_propio === 1,
        trabajador_id: row.trabajador_id
          ? parseInt(row.trabajador_id)
          : undefined,
        metodo_consumo: row.metodo_consumo,
        valor_descuento: row.valor_descuento,
        trabajador_nombre: row.trabajador_nombre,
      })) as MovimientoVenta[];
    } catch (error) {
      console.error(
        "❌ Error en VentaHistoryService.getVentasConFiltros:",
        error,
      );
      return [];
    }
  }

  // Función para obtener todas las entradas de productos al punto (transacciones individuales)
  static async getTodasEntradasPunto(
    puntoId: number,
    limit?: number,
  ): Promise<MovimientoVenta[]> {
    try {
      console.log("🔍 Buscando todas las entradas para puntoId:", puntoId);

      // Consulta para obtener cada entrada individual (sin agrupar)
      const query = `
        SELECT 
          lt.id,
          'entrada' as tipo,
          lt.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          lt.cantidad,
          lt.precio_coste_real as precio_coste,
          lt.precio_venta,
          (lt.precio_venta - lt.precio_coste_real) * lt.cantidad as ganancia,
          lt.punto_id as punto_destino_id,
          pt.nombre as punto_destino_nombre,
          COALESCE(lt.notas, 'Entrada de producto') as notas,
          lt.creado_en,
          NULL as usuario
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        LEFT JOIN Punto pt ON lt.punto_id = pt.id
        WHERE lt.punto_id = ? AND lt.punto_id > 0
        ORDER BY lt.creado_en DESC
        ${limit ? "LIMIT ?" : ""}
      `;

      const params = limit ? [puntoId, limit] : [puntoId];

      console.log("📋 Ejecutando consulta de entradas individuales...");
      console.log("🔍 QUERY ENTRADAS:", query);
      console.log("📋 Params:", params);
      const resultados = await executeQuery(query, params);
      console.log("✅ Entradas obtenidas:", resultados.length);
      console.log("📋 Datos crudos de entradas:", resultados);

      // Procesar resultados
      const resultadoFinal = resultados.map((row: any) => ({
        ...row,
        cantidad: parseInt(row.cantidad) || 0,
        precio_coste: parseFloat(row.precio_coste) || 0,
        precio_venta: row.precio_venta
          ? parseFloat(row.precio_venta)
          : undefined,
        ganancia: row.ganancia ? parseFloat(row.ganancia) : undefined,
      })) as MovimientoVenta[];

      console.log("🎯 Entradas procesadas:", resultadoFinal.length);
      if (resultadoFinal.length > 0) {
        console.log("📋 Primera entrada:", resultadoFinal[0]);
      }

      return resultadoFinal;
    } catch (error) {
      console.error(
        "❌ Error en VentaHistoryService.getTodasEntradasPunto:",
        error,
      );
      return [];
    }
  }

  // Función para obtener productos de entrada directa (transferencias a punto de venta)
  static async getProductosEntradaDirecta(
    puntoId: number,
    limit?: number,
  ): Promise<MovimientoVenta[]> {
    try {
      console.log("🔍 Buscando entradas directas para puntoId:", puntoId);

      // Buscar en LogTransferencia (transferencias a punto de venta)
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
          NULL as punto_destino_id,
          pt.nombre as punto_destino_nombre,
          'Entrada Directa' as notas,
          lt.creado_en,
          NULL as usuario
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        LEFT JOIN Punto pt ON lt.punto_id = pt.id
        WHERE lt.punto_id = ? AND lt.punto_id > 0
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
      })) as MovimientoVenta[];

      console.log("🎯 Resultado final procesado:", resultadoFinal.length);
      if (resultadoFinal.length > 0) {
        console.log("📋 Primer resultado:", resultadoFinal[0]);
      }

      return resultadoFinal;
    } catch (error) {
      console.error(
        "❌ Error en VentaHistoryService.getProductosEntradaDirecta:",
        error,
      );
      return [];
    }
  }

  // Función para obtener estadísticas de ventas
  static async getEstadisticasVentas(
    filtros?: FiltrosHistorialVentas,
  ): Promise<EstadisticasVentas> {
    try {
      const ventas = await this.getVentasConFiltros(filtros || {});

      const estadisticas: EstadisticasVentas = {
        totalVentas: 0,
        totalConsumoPropio: 0,
        totalIngresos: 0,
        totalCostos: 0,
        totalGanancias: 0,
        totalProductosVendidos: 0,
        promedioVenta: 0,
        ventaMasAlta: 0,
        ventaMasBaja: Infinity,
      };

      const ventasNormales: number[] = [];

      ventas.forEach((venta) => {
        const subtotal = venta.precio_venta * venta.cantidad;
        const costo = venta.precio_coste * venta.cantidad;

        if (venta.tipo === "venta") {
          estadisticas.totalVentas++;
          ventasNormales.push(subtotal);
        } else if (venta.tipo === "consumo_propio") {
          estadisticas.totalConsumoPropio++;
        }

        estadisticas.totalIngresos += subtotal;
        estadisticas.totalCostos += costo;
        estadisticas.totalProductosVendidos += venta.cantidad;

        if (venta.ganancia) {
          estadisticas.totalGanancias += venta.ganancia;
        }
      });

      // Calcular estadísticas adicionales
      if (ventasNormales.length > 0) {
        estadisticas.promedioVenta =
          ventasNormales.reduce((a, b) => a + b, 0) / ventasNormales.length;
        estadisticas.ventaMasAlta = Math.max(...ventasNormales);
        estadisticas.ventaMasBaja = Math.min(...ventasNormales);
      } else {
        estadisticas.ventaMasBaja = 0;
      }

      return estadisticas;
    } catch (error) {
      console.error(
        "Error en VentaHistoryService.getEstadisticasVentas:",
        error,
      );
      return {
        totalVentas: 0,
        totalConsumoPropio: 0,
        totalIngresos: 0,
        totalCostos: 0,
        totalGanancias: 0,
        totalProductosVendidos: 0,
        promedioVenta: 0,
        ventaMasAlta: 0,
        ventaMasBaja: 0,
      };
    }
  }

  // Función para obtener ventas por producto
  static async getVentasPorProducto(
    productoId: number,
    puntoId?: number,
    limit?: number,
  ): Promise<MovimientoVenta[]> {
    return this.getVentasConFiltros({
      productoId,
      puntoId,
      limit: limit || 50,
    });
  }

  // Función para obtener ventas por fecha
  static async getVentasPorFecha(
    fechaDesde: string,
    fechaHasta?: string,
    puntoId?: number,
  ): Promise<MovimientoVenta[]> {
    return this.getVentasConFiltros({
      fechaDesde,
      fechaHasta: fechaHasta || fechaDesde,
      puntoId,
    });
  }

  // Función para obtener consumo propio por período
  static async getConsumoPropioPorPeriodo(
    fechaDesde: string,
    fechaHasta?: string,
    puntoId?: number,
  ): Promise<MovimientoVenta[]> {
    return this.getVentasConFiltros({
      fechaDesde,
      fechaHasta: fechaHasta || fechaDesde,
      puntoId,
    });
  }

  // Función para obtener ventas normales (excluyendo consumo propio)
  static async getVentasNormales(
    puntoId?: number,
    limit?: number,
  ): Promise<MovimientoVenta[]> {
    return this.getVentasConFiltros({
      puntoId,
      limit,
    });
  }
}
