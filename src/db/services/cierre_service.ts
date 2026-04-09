// src/db/services/cierre_service.ts
import { getFechaLocal } from "../../utils/dateUtils";
import {
    db,
    executeNonQuery,
    executeQuery,
    getFirst,
    getSingleValue,
} from "../database";
import {
    CambioPrecioConInfo,
    CambioPrecioService,
} from "./cambio_precio_service";

export type { CambioPrecioConInfo };

export interface CierreCaja {
  id: number;
  punto_id: number;
  tipo: string; // 'apertura' o 'cierre'
  fondo_caja: number;
  total_ventas: number;
  total_efectivo: number;
  total_transferencia: number;
  total_gastos: number;
  total_ganancias: number;
  total_extraido: number;
  total_perdidas: number;
  perdidas_inventario: number; // Pérdidas por diferencias de inventario
  observaciones?: string;
  fecha_cierre: string;
  creado_en: string;
  // Campos calculados dinámicamente
  deuda_pendiente?: number;
  deuda_pagada?: number;
  productos_correctos?: number;
  productos_incorrectos?: number;
  total_productos?: number;
  // Desglose de gastos
  gastos_generales?: number;
  gastos_salarios?: number;
  gastos_totales?: number;
}

export interface CierreCajaProducto {
  id: number;
  cierre_id: number;
  producto_id: number;
  cantidad_sistema: number;
  cantidad_fisica: number;
  diferencia: number;
  precio_unitario: number;
  total_diferencia: number;
  creado_en: string;
}

export interface ProductoInventario {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  cantidad_sistema: number;
  cantidad_fisica?: number;
  precio_venta?: number;
}

export interface ResumenCierre {
  total_ventas: number;
  total_efectivo: number;
  total_transferencia: number;
  total_gastos: number;
  total_ganancias: number;
  deuda_pendiente: number;
  deuda_pagada: number;
  total_extraido: number;
  productos_correctos: number;
  productos_incorrectos: number;
  total_perdidas: number;
  perdidas_inventario: number; // Pérdidas por diferencias de inventario
  productos_baja: ProductoBaja[];
  cambios_precios: CambioPrecioConInfo[];
  prestamos_dia: PrestamoDia[];
  total_prestamos: number;
}

export interface ProductoBaja {
  id: number;
  nombre: string;
  categoria: string;
  cantidad: number;
  precio_coste: number;
  total_perdida: number;
}

export interface PrestamoDia {
  id: number;
  descripcion: string;
  monto: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  notas?: string;
  estado: "pendiente" | "pagado";
}

export const CierreService = {
  // Crear apertura de caja
  async crearApertura(
    puntoId: number,
    fondoCaja: number,
    observaciones?: string,
    trabajadorId?: number,
  ): Promise<{ success: boolean; message: string; aperturaId?: number }> {
    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Eliminar apertura anterior del mismo día si existe (suplantación)
        const hoy = getFechaLocal();
        // Eliminar productos de aperturas anteriores
        // 1. Eliminar productos asociados a aperturas de hoy
        await db.runAsync(
          `
  DELETE FROM CierreCajaProducto
  WHERE cierre_id IN (
    SELECT id FROM CierreCaja 
    WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ?
  )
`,
          [puntoId, hoy],
        );

        // 2. Ahora sí eliminar la apertura
        await db.runAsync(
          `DELETE FROM CierreCaja 
   WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ?`,
          [puntoId, hoy],
        );

        console.log("🗑️ DEBUG: Apertura anterior eliminada para suplantación");

        const result = await db.runAsync(
          `
          INSERT INTO CierreCaja (
            punto_id, tipo, fondo_caja, total_ventas, total_efectivo, 
            total_transferencia, total_gastos, total_ganancias, total_extraido, 
            perdidas_inventario, total_perdidas, trabajador_id, 
            observaciones, fecha_cierre, creado_en
          ) VALUES (?, 'apertura', ?, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?)
        `,
          [
            puntoId,
            fondoCaja,
            trabajadorId || null,
            observaciones || null,
            getFechaLocal() +
              " " +
              new Date().toLocaleTimeString("es-CU", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }), // fecha_cierre con fecha y hora local
            getFechaLocal() +
              " " +
              new Date().toLocaleTimeString("es-CU", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }), // creado_en con fecha y hora local
          ],
        );

        const aperturaId = result.lastInsertRowId;
        // 🔥 SNAPSHOT DE INVENTARIO EN APERTURA
        const productos = await executeQuery<{
          producto_id: number;
          cantidad: number;
          precio_venta: number;
        }>(
          `
  SELECT 
    producto_id,
    cantidad,
    precio_venta
  FROM AlmacenZona
  WHERE punto_id = ?
  AND zona_id = 1
`,
          [puntoId],
        );

        console.log("📦 SNAPSHOT APERTURA PRODUCTOS:", productos);

        // Insertar snapshot
        for (const prod of productos) {
          await db.runAsync(
            `
    INSERT INTO CierreCajaProducto (
      cierre_id,
      producto_id,
      cantidad_sistema,
      cantidad_fisica,
      diferencia,
      precio_unitario,
      total_diferencia
    ) VALUES (?, ?, ?, ?, 0, ?, 0)
    `,
            [
              aperturaId,
              prod.producto_id,
              prod.cantidad,
              prod.cantidad, // física = sistema en apertura
              prod.precio_venta || 0,
            ],
          );
        }
        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: "Apertura realizada correctamente",
          aperturaId,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error creando apertura:", error);
      return {
        success: false,
        message: "Error al realizar apertura: " + error,
      };
    }
  },

  // Verificar si ya existe una apertura hoy
  async existeAperturaHoy(puntoId: number): Promise<boolean> {
    try {
      const hoy = getFechaLocal();
      const resultado = await getFirst<any>(
        "SELECT id FROM CierreCaja WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ?",
        [puntoId, hoy],
      );
      return resultado !== undefined;
    } catch (error) {
      console.error("Error verificando apertura de hoy:", error);
      return false;
    }
  },

  // Obtener apertura del día de hoy
  async getAperturaHoy(puntoId: number): Promise<CierreCaja | null> {
    try {
      const hoy = getFechaLocal();
      return await getFirst<CierreCaja>(
        "SELECT * FROM CierreCaja WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ?",
        [puntoId, hoy],
      );
    } catch {
      return null;
    }
  },

  // Obtener trabajador seleccionado en la apertura del día
  async getTrabajadorAperturaHoy(puntoId: number): Promise<number | null> {
    try {
      const hoy = getFechaLocal();
      const resultado = await getFirst<{ trabajador_id: number }>(
        "SELECT trabajador_id FROM CierreCaja WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ? AND trabajador_id IS NOT NULL",
        [puntoId, hoy],
      );
      return resultado?.trabajador_id || null;
    } catch {
      return null;
    }
  },

  // Obtener dinero extraído del día actual
  async getDineroExtraidoHoy(puntoId: number): Promise<number> {
    try {
      const hoy = getFechaLocal();
      const resultado = await getFirst<any>(
        "SELECT COALESCE(SUM(total_extraido), 0) as total_extraido FROM CierreCaja WHERE punto_id = ? AND DATE(fecha_cierre) = ?",
        [puntoId, hoy],
      );
      return resultado?.total_extraido || 0;
    } catch (error) {
      console.error("Error obteniendo dinero extraído de hoy:", error);
      return 0;
    }
  },

  // Obtener préstamos del día para un punto
  async getPrestamosDia(puntoId: number): Promise<PrestamoDia[]> {
    try {
      const hoy = getFechaLocal();
      const query = `
        SELECT 
          id,
          descripcion,
          monto,
          fecha_inicio,
          fecha_vencimiento,
          notas,
          estado
        FROM PrestamoDeuda 
        WHERE punto_id = ? AND tipo = 'prestamo' AND DATE(fecha_inicio) = ?
        ORDER BY fecha_inicio DESC
      `;
      const prestamos = await executeQuery<PrestamoDia>(query, [puntoId, hoy]);
      return prestamos;
    } catch (error) {
      console.error("Error obteniendo préstamos del día:", error);
      return [];
    }
  },

  // Obtener productos dados de baja (zona 2) para el cierre - solo del día actual
  async getProductosDadosDeBaja(puntoId: number): Promise<ProductoBaja[]> {
    try {
      const hoy = getFechaLocal();
      const query = `
        SELECT 
          p.id,
          p.nombre,
          p.categoria,
          az.cantidad,
          p.precio_coste,
          (az.cantidad * p.precio_coste) as total_perdida,
          az.actualizado_en
        FROM AlmacenZona az
        JOIN Producto p ON az.producto_id = p.id
        WHERE az.punto_id = ? AND az.zona_id = 2 AND az.cantidad > 0 
          AND DATE(az.actualizado_en) = ?
        ORDER BY p.nombre
      `;
      const productosBaja = await executeQuery<ProductoBaja>(query, [
        puntoId,
        hoy,
      ]);
      console.log(
        "🔍 DEBUG: Productos dados de baja encontrados (hoy):",
        productosBaja.length,
        productosBaja,
      );
      return productosBaja;
    } catch (error) {
      console.error("Error obteniendo productos dados de baja:", error);
      return [];
    }
  },

  // Obtener productos del sistema para un punto
  async getProductosParaCierre(puntoId: number): Promise<ProductoInventario[]> {
    try {
      const query = `
        SELECT 
          p.id,
          p.nombre,
          p.categoria,
          p.subcategoria,
          p.precio_coste,
          COALESCE(az.cantidad, 0) as cantidad_sistema,
          az.precio_venta
        FROM Producto p
        LEFT JOIN AlmacenZona az ON p.id = az.producto_id 
          AND az.punto_id = ? AND az.zona_id = 1
        WHERE COALESCE(az.cantidad, 0) > 0
        ORDER BY p.nombre
      `;

      return await executeQuery<ProductoInventario>(query, [puntoId]);
    } catch (error) {
      console.error("Error obteniendo productos para cierre:", error);
      return [];
    }
  },

  // Verificar si ya existe un cierre para el día de hoy
  async existeCierreHoy(puntoId: number): Promise<boolean> {
    try {
      const hoy = getFechaLocal();
      const resultado = await getFirst<any>(
        "SELECT id FROM CierreCaja WHERE punto_id = ? AND tipo = 'cierre' AND DATE(fecha_cierre) = ?",
        [puntoId, hoy],
      );
      return resultado !== undefined;
    } catch (error) {
      console.error("Error verificando cierre de hoy:", error);
      return false;
    }
  },

  // Obtener cierre del día de hoy
  async getCierreHoy(puntoId: number): Promise<CierreCaja | null> {
    try {
      const hoy = getFechaLocal();
      return await getFirst<CierreCaja>(
        "SELECT * FROM CierreCaja WHERE punto_id = ? AND tipo = 'cierre' AND DATE(fecha_cierre) = ?",
        [puntoId, hoy],
      );
    } catch {
      return null;
    }
  },

  // Obtener cierres de un punto
  async getCierresPorPunto(puntoId: number): Promise<CierreCaja[]> {
    try {
      return await executeQuery<CierreCaja>(
        "SELECT * FROM CierreCaja WHERE punto_id = ? ORDER BY fecha_cierre DESC",
        [puntoId],
      );
    } catch (error) {
      console.error("Error obteniendo cierres:", error);
      return [];
    }
  },

  // Obtener detalle de productos de un cierre
  async getProductosCierre(cierreId: number): Promise<CierreCajaProducto[]> {
    try {
      const query = `
        SELECT 
          ccp.*,
          p.nombre,
          p.categoria
        FROM CierreCajaProducto ccp
        JOIN Producto p ON ccp.producto_id = p.id
        WHERE ccp.cierre_id = ?
        ORDER BY p.nombre
      `;

      return await executeQuery<CierreCajaProducto>(query, [cierreId]);
    } catch (error) {
      console.error("Error obteniendo productos del cierre:", error);
      return [];
    }
  },

  // Obtener historial de cierres de un punto con paginación
  async obtenerHistorialCierres(
    puntoId: number,
    pagina: number = 0,
    limite: number = 10,
  ) {
    try {
      const offset = pagina * limite;
      const cierres = await db.getAllAsync(
        `
        SELECT 
          cc.*,
          COUNT(ccp.id) as total_productos
        FROM CierreCaja cc
        LEFT JOIN CierreCajaProducto ccp ON cc.id = ccp.cierre_id
        WHERE cc.punto_id = ? AND cc.tipo = 'cierre'
        GROUP BY cc.id
        ORDER BY cc.fecha_cierre DESC
        LIMIT ? OFFSET ?
      `,
        [puntoId, limite, offset],
      );

      // Para cada cierre, calcular los campos adicionales
      const cierresConDatos = await Promise.all(
        cierres.map(async (cierre: any) => {
          const fechaCierre = cierre.fecha_cierre.split("T")[0]; // Obtener solo la fecha

          // Calcular deudas pendientes del día
          const deudaPendiente = await getSingleValue(
            `SELECT COALESCE(SUM(monto), 0) 
             FROM PrestamoDeuda 
             WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pendiente' AND DATE(fecha_inicio) = ?`,
            [puntoId, fechaCierre],
          );

          // Calcular deudas pagadas del día
          const deudaPagada = await getSingleValue(
            `SELECT COALESCE(SUM(monto), 0) 
             FROM PrestamoDeuda 
             WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pagado' AND DATE(actualizado_en) = ?`,
            [puntoId, fechaCierre],
          );

          // Calcular productos correctos e incorrectos del cierre
          const productosCorrectos = await getSingleValue(
            `SELECT COUNT(*) 
             FROM CierreCajaProducto 
             WHERE cierre_id = ? AND diferencia = 0`,
            [cierre.id],
          );

          const productosIncorrectos = await getSingleValue(
            `SELECT COUNT(*) 
             FROM CierreCajaProducto 
             WHERE cierre_id = ? AND diferencia != 0`,
            [cierre.id],
          );

          // Calcular pérdidas por inventario del día
          const perdidasInventario = await getSingleValue(
            `SELECT COALESCE(SUM(total_diferencia), 0) 
             FROM CierreCajaProducto 
             WHERE cierre_id = ? AND diferencia < 0`,
            [cierre.id],
          );

          // Calcular pérdidas por bajas de productos del día
          const perdidasPorBaja = await getSingleValue(
            `SELECT COALESCE(SUM(az.cantidad * p.precio_coste), 0) 
             FROM AlmacenZona az
             JOIN Producto p ON az.producto_id = p.id
             WHERE az.punto_id = ? AND az.zona_id = 2 AND az.cantidad > 0 
               AND DATE(az.actualizado_en) = ?`,
            [puntoId, fechaCierre],
          );

          const totalPerdidas =
            (perdidasInventario || 0) + (perdidasPorBaja || 0);

          // Calcular desglose de gastos (salarios vs generales) para el día del cierre
          const gastosPeriodo = await executeQuery<any>(
            `SELECT * FROM Gastos 
             WHERE punto_id = ? AND activo = 1
             AND (categoria = 'General' AND DATE(fecha_gasto) = DATE(?)) OR (categoria = 'Salario' AND punto_id = ? AND activo = 1)
             ORDER BY fecha_gasto DESC, creado_en DESC`,
            [puntoId, fechaCierre, puntoId],
          );

          let gastosGenerales = 0;
          let gastosSalarios = 0;

          for (const gasto of gastosPeriodo) {
            if (gasto.categoria === "General") {
              gastosGenerales += Math.abs(gasto.precio || 0);
            } else if (gasto.categoria === "Salario") {
              const esPorcentaje =
                gasto.es_porcentaje === 1 ||
                (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);

              if (esPorcentaje) {
                const montoReal = await getSingleValue(
                  `SELECT COALESCE(SUM(v.total_venta), 0)
                   FROM Venta v
                   WHERE v.punto_id = ? AND DATE(v.creado_en) = ?`,
                  [puntoId, fechaCierre],
                );

                const salarioTeorico =
                  (montoReal * (gasto.porcentaje || 0)) / 100;
                gastosSalarios += salarioTeorico;
              } else {
                gastosSalarios += gasto.precio || 0;
              }
            }
          }

          const gastosTotales = gastosGenerales + gastosSalarios;

          return {
            ...cierre,
            deuda_pendiente: deudaPendiente || 0,
            deuda_pagada: deudaPagada || 0,
            productos_correctos: productosCorrectos || 0,
            productos_incorrectos: productosIncorrectos || 0,
            total_perdidas: totalPerdidas || 0,
            perdidas_inventario: perdidasInventario || 0,
            // Agregar desglose de gastos
            gastos_generales: gastosGenerales,
            gastos_salarios: gastosSalarios,
            gastos_totales: gastosTotales,
          };
        }),
      );

      return cierresConDatos;
    } catch (error) {
      console.error("Error obteniendo historial de cierres:", error);
      return [];
    }
  },

  // Obtener conteo total de cierres para paginación
  async obtenerTotalCierres(puntoId: number): Promise<number> {
    try {
      const resultado = await getSingleValue(
        `SELECT COUNT(*) as total 
         FROM CierreCaja 
         WHERE punto_id = ? AND tipo = 'cierre'`,
        [puntoId],
      );
      return resultado || 0;
    } catch (error) {
      console.error("Error obteniendo total de cierres:", error);
      return 0;
    }
  },

  // Obtener conteo total de aperturas para paginación
  async obtenerTotalAperturas(puntoId: number): Promise<number> {
    try {
      const resultado = await getSingleValue(
        `SELECT COUNT(*) as total 
         FROM CierreCaja 
         WHERE punto_id = ? AND tipo = 'apertura'`,
        [puntoId],
      );
      return resultado || 0;
    } catch (error) {
      console.error("Error obteniendo total de aperturas:", error);
      return 0;
    }
  },

  // Obtener historial de aperturas de un punto con paginación
  async obtenerHistorialAperturas(
    puntoId: number,
    pagina: number = 0,
    limite: number = 10,
  ) {
    try {
      const offset = pagina * limite;
      const aperturas = await db.getAllAsync(
        `
        SELECT
          ac.*,
          g.nombre as trabajador_nombre
        FROM CierreCaja ac
        LEFT JOIN Gastos g ON ac.trabajador_id = g.id AND g.categoria = 'Salario'
        WHERE ac.punto_id = ? AND ac.tipo = 'apertura'
        ORDER BY ac.fecha_cierre DESC
        LIMIT ? OFFSET ?
      `,
        [puntoId, limite, offset],
      );

      return aperturas;
    } catch (error) {
      console.error("Error obteniendo historial de aperturas:", error);
      return [];
    }
  },

  // Obtener cambios de precios de un cierre específico
  async obtenerCambiosPrecioDeCierre(
    cierreId: number,
  ): Promise<CambioPrecioConInfo[]> {
    try {
      const cambios = await db.getAllAsync<CambioPrecioConInfo>(
        `
        SELECT 
          ccp.*,
          p.nombre as nombre_producto,
          p.categoria as categoria_producto
        FROM CierreCajaCambioPrecio ccp
        JOIN Producto p ON ccp.producto_id = p.id
        WHERE ccp.cierre_id = ?
        ORDER BY ccp.creado_en ASC
      `,
        [cierreId],
      );

      return cambios;
    } catch (error) {
      console.error("Error obteniendo cambios de precios del cierre:", error);
      return [];
    }
  },

  // Crear un nuevo cierre
  async crearCierre(
    puntoId: number,
    productos: ProductoInventario[],
    montoExtraido: number = 0,
    observaciones?: string,
  ): Promise<{
    success: boolean;
    message: string;
    cierreId?: number;
    resumen?: ResumenCierre;
  }> {
    try {
      // Calcular totales
      const resumen = await this.calcularResumen(
        puntoId,
        productos,
        montoExtraido,
      );

      console.log("🔍 DEBUG: Creando cierre - Resumen calculado:", resumen);

      // Calcular valores adicionales para el cierre
      const ahora = new Date().toISOString(); // Fecha y hora completa
      const hoy = ahora.split("T")[0]; // Solo la fecha para consultas

      // Obtener fondo de caja de la apertura del día
      const aperturaHoy = await getFirst<any>(
        `SELECT fondo_caja FROM CierreCaja 
         WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ?
         ORDER BY fecha_cierre DESC LIMIT 1`,
        [puntoId, hoy],
      );

      const fondoCajaDia = aperturaHoy?.fondo_caja || 0;

      // Obtener gastos del día usando la misma lógica que la pantalla
      const gastosPeriodo = await executeQuery<any>(
        `SELECT * FROM Gastos 
         WHERE punto_id = ? AND activo = 1
         AND (categoria = 'General' AND DATE(fecha_gasto) = DATE('now')) OR (categoria = 'Salario' AND punto_id = ? AND activo = 1)
         ORDER BY fecha_gasto DESC, creado_en DESC`,
        [puntoId, puntoId],
      );

      let gastosDia = 0;
      console.log(
        "🔍 DEBUG: Procesando gastos del día para cierre - Total gastos encontrados:",
        gastosPeriodo.length,
      );
      for (const gasto of gastosPeriodo) {
        console.log("🔍 DEBUG: Procesando gasto:", gasto);
        if (gasto.categoria === "General") {
          const montoGeneral = Math.abs(gasto.precio || 0);
          gastosDia += montoGeneral;
          console.log(
            "🔍 DEBUG: Gasto general añadido:",
            montoGeneral,
            "Total acumulado:",
            gastosDia,
          );
        } else if (gasto.categoria === "Salario") {
          const esPorcentaje =
            gasto.es_porcentaje === 1 ||
            (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);

          if (esPorcentaje) {
            const montoReal = await getSingleValue(
              `SELECT COALESCE(SUM(v.total_venta), 0)
               FROM Venta v
               WHERE v.punto_id = ? AND DATE(v.creado_en) = ?`,
              [puntoId, hoy],
            );

            const salarioTeorico = (montoReal * (gasto.porcentaje || 0)) / 100;
            gastosDia += salarioTeorico;
            console.log(
              "🔍 DEBUG: Salario porcentual - ventas:",
              montoReal,
              "porcentaje:",
              gasto.porcentaje,
              "salario:",
              salarioTeorico,
            );
          } else {
            const montoFijo = gasto.precio || 0;
            gastosDia += montoFijo;
            console.log("🔍 DEBUG: Salario fijo añadido:", montoFijo);
          }
        }
      }
      console.log("🔍 DEBUG: Total gastos del día calculado:", gastosDia);

      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Eliminar cierre anterior del mismo día si existe (suplantación)
        const cierreAnterior = await getFirst<any>(
          `SELECT id FROM CierreCaja WHERE punto_id = ? AND tipo = 'cierre' AND DATE(fecha_cierre) = ?`,
          [puntoId, hoy],
        );

        if (cierreAnterior) {
          // Eliminar productos del cierre anterior
          await db.runAsync(
            `DELETE FROM CierreCajaProducto WHERE cierre_id = ?`,
            [cierreAnterior.id],
          );

          // Eliminar cambios de precios del cierre anterior
          await db.runAsync(
            `DELETE FROM CierreCajaCambioPrecio WHERE cierre_id = ?`,
            [cierreAnterior.id],
          );

          // Eliminar el cierre anterior
          await db.runAsync(`DELETE FROM CierreCaja WHERE id = ?`, [
            cierreAnterior.id,
          ]);

          console.log(
            "🗑️ DEBUG: Cierre anterior eliminado completamente para suplantación",
          );
        }

        console.log("💾 DEBUG: Guardando cierre con valores:");
        console.log("  - fondo_caja:", fondoCajaDia);
        console.log("  - total_gastos:", gastosDia);
        console.log("  - total_ventas:", resumen.total_ventas);

        // Insertar cierre principal
        const result = await db.runAsync(
          `
          INSERT INTO CierreCaja (
            punto_id, tipo, fondo_caja, fecha_cierre, total_ventas, total_efectivo, total_transferencia,
            total_gastos, total_ganancias, total_extraido, total_perdidas, perdidas_inventario, observaciones
          ) VALUES (?, 'cierre', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            puntoId,
            fondoCajaDia, // fondo_caja - usar el valor real de la apertura del día
            ahora, // fecha_cierre - usar fecha y hora completas
            resumen.total_ventas,
            resumen.total_efectivo,
            resumen.total_transferencia,
            gastosDia, // total_gastos - usar el cálculo real
            resumen.total_ganancias,
            resumen.total_extraido,
            resumen.total_perdidas,
            resumen.perdidas_inventario,
            observaciones || null,
          ],
        );

        const cierreId = result.lastInsertRowId;

        // Insertar productos del cierre
        for (const producto of productos) {
          const cantidadFisica = producto.cantidad_fisica || 0;
          const diferencia = cantidadFisica - producto.cantidad_sistema;
          const totalDiferencia =
            Math.abs(diferencia) *
            (producto.precio_venta || producto.precio_coste);

          await db.runAsync(
            `
            INSERT INTO CierreCajaProducto (
              cierre_id, producto_id, cantidad_sistema, cantidad_fisica,
              diferencia, precio_unitario, total_diferencia
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            [
              cierreId,
              producto.id,
              producto.cantidad_sistema,
              cantidadFisica,
              diferencia,
              producto.precio_venta || producto.precio_coste,
              totalDiferencia,
            ],
          );
        }

        // Insertar cambios de precios del cierre
        if (resumen.cambios_precios && resumen.cambios_precios.length > 0) {
          for (const cambio of resumen.cambios_precios) {
            await db.runAsync(
              `
              INSERT INTO CierreCajaCambioPrecio (
                cierre_id, producto_id, precio_anterior, precio_nuevo, 
                diferencia, creado_en
              ) VALUES (?, ?, ?, ?, ?, ?)
            `,
              [
                cierreId,
                cambio.producto_id,
                cambio.precio_anterior,
                cambio.precio_nuevo,
                cambio.diferencia,
                cambio.creado_en,
              ],
            );
          }
        }

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: "Cierre realizado correctamente",
          cierreId,
          resumen,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error creando cierre:", error);
      return {
        success: false,
        message: "Error al realizar el cierre: " + error,
      };
    }
  },

  // Calcular resumen del cierre
  async calcularResumen(
    puntoId: number,
    productos: ProductoInventario[],
    montoExtraido: number = 0,
  ): Promise<ResumenCierre> {
    console.log(
      "🔍 DEBUG: calcularResumen llamado con puntoId:",
      puntoId,
      "productos:",
      productos.length,
    );

    // Ya no verificamos si existe cierre, calculamos siempre los datos del día
    // Esto permite que el primer cierre del día tenga datos reales

    try {
      // Obtener totales del día
      const hoy = getFechaLocal();
      const ventasDia = await getFirst<any>(
        `
        SELECT 
          COALESCE(SUM(total_venta), 0) as total_ventas,
          COALESCE(SUM(total_efectivo), 0) as total_efectivo,
          COALESCE(SUM(total_transferencia), 0) as total_transferencia
        FROM Venta 
        WHERE punto_id = ? AND DATE(creado_en) = ?
      `,
        [puntoId, hoy],
      );

      // Obtener fondo de caja de la apertura del día
      const aperturaHoy = await getFirst<any>(
        `SELECT fondo_caja FROM CierreCaja 
         WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ?
         ORDER BY fecha_cierre DESC LIMIT 1`,
        [puntoId, hoy],
      );

      const fondoCajaDia = aperturaHoy?.fondo_caja || 0;

      // Obtener gastos del día usando la misma lógica que la pantalla
      const gastosPeriodo = await executeQuery<any>(
        `SELECT * FROM Gastos 
         WHERE punto_id = ? AND DATE(fecha_gasto) = ?`,
        [puntoId, hoy],
      );

      let gastosDia = 0;
      for (const gasto of gastosPeriodo) {
        if (gasto.categoria === "General") {
          gastosDia += Math.abs(gasto.precio || 0);
        } else if (gasto.categoria === "Salario") {
          const esPorcentaje =
            gasto.es_porcentaje === 1 ||
            (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);

          if (esPorcentaje) {
            const montoReal = await getSingleValue(
              `SELECT COALESCE(SUM(v.total_venta), 0)
               FROM Venta v
               WHERE v.punto_id = ? AND DATE(v.creado_en) = ?`,
              [puntoId, hoy],
            );

            const salarioTeorico = (montoReal * (gasto.porcentaje || 0)) / 100;
            gastosDia += salarioTeorico;
          } else {
            gastosDia += gasto.precio || 0;
          }
        }
      }

      // Calcular ganancias del día
      const gananciasDia = await getFirst<any>(
        `
        SELECT 
          COALESCE(SUM((dv.precio_unitario - COALESCE(dv.precio_coste_real, 0)) * dv.cantidad), 0) as total_ganancias
        FROM Venta v
        JOIN DetalleVenta dv ON v.id = dv.venta_id
        WHERE v.punto_id = ? AND DATE(v.creado_en) = ?
      `,
        [puntoId, hoy],
      );

      // Obtener dinero extraído del día (de cierres anteriores + el actual)
      const dineroExtraidoDia = await this.getDineroExtraidoHoy(puntoId);

      // Calcular diferencias de inventario
      let productosCorrectos = 0;
      let productosIncorrectos = 0;
      let totalPerdidas = 0;
      const detallesPerdidas: any[] = [];

      for (const producto of productos) {
        const cantidadFisica = producto.cantidad_fisica || 0;
        const diferencia = cantidadFisica - producto.cantidad_sistema;

        if (diferencia === 0) {
          productosCorrectos++;
        } else {
          productosIncorrectos++;
          if (diferencia < 0) {
            const perdidaProducto =
              Math.abs(diferencia) * producto.precio_coste;
            totalPerdidas += perdidaProducto;

            // Guardar detalle para depuración
            detallesPerdidas.push({
              nombre: producto.nombre,
              cantidad_sistema: producto.cantidad_sistema,
              cantidad_fisica: cantidadFisica,
              diferencia: Math.abs(diferencia),
              precio_coste: producto.precio_coste,
              perdida_total: perdidaProducto,
            });
          }
        }
      }

      // Obtener productos dados de baja
      const productosBaja =
        await CierreService.getProductosDadosDeBaja(puntoId);
      const perdidasPorBaja = productosBaja.reduce(
        (total, producto) => total + producto.total_perdida,
        0,
      );

      // Obtener cambios de precios del día
      const cambiosPrecios =
        await CambioPrecioService.getCambiosDelDia(puntoId);

      // Obtener préstamos del día
      const prestamosDia = await CierreService.getPrestamosDia(puntoId);
      const totalPrestamos = prestamosDia.reduce(
        (total, prestamo) => total + prestamo.monto,
        0,
      );

      // Calcular deuda pendiente y pagada del día
      const deudaPendiente = await getSingleValue(
        `SELECT COALESCE(SUM(monto), 0) 
         FROM PrestamoDeuda 
         WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pendiente' AND DATE(fecha_inicio) = ?`,
        [puntoId, hoy],
      );

      const deudaPagada = await getSingleValue(
        `SELECT COALESCE(SUM(monto), 0) 
         FROM PrestamoDeuda 
         WHERE punto_id = ? AND tipo = 'prestamo' AND estado = 'pagado' AND DATE(actualizado_en) = ?`,
        [puntoId, hoy],
      );

      console.log(" Depuración de pérdidas:");
      console.log("- Pérdidas por inventario (diferencias):", totalPerdidas);
      console.log("- Detalles de pérdidas por producto:", detallesPerdidas);
      console.log("- Productos dados de baja:", productosBaja);
      console.log("- Pérdidas por baja:", perdidasPorBaja);
      console.log("- Total pérdidas final:", totalPerdidas + perdidasPorBaja);
      console.log("- Cambios de precios del día:", cambiosPrecios.length);
      console.log("- Préstamos del día:", prestamosDia.length);
      console.log("- Total préstamos:", totalPrestamos);
      console.log("- Deuda pendiente:", deudaPendiente);
      console.log("- Deuda pagada:", deudaPagada);

      return {
        total_ventas: ventasDia?.total_ventas || 0,
        total_efectivo: ventasDia?.total_efectivo || 0,
        total_transferencia: ventasDia?.total_transferencia || 0,
        total_gastos: gastosDia || 0,
        total_ganancias: gananciasDia?.total_ganancias || 0,
        deuda_pendiente: deudaPendiente || 0,
        deuda_pagada: deudaPagada || 0,
        total_extraido: dineroExtraidoDia + montoExtraido,
        productos_correctos: productosCorrectos,
        productos_incorrectos: productosIncorrectos,
        total_perdidas: totalPerdidas + perdidasPorBaja, // Total de pérdidas
        perdidas_inventario: totalPerdidas, // Pérdidas por diferencias de inventario
        productos_baja: productosBaja,
        cambios_precios: cambiosPrecios,
        prestamos_dia: prestamosDia,
        total_prestamos: totalPrestamos,
      };
    } catch (error) {
      console.error("Error calculando resumen:", error);
      return {
        total_ventas: 0,
        total_efectivo: 0,
        total_transferencia: 0,
        total_gastos: 0,
        total_ganancias: 0,
        deuda_pendiente: 0,
        deuda_pagada: 0,
        total_extraido: montoExtraido,
        productos_correctos: 0,
        productos_incorrectos: 0,
        total_perdidas: 0,
        perdidas_inventario: 0,
        productos_baja: [],
        cambios_precios: [],
        prestamos_dia: [],
        total_prestamos: 0,
      };
    }
  },

  // Actualizar cantidad física de un producto
  async actualizarCantidadFisica(
    productoId: number,
    cantidadFisica: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      await executeNonQuery(
        `
        UPDATE Producto 
        SET cantidad_fisica = ?, actualizado_en = ?
        WHERE id = ?
      `,
        [cantidadFisica, ahora, productoId],
      );

      return {
        success: true,
        message: "Cantidad física actualizada",
      };
    } catch (error) {
      console.error("Error actualizando cantidad física:", error);
      return {
        success: false,
        message: "Error al actualizar cantidad física",
      };
    }
  },

  // Eliminar cierre
  async eliminarCierre(
    cierreId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Eliminar productos del cierre
        await executeNonQuery(
          "DELETE FROM CierreCajaProducto WHERE cierre_id = ?",
          [cierreId],
        );

        // Eliminar cierre principal
        await executeNonQuery("DELETE FROM CierreCaja WHERE id = ?", [
          cierreId,
        ]);

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: "Cierre eliminado correctamente",
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error eliminando cierre:", error);
      return {
        success: false,
        message: "Error al eliminar cierre",
      };
    }
  },
};
