// src/db/services/almacen_service.ts
import {
  getFechaHoraLocalCompleta,
  getFechaLocal,
} from "../../utils/dateUtils";
import { executeNonQuery, executeQuery, getSingleValue } from "../database";

export class AlmacenService {
  // 🔧 FUNCIÓN CENTRALIZADA DE AJUSTE DE STOCK
  // Esta es la ÚNICA fuente de verdad para modificar stock
  static async ajustarStock(
    productoId: number,
    almacenId: number,
    delta: number,
    contexto: string = "operación",
  ): Promise<{ success: boolean; stockFinal?: number; message?: string }> {
    try {
      console.log(` AJUSTAR STOCK - ${contexto}`);
      console.log(` Producto ID: ${productoId}`);
      console.log(` Almacén ID: ${almacenId}`);
      console.log(` Delta: ${delta > 0 ? "+" : ""}${delta}`);

      // Validar que delta no sea NaN
      if (isNaN(delta)) {
        throw new Error(`Delta inválido: ${delta}`);
      }

      // Obtener stock actual para logging
      const stockAntes =
        (await getSingleValue<number>(
          "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
          [productoId, almacenId],
        )) || 0;

      console.log(` Stock antes: ${stockAntes}`);

      // INSERT OR REPLACE con MAX para garantizar nunca stock negativo
      await executeNonQuery(
        `INSERT OR REPLACE INTO AlmacenProducto (
          producto_id, 
          almacen_id, 
          cantidad, 
          actualizado_en
        ) VALUES (
          ?, 
          ?, 
          MAX(
            COALESCE(
              (SELECT cantidad FROM AlmacenProducto 
               WHERE producto_id = ? AND almacen_id = ?), 
              0
            ) + ?, 
            0
          ),
          ?
        )`,
        [
          productoId,
          almacenId,
          productoId,
          almacenId,
          delta,
          getFechaHoraLocalCompleta(),
        ],
      );

      // Obtener stock final para logging y retorno
      const stockDespues =
        (await getSingleValue<number>(
          "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
          [productoId, almacenId],
        )) || 0;

      console.log(` Stock después: ${stockDespues}`);
      console.log(` Ajuste completado: ${contexto}`);

      // Registrar en HistorialInventario
      await this.insertarHistorialInventario(
        productoId,
        almacenId,
        null, // punto_id
        null, // zona_id
        "ajuste",
        delta,
        stockAntes,
        stockDespues,
        `Almacén ${almacenId}`,
        `Ajuste de stock: ${delta > 0 ? "+" : ""}${Math.abs(delta)} unidades - ${contexto}`,
      );

      return {
        success: true,
        stockFinal: stockDespues,
      };
    } catch (error) {
      console.error(` Error en ajustarStock (${contexto}):`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  // 🔧 WRAPPER PARA ALMACENZONA (transferencias a puntos)
  static async ajustarStockZona(
    productoId: number,
    puntoId: number,
    zonaId: number,
    delta: number,
    contexto: string = "operación",
  ): Promise<{ success: boolean; stockFinal?: number; message?: string }> {
    try {
      console.log(` AJUSTAR STOCK ZONA - ${contexto}`);
      console.log(` Producto ID: ${productoId}`);
      console.log(` Punto ID: ${puntoId}`);
      console.log(` Zona ID: ${zonaId}`);
      console.log(` Delta: ${delta > 0 ? "+" : ""}${delta}`);

      // Validar que delta no sea NaN
      if (isNaN(delta)) {
        throw new Error(`Delta inválido: ${delta}`);
      }

      // Obtener stock actual para logging
      const stockAntes =
        (await getSingleValue<number>(
          "SELECT COALESCE(cantidad, 0) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = ?",
          [productoId, puntoId, zonaId],
        )) || 0;

      console.log(` Stock antes (zona): ${stockAntes}`);

      // INSERT OR REPLACE con MAX para garantizar nunca stock negativo
      await executeNonQuery(
        `INSERT OR REPLACE INTO AlmacenZona (
          producto_id, 
          punto_id, 
          zona_id, 
          cantidad
        ) VALUES (
          ?, 
          ?, 
          ?, 
          MAX(
            COALESCE(
              (SELECT cantidad FROM AlmacenZona 
               WHERE producto_id = ? AND punto_id = ? AND zona_id = ?), 
              0
            ) + ?, 
            0
          )
        )`,
        [productoId, puntoId, zonaId, productoId, puntoId, zonaId, delta],
      );

      // Obtener stock final para logging y retorno
      const stockDespues =
        (await getSingleValue<number>(
          "SELECT COALESCE(cantidad, 0) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = ?",
          [productoId, puntoId, zonaId],
        )) || 0;

      console.log(` Stock después: ${stockDespues}`);
      console.log(` Ajuste completado: ${contexto}`);

      // Registrar en HistorialInventario
      await this.insertarHistorialInventario(
        productoId,
        null, // almacen_id
        puntoId,
        zonaId,
        "ajuste",
        delta,
        stockAntes,
        stockDespues,
        `Punto ${puntoId} - Zona ${zonaId === 1 ? "Venta" : "Puntos"}`,
        `Ajuste de stock: ${delta > 0 ? "+" : ""}${Math.abs(delta)} unidades - ${contexto}`,
      );

      return {
        success: true,
        stockFinal: stockDespues,
      };
    } catch (error) {
      console.error(` Error en ajustarStockZona (${contexto}):`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }
  // Helper function para insertar en HistorialInventario
  private static async insertarHistorialInventario(
    productoId: number,
    almacenId: number | null,
    puntoId: number | null,
    zonaId: number | null,
    tipoMovimiento: string,
    cantidadVariacion: number,
    stockAnterior: number,
    stockNuevo: number,
    entidadOrigenDestino?: string,
    notas?: string,
  ): Promise<void> {
    try {
      await executeNonQuery(
        `INSERT INTO HistorialInventario (
          producto_id, 
          almacen_id, 
          punto_id, 
          zona_id, 
          tipo_movimiento, 
          cantidad_variacion, 
          stock_anterior, 
          stock_nuevo, 
          entidad_origen_destino, 
          notas
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productoId,
          almacenId,
          puntoId,
          zonaId,
          tipoMovimiento,
          cantidadVariacion,
          stockAnterior,
          stockNuevo,
          entidadOrigenDestino || null,
          notas || null,
        ],
      );
    } catch (error) {
      console.error("Error insertando en HistorialInventario:", error);
      throw error;
    }
  }

  // Eliminar producto de almacén general
  static async deleteProductoDeAlmacenGeneral(
    productoId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Eliminar de tabla Almacen (almacén general)
        await executeNonQuery("DELETE FROM Almacen WHERE producto_id = ?", [
          productoId,
        ]);

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: "Producto eliminado del almacén general correctamente",
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error(
        "Error en AlmacenService.deleteProductoDeAlmacenGeneral:",
        error,
      );
      return {
        success: false,
        message: "Error al eliminar producto del almacén general",
      };
    }
  }

  // Eliminar producto de zona de punto
  static async deleteProductoDeZonaPunto(
    productoId: number,
    puntoId: number,
    zonaId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Eliminar de tabla AlmacenZona (zonas de puntos)
        await executeNonQuery(
          "DELETE FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = ?",
          [productoId, puntoId, zonaId],
        );

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: "Producto eliminado de la zona del punto correctamente",
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error(
        "Error en AlmacenService.deleteProductoDeZonaPunto:",
        error,
      );
      return {
        success: false,
        message: "Error al eliminar producto de la zona del punto",
      };
    }
  }

  // Eliminar producto de almacén específico (AlmacenProducto)
  static async deleteProductoDeAlmacenEspecifico(
    productoId: number,
    almacenId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Eliminar de tabla AlmacenProducto (almacén específico)
        await executeNonQuery(
          "DELETE FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
          [productoId, almacenId],
        );

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: "Producto eliminado del almacén correctamente",
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error(
        "Error en AlmacenService.deleteProductoDeAlmacenEspecifico:",
        error,
      );
      return {
        success: false,
        message: "Error al eliminar producto del almacén",
      };
    }
  }

  // Transferir entre almacenes - VERSIÓN REFACTORIZADA CON ajustarStock
  static async transferirEntreAlmacenes(
    productoId: number,
    almacenOrigenId: number,
    almacenDestinoId: number,
    cantidad: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Obtener información del producto
        const productoResult = await executeQuery(
          "SELECT nombre, categoria, precio_coste FROM Producto WHERE id = ?",
          [productoId],
        );

        const producto = productoResult[0];
        if (!producto) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message: "Producto no encontrado",
          };
        }

        // Obtener nombres de los almacenes
        const almacenOrigenResult = await executeQuery(
          "SELECT nombre FROM Almacenes WHERE id = ?",
          [almacenOrigenId],
        );

        const almacenDestinoResult = await executeQuery(
          "SELECT nombre FROM Almacenes WHERE id = ?",
          [almacenDestinoId],
        );

        const almacenOrigen = almacenOrigenResult[0];
        const almacenDestino = almacenDestinoResult[0];

        // Verificar stock en almacén origen
        const stockOrigen = await getSingleValue<number>(
          "SELECT cantidad FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
          [productoId, almacenOrigenId],
        );

        if (!stockOrigen || stockOrigen < cantidad) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message: `Stock insuficiente. Disponible: ${stockOrigen || 0} unidades`,
          };
        }

        // Capturar stock ANTES de la transferencia
        const stockAntesOrigen = await getSingleValue<number>(
          "SELECT cantidad FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
          [productoId, almacenOrigenId],
        );

        const stockAntesDestino =
          (await getSingleValue<number>(
            "SELECT cantidad FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
            [productoId, almacenDestinoId],
          )) || 0;

        console.log(`🔄 TRANSFERENCIA: ${cantidad} unidades`);
        console.log(
          `📍 Origen: Almacén ${almacenOrigenId} -> Destino: Almacén ${almacenDestinoId}`,
        );

        // 🔧 USAR ajustarStock para operaciones atómicas
        // Reducir stock en almacén origen
        const resultadoOrigen = await this.ajustarStock(
          productoId,
          almacenOrigenId,
          -cantidad,
          `Transferencia salida a Almacén ${almacenDestinoId}`,
        );

        if (!resultadoOrigen.success) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message: `Error al reducir stock en origen: ${resultadoOrigen.message}`,
          };
        }

        // Aumentar stock en almacén destino
        const resultadoDestino = await this.ajustarStock(
          productoId,
          almacenDestinoId,
          cantidad,
          `Transferencia entrada desde Almacén ${almacenOrigenId}`,
        );

        if (!resultadoDestino.success) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message: `Error al aumentar stock en destino: ${resultadoDestino.message}`,
          };
        }

        // Capturar stock DESPUÉS de la transferencia
        const stockDespuesOrigen = resultadoOrigen.stockFinal || 0;
        const stockDespuesDestino = resultadoDestino.stockFinal || 0;

        // Insertar registros en HistorialInventario
        // Registro para el almacén de origen (salida)
        await this.insertarHistorialInventario(
          productoId,
          almacenOrigenId,
          null, // punto_id
          null, // zona_id
          "transferencia",
          -cantidad, // salida negativa
          stockAntesOrigen || 0,
          stockDespuesOrigen,
          `Almacén ${almacenDestino?.nombre || "Almacén " + almacenDestinoId}`,
          `Transferencia de ${cantidad} unidades a ${almacenDestino?.nombre || "Almacén " + almacenDestinoId}`,
        );

        // Registro para el almacén de destino (entrada)
        await this.insertarHistorialInventario(
          productoId,
          almacenDestinoId,
          null, // punto_id
          null, // zona_id
          "transferencia",
          cantidad, // entrada positiva
          stockAntesDestino,
          stockDespuesDestino,
          `Almacén ${almacenOrigen?.nombre || "Almacén " + almacenOrigenId}`,
          `Transferencia de ${cantidad} unidades desde ${almacenOrigen?.nombre || "Almacén " + almacenOrigenId}`,
        );

        // Registrar en el historial (LogTransferencia) con nota individual del stock restante
        const stockRestante = stockDespuesOrigen;
        const notas = `Transferencia desde Almacén ${almacenOrigen?.nombre || "Almacén " + almacenOrigenId} hacia Almacén ${almacenDestino?.nombre || "Almacén " + almacenDestinoId} (Quedaron: ${stockRestante} unidades)`;
        await executeNonQuery(
          `INSERT INTO LogTransferencia (
            producto_id, 
            punto_id, 
            cantidad, 
            precio_venta, 
            precio_coste_real, 
            notas,
            cantidad_antes,
            cantidad_despues
          ) VALUES (?, 0, ?, ?, ?, ?, ?, ?)`,
          [
            productoId,
            cantidad,
            producto.precio_coste, // precio_venta = precio_coste para transferencias entre almacenes
            producto.precio_coste,
            notas,
            stockAntesOrigen || 0,
            stockRestante,
          ],
        );

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: `${cantidad} unidades transferidas correctamente de "${almacenOrigen?.nombre || "Almacén " + almacenOrigenId}" a "${almacenDestino?.nombre || "Almacén " + almacenDestinoId}"`,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error en AlmacenService.transferirEntreAlmacenes:", error);
      return {
        success: false,
        message: "Error al transferir entre almacenes",
      };
    }
  }

  // Corregir transferencia con almacén destino específico - VERSIÓN REFACTORIZADA CON ajustarStock
  static async corregirTransferenciaConDestino(
    transferenciaId: number,
    cantidadOriginal: number,
    cantidadCorrecta: number,
    motivo: string,
    almacenCorreccionId: number,
  ): Promise<{ success: boolean; message: string }> {
    console.log(
      "🔧 INICIANDO CORRECCIÓN DE TRANSFERENCIA - VERSIÓN CENTRALIZADA",
    );
    console.log("📋 transferenciaId:", transferenciaId);
    console.log("📋 cantidadOriginal:", cantidadOriginal);
    console.log("📋 cantidadCorrecta:", cantidadCorrecta);
    console.log("📋 motivo:", motivo);
    console.log("📋 almacenCorreccionId:", almacenCorreccionId);

    // Validación inicial
    if (
      !transferenciaId ||
      !cantidadOriginal ||
      !cantidadCorrecta ||
      !motivo?.trim() ||
      !almacenCorreccionId
    ) {
      console.error("❌ Parámetros inválidos para corrección de transferencia");
      return {
        success: false,
        message: "Parámetros inválidos para corrección de transferencia",
      };
    }

    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Obtener detalles de la transferencia original
        let transferenciaResult = await executeQuery(
          `SELECT lt.*, p.nombre as producto_nombre, p.precio_coste
           FROM LogTransferencia lt
           LEFT JOIN Producto p ON lt.producto_id = p.id
           WHERE lt.id = ?`,
          [transferenciaId],
        );

        let transferencia =
          transferenciaResult.length > 0 ? transferenciaResult[0] : null;

        // Si no se encuentra en LogTransferencia, buscar en HistorialInventario
        if (!transferencia) {
          console.log(
            "🔍 Transferencia no encontrada en LogTransferencia, buscando en HistorialInventario...",
          );

          const historialResult = await executeQuery(
            `SELECT hi.*, p.nombre as producto_nombre, p.precio_coste
             FROM HistorialInventario hi
             LEFT JOIN Producto p ON hi.producto_id = p.id
             WHERE hi.id = ? AND hi.tipo_movimiento = 'transferencia'`,
            [transferenciaId],
          );

          if (historialResult.length > 0) {
            const historial = historialResult[0];
            transferencia = {
              id: historial.id,
              producto_id: historial.producto_id,
              punto_id: historial.punto_id,
              cantidad: Math.abs(historial.cantidad_variacion),
              precio_venta: 0,
              precio_coste_real: 0,
              notas: historial.notas,
              producto_nombre: historial.producto_nombre,
              precio_coste: 0,
            };
            console.log(
              "✅ Transferencia encontrada en HistorialInventario:",
              transferencia,
            );
          }
        }

        if (!transferencia) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message:
              "Transferencia no encontrada en LogTransferencia ni HistorialInventario",
          };
        }

        const delta = cantidadCorrecta - cantidadOriginal;
        const productoId = transferencia.producto_id;
        const precioCoste =
          transferencia.precio_coste_real || transferencia.precio_coste;

        // Si la diferencia es 0, no hay nada que corregir
        if (delta === 0) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message:
              "La cantidad correcta es igual a la original. No hay cambios que realizar.",
          };
        }

        // Determinar tipo de transferencia
        let esTransferenciaAPunto = false;
        let puntoDestinoId: number | null = null;

        // Primero verificar si punto_id tiene valor
        if (transferencia.punto_id && transferencia.punto_id > 0) {
          esTransferenciaAPunto = true;
          puntoDestinoId = transferencia.punto_id;
          console.log(
            `📍 Transferencia a punto detectada por punto_id: Punto ${puntoDestinoId}`,
          );
        } else {
          // Si punto_id es null, verificar en las notas
          const notas = transferencia.notas || "";
          const matchTransferenciaAPunto = notas.match(
            /a\s+zona\s+de\s+venta\s+del\s+Punto\s+(\d+)/i,
          );

          if (matchTransferenciaAPunto) {
            esTransferenciaAPunto = true;
            puntoDestinoId = parseInt(matchTransferenciaAPunto[1]);
            console.log(
              `📍 Transferencia a punto detectada por notas: Punto ${puntoDestinoId}`,
            );
          } else {
            console.log(
              `📍 No es transferencia a punto (punto_id: ${transferencia.punto_id}, notas: "${notas}")`,
            );
          }
        }

        // Determinar almacén origen y destino original
        let almacenOrigenId: number;
        let almacenDestinoOriginalId: number;

        if (!esTransferenciaAPunto) {
          // Transferencia entre almacenes - extraer de notas
          const notas = transferencia.notas || "";
          const matchDesdeHacia = notas.match(
            /desde\s+Almacén\s+(\d+)\s+hacia\s+Almacén\s+(\d+)/i,
          );

          if (matchDesdeHacia) {
            almacenOrigenId = parseInt(matchDesdeHacia[1]);
            almacenDestinoOriginalId = parseInt(matchDesdeHacia[2]);
          } else {
            // Fallback: usar lógica de stock
            const stockPorAlmacen = await executeQuery(
              "SELECT almacen_id, cantidad FROM AlmacenProducto WHERE producto_id = ? AND cantidad > 0 ORDER BY cantidad DESC LIMIT 2",
              [productoId],
            );

            if (stockPorAlmacen.length >= 2) {
              almacenOrigenId = stockPorAlmacen[0].almacen_id;
              almacenDestinoOriginalId = stockPorAlmacen[1].almacen_id;
            } else {
              almacenOrigenId = almacenCorreccionId === 1 ? 2 : 1;
              almacenDestinoOriginalId = almacenCorreccionId;
            }
          }
        } else {
          // Transferencia a punto - extraer origen de notas
          const notas = transferencia.notas || "";
          const matchDesdeAlmacenAPunto = notas.match(
            /Transferencia\s+desde\s+Almacén\s+(\d+)\s+a\s+Punto\s+(\d+)/i,
          );

          if (matchDesdeAlmacenAPunto) {
            almacenOrigenId = parseInt(matchDesdeAlmacenAPunto[1]);
          } else {
            // Fallback: usar almacén con más stock
            const stockPorAlmacen = await executeQuery(
              "SELECT almacen_id, cantidad FROM AlmacenProducto WHERE producto_id = ? AND cantidad > 0 ORDER BY cantidad DESC LIMIT 1",
              [productoId],
            );
            almacenOrigenId =
              stockPorAlmacen.length > 0 ? stockPorAlmacen[0].almacen_id : 1;
          }
          almacenDestinoOriginalId = almacenCorreccionId; // Para transferencias a puntos, el destino original es el punto
        }

        console.log("🔍 IDENTIFICACIÓN DE ALMACENES:");
        console.log("📍 ORIGEN:", almacenOrigenId);
        console.log("📍 DESTINO ORIGINAL:", almacenDestinoOriginalId);
        console.log("📍 DESTINO CORRECCIÓN:", almacenCorreccionId);
        console.log("📊 DELTA:", delta);

        // 🧠 LÓGICA CORRECTA DE CORRECCIÓN
        if (delta < 0) {
          // CASO 1: DEVOLUCIÓN (cantidadCorrecta < cantidadOriginal)
          const cantidadADevolver = Math.abs(delta);
          console.log(`🔄 DEVOLUCIÓN: ${cantidadADevolver} unidades`);

          // Para transferencias a punto, SIEMPRE quitar del punto
          if (esTransferenciaAPunto && puntoDestinoId) {
            console.log(
              `📍 TRANSFERENCIA A PUNTO: Quitando del punto ${puntoDestinoId}: -${cantidadADevolver} unidades`,
            );

            // Verificar si el producto existe en la zona del punto antes de quitar
            const stockAntesZona = await getSingleValue<number>(
              "SELECT COALESCE(cantidad, 0) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = ?",
              [productoId, puntoDestinoId, 1], // zona_id = 1 es la zona de venta
            );
            console.log(
              `📊 Stock actual en zona de venta del punto ${puntoDestinoId}: ${stockAntesZona} unidades`,
            );

            if (stockAntesZona === 0) {
              console.warn(
                `⚠️ ADVERTENCIA: El producto ${productoId} no existe en la zona de venta del punto ${puntoDestinoId}. No se puede quitar stock.`,
              );
              console.warn(
                `💡 Posible solución: El producto debe existir en la zona de venta (zona_id=1) del punto antes de poder transferir unidades.`,
              );
            }

            // Quitar de la zona del punto
            const resultadoDestino = await this.ajustarStockZona(
              productoId,
              puntoDestinoId,
              1, // zona_id
              -cantidadADevolver,
              `Devolución desde punto ${puntoDestinoId}`,
            );
            if (!resultadoDestino.success) {
              throw new Error(
                `Error al devolver stock del punto: ${resultadoDestino.message}`,
              );
            }
            console.log(
              `✅ Stock quitado del punto ${puntoDestinoId}: ${resultadoDestino.stockFinal} unidades restantes`,
            );
          }

          // Verificar si el destino original es el mismo que el de corrección
          if (almacenDestinoOriginalId === almacenCorreccionId) {
            console.log(
              // ... (rest of the code remains the same)
              `📍 MISMO ALMACÉN: Destino original (${almacenDestinoOriginalId}) == Corrección (${almacenCorreccionId})`,
            );
            console.log(
              `🎯 SOLO devolver al almacén ${almacenCorreccionId}: +${cantidadADevolver} unidades`,
            );

            // SOLO devolver al almacén elegido por el usuario
            // NO quitar del destino original porque es el mismo almacén
            const resultadoCorreccion = await this.ajustarStock(
              productoId,
              almacenCorreccionId,
              cantidadADevolver,
              `Devolución a Almacén ${almacenCorreccionId}`,
            );
            if (!resultadoCorreccion.success) {
              throw new Error(
                `Error al devolver stock al almacén de corrección: ${resultadoCorreccion.message}`,
              );
            }
          } else {
            console.log(
              `📍 ALMACENES DIFERENTES: Destino original (${almacenDestinoOriginalId}) != Corrección (${almacenCorreccionId})`,
            );
            console.log(
              `🎯 Quitar del destino original ${almacenDestinoOriginalId}: -${cantidadADevolver} unidades`,
            );
            console.log(
              `🎯 Devolver al almacén ${almacenCorreccionId}: +${cantidadADevolver} unidades`,
            );

            // Quitar del destino original (almacén)
            if (!esTransferenciaAPunto) {
              const resultadoDestino = await this.ajustarStock(
                productoId,
                almacenDestinoOriginalId,
                -cantidadADevolver,
                `Devolución desde Almacén ${almacenDestinoOriginalId}`,
              );
              if (!resultadoDestino.success) {
                throw new Error(
                  `Error al devolver stock del destino: ${resultadoDestino.message}`,
                );
              }
            }

            // Devolver al almacén elegido por el usuario
            const resultadoCorreccion = await this.ajustarStock(
              productoId,
              almacenCorreccionId,
              cantidadADevolver,
              `Devolución a Almacén ${almacenCorreccionId}`,
            );
            if (!resultadoCorreccion.success) {
              throw new Error(
                `Error al devolver stock al almacén de corrección: ${resultadoCorreccion.message}`,
              );
            }
          }
        } else if (delta > 0) {
          // CASO 2: ENVÍO ADICIONAL (cantidadCorrecta > cantidadOriginal)
          const cantidadAEnviar = delta;
          console.log(`🔄 ENVÍO ADICIONAL: ${cantidadAEnviar} unidades`);

          // Verificar si el origen es el mismo que el destino original
          if (almacenOrigenId === almacenDestinoOriginalId) {
            console.log(
              `📍 MISMO ALMACÉN: Origen (${almacenOrigenId}) == Destino original (${almacenDestinoOriginalId})`,
            );
            console.log(
              `🎯 SOLO enviar al destino original ${almacenDestinoOriginalId}: +${cantidadAEnviar} unidades`,
            );

            // SOLO enviar al destino original
            // NO quitar del origen porque es el mismo almacén
            if (esTransferenciaAPunto && puntoDestinoId) {
              // Enviar a la zona del punto
              const resultadoDestino = await this.ajustarStockZona(
                productoId,
                puntoDestinoId,
                1, // zona_id
                cantidadAEnviar,
                `Envío adicional a punto ${puntoDestinoId}`,
              );
              if (!resultadoDestino.success) {
                throw new Error(
                  `Error al enviar stock al punto: ${resultadoDestino.message}`,
                );
              }
            } else {
              // Enviar al almacén destino original
              const resultadoDestino = await this.ajustarStock(
                productoId,
                almacenDestinoOriginalId,
                cantidadAEnviar,
                `Envío adicional a Almacén ${almacenDestinoOriginalId}`,
              );
              if (!resultadoDestino.success) {
                throw new Error(
                  `Error al enviar stock al destino: ${resultadoDestino.message}`,
                );
              }
            }
          } else {
            console.log(
              `📍 ALMACENES DIFERENTES: Origen (${almacenOrigenId}) != Destino original (${almacenDestinoOriginalId})`,
            );
            console.log(
              `🎯 Quitar del origen ${almacenOrigenId}: -${cantidadAEnviar} unidades`,
            );
            console.log(
              `🎯 Enviar al destino original ${almacenDestinoOriginalId}: +${cantidadAEnviar} unidades`,
            );

            // Quitar del almacén origen
            const resultadoOrigen = await this.ajustarStock(
              productoId,
              almacenOrigenId,
              -cantidadAEnviar,
              `Envío adicional desde Almacén ${almacenOrigenId}`,
            );
            if (!resultadoOrigen.success) {
              throw new Error(
                `Error al quitar stock del origen: ${resultadoOrigen.message}`,
              );
            }

            // Enviar al destino original
            if (esTransferenciaAPunto && puntoDestinoId) {
              // Enviar a la zona del punto
              const resultadoDestino = await this.ajustarStockZona(
                productoId,
                puntoDestinoId,
                1, // zona_id
                cantidadAEnviar,
                `Envío adicional a punto ${puntoDestinoId}`,
              );
              if (!resultadoDestino.success) {
                throw new Error(
                  `Error al enviar stock al punto: ${resultadoDestino.message}`,
                );
              }
            } else {
              // Enviar al almacén destino original
              const resultadoDestino = await this.ajustarStock(
                productoId,
                almacenDestinoOriginalId,
                cantidadAEnviar,
                `Envío adicional a Almacén ${almacenDestinoOriginalId}`,
              );
              if (!resultadoDestino.success) {
                throw new Error(
                  `Error al enviar stock al destino: ${resultadoDestino.message}`,
                );
              }
            }
          }
        }

        // Obtener nombres para logs
        const almacenOrigenNombre =
          (await getSingleValue<string>(
            "SELECT nombre FROM Almacenes WHERE id = ?",
            [almacenOrigenId],
          )) || `Almacén ${almacenOrigenId}`;

        const almacenDestinoNombre =
          (await getSingleValue<string>(
            "SELECT nombre FROM Almacenes WHERE id = ?",
            [almacenCorreccionId],
          )) || `Almacén ${almacenCorreccionId}`;

        const nombreDestinoOriginal = esTransferenciaAPunto
          ? `Punto ${puntoDestinoId}`
          : (await getSingleValue<string>(
              "SELECT nombre FROM Almacenes WHERE id = ?",
              [almacenDestinoOriginalId],
            )) || `Almacén ${almacenDestinoOriginalId}`;

        // Insertar registro de ajuste en HistorialInventario
        await this.insertarHistorialInventario(
          productoId,
          almacenOrigenId,
          null, // punto_id
          null, // zona_id
          "ajuste",
          delta,
          0, // stock_anterior (no se usa en ajustes)
          0, // stock_nuevo (no se usa en ajustes)
          delta < 0
            ? esTransferenciaAPunto
              ? `Punto ${puntoDestinoId}`
              : almacenDestinoNombre
            : nombreDestinoOriginal,
          `Corrección de transferencia: ${motivo} (Delta: ${delta > 0 ? "+" : ""}${delta})`,
        );

        // Registrar en LogTransferencia
        const notasCorreccion = `CORRECCIÓN: ${motivo}\nTransferencia original ID: ${transferenciaId}\nCantidad original: ${cantidadOriginal}\nCantidad correcta: ${cantidadCorrecta}\nDelta: ${delta > 0 ? "+" : ""}${delta} unidades\n${delta < 0 ? `Se devolvieron ${Math.abs(delta)} unidades a ${almacenDestinoNombre}` : `Se enviaron ${delta} unidades adicionales a ${nombreDestinoOriginal}`}`;

        await executeNonQuery(
          `INSERT INTO LogTransferencia (producto_id, punto_id, cantidad, precio_venta, precio_coste_real, notas) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            productoId,
            esTransferenciaAPunto ? puntoDestinoId : 0,
            Math.abs(delta),
            precioCoste,
            precioCoste,
            notasCorreccion,
          ],
        );

        await executeNonQuery("COMMIT");

        const accion = delta < 0 ? "devueltos" : "enviados";
        const direccion =
          delta < 0
            ? `desde ${nombreDestinoOriginal} hacia ${almacenDestinoNombre}`
            : `desde ${almacenOrigenNombre} hacia ${nombreDestinoOriginal}`;

        return {
          success: true,
          message: `Corrección realizada correctamente. Se ${accion} ${Math.abs(delta)} unidades ${direccion}. Stock actualizado.`,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error(
        "Error en AlmacenService.corregirTransferenciaConDestino:",
        error,
      );
      return {
        success: false,
        message: "Error al corregir la transferencia",
      };
    }
  }

  // Corregir transferencia - VERSIÓN SIMPLE Y FUNCIONAL
  static async corregirTransferencia(
    transferenciaId: number,
    cantidadOriginal: number,
    cantidadCorrecta: number,
    motivo: string,
  ): Promise<{ success: boolean; message: string }> {
    console.log("🔧 INICIANDO CORRECCIÓN DE TRANSFERENCIA");
    console.log("📋 transferenciaId:", transferenciaId);
    console.log("📋 cantidadOriginal:", cantidadOriginal);
    console.log("📋 cantidadCorrecta:", cantidadCorrecta);
    console.log("📋 motivo:", motivo);

    // Validación inicial: asegurar que estamos en el contexto correcto
    if (
      !transferenciaId ||
      !cantidadOriginal ||
      !cantidadCorrecta ||
      !motivo?.trim()
    ) {
      console.error("❌ Parámetros inválidos para corrección de transferencia");
      return {
        success: false,
        message: "Parámetros inválidos para corrección de transferencia",
      };
    }

    try {
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // Obtener detalles de la transferencia original
        const transferenciaResult = await executeQuery(
          `SELECT lt.*, p.nombre as producto_nombre, p.precio_coste
           FROM LogTransferencia lt
           LEFT JOIN Producto p ON lt.producto_id = p.id
           WHERE lt.id = ?`,
          [transferenciaId],
        );

        const transferencia = transferenciaResult[0];
        if (!transferencia) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message: "Transferencia no encontrada",
          };
        }

        const diferencia = cantidadCorrecta - cantidadOriginal;
        const productoId = transferencia.producto_id;
        const precioCoste =
          transferencia.precio_coste_real || transferencia.precio_coste;

        // Si la diferencia es 0, no hay nada que corregir
        if (diferencia === 0) {
          await executeNonQuery("ROLLBACK");
          return {
            success: false,
            message:
              "La cantidad correcta es igual a la original. No hay cambios que realizar.",
          };
        }

        // Determinar tipo de transferencia
        let esTransferenciaAPunto = false;
        let puntoDestinoId: number | null = null;
        let almacenDestinoId: number | null = null;
        let almacenDestinoNombre: string | null = null;

        // Si tiene punto_id > 0, es transferencia a punto
        if (transferencia.punto_id && transferencia.punto_id > 0) {
          esTransferenciaAPunto = true;
          puntoDestinoId = transferencia.punto_id;
          console.log(
            `📍 Transferencia a punto detectada: Punto ${puntoDestinoId}`,
          );
        } else {
          // Es transferencia entre almacenes, intentar extraer de notas
          const notas = transferencia.notas || "";

          // Mejorar el regex para extraer el almacén destino con múltiples patrones
          // Patrón 1: "hacia Almacén X" o "hacia Almacén X:" - buscar ID numérico (insensible a mayúsculas y múltiples espacios)
          const matchHacia = notas.match(/hacia\s+Almacén\s+(\d+)/i);
          if (matchHacia) {
            almacenDestinoId = parseInt(matchHacia[1]);
          }

          // Patrón 2: "desde Almacén X hacia Almacén Y" - tomar el segundo (ID numérico, insensible a mayúsculas)
          if (!almacenDestinoId) {
            const matchDesdeHacia = notas.match(
              /desde\s+Almacén\s+(\d+)\s+hacia\s+Almacén\s+(\d+)/i,
            );
            if (matchDesdeHacia) {
              almacenDestinoId = parseInt(matchDesdeHacia[1]);
            }
          }

          // Patrón 3: "hacia Almacén [nombre]" - buscar nombre textual (insensible a mayúsculas y múltiples espacios)
          if (!almacenDestinoId) {
            const matchHaciaNombre = notas.match(/hacia\s+Almacén\s+([^\s]+)/i);
            if (matchHaciaNombre) {
              almacenDestinoNombre = matchHaciaNombre[1].trim();
            }
          }

          // Patrón 4: "desde Almacén [nombre] hacia Almacén [nombre]" - tomar el segundo nombre (insensible a mayúsculas)
          if (!almacenDestinoId && !almacenDestinoNombre) {
            const matchDesdeHaciaNombres = notas.match(
              /desde\s+Almacén\s+([^\s]+)\s+hacia\s+Almacén\s+([^\s]+)/i,
            );
            if (matchDesdeHaciaNombres) {
              almacenDestinoNombre = matchDesdeHaciaNombres[2].trim();
            }
          }

          // Patrón 5: Cualquier nombre después de "hacia Almacén" en la segunda mitad del texto (insensible a mayúsculas)
          if (!almacenDestinoId && !almacenDestinoNombre) {
            const partes = notas.split("hacia");
            if (partes.length > 1) {
              const matchDestino = partes[1].match(/Almacén\s+([^\s]+)/i);
              if (matchDestino) {
                almacenDestinoNombre = matchDestino[1].trim();
              }
            }
          }

          // Si tenemos nombre pero no ID, buscar el almacén por nombre
          if (almacenDestinoNombre && !almacenDestinoId) {
            try {
              const almacenResult = await executeQuery(
                "SELECT id FROM Almacenes WHERE nombre = ? COLLATE NOCASE",
                [almacenDestinoNombre],
              );
              if (almacenResult.length > 0) {
                almacenDestinoId = almacenResult[0].id;
                console.log(
                  `🏢 Almacén destino encontrado por nombre "${almacenDestinoNombre}" -> ID: ${almacenDestinoId}`,
                );
              }
            } catch (error) {
              console.error("Error buscando almacén por nombre:", error);
            }
          }

          // Patrón 6: Último recurso - buscar todos los números de almacén y tomar el último
          if (!almacenDestinoId && !almacenDestinoNombre) {
            const todosLosAlmacenes = notas.match(/Almacén\s+(\d+)/gi);
            if (todosLosAlmacenes && todosLosAlmacenes.length > 1) {
              const ultimoMatch =
                todosLosAlmacenes[todosLosAlmacenes.length - 1].match(/(\d+)/);
              if (ultimoMatch) {
                almacenDestinoId = parseInt(ultimoMatch[1]);
              }
            }
          }

          if (almacenDestinoId) {
            console.log(
              `🏢 Transferencia entre almacenes detectada: Destino ID ${almacenDestinoId}`,
            );
          } else if (almacenDestinoNombre) {
            console.log(
              `🏢 Transferencia entre almacenes detectada: Destino "${almacenDestinoNombre}"`,
            );
          } else {
            console.log(
              "❌ No se pudo identificar almacén destino. Notas:",
              notas,
            );
            await executeNonQuery("ROLLBACK");
            return {
              success: false,
              message:
                "No se pudo identificar el almacén destino de la transferencia. Notas: " +
                notas,
            };
          }
        }

        // Para transferencias a puntos, el origen es el almacén específico que realizó la transferencia
        // Como el historial solo se muestra en el almacén que hizo la transferencia,
        // necesitamos identificar ese almacén específico
        let almacenOrigenId: number;

        if (esTransferenciaAPunto) {
          // Intentar extraer el almacén origen de las notas primero
          const notas = transferencia.notas || "";
          console.log(` Analizando notas para identificar origen: "${notas}"`);

          // Buscar patrones en las notas que indiquen el almacén origen
          const matchDesde = notas.match(/desde\s+Almacén\s+(\d+)/i);
          const matchAlmacen = notas.match(/Almacén\s+(\d+)/i);

          console.log(
            ` Resultado búsqueda patrones - matchDesde:`,
            matchDesde,
            `matchAlmacen:`,
            matchAlmacen,
          );

          if (matchDesde) {
            almacenOrigenId = parseInt(matchDesde[1]);
            console.log(
              ` Origen identificado desde notas (desde Almacén): Almacén ${almacenOrigenId}`,
            );
          } else if (matchAlmacen) {
            almacenOrigenId = parseInt(matchAlmacen[1]);
            console.log(
              ` Origen identificado desde notas (Almacén X): Almacén ${almacenOrigenId}`,
            );
          } else {
            console.log(
              ` No se encontró patrón en notas, intentando análisis de frecuencia...`,
            );
            // Si no hay notas claras, buscar transferencias similares del mismo producto
            // para ver qué almacén usa más frecuentemente
            try {
              const transferenciasSimilares = await executeQuery(
                `SELECT DISTINCT 
                 CASE 
                   WHEN lt.notas LIKE '%desde Almacén%' THEN
                     CAST(SUBSTR(lt.notas, INSTR(lt.notas, 'desde Almacén') + LENGTH('desde Almacén'), 10) AS INTEGER)
                   WHEN lt.notas LIKE '%Almacén%' THEN
                     CAST(SUBSTR(lt.notas, INSTR(lt.notas, 'Almacén') + LENGTH('Almacén'), 10) AS INTEGER)
                   ELSE 2
                 END as almacen_id
                 FROM LogTransferencia lt
                 WHERE lt.producto_id = ? 
                 AND lt.punto_id > 0
                 AND lt.notas LIKE '%Almacén%'
                 ORDER BY lt.creado_en DESC
                 LIMIT 5`,
                [productoId],
              );

              console.log(
                ` Transferencias similares encontradas:`,
                transferenciasSimilares,
              );

              if (transferenciasSimilares.length > 0) {
                // Usar el almacén más común en transferencias recientes
                const almacenesContador: { [key: number]: number } = {};
                transferenciasSimilares.forEach((t) => {
                  if (t.almacen_id) {
                    almacenesContador[t.almacen_id] =
                      (almacenesContador[t.almacen_id] || 0) + 1;
                  }
                });

                console.log(` Contador de almacenes:`, almacenesContador);

                // Encontrar el almacén más frecuente
                let maxCount = 0;
                let almacenMasFrecuente = 2; // default
                for (const [almacenId, count] of Object.entries(
                  almacenesContador,
                )) {
                  if (count > maxCount) {
                    maxCount = count;
                    almacenMasFrecuente = parseInt(almacenId);
                  }
                }

                almacenOrigenId = almacenMasFrecuente;
                console.log(
                  ` Origen identificado por frecuencia: Almacén ${almacenOrigenId} (${maxCount} transferencias)`,
                );
              } else {
                // Último recurso: asumir almacén 2 (primer almacén específico)
                almacenOrigenId = 2;
                console.log(
                  ` Origen por defecto (sin historial): Almacén ${almacenOrigenId}`,
                );
              }
            } catch (error) {
              console.error(
                "Error identificando almacén origen por frecuencia:",
                error,
              );
              almacenOrigenId = 2; // Default
            }
          }
        } else {
          // Para transferencias entre almacenes, intentar identificar el origen de las notas
          const notas = transferencia.notas || "";

          // Buscar patrón "desde Almacén X hacia Almacén Y"
          const matchDesdeHacia = notas.match(
            /desde\s+Almacén\s+(\d+)\s+hacia\s+Almacén\s+(\d+)/i,
          );
          if (matchDesdeHacia) {
            almacenOrigenId = parseInt(matchDesdeHacia[1]);
            console.log(
              `🏢 Origen identificado desde notas: Almacén ${almacenOrigenId}`,
            );
          } else {
            // Si no encuentra el patrón completo, buscar solo "desde Almacén X"
            const matchDesde = notas.match(/desde\s+Almacén\s+(\d+)/i);
            if (matchDesde) {
              almacenOrigenId = parseInt(matchDesde[1]);
              console.log(
                `🏢 Origen identificado desde notas (parcial): Almacén ${almacenOrigenId}`,
              );
            } else {
              // Último recurso: asumir que el origen es el almacén con más stock del producto
              try {
                const stockPorAlmacen = await executeQuery(
                  "SELECT almacen_id, cantidad FROM AlmacenProducto WHERE producto_id = ? AND cantidad > 0 ORDER BY cantidad DESC LIMIT 1",
                  [productoId],
                );

                if (stockPorAlmacen.length > 0) {
                  almacenOrigenId = stockPorAlmacen[0].almacen_id;
                  console.log(
                    `🏢 Origen identificado por stock: Almacén ${almacenOrigenId} (stock: ${stockPorAlmacen[0].cantidad})`,
                  );
                } else {
                  almacenOrigenId = 1; // Default
                  console.log(
                    `🏢 Origen por defecto: Almacén ${almacenOrigenId}`,
                  );
                }
              } catch (error) {
                almacenOrigenId = 1; // Default
                console.log(`🏢 Origen por error: Almacén ${almacenOrigenId}`);
              }
            }
          }
        }

        console.log(
          `📍 Origen: Almacén ${almacenOrigenId}, Destino: ${esTransferenciaAPunto ? `Punto ${puntoDestinoId}` : `Almacén ${almacenDestinoId}`}`,
        );

        // Lógica de corrección:
        // - Si cantidadCorrecta < cantidadOriginal: se transfirió de más, devolver al origen
        // - Si cantidadCorrecta > cantidadOriginal: se transfirió de menos, enviar más al destino
        if (diferencia < 0) {
          // Se transfirió de más (cantidad correcta es menor), devolver diferencia al origen
          const cantidadADevolver = Math.abs(diferencia);

          console.log(
            `🔄 Devolviendo ${cantidadADevolver} unidades al origen (Almacén ${almacenOrigenId})`,
          );

          // Para transferencias a puntos, el origen es el almacén específico que realizó la transferencia
          // Usar siempre AlmacenProducto para consistencia con la carga de datos
          if (esTransferenciaAPunto) {
            // Devolver al almacén origen (tabla AlmacenProducto)
            const resultadoOrigen = await executeNonQuery(
              "UPDATE AlmacenProducto SET cantidad = cantidad + ? WHERE producto_id = ? AND almacen_id = ?",
              [cantidadADevolver, productoId, almacenOrigenId],
            );

            if (resultadoOrigen.changes === 0) {
              // Si no existe el registro, crearlo
              const ahora =
                getFechaLocal() + " " + new Date().toLocaleTimeString();
              await executeNonQuery(
                "INSERT INTO AlmacenProducto (producto_id, almacen_id, cantidad, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
                [productoId, almacenOrigenId, cantidadADevolver, ahora, ahora],
              );
              console.log(
                `🆕 Creado registro en AlmacenProducto para origen (Almacén ${almacenOrigenId})`,
              );
            } else {
              console.log(
                `✅ Actualizado registro en AlmacenProducto para origen (Almacén ${almacenOrigenId})`,
              );
            }
          } else {
            // Devolver al almacén origen (tabla AlmacenProducto)
            const resultadoOrigen = await executeNonQuery(
              "UPDATE AlmacenProducto SET cantidad = cantidad + ? WHERE producto_id = ? AND almacen_id = ?",
              [cantidadADevolver, productoId, almacenOrigenId],
            );

            if (resultadoOrigen.changes === 0) {
              // Si no existe el registro, crearlo
              const ahora =
                getFechaLocal() + " " + new Date().toLocaleTimeString();
              await executeNonQuery(
                "INSERT INTO AlmacenProducto (producto_id, almacen_id, cantidad, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
                [productoId, almacenOrigenId, cantidadADevolver, ahora, ahora],
              );
              console.log(`🆕 Creado registro en AlmacenProducto para origen`);
            } else {
              console.log(
                `✅ Actualizado registro en AlmacenProducto para origen`,
              );
            }
          }

          // Quitar del destino
          if (esTransferenciaAPunto && puntoDestinoId) {
            // Quitar de la zona del punto
            const resultadoDestino = await executeNonQuery(
              "UPDATE AlmacenZona SET cantidad = cantidad - ? WHERE producto_id = ? AND punto_id = ? AND zona_id = ?",
              [cantidadADevolver, productoId, puntoDestinoId, 1],
            );

            if (resultadoDestino.changes === 0) {
              console.log(
                `⚠️ No se encontró registro en AlmacenZona para el destino`,
              );
            }
          } else if (almacenDestinoId) {
            // Quitar del almacén destino
            const resultadoDestino = await executeNonQuery(
              "UPDATE AlmacenProducto SET cantidad = cantidad - ? WHERE producto_id = ? AND almacen_id = ?",
              [cantidadADevolver, productoId, almacenDestinoId],
            );

            if (resultadoDestino.changes === 0) {
              // Si no existe el registro, crearlo con cantidad negativa o 0
              const ahora =
                getFechaLocal() + " " + new Date().toLocaleTimeString();
              await executeNonQuery(
                "INSERT INTO AlmacenProducto (producto_id, almacen_id, cantidad, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
                [
                  productoId,
                  almacenDestinoId,
                  Math.max(0, -cantidadADevolver),
                  ahora,
                  ahora,
                ],
              );
              console.log(`🆕 Creado registro en AlmacenProducto para destino`);
            }
          }
        } else if (diferencia > 0) {
          // Se transfirió de menos (cantidad correcta es mayor), enviar más al destino
          const cantidadAdicional = diferencia;

          console.log(
            `➕ Enviando ${cantidadAdicional} unidades adicionales al destino desde origen (Almacén ${almacenOrigenId})`,
          );

          // Verificar stock en origen
          let stockOrigenActual: number;

          if (esTransferenciaAPunto) {
            // Para transferencias a puntos, verificar stock en AlmacenProducto (consistente con la carga)
            stockOrigenActual =
              (await getSingleValue<number>(
                "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
                [productoId, almacenOrigenId],
              )) || 0;
          } else {
            // Para transferencias entre almacenes, verificar stock en AlmacenProducto
            stockOrigenActual =
              (await getSingleValue<number>(
                "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
                [productoId, almacenOrigenId],
              )) || 0;
          }

          if (!stockOrigenActual || stockOrigenActual < cantidadAdicional) {
            await executeNonQuery("ROLLBACK");
            return {
              success: false,
              message: `Stock insuficiente en almacén origen (Almacén ${almacenOrigenId}). Disponible: ${stockOrigenActual || 0} unidades`,
            };
          }

          // Quitar del almacén origen
          const resultadoOrigen = await executeNonQuery(
            "UPDATE AlmacenProducto SET cantidad = cantidad - ? WHERE producto_id = ? AND almacen_id = ?",
            [cantidadAdicional, productoId, almacenOrigenId],
          );

          // Agregar al destino
          if (esTransferenciaAPunto && puntoDestinoId) {
            // Agregar a la zona del punto
            await executeNonQuery(
              "INSERT OR REPLACE INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad) VALUES (?, ?, ?, COALESCE((SELECT cantidad FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = ?), 0) + ?)",
              [
                productoId,
                puntoDestinoId,
                1,
                productoId,
                puntoDestinoId,
                1,
                cantidadAdicional,
              ],
            );
            console.log(
              `➕ Agregadas ${cantidadAdicional} unidades a zona del punto ${puntoDestinoId}`,
            );
          } else if (almacenDestinoId) {
            // Agregar al almacén destino
            await executeNonQuery(
              "INSERT OR REPLACE INTO AlmacenProducto (producto_id, almacen_id, cantidad) VALUES (?, ?, COALESCE((SELECT cantidad FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?), 0) + ?)",
              [
                productoId,
                almacenDestinoId,
                productoId,
                almacenDestinoId,
                cantidadAdicional,
              ],
            );
            console.log(
              `➕ Agregadas ${cantidadAdicional} unidades a almacén destino ${almacenDestinoId}`,
            );
          }
        }

        // Registrar la corrección en el historial
        const nombreOrigen = "Almacén General";
        const nombreDestino = esTransferenciaAPunto
          ? `Punto ${puntoDestinoId}`
          : `Almacén ${almacenDestinoId}`;

        const notasCorreccion = `CORRECCIÓN: ${motivo}\nTransferencia original ID: ${transferenciaId}\nCantidad original: ${cantidadOriginal}\nCantidad correcta: ${cantidadCorrecta}\nDiferencia: ${diferencia > 0 ? "+" : ""}${diferencia} unidades\n${diferencia < 0 ? `Se devolvieron ${Math.abs(diferencia)} unidades a ${nombreOrigen}` : `Se enviaron ${diferencia} unidades adicionales a ${nombreDestino}`}`;

        await executeNonQuery(
          `INSERT INTO LogTransferencia (producto_id, punto_id, cantidad, precio_venta, precio_coste_real, notas) VALUES (?, 0, ?, ?, ?, ?)`,
          [
            productoId,
            Math.abs(diferencia),
            precioCoste,
            precioCoste,
            notasCorreccion,
          ],
        );

        await executeNonQuery("COMMIT");

        const accion = diferencia < 0 ? "devueltos" : "enviados";
        return {
          success: true,
          message: `Corrección realizada correctamente. Se ${accion === "devueltos" ? "devolvieron" : "enviaron"} ${Math.abs(diferencia)} unidades. Stock actualizado.`,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error en AlmacenService.corregirTransferencia:", error);
      return {
        success: false,
        message: "Error al corregir la transferencia",
      };
    }
  }
}
