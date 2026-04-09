import { getFechaLocal } from "../../utils/dateUtils";
import {
    executeNonQuery,
    executeQuery,
    getFirst,
    getSingleValue,
} from "../database";

// Interfaces para los gastos (ESTRUCTURA EXISTENTE)
export interface Gasto {
  id?: number;
  punto_id: number;
  nombre: string;
  categoria: "General" | "Salario";
  precio: number;
  descripcion?: string;
  descripcion_deuda?: string;
  tipo: "casual" | "pasivo";
  fecha_gasto: string;
  recurrente: boolean;
  periodicidad?: "diario" | "semanal" | "mensual";
  activo?: boolean;
  creado_en?: string;
  actualizado_en?: string;
  porcentaje?: number; // Campo para salarios (porcentaje)
  es_porcentaje?: number | boolean; // 1/true = Porcentaje, 0/false = Fijo
  salario_fijo?: number; // Campo para salarios (monto fijo)
}

// Interface para crear un nuevo gasto (más clara)
export interface CrearGastoRequest {
  nombre: string;
  categoria: "General" | "Salario";
  tipo: "casual" | "pasivo";
  descripcion?: string;
  descripcion_deuda?: string;
  fecha_gasto: string;
  deuda?: boolean;
  recurrente?: boolean;
  es_porcentaje?: boolean; // Nuevo campo para distinguir tipo de salario

  // Para gastos generales
  precio?: number;

  // Para Salarios
  salario_empleado?: number; // porcentaje
  salario_fijo?: number; // monto fijo
  porcentaje?: number; // porcentaje (mismo campo que salario_empleado)
  periodicidad?: "diario" | "semanal" | "mensual";
}

export interface GastoConTotales {
  id: number;
  punto_id: number;
  nombre: string;
  categoria: "General" | "Salario";
  precio?: number;
  salario_empleado?: number;
  descripcion: string;
  deuda: boolean;
  tipo: "casual" | "pasivo";
  fecha_gasto: string;
  recurrente: boolean;
  periodicidad: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  total_acumulado?: number;
}

export class GastoService {
  // Obtener todos los gastos de un punto (con cálculo de salarios)
  static async read_gasto(puntoId: number): Promise<Gasto[]> {
    try {
      // Primero obtener los gastos sin cálculo
      const gastos = await executeQuery<Gasto>(
        `
        SELECT * FROM Gastos 
        WHERE punto_id = ? AND activo = 1
        ORDER BY fecha_gasto DESC, creado_en DESC
      `,
        [puntoId],
      );

      console.log(
        `🔍 DEBUG read_gasto: Se encontraron ${gastos.length} gastos`,
      );
      gastos.forEach((gasto, index) => {
        console.log(
          `📋 Gasto ${index + 1}: ${gasto.nombre} - fecha_gasto: ${gasto.fecha_gasto} - creado_en: ${gasto.creado_en}`,
        );
      });

      // Aplicar cálculo de salarios a todos los gastos
      const gastosConMontos = await Promise.all(
        gastos.map(async (gasto: Gasto) => {
          if (gasto.categoria === "Salario") {
            // Verificar si este trabajador está seleccionado en la apertura del día
            console.log(
              `🔍 DEBUG read_gasto: Verificando trabajador ${gasto.nombre} (ID: ${gasto.id})`,
            );

            const debeGenerarSalario = await this.debeGenerarSalarioHoy(
              puntoId,
              gasto.id!,
            );

            console.log(
              `🔍 DEBUG read_gasto: ${gasto.nombre} - debeGenerarSalario=${debeGenerarSalario}`,
            );

            if (!debeGenerarSalario) {
              // Este trabajador no está seleccionado hoy, no genera salario
              console.log(
                `❌ ${gasto.nombre || "Sin nombre"}: No seleccionado hoy, sin salario`,
              );
              return {
                ...gasto,
                precio: 0,
              };
            }

            // Es un salario: calcular teórico basado en ventas y restar consumos propios
            const gananciasPeriodo = await this.obtenerGananciasPeriodo(
              puntoId,
              "hoy", // Usar "hoy" para salarios diarios
              false,
            );

            // Obtener porcentaje vigente para hoy
            const porcentajeVigente =
              await this.obtenerPorcentajeVigenteEnFecha(
                gasto.id!,
                getFechaLocal(),
              );

            const esPorcentaje =
              gasto.es_porcentaje === 1 ||
              (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
            const salarioTeorico = esPorcentaje
              ? (gananciasPeriodo * porcentajeVigente) / 100
              : gasto.precio || 0; // Si es fijo, el salario es directamente el 'precio' guardado

            // Obtener consumos propios del trabajador del día de hoy
            const consumosPropios = await this.obtenerConsumosPropiosPeriodo(
              puntoId,
              gasto.nombre || "Sin nombre",
              "hoy",
            );

            // Calcular salario final: teórico - consumos propios
            const salarioFinal = salarioTeorico - consumosPropios;

            console.log(`🔍 Salario Card: ${gasto.nombre || "Sin nombre"}`);
            console.log(`🔍 Porcentaje vigente: ${porcentajeVigente}%`);
            console.log(`🔍 Ventas totales: $${gananciasPeriodo}`);
            console.log(`🔍 Salario teórico: $${salarioTeorico.toFixed(2)}`);
            console.log(`🔍 Consumos propios: $${consumosPropios.toFixed(2)}`);
            console.log(
              `💰 ${gasto.nombre || "Sin nombre"}: $${salarioFinal.toFixed(2)} (final)`,
            );

            return {
              ...gasto,
              precio: salarioFinal, // Usar salario calculado menos consumos
            };
          }
          // Es un gasto general: usar el precio que se puso
          return gasto;
        }),
      );

      return gastosConMontos;
    } catch (error) {
      console.error("Error en read_gasto:", error);
      return [];
    }
  }

  // Reparar salarios existentes que no tienen porcentaje
  static async repararSalariosExistentes(puntoId: number): Promise<void> {
    try {
      console.log("🔧 Reparando salarios existentes...");

      // Obtener todos los salarios que necesitan reparación
      const salariosPorReparar = await executeQuery<Gasto>(
        `
        SELECT * FROM Gastos 
        WHERE punto_id = ? AND categoria = 'Salario' AND activo = 1
        AND (
          (es_porcentaje = 1 AND (porcentaje IS NULL OR porcentaje = 0)) 
          OR 
          (es_porcentaje = 0 AND salario_fijo IS NULL)
        )
      `,
        [puntoId],
      );

      console.log(
        `📊 Encontrados ${salariosPorReparar.length} salarios para reparar`,
      );

      for (const salario of salariosPorReparar) {
        if (salario.es_porcentaje === 1) {
          // Salario porcentual sin porcentaje definido
          const porcentajeDefecto = 15; // Porcentaje por defecto razonable

          await this.update_gasto_modificado(salario.id!, {
            porcentaje: porcentajeDefecto,
          });

          console.log(
            `✅ Salario porcentual "${salario.nombre}" reparado con ${porcentajeDefecto}%`,
          );
        } else if (salario.es_porcentaje === 0) {
          // Salario fijo sin monto definido - asignar un monto por defecto
          const salarioFijoDefecto = 1500; // Salario mínimo por defecto

          await this.update_gasto_modificado(salario.id!, {
            salario_fijo: salarioFijoDefecto,
          });

          console.log(
            `✅ Salario fijo "${salario.nombre}" reparado con $${salarioFijoDefecto}`,
          );
        }
      }

      console.log("🔧 Reparación de salarios completada");
    } catch (error) {
      console.error("Error reparando salarios:", error);
    }
  }

  // Obtener ganancias de un período (para cálculo de salarios)
  static async obtenerGananciasPeriodo(
    puntoId: number,
    periodo: "hoy" | "semana" | "mes" | "todos" | "periodo",
    generarSalarios: boolean = false,
    fechaInicio?: string,
    fechaFin?: string,
    trabajadorId?: number, // ID específico del trabajador
  ): Promise<number> {
    try {
      // Importar helpers dinámicamente para evitar dependencia circular
      const { PuntoHelper } = await import("../databaseHelper");

      let totalGanancias = 0;

      if (periodo === "hoy") {
        // Para hoy: usar ventas reales del día
        const ventasHoy = await PuntoHelper.getVentasHoy(puntoId);
        totalGanancias = ventasHoy;
        console.log(`📊 Ventas hoy: $${ventasHoy}`);
      } else if (periodo === "semana") {
        // Para semana: obtener VENTAS (no ganancias) de los últimos 7 días
        const { getSingleValueFix } = await import("../database_fix");

        const hoySemana = getFechaLocal();
        const inicioSemanaDate = new Date();
        inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
        const inicioSemanaStr = inicioSemanaDate.toISOString().split("T")[0];

        const querySemana = `SELECT COALESCE(SUM(total_venta), 0) as ventas_semana
           FROM Venta v
           WHERE v.punto_id = ? 
           AND DATE(v.creado_en) >= DATE(?) 
           AND DATE(v.creado_en) <= DATE(?)
           AND DATE(v.creado_en) <= DATE(?)  -- Solo fechas válidas
           AND v.creado_en IS NOT NULL`;

        console.log(`🔍 DEBUG Query Semana: ${querySemana}`);
        console.log(
          `🔍 DEBUG Params Semana: [${puntoId}, ${inicioSemanaStr}, ${hoySemana}]`,
        );

        const ventasSemana = await getSingleValueFix<number>(querySemana, [
          puntoId,
          inicioSemanaStr,
          hoySemana,
          hoySemana,
        ]);
        totalGanancias = ventasSemana || 0;
        console.log(
          `📊 Semana: usando VENTAS reales de la semana: $${totalGanancias}`,
        );
      } else if (periodo === "mes") {
        // Para mes: obtener VENTAS (no ganancias) del mes actual
        const { getSingleValueFix } = await import("../database_fix");

        const hoyMes = getFechaLocal();
        const mesActual = hoyMes.substring(0, 7); // YYYY-MM

        const queryMes = `SELECT COALESCE(SUM(total_venta), 0) as ventas_mes
           FROM Venta v
           WHERE v.punto_id = ? 
           AND strftime('%Y-%m', v.creado_en) = ?
           AND DATE(v.creado_en) <= DATE(?)  -- Solo fechas válidas
           AND v.creado_en IS NOT NULL`;

        console.log(`🔍 DEBUG Query Mes: ${queryMes}`);
        console.log(
          `🔍 DEBUG Params Mes: [${puntoId}, ${mesActual}, ${hoyMes}]`,
        );

        const ventasMes = await getSingleValueFix<number>(queryMes, [
          puntoId,
          mesActual,
          hoyMes,
        ]);
        totalGanancias = ventasMes || 0;
        console.log(`📊 Mes: usando VENTAS reales del mes: $${totalGanancias}`);
      } else if (periodo === "periodo" && fechaInicio && fechaFin) {
        // Para período personalizado: obtener VENTAS (no ganancias) del rango de fechas
        const { getSingleValueFix } = await import("../database_fix");

        const queryPeriodo = `SELECT COALESCE(SUM(total_venta), 0) as ventas_periodo
           FROM Venta v
           WHERE v.punto_id = ? 
           AND DATE(v.creado_en) BETWEEN ? AND ?
           AND DATE(v.creado_en) <= DATE(?)  -- Solo fechas válidas
           AND v.creado_en IS NOT NULL`;

        console.log(`🔍 DEBUG Query Período: ${queryPeriodo}`);
        console.log(
          `🔍 DEBUG Params Período: [${puntoId}, ${fechaInicio}, ${fechaFin}, ${fechaFin}]`,
        );

        const ventasPeriodo = await getSingleValueFix<number>(queryPeriodo, [
          puntoId,
          fechaInicio,
          fechaFin,
          fechaFin,
        ]);
        totalGanancias = ventasPeriodo || 0;
        console.log(
          `📊 Período: usando VENTAS reales del período: $${totalGanancias}`,
        );
      } else {
        // todos: usar ventas de hoy
        const ventasHoy = await PuntoHelper.getVentasHoy(puntoId);
        totalGanancias = ventasHoy;
        console.log(`📊 Ventas todos: $${ventasHoy}`);
      }

      return totalGanancias;
    } catch (error) {
      console.error("Error en obtenerGananciasPeriodo:", error);
      return 0;
    }
  }

  // Obtener salario total de hoy (suma de todos los salarios del día)
  static async obtenerSalarioTotalHoy(puntoId: number): Promise<number> {
    try {
      console.log(`🔍 DEBUG obtenerSalarioTotalHoy: puntoId=${puntoId}`);

      // Obtener todos los gastos del período "hoy"
      const gastosHoy = await this.obtenerGastosPorPeriodo(puntoId, "hoy");

      // Filtrar solo los salarios y sumar sus montos
      const salariosHoy = gastosHoy.filter(
        (gasto) => gasto.categoria === "Salario",
      );

      const totalSalarios = salariosHoy.reduce((total, salario) => {
        return total + (salario.precio || 0);
      }, 0);

      console.log(`📊 DEBUG obtenerSalarioTotalHoy:`);
      console.log(`📊 - Total gastos encontrados: ${gastosHoy.length}`);
      console.log(`📊 - Salarios encontrados: ${salariosHoy.length}`);
      console.log(`📊 - Total salarios hoy: $${totalSalarios.toFixed(2)}`);

      salariosHoy.forEach((salario, index) => {
        console.log(
          `💰 Salario ${index + 1}: ${salario.nombre} - $${(salario.precio || 0).toFixed(2)}`,
        );
      });

      return totalSalarios;
    } catch (error) {
      console.error("Error en obtenerSalarioTotalHoy:", error);
      return 0;
    }
  }

  // Obtener gastos por período con cálculo de salarios
  static async obtenerGastosPorPeriodo(
    puntoId: number,
    periodo: "hoy" | "semana" | "mes" | "todos" | "periodo",
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<Gasto[]> {
    try {
      let query = `
        SELECT * FROM Gastos 
          WHERE punto_id = ? AND activo = 1
      `;
      const params: any[] = [puntoId];

      switch (periodo) {
        case "hoy":
          // Para hoy: gastos generales de hoy y salarios del trabajador que trabaja hoy
          const hoy = getFechaLocal();
          query += ` AND (categoria = 'General' AND DATE(fecha_gasto) = DATE(?)) OR (categoria = 'Salario' AND punto_id = ? AND activo = 1)`;
          params.push(hoy, puntoId);
          break;
        case "semana":
          // Para semana: gastos generales de la semana y salarios de trabajadores que han trabajado esta semana
          const hoySemana = getFechaLocal();
          const inicioSemana = new Date();
          inicioSemana.setDate(inicioSemana.getDate() - 7);
          const inicioSemanaStr = inicioSemana.toISOString().split("T")[0];
          query += ` AND (categoria = 'General' AND DATE(fecha_gasto) >= DATE(?) AND DATE(fecha_gasto) <= DATE(?)) OR (categoria = 'Salario' AND punto_id = ? AND activo = 1)`;
          params.push(inicioSemanaStr, hoySemana, puntoId);
          break;
        case "mes":
          // Para mes: todos los gastos del mes actual
          const hoyMes = getFechaLocal();
          const mesActual = hoyMes.substring(0, 7); // YYYY-MM
          query += ` AND strftime('%Y-%m', fecha_gasto) = ?`;
          params.push(mesActual);
          break;
        case "periodo":
          // Para período personalizado: todos los gastos en el rango de fechas
          if (fechaInicio && fechaFin) {
            query += ` AND DATE(fecha_gasto) >= DATE(?) AND DATE(fecha_gasto) <= DATE(?)`;
            params.push(fechaInicio, fechaFin);
          }
          break;
        // 'todos' no necesita filtro adicional
      }

      query += ` ORDER BY fecha_gasto DESC, creado_en DESC`;
      const gastos = await executeQuery<Gasto>(query, params);

      console.log(
        `🔍 DEBUG obtenerGastosPorPeriodo: período=${periodo}, puntoId=${puntoId}`,
      );
      console.log(`🔍 DEBUG Query SQL: ${query}`);
      console.log(`🔍 DEBUG Params:`, params);
      console.log(`📊 DEBUG Gastos encontrados: ${gastos.length}`);

      // Mostrar detalles de los gastos encontrados
      gastos.forEach((gasto, index) => {
        console.log(`📋 DEBUG Gasto ${index + 1}:`, {
          id: gasto.id,
          nombre: gasto.nombre,
          categoria: gasto.categoria,
          precio: gasto.precio,
          fecha_gasto: gasto.fecha_gasto,
          creado_en: gasto.creado_en,
          activo: gasto.activo,
        });
      });

      // Calcular montos reales para salarios
      const gastosConMontos = await Promise.all(
        gastos.map(async (gasto: Gasto) => {
          if (gasto.categoria === "Salario") {
            // Para el período "hoy": solo calcular salario del trabajador que está trabajando hoy
            if (periodo === "hoy") {
              const estaTrabajandoHoy = await this.debeGenerarSalarioHoy(
                puntoId,
                gasto.id!,
              );

              console.log(
                `🔍 DEBUG Salario hoy: ${gasto.nombre} (ID: ${gasto.id}) - está trabajando hoy: ${estaTrabajandoHoy}`,
              );

              if (!estaTrabajandoHoy) {
                return {
                  ...gasto,
                  precio: 0,
                };
              }

              // Calcular salario basado en ventas reales de hoy para este trabajador
              const gananciasPeriodo =
                await this.obtenerVentasTrabajadorPeriodo(
                  puntoId,
                  gasto.id!,
                  "hoy",
                );

              // Obtener porcentaje vigente para hoy
              const porcentajeVigente =
                await this.obtenerPorcentajeVigenteEnFecha(
                  gasto.id!,
                  getFechaLocal(),
                );
              const esPorcentaje =
                gasto.es_porcentaje === 1 ||
                (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
              const salarioTeorico = esPorcentaje
                ? (gananciasPeriodo * porcentajeVigente) / 100
                : gasto.salario_fijo || 0; // Si es fijo, usar salario_fijo directamente

              // Obtener consumos propios del trabajador del período específico
              const consumosPropios = await this.obtenerConsumosPropiosPeriodo(
                puntoId,
                gasto.nombre || "Sin nombre",
                "hoy",
              );

              // Calcular salario final: teórico - consumos
              const salarioFinal = salarioTeorico - consumosPropios;

              console.log(
                `🔍 Salario hoy (trabajador activo): ${gasto.nombre || "Sin nombre"}`,
              );
              console.log(`🔍 Porcentaje vigente: ${porcentajeVigente}%`);
              console.log(`🔍 Ventas hoy: $${gananciasPeriodo}`);
              console.log(`🔍 Salario teórico: $${salarioTeorico.toFixed(2)}`);
              console.log(
                `🔍 Consumos propios: $${consumosPropios.toFixed(2)}`,
              );
              console.log(
                `💰 ${gasto.nombre || "Sin nombre"}: $${salarioFinal.toFixed(2)} (final)`,
              );

              return {
                ...gasto,
                precio: salarioFinal,
              };
            } else {
              // Para otros períodos (semana, mes, período personalizado, todos)
              console.log(
                `🔍 DEBUG Salario ${periodo}: ${gasto.nombre} (ID: ${gasto.id}) - calculando para período ${periodo}`,
              );

              // Para semana: verificar si el trabajador trabajó algún día de la semana
              if (periodo === "semana") {
                const trabajoSemanal = await this.verificarTrabajoSemanal(
                  puntoId,
                  gasto.id!,
                );

                console.log(
                  `🔍 DEBUG Salario semana: ${gasto.nombre} - trabajó esta semana: ${trabajoSemanal}`,
                );

                if (!trabajoSemanal) {
                  return {
                    ...gasto,
                    precio: 0,
                  };
                }
              }

              // Obtener ganancias del período específico para este trabajador
              const gananciasPeriodo =
                await this.obtenerVentasTrabajadorPeriodo(
                  puntoId,
                  gasto.id!,
                  periodo,
                  fechaInicio,
                  fechaFin,
                );

              // Obtener porcentaje vigente para el período específico (usar el porcentaje de hoy para todos los cálculos actuales)
              const porcentajeVigente =
                await this.obtenerPorcentajeVigenteEnFecha(
                  gasto.id!,
                  getFechaLocal(),
                );
              const esPorcentaje =
                gasto.es_porcentaje === 1 ||
                (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
              const salarioTeorico = esPorcentaje
                ? (gananciasPeriodo * porcentajeVigente) / 100
                : gasto.precio || 0; // Si es fijo, el salario es directamente el 'precio' guardado

              // Obtener consumos propios del trabajador del período específico
              const consumosPropios = await this.obtenerConsumosPropiosPeriodo(
                puntoId,
                gasto.nombre || "Sin nombre",
                periodo,
                fechaInicio,
                fechaFin,
              );

              // Calcular salario final: teórico - consumos del período
              const salarioFinal = salarioTeorico - consumosPropios;

              console.log(
                `🔍 Salario ${periodo}: ${gasto.nombre || "Sin nombre"}`,
              );
              console.log(`🔍 Porcentaje vigente: ${porcentajeVigente}%`);
              console.log(`🔍 Ventas ${periodo}: $${gananciasPeriodo}`);
              console.log(`🔍 Salario teórico: $${salarioTeorico.toFixed(2)}`);
              console.log(
                `🔍 Consumos propios (totales): $${consumosPropios.toFixed(2)}`,
              );
              console.log(
                `💰 ${gasto.nombre || "Sin nombre"}: $${salarioFinal.toFixed(2)} (final)`,
              );

              return {
                ...gasto,
                precio: salarioFinal,
              };
            }
          }
          // Es un gasto general: usar el precio que se puso en el campo "Precio"
          return gasto;
        }),
      );

      return gastosConMontos;
    } catch (error) {
      console.error("Error en obtenerGastosPorPeriodo:", error);
      return [];
    }
  }

  // Obtener ventas de un trabajador específico en un período
  static async obtenerVentasTrabajadorPeriodo(
    puntoId: number,
    trabajadorId: number,
    periodo: "hoy" | "semana" | "mes" | "todos" | "periodo",
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<number> {
    try {
      let query = `
        SELECT COALESCE(SUM(v.total_venta), 0) as total_ventas
        FROM Venta v
        WHERE v.punto_id = ? 
          AND v.es_directa = 0
          AND EXISTS (
            SELECT 1 FROM CierreCaja a 
            WHERE a.punto_id = v.punto_id 
              AND a.tipo = 'apertura'
              AND DATE(a.fecha_cierre) = DATE(v.creado_en)
              AND a.trabajador_id = ?
          )
      `;
      const params: any[] = [puntoId, trabajadorId];

      switch (periodo) {
        case "hoy":
          const hoy = getFechaLocal();
          query += ` AND DATE(v.creado_en) = DATE(?)`;
          params.push(hoy);
          break;
        case "semana":
          const hoySemana = getFechaLocal();
          const inicioSemanaDate = new Date();
          inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
          const inicioSemanaStr = inicioSemanaDate.toISOString().split("T")[0];
          query += ` AND DATE(v.creado_en) >= DATE(?) AND DATE(v.creado_en) <= DATE(?)`;
          params.push(inicioSemanaStr, hoySemana);
          break;
        case "mes":
          const hoyMes = getFechaLocal();
          const mesActual = hoyMes.substring(0, 7); // YYYY-MM
          query += ` AND strftime('%Y-%m', v.creado_en) = ?`;
          params.push(mesActual);
          break;
        case "periodo":
          if (fechaInicio && fechaFin) {
            query += ` AND DATE(v.creado_en) >= DATE(?) AND DATE(v.creado_en) <= DATE(?)`;
            params.push(fechaInicio, fechaFin);
          }
          break;
        case "todos":
          // No agregar filtro de fecha para "todos"
          break;
      }

      const resultado = await getSingleValue<number>(query, params);
      return resultado || 0;
    } catch (error: any) {
      console.error("Error en obtenerVentasTrabajadorPeriodo:", error);
      return 0;
    }
  }

  // Obtener consumos propios de un trabajador en un período específico
  static async obtenerConsumosPropiosPeriodo(
    puntoId: number,
    trabajadorNombre: string,
    periodo: "hoy" | "semana" | "mes" | "todos" | "periodo",
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<number> {
    try {
      let query = `
        SELECT COALESCE(SUM(monto_consumo), 0) as total_consumos
        FROM HistorialConsumosPropios 
        WHERE punto_id = ? AND trabajador_nombre = ?
      `;
      const params: any[] = [puntoId, trabajadorNombre];

      switch (periodo) {
        case "hoy":
          const hoy = getFechaLocal();
          query += ` AND DATE(fecha_consumo) = DATE(?)`;
          params.push(hoy);
          break;
        case "semana":
          const hoySemana = getFechaLocal();
          const inicioSemanaDate = new Date();
          inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
          const inicioSemanaStr = inicioSemanaDate.toISOString().split("T")[0];
          query += ` AND fecha_consumo >= DATE(?) AND fecha_consumo <= DATE(?)`;
          params.push(inicioSemanaStr, hoySemana);
          break;
        case "mes":
          const hoyMes = getFechaLocal();
          const mesActual = hoyMes.substring(0, 7); // YYYY-MM
          query += ` AND strftime('%Y-%m', fecha_consumo) = ?`;
          params.push(mesActual);
          break;
        case "periodo":
          if (fechaInicio && fechaFin) {
            query += ` AND DATE(fecha_consumo) >= DATE(?) AND DATE(fecha_consumo) <= DATE(?)`;
            params.push(fechaInicio, fechaFin);
          }
          break;
        case "todos":
          // No agregar filtro de fecha para "todos"
          break;
      }

      console.log(
        `🔍 DEBUG obtenerConsumosPropiosPeriodo: trabajador=${trabajadorNombre}, período=${periodo}`,
      );
      console.log(`🔍 DEBUG Query SQL: ${query}`);
      console.log(`🔍 DEBUG Params:`, params);

      const result = await getFirst<{ total_consumos: number }>(query, params);
      const consumos = Math.abs(result?.total_consumos || 0);

      console.log(
        `📊 DEBUG Consumos encontrados: $${consumos} para ${trabajadorNombre} en período ${periodo}`,
      );

      // Debug adicional: ver todos los consumos propios del trabajador
      const debugQuery = `
        SELECT nombre, precio, fecha_gasto, creado_en 
        FROM Gastos 
        WHERE punto_id = ? AND activo = 1
        AND categoria = 'General'
        AND nombre LIKE 'Consumo Propio - ${trabajadorNombre}%'
        ORDER BY fecha_gasto DESC
      `;
      const debugResult = await executeQuery<any>(debugQuery, [puntoId]);
      console.log(
        `🔍 DEBUG Todos los consumos de ${trabajadorNombre}:`,
        debugResult,
      );

      return consumos;
    } catch (error) {
      console.error("Error obteniendo consumos propios período:", error);
      return 0;
    }
  }

  // Obtener gastos recurrentes
  static async obtenerGastosRecurrentes(puntoId: number): Promise<Gasto[]> {
    try {
      const gastos = await executeQuery<Gasto>(
        `SELECT * FROM Gastos 
         WHERE punto_id = ? AND recurrente = 1 AND activo = 1
         ORDER BY fecha_gasto DESC`,
        [puntoId],
      );
      return gastos;
    } catch (error) {
      console.error("Error obteniendo gastos recurrentes:", error);
      return [];
    }
  }

  // Crear un nuevo gasto (versión simplificada)
  static async crearGastoNuevo(
    request: CrearGastoRequest,
    puntoId: number,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // DEBUG: Log para cazar el bug de deuda
      console.log("DEBUG DEUDA:", request.deuda, request.categoria);

      // Si se marca como deuda, crear una deuda en lugar de un gasto
      // PERO SOLO si no es un salario (los salarios no deben ser deudas)
      const esDeuda = request.deuda === true;
      const esSalario = request.categoria === "Salario";

      if (esDeuda && !esSalario) {
        // Validaciones para deudas
        if (!request.descripcion?.trim()) {
          return {
            success: false,
            message: "La descripción de la deuda es requerida",
          };
        }

        // Determinar el monto según la categoría
        let montoDeuda = 0;
        if (request.categoria === "General") {
          if (!request.precio || request.precio <= 0) {
            return {
              success: false,
              message: "El monto de la deuda debe ser un número positivo",
            };
          }
          montoDeuda = request.precio || 0;
        } else if (request.categoria === "Salario") {
          const esPorcentaje = request.es_porcentaje === true;

          if (esPorcentaje) {
            const p = Number(request.salario_empleado);

            if (isNaN(p) || p <= 0 || p > 100) {
              return {
                success: false,
                message: "El porcentaje de salario debe estar entre 1 y 100",
              };
            }

            // cálculo deuda con porcentaje
            const gananciasDiarias = await this.obtenerGananciasPeriodo(
              puntoId,
              "hoy" as any,
              false,
            );

            const montoDiario = (gananciasDiarias * p) / 100;
            montoDeuda = montoDiario * 15;
          } else {
            const f = Number(request.salario_fijo);

            if (isNaN(f) || f <= 0) {
              return {
                success: false,
                message: "El salario fijo debe ser mayor a 0",
              };
            }

            // usar salario fijo directamente
            montoDeuda = f;
          }
        }

        // Importar el helper de préstamos dinámicamente
        const { PrestamoDeudaHelper } = await import("../databaseHelper");

        // Crear la deuda
        const deudaCreada = await PrestamoDeudaHelper.create(
          "deuda",
          request.descripcion?.trim() || "Deuda generada desde gastos",
          montoDeuda,
          request.fecha_gasto,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // 30 días para vencer
          puntoId,
          "CUP",
          `Generada automáticamente desde gasto: ${request.nombre}`,
        );

        if (deudaCreada.changes > 0) {
          return {
            success: true,
            message: "Deuda creada correctamente. Redirigiendo a préstamos...",
            data: {
              redirect: "prestamos",
              deudaId: deudaCreada.lastInsertRowId,
            },
          };
        } else {
          return {
            success: false,
            message: "Error al crear la deuda",
          };
        }
      }

      // Validaciones básicas para gastos normales
      if (!request.nombre?.trim()) {
        return {
          success: false,
          message: "El nombre del gasto es requerido",
        };
      }

      if (!request.fecha_gasto) {
        return {
          success: false,
          message: "La fecha del gasto es requerida",
        };
      }

      // Validaciones específicas por categoría
      if (request.categoria === "General") {
        if (!request.precio || request.precio <= 0) {
          return {
            success: false,
            message: "El precio del gasto general debe ser un número positivo",
          };
        }
      } else if (request.categoria === "Salario") {
        // Validación para salarios (porcentaje o fijo)
        // BLINDAR: nunca asumir valores por defecto peligrosos
        const esPorcentaje = request.es_porcentaje === true;

        if (esPorcentaje) {
          // Salario porcentual - validar porcentaje
          const p = Number(request.salario_empleado);

          if (isNaN(p) || p <= 0 || p > 100) {
            return {
              success: false,
              message: "El porcentaje de salario debe estar entre 1 y 100",
            };
          }
        } else {
          // Salario fijo - validar monto fijo, ignorar porcentaje
          const f = Number(request.salario_fijo);

          if (isNaN(f) || f <= 0) {
            return {
              success: false,
              message: "El salario fijo debe ser mayor a 0",
            };
          }
        }

        if (request.recurrente && !request.periodicidad) {
          return {
            success: false,
            message: "Los salarios recurrentes deben tener una periodicidad",
          };
        }
      }

      // Crear el gasto con estructura actualizada
      const gastoCreado = await this.crearGasto({
        punto_id: puntoId,
        nombre: request.nombre.trim(),
        categoria: request.categoria,
        precio:
          request.categoria === "General"
            ? request.precio || 0
            : request.es_porcentaje
              ? 0
              : request.salario_fijo || 0,
        descripcion: request.descripcion?.trim() || undefined,
        tipo: request.tipo,
        fecha_gasto: getFechaLocal(), // 🔧 CORRECCIÓN: Forzar siempre la fecha actual para evitar problemas de zona horaria
        recurrente: request.recurrente || false,
        periodicidad: request.periodicidad || undefined,
        activo: true,
        porcentaje:
          request.categoria === "Salario" && request.es_porcentaje
            ? request.salario_empleado
            : undefined,
        es_porcentaje:
          request.categoria === "Salario" ? (request.es_porcentaje ? 1 : 0) : 0,
      });

      // Si es un salario, el porcentaje ya se guardó en el campo porcentaje
      // No modificar la descripción, mantener la que ingresó el usuario

      if (gastoCreado.success) {
        return {
          success: true,
          message: "Gasto creado correctamente",
          data: gastoCreado.data,
        };
      } else {
        return {
          success: false,
          message: gastoCreado.message || "Error al crear el gasto",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Error al crear el gasto",
      };
    }
  }

  // Crear un gasto
  static async crearGasto(
    gasto: Omit<Gasto, "id" | "creado_en" | "actualizado_en">,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(
        `💰 Creando ${gasto.categoria}: ${gasto.nombre} (${gasto.tipo})`,
      );
      console.log(`📅 Fecha del gasto (recibida): ${gasto.fecha_gasto}`);
      console.log(`📅 Fecha actual: ${getFechaLocal()}`);
      console.log(`🔍 Tipo de fecha_gasto: ${typeof gasto.fecha_gasto}`);
      console.log(`🔍 Valor de fecha_gasto:`, gasto.fecha_gasto);

      // Usar fechas locales en lugar de CURRENT_TIMESTAMP
      const ahora =
        getFechaLocal() +
        " " +
        new Date().toLocaleTimeString("es-CU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

      const result = await executeNonQuery(
        `INSERT INTO Gastos (punto_id, nombre, categoria, precio, descripcion, tipo, fecha_gasto, recurrente, periodicidad, activo, porcentaje, es_porcentaje, salario_fijo, creado_en, actualizado_en) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gasto.punto_id,
          gasto.nombre.trim(),
          gasto.categoria,
          gasto.precio || 0,
          gasto.descripcion || null,
          gasto.tipo,
          gasto.fecha_gasto,
          gasto.recurrente ? 1 : 0,
          gasto.periodicidad || null,
          gasto.activo !== false ? 1 : 0,
          gasto.porcentaje || null,
          gasto.es_porcentaje ? 1 : 0,
          gasto.salario_fijo || null,
          ahora, // creado_en con fecha local
          ahora, // actualizado_en con fecha local
        ],
      );

      if (result.changes > 0) {
        const nuevoGasto = await getFirst<Gasto>(
          "SELECT * FROM Gastos WHERE id = ?",
          [result.lastInsertRowId],
        );
        return {
          success: true,
          message: "Gasto creado exitosamente",
          data: nuevoGasto,
        };
      } else {
        return {
          success: false,
          message: "No se pudo crear el gasto",
        };
      }
    } catch (error: any) {
      console.error("Error en crearGasto:", error);
      return {
        success: false,
        message: error.message || "Error al crear el gasto",
      };
    }
  }

  // Actualizar un gasto
  static async actualizarGasto(
    id: number,
    gasto: Partial<Gasto>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const campos = [];
      const valores = [];

      if (gasto.nombre !== undefined) {
        campos.push("nombre = ?");
        valores.push(gasto.nombre.trim());
      }
      if (gasto.precio !== undefined) {
        campos.push("precio = ?");
        valores.push(gasto.precio);
      }
      if (gasto.tipo !== undefined) {
        campos.push("tipo = ?");
        valores.push(gasto.tipo);
      }
      if (gasto.categoria !== undefined) {
        campos.push("categoria = ?");
        valores.push(gasto.categoria);
      }
      if (gasto.descripcion !== undefined) {
        campos.push("descripcion = ?");
        valores.push(gasto.descripcion);
      }
      if (gasto.fecha_gasto !== undefined) {
        campos.push("fecha_gasto = ?");
        valores.push(gasto.fecha_gasto);
      }
      if (gasto.recurrente !== undefined) {
        campos.push("recurrente = ?");
        valores.push(gasto.recurrente ? 1 : 0);
      }
      if (gasto.periodicidad !== undefined) {
        campos.push("periodicidad = ?");
        valores.push(gasto.periodicidad);
      }
      if (gasto.porcentaje !== undefined) {
        campos.push("porcentaje = ?");
        valores.push(gasto.porcentaje);
      }

      if (campos.length === 0) {
        return {
          success: false,
          message: "No hay campos para actualizar",
        };
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      valores.push(ahora);
      valores.push(id);

      const query = `
        UPDATE Gastos 
        SET ${campos.join(", ")}, actualizado_en = ? 
        WHERE id = ?
      `;

      const result = await executeNonQuery(query, valores);

      if (result.changes > 0) {
        return {
          success: true,
          message: "Gasto actualizado correctamente",
        };
      } else {
        return {
          success: false,
          message: "No se encontró el gasto para actualizar",
        };
      }
    } catch (error: any) {
      console.error("Error en actualizarGasto:", error);
      return {
        success: false,
        message: error.message || "Error al actualizar el gasto",
      };
    }
  }

  // Eliminar un gasto (desactivar)
  static async eliminarGasto(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Primero obtener el gasto a eliminar para obtener su nombre
      const gastoAEliminar = await getFirst<Gasto>(
        "SELECT nombre FROM Gastos WHERE id = ?",
        [id],
      );

      if (!gastoAEliminar) {
        return {
          success: false,
          message: "No se encontró el gasto",
        };
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      // Desactivar el gasto principal
      const result = await executeNonQuery(
        "UPDATE Gastos SET activo = 0, actualizado_en = ? WHERE id = ?",
        [ahora, id],
      );

      // Si es un salario, también eliminar todos los generados automáticamente con el mismo nombre
      if (
        gastoAEliminar.nombre &&
        gastoAEliminar.nombre.toLowerCase().includes("salario")
      ) {
        await executeNonQuery(
          `UPDATE Gastos SET activo = 0, actualizado_en = ? 
           WHERE nombre = ? AND categoria = 'Salario' AND tipo = 'casual' 
           AND descripcion LIKE '%Generado automáticamente%' AND activo = 1`,
          [ahora, gastoAEliminar.nombre],
        );
        console.log(
          `🗑️ Eliminados salarios generados con nombre: ${gastoAEliminar.nombre}`,
        );
      }

      if (result.changes > 0) {
        return {
          success: true,
          message: "Gasto eliminado correctamente",
        };
      } else {
        return {
          success: false,
          message: "No se pudo eliminar el gasto",
        };
      }
    } catch (error: any) {
      console.error("Error en eliminarGasto:", error);
      return {
        success: false,
        message: error.message || "Error al eliminar el gasto",
      };
    }
  }

  // Obtener estadísticas de gastos
  static async obtenerEstadisticasGastos(
    puntoId: number,
    periodo: "hoy" | "semana" | "mes" | "total",
  ): Promise<{
    total: number;
    cantidad: number;
    promedio: number;
  }> {
    try {
      // Obtener todos los gastos del período
      let query = `
        SELECT id, nombre, precio, categoria, fecha_gasto
        FROM Gastos 
        WHERE punto_id = ? AND activo = 1
      `;
      const params: any[] = [puntoId];

      switch (periodo) {
        case "hoy":
          const hoy = getFechaLocal();
          query += ` AND DATE(fecha_gasto) = DATE(?)`;
          params.push(hoy);
          break;
        case "semana":
          const hoySemana = getFechaLocal();
          const inicioSemanaDate = new Date();
          inicioSemanaDate.setDate(inicioSemanaDate.getDate() - 7);
          const inicioSemanaStr = inicioSemanaDate.toISOString().split("T")[0];
          query += ` AND fecha_gasto >= DATE(?) AND fecha_gasto <= DATE(?)`;
          params.push(inicioSemanaStr, hoySemana);
          break;
        case "mes":
          const hoyMes = getFechaLocal();
          const mesActual = hoyMes.substring(0, 7); // YYYY-MM
          query += ` AND strftime('%Y-%m', fecha_gasto) = ?`;
          params.push(mesActual);
          break;
        // 'total' no necesita filtro adicional
      }

      const gastos = await executeQuery<any>(query, params);

      let total = 0;
      let montosReales: number[] = [];

      for (const gasto of gastos) {
        let montoReal = 0;

        if (gasto.categoria === "Salario") {
          // Para el período "hoy": solo calcular salario del trabajador que está trabajando hoy
          if (periodo === "hoy") {
            console.log(
              `🔍 DEBUG estadística HOY: Verificando ${gasto.nombre} (ID: ${gasto.id})`,
            );

            const estaTrabajandoHoy = await this.debeGenerarSalarioHoy(
              puntoId,
              gasto.id,
            );

            console.log(
              `🔍 DEBUG estadística HOY: ${gasto.nombre} - debeGenerarSalario=${estaTrabajandoHoy}`,
            );

            if (!estaTrabajandoHoy) {
              montoReal = 0;
              console.log(
                `💰 Salario HOY (${gasto.nombre}): NO está trabajando hoy → $0`,
              );
            } else {
              const fechaHoy = getFechaLocal();
              const porcentajeVigente =
                await this.obtenerPorcentajeVigenteEnFecha(gasto.id, fechaHoy);

              const ventasHoy = await this.obtenerGananciasPeriodo(
                puntoId,
                "hoy",
                false,
              );

              const esPorcentaje =
                gasto.es_porcentaje === 1 ||
                (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
              const salarioTeorico = (ventasHoy * porcentajeVigente) / 100;

              // Si es salario fijo, usar el monto fijo en lugar del cálculo porcentual
              const montoSalarioFinal = !esPorcentaje
                ? gasto.precio || 0
                : salarioTeorico;

              const consumosPropios = await this.obtenerConsumosPropios(
                puntoId,
                gasto.nombre || "Sin nombre",
              );

              montoReal = montoSalarioFinal - consumosPropios;

              console.log(
                `💰 Salario HOY (${gasto.nombre}): ventas=$${ventasHoy.toFixed(2)}, %=${porcentajeVigente}%, teórico=$${salarioTeorico.toFixed(2)}, consumos=$${consumosPropios.toFixed(2)}, final=$${montoReal.toFixed(2)}`,
              );
            }
          } else {
            const fechaHoy = getFechaLocal();
            const porcentajeVigente =
              await this.obtenerPorcentajeVigenteEnFecha(gasto.id, fechaHoy);

            const ventasHoy = await this.obtenerGananciasPeriodo(
              puntoId,
              "hoy",
              false,
            );

            // Calcular salario teórico
            const esPorcentaje =
              gasto.es_porcentaje === 1 ||
              (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
            const salarioTeorico = (ventasHoy * porcentajeVigente) / 100;

            // Si es salario fijo, usar el monto fijo en lugar del cálculo porcentual
            const montoSalarioFinal = !esPorcentaje
              ? gasto.salario_fijo || 0
              : salarioTeorico;

            // Obtener consumos propios del trabajador
            const consumosPropios = await this.obtenerConsumosPropios(
              puntoId,
              gasto.nombre || "Sin nombre",
            );

            // Salario final = teórico - consumos
            montoReal = montoSalarioFinal - consumosPropios;

            console.log(
              `💰 Salario ${periodo.toUpperCase()} (${gasto.nombre}): ventas=$${ventasHoy.toFixed(2)}, %=${porcentajeVigente}%, teórico=$${salarioTeorico.toFixed(2)}, consumos=$${consumosPropios.toFixed(2)}, final=$${montoReal.toFixed(2)}`,
            );
          }
        } else {
          // Para gastos fijos: usar el precio directamente
          montoReal = gasto.precio || 0;
        }

        total += montoReal;
        montosReales.push(montoReal);
      }

      const promedio =
        montosReales.length > 0
          ? montosReales.reduce((a, b) => a + b, 0) / montosReales.length
          : 0;

      return {
        total,
        cantidad: gastos.length,
        promedio,
      };
    } catch (error) {
      console.error("Error en obtenerEstadisticasGastos:", error);
      return {
        total: 0,
        cantidad: 0,
        promedio: 0,
      };
    }
  }

  // Buscar gastos por nombre
  static async buscarGastos(
    puntoId: number,
    termino: string,
  ): Promise<Gasto[]> {
    try {
      const query = `
        SELECT * FROM Gastos 
        WHERE punto_id = ? AND activo = 1 AND (nombre LIKE ? OR descripcion LIKE ?)
        ORDER BY fecha_gasto DESC, creado_en DESC
        LIMIT 50
      `;
      return await executeQuery<Gasto>(query, [
        puntoId,
        `%${termino}%`,
        `%${termino}%`,
      ]);
    } catch (error) {
      console.error("Error en buscarGastos:", error);
      return [];
    }
  }

  // Obtener gastos diarios del mes (separados por día)
  static async obtenerGastosDiariosMes(
    puntoId: number,
  ): Promise<
    { fecha: string; total: number; salarios: number; generales: number }[]
  > {
    try {
      const hoy = getFechaLocal();
      const mesActual = hoy.substring(0, 7); // YYYY-MM

      const query = `
        SELECT 
          DATE(fecha_gasto) as fecha,
          SUM(CASE WHEN categoria = 'Salario' THEN precio ELSE 0 END) as salarios,
          SUM(CASE WHEN categoria = 'General' THEN precio ELSE 0 END) as generales,
          SUM(precio) as total
        FROM Gastos 
        WHERE punto_id = ? AND activo = 1
          AND strftime('%Y-%m', fecha_gasto) = ?
        GROUP BY DATE(fecha_gasto)
        ORDER BY fecha
      `;

      const resultados = await executeQuery<{
        fecha: string;
        salarios: number;
        generales: number;
        total: number;
      }>(query, [puntoId, mesActual]);

      return resultados;
    } catch (error) {
      console.error("Error en obtenerGastosDiariosMes:", error);
      return [];
    }
  }

  // Obtener gastos por categoría
  static async obtenerGastosPorCategoria(
    puntoId: number,
  ): Promise<{ categoria: string; total: number; cantidad: number }[]> {
    try {
      const query = `
        SELECT 
          categoria,
          COALESCE(SUM(precio), 0) as total,
          COUNT(*) as cantidad
        FROM Gastos 
        WHERE punto_id = ? AND activo = 1
        GROUP BY categoria
        ORDER BY total DESC
      `;
      return await executeQuery(query, [puntoId]);
    } catch (error) {
      console.error("Error en obtenerGastosPorCategoria:", error);
      return [];
    }
  }

  // UPDATE: Editar un gasto existente (mejorado)
  static async update_gasto(
    id: number,
    request: Partial<CrearGastoRequest>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const campos = [];
      const valores = [];

      if (request.nombre !== undefined) {
        campos.push("nombre = ?");
        valores.push(request.nombre.trim());
      }
      if (request.categoria !== undefined) {
        campos.push("categoria = ?");
        valores.push(request.categoria);
      }
      if (request.precio !== undefined) {
        campos.push("precio = ?");
        valores.push(request.precio);
      }
      if (request.salario_empleado !== undefined) {
        campos.push("salario_empleado = ?");
        valores.push(request.salario_empleado);
      }
      if (request.descripcion !== undefined) {
        campos.push("descripcion = ?");
        valores.push(request.descripcion);
      }
      if (request.tipo !== undefined) {
        campos.push("tipo = ?");
        valores.push(request.tipo);
      }
      if (request.fecha_gasto !== undefined) {
        campos.push("fecha_gasto = ?");
        valores.push(request.fecha_gasto);
      }
      if (request.recurrente !== undefined) {
        campos.push("recurrente = ?");
        valores.push(request.recurrente ? 1 : 0);
      }
      if (request.periodicidad !== undefined) {
        campos.push("periodicidad = ?");
        valores.push(request.periodicidad);
      }
      if (request.deuda !== undefined) {
        campos.push("deuda = ?");
        valores.push(request.deuda ? 1 : 0);
      }

      if (campos.length === 0) {
        return {
          success: false,
          message: "No hay campos para actualizar",
        };
      }

      valores.push(id);
      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();
      valores.push(ahora);

      const query = `
        UPDATE Gastos 
        SET ${campos.join(", ")}, actualizado_en = ? 
        WHERE id = ?
      `;

      const result = await executeNonQuery(query, valores);

      if (result.changes > 0) {
        return {
          success: true,
          message: "Gasto actualizado correctamente",
        };
      } else {
        return {
          success: false,
          message: "No se encontró el gasto para actualizar",
        };
      }
    } catch (error: any) {
      console.error("Error en update_gasto:", error);
      return {
        success: false,
        message: error.message || "Error al actualizar el gasto",
      };
    }
  }

  // DELETE: Eliminar un gasto (alias de eliminarGasto)
  static async delete_gasto(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    return await this.eliminarGasto(id);
  }

  // Calcular gastos de hoy con lógica de salarios
  static async calcular_gastos_hoy(
    puntoId: number,
  ): Promise<{ success: boolean; message: string; total: number }> {
    try {
      // Usar la función correcta que tiene el filtro de trabajador activo
      const estadisticas = await this.obtenerEstadisticasGastos(puntoId, "hoy");

      return {
        success: true,
        message: `Gastos de hoy calculados: $${estadisticas.total.toFixed(2)}`,
        total: estadisticas.total,
      };
    } catch (error: any) {
      console.error("Error en calcular_gastos_hoy:", error);
      return {
        success: false,
        message: error.message || "Error al calcular gastos de hoy",
        total: 0,
      };
    }
  }

  static async calcular_gastos_mes(
    puntoId: number,
  ): Promise<{ success: boolean; message: string; total: number }> {
    try {
      console.log(`🔍 Calculando gastos del mes para puntoId: ${puntoId}`);

      // Obtener gastos diarios del mes (ya separados por día)
      const gastosDiarios = await this.obtenerGastosDiariosMes(puntoId);

      console.log(`� Gastos diarios encontrados: ${gastosDiarios.length} días`);

      // Sumar el total del mes usando los gastos reales de cada día
      const total = gastosDiarios.reduce((sum, dia) => sum + dia.total, 0);

      console.log(
        `📊 Total gastos del mes (sumando días): $${total.toFixed(2)}`,
      );

      return {
        success: true,
        message: `Gastos del mes calculados: $${total.toFixed(2)}`,
        total,
      };
    } catch (error: any) {
      console.error("Error en calcular_gastos_mes:", error);
      return {
        success: false,
        message: error.message || "Error al calcular gastos del mes",
        total: 0,
      };
    }
  }

  // Crear gasto como deuda
  static async crear_gasto_deuda(
    nombre: string,
    valor: number,
    descripcionDeuda: string,
    puntoId: number,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const hoy = getFechaLocal();

      // Crear el gasto como deuda
      const resultado = await this.crearGasto({
        nombre: nombre,
        categoria: "General",
        tipo: "casual",
        descripcion: `Gasto generado como deuda - ${descripcionDeuda}`,
        fecha_gasto: hoy,
        recurrente: false,
        precio: valor,
        punto_id: puntoId,
      });

      if (resultado.success) {
        return {
          success: true,
          message: `Gasto deuda creado correctamente por $${valor.toFixed(2)}`,
          data: resultado.data,
        };
      } else {
        return {
          success: false,
          message: resultado.message || "Error al crear gasto deuda",
        };
      }
    } catch (error: any) {
      console.error("Error en crear_gasto_deuda:", error);
      return {
        success: false,
        message: error.message || "Error al crear gasto deuda",
      };
    }
  }

  // Obtener historial de salarios diarios de un trabajador específico
  static async obtenerHistorialSalarioDiario(
    puntoId: number,
    gastoId: number,
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      fecha: string;
      dia: string;
      ventas: number;
      porcentaje: number;
      sueldo: number;
    }[];
  }> {
    try {
      // Obtener información del gasto (trabajador)
      const gasto = await getFirst<Gasto>(
        "SELECT * FROM Gastos WHERE id = ? AND punto_id = ? AND categoria = 'Salario' AND activo = 1",
        [gastoId, puntoId],
      );

      if (!gasto) {
        return {
          success: false,
          message: "No se encontró el salario del trabajador",
        };
      }

      const porcentaje = gasto.porcentaje || 0;
      const nombreTrabajador = gasto.nombre;
      const fechaCreacion = gasto.fecha_gasto; // Fecha de creación del salario

      // Obtener el primer día del mes o la fecha de creación del trabajador (lo que sea más reciente)
      const ahora = new Date();
      const año = ahora.getFullYear();
      const mes = ahora.getMonth();
      const primerDiaMes = new Date(año, mes, 1);
      const ultimoDiaMes = new Date(año, mes + 1, 0);

      // La fecha de inicio es el máximo entre: primer día del mes y fecha de creación del trabajador
      const fechaInicioCalculo = new Date(
        Math.max(primerDiaMes.getTime(), new Date(fechaCreacion).getTime()),
      );

      const fechaInicio = fechaInicioCalculo.toISOString().split("T")[0];
      const fechaFin = ultimoDiaMes.toISOString().split("T")[0];

      // Obtener ventas diarias del mes actual para calcular salarios generados
      const ventasDiarias = await executeQuery<{
        fecha: string;
        total_ventas: number;
      }>(
        `
        SELECT 
          DATE(creado_en) as fecha,
          SUM(total_venta) as total_ventas
        FROM Venta 
        WHERE punto_id = ? 
          AND DATE(creado_en) >= DATE(?) 
          AND DATE(creado_en) <= DATE(?)
          AND es_directa = 0
        GROUP BY DATE(creado_en)
        ORDER BY fecha ASC
      `,
        [puntoId, fechaInicio, fechaFin],
      );

      console.log(
        `🔍 Ventas encontradas para historial (${fechaInicio} a ${fechaFin}):`,
      );
      console.log(ventasDiarias);

      // Generar lista completa de días del mes con sus salarios generados
      const historial: {
        fecha: string;
        dia: string;
        ventas: number;
        porcentaje: number;
        sueldo: number;
        consumos_propios: number;
        salario_teorico: number;
        es_porcentaje: boolean;
        salario_fijo: number;
      }[] = [];

      // Llenar los días desde la fecha de inicio hasta el fin del mes
      for (
        let d = fechaInicioCalculo.getDate();
        d <= ultimoDiaMes.getDate();
        d++
      ) {
        const fecha = new Date(año, mes, d);
        const fechaStr = fecha.toISOString().split("T")[0];

        // Solo incluir días desde la fecha de creación del trabajador
        if (fecha < fechaInicioCalculo) continue;

        const nombreDia = fecha.toLocaleDateString("es-ES", {
          weekday: "long",
        });

        // Obtener el porcentaje que estaba vigente en esta fecha específica
        const porcentajeDia = await this.obtenerPorcentajeVigenteEnFecha(
          gastoId,
          fechaStr,
        );

        // Para otros días, buscar ventas directamente
        const ventaDia = ventasDiarias.find((v) => v.fecha === fechaStr);
        const ventasDelDia = ventaDia?.total_ventas || 0;

        // Verificar si este trabajador estaba seleccionado en la apertura de este día específico
        const estabaTrabajandoEsteDia = await this.debeGenerarSalarioEnFecha(
          puntoId,
          gastoId!,
          fechaStr,
        );

        if (!estabaTrabajandoEsteDia) {
          // Si no estaba trabajando este día, mostrar sueldo 0
          historial.push({
            fecha: fechaStr,
            dia: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1),
            ventas: ventasDelDia,
            porcentaje: porcentajeDia,
            sueldo: 0,
            consumos_propios: 0,
            salario_teorico: 0,
            es_porcentaje: gasto.es_porcentaje === 1,
            salario_fijo: gasto.salario_fijo || 0,
          });
          continue;
        }

        let ventas = 0;
        let sueldo = 0;
        let consumosPropios = 0;
        let salarioTeorico = 0;

        // Si es hoy, usar el nuevo cálculo
        if (fechaStr === getFechaLocal()) {
          ventas = await this.obtenerGananciasPeriodo(puntoId, "hoy", false);

          const esPorcentaje =
            gasto.es_porcentaje === 1 ||
            (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
          salarioTeorico = esPorcentaje
            ? (ventas * porcentajeDia) / 100
            : gasto.salario_fijo || 0;

          // Obtener consumos propios del trabajador del día de hoy
          consumosPropios = await this.obtenerConsumosPropiosPeriodo(
            puntoId,
            nombreTrabajador,
            "hoy",
          );

          sueldo = salarioTeorico - consumosPropios; // Salario final

          console.log(
            `🔍 Hoy (${fechaStr}): ventas=${ventas}, teórico=${salarioTeorico}, consumos=${consumosPropios}, final=${sueldo}, %=${porcentajeDia}`,
          );
        } else {
          // Para otros días, usar las ventas ya obtenidas
          ventas = ventasDelDia;

          const esPorcentaje =
            gasto.es_porcentaje === 1 ||
            (gasto.es_porcentaje === undefined && gasto.porcentaje! > 0);
          salarioTeorico = esPorcentaje
            ? (ventas * porcentajeDia) / 100
            : gasto.salario_fijo || 0;

          // Obtener consumos propios del trabajador para esta fecha específica
          consumosPropios = await this.obtenerConsumosPropiosPeriodo(
            puntoId,
            nombreTrabajador,
            "periodo",
            fechaStr,
            fechaStr, // Mismo día para buscar consumos de esa fecha específica
          );

          sueldo = salarioTeorico - consumosPropios; // Salario final con consumos del día
        }

        historial.push({
          fecha: fechaStr,
          dia: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1),
          ventas,
          porcentaje: porcentajeDia, // Usar el porcentaje histórico del día
          sueldo,
          consumos_propios: consumosPropios,
          salario_teorico: salarioTeorico,
          es_porcentaje: gasto.es_porcentaje === 1,
          salario_fijo: gasto.salario_fijo || 0,
        });
      }

      // Calcular totales
      const totalVentas = historial.reduce((sum, dia) => sum + dia.ventas, 0);
      const totalSueldoGenerado = historial.reduce(
        (sum, dia) => sum + dia.sueldo,
        0,
      );

      console.log(
        `📊 Historial de sueldo - ${nombreTrabajador} (desde ${fechaInicio})`,
      );
      console.log(`📅 Período: ${fechaInicio} a ${fechaFin}`);
      console.log(`👤 Creado el: ${fechaCreacion}`);
      console.log(`💰 Total ventas período: $${totalVentas.toFixed(2)}`);
      console.log(
        `💼 Total sueldo generado: $${totalSueldoGenerado.toFixed(2)}`,
      );
      console.log(`📈 Porcentaje configurado: ${porcentaje}%`);
      console.log(`🔍 Días calculados: ${historial.length}`);

      return {
        success: true,
        message: `Historial de salarios generados de ${nombreTrabajador} cargado correctamente`,
        data: historial,
      };
    } catch (error: any) {
      console.error("Error en obtenerHistorialSalarioDiario:", error);
      return {
        success: false,
        message: error.message || "Error al obtener historial de salario",
      };
    }
  }

  // Obtener salarios activos de un punto para selección en Consumo Propio
  static async obtenerSalariosActivos(puntoId: number): Promise<Gasto[]> {
    try {
      const salarios = await executeQuery<Gasto>(
        `
        SELECT * FROM Gastos 
        WHERE punto_id = ? 
          AND categoria = 'Salario' 
          AND activo = 1
          AND (
            (es_porcentaje = 1 AND porcentaje IS NOT NULL AND porcentaje > 0)
            OR 
            (es_porcentaje = 0 AND salario_fijo IS NOT NULL AND salario_fijo > 0)
          )
        ORDER BY nombre ASC
      `,
        [puntoId],
      );

      console.log(
        `👥 Salarios activos encontrados para punto ${puntoId}: ${salarios.length}`,
      );
      return salarios;
    } catch (error: any) {
      console.error("Error en obtenerSalariosActivos:", error);
      throw error;
    }
  }

  // Verificar si un trabajador trabajó algún día de la última semana
  static async verificarTrabajoSemanal(
    puntoId: number,
    trabajadorId: number,
  ): Promise<boolean> {
    try {
      console.log(
        `🔍 DEBUG verificarTrabajoSemanal: puntoId=${puntoId}, trabajadorId=${trabajadorId}`,
      );

      // Verificar cada día de los últimos 7 días
      for (let i = 0; i < 7; i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        const fechaStr = fecha.toISOString().split("T")[0];

        const trabajoEsteDia = await this.debeGenerarSalarioEnFecha(
          puntoId,
          trabajadorId,
          fechaStr,
        );

        if (trabajoEsteDia) {
          console.log(
            `🔍 DEBUG verificarTrabajoSemanal: ${trabajadorId} trabajó el ${fechaStr}`,
          );
          return true;
        }
      }

      console.log(
        `🔍 DEBUG verificarTrabajoSemanal: ${trabajadorId} no trabajó ningún día de la semana`,
      );
      return false;
    } catch (error) {
      console.error("Error verificando trabajo semanal:", error);
      return false;
    }
  }

  // Verificar si un trabajador debe generar salario hoy (está seleccionado en la apertura)
  static async debeGenerarSalarioHoy(
    puntoId: number,
    trabajadorId: number,
  ): Promise<boolean> {
    try {
      const hoy = getFechaLocal();

      console.log(
        `🔍 DEBUG debeGenerarSalarioHoy: puntoId=${puntoId}, trabajadorId=${trabajadorId}, fecha=${hoy}`,
      );

      // Primero, veamos qué hay en la tabla de apertura hoy
      const todasLasAperturas = await executeQuery<{
        trabajador_id: number;
        fecha_cierre: string;
      }>(
        "SELECT trabajador_id, fecha_cierre FROM CierreCaja WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ? AND trabajador_id IS NOT NULL",
        [puntoId, hoy],
      );

      console.log(`🔍 DEBUG todasLasAperturas:`, todasLasAperturas);

      const resultado = await getFirst<{ trabajador_id: number }>(
        "SELECT trabajador_id FROM CierreCaja WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ? AND trabajador_id IS NOT NULL",
        [puntoId, hoy],
      );

      const trabajadorApertura = resultado?.trabajador_id || null;

      console.log(
        `🔍 DEBUG debeGenerarSalarioHoy: trabajadorApertura=${trabajadorApertura}, trabajadorId=${trabajadorId}, resultado=${trabajadorApertura === trabajadorId}`,
      );

      return trabajadorApertura === trabajadorId;
    } catch (error: any) {
      console.error("Error verificando si debe generar salario hoy:", error);
      return false; // Si hay error, no genera salario para evitar problemas
    }
  }

  // Verificar si un trabajador estaba seleccionado en la apertura de una fecha específica
  static async debeGenerarSalarioEnFecha(
    puntoId: number,
    trabajadorId: number,
    fecha: string,
  ): Promise<boolean> {
    try {
      const resultado = await getFirst<{ trabajador_id: number }>(
        "SELECT trabajador_id FROM CierreCaja WHERE punto_id = ? AND tipo = 'apertura' AND DATE(fecha_cierre) = ? AND trabajador_id IS NOT NULL",
        [puntoId, fecha],
      );
      const trabajadorApertura = resultado?.trabajador_id || null;
      return trabajadorApertura === trabajadorId;
    } catch (error: any) {
      console.error(
        "Error verificando si trabajador estaba en apertura:",
        error,
      );
      return false;
    }
  }

  // Obtener consumos propios de un trabajador
  static async obtenerConsumosPropios(
    puntoId: number,
    trabajadorNombre: string,
  ): Promise<number> {
    try {
      const consumos = await executeQuery<{ precio: number }>(
        `
        SELECT precio FROM Gastos 
        WHERE punto_id = ? 
          AND categoria = 'General' 
          AND nombre LIKE ?
          AND activo = 1
        `,
        [puntoId, `Consumo Propio - ${trabajadorNombre}%`],
      );

      const totalConsumos = consumos.reduce(
        (sum, consumo) => sum + consumo.precio,
        0,
      );
      return Math.abs(totalConsumos); // Devolver valor positivo
    } catch (error) {
      console.error("Error obteniendo consumos propios:", error);
      return 0;
    }
  }

  // Registrar consumo directamente en el salario (sin crear tarjeta de gasto)
  static async registrarConsumoEnSalario(
    puntoId: number,
    gastoId: number,
    montoConsumo: number,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Obtener información del trabajador
      const gastos = await this.read_gasto(puntoId);
      const trabajador = gastos.find(
        (g: any) =>
          g.id === gastoId && g.categoria === "Salario" && g.activo === 1,
      );

      if (!trabajador) {
        return {
          success: false,
          message: "No se encontró el trabajador",
        };
      }

      console.log(
        `💰 Registrando consumo en historial: ${trabajador.nombre} - $${montoConsumo.toFixed(2)}`,
      );

      // Guardar el consumo en la tabla HistorialConsumosPropios
      const fechaHoy = getFechaLocal();
      const resultado = await executeNonQuery(
        `INSERT OR REPLACE INTO HistorialConsumosPropios 
         (punto_id, trabajador_id, trabajador_nombre, fecha_consumo, monto_consumo, descripcion) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          puntoId,
          gastoId,
          trabajador.nombre,
          fechaHoy,
          montoConsumo,
          `Consumo propio de $${montoConsumo.toFixed(2)} descontado del salario de ${trabajador.nombre}`,
        ],
      );

      if (resultado.changes > 0) {
        console.log(
          `✅ Consumo registrado en historial: ${trabajador.nombre} - $${montoConsumo.toFixed(2)}`,
        );

        return {
          success: true,
          message: `Consumo de $${montoConsumo.toFixed(2)} registrado en el historial de ${trabajador.nombre}`,
          data: {
            trabajadorNombre: trabajador.nombre,
            montoDescontado: montoConsumo,
          },
        };
      } else {
        return {
          success: false,
          message: "No se pudo registrar el consumo en el historial",
        };
      }
    } catch (error: any) {
      console.error("Error en registrarConsumoEnSalario:", error);
      return {
        success: false,
        message: error.message || "Error al registrar consumo en salario",
      };
    }
  }

  // Registrar cambio de porcentaje en auditoría
  static async registrarCambioPorcentaje(
    gastoId: number,
    puntoId: number,
    porcentajeAnterior: number,
    porcentajeNuevo: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const fechaHoy = getFechaLocal();

      await executeNonQuery(
        `INSERT INTO AuditoriaPorcentaje (gasto_id, punto_id, porcentaje_anterior, porcentaje_nuevo, fecha_cambio) 
         VALUES (?, ?, ?, ?, ?)`,
        [gastoId, puntoId, porcentajeAnterior, porcentajeNuevo, fechaHoy],
      );

      console.log(
        `📈 Cambio de porcentaje registrado: gastoId=${gastoId}, ${porcentajeAnterior}% → ${porcentajeNuevo}% (${fechaHoy})`,
      );

      return {
        success: true,
        message: `Cambio de porcentaje registrado: ${porcentajeAnterior}% → ${porcentajeNuevo}%`,
      };
    } catch (error: any) {
      console.error("Error en registrarCambioPorcentaje:", error);
      return {
        success: false,
        message: error.message || "Error al registrar cambio de porcentaje",
      };
    }
  }

  // Obtener porcentaje vigente en una fecha específica (corregido - solo aplica cambios desde la fecha del cambio)
  static async obtenerPorcentajeVigenteEnFecha(
    gastoId: number,
    fecha: string,
  ): Promise<number> {
    try {
      // Buscar el último cambio de porcentaje ANTES de la fecha especificada
      const resultadoAnterior = await getFirst<{
        fecha_cambio: string;
        porcentaje_nuevo: number;
      }>(
        `SELECT porcentaje_nuevo 
         FROM AuditoriaPorcentaje 
         WHERE gasto_id = ? AND fecha_cambio < DATE(?) 
         ORDER BY fecha_cambio DESC, creado_en DESC 
         LIMIT 1`,
        [gastoId, fecha],
      );

      // Buscar si hay un cambio exactamente en esta fecha
      const resultadoMismoDia = await getFirst<{
        fecha_cambio: string;
        porcentaje_nuevo: number;
      }>(
        `SELECT porcentaje_nuevo 
         FROM AuditoriaPorcentaje 
         WHERE gasto_id = ? AND fecha_cambio = DATE(?) 
         ORDER BY creado_en DESC 
         LIMIT 1`,
        [gastoId, fecha],
      );

      // Si hay un cambio el mismo día, usar ese porcentaje
      if (resultadoMismoDia && resultadoMismoDia.porcentaje_nuevo !== null) {
        return resultadoMismoDia.porcentaje_nuevo;
      }

      // Si hay cambios anteriores, usar el último cambio anterior
      if (resultadoAnterior && resultadoAnterior.porcentaje_nuevo !== null) {
        return resultadoAnterior.porcentaje_nuevo;
      }

      // Si no hay cambios registrados, obtener el porcentaje actual del gasto
      const gasto = await getFirst<{ porcentaje: number }>(
        "SELECT porcentaje FROM Gastos WHERE id = ?",
        [gastoId],
      );

      return gasto?.porcentaje || 0;
    } catch (error) {
      console.error("Error obteniendo porcentaje vigente:", error);
      return 0;
    }
  }

  // Actualizar método update_gasto para registrar cambios de porcentaje (corregido - no actualiza porcentaje principal)
  static async update_gasto_modificado(
    id: number,
    updates: Partial<Gasto>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Primero obtener el gasto actual para verificar si hay cambio de porcentaje
      const gastoActual = await getFirst<Gasto>(
        "SELECT * FROM Gastos WHERE id = ?",
        [id],
      );

      if (!gastoActual) {
        return {
          success: false,
          message: "Gasto no encontrado",
        };
      }

      // Verificar si hay cambio de porcentaje
      const porcentajeActual = gastoActual.porcentaje || 0;
      const porcentajeNuevo = updates.porcentaje || porcentajeActual;

      if (
        porcentajeActual !== porcentajeNuevo &&
        updates.categoria === "Salario"
      ) {
        // Registrar el cambio en auditoría
        await this.registrarCambioPorcentaje(
          id,
          gastoActual.punto_id,
          porcentajeActual,
          porcentajeNuevo,
        );
        console.log(
          `📈 Porcentaje actualizado: ${gastoActual.nombre} ${porcentajeActual}% → ${porcentajeNuevo}%`,
        );

        // NO actualizar el porcentaje principal, solo otros campos
        const { porcentaje, ...otrosCampos } = updates;

        // Filtrar campos que existen en la base de datos (excluir descripcion_deuda)
        const camposValidos = Object.keys(otrosCampos).filter(
          (key) => key !== "descripcion_deuda",
        );
        const valoresValidos = camposValidos.map(
          (campo) => otrosCampos[campo as keyof typeof otrosCampos],
        );

        if (camposValidos.length > 0) {
          // Usar fecha local en lugar de UTC
          const { getFechaHoraLocalCompleta } =
            await import("../../utils/dateUtils");
          const ahora = getFechaHoraLocalCompleta();

          const query = `UPDATE Gastos SET ${camposValidos
            .map((campo) => `${campo} = ?`)
            .join(", ")}, actualizado_en = ? WHERE id = ?`;

          await executeNonQuery(query, [...valoresValidos, ahora, id]);
        }

        return {
          success: true,
          message: "Porcentaje actualizado correctamente (solo en auditoría)",
        };
      }

      // Si no es cambio de porcentaje, actualizar normalmente
      // Filtrar campos que existen en la base de datos (excluir descripcion_deuda)
      const camposValidos = Object.keys(updates).filter(
        (key) => key !== "descripcion_deuda",
      );
      const valoresValidos = camposValidos.map(
        (campo) => updates[campo as keyof typeof updates],
      );

      if (camposValidos.length === 0) {
        return {
          success: false,
          message: "No hay campos para actualizar",
        };
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const query = `UPDATE Gastos SET ${camposValidos
        .map((campo) => `${campo} = ?`)
        .join(", ")}, actualizado_en = ? WHERE id = ?`;

      await executeNonQuery(query, [...valoresValidos, ahora, id]);

      return {
        success: true,
        message: "Gasto actualizado correctamente",
      };
    } catch (error: any) {
      console.error("Error en update_gasto_modificado:", error);
      return {
        success: false,
        message: error.message || "Error al actualizar gasto",
      };
    }
  }

  // Descontar consumo propio de trabajador (nuevo enfoque)
  static async descontarConsumoPropio(
    puntoId: number,
    gastoId: number,
    montoConsumo: number,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Obtener información del trabajador
      const gastos = await this.read_gasto(puntoId);
      const trabajador = gastos.find(
        (g: any) =>
          g.id === gastoId && g.categoria === "Salario" && g.activo === 1,
      );

      if (!trabajador) {
        return {
          success: false,
          message: "No se encontró el trabajador",
        };
      }

      console.log(
        `💰 Registrando consumo propio: ${trabajador.nombre} - $${montoConsumo.toFixed(2)}`,
      );

      // Crear un registro de consumo propio como gasto de salario oculto
      const resultado = await this.crearGasto({
        nombre: `Consumo Propio - ${trabajador.nombre}`,
        categoria: "Salario", // Cambiado a "Salario" para que no aparezca como tarjeta de gastos
        tipo: "pasivo", // Es un descuento
        descripcion: `Consumo propio de $${montoConsumo.toFixed(2)} descontado del salario de ${trabajador.nombre}`,
        fecha_gasto: getFechaLocal(),
        recurrente: false,
        periodicidad: undefined,
        precio: -Math.abs(montoConsumo), // Valor negativo para restar de gastos
        porcentaje: 0,
        activo: true,
        punto_id: puntoId,
      });

      if (resultado.success) {
        console.log(
          `✅ Consumo propio registrado: ${trabajador.nombre} - $${montoConsumo.toFixed(2)}`,
        );

        return {
          success: true,
          message: `Consumo de $${montoConsumo.toFixed(2)} registrado para ${trabajador.nombre}`,
          data: {
            trabajadorNombre: trabajador.nombre,
            montoDescontado: montoConsumo,
            gastoId: resultado.data?.id || 0,
          },
        };
      } else {
        return {
          success: false,
          message: "No se pudo registrar el consumo propio",
        };
      }
    } catch (error: any) {
      console.error("Error en descontarConsumoPropio:", error);
      return {
        success: false,
        message: error.message || "Error al registrar consumo propio",
      };
    }
  }
}
