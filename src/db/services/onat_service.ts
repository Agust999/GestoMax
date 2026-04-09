// src/db/services/onat_service.ts
import { db } from "../database";

export interface ResumenTransferencias {
  cuentaFiscal: number;
  tarjeta: number;
  total: number;
}

export interface ResumenTransferenciasMensual extends ResumenTransferencias {
  mes: number;
}

export class OnatService {
  // Obtener el porcentaje ONAT configurado
  static async getPorcentajeOnat(): Promise<number> {
    try {
      const result = await db.getFirstAsync<{
        valor: string;
      }>(
        'SELECT valor FROM Configuracion WHERE clave = "porcentaje_onat" LIMIT 1',
      );

      if (result && result.valor) {
        return parseFloat(result.valor);
      }

      // Si no existe, retornar valor por defecto (ej: 5%)
      return 5.0;
    } catch (error) {
      console.error("Error obteniendo porcentaje ONAT:", error);
      return 5.0; // Valor por defecto en caso de error
    }
  }

  // Actualizar el porcentaje ONAT
  static async updatePorcentajeOnat(porcentaje: number): Promise<boolean> {
    try {
      // Validar que el porcentaje sea un valor razonable (entre 0 y 100)
      if (porcentaje < 0 || porcentaje > 100) {
        throw new Error("El porcentaje debe estar entre 0 y 100");
      }

      // Verificar si ya existe la configuración
      const existe = await db.getFirstAsync<{
        id: number;
      }>(
        'SELECT id FROM Configuracion WHERE clave = "porcentaje_onat" LIMIT 1',
      );

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      if (existe) {
        // Actualizar existente
        await db.runAsync(
          'UPDATE Configuracion SET valor = ?, actualizado_en = ? WHERE clave = "porcentaje_onat"',
          [porcentaje.toString(), ahora],
        );
      } else {
        // Insertar nueva
        await db.runAsync(
          "INSERT INTO Configuracion (clave, valor, descripcion, actualizado_en) VALUES (?, ?, ?, ?)",
          [
            "porcentaje_onat",
            porcentaje.toString(),
            "Porcentaje a pagar a ONAT sobre ventas por transferencia",
            ahora,
          ],
        );
      }

      return true;
    } catch (error) {
      console.error("Error actualizando porcentaje ONAT:", error);
      return false;
    }
  }

  // Calcular monto total de ventas (efectivo + transferencia)
  static async getMontoTotalVentas(puntoId?: number): Promise<number> {
    try {
      let query = `
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN tipo_pago = 'efectivo' THEN total_venta
              WHEN tipo_pago = 'transferencia' THEN total_venta
              WHEN tipo_pago = 'mixto' THEN total_venta
              ELSE 0
            END
          ), 0) as monto_total
        FROM Venta 
      `;

      const params: any[] = [];

      if (puntoId) {
        query += " WHERE punto_id = ?";
        params.push(puntoId);
      }

      const result = await db.getFirstAsync<{
        monto_total: number;
      }>(query, params);

      return result?.monto_total || 0;
    } catch (error) {
      console.error("Error calculando monto total de ventas:", error);
      return 0;
    }
  }

  // Calcular monto total de ventas (efectivo + transferencia) con filtrado por fechas
  static async getMontoTotalVentasCompleto(
    puntoId?: number,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<number> {
    try {
      // Si no hay fechas, usar todas las ventas
      if (!fechaInicio && !fechaFin) {
        console.log(
          `🔍 DEBUG ONAT - Sin fechas, usando todas las ventas para puntoId: ${puntoId}`,
        );
        return await this.getMontoTotalVentas(puntoId);
      }

      console.log(
        `🔍 DEBUG ONAT - Buscando ventas desde ${fechaInicio} 00:00:00 hasta ${fechaFin} 23:59:59 para puntoId: ${puntoId}`,
      );

      let query = `
        SELECT 
          COALESCE(SUM(total_venta), 0) as monto_total
        FROM Venta 
      `;

      const params: any[] = [];

      if (puntoId) {
        query += " WHERE punto_id = ?";
        params.push(puntoId);
      }

      if (fechaInicio) {
        query += puntoId ? " AND creado_en >= ?" : " WHERE creado_en >= ?";
        // Usar fecha de inicio con hora 00:00:00
        params.push(fechaInicio + " 00:00:00");
      }

      if (fechaFin) {
        query +=
          puntoId || fechaInicio
            ? " AND creado_en <= ?"
            : " WHERE creado_en <= ?";
        // Usar fecha de fin con hora 23:59:59
        params.push(fechaFin + " 23:59:59");
      }

      console.log(`🔍 DEBUG ONAT - Query: ${query}`);
      console.log(`🔍 DEBUG ONAT - Params: ${JSON.stringify(params)}`);

      const result = await db.getFirstAsync<{
        monto_total: number;
      }>(query, params);

      const montoTotal = result?.monto_total || 0;
      console.log(`🔍 DEBUG ONAT - Resultado query ventas: $${montoTotal}`);

      return montoTotal;
    } catch (error) {
      console.error("Error calculando monto total de ventas completo:", error);
      return 0;
    }
  }

  // Calcular monto a pagar a ONAT
  static async calcularMontoOnat(
    puntoId?: number,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<{
    montoTotal: number;
    porcentaje: number;
    montoOnat: number;
    montoBase: number;
  }> {
    try {
      const [montoTotal, porcentaje] = await Promise.all([
        this.getMontoTotalVentasCompleto(puntoId, fechaInicio, fechaFin),
        this.getPorcentajeOnat(),
      ]);

      console.log(
        `🔍 DEBUG ONAT - montoTotal: $${montoTotal}, porcentaje: ${porcentaje}%`,
      );
      console.log(`🔍 DEBUG ONAT - fechas: ${fechaInicio} a ${fechaFin}`);

      // Nueva fórmula: (Monto total Ventas - 3260) * 0,05 + el porcentaje del Monto Total Ventas
      const baseImponible = Math.max(0, montoTotal - 3260);
      const montoBase = baseImponible * 0.05;
      const montoPorcentaje = (montoTotal * porcentaje) / 100;
      const montoOnat = montoBase + montoPorcentaje;

      console.log(`🔍 DEBUG ONAT - baseImponible: $${baseImponible}`);
      console.log(`🔍 DEBUG ONAT - montoBase (5%): $${montoBase}`);
      console.log(
        `🔍 DEBUG ONAT - montoPorcentaje (${porcentaje}%): $${montoPorcentaje}`,
      );
      console.log(`🔍 DEBUG ONAT - montoOnat final: $${montoOnat}`);

      return {
        montoTotal,
        porcentaje,
        montoOnat,
        montoBase, // Nuevo campo para mostrar el cálculo intermedio
      };
    } catch (error) {
      console.error("Error calculando monto ONAT:", error);
      return {
        montoTotal: 0,
        porcentaje: 5.0,
        montoOnat: 0,
        montoBase: 0,
      };
    }
  }

  // Obtener historial de ventas para mostrar detalles con paginación
  static async getHistorialVentas(
    puntoId?: number,
    pagina: number = 1,
    limitePorPagina: number = 10,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<{
    datos: any[];
    totalRegistros: number;
    paginaActual: number;
    totalPaginas: number;
  }> {
    try {
      // Primero obtener el total de registros
      let countQuery = `
        SELECT COUNT(*) as total
        FROM Venta v
      `;

      const countParams: any[] = [];

      if (puntoId) {
        countQuery += " WHERE v.punto_id = ?";
        countParams.push(puntoId);
      }

      if (fechaInicio) {
        countQuery += puntoId
          ? " AND v.creado_en >= ?"
          : " WHERE v.creado_en >= ?";
        countParams.push(fechaInicio + " 00:00:00");
      }

      if (fechaFin) {
        countQuery +=
          puntoId || fechaInicio
            ? " AND v.creado_en <= ?"
            : " WHERE v.creado_en <= ?";
        countParams.push(fechaFin + " 23:59:59");
      }

      const countResult = await db.getFirstAsync<{
        total: number;
      }>(countQuery, countParams);
      const totalRegistros = countResult?.total || 0;

      // Calcular paginación
      const offset = (pagina - 1) * limitePorPagina;
      const totalPaginas = Math.ceil(totalRegistros / limitePorPagina);

      // Obtener los datos de la página actual
      let query = `
        SELECT 
          v.id,
          v.punto_id,
          p.nombre as punto_nombre,
          v.total_venta,
          v.total_efectivo,
          v.total_transferencia,
          v.tipo_pago,
          v.metodo_transferencia,
          v.creado_en,
          COUNT(dv.id) as cantidad_productos
        FROM Venta v
        LEFT JOIN Punto p ON v.punto_id = p.id
        LEFT JOIN DetalleVenta dv ON v.id = dv.venta_id
      `;

      const params: any[] = [];

      if (puntoId) {
        query += " WHERE v.punto_id = ?";
        params.push(puntoId);
      }

      if (fechaInicio) {
        query += puntoId ? " AND v.creado_en >= ?" : " WHERE v.creado_en >= ?";
        params.push(fechaInicio + " 00:00:00");
      }

      if (fechaFin) {
        query +=
          puntoId || fechaInicio
            ? " AND v.creado_en <= ?"
            : " WHERE v.creado_en <= ?";
        params.push(fechaFin + " 23:59:59");
      }

      query += `
        GROUP BY v.id
        ORDER BY v.creado_en DESC
        LIMIT ? OFFSET ?
      `;

      params.push(limitePorPagina, offset);

      const resultados = await db.getAllAsync<any>(query, params);

      return {
        datos: resultados,
        totalRegistros,
        paginaActual: pagina,
        totalPaginas,
      };
    } catch (error) {
      console.error("Error obteniendo historial de ventas:", error);
      return {
        datos: [],
        totalRegistros: 0,
        paginaActual: pagina,
        totalPaginas: 0,
      };
    }
  }

  static async getResumenTransferencias(
    puntoId?: number,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<ResumenTransferencias> {
    try {
      let query = `
        SELECT
          COALESCE(SUM(
            CASE
              WHEN tipo_pago = 'transferencia'
                   AND metodo_transferencia IN ('ENZONA', 'TRANSFERMOVIL')
              THEN CASE
                     WHEN total_transferencia IS NOT NULL AND total_transferencia > 0
                     THEN total_transferencia
                     ELSE total_venta
                   END
              ELSE 0
            END
          ), 0) as cuenta_fiscal,
          COALESCE(SUM(
            CASE
              WHEN tipo_pago = 'transferencia'
                   AND metodo_transferencia IN ('TARJETA', 'Tarjeta')
              THEN CASE
                     WHEN total_transferencia IS NOT NULL AND total_transferencia > 0
                     THEN total_transferencia
                     ELSE total_venta
                   END
              ELSE 0
            END
          ), 0) as tarjeta
        FROM Venta
      `;

      const params: any[] = [];

      if (puntoId) {
        query += " WHERE punto_id = ?";
        params.push(puntoId);
      }

      if (fechaInicio) {
        query += puntoId ? " AND creado_en >= ?" : " WHERE creado_en >= ?";
        params.push(fechaInicio + " 00:00:00");
      }

      if (fechaFin) {
        query +=
          puntoId || fechaInicio
            ? " AND creado_en <= ?"
            : " WHERE creado_en <= ?";
        params.push(fechaFin + " 23:59:59");
      }

      const result = await db.getFirstAsync<{
        cuenta_fiscal: number;
        tarjeta: number;
      }>(query, params);

      const cuentaFiscal = result?.cuenta_fiscal || 0;
      const tarjeta = result?.tarjeta || 0;

      return {
        cuentaFiscal,
        tarjeta,
        total: cuentaFiscal + tarjeta,
      };
    } catch (error) {
      console.error("Error obteniendo resumen de transferencias:", error);
      return {
        cuentaFiscal: 0,
        tarjeta: 0,
        total: 0,
      };
    }
  }

  static async getResumenTransferenciasPorMes(
    puntoId?: number,
    anio?: number,
  ): Promise<ResumenTransferenciasMensual[]> {
    try {
      const anioObjetivo = anio || new Date().getFullYear();
      let query = `
        SELECT
          CAST(strftime('%m', creado_en) as INTEGER) as mes,
          COALESCE(SUM(
            CASE
              WHEN tipo_pago = 'transferencia'
                   AND metodo_transferencia IN ('ENZONA', 'TRANSFERMOVIL')
              THEN CASE
                     WHEN total_transferencia IS NOT NULL AND total_transferencia > 0
                     THEN total_transferencia
                     ELSE total_venta
                   END
              ELSE 0
            END
          ), 0) as cuenta_fiscal,
          COALESCE(SUM(
            CASE
              WHEN tipo_pago = 'transferencia'
                   AND metodo_transferencia IN ('TARJETA', 'Tarjeta')
              THEN CASE
                     WHEN total_transferencia IS NOT NULL AND total_transferencia > 0
                     THEN total_transferencia
                     ELSE total_venta
                   END
              ELSE 0
            END
          ), 0) as tarjeta
        FROM Venta
        WHERE strftime('%Y', creado_en) = ?
      `;

      const params: any[] = [anioObjetivo.toString()];

      if (puntoId) {
        query += " AND punto_id = ?";
        params.push(puntoId);
      }

      query += " GROUP BY strftime('%m', creado_en)";

      const resultados = await db.getAllAsync<{
        mes: number;
        cuenta_fiscal: number;
        tarjeta: number;
      }>(query, params);

      const porMes = new Map<number, ResumenTransferenciasMensual>();

      resultados.forEach((item) => {
        const cuentaFiscal = item.cuenta_fiscal || 0;
        const tarjeta = item.tarjeta || 0;
        porMes.set(item.mes, {
          mes: item.mes,
          cuentaFiscal,
          tarjeta,
          total: cuentaFiscal + tarjeta,
        });
      });

      const salida: ResumenTransferenciasMensual[] = [];
      for (let mes = 1; mes <= 12; mes++) {
        salida.push(
          porMes.get(mes) || {
            mes,
            cuentaFiscal: 0,
            tarjeta: 0,
            total: 0,
          },
        );
      }

      return salida;
    } catch (error) {
      console.error(
        "Error obteniendo resumen mensual de transferencias:",
        error,
      );
      return Array.from({ length: 12 }, (_, idx) => ({
        mes: idx + 1,
        cuentaFiscal: 0,
        tarjeta: 0,
        total: 0,
      }));
    }
  }
}
