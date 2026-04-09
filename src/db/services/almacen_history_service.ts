// src/services/almacen_history_service.ts - Servicio especializado para historial de almacén
import { executeNonQuery, executeQuery } from "../database";

// Interface para movimientos de productos en almacén
export interface MovimientoAlmacen {
  id: number;
  tipo:
    | "transferencia_punto"
    | "transferencia_almacen"
    | "correccion_transferencia"
    | "creacion"
    | "eliminacion"
    | "ajuste";
  producto_id: number;
  producto_nombre: string;
  producto_categoria: string;
  cantidad: number;
  cantidad_inicial?: number; // Cantidad inicial cuando fue creado
  cantidad_total_en_momento?: number; // Stock total acumulado en el momento de la creación
  cantidad_antes?: number; // Cantidad antes de la transferencia
  cantidad_despues?: number; // Cantidad después de la transferencia
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
  nota_total_historico?: string; // Nota histórica del total acumulado
}

// Interface para filtros de historial de almacén
export interface FiltrosHistorialAlmacen {
  fechaDesde?: string;
  fechaHasta?: string;
  tipoMovimiento?: string;
  productoId?: number;
  puntoId?: number;
  almacenId?: number;
  limit?: number;
  offset?: number;
}

// Interface para estadísticas de movimientos de almacén
export interface EstadisticasAlmacen {
  totalMovimientos: number;
  totalTransferencias: number;
  totalProductosCreados: number;
  totalProductosEliminados: number;
  totalTransferenciasPunto: number;
  totalTransferenciasAlmacen: number;
  valorTotalTransferencias: number;
  valorTotalGanancias: number;
}

export class AlmacenHistoryService {
  // Función de diagnóstico y reparación para cantidad_inicial
  static async diagnosticarYRepararCantidadInicial(
    almacenId?: number,
  ): Promise<void> {
    try {
      console.log("🔧 Diagnosticando y reparando cantidad_inicial...");

      // 1. Verificar AlmacenProducto
      const almacenProductoSinInicial = await executeQuery(
        `
        SELECT id, producto_id, almacen_id, cantidad, cantidad_inicial 
        FROM AlmacenProducto 
        WHERE cantidad_inicial IS NULL
        ${almacenId ? "AND almacen_id = ?" : ""}
      `,
        almacenId ? [almacenId] : [],
      );

      console.log(
        `📦 AlmacenProducto sin cantidad_inicial: ${almacenProductoSinInicial.length}`,
      );

      // 2. Verificación adicional: mostrar todos los productos del almacén
      if (almacenId) {
        const todosProductos = await executeQuery(
          `
          SELECT id, producto_id, almacen_id, cantidad, cantidad_inicial,
                 CASE WHEN cantidad_inicial IS NULL THEN 'NULL' ELSE CAST(cantidad_inicial AS TEXT) END as cantidad_inicial_text
          FROM AlmacenProducto 
          WHERE almacen_id = ?
        `,
          [almacenId],
        );

        console.log(`📦 Todos los productos del almacén ${almacenId}:`);
        todosProductos.forEach((row: any) => {
          console.log(
            `  - ID: ${row.id}, cantidad: ${row.cantidad}, cantidad_inicial: ${row.cantidad_inicial} (${row.cantidad_inicial_text})`,
          );
        });
      }

      for (const row of almacenProductoSinInicial) {
        await executeNonQuery(
          `
          UPDATE AlmacenProducto 
          SET cantidad_inicial = ? 
          WHERE id = ?
        `,
          [row.cantidad, row.id],
        );

        console.log(
          `✅ AlmacenProducto ID ${row.id}: cantidad_inicial = ${row.cantidad}`,
        );
      }

      // 3. Verificar Almacen (solo para almacén general)
      if (!almacenId || almacenId === 0) {
        const almacenSinInicial = await executeQuery(`
          SELECT id, producto_id, cantidad, cantidad_inicial 
          FROM Almacen 
          WHERE cantidad_inicial IS NULL
        `);

        console.log(
          `📦 Almacen sin cantidad_inicial: ${almacenSinInicial.length}`,
        );

        for (const row of almacenSinInicial) {
          await executeNonQuery(
            `
            UPDATE Almacen 
            SET cantidad_inicial = ? 
            WHERE id = ?
          `,
            [row.cantidad, row.id],
          );

          console.log(
            `✅ Almacen ID ${row.id}: cantidad_inicial = ${row.cantidad}`,
          );
        }
      }

      console.log("🎉 Diagnóstico y reparación completados!");
    } catch (error) {
      console.error("❌ Error en diagnóstico:", error);
    }
  }

  // Función temporal para depurar LogTransferencia
  static async debugLogTransferencia(almacenId?: number) {
    try {
      console.log("🔍 DEBUG: Analizando LogTransferencia...");

      // Ver todos los registros recientes
      const allTransfers = await executeQuery(`
        SELECT 
          lt.*,
          p.nombre as producto_nombre
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        ORDER BY lt.creado_en DESC
        LIMIT 20
      `);

      console.log("📋 TODAS las transferencias recientes:");
      allTransfers.forEach((row: any, index: number) => {
        console.log(
          `  ${index + 1}. ID: ${row.id}, Producto: ${row.producto_nombre}, Punto: ${row.punto_id}, Cantidad: ${row.cantidad}, Notas: "${row.notas}"`,
        );
      });

      // Ver transferencias con punto_id > 0 (hacia puntos)
      const toPoints = await executeQuery(`
        SELECT 
          lt.*,
          p.nombre as producto_nombre,
          pt.nombre as punto_nombre
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        LEFT JOIN Punto pt ON lt.punto_id = pt.id
        WHERE lt.punto_id > 0
        ORDER BY lt.creado_en DESC
        LIMIT 10
      `);

      console.log("📍 Transferencias a puntos:");
      toPoints.forEach((row: any, index: number) => {
        console.log(
          `  ${index + 1}. ID: ${row.id}, Producto: ${row.producto_nombre}, Punto: ${row.punto_nombre}, Notas: "${row.notas}"`,
        );
      });

      // Ver transferencias con punto_id = 0 (entre almacenes)
      const betweenAlmacenes = await executeQuery(`
        SELECT 
          lt.*,
          p.nombre as producto_nombre
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        WHERE lt.punto_id = 0
        ORDER BY lt.creado_en DESC
        LIMIT 10
      `);

      console.log("🏪 Transferencias entre almacenes:");
      betweenAlmacenes.forEach((row: any, index: number) => {
        console.log(
          `  ${index + 1}. ID: ${row.id}, Producto: ${row.producto_nombre}, Notas: "${row.notas}"`,
        );
      });

      return { allTransfers, toPoints, betweenAlmacenes };
    } catch (error) {
      console.error("❌ Error en debugLogTransferencia:", error);
      return null;
    }
  }

  // Función principal para obtener movimientos de historial de almacén
  static async getMovimientosHistorialAlmacen(
    filtros?: FiltrosHistorialAlmacen,
  ): Promise<MovimientoAlmacen[]> {
    try {
      console.log(
        "🔥 Obteniendo movimientos de historial de almacén con filtros:",
        filtros,
      );

      const almacenId = filtros?.almacenId ?? 0;
      const puntoId = filtros?.puntoId ?? null;
      const params: any[] = [];

      // Obtener nombre del almacén actual
      let almacenNombre = "Almacén General";
      if (almacenId > 0) {
        const almacenData = await executeQuery(
          "SELECT nombre FROM Almacenes WHERE id = ?",
          [almacenId],
        );
        if (almacenData.length > 0) {
          almacenNombre = almacenData[0].nombre;
        }
      }

      // Debug: Verificar productos existentes antes de la consulta
      console.log("🔍 DEBUG: Verificando productos existentes...");
      const productosExistentes = await executeQuery(
        `
        SELECT 
          ap.id,
          ap.cantidad,
          ap.creado_en,
          p.nombre as producto_nombre,
          p.fecha_caducidad
        FROM AlmacenProducto ap
        LEFT JOIN Producto p ON ap.producto_id = p.id
        WHERE COALESCE(ap.almacen_id, 0) = ?
        ORDER BY p.nombre, ap.creado_en
      `,
        [almacenId],
      );

      console.log(
        "📋 Productos existentes:",
        JSON.stringify(productosExistentes, null, 2),
      );

      // Consulta mejorada para manejar tanto almacenes específicos como puntos
      let query = `
        SELECT 
          id,
          tipo,
          producto_id,
          producto_nombre,
          producto_categoria,
          cantidad,
          precio_coste,
          precio_venta,
          ganancia,
          punto_origen_id,
          punto_destino_id,
          punto_origen_nombre,
          punto_destino_nombre,
          almacen_origen_id,
          almacen_destino_id,
          almacen_origen_nombre,
          almacen_destino_nombre,
          zona_origen,
          zona_destino,
          notas,
          creado_en,
          usuario
        FROM (
          -- Productos creados en almacén específico o general
          SELECT 
            ap.id,
            'creacion' as tipo,
            ap.producto_id,
            p.nombre as producto_nombre,
            p.categoria as producto_categoria,
            ap.cantidad,
            0 as cantidad_inicial_text, -- No existe cantidad_inicial en AlmacenProducto
            NULL as cantidad_total_en_momento, -- Se calculará en TypeScript
            p.precio_coste as precio_coste,
            NULL as precio_venta,
            0 as ganancia,
            NULL as punto_origen_id,
            NULL as punto_destino_id,
            NULL as punto_origen_nombre,
            NULL as punto_destino_nombre,
            COALESCE(ap.almacen_id, 0) as almacen_origen_id,
            NULL as almacen_destino_id,
            CASE 
              WHEN ap.almacen_id IS NULL THEN 'Almacén General'
              ELSE 'Almacén ' || ap.almacen_id
            END as almacen_origen_nombre,
            NULL as almacen_destino_nombre,
            NULL as zona_origen,
            NULL as zona_destino,
            NULL as cantidad_antes, -- No aplica para creaciones
            NULL as cantidad_despues, -- No aplica para creaciones
            'Producto creado en almacén (Cantidad inicial: No registrada)' as notas,
            ap.creado_en,
            NULL as usuario
          FROM AlmacenProducto ap
          LEFT JOIN Producto p ON ap.producto_id = p.id
          WHERE ${puntoId ? "ap.punto_id = ?" : "COALESCE(ap.almacen_id, 0) = ?"}
    
    UNION ALL
    
    -- Productos creados en almacén general
          SELECT 
            a.id,
            'creacion' as tipo,
            a.producto_id,
            p.nombre as producto_nombre,
            p.categoria as producto_categoria,
            a.cantidad,
            0 as cantidad_inicial_text, -- No existe cantidad_inicial en Almacen
            NULL as cantidad_total_en_momento, -- Se calculará en TypeScript
            p.precio_coste as precio_coste,
            NULL as precio_venta,
            0 as ganancia,
            NULL as punto_origen_id,
            NULL as punto_destino_id,
            NULL as punto_origen_nombre,
            NULL as punto_destino_nombre,
            0 as almacen_origen_id,
            NULL as almacen_destino_id,
            'Almacén General' as almacen_origen_nombre,
            NULL as almacen_destino_nombre,
            NULL as zona_origen,
            NULL as zona_destino,
            NULL as cantidad_antes, -- No aplica para creaciones
            NULL as cantidad_despues, -- No aplica para creaciones
            'Producto creado en almacén (Cantidad inicial: No registrada)' as notas,
            a.creado_en,
            NULL as usuario
          FROM Almacen a
          LEFT JOIN Producto p ON a.producto_id = p.id
          WHERE ${puntoId ? "1 = 0" : almacenId === 0 ? "1 = 1" : "1 = 0"} -- Solo para almacén general cuando almacenId = 0
          
          UNION ALL
          
          -- Transferencias desde almacén específico o general hacia puntos
          SELECT 
            lt.id,
            'transferencia_punto' as tipo,
            lt.producto_id,
            p.nombre as producto_nombre,
            p.categoria as producto_categoria,
            lt.cantidad,
            lt.cantidad as cantidad_inicial, -- Para transferencias, la cantidad transferida es la inicial
            NULL as cantidad_total_en_momento, -- No aplica para transferencias
            lt.precio_coste_real as precio_coste,
            lt.precio_venta,
            (lt.precio_venta - lt.precio_coste_real) * lt.cantidad as ganancia,
            NULL as punto_origen_id,
            lt.punto_id as punto_destino_id,
            ? as punto_origen_nombre,
            pt.nombre as punto_destino_nombre,
            ? as almacen_origen_id,
            NULL as almacen_destino_id,
            ? as almacen_origen_nombre,
            NULL as almacen_destino_nombre,
            NULL as zona_origen,
            1 as zona_destino,
            -- Calcular cantidad antes y después de la transferencia
            (SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = lt.producto_id AND COALESCE(almacen_id, 0) = ?) + lt.cantidad as cantidad_antes,
            (SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = lt.producto_id AND COALESCE(almacen_id, 0) = ?) as cantidad_despues,
            'Transferencia de ' || lt.cantidad || ' unidades a ' || COALESCE(pt.nombre, 'punto') || ' (Precio: ' || lt.precio_venta || ')' as notas,
            lt.creado_en,
            NULL as usuario
          FROM LogTransferencia lt
          LEFT JOIN Producto p ON lt.producto_id = p.id
          LEFT JOIN Punto pt ON lt.punto_id = pt.id
          WHERE lt.punto_id > 0
            AND lt.notas IS NULL -- Solo transferencias que no tienen notas (desde almacenes)
            AND EXISTS (
              SELECT 1 FROM AlmacenProducto ap 
              WHERE ap.producto_id = lt.producto_id 
              AND COALESCE(ap.almacen_id, 0) = ?
            ) -- Solo si el producto existe en el almacén actual
          
          UNION ALL
          
          -- Transferencias entre almacenes (desde el almacén actual)
          SELECT 
            lt.id,
            'transferencia_almacen' as tipo,
            lt.producto_id,
            p.nombre as producto_nombre,
            p.categoria as producto_categoria,
            lt.cantidad,
            lt.cantidad as cantidad_inicial, -- Para transferencias, la cantidad transferida es la inicial
            NULL as cantidad_total_en_momento, -- No aplica para transferencias
            lt.precio_coste_real as precio_coste,
            lt.precio_venta,
            (lt.precio_venta - lt.precio_coste_real) * lt.cantidad as ganancia,
            NULL as punto_origen_id,
            NULL as punto_destino_id,
            NULL as punto_origen_nombre,
            NULL as punto_destino_nombre,
            NULL as almacen_origen_id,
            NULL as almacen_destino_id,
            ? as almacen_origen_nombre,
            ? as almacen_destino_nombre,
            NULL as zona_origen,
            NULL as zona_destino,
            -- Calcular cantidad antes y después de la transferencia
            (SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = lt.producto_id AND COALESCE(almacen_id, 0) = ?) + lt.cantidad as cantidad_antes,
            (SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = lt.producto_id AND COALESCE(almacen_id, 0) = ?) as cantidad_despues,
            'Transferencia de ' || lt.cantidad || ' unidades (Precio: ' || lt.precio_venta || ')' as notas,
            lt.creado_en,
            NULL as usuario
          FROM LogTransferencia lt
          LEFT JOIN Producto p ON lt.producto_id = p.id
          WHERE lt.punto_id = 0
            AND EXISTS (
              SELECT 1 FROM AlmacenProducto ap 
              WHERE ap.producto_id = lt.producto_id 
              AND COALESCE(ap.almacen_id, 0) = ?
            ) -- Solo si el producto existe en el almacén actual
        UNION ALL
          
          -- Correcciones de transferencias (desde el almacén actual)
          SELECT 
            lt.id,
            'correccion_transferencia' as tipo,
            lt.producto_id,
            p.nombre as producto_nombre,
            p.categoria as producto_categoria,
            lt.cantidad,
            lt.cantidad as cantidad_inicial, -- Para correcciones, la cantidad corregida es la inicial
            NULL as cantidad_total_en_momento, -- No aplica para correcciones
            lt.precio_coste_real as precio_coste,
            lt.precio_venta,
            (lt.precio_venta - lt.precio_coste_real) * lt.cantidad as ganancia,
            -- Para correcciones, mostrar información básica del almacén actual
            NULL as punto_origen_id,
            NULL as punto_destino_id,
            NULL as punto_origen_nombre,
            NULL as punto_destino_nombre,
            NULL as almacen_origen_id,
            NULL as almacen_destino_id,
            ? as almacen_origen_nombre,
            ? as almacen_destino_nombre,
            NULL as zona_origen,
            NULL as zona_destino,
            -- Para correcciones, cantidad_antes y cantidad_despues no aplican
            NULL as cantidad_antes,
            NULL as cantidad_despues,
            lt.notas as notas,
            lt.creado_en,
            NULL as usuario
          FROM LogTransferencia lt
          LEFT JOIN Producto p ON lt.producto_id = p.id
          WHERE lt.notas IS NOT NULL 
            AND lt.notas LIKE '%CORRECCIÓN:%'
            AND EXISTS (
              SELECT 1 FROM AlmacenProducto ap 
              WHERE ap.producto_id = lt.producto_id 
              AND COALESCE(ap.almacen_id, 0) = ?
            ) -- Solo si el producto existe en el almacén actual
        )
      `;

      // Agregar parámetros según el contexto
      if (puntoId) {
        params.push(puntoId); // Para productos creados en punto
      } else {
        params.push(almacenId); // Para productos creados en almacén
      }

      // Para la tabla Almacen no se necesitan parámetros adicionales
      // porque la condición es dinámica (1 = 1 o 1 = 0)

      params.push(
        almacenNombre,
        almacenId,
        almacenNombre,
        almacenId,
        almacenId,
        almacenId,
      ); // Para transferencias a puntos (incluye filtro EXISTS y cálculos de cantidad)
      params.push(
        almacenNombre,
        almacenNombre,
        almacenId,
        almacenId,
        almacenId,
      ); // Para transferencias entre almacenes (nombre origen, nombre destino, cantidad_antes, cantidad_despues, filtro EXISTS)
      params.push(almacenNombre, almacenNombre, almacenId); // Para correcciones (nombre origen, nombre destino, filtro EXISTS)

      // Aplicar filtros adicionales
      if (filtros?.fechaDesde) {
        query += ` WHERE creado_en >= ?`;
        params.push(filtros.fechaDesde);
      }

      if (filtros?.fechaHasta) {
        query += `${filtros?.fechaDesde ? " AND" : "WHERE"} creado_en <= ?`;
        params.push(filtros.fechaHasta);
      }

      if (filtros?.tipoMovimiento) {
        if (filtros.tipoMovimiento === "transferencia") {
          query += `${filtros?.fechaDesde || filtros?.fechaHasta ? " AND" : "WHERE"} (tipo = 'transferencia_punto' OR tipo = 'transferencia_almacen')`;
        } else if (filtros.tipoMovimiento === "transferencia_punto") {
          query += `${filtros?.fechaDesde || filtros?.fechaHasta ? " AND" : "WHERE"} tipo = 'transferencia_punto'`;
        } else if (filtros.tipoMovimiento === "transferencia_almacen") {
          query += `${filtros?.fechaDesde || filtros?.fechaHasta ? " AND" : "WHERE"} tipo = 'transferencia_almacen'`;
        } else {
          query += `${filtros?.fechaDesde || filtros?.fechaHasta ? " AND" : "WHERE"} tipo = ?`;
          params.push(filtros.tipoMovimiento);
        }
      }

      if (filtros?.productoId) {
        query += `${filtros?.fechaDesde || filtros?.fechaHasta || filtros?.tipoMovimiento ? " AND" : "WHERE"} producto_id = ?`;
        params.push(filtros.productoId);
      }

      query += ` ORDER BY creado_en DESC`;

      if (filtros?.limit) {
        query += ` LIMIT ?`;
        params.push(filtros.limit);
      } else if (almacenId !== 0) {
        // Para almacenes específicos, limitamos para no sobrecargar
        query += ` LIMIT 200`;
      }

      if (filtros?.offset) {
        query += ` OFFSET ?`;
        params.push(filtros.offset);
      }

      console.log("🔍 Query final:", query);
      console.log("🔍 Parámetros:", params);
      console.log("🔍 almacenNombre:", almacenNombre);
      console.log("🔍 almacenId:", almacenId);

      console.log("🔍 Query con parámetros:", params);
      // Primero, obtener todos los movimientos sin cálculos complejos
      const movimientos = await executeQuery<any>(query, params);
      console.log("📊 Resultados:", movimientos.length, "movimientos");

      // Debug para transferencias entre almacenes
      movimientos.forEach((mov: any, idx: number) => {
        if (mov.tipo === "transferencia_almacen") {
          console.log(`🔄 Transferencia ${idx + 1}:`, {
            producto: mov.producto_nombre,
            cantidad_transferida: mov.cantidad,
            cantidad_antes: mov.cantidad_antes,
            cantidad_despues: mov.cantidad_despues,
            almacen_origen: mov.almacen_origen_nombre,
            almacen_destino: mov.almacen_destino_nombre,
          });
        }
      });

      // Calcular totales acumulados para creaciones
      const creacionesPorNombre = new Map<string, number>();

      // Primero, acumular todas las cantidades iniciales por nombre de producto
      // ordenadas por fecha para calcular el acumulado histórico
      const creacionesOrdenadas = movimientos
        .filter((mov) => mov.tipo === "creacion")
        .sort(
          (a, b) =>
            new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime(),
        );

      creacionesOrdenadas.forEach((mov: any) => {
        const nombre = mov.producto_nombre?.trim();
        let cantidadInicial =
          Number(mov.cantidad_inicial_text || mov.cantidad_inicial || 0) || 0;

        if (cantidadInicial === 0 && mov.notas) {
          const match = mov.notas.match(/Cantidad inicial: (\d+)/);
          if (match && match[1]) {
            cantidadInicial = Number(match[1]);
          }
        }

        if (nombre) {
          const actual = creacionesPorNombre.get(nombre) || 0;
          // Acumular históricamente: suma de todas las cantidades iniciales hasta esa fecha
          creacionesPorNombre.set(nombre, actual + cantidadInicial);
        }
      });

      // Ahora procesar resultados y asignar totales acumulados históricos
      const processedResults = movimientos.map((row: any) => {
        // Extraer cantidad_inicial del campo notas si es undefined
        let cantidadInicial =
          Number(row.cantidad_inicial_text || row.cantidad_inicial || 0) || 0;

        if (cantidadInicial === 0 && row.notas && row.tipo === "creacion") {
          // Extraer del campo notas: "Producto creado en almacén (Cantidad inicial: 30)"
          const match = row.notas.match(/Cantidad inicial: (\d+)/);
          if (match && match[1]) {
            cantidadInicial = Number(match[1]);
          }
        }

        // Calcular total acumulado histórico para creaciones
        let totalAcumulado = 0;
        let notaTotalHistorico = "";
        if (row.tipo === "creacion") {
          const nombre = row.producto_nombre?.trim();
          if (nombre) {
            // Calcular el total acumulado hasta la fecha de esta creación
            let acumuladoHastaFecha = 0;
            creacionesOrdenadas.forEach((creacion: any) => {
              if (
                creacion.producto_nombre?.trim() === nombre &&
                new Date(creacion.creado_en) <= new Date(row.creado_en)
              ) {
                // Para la creación actual, usar cantidad_inicial
                // Para creaciones anteriores, usar cantidad (stock actual en ese momento)
                let cantidadAAgregar = 0;
                if (creacion.id === row.id) {
                  // Es la creación actual -> usar cantidad_inicial
                  cantidadAAgregar =
                    Number(
                      creacion.cantidad_inicial_text ||
                        creacion.cantidad_inicial ||
                        0,
                    ) || 0;
                  if (cantidadAAgregar === 0 && creacion.notas) {
                    const match = creacion.notas.match(
                      /Cantidad inicial: (\d+)/,
                    );
                    if (match && match[1]) {
                      cantidadAAgregar = Number(match[1]);
                    }
                  }
                } else {
                  // Es una creación anterior -> usar cantidad (stock actual)
                  cantidadAAgregar = Number(creacion.cantidad) || 0;
                }

                acumuladoHastaFecha += cantidadAAgregar;
              }
            });
            totalAcumulado = acumuladoHastaFecha;

            // Si el totalAcumulado resultante es 0 o es muy bajo (indicando problema), buscar si hay transferencias del mismo producto que ocurrieron DESPUÉS de la creación
            if (
              (totalAcumulado === 0 || totalAcumulado < Number(row.cantidad)) &&
              cantidadInicial === 0
            ) {
              console.log(
                `🔍 Detectado problema en cálculo para ${nombre}: totalAcumulado=${totalAcumulado}, cantidad=${row.cantidad}`,
              );

              // Buscar transferencias del mismo producto que ocurrieron DESPUÉS de la creación (no misma fecha)
              const transferenciasDespues = movimientos
                .filter(
                  (mov: any) =>
                    mov.tipo === "transferencia_almacen" &&
                    mov.producto_nombre?.trim() === nombre &&
                    new Date(mov.creado_en) > new Date(row.creado_en),
                )
                .sort(
                  (a: any, b: any) =>
                    new Date(a.creado_en).getTime() -
                    new Date(b.creado_en).getTime(),
                );

              if (transferenciasDespues.length > 0) {
                // Si hay transferencias después, calcular la cantidad original sumando las transferencias
                const totalTransferencias = transferenciasDespues.reduce(
                  (sum: number, mov: any) => sum + Number(mov.cantidad || 0),
                  0,
                );
                const cantidadOriginal =
                  Number(row.cantidad || 0) + totalTransferencias;
                totalAcumulado = cantidadOriginal;
                console.log(
                  `🔄 Calculando cantidad original para ${nombre}: ${cantidadOriginal} unidades (actual: ${row.cantidad}, transferidas después: ${totalTransferencias})`,
                );
              } else {
                // Si no hay transferencias después, usar la cantidad actual como cantidad original
                totalAcumulado = Number(row.cantidad) || 0;
                console.log(
                  `🆕 Usando cantidad actual para ${nombre}: ${totalAcumulado} unidades (sin transferencias posteriores)`,
                );
              }
            }

            // Si aún es 0 pero cantidadInicial > 0, usar cantidadInicial
            if (totalAcumulado === 0 && cantidadInicial > 0) {
              totalAcumulado = cantidadInicial;
            }

            // Crear nota histórica independiente para el total
            notaTotalHistorico = `Total: ${totalAcumulado} unidades`;
          }
        }

        // Debug específico para movimientos de creación
        if (row.tipo === "creacion") {
          console.log(`🆕 Creación ${row.producto_nombre}:`, {
            id: row.id,
            cantidad: row.cantidad, // Stock actual
            cantidad_inicial: cantidadInicial,
            cantidad_total_en_momento: totalAcumulado, // Acumulado histórico hasta esa fecha
            creado_en: row.creado_en,
            notas: row.notas,
          });
        }

        return {
          ...row,
          precio_coste: Number(row.precio_coste) || 0,
          precio_venta: Number(row.precio_venta) || 0,
          ganancia: Number(row.ganancia) || 0,
          cantidad: Number(row.cantidad) || 0,
          cantidad_inicial: cantidadInicial,
          cantidad_total_en_momento: totalAcumulado,
          nota_total_historico: notaTotalHistorico, // Nueva nota histórica independiente
        };
      });

      console.log("✅ Movimientos procesados:", processedResults.length);

      return processedResults as MovimientoAlmacen[];
    } catch (error) {
      console.error(
        "❌ Error en AlmacenHistoryService.getMovimientosHistorialAlmacen:",
        error,
      );
      return [];
    }
  }

  // Función para obtener productos creados en el almacén
  static async getProductosCreadosAlmacen(
    almacenId?: number,
    limit?: number,
  ): Promise<MovimientoAlmacen[]> {
    try {
      console.log("🔍 Buscando productos creados en almacén:", almacenId);

      const query = `
        SELECT 
          ap.id,
          'creacion' as tipo,
          ap.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          ap.cantidad,
          p.precio_coste as precio_coste,
          NULL as precio_venta,
          0 as ganancia,
          NULL as punto_origen_id,
          NULL as punto_destino_id,
          NULL as punto_origen_nombre,
          NULL as punto_destino_nombre,
          ap.almacen_id as almacen_origen_id,
          NULL as almacen_destino_id,
          CASE 
            WHEN ap.almacen_id IS NULL THEN 'Almacén General'
            ELSE 'Almacén ' || ap.almacen_id
          END as almacen_origen_nombre,
          NULL as almacen_destino_nombre,
          NULL as zona_origen,
          NULL as zona_destino,
          'Producto creado en almacén' as notas,
          ap.creado_en,
          NULL as usuario
        FROM AlmacenProducto ap
        LEFT JOIN Producto p ON ap.producto_id = p.id
        ${almacenId ? "WHERE ap.almacen_id = ?" : ""}
        ORDER BY ap.creado_en DESC
        ${limit ? "LIMIT ?" : ""}
      `;

      const params =
        almacenId && limit
          ? [almacenId, limit]
          : almacenId
            ? [almacenId]
            : limit
              ? [limit]
              : [];

      const resultados = await executeQuery(query, params);
      console.log("✅ Productos creados obtenidos:", resultados.length);

      return resultados.map((row: any) => ({
        ...row,
        cantidad: parseInt(row.cantidad) || 0,
        precio_coste: parseFloat(row.precio_coste) || 0,
        precio_venta: row.precio_venta
          ? parseFloat(row.precio_venta)
          : undefined,
        ganancia: row.ganancia ? parseFloat(row.ganancia) : undefined,
      })) as MovimientoAlmacen[];
    } catch (error) {
      console.error(
        "❌ Error en AlmacenHistoryService.getProductosCreadosAlmacen:",
        error,
      );
      return [];
    }
  }

  // Función para obtener transferencias desde almacén
  static async getTransferenciasDesdeAlmacen(
    almacenId?: number,
    limit?: number,
  ): Promise<MovimientoAlmacen[]> {
    try {
      console.log("🔍 Buscando transferencias desde almacén:", almacenId);

      const query = `
        SELECT 
          lt.id,
          CASE 
            WHEN lt.punto_id = 0 THEN 'transferencia_almacen'
            ELSE 'transferencia_punto'
          END as tipo,
          lt.producto_id,
          p.nombre as producto_nombre,
          p.categoria as producto_categoria,
          lt.cantidad,
          lt.precio_coste_real as precio_coste,
          lt.precio_venta,
          (lt.precio_venta - lt.precio_coste_real) * lt.cantidad as ganancia,
          NULL as punto_origen_id,
          lt.punto_id as punto_destino_id,
          CASE 
            WHEN lt.punto_id = 0 THEN 'Almacén General'
            ELSE NULL
          END as punto_origen_nombre,
          pt.nombre as punto_destino_nombre,
          NULL as almacen_origen_id,
          NULL as almacen_destino_id,
          CASE 
            WHEN lt.punto_id = 0 THEN 'Almacén General'
            ELSE NULL
          END as almacen_origen_nombre,
          NULL as almacen_destino_nombre,
          NULL as zona_origen,
          CASE 
            WHEN lt.punto_id = 0 THEN NULL
            ELSE 1
          END as zona_destino,
          lt.notas,
          lt.creado_en,
          NULL as usuario
        FROM LogTransferencia lt
        LEFT JOIN Producto p ON lt.producto_id = p.id
        LEFT JOIN Punto pt ON lt.punto_id = pt.id AND lt.punto_id > 0
        WHERE lt.punto_id = 0
        ${almacenId ? `AND (lt.notas LIKE '%almacén%' OR lt.notas LIKE '%${almacenId}%')` : ""}
        ORDER BY lt.creado_en DESC
        ${limit ? "LIMIT ?" : ""}
      `;

      const params = limit ? [limit] : [];

      const resultados = await executeQuery(query, params);
      console.log("✅ Transferencias obtenidas:", resultados.length);

      return resultados.map((row: any) => ({
        ...row,
        cantidad: parseInt(row.cantidad) || 0,
        precio_coste: parseFloat(row.precio_coste) || 0,
        precio_venta: row.precio_venta
          ? parseFloat(row.precio_venta)
          : undefined,
        ganancia: row.ganancia ? parseFloat(row.ganancia) : undefined,
      })) as MovimientoAlmacen[];
    } catch (error) {
      console.error(
        "❌ Error en AlmacenHistoryService.getTransferenciasDesdeAlmacen:",
        error,
      );
      return [];
    }
  }

  // Función para obtener estadísticas de almacén
  static async getEstadisticasAlmacen(
    filtros?: FiltrosHistorialAlmacen,
  ): Promise<EstadisticasAlmacen> {
    try {
      const movimientos = await this.getMovimientosHistorialAlmacen(filtros);

      const estadisticas: EstadisticasAlmacen = {
        totalMovimientos: movimientos.length,
        totalTransferencias: 0,
        totalProductosCreados: 0,
        totalProductosEliminados: 0,
        totalTransferenciasPunto: 0,
        totalTransferenciasAlmacen: 0,
        valorTotalTransferencias: 0,
        valorTotalGanancias: 0,
      };

      movimientos.forEach((mov) => {
        switch (mov.tipo) {
          case "transferencia_punto":
            estadisticas.totalTransferencias++;
            estadisticas.totalTransferenciasPunto++;
            estadisticas.valorTotalTransferencias +=
              mov.cantidad * mov.precio_coste;
            if (mov.ganancia) {
              estadisticas.valorTotalGanancias += mov.ganancia;
            }
            break;
          case "transferencia_almacen":
            estadisticas.totalTransferencias++;
            estadisticas.totalTransferenciasAlmacen++;
            estadisticas.valorTotalTransferencias +=
              mov.cantidad * mov.precio_coste;
            if (mov.ganancia) {
              estadisticas.valorTotalGanancias += mov.ganancia;
            }
            break;
          case "creacion":
            estadisticas.totalProductosCreados++;
            break;
          case "eliminacion":
            estadisticas.totalProductosEliminados++;
            break;
        }
      });

      return estadisticas;
    } catch (error) {
      console.error(
        "Error en AlmacenHistoryService.getEstadisticasAlmacen:",
        error,
      );
      return {
        totalMovimientos: 0,
        totalTransferencias: 0,
        totalProductosCreados: 0,
        totalProductosEliminados: 0,
        totalTransferenciasPunto: 0,
        totalTransferenciasAlmacen: 0,
        valorTotalTransferencias: 0,
        valorTotalGanancias: 0,
      };
    }
  }

  // Funciones auxiliares
  static async getMovimientosPorProducto(
    productoId: number,
    limit?: number,
  ): Promise<MovimientoAlmacen[]> {
    return this.getMovimientosHistorialAlmacen({
      productoId,
      limit: limit || 50,
    });
  }

  static async getMovimientosPorAlmacen(
    almacenId: number,
    limit?: number,
  ): Promise<MovimientoAlmacen[]> {
    return this.getMovimientosHistorialAlmacen({
      almacenId,
      limit: limit || 50,
    });
  }

  static async getMovimientosPorFecha(
    fechaDesde: string,
    fechaHasta?: string,
  ): Promise<MovimientoAlmacen[]> {
    return this.getMovimientosHistorialAlmacen({
      fechaDesde,
      fechaHasta: fechaHasta || fechaDesde,
    });
  }
}
