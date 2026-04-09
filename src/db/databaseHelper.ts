// src/db/databaseHelper.ts
import { getFechaLocal } from "../utils/dateUtils";
import {
    Configuracion,
    executeNonQuery,
    executeQuery,
    getFirst,
    getSingleValue,
    Producto,
    SQLiteRunResult,
} from "./database";

// Helper para Producto
export const ProductoHelper = {
  // Obtener todos los productos con límite para evitar sobrecarga
  getAll: async (limit?: number): Promise<Producto[]> => {
    try {
      const limitClause = limit ? ` LIMIT ${limit}` : "";
      return await executeQuery<Producto>(
        `SELECT * FROM Producto ORDER BY nombre${limitClause}`,
      );
    } catch (error) {
      console.error("Error en ProductoHelper.getAll:", error);
      return [];
    }
  },

  // Obtener producto por ID
  getById: async (id: number): Promise<Producto | null> => {
    try {
      return await getFirst<Producto>("SELECT * FROM Producto WHERE id = ?", [
        id,
      ]);
    } catch (error) {
      console.error("Error en ProductoHelper.getById:", error);
      return null;
    }
  },

  // Obtener productos con filtros - CON LÍMITE
  getFiltered: async (
    nombre?: string,
    categoria?: string,
    subcategoria?: string,
    limit: number = 100,
  ): Promise<Producto[]> => {
    try {
      let query = "SELECT * FROM Producto WHERE 1=1";
      const params: any[] = [];

      if (nombre && nombre.trim() !== "") {
        query += " AND nombre LIKE ?";
        params.push(`%${nombre}%`);
      }
      if (categoria && categoria.trim() !== "") {
        query += " AND categoria = ?";
        params.push(categoria);
      }
      if (subcategoria && subcategoria.trim() !== "") {
        query += " AND subcategoria = ?";
        params.push(subcategoria);
      }

      query += " ORDER BY nombre LIMIT ?";
      params.push(limit);
      return await executeQuery<Producto>(query, params);
    } catch (error) {
      console.error("Error en ProductoHelper.getFiltered:", error);
      return [];
    }
  },

  // Obtener productos próximos a vencer - LIMITADO (Incluyendo AlmacenZona, AlmacenProducto y Almacen)
  getProximosAVencer: async (dias = 30, limit: number = 50): Promise<any[]> => {
    try {
      console.log("🔍 DEBUG - Ejecutando getProximosAVencer con UNION ALL");

      // Query mejorada con UNION ALL para incluir productos de las tres tablas
      return await executeQuery<any>(
        `SELECT DISTINCT
           p.id,
           p.nombre,
           p.categoria,
           p.subcategoria,
           p.precio_coste,
           p.fecha_caducidad,
           p.creado_en,
           p.actualizado_en,
           az.cantidad as cantidad_disponible,
           az.punto_id,
           az.zona_id,
           az.precio_venta,
           az.ganancia,
           pt.nombre as ubicacion_nombre,
           'Punto' as tipo_ubicacion,
           CASE 
             WHEN az.zona_id = 1 THEN 'Zona de Venta'
             WHEN az.zona_id = 2 THEN 'Almacén del Punto'
             ELSE 'Zona de Punto'
           END as zona_detalle,
           CAST(julianday(p.fecha_caducidad) - julianday('now') AS INTEGER) as dias_restantes 
         FROM Producto p
         INNER JOIN AlmacenZona az ON p.id = az.producto_id AND az.cantidad > 0
         LEFT JOIN Punto pt ON az.punto_id = pt.id
         WHERE p.fecha_caducidad IS NOT NULL 
           AND (julianday(p.fecha_caducidad) - julianday('now') BETWEEN -365 AND ?)
         
         UNION ALL
         
         SELECT DISTINCT
           p.id,
           p.nombre,
           p.categoria,
           p.subcategoria,
           p.precio_coste,
           p.fecha_caducidad,
           p.creado_en,
           p.actualizado_en,
           ap.cantidad as cantidad_disponible,
           NULL as punto_id,
           NULL as zona_id,
           NULL as precio_venta,
           NULL as ganancia,
           al.nombre as ubicacion_nombre,
           'Almacén' as tipo_ubicacion,
           'Almacén Específico' as zona_detalle,
           CAST(julianday(p.fecha_caducidad) - julianday('now') AS INTEGER) as dias_restantes 
         FROM Producto p
         INNER JOIN AlmacenProducto ap ON p.id = ap.producto_id AND ap.cantidad > 0
         LEFT JOIN Almacenes al ON ap.almacen_id = al.id
         WHERE p.fecha_caducidad IS NOT NULL 
           AND (julianday(p.fecha_caducidad) - julianday('now') BETWEEN -365 AND ?)
         
         UNION ALL
         
         SELECT DISTINCT
           p.id,
           p.nombre,
           p.categoria,
           p.subcategoria,
           p.precio_coste,
           p.fecha_caducidad,
           p.creado_en,
           p.actualizado_en,
           a.cantidad as cantidad_disponible,
           NULL as punto_id,
           NULL as zona_id,
           NULL as precio_venta,
           NULL as ganancia,
           'Almacén General' as ubicacion_nombre,
           'Almacén' as tipo_ubicacion,
           'Almacén General' as zona_detalle,
           CAST(julianday(p.fecha_caducidad) - julianday('now') AS INTEGER) as dias_restantes 
         FROM Producto p
         INNER JOIN Almacen a ON p.id = a.producto_id AND a.cantidad > 0
         WHERE p.fecha_caducidad IS NOT NULL 
           AND (julianday(p.fecha_caducidad) - julianday('now') BETWEEN -365 AND ?)
         
         ORDER BY dias_restantes ASC
         LIMIT ?`,
        [dias, dias, dias, limit],
      );
    } catch (error) {
      console.error("Error en ProductoHelper.getProximosAVencer:", error);
      return [];
    }
  },

  // Obtener productos próximos a vencer con ubicación
  getProximosAVencerConUbicacion: async (
    dias = 30,
    limit: number = 50,
  ): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT DISTINCT
          p.id,
          p.nombre,
          p.categoria,
          p.subcategoria,
          p.precio_coste,
          p.fecha_caducidad,
          julianday(p.fecha_caducidad) - julianday('now') as dias_restantes,
          COALESCE(az.cantidad, 0) as cantidad_punto,
          pt.nombre as nombre_punto,
          COALESCE(ap.cantidad, 0) as cantidad_almacen_especifico,
          al.nombre as nombre_almacen_especifico,
          COALESCE(a.cantidad, 0) as cantidad_almacen_general
         FROM Producto p
         LEFT JOIN AlmacenZona az ON p.id = az.producto_id AND az.cantidad > 0
         LEFT JOIN Punto pt ON az.punto_id = pt.id
         LEFT JOIN AlmacenProducto ap ON p.id = ap.producto_id AND ap.cantidad > 0
         LEFT JOIN Almacenes al ON ap.almacen_id = al.id
         LEFT JOIN Almacen a ON p.id = a.producto_id AND a.cantidad > 0
         WHERE p.fecha_caducidad IS NOT NULL 
           AND julianday(p.fecha_caducidad) - julianday('now') BETWEEN 0 AND ?
           AND (az.cantidad > 0 OR ap.cantidad > 0 OR a.cantidad > 0)
         ORDER BY p.fecha_caducidad ASC
         LIMIT ?`,
        [dias, limit],
      );
    } catch (error) {
      console.error(
        "Error en ProductoHelper.getProximosAVencerConUbicacion:",
        error,
      );
      return [];
    }
  },

  // Crear un producto
  create: async (
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    fecha_caducidad?: string,
  ): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        "INSERT INTO Producto (nombre, categoria, subcategoria, precio_coste, fecha_caducidad) VALUES (?, ?, ?, ?, ?)",
        [
          nombre,
          categoria,
          subcategoria,
          precio_coste,
          fecha_caducidad || null,
        ],
      );
    } catch (error) {
      console.error("Error en ProductoHelper.create:", error);
      throw error;
    }
  },

  // Actualizar un producto
  update: async (
    id: number,
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    fecha_caducidad?: string,
  ): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        "UPDATE Producto SET nombre = ?, categoria = ?, subcategoria = ?, precio_coste = ?, fecha_caducidad = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        [
          nombre,
          categoria,
          subcategoria,
          precio_coste,
          fecha_caducidad || null,
          id,
        ],
      );
    } catch (error) {
      console.error("Error en ProductoHelper.update:", error);
      throw error;
    }
  },

  // Eliminar un producto
  delete: async (id: number): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery("DELETE FROM Producto WHERE id = ?", [id]);
    } catch (error) {
      console.error("Error en ProductoHelper.delete:", error);
      throw error;
    }
  },

  // Calcular total de dinero en todos los almacenes del sistema (solo almacenes físicos)
  getTotalDineroAlmacen: async (): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(total), 0) as total FROM (
          -- Almacén general principal
          SELECT COALESCE(SUM(p.precio_coste * a.cantidad), 0) as total 
          FROM (SELECT producto_id, cantidad FROM Almacen WHERE cantidad > 0) a 
          INNER JOIN Producto p ON p.id = a.producto_id
          
          UNION ALL
          
          -- Sistema multi-almacén (Almacenes + AlmacenProducto)
          SELECT COALESCE(SUM(p.precio_coste * ap.cantidad), 0) as total 
          FROM AlmacenProducto ap
          INNER JOIN Producto p ON p.id = ap.producto_id 
          WHERE ap.cantidad > 0
        ) todos_almacenes`,
      );
      return result || 0;
    } catch (error) {
      console.error("Error en ProductoHelper.getTotalDineroAlmacen:", error);
      return 0;
    }
  },

  // Obtener precio de coste promedio por nombre - OPTIMIZADA
  getPrecioCostePromedio: async (nombre: string): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        "SELECT COALESCE(AVG(precio_coste), 0) as promedio FROM Producto WHERE nombre = ? LIMIT 100",
        [nombre],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en ProductoHelper.getPrecioCostePromedio:", error);
      return 0;
    }
  },

  // Obtener productos por categoría - CON LÍMITE
  getByCategoria: async (
    categoria: string,
    limit: number = 100,
  ): Promise<Producto[]> => {
    try {
      return await executeQuery<Producto>(
        "SELECT * FROM Producto WHERE categoria = ? ORDER BY nombre LIMIT ?",
        [categoria, limit],
      );
    } catch (error) {
      console.error("Error en ProductoHelper.getByCategoria:", error);
      return [];
    }
  },

  // Obtener precio de coste máximo por nombre - OPTIMIZADA
  getPrecioCosteMaximo: async (nombre: string): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        "SELECT COALESCE(MAX(precio_coste), 0) as max_precio FROM Producto WHERE nombre = ? LIMIT 100",
        [nombre],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en ProductoHelper.getPrecioCosteMaximo:", error);
      return 0;
    }
  },
};

// Interface para Punto
export interface Punto {
  id: number;
  nombre: string;
  tipo_negocio: "punto" | "panaderia";
  creado_en: string;
  actualizado_en: string;
}

// Helper para Punto
export const PuntoHelper = {
  // Obtener todos los puntos - CON LÍMITE
  getAll: async (limit?: number): Promise<Punto[]> => {
    try {
      const limitClause = limit ? ` LIMIT ${limit}` : "";
      return await executeQuery<Punto>(
        `SELECT * FROM Punto ORDER BY nombre${limitClause}`,
      );
    } catch (error) {
      console.error("Error en PuntoHelper.getAll:", error);
      return [];
    }
  },

  // Obtener punto por ID
  getById: async (id: number): Promise<Punto | null> => {
    try {
      return await getFirst<Punto>("SELECT * FROM Punto WHERE id = ?", [id]);
    } catch (error) {
      console.error("Error en PuntoHelper.getById:", error);
      return null;
    }
  },

  // Crear un punto
  create: async (
    nombre: string,
    tipo_negocio: "punto" | "panaderia",
  ): Promise<SQLiteRunResult> => {
    try {
      const ahora = getFechaLocal() + " " + new Date().toLocaleTimeString();
      return await executeNonQuery(
        "INSERT INTO Punto (nombre, tipo_negocio, creado_en, actualizado_en) VALUES (?, ?, ?, ?)",
        [nombre, tipo_negocio, ahora, ahora],
      );
    } catch (error) {
      console.error("Error en PuntoHelper.create:", error);
      throw error;
    }
  },

  // Actualizar un punto
  update: async (
    id: number,
    nombre: string,
    tipo_negocio: "punto" | "panaderia",
  ): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        `UPDATE Punto 
         SET nombre = ?, tipo_negocio = ?, actualizado_en = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [nombre, tipo_negocio, id],
      );
    } catch (error) {
      console.error("Error en PuntoHelper.update:", error);
      throw error;
    }
  },

  // Eliminar un punto
  delete: async (id: number): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery("DELETE FROM Punto WHERE id = ?", [id]);
    } catch (error) {
      console.error("Error en PuntoHelper.delete:", error);
      throw error;
    }
  },

  // Obtener puntos filtrados por tipo - CON LÍMITE
  getByTipo: async (
    tipo: "punto" | "panaderia" | "todos",
    limit: number = 50,
  ): Promise<Punto[]> => {
    try {
      if (tipo === "todos") {
        return await executeQuery<Punto>(
          `SELECT * FROM Punto ORDER BY nombre LIMIT ?`,
          [limit],
        );
      }
      return await executeQuery<Punto>(
        "SELECT * FROM Punto WHERE tipo_negocio = ? ORDER BY nombre LIMIT ?",
        [tipo, limit],
      );
    } catch (error) {
      console.error("Error en PuntoHelper.getByTipo:", error);
      return [];
    }
  },

  // Buscar puntos por nombre - CON LÍMITE
  search: async (nombre: string, limit: number = 50): Promise<Punto[]> => {
    try {
      return await executeQuery<Punto>(
        "SELECT * FROM Punto WHERE nombre LIKE ? ORDER BY nombre LIMIT ?",
        [`%${nombre}%`, limit],
      );
    } catch (error) {
      console.error("Error en PuntoHelper.search:", error);
      return [];
    }
  },

  // Obtener precio de coste total en punto - OPTIMIZADA
  getPrecioCostePunto: async (puntoId: number): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(p.precio_coste * az.cantidad), 0) as total 
         FROM AlmacenZona az
         INNER JOIN Producto p ON p.id = az.producto_id 
         WHERE az.punto_id = ? AND az.zona_id = 1 AND az.cantidad > 0`,
        [puntoId],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getPrecioCostePunto:", error);
      return 0;
    }
  },

  // Obtener costo total de inventario (almacén + punto) - OPTIMIZADA
  getCostoTotalInventario: async (puntoId: number): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(p.precio_coste * cantidad_total), 0) as total_inventario
         FROM (
           SELECT p.id, 
                  (COALESCE(a.cantidad, 0) + COALESCE(ap.cantidad, 0)) as cantidad_total
           FROM Producto p 
           LEFT JOIN (SELECT producto_id, cantidad FROM Almacen WHERE cantidad > 0) a ON p.id = a.producto_id
           LEFT JOIN (SELECT producto_id, cantidad FROM AlmacenPunto WHERE punto_id = ? AND cantidad > 0) ap ON p.id = ap.producto_id
           WHERE (COALESCE(a.cantidad, 0) + COALESCE(ap.cantidad, 0)) > 0
         ) stock
         INNER JOIN Producto p ON p.id = stock.id`,
        [puntoId],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getCostoTotalInventario:", error);
      return 0;
    }
  },

  // Obtener ventas del día por punto - OPTIMIZADA
  getVentasHoy: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(total_venta), 0) as ventas_hoy 
         FROM Venta 
         WHERE punto_id = ? 
           AND DATE(creado_en) = ?`,
        [puntoId, hoy],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getVentasHoy:", error);
      return 0;
    }
  },

  // Obtener gastos del día por punto (incluyendo salarios generados)
  getGastosHoy: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(precio), 0) as gastos_hoy
         FROM Gastos 
         WHERE punto_id = ? 
           AND DATE(fecha_gasto) = ?
           AND activo = 1`,
        [puntoId, hoy],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getGastosHoy:", error);
      return 0;
    }
  },

  // Obtener ganancias NETAS del día por punto (ganancias - gastos)
  getGananciasNetasHoy: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();

      // Obtener ganancias brutas de ventas
      const gananciasBrutas = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (p.precio_coste * dv.cantidad)), 0) as ganancias_brutas
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) = ?`,
        [puntoId, hoy],
      );

      // Obtener gastos del día (incluyendo salarios SOLO de trabajadores que trabajan hoy)
      const gastosDia = await getSingleValue<number>(
        `SELECT COALESCE(SUM(precio), 0) as gastos_dia
         FROM Gastos 
         WHERE punto_id = ? 
           AND activo = 1
           AND (
             -- Gastos generales: solo los de hoy
             (categoria != 'Salario' AND DATE(fecha_gasto) = DATE(?))
             OR
             -- Salarios: solo de trabajadores que trabajan hoy
             (categoria = 'Salario' AND id IN (
               SELECT g.id FROM Gastos g 
               WHERE g.punto_id = ? 
                 AND g.categoria = 'Salario' 
                 AND g.activo = 1
                 AND (
                   -- Salarios porcentuales con porcentaje > 0
                   (g.es_porcentaje = 1 AND g.porcentaje > 0)
                   OR
                   -- Salarios fijos con salario_fijo > 0
                   (g.es_porcentaje = 0 AND g.salario_fijo > 0)
                 )
                 -- Solo incluir si el trabajador está trabajando hoy
                 AND (
                   -- Para salarios porcentuales: verificar si debe generar salario hoy
                   (g.es_porcentaje = 1 AND EXISTS (
                     SELECT 1 FROM CierreCaja ac 
                     WHERE ac.punto_id = g.punto_id 
                       AND ac.tipo = 'apertura'
                       AND DATE(ac.fecha_cierre) = DATE(?)
                       AND ac.trabajador_id = g.id
                   ))
                   OR
                   -- Para salarios fijos: misma verificación
                   (g.es_porcentaje = 0 AND EXISTS (
                     SELECT 1 FROM CierreCaja ac 
                     WHERE ac.punto_id = g.punto_id 
                       AND ac.tipo = 'apertura'
                       AND DATE(ac.fecha_cierre) = DATE(?)
                       AND ac.trabajador_id = g.id
                   ))
                 )
             ))
           )`,
        [puntoId, hoy, puntoId, hoy, hoy],
      );

      const gananciasNetas = (gananciasBrutas || 0) - (gastosDia || 0);
      console.log(
        `📊 Ganancias netas hoy (${hoy}): $${gananciasBrutas || 0} - $${gastosDia || 0} = $${gananciasNetas}`,
      );

      return gananciasNetas;
    } catch (error) {
      console.error("Error en PuntoHelper.getGananciasNetasHoy:", error);
      return 0;
    }
  },

  // Obtener ganancias BRUTAS del día por punto (solo ventas, sin restar gastos)
  getGananciasBrutasHoy: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();

      // Obtener ganancias brutas de ventas (incluyendo pagos de deuda)
      const gananciasBrutas = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (COALESCE(p.precio_coste, 0) * dv.cantidad)), 0) as ganancias_brutas
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         LEFT JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) = ?`,
        [puntoId, hoy],
      );

      console.log(`💰 Ganancias brutas hoy (${hoy}): $${gananciasBrutas || 0}`);

      return gananciasBrutas || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getGananciasBrutasHoy:", error);
      return 0;
    }
  },

  // Obtener ganancias del día por punto - OPTIMIZADA (MANTENER PARA COMPATIBILIDAD)
  getGananciasHoy: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (COALESCE(p.precio_coste, 0) * dv.cantidad)), 0) as ganancias_hoy
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         LEFT JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) = ?`,
        [puntoId, hoy],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getGananciasHoy:", error);
      return 0;
    }
  },

  // Obtener ganancias NETAS de la semana por punto (ganancias - gastos)
  getGananciasNetasSemana: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const inicioSemanaDate = new Date();
      inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
      const inicio = inicioSemanaDate.toISOString().split("T")[0];
      const fin = hoy;

      // Obtener ganancias brutas de la semana
      const gananciasBrutas = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (p.precio_coste * dv.cantidad)), 0) as ganancias_brutas
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );

      // Obtener gastos de la semana
      const gastosSemana = await getSingleValue<number>(
        `SELECT COALESCE(SUM(precio), 0) as gastos_semana
         FROM Gastos 
         WHERE punto_id = ? 
           AND DATE(fecha_gasto) BETWEEN ? AND ?
           AND activo = 1`,
        [puntoId, inicio, fin],
      );

      const gananciasNetas = (gananciasBrutas || 0) - (gastosSemana || 0);
      console.log(
        `📊 Ganancias netas semana (${inicio} a ${fin}): $${gananciasBrutas || 0} - $${gastosSemana || 0} = $${gananciasNetas}`,
      );

      return gananciasNetas;
    } catch (error) {
      console.error("Error en PuntoHelper.getGananciasNetasSemana:", error);
      return 0;
    }
  },

  // Obtener ganancias NETAS del mes por punto (ganancias - gastos)
  getGananciasNetasMes: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const inicioMesDate = new Date();
      inicioMesDate.setDate(1);
      const inicio = inicioMesDate.toISOString().split("T")[0];
      const fin = hoy;

      // Obtener ganancias brutas del mes
      const gananciasBrutas = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (p.precio_coste * dv.cantidad)), 0) as ganancias_brutas
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );

      // Obtener gastos del mes
      const gastosMes = await getSingleValue<number>(
        `SELECT COALESCE(SUM(precio), 0) as gastos_mes
         FROM Gastos 
         WHERE punto_id = ? 
           AND DATE(fecha_gasto) BETWEEN ? AND ?
           AND activo = 1`,
        [puntoId, inicio, fin],
      );

      const gananciasNetas = (gananciasBrutas || 0) - (gastosMes || 0);
      console.log(
        `📊 Ganancias netas mes (${inicio} a ${fin}): $${gananciasBrutas || 0} - $${gastosMes || 0} = $${gananciasNetas}`,
      );

      return gananciasNetas;
    } catch (error) {
      console.error("Error en PuntoHelper.getGananciasNetasMes:", error);
      return 0;
    }
  },

  // Obtener ganancias de la última semana por punto
  getGananciasSemana: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const inicioSemanaDate = new Date();
      inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
      const inicio = inicioSemanaDate.toISOString().split("T")[0];
      const fin = hoy;

      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (COALESCE(p.precio_coste, 0) * dv.cantidad)), 0) as ganancias_semana
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         LEFT JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getGananciasSemana:", error);
      return 0;
    }
  },

  // Obtener ganancias del mes por punto
  getGananciasMes: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const inicioMesDate = new Date();
      inicioMesDate.setDate(1);
      const inicio = inicioMesDate.toISOString().split("T")[0];
      const fin = hoy;

      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(dv.subtotal - (COALESCE(p.precio_coste, 0) * dv.cantidad)), 0) as ganancias_mes
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         LEFT JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getGananciasMes:", error);
      return 0;
    }
  },

  // Obtener cantidad de productos en el punto - OPTIMIZADA
  getCantidadProductosEnPunto: async (puntoId: number): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(cantidad), 0) as total_productos 
         FROM AlmacenZona 
         WHERE punto_id = ? AND zona_id = 1`,
        [puntoId],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PuntoHelper.getCantidadProductosEnPunto:", error);
      return 0;
    }
  },

  // Verificar si existe un punto con el mismo nombre
  existsByName: async (
    nombre: string,
    excludeId?: number,
  ): Promise<boolean> => {
    try {
      let query = "SELECT COUNT(*) as count FROM Punto WHERE nombre = ?";
      const params: any[] = [nombre];

      if (excludeId) {
        query += " AND id != ?";
        params.push(excludeId);
      }

      const result = await getSingleValue<number>(query, params);
      return (result || 0) > 0;
    } catch (error) {
      console.error("Error en PuntoHelper.existsByName:", error);
      return false;
    }
  },

  // Obtener puntos con estadísticas básicas - OPTIMIZADA
  getPuntosConEstadisticas: async (
    limit: number = 50,
  ): Promise<
    (Punto & {
      costo_total: number;
      ventas_hoy: number;
      productos_count: number;
    })[]
  > => {
    try {
      const hoy = getFechaLocal();
      return await executeQuery<any>(
        `SELECT 
          p.*,
          COALESCE(pr_costo.costo_total, 0) as costo_total,
          COALESCE(v.ventas_hoy, 0) as ventas_hoy,
          COALESCE(ap_count.productos_count, 0) as productos_count
         FROM Punto p
         LEFT JOIN (
           SELECT ap.punto_id, SUM(p.precio_coste * ap.cantidad) as costo_total
           FROM AlmacenPunto ap
           INNER JOIN Producto p ON ap.producto_id = p.id
           WHERE ap.cantidad > 0
           GROUP BY ap.punto_id
         ) pr_costo ON p.id = pr_costo.punto_id
         LEFT JOIN (
           SELECT punto_id, SUM(total_venta) as ventas_hoy
           FROM Venta 
           WHERE DATE(creado_en) = ?
           GROUP BY punto_id
         ) v ON p.id = v.punto_id
         LEFT JOIN (
           SELECT punto_id, SUM(cantidad) as productos_count
           FROM AlmacenPunto
           GROUP BY punto_id
         ) ap_count ON p.id = ap_count.punto_id
         ORDER BY p.nombre
         LIMIT ?`,
        [hoy, limit],
      );
    } catch (error) {
      console.error("Error en PuntoHelper.getPuntosConEstadisticas:", error);
      return [];
    }
  },

  // Obtener actividad reciente del punto - CON LÍMITE
  getActividadReciente: async (
    puntoId: number,
    limite: number = 10,
  ): Promise<
    {
      id: number;
      tipo: string;
      descripcion: string;
      creado_en: string;
      icono?: string;
      color?: string;
    }[]
  > => {
    try {
      // Usar UNION ALL en lugar de múltiples consultas separadas
      const actividad = await executeQuery<any>(
        `SELECT id, 'venta' as tipo, 'Venta realizada - $' || total_venta || ' (' || tipo_pago || ')' as descripcion, creado_en
         FROM Venta 
         WHERE punto_id = ? 
         UNION ALL
         SELECT ap.id, 'transferencia' as tipo, 'Transferido: ' || p.nombre || ' (' || ap.cantidad || ' unidades)' as descripcion, ap.creado_en
         FROM AlmacenPunto ap
         INNER JOIN Producto p ON ap.producto_id = p.id
         WHERE ap.punto_id = ?
         UNION ALL
         SELECT id, 'cierre' as tipo, 'Cierre de caja - $' || total_ventas as descripcion, creado_en
         FROM CierreCaja 
         WHERE punto_id = ?
         ORDER BY creado_en DESC 
         LIMIT ?`,
        [puntoId, puntoId, puntoId, limite],
      );

      return actividad.map((item: any) => {
        let icono = "cube-outline";
        let color = "#3b82f6";

        if (item.tipo === "venta") {
          icono = "cart-outline";
          color = "#10b981";
        } else if (item.tipo === "cierre") {
          icono = "calculator-outline";
          color = "#f59e0b";
        }

        return {
          ...item,
          icono,
          color,
        };
      });
    } catch (error) {
      console.error("Error en PuntoHelper.getActividadReciente:", error);
      return [];
    }
  },

  // Obtener ventas del día por tipo de pago - OPTIMIZADA
  getVentasHoyPorTipo: async (
    puntoId: number,
  ): Promise<{
    efectivo: number;
    transferencia: number;
    mixto: number;
  }> => {
    try {
      const hoy = getFechaLocal();
      const ventas = await executeQuery<any>(
        `SELECT 
           tipo_pago,
           total_venta,
           total_efectivo,
           total_transferencia
         FROM Venta 
         WHERE punto_id = ? 
           AND DATE(creado_en) = ?`,
        [puntoId, hoy],
      );

      const resultado = {
        efectivo: 0,
        transferencia: 0,
        mixto: 0,
      };

      ventas.forEach((venta: any) => {
        // Sumar al total mixto (todas las ventas)
        resultado.mixto += venta.total_venta || 0;

        // Sumar efectivo y transferencia según el tipo
        if (venta.tipo_pago === "efectivo") {
          resultado.efectivo += venta.total_venta || 0;
        } else if (venta.tipo_pago === "transferencia") {
          resultado.transferencia += venta.total_venta || 0;
        } else if (venta.tipo_pago === "mixto") {
          // Para ventas mixtas, sumar las partes correspondientes
          resultado.efectivo += venta.total_efectivo || 0;
          resultado.transferencia += venta.total_transferencia || 0;
        }
      });

      return resultado;
    } catch (error) {
      console.error("Error en PuntoHelper.getVentasHoyPorTipo:", error);
      return { efectivo: 0, transferencia: 0, mixto: 0 };
    }
  },

  // Obtener productos más vendidos del día por punto
  getProductosMasVendidosHoy: async (
    puntoId: number,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const productos = await executeQuery<any>(
        `SELECT p.nombre, dv.cantidad, dv.subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) = ?
         GROUP BY p.id, p.nombre, p.categoria
         ORDER BY dv.subtotal DESC
         LIMIT ?`,
        [puntoId, hoy, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error("Error en PuntoHelper.getProductosMasVendidosHoy:", error);
      return [];
    }
  },

  // Obtener productos más vendidos de la última semana por punto
  getProductosMasVendidosSemana: async (
    puntoId: number,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const inicioSemanaDate = new Date();
      inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
      const inicio = inicioSemanaDate.toISOString().split("T")[0];
      const fin = hoy;

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         ORDER BY subtotal DESC
         LIMIT ?`,
        [puntoId, inicio, fin, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getProductosMasVendidosSemana:",
        error,
      );
      return [];
    }
  },

  // Obtener productos más vendidos del mes por punto
  getProductosMasVendidosMes: async (
    puntoId: number,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const inicioMesDate = new Date();
      inicioMesDate.setDate(1);
      const inicio = inicioMesDate.toISOString().split("T")[0];
      const fin = hoy;

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         ORDER BY subtotal DESC
         LIMIT ?`,
        [puntoId, inicio, fin, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error("Error en PuntoHelper.getProductosMasVendidosMes:", error);
      return [];
    }
  },

  // Obtener productos más vendidos de un período personalizado por punto
  getProductosMasVendidosPeriodo: async (
    puntoId: number,
    fechaInicio: Date,
    fechaFin: Date,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const inicio = fechaInicio.toISOString().split("T")[0];
      const fin = fechaFin.toISOString().split("T")[0];

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         ORDER BY subtotal DESC
         LIMIT ?`,
        [puntoId, inicio, fin, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getProductosMasVendidosPeriodo:",
        error,
      );
      return [];
    }
  },

  // Obtener productos menos vendidos del día por punto
  getProductosMenosVendidosHoy: async (
    puntoId: number,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) = ?
         GROUP BY p.nombre, p.categoria
         HAVING SUM(dv.cantidad) > 0
         ORDER BY SUM(dv.cantidad) ASC
         LIMIT ?`,
        [puntoId, hoy, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getProductosMenosVendidosHoy:",
        error,
      );
      return [];
    }
  },

  // Obtener productos menos vendidos de la última semana por punto
  getProductosMenosVendidosSemana: async (
    puntoId: number,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const inicioSemanaDate = new Date();
      inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
      const inicio = inicioSemanaDate.toISOString().split("T")[0];
      const fin = hoy;

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         HAVING SUM(dv.cantidad) > 0
         ORDER BY SUM(dv.cantidad) ASC
         LIMIT ?`,
        [puntoId, inicio, fin, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getProductosMenosVendidosSemana:",
        error,
      );
      return [];
    }
  },

  // Obtener productos menos vendidos del mes por punto
  getProductosMenosVendidosMes: async (
    puntoId: number,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const inicioMesDate = new Date();
      inicioMesDate.setDate(1);
      const inicio = inicioMesDate.toISOString().split("T")[0];
      const fin = hoy;

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         HAVING SUM(dv.cantidad) > 0
         ORDER BY SUM(dv.cantidad) ASC
         LIMIT ?`,
        [puntoId, inicio, fin, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getProductosMenosVendidosMes:",
        error,
      );
      return [];
    }
  },

  // Obtener productos menos vendidos de un período personalizado por punto
  getProductosMenosVendidosPeriodo: async (
    puntoId: number,
    fechaInicio: Date,
    fechaFin: Date,
    limite: number = 10,
  ): Promise<any[]> => {
    try {
      const inicio = fechaInicio.toISOString().split("T")[0];
      const fin = fechaFin.toISOString().split("T")[0];

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         HAVING SUM(dv.cantidad) > 0
         ORDER BY SUM(dv.cantidad) ASC
         LIMIT ?`,
        [puntoId, inicio, fin, limite],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getProductosMenosVendidosPeriodo:",
        error,
      );
      return [];
    }
  },

  // Obtener todos los productos vendidos del día por punto (con paginación)
  getProductosVendidosHoy: async (
    puntoId: number,
    limite: number = 10,
    offset: number = 0,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) = ?
         GROUP BY p.nombre, p.categoria
         ORDER BY p.nombre ASC
         LIMIT ? OFFSET ?`,
        [puntoId, hoy, limite, offset],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error("Error en PuntoHelper.getProductosVendidosHoy:", error);
      return [];
    }
  },

  // Obtener todos los productos vendidos de la última semana por punto (con paginación)
  getProductosVendidosSemana: async (
    puntoId: number,
    limite: number = 10,
    offset: number = 0,
  ): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const inicioSemanaDate = new Date();
      inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
      const inicio = inicioSemanaDate.toISOString().split("T")[0];
      const fin = hoy;

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         ORDER BY p.nombre ASC
         LIMIT ? OFFSET ?`,
        [puntoId, inicio, fin, limite, offset],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error("Error en PuntoHelper.getProductosVendidosSemana:", error);
      return [];
    }
  },

  // Obtener todos los productos vendidos del mes por punto (con paginación)
  getProductosVendidosMes: async (
    puntoId: number,
    limite: number = 10,
    offset: number = 0,
  ): Promise<any[]> => {
    try {
      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND strftime('%Y-%m', v.creado_en) = strftime('%Y-%m', 'now')
         GROUP BY p.nombre, p.categoria
         ORDER BY p.nombre ASC
         LIMIT ? OFFSET ?`,
        [puntoId, limite, offset],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error("Error en PuntoHelper.getProductosVendidosMes:", error);
      return [];
    }
  },

  // Obtener todos los productos vendidos de un período personalizado por punto (con paginación)
  getProductosVendidosPeriodo: async (
    puntoId: number,
    fechaInicio: Date,
    fechaFin: Date,
    limite: number = 10,
    offset: number = 0,
  ): Promise<any[]> => {
    try {
      const inicio = fechaInicio.toISOString().split("T")[0];
      const fin = fechaFin.toISOString().split("T")[0];

      const productos = await executeQuery<any>(
        `SELECT p.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as subtotal, p.categoria
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY p.nombre, p.categoria
         ORDER BY p.nombre ASC
         LIMIT ? OFFSET ?`,
        [puntoId, inicio, fin, limite, offset],
      );

      return productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad_vendida: producto.cantidad,
        total_vendido: producto.subtotal,
        categoria: producto.categoria,
      }));
    } catch (error) {
      console.error("Error en PuntoHelper.getProductosVendidosPeriodo:", error);
      return [];
    }
  },

  // Obtener el total de productos vendidos para paginación
  getTotalProductosVendidosHoy: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const result = await getFirst<any>(
        `SELECT COUNT(DISTINCT p.nombre) as total
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) = ?`,
        [puntoId, hoy],
      );
      return result?.total || 0;
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getTotalProductosVendidosHoy:",
        error,
      );
      return 0;
    }
  },

  getTotalProductosVendidosSemana: async (puntoId: number): Promise<number> => {
    try {
      const hoy = getFechaLocal();
      const inicioSemanaDate = new Date();
      inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
      const inicio = inicioSemanaDate.toISOString().split("T")[0];
      const fin = hoy;

      const result = await getFirst<any>(
        `SELECT COUNT(DISTINCT p.nombre) as total
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );
      return result?.total || 0;
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getTotalProductosVendidosSemana:",
        error,
      );
      return 0;
    }
  },

  getTotalProductosVendidosMes: async (puntoId: number): Promise<number> => {
    try {
      const result = await getFirst<any>(
        `SELECT COUNT(DISTINCT p.nombre) as total
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND strftime('%Y-%m', v.creado_en) = strftime('%Y-%m', 'now')`,
        [puntoId],
      );
      return result?.total || 0;
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getTotalProductosVendidosMes:",
        error,
      );
      return 0;
    }
  },

  getTotalProductosVendidosPeriodo: async (
    puntoId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<number> => {
    try {
      const inicio = fechaInicio.toISOString().split("T")[0];
      const fin = fechaFin.toISOString().split("T")[0];

      const result = await getFirst<any>(
        `SELECT COUNT(DISTINCT p.nombre) as total
         FROM DetalleVenta dv
         INNER JOIN Venta v ON dv.venta_id = v.id
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE v.punto_id = ? AND DATE(v.creado_en) BETWEEN ? AND ?`,
        [puntoId, inicio, fin],
      );
      return result?.total || 0;
    } catch (error) {
      console.error(
        "Error en PuntoHelper.getTotalProductosVendidosPeriodo:",
        error,
      );
      return 0;
    }
  },
};

// Helper para Configuración
export const ConfigHelper = {
  // Obtener valor de configuración
  get: async (clave: string): Promise<string | null> => {
    try {
      const result = await getFirst<Configuracion>(
        "SELECT valor FROM Configuracion WHERE clave = ?",
        [clave],
      );
      return result?.valor || null;
    } catch (error) {
      console.error("Error en ConfigHelper.get:", error);
      return null;
    }
  },

  // Obtener toda la configuración
  getAll: async (): Promise<Configuracion[]> => {
    try {
      return await executeQuery<Configuracion>(
        "SELECT * FROM Configuracion ORDER BY clave LIMIT 50",
      );
    } catch (error) {
      console.error("Error en ConfigHelper.getAll:", error);
      return [];
    }
  },

  // Verificar contraseña
  verifyPassword: async (password: string): Promise<boolean> => {
    try {
      const storedPassword = await ConfigHelper.get("password");
      return password === storedPassword;
    } catch (error) {
      console.error("Error en ConfigHelper.verifyPassword:", error);
      return false;
    }
  },

  // Actualizar configuración
  update: async (
    clave: string,
    valor: string,
    descripcion?: string,
  ): Promise<SQLiteRunResult> => {
    try {
      if (descripcion) {
        return await executeNonQuery(
          "UPDATE Configuracion SET valor = ?, descripcion = ?, actualizado_en = CURRENT_TIMESTAMP WHERE clave = ?",
          [valor, descripcion, clave],
        );
      } else {
        return await executeNonQuery(
          "UPDATE Configuracion SET valor = ?, actualizado_en = CURRENT_TIMESTAMP WHERE clave = ?",
          [valor, clave],
        );
      }
    } catch (error) {
      console.error("Error en ConfigHelper.update:", error);
      throw error;
    }
  },

  // Insertar configuración
  insert: async (
    clave: string,
    valor: string,
    descripcion?: string,
  ): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        "INSERT OR IGNORE INTO Configuracion (clave, valor, descripcion) VALUES (?, ?, ?)",
        [clave, valor, descripcion || null],
      );
    } catch (error) {
      console.error("Error en ConfigHelper.insert:", error);
      throw error;
    }
  },
};

// Helper para Ofertas (sistema básico temporal)
export const OfertaHelper = {
  // Inicializar tablas mejoradas
  createTable: async (): Promise<void> => {
    try {
      // Crear tabla OfertaMejorada
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS OfertaMejorada (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          punto_id INTEGER NOT NULL,
          nombre TEXT NOT NULL,
          descripcion TEXT,
          dias_ilimitados INTEGER DEFAULT 0,
          dias_validez INTEGER,
          fecha_inicio DATE NOT NULL,
          fecha_fin DATE NOT NULL,
          activa INTEGER DEFAULT 1,
          aplica_a_todos INTEGER DEFAULT 1,
          metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('transferencia', 'efectivo', 'todos')),
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
        );
      `);

      // Crear tabla OfertaProducto
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS OfertaProducto (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          oferta_id INTEGER NOT NULL,
          producto_id INTEGER NOT NULL,
          tipo_descuento TEXT NOT NULL CHECK(tipo_descuento IN ('porcentaje', 'valor')),
          valor_descuento REAL NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (oferta_id) REFERENCES OfertaMejorada(id) ON DELETE CASCADE,
          FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
        );
      `);

      // También crear la tabla básica por compatibilidad
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS Oferta (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          punto_id INTEGER NOT NULL,
          tipo TEXT NOT NULL CHECK(tipo IN ('porcentaje', 'valor')),
          valor REAL NOT NULL,
          metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('transferencia', 'efectivo', 'todos')),
          descripcion TEXT,
          fecha_inicio DATE NOT NULL,
          fecha_fin DATE NOT NULL,
          activa BOOLEAN DEFAULT 1,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
        );
      `);

      console.log("✅ Todas las tablas de ofertas inicializadas correctamente");
    } catch (error) {
      console.error("❌ Error inicializando tablas de ofertas:", error);
      throw error;
    }
  },

  // Obtener oferta activa (sistema básico)
  getOfertaActiva: async (puntoId: number): Promise<any | null> => {
    try {
      const hoy = getFechaLocal();
      return await getFirst<any>(
        `SELECT * FROM Oferta 
         WHERE punto_id = ? 
           AND activa = 1 
           AND (fecha_inicio <= ? AND fecha_fin >= ?)`,
        [puntoId, hoy, hoy],
      );
    } catch (error: any) {
      if (error.message && error.message.includes("no such table: Oferta")) {
        console.log("Tabla Oferta no existe aún");
        return null;
      }
      console.error("Error en OfertaHelper.getOfertaActiva:", error);
      return null;
    }
  },

  // Crear oferta básica
  crearOferta: async (
    puntoId: number,
    tipo: "porcentaje" | "valor",
    valor: number,
    metodo_pago: "transferencia" | "efectivo" | "todos",
    descripcion: string,
    fecha_inicio: string,
    fecha_fin: string,
  ): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        `INSERT INTO Oferta (
          punto_id, tipo, valor, metodo_pago, descripcion, 
          fecha_inicio, fecha_fin, activa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          puntoId,
          tipo,
          valor,
          metodo_pago,
          descripcion,
          fecha_inicio,
          fecha_fin,
        ],
      );
    } catch (error) {
      console.error("Error en OfertaHelper.crearOferta:", error);
      throw error;
    }
  },

  // Desactivar oferta (versión mejorada)
  desactivarOferta: async (ofertaId: number): Promise<SQLiteRunResult> => {
    try {
      console.log("🗑️ Desactivando oferta:", ofertaId);

      // Primero intentar en tabla OfertaMejorada
      const result = await executeNonQuery(
        "UPDATE OfertaMejorada SET activa = 0 WHERE id = ?",
        [ofertaId],
      );

      console.log("✅ Oferta desactivada correctamente");
      return result;
    } catch (error: any) {
      // Si hay error, intentar en tabla básica Oferta
      try {
        console.log("🔄 Intentando desactivar en tabla básica Oferta");
        const result = await executeNonQuery(
          "UPDATE Oferta SET activa = 0 WHERE id = ?",
          [ofertaId],
        );
        console.log("✅ Oferta desactivada en tabla básica");
        return result;
      } catch (basicError) {
        console.error("Error desactivando oferta en ambas tablas:", basicError);
        throw new Error("No se pudo desactivar la oferta");
      }
    }
  },

  // Obtener ofertas de un punto (sistema básico)
  getOfertasByPunto: async (
    puntoId: number,
    limit: number = 50,
  ): Promise<any[]> => {
    try {
      console.log("🔍 Buscando ofertas para puntoId:", puntoId);

      // Primero verificar si hay ofertas en la tabla nueva OfertaMejorada
      try {
        const ofertasMejoradas = await executeQuery<any>(
          `SELECT * FROM OfertaMejorada 
           WHERE punto_id = ? 
           ORDER BY creado_en DESC
           LIMIT ?`,
          [puntoId, limit],
        );

        if (ofertasMejoradas.length > 0) {
          console.log(
            "🎯 Encontradas",
            ofertasMejoradas.length,
            "ofertas en tabla OfertaMejorada",
          );

          // Para cada oferta, obtener sus productos específicos si aplica
          const ofertasCompletas = await Promise.all(
            ofertasMejoradas.map(async (oferta) => {
              let productos = [];

              // Si no aplica a todos, obtener los productos específicos
              if (!oferta.aplica_a_todos) {
                try {
                  productos = await executeQuery<any>(
                    `SELECT op.*, p.nombre as producto_nombre
                     FROM OfertaProducto op
                     INNER JOIN Producto p ON op.producto_id = p.id
                     WHERE op.oferta_id = ?`,
                    [oferta.id],
                  );
                } catch (error) {
                  console.log(
                    "No se pudieron cargar productos para oferta",
                    oferta.id,
                  );
                }
              }

              return {
                id: oferta.id,
                punto_id: oferta.punto_id,
                nombre: oferta.nombre,
                descripcion: oferta.descripcion,
                dias_ilimitados: Boolean(oferta.dias_ilimitados),
                dias_validez: oferta.dias_validez,
                tipo_descuento_todos: oferta.aplica_a_todos
                  ? "porcentaje"
                  : "valor",
                valor_descuento_todos: oferta.aplica_a_todos ? 5 : 0,
                metodo_pago: oferta.metodo_pago,
                aplica_a_todos: Boolean(oferta.aplica_a_todos),
                fecha_inicio: oferta.fecha_inicio,
                fecha_fin: oferta.fecha_fin,
                activa: Boolean(oferta.activa),
                creado_en: oferta.creado_en,
                productos: productos,
              };
            }),
          );

          return ofertasCompletas;
        }
      } catch (error) {
        console.log("📋 Tabla OfertaMejorada no existe o está vacía");
      }

      // Si no hay en tabla nueva, buscar en tabla básica
      const ofertasFiltradas = await executeQuery<any>(
        `SELECT * FROM Oferta 
         WHERE punto_id = ? 
         ORDER BY creado_en DESC
         LIMIT ?`,
        [puntoId, limit],
      );

      console.log(
        "🎯 Ofertas filtradas para puntoId",
        puntoId,
        ":",
        ofertasFiltradas.length,
      );

      return ofertasFiltradas;
    } catch (error) {
      console.error("Error en OfertaHelper.getOfertasByPunto:", error);
      return [];
    }
  },

  // Obtener productos del punto (consulta directa)
  getProductosPunto: async (puntoId: number): Promise<any[]> => {
    try {
      return await executeQuery(
        `
        SELECT p.*, az.cantidad as cantidad_en_punto, az.precio_venta
        FROM Producto p
        INNER JOIN AlmacenZona az ON p.id = az.producto_id
        WHERE az.punto_id = ? AND az.zona_id = 1 AND az.cantidad > 0
        ORDER BY p.nombre
      `,
        [puntoId],
      );
    } catch (error) {
      console.error("Error en OfertaHelper.getProductosPunto:", error);
      return [];
    }
  },

  // Crear oferta completa (versión con reintentos para evitar database locked)
  crearOfertaCompleta: async (oferta: any): Promise<number> => {
    const executeWithRetry = async (
      operation: () => Promise<any>,
      maxRetries: number = 5,
      initialDelay: number = 100,
    ): Promise<any> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error: any) {
          if (
            error.message &&
            (error.message.includes("database is locked") ||
              error.message.includes("database is locked")) &&
            attempt < maxRetries
          ) {
            const delay = initialDelay * Math.pow(2, attempt - 1);
            console.log(
              `🔄 Intento ${attempt}/${maxRetries}: Base de datos bloqueada, reintentando en ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }
      throw new Error("Máximo de reintentos alcanzado");
    };

    return executeWithRetry(async () => {
      console.log("🔧 Creando oferta completa:", oferta);

      // Pequeña pausa antes de la operación
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Crear la oferta principal
      const result = await executeNonQuery(
        `INSERT INTO OfertaMejorada (
          punto_id, nombre, descripcion, dias_ilimitados, dias_validez,
          fecha_inicio, fecha_fin, activa, aplica_a_todos, metodo_pago
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          oferta.punto_id,
          oferta.nombre,
          oferta.descripcion || null,
          oferta.dias_ilimitados ? 1 : 0,
          oferta.dias_ilimitados ? null : oferta.dias_validez,
          oferta.fecha_inicio || getFechaLocal(),
          getFechaLocal(),
          oferta.activa ? 1 : 0,
          oferta.aplica_a_todos ? 1 : 0,
          oferta.metodo_pago || "todos",
        ],
      );

      const ofertaId = result.lastInsertRowId;
      console.log("✅ Oferta principal creada con ID:", ofertaId);

      // Si no aplica a todos y hay productos, crearlos con pausas
      if (
        !oferta.aplica_a_todos &&
        oferta.productos &&
        oferta.productos.length > 0
      ) {
        console.log(
          "🔧 Creando productos específicos:",
          oferta.productos.length,
        );

        for (const producto of oferta.productos) {
          // Pausa entre cada producto para evitar bloqueos
          await new Promise((resolve) => setTimeout(resolve, 100));

          await executeWithRetry(
            async () => {
              await executeNonQuery(
                `INSERT INTO OfertaProducto (oferta_id, producto_id, tipo_descuento, valor_descuento)
               VALUES (?, ?, ?, ?)`,
                [
                  ofertaId,
                  producto.producto_id,
                  producto.tipo_descuento || "porcentaje",
                  producto.valor_descuento || 5,
                ],
              );
              console.log("✅ Producto creado:", producto.producto_id);
            },
            3,
            50,
          ); // 3 reintentos para cada producto
        }
      }

      console.log("✅ Oferta completada exitosamente");
      return ofertaId;
    });
  },
};

// Helper para Almacén
export const AlmacenHelper = {
  // Obtener productos en almacén - CON LÍMITE
  getAll: async (limit: number = 100): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT 
          p.*, 
          COALESCE(a.cantidad, 0) as cantidad,
          a.ubicacion
         FROM Producto p
         LEFT JOIN Almacen a ON p.id = a.producto_id
         WHERE COALESCE(a.cantidad, 0) > 0
         ORDER BY p.nombre
         LIMIT ?`,
        [limit],
      );
    } catch (error) {
      console.error("Error en AlmacenHelper.getAll:", error);
      return [];
    }
  },

  // Transferir productos del almacén al punto
  transferirAlmacenPunto: async (
    productoId: number,
    puntoId: number,
    cantidad: number,
    precioVenta: number,
  ): Promise<SQLiteRunResult> => {
    try {
      // Verificar que hay suficiente cantidad en almacén
      const cantidadAlmacen = await getSingleValue<number>(
        "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
        [productoId],
      );

      if (!cantidadAlmacen || cantidadAlmacen < cantidad) {
        throw new Error("Cantidad insuficiente en almacén");
      }

      // Reducir cantidad en almacén
      await executeNonQuery(
        "UPDATE Almacen SET cantidad = cantidad - ? WHERE producto_id = ?",
        [cantidad, productoId],
      );

      // Añadir o actualizar en AlmacenPunto
      const existing = await getFirst<any>(
        "SELECT * FROM AlmacenPunto WHERE producto_id = ? AND punto_id = ?",
        [productoId, puntoId],
      );

      if (existing) {
        return await executeNonQuery(
          "UPDATE AlmacenPunto SET cantidad = cantidad + ?, precio_venta = ?, ganancia = precio_venta - (SELECT precio_coste FROM Producto WHERE id = ?) WHERE id = ?",
          [cantidad, precioVenta, productoId, existing.id],
        );
      } else {
        return await executeNonQuery(
          "INSERT INTO AlmacenPunto (producto_id, punto_id, cantidad, precio_venta, ganancia) VALUES (?, ?, ?, ?, (SELECT ? - precio_coste FROM Producto WHERE id = ?))",
          [productoId, puntoId, cantidad, precioVenta, precioVenta, productoId],
        );
      }
    } catch (error) {
      console.error("Error en AlmacenHelper.transferirAlmacenPunto:", error);
      throw error;
    }
  },

  // Obtener stock disponible por producto
  getStockDisponible: async (productoId: number): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
        [productoId],
      );
      return result || 0;
    } catch (error) {
      console.error("Error en AlmacenHelper.getStockDisponible:", error);
      return 0;
    }
  },

  // Obtener productos con stock bajo - CON LÍMITE
  getProductosStockBajo: async (
    minimo: number = 10,
    limit: number = 50,
  ): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT 
          p.*,
          a.cantidad,
          a.ubicacion
         FROM Producto p
         INNER JOIN Almacen a ON p.id = a.producto_id
         WHERE a.cantidad <= ?
         ORDER BY a.cantidad ASC
         LIMIT ?`,
        [minimo, limit],
      );
    } catch (error) {
      console.error("Error en AlmacenHelper.getProductosStockBajo:", error);
      return [];
    }
  },
};

// Helper para Ventas
export const VentaHelper = {
  // Crear una nueva venta
  crearVenta: async (
    puntoId: number,
    totalVenta: number,
    tipoPago: "efectivo" | "transferencia" | "mixto",
    totalEfectivo?: number,
    totalTransferencia?: number,
    metodoTransferencia?: string,
  ): Promise<SQLiteRunResult> => {
    try {
      // Importar getFechaHoraLocalCompleta para consistencia de timezone
      const { getFechaHoraLocalCompleta } = await import("../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      return await executeNonQuery(
        `INSERT INTO Venta (
          punto_id, total_venta, tipo_pago, 
          total_efectivo, total_transferencia, metodo_transferencia, creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          puntoId,
          totalVenta,
          tipoPago,
          totalEfectivo || 0,
          totalTransferencia || 0,
          metodoTransferencia || null,
          ahora, // Usar fecha local en lugar de CURRENT_TIMESTAMP
        ],
      );
    } catch (error) {
      console.error("Error en VentaHelper.crearVenta:", error);
      throw error;
    }
  },

  // Agregar detalle de venta
  agregarDetalleVenta: async (
    ventaId: number,
    productoId: number,
    cantidad: number,
    precioUnitario: number,
    subtotal: number,
  ): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        "INSERT INTO DetalleVenta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)",
        [ventaId, productoId, cantidad, precioUnitario, subtotal],
      );
    } catch (error) {
      console.error("Error en VentaHelper.agregarDetalleVenta:", error);
      throw error;
    }
  },

  // Obtener ventas por rango de fechas - CON LÍMITE
  getVentasPorFecha: async (
    puntoId: number,
    fechaInicio: string,
    fechaFin: string,
    limit: number = 100,
  ): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT 
          v.*,
          COUNT(dv.id) as total_productos
         FROM Venta v
         LEFT JOIN DetalleVenta dv ON v.id = dv.venta_id
         WHERE v.punto_id = ? 
           AND DATE(v.creado_en) BETWEEN ? AND ?
         GROUP BY v.id
         ORDER BY v.creado_en DESC
         LIMIT ?`,
        [puntoId, fechaInicio, fechaFin, limit],
      );
    } catch (error) {
      console.error("Error en VentaHelper.getVentasPorFecha:", error);
      return [];
    }
  },

  // Obtener venta con detalles
  getVentaConDetalles: async (ventaId: number): Promise<any> => {
    try {
      const venta = await getFirst<any>("SELECT * FROM Venta WHERE id = ?", [
        ventaId,
      ]);

      if (!venta) return null;

      const detalles = await executeQuery<any>(
        `SELECT 
          dv.*,
          p.nombre as producto_nombre,
          p.categoria
         FROM DetalleVenta dv
         INNER JOIN Producto p ON dv.producto_id = p.id
         WHERE dv.venta_id = ?`,
        [ventaId],
      );

      return {
        ...venta,
        detalles,
      };
    } catch (error) {
      console.error("Error en VentaHelper.getVentaConDetalles:", error);
      return null;
    }
  },
};

// Helper para Préstamos/Deudas - OPTIMIZADO
export const PrestamoDeudaHelper = {
  // Verificar integridad de la base de datos
  verificarIntegridad: async (): Promise<{
    tablasExisten: boolean;
    registros: number;
    errores: string[];
  }> => {
    try {
      const errores: string[] = [];

      // Verificar que las tablas existan
      const existePrestamoDeuda =
        (await getSingleValue<number>(
          `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='PrestamoDeuda'`,
        )) || 0;

      const existePrestamoProductos =
        (await getSingleValue<number>(
          `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='PrestamoProductos'`,
        )) || 0;

      if (existePrestamoDeuda === 0) {
        errores.push("Tabla PrestamoDeuda no existe");
      }

      if (existePrestamoProductos === 0) {
        errores.push("Tabla PrestamoProductos no existe");
      }

      // Contar registros si las tablas existen
      let registros = 0;
      if (existePrestamoDeuda > 0) {
        const count = await getSingleValue<number>(
          "SELECT COUNT(*) FROM PrestamoDeuda",
        );
        registros = count || 0;
      }

      return {
        tablasExisten: existePrestamoDeuda > 0 && existePrestamoProductos > 0,
        registros,
        errores,
      };
    } catch (error) {
      console.error("Error en verificarIntegridad:", error);
      return {
        tablasExisten: false,
        registros: 0,
        errores: ["Error al verificar integridad"],
      };
    }
  },

  // Forzar sincronización de índices
  forzarSincronizacion: async (): Promise<void> => {
    try {
      console.log("🔄 Forzando sincronización de índices...");

      // Eliminar índices viejos si existen
      await executeNonQuery("DROP INDEX IF EXISTS idx_prestamo_estado");
      await executeNonQuery(
        "DROP INDEX IF EXISTS idx_prestamo_fecha_vencimiento",
      );
      await executeNonQuery("DROP INDEX IF EXISTS idx_prestamo_punto_id");
      await executeNonQuery("DROP INDEX IF EXISTS idx_prestamo_tipo");
      await executeNonQuery(
        "DROP INDEX IF EXISTS idx_prestamo_productos_prestamo_deuda_id",
      );
      await executeNonQuery(
        "DROP INDEX IF EXISTS idx_prestamo_productos_producto_id",
      );

      // Crear índices nuevos
      await executeNonQuery(
        "CREATE INDEX IF NOT EXISTS idx_prestamo_estado ON PrestamoDeuda(estado)",
      );
      await executeNonQuery(
        "CREATE INDEX IF NOT EXISTS idx_prestamo_fecha_vencimiento ON PrestamoDeuda(fecha_vencimiento)",
      );
      await executeNonQuery(
        "CREATE INDEX IF NOT EXISTS idx_prestamo_punto_id ON PrestamoDeuda(punto_id)",
      );
      await executeNonQuery(
        "CREATE INDEX IF NOT EXISTS idx_prestamo_tipo ON PrestamoDeuda(tipo)",
      );
      await executeNonQuery(
        "CREATE INDEX IF NOT EXISTS idx_prestamo_productos_prestamo_deuda_id ON PrestamoProductos(prestamo_deuda_id)",
      );
      await executeNonQuery(
        "CREATE INDEX IF NOT EXISTS idx_prestamo_productos_producto_id ON PrestamoProductos(producto_id)",
      );

      console.log("✅ Índices sincronizados correctamente");
    } catch (error) {
      console.error("Error en forzarSincronizacion:", error);
    }
  },

  // Obtener préstamos/deudas vencidas - CON LÍMITE
  getVencidos: async (limit: number = 50): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      return await executeQuery<any>(
        `SELECT *, 
           CASE 
             WHEN fecha_vencimiento < ? THEN -1 * (julianday(?) - julianday(fecha_vencimiento))
             ELSE 0 
           END as dias_restantes
         FROM PrestamoDeuda 
         WHERE estado IN ('pendiente', 'vencido') 
           AND fecha_vencimiento < ?
         ORDER BY fecha_vencimiento ASC
         LIMIT ?`,
        [hoy, hoy, hoy, limit],
      );
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.getVencidos:", error);
      return [];
    }
  },

  // Obtener préstamos/deudas próximos a vencer (7 días) - CON LÍMITE
  getProximosAVencer: async (dias = 7, limit: number = 50): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + dias);
      const fechaLimiteStr = fechaLimite.toISOString().split("T")[0];

      return await executeQuery<any>(
        `SELECT *, 
           (julianday(fecha_vencimiento) - julianday(?)) as dias_restantes
         FROM PrestamoDeuda 
         WHERE estado = 'pendiente'
           AND fecha_vencimiento >= ?
           AND fecha_vencimiento <= ?
         ORDER BY fecha_vencimiento ASC
         LIMIT ?`,
        [hoy, hoy, fechaLimiteStr, limit],
      );
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.getProximosAVencer:", error);
      return [];
    }
  },

  // Obtener total pendiente - OPTIMIZADA
  getTotalPendiente: async (): Promise<number> => {
    try {
      const result = await getSingleValue<number>(
        `SELECT COALESCE(SUM(monto), 0) as total 
         FROM PrestamoDeuda 
         WHERE estado IN ('pendiente', 'vencido')`,
      );
      return result || 0;
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.getTotalPendiente:", error);
      return 0;
    }
  },

  // Obtener todos los préstamos/deudas - CON LÍMITE
  getAll: async (limit: number = 100): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT * FROM PrestamoDeuda 
         ORDER BY fecha_vencimiento ASC
         LIMIT ?`,
        [limit],
      );
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.getAll:", error);
      return [];
    }
  },

  // Obtener todos los préstamos/deudas con información del punto - CON LÍMITE
  getAllWithPuntos: async (limit: number = 100): Promise<any[]> => {
    try {
      const hoy = getFechaLocal();
      return await executeQuery<any>(
        `SELECT 
          pd.*,
          p.nombre as punto_nombre,
          CASE 
            WHEN pd.punto_id IS NULL THEN 'General'
            ELSE p.nombre 
          END as origen,
          CASE 
            WHEN pd.estado = 'vencido' OR (pd.estado = 'pendiente' AND pd.fecha_vencimiento < ?) THEN 'vencido'
            ELSE pd.estado
          END as estado_actualizado
         FROM PrestamoDeuda pd
         LEFT JOIN Punto p ON pd.punto_id = p.id
         ORDER BY 
           CASE pd.estado 
             WHEN 'vencido' THEN 1
             WHEN 'pendiente' THEN 2
             WHEN 'pagado' THEN 3
           END,
           pd.fecha_vencimiento ASC
         LIMIT ?`,
        [hoy, limit],
      );
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.getAllWithPuntos:", error);
      return [];
    }
  },

  // Crear un nuevo préstamo/deuda
  create: async (
    tipo: "prestamo" | "deuda",
    descripcion: string,
    monto: number,
    fecha_inicio: string,
    fecha_vencimiento: string,
    punto_id: number | null = null,
    moneda: string = "CUP",
    notas?: string,
    producto_id?: number, // ID del producto original prestado
  ): Promise<SQLiteRunResult> => {
    try {
      const result = await executeNonQuery(
        `INSERT INTO PrestamoDeuda 
         (tipo, descripcion, monto, moneda, punto_id, producto_id, fecha_inicio, fecha_vencimiento, notas) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tipo,
          descripcion,
          monto,
          moneda,
          punto_id,
          producto_id || null,
          fecha_inicio,
          fecha_vencimiento,
          notas || null,
        ],
      );

      return result;
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.create:", error);
      throw error;
    }
  },

  // Crear préstamo con productos
  createPrestamoConProductos: async (
    tipo: "prestamo" | "deuda",
    descripcion: string,
    punto_id: number | null = null,
    fecha_inicio: string,
    fecha_vencimiento: string,
    notas?: string,
    productos?: { producto_id: number; cantidad: number }[],
  ): Promise<SQLiteRunResult> => {
    try {
      let montoTotal = 0;
      const productosInsertados: {
        producto_id: number;
        cantidad: number;
        precio_coste: number;
      }[] = [];

      // Calcular monto total basado en productos
      if (productos && productos.length > 0 && punto_id) {
        // Obtener todos los productos en una sola consulta
        const productoIds = productos.map((p) => p.producto_id);
        const productosInfo = await executeQuery<any>(
          `SELECT p.id, p.precio_coste, COALESCE(ap.cantidad, 0) as stock
           FROM Producto p
           LEFT JOIN AlmacenPunto ap ON p.id = ap.producto_id AND ap.punto_id = ?
           WHERE p.id IN (${productoIds.map(() => "?").join(",")})`,
          [punto_id, ...productoIds],
        );

        const productosMap = new Map(productosInfo.map((p: any) => [p.id, p]));

        for (const producto of productos) {
          const productoInfo = productosMap.get(producto.producto_id);

          if (!productoInfo) {
            throw new Error(
              `Producto con ID ${producto.producto_id} no encontrado`,
            );
          }

          if (productoInfo.stock < producto.cantidad) {
            throw new Error(
              `Stock insuficiente para producto ID ${producto.producto_id}`,
            );
          }

          const precioCosto = productoInfo.precio_coste;
          montoTotal += precioCosto * producto.cantidad;

          productosInsertados.push({
            producto_id: producto.producto_id,
            cantidad: producto.cantidad,
            precio_coste: precioCosto,
          });
        }
      }

      // Si no hay productos y el monto es 0, error
      if (montoTotal <= 0 && (!productos || productos.length === 0)) {
        throw new Error(
          "Debe especificar productos o un monto para el préstamo",
        );
      }

      // Iniciar transacción
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Insertar préstamo
        const result = await executeNonQuery(
          `INSERT INTO PrestamoDeuda 
           (tipo, descripcion, monto, moneda, punto_id, fecha_inicio, fecha_vencimiento, notas) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tipo,
            descripcion,
            montoTotal,
            "CUP",
            punto_id,
            fecha_inicio,
            fecha_vencimiento,
            notas || null,
          ],
        );

        const prestamoId = result.lastInsertRowId;

        // Si hay productos, descontarlos del inventario y registrar en PrestamoProductos
        if (productosInsertados.length > 0 && punto_id) {
          // Actualizar stock en una sola consulta por producto
          for (const prod of productosInsertados) {
            await executeNonQuery(
              `UPDATE AlmacenPunto 
               SET cantidad = cantidad - ? 
               WHERE producto_id = ? AND punto_id = ?`,
              [prod.cantidad, prod.producto_id, punto_id],
            );

            await executeNonQuery(
              `INSERT INTO PrestamoProductos 
               (prestamo_deuda_id, producto_id, cantidad, precio_unitario, subtotal)
               VALUES (?, ?, ?, ?, ?)`,
              [
                prestamoId,
                prod.producto_id,
                prod.cantidad,
                prod.precio_coste,
                prod.precio_coste * prod.cantidad,
              ],
            );
          }
        }

        await executeNonQuery("COMMIT");
        return result;
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error(
        "Error en PrestamoDeudaHelper.createPrestamoConProductos:",
        error,
      );
      throw error;
    }
  },

  // Actualizar préstamo/deuda completo
  update: async (
    id: number,
    tipo: "prestamo" | "deuda",
    descripcion: string,
    monto: number,
    fecha_inicio: string,
    fecha_vencimiento: string,
    punto_id: number | null = null,
    moneda: string = "CUP",
    notas?: string,
  ): Promise<SQLiteRunResult> => {
    try {
      const hoy = getFechaLocal();
      const result = await executeNonQuery(
        `UPDATE PrestamoDeuda 
         SET tipo = ?, descripcion = ?, monto = ?, moneda = ?, punto_id = ?, 
             fecha_inicio = ?, fecha_vencimiento = ?, notas = ?, 
             estado = CASE 
               WHEN fecha_vencimiento < ? AND estado = 'pendiente' THEN 'vencido'
               ELSE estado
             END,
             actualizado_en = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [
          tipo,
          descripcion,
          monto,
          moneda,
          punto_id,
          fecha_inicio,
          fecha_vencimiento,
          notas || null,
          hoy,
          id,
        ],
      );

      return result;
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.update:", error);
      throw error;
    }
  },

  // ACTUALIZAR PRÉSTAMO CON PRODUCTOS - FUNCIÓN FALTANTE
  updateConProductos: async (
    id: number,
    tipo: "prestamo" | "deuda",
    descripcion: string,
    monto: number,
    fecha_inicio: string,
    fecha_vencimiento: string,
    punto_id: number | null = null,
    moneda: string = "CUP",
    notas?: string,
    productos?: { producto_id: number; cantidad: number }[],
  ): Promise<SQLiteRunResult> => {
    try {
      const hoy = getFechaLocal();

      // Iniciar transacción
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 1. Actualizar préstamo básico
        const result = await executeNonQuery(
          `UPDATE PrestamoDeuda 
           SET tipo = ?, descripcion = ?, monto = ?, moneda = ?, punto_id = ?, 
               fecha_inicio = ?, fecha_vencimiento = ?, notas = ?, 
               estado = CASE 
                 WHEN fecha_vencimiento < ? AND estado = 'pendiente' THEN 'vencido'
                 ELSE estado
               END,
               actualizado_en = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [
            tipo,
            descripcion,
            monto,
            moneda,
            punto_id,
            fecha_inicio,
            fecha_vencimiento,
            notas || null,
            hoy,
            id,
          ],
        );

        // 2. Manejar productos solo si hay punto_id
        if (punto_id) {
          // Obtener productos actuales para restaurar stock
          const productosActuales = await executeQuery<any>(
            "SELECT producto_id, cantidad FROM PrestamoProductos WHERE prestamo_deuda_id = ?",
            [id],
          );

          // Restaurar stock de productos actuales
          for (const prod of productosActuales) {
            await executeNonQuery(
              `UPDATE AlmacenPunto 
               SET cantidad = cantidad + ? 
               WHERE producto_id = ? AND punto_id = ?`,
              [prod.cantidad, prod.producto_id, punto_id],
            );
          }

          // Eliminar registros actuales de PrestamoProductos
          await executeNonQuery(
            "DELETE FROM PrestamoProductos WHERE prestamo_deuda_id = ?",
            [id],
          );

          // Agregar nuevos productos si existen
          if (productos && productos.length > 0) {
            for (const producto of productos) {
              // Verificar stock
              const stockInfo = await getFirst<any>(
                `SELECT COALESCE(ap.cantidad, 0) as stock, p.precio_coste
                 FROM Producto p
                 LEFT JOIN AlmacenPunto ap ON p.id = ap.producto_id AND ap.punto_id = ?
                 WHERE p.id = ?`,
                [punto_id, producto.producto_id],
              );

              if (!stockInfo || stockInfo.stock < producto.cantidad) {
                throw new Error(
                  `Stock insuficiente para producto ID ${producto.producto_id}`,
                );
              }

              // Descontar del inventario
              await executeNonQuery(
                `UPDATE AlmacenPunto 
                 SET cantidad = cantidad - ? 
                 WHERE producto_id = ? AND punto_id = ?`,
                [producto.cantidad, producto.producto_id, punto_id],
              );

              // Insertar en PrestamoProductos
              await executeNonQuery(
                `INSERT INTO PrestamoProductos 
                 (prestamo_deuda_id, producto_id, cantidad, precio_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  id,
                  producto.producto_id,
                  producto.cantidad,
                  stockInfo.precio_coste,
                  stockInfo.precio_coste * producto.cantidad,
                ],
              );
            }
          }
        }

        await executeNonQuery("COMMIT");
        return result;
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en PrestamoDeudaHelper.updateConProductos:", error);
      throw error;
    }
  },

  // Actualizar estado a pagado
  marcarComoPagado: async (id: number): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        'UPDATE PrestamoDeuda SET estado = "pagado", actualizado_en = CURRENT_TIMESTAMP WHERE id = ?',
        [id],
      );
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.marcarComoPagado:", error);
      throw error;
    }
  },

  // Eliminar préstamo/deuda
  delete: async (id: number): Promise<SQLiteRunResult> => {
    try {
      // Obtener información del préstamo para restaurar stock si es necesario
      const prestamo = await getFirst<any>(
        "SELECT punto_id FROM PrestamoDeuda WHERE id = ?",
        [id],
      );

      if (prestamo && prestamo.punto_id) {
        // Obtener productos asociados
        const productos = await executeQuery<any>(
          "SELECT producto_id, cantidad FROM PrestamoProductos WHERE prestamo_deuda_id = ?",
          [id],
        );

        // Restaurar stock
        for (const prod of productos) {
          await executeNonQuery(
            `UPDATE AlmacenPunto 
             SET cantidad = cantidad + ? 
             WHERE producto_id = ? AND punto_id = ?`,
            [prod.cantidad, prod.producto_id, prestamo.punto_id],
          );
        }
      }

      // Eliminar productos asociados
      await executeNonQuery(
        "DELETE FROM PrestamoProductos WHERE prestamo_deuda_id = ?",
        [id],
      );

      // Eliminar el préstamo
      return await executeNonQuery("DELETE FROM PrestamoDeuda WHERE id = ?", [
        id,
      ]);
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.delete:", error);
      throw error;
    }
  },

  // Obtener productos disponibles en un punto específico - CON LÍMITE
  getProductosPorPunto: async (
    puntoId: number,
    limit: number = 100,
  ): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT 
          p.id,
          p.nombre,
          p.categoria,
          p.subcategoria,
          p.precio_coste,
          COALESCE(ap.cantidad, 0) as stock_disponible,
          ap.precio_venta
         FROM Producto p
         INNER JOIN AlmacenPunto ap ON p.id = ap.producto_id
         WHERE ap.punto_id = ?
           AND ap.cantidad > 0
         ORDER BY p.nombre
         LIMIT ?`,
        [puntoId, limit],
      );
    } catch (error) {
      console.error(
        "Error en PrestamoDeudaHelper.getProductosPorPunto:",
        error,
      );
      return [];
    }
  },

  // Obtener productos de un préstamo específico - CON LÍMITE
  getProductosPrestamo: async (
    prestamoId: number,
    limit: number = 50,
  ): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT 
          pp.*,
          p.nombre as producto_nombre,
          p.categoria,
          p.subcategoria
         FROM PrestamoProductos pp
         INNER JOIN Producto p ON pp.producto_id = p.id
         WHERE pp.prestamo_deuda_id = ?
         LIMIT ?`,
        [prestamoId, limit],
      );
    } catch (error) {
      console.error(
        "Error en PrestamoDeudaHelper.getProductosPrestamo:",
        error,
      );
      return [];
    }
  },

  // Buscar por descripción - CON LÍMITE
  search: async (query: string, limit: number = 50): Promise<any[]> => {
    try {
      return await executeQuery<any>(
        `SELECT pd.*, p.nombre as punto_nombre 
         FROM PrestamoDeuda pd
         LEFT JOIN Punto p ON pd.punto_id = p.id
         WHERE pd.descripcion LIKE ? 
         ORDER BY pd.fecha_vencimiento ASC
         LIMIT ?`,
        [`%${query}%`, limit],
      );
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.search:", error);
      return [];
    }
  },

  // Obtener estadísticas generales - OPTIMIZADA
  getEstadisticas: async (): Promise<{
    total_prestamos: number;
    total_deudas: number;
    total_pendiente: number;
    total_pagado: number;
    prestamos_vencidos: number;
    deudas_vencidas: number;
    total_registros: number;
  }> => {
    try {
      const hoy = getFechaLocal();
      const resultado = await getFirst<any>(
        `
        SELECT 
          COUNT(CASE WHEN tipo = 'prestamo' THEN 1 END) as total_prestamos,
          COUNT(CASE WHEN tipo = 'deuda' THEN 1 END) as total_deudas,
          COALESCE(SUM(CASE WHEN estado IN ('pendiente', 'vencido') THEN monto ELSE 0 END), 0) as total_pendiente,
          COALESCE(SUM(CASE WHEN estado = 'pagado' THEN monto ELSE 0 END), 0) as total_pagado,
          COUNT(CASE WHEN tipo = 'prestamo' AND (estado = 'vencido' OR (estado = 'pendiente' AND fecha_vencimiento < ?)) THEN 1 END) as prestamos_vencidos,
          COUNT(CASE WHEN tipo = 'deuda' AND (estado = 'vencido' OR (estado = 'pendiente' AND fecha_vencimiento < ?)) THEN 1 END) as deudas_vencidas,
          COUNT(*) as total_registros
        FROM PrestamoDeuda
      `,
        [hoy, hoy],
      );

      return (
        resultado || {
          total_prestamos: 0,
          total_deudas: 0,
          total_pendiente: 0,
          total_pagado: 0,
          prestamos_vencidos: 0,
          deudas_vencidas: 0,
          total_registros: 0,
        }
      );
    } catch (error) {
      console.error("Error en PrestamoDeudaHelper.getEstadisticas:", error);
      return {
        total_prestamos: 0,
        total_deudas: 0,
        total_pendiente: 0,
        total_pagado: 0,
        prestamos_vencidos: 0,
        deudas_vencidas: 0,
        total_registros: 0,
      };
    }
  },

  // Crear tabla para productos prestados si no existe
  createProductosPrestamoTable: async (): Promise<void> => {
    try {
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS PrestamoProductos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prestamo_deuda_id INTEGER NOT NULL,
          producto_id INTEGER NOT NULL,
          cantidad INTEGER NOT NULL,
          precio_unitario REAL NOT NULL,
          subtotal REAL NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (prestamo_deuda_id) REFERENCES PrestamoDeuda(id) ON DELETE CASCADE,
          FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
        )
      `);
      console.log("✅ Tabla PrestamoProductos creada/verificada");
    } catch (error) {
      console.error("❌ Error creando tabla PrestamoProductos:", error);
    }
  },
};

// Función para verificar estado de la base de datos
export const checkDatabaseStatus = async (): Promise<boolean> => {
  try {
    const result = await getSingleValue<number>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='Configuracion'",
    );
    return (result || 0) > 0;
  } catch (error) {
    console.error("❌ Error verificando estado de BD:", error);
    return false;
  }
};
