// src/db/services/produccion_pan_service.ts
import { executeNonQuery, executeQuery, getFirst } from "../database";
import { FormulasPanService, type FormulaPan } from "./formulas_pan_service";

// Unidades de medida soportadas
export type UnidadMedida = "g" | "kg" | "lb" | "l" | "ml";

// Interface para insumos seleccionados
export interface InsumoSeleccionado {
  producto_id: number;
  nombre: string;
  descripcion: string;
  cantidad_disponible: number;
  cantidad_inicial: number; // Cantidad inicial para cálculo de costos
  formato_almacen: string;
  unidades_por_formato: number | null;
  precio_coste: number;
  cantidad_requerida: number; // en gramos
  cantidad_usar: number; // cantidad que se usará en la unidad original
}

// Interface para resumen de producción
export interface ResumenProduccion {
  formula: FormulaPan;
  cantidad_panes: number;
  insumos_seleccionados: InsumoSeleccionado[];
  costo_total: number;
  costo_por_pan: number;
  cantidad_maxima_posible: number;
}

// Interface para resultado de producción
export interface ResultadoProduccion {
  success: boolean;
  message: string;
  producto_creado?: any;
  insumos_actualizados?: any[];
}

export class ProduccionPanService {
  // Conversión de unidades a gramos
  static convertirAGramos(cantidad: number, unidad: UnidadMedida): number {
    switch (unidad.toLowerCase()) {
      case "kg":
      case "kilogramo":
      case "kilogramos":
        return cantidad * 1000;
      case "g":
      case "gramo":
      case "gramos":
        return cantidad;
      case "lb":
      case "libra":
      case "libras":
        return cantidad * 453.592;
      case "l":
      case "lt":
      case "litro":
      case "litros":
        return cantidad * 1000; // 1 litro ≈ 1000g (asumimos densidad del agua)
      case "ml":
      case "mililitro":
      case "mililitros":
        return cantidad; // 1 ml ≈ 1g
      default:
        return cantidad;
    }
  }

  // Obtener formato de almacenamiento como unidad de medida
  static obtenerUnidadMedida(formato: string): UnidadMedida {
    const formatoLower = formato.toLowerCase();
    if (formatoLower.includes("kg") || formatoLower.includes("kilogramo")) {
      return "kg";
    } else if (formatoLower.includes("lb") || formatoLower.includes("libra")) {
      return "lb";
    } else if (formatoLower.includes("l") || formatoLower.includes("litro")) {
      return "l";
    } else if (
      formatoLower.includes("ml") ||
      formatoLower.includes("mililitro")
    ) {
      return "ml";
    } else {
      return "g";
    }
  }

  // Buscar productos por nombre de insumo
  static async buscarInsumosPorNombre(
    nombreInsumo: string,
    almacenId: number,
  ): Promise<any[]> {
    try {
      // Búsqueda más específica para encontrar insumos por nombre exacto o categoría
      const productos = await executeQuery(
        `
                SELECT p.*, ap.cantidad as cantidad_almacen, ap.cantidad_inicial
                FROM Producto p
                INNER JOIN AlmacenProducto ap ON p.id = ap.producto_id
                WHERE ap.almacen_id = ? 
                AND ap.cantidad > 0
                AND (
                    p.nombre LIKE ? 
                    OR p.categoria LIKE ?
                    OR p.subcategoria LIKE ?
                )
                ORDER BY 
                    CASE 
                        WHEN p.nombre LIKE ? THEN 1
                        WHEN p.categoria LIKE ? THEN 2
                        WHEN p.subcategoria LIKE ? THEN 3
                        ELSE 4
                    END,
                    p.nombre ASC
            `,
        [
          almacenId,
          `%${nombreInsumo}%`,
          `%${nombreInsumo}%`,
          `%${nombreInsumo}%`,
          `%${nombreInsumo}%`,
          `%${nombreInsumo}%`,
          `%${nombreInsumo}%`,
        ],
      );

      console.log(
        `🔍 Buscando "${nombreInsumo}" - Encontrados: ${productos.length} productos`,
      );
      console.log(
        "Productos encontrados:",
        productos.map((p) => ({
          nombre: p.nombre,
          categoria: p.categoria,
          cantidad: p.cantidad_almacen,
          formato: p.formato_almacen,
        })),
      );

      return productos;
    } catch (error) {
      console.error(`Error buscando insumos "${nombreInsumo}":`, error);
      return [];
    }
  }

  // Calcular cantidad máxima de panes posibles con los insumos disponibles
  static async calcularCantidadMaxima(
    formula: FormulaPan,
    almacenId: number,
    insumosSeleccionados?: InsumoSeleccionado[],
  ): Promise<{
    cantidad_maxima: number;
    insumos_disponibles: InsumoSeleccionado[];
  }> {
    try {
      console.log("🧾 Fórmula usada para calcular cantidad máxima:", {
        harina: formula.harina,
        levadura: formula.levadura,
        nucleo: formula.nucleo,
        azucar: formula.azucar,
        sal: formula.sal,
        aceite: formula.aceite,
      });

      const insumosNecesarios = [
        { nombre: "Harina", cantidad: formula.harina },
        { nombre: "Levadura", cantidad: formula.levadura },
        { nombre: "Núcleo", cantidad: formula.nucleo },
        { nombre: "Azúcar", cantidad: formula.azucar },
        { nombre: "Sal", cantidad: formula.sal },
        { nombre: "Aceite", cantidad: formula.aceite },
      ];

      const insumosDisponibles: InsumoSeleccionado[] = [];
      let cantidadMaxima = Infinity;

      for (const insumo of insumosNecesarios) {
        if (insumo.cantidad <= 0) continue; // Saltar ingredientes opcionales con cantidad 0

        let producto;

        // Si se proporcionan insumos seleccionados, usarlos; si no, buscar en BD
        if (insumosSeleccionados && insumosSeleccionados.length > 0) {
          // Buscar el insumo seleccionado que coincide
          producto = insumosSeleccionados.find((sel) =>
            sel.nombre.toLowerCase().includes(insumo.nombre.toLowerCase()),
          );
          console.log(
            ` Usando insumo seleccionado para "${insumo.nombre}":`,
            producto
              ? {
                  nombre: producto.nombre,
                  cantidad_disponible: producto.cantidad_disponible,
                  formato_almacen: producto.formato_almacen,
                  unidades_por_formato: producto.unidades_por_formato,
                }
              : " No encontrado",
          );
        } else {
          // Comportamiento original: buscar en BD
          const productos = await this.buscarInsumosPorNombre(
            insumo.nombre,
            almacenId,
          );

          if (productos.length === 0) {
            console.log(` No se encontraron productos para "${insumo.nombre}"`);
            return { cantidad_maxima: 0, insumos_disponibles: [] };
          }

          // Tomar el primer producto disponible
          producto = productos[0];
          console.log(` Producto encontrado en BD para "${insumo.nombre}":`, {
            nombre: producto.nombre,
            cantidad_almacen: producto.cantidad_almacen,
            formato_almacen: producto.formato_almacen,
            unidades_por_formato: producto.unidades_por_formato,
          });
        }

        if (!producto) {
          console.log(` No hay producto disponible para "${insumo.nombre}"`);
          return { cantidad_maxima: 0, insumos_disponibles: [] };
        }

        // Convertir el producto al formato esperado
        const productoFormateado = {
          id: producto.producto_id || producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion || "",
          cantidad_almacen:
            producto.cantidad_disponible || producto.cantidad_almacen,
          cantidad_inicial:
            producto.cantidad_inicial || producto.cantidad_almacen, // Usar cantidad_inicial para cálculo de costos
          formato_almacen: producto.formato_almacen || "g",
          unidades_por_formato: producto.unidades_por_formato,
          precio_coste: producto.precio_coste,
        };

        const unidad = this.obtenerUnidadMedida(
          productoFormateado.formato_almacen || "g",
        );

        // Calcular cantidad total disponible en gramos
        let cantidadTotalGramos = 0;
        if (
          productoFormateado.unidades_por_formato &&
          productoFormateado.unidades_por_formato > 0
        ) {
          cantidadTotalGramos =
            productoFormateado.cantidad_almacen * // Usar cantidad actual para cantidad máxima
            productoFormateado.unidades_por_formato *
            this.convertirAGramos(1, unidad);
        } else {
          cantidadTotalGramos =
            productoFormateado.cantidad_almacen * // Usar cantidad actual para cantidad máxima
            this.convertirAGramos(1, unidad);
        }

        console.log(
          ` ${insumo.nombre}: ${productoFormateado.cantidad_almacen} ${productoFormateado.formato_almacen} = ${cantidadTotalGramos}g totales`,
        );

        // Calcular cuántos panes se pueden hacer con este insumo
        const cantidadPorPan = insumo.cantidad; // ya está en gramos
        const panesPosiblesConEsteInsumo = Math.floor(
          cantidadTotalGramos / cantidadPorPan,
        );

        console.log(
          ` ${insumo.nombre}: ${cantidadTotalGramos}g / ${cantidadPorPan}g por pan = ${panesPosiblesConEsteInsumo} panes`,
        );
        console.log(
          ` Cantidad máxima actual: ${cantidadMaxima}, nuevo límite: ${panesPosiblesConEsteInsumo}`,
        );

        // La cantidad máxima es el mínimo entre todos los insumos
        cantidadMaxima = Math.min(cantidadMaxima, panesPosiblesConEsteInsumo);

        // Agregar a la lista de insumos disponibles
        insumosDisponibles.push({
          producto_id: productoFormateado.id,
          nombre: insumo.nombre,
          descripcion: productoFormateado.descripcion,
          cantidad_disponible: productoFormateado.cantidad_almacen,
          cantidad_inicial: productoFormateado.cantidad_inicial,
          formato_almacen: productoFormateado.formato_almacen,
          unidades_por_formato: productoFormateado.unidades_por_formato,
          precio_coste: productoFormateado.precio_coste,
          cantidad_requerida: cantidadPorPan,
          cantidad_usar: cantidadPorPan * cantidadMaxima,
        });
      }

      return {
        cantidad_maxima: cantidadMaxima === Infinity ? 0 : cantidadMaxima,
        insumos_disponibles: insumosDisponibles,
      };
    } catch (error) {
      console.error("Error calculando cantidad máxima:", error);
      return { cantidad_maxima: 0, insumos_disponibles: [] };
    }
  }

  // Calcular costo de producción por pan
  static calcularCostoProduccion(
    formula: FormulaPan,
    insumosSeleccionados: InsumoSeleccionado[],
  ): { costo_total: number; costo_por_pan: number } {
    let costoTotal = 0;

    const insumosNecesarios = [
      { nombre: "Harina", cantidad: formula.harina },
      { nombre: "Levadura", cantidad: formula.levadura },
      { nombre: "Núcleo", cantidad: formula.nucleo },
      { nombre: "Azúcar", cantidad: formula.azucar },
      { nombre: "Sal", cantidad: formula.sal },
      { nombre: "Aceite", cantidad: formula.aceite },
    ];

    for (const insumoReq of insumosNecesarios) {
      if (insumoReq.cantidad <= 0) continue;

      const insumoSeleccionado = insumosSeleccionados.find((i) =>
        i.nombre.toLowerCase().includes(insumoReq.nombre.toLowerCase()),
      );

      if (insumoSeleccionado) {
        // Calcular costo por gramo del insumo
        let costoPorGramo = 0;

        if (
          insumoSeleccionado.unidades_por_formato &&
          insumoSeleccionado.unidades_por_formato > 0 &&
          insumoSeleccionado.formato_almacen &&
          !insumoSeleccionado.formato_almacen.toLowerCase().includes("gram") &&
          !insumoSeleccionado.formato_almacen.toLowerCase().includes("g")
        ) {
          // Producto con formato real (cajas, blisters, etc.) - NO gramos
          // Usar el costo real total del producto (precio_coste * cantidad_inicial)
          const costoRealTotal =
            insumoSeleccionado.precio_coste *
            (insumoSeleccionado.cantidad_inicial || 1);
          const unidad = this.obtenerUnidadMedida(
            insumoSeleccionado.formato_almacen,
          );
          const gramosPorFormato = this.convertirAGramos(
            insumoSeleccionado.unidades_por_formato,
            unidad,
          );
          costoPorGramo = costoRealTotal / gramosPorFormato;
          console.log(
            `💰 ${insumoReq.nombre} (con formato): $${costoRealTotal} (costo real total) ÷ ${gramosPorFormato}g = $${costoPorGramo.toFixed(4)}/g`,
          );
        } else {
          // Producto a granel (gramos, kilogramos, etc.)
          // Usar el costo real total del producto (precio_coste * cantidad_inicial)
          const costoRealTotal =
            insumoSeleccionado.precio_coste *
            (insumoSeleccionado.cantidad_inicial || 1);
          const unidad = this.obtenerUnidadMedida(
            insumoSeleccionado.formato_almacen,
          );
          // Usar cantidad_inicial para el cálculo de costos (si está disponible)
          const cantidadParaCosto =
            insumoSeleccionado.cantidad_inicial ||
            insumoSeleccionado.cantidad_disponible;
          const gramosTotales = this.convertirAGramos(
            cantidadParaCosto,
            unidad,
          );
          costoPorGramo =
            gramosTotales > 0 ? costoRealTotal / gramosTotales : 0;
          console.log(
            `💰 ${insumoReq.nombre} (granel): $${costoRealTotal} (costo real total) ÷ ${gramosTotales}g = $${costoPorGramo.toFixed(4)}/g`,
          );
        }

        const costoInsumoPorPan = costoPorGramo * insumoReq.cantidad;
        costoTotal += costoInsumoPorPan;

        console.log(
          `💰 "${insumoReq.nombre}": $${costoPorGramo.toFixed(4)}/g × ${insumoReq.cantidad}g = $${costoInsumoPorPan.toFixed(2)} por pan`,
        );
      }
    }

    console.log(`💰 COSTO TOTAL POR PAN: $${costoTotal.toFixed(2)}`);

    return {
      costo_total: costoTotal,
      costo_por_pan: costoTotal,
    };
  }

  // Actualizar cantidad de insumos después de la producción
  static async actualizarInsumos(
    insumosSeleccionados: InsumoSeleccionado[],
    cantidadPanes: number,
    almacenId: number,
  ): Promise<{
    success: boolean;
    message: string;
    insumos_actualizados: any[];
  }> {
    try {
      const insumosActualizados: any[] = [];

      for (const insumo of insumosSeleccionados) {
        if (insumo.cantidad_requerida <= 0) continue;

        // Calcular cantidad total a consumir en gramos
        const cantidadTotalConsumirGramos =
          insumo.cantidad_requerida * cantidadPanes;

        // Convertir a la unidad del producto
        const unidad = this.obtenerUnidadMedida(insumo.formato_almacen);
        let cantidadConsumirUnidadOriginal = 0;

        if (insumo.unidades_por_formato && insumo.unidades_por_formato > 0) {
          // Producto con formato
          const gramosPorFormato = this.convertirAGramos(
            insumo.unidades_por_formato,
            unidad,
          );
          cantidadConsumirUnidadOriginal =
            cantidadTotalConsumirGramos / gramosPorFormato;
        } else {
          // Producto a granel
          cantidadConsumirUnidadOriginal =
            cantidadTotalConsumirGramos / this.convertirAGramos(1, unidad);
        }

        // Actualizar cantidad en almacén
        const nuevaCantidad = Math.max(
          0,
          insumo.cantidad_disponible - cantidadConsumirUnidadOriginal,
        );

        // Usar fecha local en lugar de UTC
        const { getFechaHoraLocalCompleta } =
          await import("../../utils/dateUtils");
        const ahora = getFechaHoraLocalCompleta();

        const resultado = await executeNonQuery(
          `
                    UPDATE AlmacenProducto 
                    SET cantidad = ?, actualizado_en = ?
                    WHERE almacen_id = ? AND producto_id = ?
                `,
          [nuevaCantidad, ahora, almacenId, insumo.producto_id],
        );

        if (resultado.changes > 0) {
          insumosActualizados.push({
            producto_id: insumo.producto_id,
            nombre: insumo.nombre,
            cantidad_anterior: insumo.cantidad_disponible,
            cantidad_consumida: cantidadConsumirUnidadOriginal,
            cantidad_nueva: nuevaCantidad,
          });
        }
      }

      return {
        success: true,
        message: "Insumos actualizados correctamente",
        insumos_actualizados: insumosActualizados,
      };
    } catch (error: any) {
      console.error("Error actualizando insumos:", error);
      return {
        success: false,
        message: error.message || "Error al actualizar insumos",
        insumos_actualizados: [],
      };
    }
  }

  // Crear producto de pan en el almacén
  static async crearProductoPan(
    formula: FormulaPan,
    cantidadPanes: number,
    costoPorPan: number,
    almacenId: number,
  ): Promise<{ success: boolean; message: string; producto_creado?: any }> {
    try {
      // Crear el producto pan
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);
      const fechaVencimientoStr = fechaVencimiento.toISOString().split("T")[0];

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const resultadoProducto = await executeNonQuery(
        `
                INSERT INTO Producto (
                    nombre, categoria, subcategoria, precio_coste, 
                    fecha_caducidad, formato_almacen, unidades_por_formato,
                    creado_en, actualizado_en
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          formula.nombre,
          "Pan",
          "Producción Propia",
          costoPorPan,
          fechaVencimientoStr,
          "unidad",
          1,
          ahora,
          ahora,
        ],
      );

      if (resultadoProducto.changes === 0) {
        return {
          success: false,
          message: "No se pudo crear el producto pan",
        };
      }

      const productoId = resultadoProducto.lastInsertRowId;

      // Agregar el producto al almacén
      const resultadoAlmacen = await executeNonQuery(
        `
                INSERT INTO AlmacenProducto (
                    almacen_id, producto_id, cantidad, cantidad_inicial, creado_en, actualizado_en
                ) VALUES (?, ?, ?, ?, ?, ?)
            `,
        [almacenId, productoId, cantidadPanes, cantidadPanes, ahora, ahora],
      );

      if (resultadoAlmacen.changes === 0) {
        return {
          success: false,
          message: "No se pudo agregar el pan al almacén",
        };
      }

      // Obtener el producto creado
      const productoCreado = await getFirst(
        `
                SELECT p.*, ap.cantidad as cantidad_almacen
                FROM Producto p
                INNER JOIN AlmacenProducto ap ON p.id = ap.producto_id
                WHERE p.id = ? AND ap.almacen_id = ?
            `,
        [productoId, almacenId],
      );

      return {
        success: true,
        message: `Pan "${formula.nombre}" creado exitosamente`,
        producto_creado: productoCreado,
      };
    } catch (error: any) {
      console.error("Error creando producto pan:", error);
      return {
        success: false,
        message: error.message || "Error al crear el producto pan",
      };
    }
  }

  // Proceso completo de producción
  static async producirPanes(
    formulaId: number,
    cantidadPanes: number,
    insumosSeleccionados: InsumoSeleccionado[],
    almacenId: number,
    costosAdicionales?: {
      trabajador?: number;
      transporte?: number;
      electricidad?: number;
    },
  ): Promise<ResultadoProduccion> {
    try {
      // Validar que la cantidad sea mayor a 0
      if (cantidadPanes <= 0) {
        return {
          success: false,
          message: "La cantidad de panes debe ser mayor a 0",
        };
      }

      // Obtener la fórmula
      const formula = await FormulasPanService.obtenerFormulaPorId(formulaId);
      if (!formula) {
        return {
          success: false,
          message: "La fórmula seleccionada no existe",
        };
      }

      // Verificar que todos los insumos necesarios estén seleccionados
      const insumosNecesarios = [
        "Harina",
        "Levadura",
        "Núcleo",
        "Azúcar",
        "Sal",
        "Aceite",
      ];
      for (const nombreInsumo of insumosNecesarios) {
        const insumoEncontrado = insumosSeleccionados.find((i) =>
          i.nombre.toLowerCase().includes(nombreInsumo.toLowerCase()),
        );

        if (!insumoEncontrado) {
          return {
            success: false,
            message: `Falta seleccionar el insumo: ${nombreInsumo}`,
          };
        }
      }

      // Calcular costos
      const { costo_por_pan } = this.calcularCostoProduccion(
        formula,
        insumosSeleccionados,
      );

      // Calcular costo total real por pan (insumos + costos adicionales)
      const costoAdicionalPorPan =
        ((costosAdicionales?.trabajador || 0) +
          (costosAdicionales?.transporte || 0) +
          (costosAdicionales?.electricidad || 0)) /
        cantidadPanes;

      const costoTotalPorPan = costo_por_pan + costoAdicionalPorPan;

      console.log(`💰 Costo insumos por pan: $${costo_por_pan.toFixed(2)}`);
      console.log(
        `💰 Costos adicionales por pan: $${costoAdicionalPorPan.toFixed(2)}`,
      );
      console.log(`💰 Costo total por pan: $${costoTotalPorPan.toFixed(2)}`);

      // Actualizar insumos
      const resultadoInsumos = await this.actualizarInsumos(
        insumosSeleccionados,
        cantidadPanes,
        almacenId,
      );

      if (!resultadoInsumos.success) {
        return {
          success: false,
          message: `Error al actualizar insumos: ${resultadoInsumos.message}`,
        };
      }

      // Crear producto pan con el costo total real
      const resultadoProducto = await this.crearProductoPan(
        formula,
        cantidadPanes,
        costoTotalPorPan,
        almacenId,
      );

      if (!resultadoProducto.success) {
        return {
          success: false,
          message: `Error al crear el pan: ${resultadoProducto.message}`,
        };
      }

      return {
        success: true,
        message: `Producción exitosa: ${cantidadPanes} panes "${formula.nombre}" creados`,
        producto_creado: resultadoProducto.producto_creado,
        insumos_actualizados: resultadoInsumos.insumos_actualizados,
      };
    } catch (error: any) {
      console.error("Error en proceso de producción:", error);
      return {
        success: false,
        message: error.message || "Error en el proceso de producción",
      };
    }
  }

  // Obtener resumen completo para el modal de producción
  static async obtenerResumenProduccion(
    formulaId: number,
    almacenId: number,
  ): Promise<{
    success: boolean;
    message: string;
    resumen?: ResumenProduccion;
  }> {
    try {
      // Obtener la fórmula
      const formula = await FormulasPanService.obtenerFormulaPorId(formulaId);
      if (!formula) {
        return {
          success: false,
          message: "La fórmula seleccionada no existe",
        };
      }

      // Calcular cantidad máxima y obtener insumos disponibles
      const { cantidad_maxima, insumos_disponibles } =
        await this.calcularCantidadMaxima(formula, almacenId);

      if (cantidad_maxima === 0) {
        return {
          success: false,
          message:
            "No hay suficientes insumos disponibles para producir ni un solo pan",
        };
      }

      // Calcular costos
      const { costo_total, costo_por_pan } = this.calcularCostoProduccion(
        formula,
        insumos_disponibles,
      );

      const resumen: ResumenProduccion = {
        formula,
        cantidad_panes: 0, // Se definirá en el modal
        insumos_seleccionados: insumos_disponibles,
        costo_total,
        costo_por_pan,
        cantidad_maxima_posible: cantidad_maxima,
      };

      return {
        success: true,
        message: "Resumen obtenido exitosamente",
        resumen,
      };
    } catch (error: any) {
      console.error("Error obteniendo resumen de producción:", error);
      return {
        success: false,
        message: error.message || "Error al obtener el resumen de producción",
      };
    }
  }
}
