// src/db/oferta_helper_fixed.ts
import {
    executeNonQuery,
    executeQuery,
    SQLiteRunResult
} from "./database";

const executeWithRetry = async (
  operation: () => Promise<any>,
  maxRetries = 3,
  delay = 100,
): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (
        error.message?.includes("database is locked") &&
        attempt < maxRetries
      ) {
        console.log(
          `🔄 Intento ${attempt}/${maxRetries}: Base de datos bloqueada, reintentando...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Máximo de reintentos alcanzado");
};

export const OfertaHelper = {
  createTable: async (): Promise<void> => {
    try {
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
      console.log("✅ Tablas de ofertas básicas inicializadas");
    } catch (error) {
      console.error("❌ Error inicializando tablas de ofertas:", error);
    }
  },

  getOfertasByPunto: async (puntoId: number, limit = 50): Promise<any[]> => {
    try {
      console.log("🔍 Buscando ofertas para puntoId:", puntoId);

      const ofertasMejoradas = await executeQuery<any>(
        `SELECT * FROM OfertaMejorada WHERE punto_id = ? ORDER BY creado_en DESC LIMIT ?`,
        [puntoId, limit],
      );

      if (ofertasMejoradas.length > 0) {
        console.log(
          "🎯 Encontradas",
          ofertasMejoradas.length,
          "ofertas en tabla OfertaMejorada",
        );

        const ofertasCompletas = await Promise.all(
          ofertasMejoradas.map(async (oferta) => {
            let productos = [];
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

      // Buscar en tabla básica
      const ofertasFiltradas = await executeQuery<any>(
        `SELECT * FROM Oferta WHERE punto_id = ? ORDER BY creado_en DESC LIMIT ?`,
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

  getProductosPunto: async (puntoId: number): Promise<any[]> => {
    try {
      return await executeQuery(
        `SELECT p.*, az.cantidad as cantidad_en_punto, az.precio_venta
         FROM Producto p
         INNER JOIN AlmacenZona az ON p.id = az.producto_id
         WHERE az.punto_id = ? AND az.zona_id = 1 AND az.cantidad > 0
         ORDER BY p.nombre`,
        [puntoId],
      );
    } catch (error) {
      console.error("Error en OfertaHelper.getProductosPunto:", error);
      return [];
    }
  },

  crearOfertaCompleta: async (oferta: any): Promise<number> => {
    return executeWithRetry(async () => {
      console.log("🔧 Creando oferta básica con datos:", oferta);

      const result = await executeNonQuery(
        `INSERT INTO Oferta (punto_id, tipo, valor, metodo_pago, descripcion, fecha_inicio, fecha_fin, activa)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          oferta.punto_id,
          oferta.tipo_descuento_todos || "porcentaje",
          parseFloat(oferta.valor_descuento_todos) || 5,
          oferta.metodo_pago || "todos",
          oferta.nombre || oferta.descripcion || "Oferta sin descripción",
          oferta.fecha_inicio || getFechaLocal(),
          getFechaLocal(),
        ],
      );

      console.log("✅ Oferta básica creada con ID:", result.lastInsertRowId);
      return result.lastInsertRowId;
    });
  },

  desactivarOferta: async (ofertaId: number): Promise<SQLiteRunResult> => {
    try {
      return await executeNonQuery(
        "UPDATE Oferta SET activa = 0 WHERE id = ?",
        [ofertaId],
      );
    } catch (error) {
      console.error("Error en OfertaHelper.desactivarOferta:", error);
      throw error;
    }
  },
};
