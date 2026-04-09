// src/db/services/oferta_service.ts
// SERVICIO LIMPIO Y CORREGIDO DE GESTIÓN DE OFERTAS
import { executeNonQuery, executeQuery, getFirst } from "../database";

// ==================== INTERFACES ====================

export interface SQLiteRunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Oferta {
  id: number;
  punto_id: number;
  nombre: string;
  descripcion?: string;
  dias_ilimitados: boolean;
  dias_validez?: number;
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean;
  aplica_a_todos: boolean;
  metodo_pago: "transferencia" | "efectivo" | "todos";
  tipo_descuento_todos?: "porcentaje" | "valor";
  valor_descuento_todos?: number;
  dia_inicio?: string; // Día de inicio: 'lunes', 'martes', etc.
  dia_fin?: string; // Día de fin: 'lunes', 'martes', etc.
  repetir: boolean; // true = repetir semanalmente
  creado_en: string;
  actualizado_en?: string;
}

export interface OfertaProducto {
  id: number;
  oferta_id: number;
  producto_id: number;
  tipo_descuento: "porcentaje" | "valor";
  valor_descuento: number;
  producto_nombre?: string;
  creado_en: string;
}

export interface OfertaCompleta extends Oferta {
  productos: OfertaProducto[];
}

export interface ProductoConStock {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  cantidad_en_punto: number;
  precio_venta?: number;
  fecha_caducidad?: string;
}

export interface CrearOfertaData {
  punto_id: number;
  nombre: string;
  descripcion?: string;
  dias_ilimitados: boolean;
  usar_dias_validez?: boolean;
  dias_validez?: number;
  metodo_pago: "transferencia" | "efectivo" | "todos";
  aplica_a_todos: boolean;
  productos?: Omit<
    OfertaProducto,
    "id" | "oferta_id" | "producto_nombre" | "creado_en"
  >[];
  tipo_descuento_todos?: "porcentaje" | "valor";
  valor_descuento_todos?: number;
  usar_rango_dias?: boolean;
  dia_inicio?: string; // Día de inicio: 'lunes', 'martes', etc.
  dia_fin?: string; // Día de fin: 'lunes', 'martes', etc.
  repetir?: boolean; // true = repetir semanalmente
  usar_calendario?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface ActualizarOfertaData {
  ofertaId?: number;
  nombre?: string;
  descripcion?: string;
  dias_ilimitados?: boolean;
  usar_dias_validez?: boolean;
  dias_validez?: number;
  metodo_pago?: "transferencia" | "efectivo" | "todos";
  aplica_a_todos?: boolean;
  tipo_descuento_todos?: "porcentaje" | "valor";
  valor_descuento_todos?: number;
  usar_rango_dias?: boolean;
  dia_inicio?: string; // Día de inicio: 'lunes', 'martes', etc.
  dia_fin?: string; // Día de fin: 'lunes', 'martes', etc.
  repetir?: boolean; // true = repetir semanalmente
  usar_calendario?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
}

// ==================== UTILIDADES ====================

// Días de la semana para validación
const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

// Función para verificar si una oferta puede estar activa hoy
const puedeEstarActivaHoy = (oferta: any): boolean => {
  const hoy = new Date();
  const diaActual = DIAS_SEMANA[hoy.getDay()];
  const fechaHoy = hoy.toISOString().split("T")[0];

  console.log(
    `🔍 Validando oferta "${oferta.nombre}" para hoy (${diaActual}):`,
    {
      dias_ilimitados: oferta.dias_ilimitados,
      usar_calendario: oferta.usar_calendario,
      dias_limitados: oferta.dias_limitados,
      usar_rango_dias: oferta.usar_rango_dias,
      dia_inicio: oferta.dia_inicio,
      dia_fin: oferta.dia_fin,
      repetir: oferta.repetir,
      fecha_inicio: oferta.fecha_inicio,
      fecha_fin: oferta.fecha_fin,
      dias_validez: oferta.dias_validez,
    },
  );

  // 1. Días ilimitados: siempre puede estar activa PERO debe verificar programación si existe
  let validezActiva = false;

  if (oferta.dias_ilimitados) {
    validezActiva = true;
    console.log(`✅ Validez: Días ilimitados - activa`);
  }
  // 2. Usar calendario: verificar rango de fechas
  else if (oferta.usar_calendario && oferta.fecha_inicio && oferta.fecha_fin) {
    validezActiva =
      fechaHoy >= oferta.fecha_inicio && fechaHoy <= oferta.fecha_fin;
    console.log(
      `📅 Validez: Calendario - ${fechaHoy} entre ${oferta.fecha_inicio} y ${oferta.fecha_fin} = ${validezActiva}`,
    );
  }
  // 3. Días limitados: calcular desde fecha de creación
  else if (
    !oferta.dias_ilimitados &&
    !oferta.usar_calendario &&
    oferta.dias_validez
  ) {
    const fechaCreacion = oferta.creado_en
      ? new Date(oferta.creado_en).toISOString().split("T")[0]
      : fechaHoy;
    const diasDesdeCreacion = Math.floor(
      (new Date(fechaHoy).getTime() - new Date(fechaCreacion).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    validezActiva = diasDesdeCreacion < oferta.dias_validez;
    console.log(
      `⏰ Validez: Días limitados - ${diasDesdeCreacion} < ${oferta.dias_validez} = ${validezActiva}`,
    );
  } else {
    console.log(`❌ Validez: No hay opción de validez válida`);
    return false;
  }

  // 4. Verificar programación de días si está activa
  if (
    validezActiva &&
    oferta.usar_rango_dias &&
    oferta.dia_inicio &&
    oferta.dia_fin
  ) {
    const diaInicio = oferta.dia_inicio.toLowerCase();
    const diaFin = oferta.dia_fin.toLowerCase();

    console.log(
      `📅 Programación: Verificando ${diaActual} entre ${diaInicio} y ${diaFin}`,
    );

    if (diaInicio === diaFin) {
      const programacionActiva = diaActual === diaInicio;
      console.log(
        `📅 Programación (mismo día): ${diaActual} === ${diaInicio} = ${programacionActiva}`,
      );
      return programacionActiva;
    } else {
      const indiceInicio = DIAS_SEMANA.indexOf(diaInicio);
      const indiceFin = DIAS_SEMANA.indexOf(diaFin);
      const indiceActual = DIAS_SEMANA.indexOf(diaActual);

      let programacionActiva = false;
      if (indiceInicio <= indiceFin) {
        programacionActiva =
          indiceActual >= indiceInicio && indiceActual <= indiceFin;
      } else {
        programacionActiva =
          indiceActual >= indiceInicio || indiceActual <= indiceFin;
      }

      console.log(
        `📅 Programación (rango): ${diaActual} (${indiceActual}) entre ${diaInicio} (${indiceInicio}) y ${diaFin} (${indiceFin}) = ${programacionActiva}`,
      );
      return programacionActiva;
    }
  }

  // Si no hay programación de días, devolver el estado de validez
  console.log(`📅 Sin programación de días - usando validez: ${validezActiva}`);
  return validezActiva;
};

const executeWithRetry = async (
  operation: () => Promise<any>,
  maxRetries: number = 3,
  initialDelay: number = 200,
): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (
        error.message?.includes("database is locked") &&
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

// Función independiente para migrar la tabla Oferta
export const migrarTablaOferta = async (): Promise<void> => {
  try {
    console.log("🔄 Verificando migración de tabla Oferta...");

    // Verificar si existe la columna usar_dias_validez
    const tableInfo = await executeQuery(`
        PRAGMA table_info(Oferta)
      `);

    const tieneUsarDiasValidez = tableInfo.some(
      (column: any) => column.name === "usar_dias_validez",
    );

    const tieneUsarRangoDias = tableInfo.some(
      (column: any) => column.name === "usar_rango_dias",
    );

    const tieneUsarCalendario = tableInfo.some(
      (column: any) => column.name === "usar_calendario",
    );

    // Si faltan columnas, agregarlas
    if (!tieneUsarDiasValidez || !tieneUsarRangoDias || !tieneUsarCalendario) {
      console.log("🔄 Migrando tabla Oferta - Agregando columnas faltantes...");

      if (!tieneUsarDiasValidez) {
        await executeNonQuery(`
            ALTER TABLE Oferta ADD COLUMN usar_dias_validez INTEGER DEFAULT 0
          `);
        console.log("✅ Columna usar_dias_validez agregada");
      }

      if (!tieneUsarRangoDias) {
        await executeNonQuery(`
            ALTER TABLE Oferta ADD COLUMN usar_rango_dias INTEGER DEFAULT 0
          `);
        console.log("✅ Columna usar_rango_dias agregada");
      }

      if (!tieneUsarCalendario) {
        await executeNonQuery(`
            ALTER TABLE Oferta ADD COLUMN usar_calendario INTEGER DEFAULT 0
          `);
        console.log("✅ Columna usar_calendario agregada");
      }

      console.log("✅ Migración de tabla Oferta completada");
    } else {
      console.log("✅ Tabla Oferta ya está actualizada");
    }
  } catch (error) {
    console.error("❌ Error migrando tabla Oferta:", error);
    throw error;
  }
};

// ==================== SERVICIO PRINCIPAL ====================

export const OfertaService = {
  // Inicializar tablas de ofertas
  initializeTables: async (): Promise<void> => {
    try {
      console.log("🔄 Inicializando tablas de ofertas...");

      // Primero verificar si necesitamos migrar la tabla Oferta
      await migrarTablaOferta();

      // La tabla Oferta ya se crea en database.ts con la estructura correcta
      // Solo necesitamos asegurarnos de que OfertaProducto exista
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS OfertaProducto (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          oferta_id INTEGER NOT NULL,
          producto_id INTEGER NOT NULL,
          tipo_descuento TEXT NOT NULL CHECK(tipo_descuento IN ('porcentaje', 'valor')),
          valor_descuento REAL NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (oferta_id) REFERENCES Oferta(id) ON DELETE CASCADE,
          FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
          UNIQUE(oferta_id, producto_id)
        );
      `);

      // Crear índices para mejor performance
      await executeNonQuery(`
        CREATE INDEX IF NOT EXISTS idx_oferta_punto_id ON Oferta(punto_id);
        CREATE INDEX IF NOT EXISTS idx_oferta_activa ON Oferta(activa);
        CREATE INDEX IF NOT EXISTS idx_oferta_fecha ON Oferta(fecha_inicio, fecha_fin);
        CREATE INDEX IF NOT EXISTS idx_oferta_producto_oferta_id ON OfertaProducto(oferta_id);
        CREATE INDEX IF NOT EXISTS idx_oferta_producto_producto_id ON OfertaProducto(producto_id);
      `);

      console.log("✅ Tablas de ofertas inicializadas correctamente");
    } catch (error) {
      console.error("❌ Error inicializando tablas de ofertas:", error);
      throw error;
    }
  },

  // Migrar tabla Oferta si faltan columnas
  migrarTablaOferta: async (): Promise<void> => {
    try {
      console.log("🔄 Verificando migración de tabla Oferta...");

      // Verificar si existe la columna usar_dias_validez
      const tableInfo = await executeQuery(`
        PRAGMA table_info(Oferta)
      `);

      const tieneUsarDiasValidez = tableInfo.some(
        (column: any) => column.name === "usar_dias_validez",
      );

      const tieneUsarRangoDias = tableInfo.some(
        (column: any) => column.name === "usar_rango_dias",
      );

      const tieneUsarCalendario = tableInfo.some(
        (column: any) => column.name === "usar_calendario",
      );

      // Si faltan columnas, agregarlas
      if (
        !tieneUsarDiasValidez ||
        !tieneUsarRangoDias ||
        !tieneUsarCalendario
      ) {
        console.log(
          "🔄 Migrando tabla Oferta - Agregando columnas faltantes...",
        );

        if (!tieneUsarDiasValidez) {
          await executeNonQuery(`
            ALTER TABLE Oferta ADD COLUMN usar_dias_validez INTEGER DEFAULT 0
          `);
          console.log("✅ Columna usar_dias_validez agregada");
        }

        if (!tieneUsarRangoDias) {
          await executeNonQuery(`
            ALTER TABLE Oferta ADD COLUMN usar_rango_dias INTEGER DEFAULT 0
          `);
          console.log("✅ Columna usar_rango_dias agregada");
        }

        if (!tieneUsarCalendario) {
          await executeNonQuery(`
            ALTER TABLE Oferta ADD COLUMN usar_calendario INTEGER DEFAULT 0
          `);
          console.log("✅ Columna usar_calendario agregada");
        }

        console.log("✅ Migración de tabla Oferta completada");
      } else {
        console.log("✅ Tabla Oferta ya está actualizada");
      }
    } catch (error) {
      console.error("❌ Error migrando tabla Oferta:", error);
      throw error;
    }
  },

  // Crear oferta completa - CORREGIDO
  crearOferta: async (data: CrearOfertaData): Promise<number> => {
    return executeWithRetry(async () => {
      console.log("🔧 Creando oferta:", data);

      // Asegurar que las tablas existan
      await OfertaService.initializeTables();

      // Si la nueva oferta debe estar activa, desactivar otras ofertas del mismo punto
      if (data.dias_ilimitados || (data.dia_inicio && data.dia_fin)) {
        console.log(
          "🔄 Desactivando otras ofertas activas del punto:",
          data.punto_id,
        );
        // Usar fecha local en lugar de UTC
        const { getFechaHoraLocalCompleta } =
          await import("../../utils/dateUtils");
        const ahora = getFechaHoraLocalCompleta();

        await executeNonQuery(
          "UPDATE Oferta SET activa = 0, actualizado_en = ? WHERE punto_id = ? AND activa = 1",
          [ahora, data.punto_id],
        );
      }

      // Crear la oferta principal con TODOS los campos requeridos
      const result = await executeNonQuery(
        `INSERT INTO Oferta (
          punto_id, nombre, descripcion, dias_ilimitados, dias_validez,
          fecha_inicio, fecha_fin, activa, aplica_a_todos, metodo_pago,
          usar_rango_dias, dia_inicio, dia_fin, repetir, usar_calendario,
          tipo_descuento_todos, valor_descuento_todos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.punto_id,
          data.nombre,
          data.descripcion || null,
          data.dias_ilimitados ? 1 : 0,
          data.dias_ilimitados ? null : data.dias_validez,
          data.fecha_inicio || (data.dias_ilimitados ? "1970-01-01" : null),
          data.fecha_fin || (data.dias_ilimitados ? "2099-12-31" : null),
          1, // activa = true por defecto
          data.aplica_a_todos ? 1 : 0,
          data.metodo_pago || "todos",
          data.usar_rango_dias ? 1 : 0,
          data.dia_inicio || null,
          data.dia_fin || null,
          data.repetir ? 1 : 0,
          data.usar_calendario ? 1 : 0,
          data.tipo_descuento_todos || null,
          data.valor_descuento_todos || null,
        ],
      );

      const ofertaId = result.lastInsertRowId;
      console.log("✅ Oferta creada con ID:", ofertaId);

      // Si no aplica a todos y hay productos, crearlos
      if (!data.aplica_a_todos && data.productos && data.productos.length > 0) {
        console.log("🔧 Creando productos específicos:", data.productos.length);

        for (const producto of data.productos) {
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
    });
  },

  // Actualizar oferta existente
  actualizarOferta: async (
    ofertaId: number,
    data: ActualizarOfertaData,
  ): Promise<void> => {
    return executeWithRetry(async () => {
      console.log("🔧 Actualizando oferta:", ofertaId, data);

      // Construir consulta dinámica
      const campos: string[] = [];
      const valores: any[] = [];

      if (data.nombre !== undefined) {
        campos.push("nombre = ?");
        valores.push(data.nombre);
      }
      if (data.descripcion !== undefined) {
        campos.push("descripcion = ?");
        valores.push(data.descripcion);
      }
      if (data.dias_ilimitados !== undefined) {
        campos.push("dias_ilimitados = ?");
        valores.push(data.dias_ilimitados ? 1 : 0);
      }
      if (data.dias_validez !== undefined) {
        campos.push("dias_validez = ?");
        valores.push(data.dias_validez);
      }
      if (data.metodo_pago !== undefined) {
        campos.push("metodo_pago = ?");
        valores.push(data.metodo_pago);
      }
      if (data.aplica_a_todos !== undefined) {
        campos.push("aplica_a_todos = ?");
        valores.push(data.aplica_a_todos ? 1 : 0);
      }
      if (data.tipo_descuento_todos !== undefined) {
        campos.push("tipo_descuento_todos = ?");
        valores.push(data.tipo_descuento_todos);
      }
      if (data.valor_descuento_todos !== undefined) {
        campos.push("valor_descuento_todos = ?");
        valores.push(data.valor_descuento_todos);
      }

      if (campos.length === 0) {
        throw new Error("No hay campos para actualizar");
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      campos.push("actualizado_en = ?");
      valores.push(ahora);
      valores.push(ofertaId);

      await executeNonQuery(
        `UPDATE Oferta SET ${campos.join(", ")} WHERE id = ?`,
        valores,
      );

      console.log("✅ Oferta actualizada correctamente");
    });
  },

  // Activar/Desactivar oferta con validación automática
  toggleActiva: async (ofertaId: number, activa: boolean): Promise<void> => {
    return executeWithRetry(async () => {
      console.log(
        `🔄 ${activa ? "Activando" : "Desactivando"} oferta:`,
        ofertaId,
      );

      if (activa) {
        // Obtener la oferta completa con todos sus datos
        const oferta = await getFirst<any>(
          "SELECT * FROM Oferta WHERE id = ?",
          [ofertaId],
        );

        if (!oferta) {
          throw new Error("Oferta no encontrada");
        }

        // Verificar si la oferta puede estar activa hoy
        const puedeActivarse = puedeEstarActivaHoy(oferta);

        if (!puedeActivarse) {
          let mensajeError = "Esta oferta no puede activarse porque:";

          if (oferta.usar_calendario) {
            mensajeError += " está fuera del rango de fechas configurado";
          } else if (!oferta.dias_ilimitados && oferta.dias_validez) {
            mensajeError += " ya expiró su tiempo de validez";
          } else if (oferta.usar_rango_dias) {
            mensajeError += " hoy no está dentro del rango de días configurado";
          } else {
            mensajeError += " no cumple las condiciones para estar activa";
          }

          throw new Error(mensajeError);
        }

        console.log(
          "✅ Oferta puede activarse - Desactivando otras ofertas del punto:",
          oferta.punto_id,
        );

        // Desactivar otras ofertas activas del mismo punto
        await executeNonQuery(
          "UPDATE Oferta SET activa = 0, actualizado_en = CURRENT_TIMESTAMP WHERE punto_id = ? AND activa = 1 AND id != ?",
          [oferta.punto_id, ofertaId],
        );
      }

      // Activar o desactivar la oferta
      await executeNonQuery(
        "UPDATE Oferta SET activa = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        [activa ? 1 : 0, ofertaId],
      );

      console.log(
        `✅ Oferta ${activa ? "activada" : "desactivada"} correctamente`,
      );
    });
  },

  // Eliminar oferta (eliminación física)
  eliminarOferta: async (ofertaId: number): Promise<void> => {
    try {
      console.log("🗑️ Eliminando oferta físicamente:", ofertaId);

      // Primero eliminar productos específicos asociados (si existen)
      await executeNonQuery("DELETE FROM OfertaProducto WHERE oferta_id = ?", [
        ofertaId,
      ]);
      console.log("✅ Productos de oferta eliminados");

      // Luego eliminar la oferta principal
      await executeNonQuery("DELETE FROM Oferta WHERE id = ?", [ofertaId]);

      console.log("✅ Oferta eliminada físicamente correctamente");
    } catch (err) {
      console.error("Error en OfertaService.eliminarOferta:", err);
      throw err;
    }
  },

  // Obtener todas las ofertas de un punto con sus productos
  getOfertasByPunto: async (
    puntoId: number,
    limit = 50,
  ): Promise<OfertaCompleta[]> => {
    try {
      console.log("🔍 Buscando ofertas para puntoId:", puntoId);

      const ofertas = await executeQuery<any>(
        `
        SELECT * FROM Oferta 
        WHERE punto_id = ? 
        ORDER BY creado_en DESC 
        LIMIT ?
      `,
        [puntoId, limit],
      );

      console.log("📋 Ofertas encontradas:", ofertas.length);

      // Para cada oferta, obtener sus productos específicos
      const ofertasCompletas = await Promise.all(
        ofertas.map(async (oferta) => {
          let productos: OfertaProducto[] = [];

          // Verificar si la oferta puede estar activa hoy y actualizar su estado
          const puedeEstarActiva = puedeEstarActivaHoy(oferta);

          if (!puedeEstarActiva && oferta.activa) {
            console.log(
              `⏰ Oferta ${oferta.id} ya no puede estar activa, desactivando automáticamente...`,
            );
            await executeNonQuery(`UPDATE Oferta SET activa = 0 WHERE id = ?`, [
              oferta.id,
            ]);
            oferta.activa = 0; // Actualizar en memoria
          } else if (puedeEstarActiva && !oferta.activa) {
            // Si puede estar activa pero no lo está, verificar si debe activarse automáticamente
            // (solo si no hay otras ofertas activas del mismo punto)
            const otrasActivas = await executeQuery(
              "SELECT id FROM Oferta WHERE punto_id = ? AND activa = 1 AND id != ?",
              [oferta.punto_id, oferta.id],
            );

            if (otrasActivas.length === 0) {
              console.log(
                `🔄 Oferta ${oferta.id} puede activarse y no hay otras activas, activando automáticamente...`,
              );
              await executeNonQuery(
                `UPDATE Oferta SET activa = 1 WHERE id = ?`,
                [oferta.id],
              );
              oferta.activa = 1; // Actualizar en memoria
            }
          }

          if (!oferta.aplica_a_todos) {
            console.log(`🔍 Cargando productos para oferta ${oferta.id}`);
            productos = await executeQuery<OfertaProducto>(
              `
              SELECT op.*, p.nombre as producto_nombre
               FROM OfertaProducto op
               INNER JOIN Producto p ON op.producto_id = p.id
               WHERE op.oferta_id = ?
               ORDER BY p.nombre
            `,
              [oferta.id],
            );
          }

          return {
            ...oferta,
            activa: Boolean(oferta.activa),
            aplica_a_todos: Boolean(oferta.aplica_a_todos),
            dias_ilimitados: Boolean(oferta.dias_ilimitados),
            productos,
          };
        }),
      );

      return ofertasCompletas;
    } catch (error) {
      console.error("Error en OfertaService.getOfertasByPunto:", error);
      return [];
    }
  },

  // Obtener productos disponibles para ofertas
  getProductosDisponibles: async (
    puntoId: number,
  ): Promise<ProductoConStock[]> => {
    try {
      console.log("🔍 Buscando productos disponibles para puntoId:", puntoId);

      const productos = await executeQuery<ProductoConStock>(
        `
        SELECT p.*, az.cantidad as cantidad_en_punto, az.precio_venta
        FROM Producto p
        INNER JOIN AlmacenZona az ON p.id = az.producto_id
        WHERE az.punto_id = ? AND az.zona_id = 1 AND az.cantidad > 0
        ORDER BY p.nombre
      `,
        [puntoId],
      );

      console.log("📦 Productos disponibles:", productos.length);
      return productos;
    } catch (error) {
      console.error("Error en OfertaService.getProductosDisponibles:", error);
      return [];
    }
  },

  // Obtener oferta por ID
  getOfertaById: async (ofertaId: number): Promise<OfertaCompleta | null> => {
    try {
      console.log("🔍 Buscando oferta por ID:", ofertaId);

      const oferta = await getFirst<any>(
        `
        SELECT * FROM Oferta WHERE id = ?
      `,
        [ofertaId],
      );

      if (!oferta) {
        console.log("❌ Oferta no encontrada");
        return null;
      }

      // Obtener productos específicos si aplica
      let productos: OfertaProducto[] = [];
      if (!oferta.aplica_a_todos) {
        productos = await executeQuery<OfertaProducto>(
          `
          SELECT op.*, p.nombre as producto_nombre
          FROM OfertaProducto op
          INNER JOIN Producto p ON op.producto_id = p.id
          WHERE op.oferta_id = ?
          ORDER BY p.nombre
        `,
          [ofertaId],
        );
      }

      return {
        ...oferta,
        activa: Boolean(oferta.activa),
        aplica_a_todos: Boolean(oferta.aplica_a_todos),
        dias_ilimitados: Boolean(oferta.dias_ilimitados),
        productos,
      };
    } catch (error) {
      console.error("Error en OfertaService.getOfertaById:", error);
      return null;
    }
  },

  // Actualizar productos de una oferta
  actualizarProductosOferta: async (
    ofertaId: number,
    productos: Omit<
      OfertaProducto,
      "id" | "oferta_id" | "producto_nombre" | "creado_en"
    >[],
  ): Promise<void> => {
    return executeWithRetry(async () => {
      console.log("🔧 Actualizando productos de oferta:", ofertaId);

      // Eliminar productos existentes
      await executeNonQuery("DELETE FROM OfertaProducto WHERE oferta_id = ?", [
        ofertaId,
      ]);

      // Insertar nuevos productos
      for (const producto of productos) {
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

      console.log("✅ Productos de oferta actualizados correctamente");
    });
  },

  // Obtener ofertas activas de un punto (con validación automática)
  getOfertasActivas: async (puntoId: number): Promise<OfertaCompleta[]> => {
    try {
      console.log("🔍 Buscando ofertas activas para puntoId:", puntoId);

      const ofertas = await executeQuery<any>(
        `
        SELECT * FROM Oferta 
        WHERE punto_id = ? AND activa = 1 
        ORDER BY creado_en DESC
      `,
        [puntoId],
      );

      const ofertasCompletas = await Promise.all(
        ofertas.map(async (oferta) => {
          let productos: OfertaProducto[] = [];

          // Verificar si la oferta puede estar activa hoy
          const puedeEstarActiva = puedeEstarActivaHoy(oferta);

          // Si no puede estar activa, excluirla de las ofertas activas
          if (!puedeEstarActiva) {
            // Desactivarla automáticamente
            console.log(
              `⏰ Oferta ${oferta.id} ya no puede estar activa, desactivando automáticamente...`,
            );
            await executeNonQuery(`UPDATE Oferta SET activa = 0 WHERE id = ?`, [
              oferta.id,
            ]);
            return null; // No incluirla en las ofertas activas
          }

          if (!oferta.aplica_a_todos) {
            productos = await executeQuery<OfertaProducto>(
              `SELECT op.*, p.nombre as producto_nombre
               FROM OfertaProducto op
               INNER JOIN Producto p ON op.producto_id = p.id
               WHERE op.oferta_id = ?
               ORDER BY p.nombre`,
              [oferta.id],
            );
          }

          return {
            ...oferta,
            activa: Boolean(oferta.activa),
            aplica_a_todos: Boolean(oferta.aplica_a_todos),
            dias_ilimitados: Boolean(oferta.dias_ilimitados),
            productos,
          };
        }),
      );

      // Filtrar ofertas nulas (las que no están activas por día/fecha)
      const ofertasFiltradas = ofertasCompletas.filter(
        (oferta) => oferta !== null,
      );
      console.log(
        `📋 Ofertas activas válidas: ${ofertasFiltradas.length}/${ofertas.length}`,
      );

      return ofertasFiltradas;
    } catch (error) {
      console.error("Error en OfertaService.getOfertasActivas:", error);
      return [];
    }
  },
};
