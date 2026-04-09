// src/db/oferta_helper_simple.ts
import {
    executeNonQuery,
    executeQuery,
    getFirst,
    SQLiteRunResult,
} from "./database";

// Helper simple para Ofertas
const executeWithRetry = async (
  operation: () => Promise<any>,
  maxRetries: number = 3,
  delay: number = 100,
): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (
        error.message &&
        error.message.includes("database is locked") &&
        attempt < maxRetries
      ) {
        console.log(
          `🔄 Intento ${attempt}/${maxRetries}: Base de datos bloqueada, reintentando en ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error("Máximo de reintentos alcanzado");
};

export const OfertaHelper = {
  // Inicializar tablas básicas
  createTable: async (): Promise<void> => {
    try {
      // Crear tabla básica de ofertas
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

  // Desactivar oferta
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
                valor_descuento_todos: oferta.aplica_a_todos ? 5 : 0, // Valor por defecto si aplica a todos
                metodo_pago: oferta.metodo_pago,
                aplica_a_todos: Boolean(oferta.aplica_a_todos),
                fecha_inicio: oferta.fecha_inicio,
                fecha_fin: oferta.fecha_fin,
                activa: Boolean(oferta.activa),
                creado_en: oferta.creado_en,
                productos: productos, // Lista de productos específicos con sus descuentos
              };
            }),
          );

          return ofertasCompletas;
        }
      } catch (error) {
        console.log("📋 Tabla OfertaMejorada no existe o está vacía");
      }

      // Si no hay en tabla nueva, buscar en tabla básica
      const todasLasOfertas = await executeQuery<any>(
        `SELECT * FROM Oferta ORDER BY creado_en DESC LIMIT ?`,
        [limit],
      );

      console.log(
        "📊 Todas las ofertas en tabla básica:",
        todasLasOfertas.length,
      );

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

  // Crear oferta completa (temporal - solo básico)
  crearOfertaCompleta: async (oferta: any): Promise<number> => {
    try {
      console.log("🔧 Creando oferta en tabla OfertaMejorada:", oferta);

      // Crear la oferta principal primero
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
      console.log("✅ OfertaMejorada creada con ID:", ofertaId);

      // Si no aplica a todos, crear los productos específicos por separado
      if (
        !oferta.aplica_a_todos &&
        oferta.productos &&
        oferta.productos.length > 0
      ) {
        console.log(
          "🔧 Creando",
          oferta.productos.length,
          "productos específicos",
        );

        for (const producto of oferta.productos) {
          await executeNonQuery(
            `INSERT INTO OfertaProducto (oferta_id, producto_id, tipo_descuento, valor_descuento)
             VALUES (?, ?, ?, ?)`,
            [
              ofertaId,
              producto.producto_id,
              producto.tipo_descuento,
              producto.valor_descuento,
            ],
          );
        }
        console.log("✅ Productos específicos creados");
      }

      console.log("✅ Oferta completada exitosamente");
      return ofertaId;
    } catch (error) {
      console.error("Error creando oferta completa:", error);
      throw error;
    }
  },
};
