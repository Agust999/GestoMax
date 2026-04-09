// src/database/database.ts
import * as SQLite from "expo-sqlite";
import { getFechaLocal } from "../utils/dateUtils";
import { migrateAddConsumoPropioToVenta } from "./migrations/add_consumo_propio_to_venta";
import { migrateAddCreacionToHistorialInventario } from "./migrations/add_creacion_to_historial_inventario";

// Tipos para los resultados
export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  fecha_caducidad: string | null;
  formato_almacen: string | null; // 'cajas', 'blisters', 'paquete'
  unidades_por_formato: number | null; // unidades por cada formato
  descripcion: string | null; // descripción del producto
  // cantidad_inicial: number | null; // Eliminado - ahora está en AlmacenProducto por cada almacén
  creado_en: string;
  actualizado_en: string;
}

export interface Configuracion {
  id: number;
  clave: string;
  valor: string;
  descripcion: string | null;
  actualizado_en: string;
}

export interface SQLiteRunResult {
  lastInsertRowId: number;
  changes: number;
}

// Función para abrir/crear la base de datos
export const openDatabase = () => {
  return SQLite.openDatabaseSync("gestion_almacen.db");
};

// Obtener instancia de la base de datos
const db = openDatabase();

// **FUNCIÓN CRÍTICA: Verificar si una tabla existe**
export const verificarTablaExiste = async (
  nombreTabla: string,
): Promise<boolean> => {
  try {
    const resultado = await getSingleValue<number>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='${nombreTabla}'`,
    );
    return (resultado || 0) > 0;
  } catch (error) {
    console.error(`Error verificando tabla ${nombreTabla}:`, error);
    return false;
  }
};

// **FUNCIÓN CRÍTICA: Verificar si una columna existe**
const verificarColumnaExiste = async (
  tabla: string,
  columna: string,
): Promise<boolean> => {
  try {
    const columnas = await executeQuery<any>(`PRAGMA table_info(${tabla})`);
    return columnas.some((col: any) => col.name === columna);
  } catch (error) {
    console.error(`Error verificando columna ${columna}:`, error);
    return false;
  }
};

// **VERIFICAR Y AGREGAR COLUMNAS DE RANGO Y REPETICIÓN A TABLA OFERTA**
const verificarYAgregarColumnasOferta = async (): Promise<void> => {
  try {
    console.log(
      "🔍 Verificando columnas de rango y repetición en tabla Oferta...",
    );

    // Columnas que deben existir para el sistema de rangos y repetición
    const columnasNecesarias = [
      { nombre: "dia_inicio", defecto: "NULL", tipo: "TEXT" }, // Día de inicio de semana: 'lunes', 'martes', etc.
      { nombre: "dia_fin", defecto: "NULL", tipo: "TEXT" }, // Día de fin de semana
      { nombre: "repetir", defecto: "0", tipo: "INTEGER" }, // 0 = no repetir, 1 = repetir semanalmente
    ];

    // Verificar columnas existentes
    const columnasExistentes = await executeQuery<any>(
      `PRAGMA table_info(Oferta)`,
    );
    const nombresColumnas = columnasExistentes.map((col: any) => col.name);

    // Agregar columnas faltantes
    for (const columna of columnasNecesarias) {
      if (!nombresColumnas.includes(columna.nombre)) {
        try {
          const sql = `ALTER TABLE Oferta ADD COLUMN ${columna.nombre} ${columna.tipo} DEFAULT ${columna.defecto}`;
          await db.runAsync(sql);
          console.log(`✅ Columna ${columna.nombre} agregada a Oferta`);
        } catch (alterError) {
          console.warn(
            `⚠️ No se pudo agregar columna ${columna.nombre}:`,
            alterError,
          );
        }
      } else {
        console.log(`ℹ️ Columna ${columna.nombre} ya existe en Oferta`);
      }
    }
  } catch (error) {
    console.error("❌ Error verificando columnas de Oferta:", error);
  }
};

// **VERIFICAR Y AGREGAR COLUMNAS DE FORMATO A TABLA PRODUCTO**
const verificarYAgregarColumnasProducto = async (): Promise<void> => {
  try {
    console.log("🔍 Verificando columnas de formato en tabla Producto...");

    // Columnas que deben existir para el sistema de formatos
    const columnasNecesarias = [
      { nombre: "formato_almacen", defecto: "NULL", tipo: "TEXT" },
      { nombre: "unidades_por_formato", defecto: "NULL", tipo: "INTEGER" },
      { nombre: "descripcion", defecto: "NULL", tipo: "TEXT" },
      // { nombre: "cantidad_inicial", defecto: "NULL", tipo: "INTEGER" }, // Eliminado - ahora está en AlmacenProducto
    ];

    // Verificar columnas existentes
    const columnasExistentes = await executeQuery<any>(
      `PRAGMA table_info(Producto)`,
    );
    const nombresColumnas = columnasExistentes.map((col: any) => col.name);

    // Agregar columnas faltantes
    for (const columna of columnasNecesarias) {
      if (!nombresColumnas.includes(columna.nombre)) {
        try {
          const sql = `ALTER TABLE Producto ADD COLUMN ${columna.nombre} ${columna.tipo} DEFAULT ${columna.defecto}`;
          await db.runAsync(sql);
          console.log(`✅ Columna ${columna.nombre} agregada a Producto`);
        } catch (alterError) {
          console.warn(
            `⚠️ No se pudo agregar columna ${columna.nombre}:`,
            alterError,
          );
        }
      } else {
        console.log(`ℹ️ Columna ${columna.nombre} ya existe en Producto`);
      }
    }

    console.log("✅ Verificación de columnas de formato completada");
  } catch (error) {
    console.error("❌ Error verificando columnas de formato:", error);
  }
};

// **VERIFICAR Y AGREGAR COLUMNAS A TABLA ALMACENPRODUCTO**
const verificarYAgregarColumnasAlmacenProducto = async (): Promise<void> => {
  try {
    console.log("🔍 Verificando columnas en tabla AlmacenProducto...");

    // Columnas que deben existir para el historial
    const columnasNecesarias = [
      { nombre: "cantidad_inicial", defecto: "NULL", tipo: "INTEGER" },
    ];

    // Verificar columnas existentes
    const columnasExistentes = await executeQuery<any>(
      `PRAGMA table_info(AlmacenProducto)`,
    );
    const nombresColumnas = columnasExistentes.map((col: any) => col.name);

    // Agregar columnas faltantes
    for (const columna of columnasNecesarias) {
      if (!nombresColumnas.includes(columna.nombre)) {
        try {
          const sql = `ALTER TABLE AlmacenProducto ADD COLUMN ${columna.nombre} ${columna.tipo} DEFAULT ${columna.defecto}`;
          await db.runAsync(sql);
          console.log(
            `✅ Columna ${columna.nombre} agregada a AlmacenProducto`,
          );
        } catch (alterError) {
          console.warn(
            `⚠️ No se pudo agregar columna ${columna.nombre}:`,
            alterError,
          );
        }
      } else {
        console.log(
          `ℹ️ Columna ${columna.nombre} ya existe en AlmacenProducto`,
        );
      }
    }

    console.log("✅ Verificación de columnas de AlmacenProducto completada");
  } catch (error) {
    console.error("❌ Error verificando columnas de AlmacenProducto:", error);
  }
};

// **VERIFICAR Y AGREGAR COLUMNAS A TABLA ALMACEN**
const verificarYAgregarColumnasAlmacen = async (): Promise<void> => {
  try {
    console.log("🔍 Verificando columnas en tabla Almacen...");

    // Columnas que deben existir para el historial
    const columnasNecesarias = [
      { nombre: "cantidad_inicial", defecto: "NULL", tipo: "INTEGER" },
    ];

    // Verificar columnas existentes
    const columnasExistentes = await executeQuery<any>(
      `PRAGMA table_info(Almacen)`,
    );
    const nombresColumnas = columnasExistentes.map((col: any) => col.name);

    // Agregar columnas faltantes
    for (const columna of columnasNecesarias) {
      if (!nombresColumnas.includes(columna.nombre)) {
        try {
          const sql = `ALTER TABLE Almacen ADD COLUMN ${columna.nombre} ${columna.tipo} DEFAULT ${columna.defecto}`;
          await db.runAsync(sql);
          console.log(`✅ Columna ${columna.nombre} agregada a Almacen`);
        } catch (alterError) {
          console.warn(
            `⚠️ No se pudo agregar columna ${columna.nombre}:`,
            alterError,
          );
        }
      } else {
        console.log(`ℹ️ Columna ${columna.nombre} ya existe en Almacen`);
      }
    }

    console.log("✅ Verificación de columnas de Almacen completada");
  } catch (error) {
    console.error("❌ Error verificando columnas de Almacen:", error);
  }
};

// **CREAR TABLA PrestamoDeuda de forma SEGURA (NO borra datos)**
const createPrestamoDeudaTableSegura = async (): Promise<void> => {
  try {
    // Verificar si la tabla existe
    const existe = await verificarTablaExiste("PrestamoDeuda");

    if (!existe) {
      // Crear tabla nueva si no existe
      await db.execAsync(`
        CREATE TABLE PrestamoDeuda (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo TEXT NOT NULL CHECK(tipo IN ('prestamo', 'deuda')),
          descripcion TEXT NOT NULL,
          monto REAL NOT NULL,
          moneda TEXT DEFAULT 'CUP',
          punto_id INTEGER,
          producto_id INTEGER, -- ID del producto original prestado
          fecha_inicio DATE NOT NULL,
          fecha_vencimiento DATE NOT NULL,
          estado TEXT NOT NULL CHECK(estado IN ('pendiente', 'pagado', 'vencido')) DEFAULT 'pendiente',
          notas TEXT,
          notificado_en DATETIME,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE SET NULL
        )
      `);
      console.log("✅ Tabla PrestamoDeuda CREADA NUEVA");
    } else {
      // La tabla ya existe - NO LA BORREMOS
      console.log("ℹ️  Tabla PrestamoDeuda YA EXISTE, conservando datos");

      // Verificar y agregar columnas faltantes si es necesario
      const columnasNecesarias = [
        "punto_id",
        "moneda",
        "notificado_en",
        "fecha_inicio",
        "producto_id",
      ];

      for (const columna of columnasNecesarias) {
        const existeColumna = await verificarColumnaExiste(
          "PrestamoDeuda",
          columna,
        );
        if (!existeColumna) {
          try {
            if (columna === "punto_id") {
              await db.runAsync(
                "ALTER TABLE PrestamoDeuda ADD COLUMN punto_id INTEGER",
              );
            } else if (columna === "moneda") {
              await db.runAsync(
                'ALTER TABLE PrestamoDeuda ADD COLUMN moneda TEXT DEFAULT "CUP"',
              );
            } else if (columna === "notificado_en") {
              await db.runAsync(
                "ALTER TABLE PrestamoDeuda ADD COLUMN notificado_en DATETIME",
              );
            } else if (columna === "fecha_inicio") {
              await db.runAsync(
                "ALTER TABLE PrestamoDeuda ADD COLUMN fecha_inicio DATE DEFAULT CURRENT_DATE",
              );
            } else if (columna === "producto_id") {
              await db.runAsync(
                "ALTER TABLE PrestamoDeuda ADD COLUMN producto_id INTEGER",
              );
            }
            console.log(`✅ Columna ${columna} agregada a PrestamoDeuda`);
          } catch (alterError) {
            console.warn(
              `⚠️  No se pudo agregar columna ${columna}:`,
              alterError,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error manejando tabla PrestamoDeuda:", error);
    // Si hay error, crear una tabla simple
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS PrestamoDeuda (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo TEXT,
          descripcion TEXT,
          monto REAL,
          punto_id INTEGER,
          fecha_inicio DATE,
          fecha_vencimiento DATE,
          estado TEXT
        )
      `);
      console.log("✅ Tabla PrestamoDeuda de emergencia creada");
    } catch (emergencyError) {
      console.error("💀 Error crítico total:", emergencyError);
    }
  }
};

// **CREAR TABLA PrestamoProductos de forma SEGURA (NO borra datos)**
const createPrestamoProductosTableSegura = async (): Promise<void> => {
  try {
    // Verificar si la tabla existe
    const existe = await verificarTablaExiste("PrestamoProductos");

    if (!existe) {
      // Crear tabla nueva si no existe
      await db.execAsync(`
        CREATE TABLE PrestamoProductos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL,
          prestamo_deuda_id INTEGER NOT NULL,
          cantidad INTEGER NOT NULL,
          precio_unitario REAL NOT NULL,
          total REAL NOT NULL,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
          FOREIGN KEY (prestamo_deuda_id) REFERENCES PrestamoDeuda(id) ON DELETE CASCADE
        )
      `);
      console.log("✅ Tabla PrestamoProductos CREADA NUEVA");
    } else {
      // La tabla ya existe - NO LA BORREMOS
      console.log("ℹ️  Tabla PrestamoProductos YA EXISTE, conservando datos");
    }
  } catch (error) {
    console.error("❌ Error creando tabla PrestamoProductos:", error);
    throw error;
  }
};

// **CREAR TABLA AlmacenProducto de forma SEGURA (NO borra datos)**
const createAlmacenProductoTableSegura = async (): Promise<void> => {
  try {
    // Verificar si la tabla existe
    const existe = await verificarTablaExiste("AlmacenProducto");

    if (!existe) {
      // Crear tabla nueva si no existe
      await db.execAsync(`
        CREATE TABLE AlmacenProducto (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          almacen_id INTEGER NOT NULL,
          producto_id INTEGER NOT NULL,
          cantidad INTEGER NOT NULL DEFAULT 0,
          ubicacion TEXT,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (almacen_id) REFERENCES Almacenes(id) ON DELETE CASCADE,
          FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
          UNIQUE(almacen_id, producto_id)
        )
      `);
      console.log("✅ Tabla AlmacenProducto CREADA NUEVA");
    } else {
      // La tabla ya existe - NO LA BORREMOS
      console.log("ℹ️  Tabla AlmacenProducto YA EXISTE, conservando datos");
    }
  } catch (error) {
    console.error("❌ Error creando tabla AlmacenProducto:", error);
    throw error;
  }
};

const createAlmacenZonaTable = async (): Promise<void> => {
  try {
    const existe = await verificarTablaExiste("AlmacenZona");

    if (!existe) {
      await db.execAsync(`
        CREATE TABLE AlmacenZona (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL,
          punto_id INTEGER NOT NULL,
          zona_id INTEGER NOT NULL, -- 1 = Zona de Venta, 2 = Almacén del punto
          cantidad INTEGER NOT NULL DEFAULT 0,
          precio_venta REAL,
          ganancia REAL,  -- ← AÑADE ESTA LÍNEA
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE,
          UNIQUE(producto_id, punto_id, zona_id)
        )
      `);
      console.log("✅ Tabla AlmacenZona CREADA NUEVA");

      // Insertar datos iniciales si existen productos en AlmacenPunto
      try {
        // Migrar datos existentes de AlmacenPunto a AlmacenZona
        const productosPunto = await executeQuery<any>(`
          SELECT producto_id, punto_id, cantidad, precio_venta, ganancia  -- ← Añade ganancia
          FROM AlmacenPunto 
          WHERE cantidad > 0
        `);

        if (productosPunto.length > 0) {
          console.log(
            `📦 Migrando ${productosPunto.length} productos a zona de venta...`,
          );

          for (const producto of productosPunto) {
            // Migrar a zona de venta (zona_id = 1)
            await db.runAsync(
              `
              INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia)
              VALUES (?, ?, 1, ?, ?, ?)
            `,
              [
                producto.producto_id,
                producto.punto_id,
                producto.cantidad,
                producto.precio_venta,
                producto.ganancia,
              ],
            );
          }
          console.log("✅ Datos migrados a AlmacenZona");
        }
      } catch (migError) {
        console.warn("⚠️  No se pudieron migrar datos existentes:", migError);
      }
    } else {
      console.log("ℹ️  Tabla AlmacenZona YA EXISTE, conservando datos");

      // Verificar si la columna ganancia existe, si no, agregarla
      const gananciaExiste = await verificarColumnaExiste(
        "AlmacenZona",
        "ganancia",
      );
      if (!gananciaExiste) {
        try {
          await db.runAsync("ALTER TABLE AlmacenZona ADD COLUMN ganancia REAL");
          console.log("✅ Columna ganancia agregada a AlmacenZona");
        } catch (alterError) {
          console.warn("⚠️  No se pudo agregar columna ganancia:", alterError);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error creando tabla AlmacenZona:", error);
  }
};
// **CREAR ÍNDICES de forma SEGURA**
const createIndicesSeguros = async (): Promise<void> => {
  try {
    // Índices para PrestamoDeuda (solo si la tabla existe)
    const existePrestamoDeuda = await verificarTablaExiste("PrestamoDeuda");

    if (existePrestamoDeuda) {
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_prestamo_estado ON PrestamoDeuda(estado);
        CREATE INDEX IF NOT EXISTS idx_prestamo_fecha_vencimiento ON PrestamoDeuda(fecha_vencimiento);
        CREATE INDEX IF NOT EXISTS idx_prestamo_punto_id ON PrestamoDeuda(punto_id);
        CREATE INDEX IF NOT EXISTS idx_prestamo_tipo ON PrestamoDeuda(tipo);
      `);
      console.log("✅ Índices de PrestamoDeuda creados/verificados");
    }

    // Índices para PrestamoProductos (solo si la tabla existe)
    const existePrestamoProductos =
      await verificarTablaExiste("PrestamoProductos");

    if (existePrestamoProductos) {
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_prestamo_productos_prestamo_deuda_id ON PrestamoProductos(prestamo_deuda_id);
        CREATE INDEX IF NOT EXISTS idx_prestamo_productos_producto_id ON PrestamoProductos(producto_id);
      `);
      console.log("✅ Índices de PrestamoProductos creados/verificados");
    }

    // Índices para AlmacenZona (solo si la tabla existe)
    const existeAlmacenZona = await verificarTablaExiste("AlmacenZona");

    if (existeAlmacenZona) {
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_almacenzona_punto_zona ON AlmacenZona(punto_id, zona_id);
        CREATE INDEX IF NOT EXISTS idx_almacenzona_producto ON AlmacenZona(producto_id);
        CREATE INDEX IF NOT EXISTS idx_almacenzona_punto ON AlmacenZona(punto_id);
      `);
      console.log("✅ Índices de AlmacenZona creados/verificados");
    }
  } catch (error) {
    console.error("❌ Error creando índices:", error);
  }
};

// **MIGRAR TABLA OFERTA a estructura completa (MODO SEGURO)**
const migrarTablaOferta = async (): Promise<void> => {
  try {
    console.log("🔄 Migrando tabla Oferta a estructura completa...");

    // Verificar si la tabla existe
    const existeTabla = await verificarTablaExiste("Oferta");
    if (!existeTabla) {
      console.log(
        "ℹ️ Tabla Oferta no existe, será creada con la estructura nueva",
      );
      return;
    }

    // Verificar columnas existentes
    const columnasExistentes = await executeQuery<any>(
      `PRAGMA table_info(Oferta)`,
    );
    const nombresColumnas = columnasExistentes.map((col: any) => col.name);

    console.log("📋 Columnas actuales en Oferta:", nombresColumnas);

    // Columnas que deben existir en la nueva estructura
    const columnasNecesarias = [
      { nombre: "nombre", defecto: "NULL", tipo: "TEXT" },
      { nombre: "dias_ilimitados", defecto: "0", tipo: "INTEGER" },
      { nombre: "dias_validez", defecto: "NULL", tipo: "INTEGER" },
      { nombre: "aplica_a_todos", defecto: "1", tipo: "INTEGER" },
      { nombre: "tipo_descuento_todos", defecto: "'porcentaje'", tipo: "TEXT" },
      { nombre: "valor_descuento_todos", defecto: "0", tipo: "REAL" },
      {
        nombre: "actualizado_en",
        defecto: "CURRENT_TIMESTAMP",
        tipo: "DATETIME",
      },
    ];

    // Agregar columnas faltantes
    for (const columna of columnasNecesarias) {
      if (!nombresColumnas.includes(columna.nombre)) {
        try {
          const sql = `ALTER TABLE Oferta ADD COLUMN ${columna.nombre} ${columna.tipo} DEFAULT ${columna.defecto}`;
          await db.runAsync(sql);
          console.log(`✅ Columna ${columna.nombre} agregada a Oferta`);
        } catch (alterError) {
          console.warn(
            `⚠️ No se pudo agregar columna ${columna.nombre}:`,
            alterError,
          );
        }
      }
    }

    // Actualizar el método_pago para incluir 'efectivo' y 'todos'
    // Como SQLite no permite modificar CHECK constraints, necesitamos recrear la tabla
    try {
      console.log("🔄 Verificando restricción CHECK de metodo_pago...");

      // Verificar si la restricción CHECK actual incluye 'efectivo' de forma simple
      const tableInfo = await executeQuery(`PRAGMA table_info(Oferta)`);
      const tieneMetodoPago = tableInfo.some(
        (col: any) => col.name === "metodo_pago",
      );

      if (tieneMetodoPago) {
        // Intentar insertar un valor de prueba para verificar la restricción
        try {
          await executeNonQuery(`
            INSERT INTO Oferta (punto_id, nombre, metodo_pago, tipo, valor, fecha_inicio, fecha_fin, activa)
            VALUES (9999, 'test_check', 'efectivo', 'porcentaje', 0, '2024-01-01', '2024-01-02', 0)
          `);
          // Si funciona, eliminar el registro de prueba
          await executeNonQuery(`DELETE FROM Oferta WHERE punto_id = 9999`);
          console.log(
            "✅ Restricción CHECK ya es correcta (incluye 'efectivo')",
          );
        } catch (checkError: any) {
          if (checkError.message?.includes("CHECK constraint failed")) {
            console.log(
              "⚠️ Restricción CHECK antigua detectada, recreando tabla Oferta...",
            );

            // Guardar datos existentes
            const datosExistentes = await executeQuery(`SELECT * FROM Oferta`);
            console.log(
              `📦 Guardando ${datosExistentes.length} registros existentes...`,
            );

            // Eliminar tabla antigua
            await db.runAsync(`DROP TABLE Oferta`);
            console.log("🗑️ Tabla Oferta eliminada");

            // Crear tabla nueva con restricción correcta
            await db.runAsync(`
              CREATE TABLE Oferta (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                punto_id INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                dias_ilimitados INTEGER DEFAULT 0,
                usar_dias_validez INTEGER DEFAULT 0,
                dias_validez INTEGER,
                usar_rango_dias INTEGER DEFAULT 0,
                dia_inicio TEXT,
                dia_fin TEXT,
                repetir INTEGER DEFAULT 0,
                usar_calendario INTEGER DEFAULT 0,
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE NOT NULL,
                activa INTEGER DEFAULT 1,
                aplica_a_todos INTEGER DEFAULT 1,
                metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('transferencia', 'efectivo', 'todos')),
                tipo TEXT NOT NULL DEFAULT 'porcentaje',
                valor REAL NOT NULL DEFAULT 0,
                tipo_descuento_todos TEXT DEFAULT 'porcentaje',
                valor_descuento_todos REAL DEFAULT 0,
                creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
                actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
              );
            `);
            console.log(
              "✅ Nueva tabla Oferta creada con restricción correcta",
            );

            // Restaurar datos existentes
            for (const registro of datosExistentes) {
              try {
                // Asegurar que metodo_pago tenga un valor válido
                const metodoPagoValido = [
                  "transferencia",
                  "efectivo",
                  "todos",
                ].includes(registro.metodo_pago)
                  ? registro.metodo_pago
                  : "todos";

                await db.runAsync(
                  `
                  INSERT INTO Oferta (
                    punto_id, nombre, descripcion, dias_ilimitados, dias_validez,
                    fecha_inicio, fecha_fin, activa, aplica_a_todos, metodo_pago,
                    tipo, valor, tipo_descuento_todos, valor_descuento_todos, creado_en
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                  [
                    registro.punto_id,
                    registro.nombre || "Oferta sin nombre",
                    registro.descripcion,
                    registro.dias_ilimitados || 0,
                    registro.dias_validez,
                    registro.fecha_inicio || getFechaLocal(),
                    registro.fecha_fin || getFechaLocal(),
                    registro.activa || 1,
                    registro.aplica_a_todos || 1,
                    metodoPagoValido,
                    registro.tipo || "porcentaje",
                    registro.valor || 0,
                    registro.tipo_descuento_todos || "porcentaje",
                    registro.valor_descuento_todos || 0,
                    registro.creado_en,
                  ],
                );
              } catch (error) {
                console.log(
                  `⚠️ Error restaurando registro ${registro.id}:`,
                  error,
                );
              }
            }
            console.log("✅ Datos restaurados correctamente");
          } else {
            throw checkError;
          }
        }
      }
    } catch (e) {
      console.log("ℹ️ Error verificando restricción metodo_pago:", e);
    }

    // Migrar datos antiguos si es necesario
    const tieneNombre = nombresColumnas.includes("nombre");
    const tieneTipo = nombresColumnas.includes("tipo");
    const tieneValor = nombresColumnas.includes("valor");

    if (tieneTipo && tieneValor && tieneNombre) {
      // Generar nombres para registros que no tienen
      await db.runAsync(`
        UPDATE Oferta 
        SET nombre = COALESCE(
          nombre, 
          descripcion, 
          'Oferta ' || CASE tipo 
            WHEN 'porcentaje' THEN valor || '%'
            WHEN 'valor' THEN '$' || valor
            ELSE 'sin descripción'
          END
        )
        WHERE nombre IS NULL OR nombre = ''
      `);
      console.log("✅ Nombres generados para ofertas antiguas");
    }

    console.log("✅ Migración de tabla Oferta completada");
  } catch (error) {
    console.error("❌ Error migrando tabla Oferta:", error);
  }
};

// **CREAR TABLA Gastos de forma SEGURA (NO borra datos)**
export const createGastosTableSegura = async (): Promise<void> => {
  try {
    // Verificar si la tabla existe
    const existe = await verificarTablaExiste("Gastos");

    if (!existe) {
      // Crear tabla nueva si no existe
      await db.execAsync(`
        CREATE TABLE Gastos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          precio REAL NOT NULL,
          punto_id INTEGER NOT NULL,
          tipo TEXT NOT NULL CHECK(tipo IN ('casual', 'pasivo')),
          categoria TEXT DEFAULT 'general',
          descripcion TEXT,
          fecha_gasto DATE NOT NULL,
          recurrente INTEGER DEFAULT 0,
          periodicidad TEXT CHECK(periodicidad IN ('diario', 'semanal', 'mensual')),
          activo INTEGER DEFAULT 1,
          es_porcentaje INTEGER DEFAULT 0,
          porcentaje REAL, -- Nuevo campo para guardar el porcentaje original
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
        )
      `);
      console.log("✅ Tabla Gastos CREADA NUEVA");
    } else {
      // La tabla ya existe - verificar y agregar columnas faltantes
      console.log("ℹ️  Tabla Gastos YA EXISTE, verificando columnas...");

      // Verificar si usa la columna antigua 'id_punto' y migrar a 'punto_id'
      const columnaIdPunto = await verificarColumnaExiste("Gastos", "id_punto");
      const columnaPuntoId = await verificarColumnaExiste("Gastos", "punto_id");

      if (columnaIdPunto && !columnaPuntoId) {
        // Migrar de id_punto a punto_id
        console.log("🔄 Migrando columna 'id_punto' a 'punto_id'...");
        await db.runAsync(
          "ALTER TABLE Gastos RENAME COLUMN id_punto TO punto_id",
        );
        console.log("✅ Columna 'id_punto' renombrada a 'punto_id'");
      }

      // Verificar si la columna 'activo' existe
      const columnaActivo = await verificarColumnaExiste("Gastos", "activo");
      if (!columnaActivo) {
        await db.runAsync(
          "ALTER TABLE Gastos ADD COLUMN activo INTEGER DEFAULT 1",
        );
        console.log("✅ Columna 'activo' agregada a Gastos");
      }

      // Verificar si la columna 'recurrente' existe
      const columnaRecurrente = await verificarColumnaExiste(
        "Gastos",
        "recurrente",
      );
      if (!columnaRecurrente) {
        await db.runAsync(
          "ALTER TABLE Gastos ADD COLUMN recurrente INTEGER DEFAULT 0",
        );
        console.log("✅ Columna 'recurrente' agregada a Gastos");
      }

      // Verificar si la columna 'periodicidad' existe
      const columnaPeriodicidad = await verificarColumnaExiste(
        "Gastos",
        "periodicidad",
      );
      if (!columnaPeriodicidad) {
        await db.runAsync(
          "ALTER TABLE Gastos ADD COLUMN periodicidad TEXT CHECK(periodicidad IN ('diario', 'semanal', 'mensual'))",
        );
        console.log("✅ Columna 'periodicidad' agregada a Gastos");
      }

      // Verificar si la columna 'categoria' existe
      const columnaCategoria = await verificarColumnaExiste(
        "Gastos",
        "categoria",
      );
      if (!columnaCategoria) {
        await db.runAsync(
          "ALTER TABLE Gastos ADD COLUMN categoria TEXT DEFAULT 'general'",
        );
        console.log("✅ Columna 'categoria' agregada a Gastos");
      }

      // Verificar si la columna 'actualizado_en' existe
      const columnaActualizado = await verificarColumnaExiste(
        "Gastos",
        "actualizado_en",
      );
      if (!columnaActualizado) {
        await db.runAsync(
          "ALTER TABLE Gastos ADD COLUMN actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP",
        );
        console.log("✅ Columna 'actualizado_en' agregada a Gastos");
      }

      // Verificar si usa la columna antigua 'nombre_gasto' y migrar a 'nombre'
      const columnaNombreGasto = await verificarColumnaExiste(
        "Gastos",
        "nombre_gasto",
      );
      const columnaNombre = await verificarColumnaExiste("Gastos", "nombre");

      if (columnaNombreGasto && !columnaNombre) {
        // Migrar de nombre_gasto a nombre
        console.log("🔄 Migrando columna 'nombre_gasto' a 'nombre'...");
        await db.runAsync(
          "ALTER TABLE Gastos RENAME COLUMN nombre_gasto TO nombre",
        );
        console.log("✅ Columna 'nombre_gasto' renombrada a 'nombre'");
      }

      // Verificar si la columna 'es_porcentaje' existe
      const columnaEsPorcentaje = await verificarColumnaExiste(
        "Gastos",
        "es_porcentaje",
      );
      if (!columnaEsPorcentaje) {
        await db.runAsync(
          "ALTER TABLE Gastos ADD COLUMN es_porcentaje INTEGER DEFAULT 0",
        );
        console.log("✅ Columna 'es_porcentaje' agregada a Gastos");
      }

      // Verificar si la columna 'porcentaje' existe
      const columnaPorcentaje = await verificarColumnaExiste(
        "Gastos",
        "porcentaje",
      );
      if (!columnaPorcentaje) {
        await db.runAsync("ALTER TABLE Gastos ADD COLUMN porcentaje REAL");
        console.log("✅ Columna 'porcentaje' agregada a Gastos");
      }

      // Verificar si la columna 'salario_fijo' existe
      console.log("🔍 Verificando columna 'salario_fijo'...");
      const columnaSalarioFijo = await verificarColumnaExiste(
        "Gastos",
        "salario_fijo",
      );
      console.log(`📋 Columna 'salario_fijo' existe: ${columnaSalarioFijo}`);

      if (!columnaSalarioFijo) {
        console.log("📝 Agregando columna 'salario_fijo'...");
        await db.runAsync("ALTER TABLE Gastos ADD COLUMN salario_fijo REAL");
        console.log("✅ Columna 'salario_fijo' agregada a Gastos");
      } else {
        console.log("✅ Columna 'salario_fijo' ya existe en Gastos");
      }
    }
  } catch (error) {
    console.error("❌ Error manejando tabla Gastos:", error);
    // Si hay error, crear una tabla simple
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS Gastos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT,
          precio REAL,
          punto_id INTEGER,
          tipo TEXT,
          fecha_gasto DATE
        )
      `);
      console.log("✅ Tabla Gastos de emergencia creada");
    } catch (emergencyError) {
      console.error("💀 Error crítico total:", emergencyError);
    }
  }
};

// **FUNCIÓN PRINCIPAL: Inicializar base de datos SIN perder datos (OPTIMIZADA PARA EVITAR LOCKS)**
export const initDatabase = async (): Promise<boolean> => {
  try {
    console.log("🚀 INICIANDO BASE DE DATOS (MODO SEGURO OPTIMIZADO)...");

    // Esperar un momento para asegurar que la base de datos esté completamente lista
    await new Promise((resolve) => setTimeout(resolve, 100));

    // **PASO 1: Crear tablas básicas SIN borrar**
    await db.execAsync(`
      -- Tabla: Producto
      CREATE TABLE IF NOT EXISTS Producto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        categoria TEXT NOT NULL,
        subcategoria TEXT NOT NULL,
        precio_coste REAL NOT NULL,
        fecha_caducidad DATE,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla: Punto
      CREATE TABLE IF NOT EXISTS Punto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        tipo_negocio TEXT NOT NULL CHECK(tipo_negocio IN ('punto', 'panaderia')),
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla: Configuracion
      CREATE TABLE IF NOT EXISTS Configuracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT NOT NULL UNIQUE,
        valor TEXT NOT NULL,
        descripcion TEXT,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla: Almacenes (Multi-almacén)
      CREATE TABLE IF NOT EXISTS Almacenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        descripcion TEXT,
        ubicacion TEXT,
        activo BOOLEAN DEFAULT 1,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Tablas básicas verificadas");

    // Pequeña pausa entre operaciones críticas
    await new Promise((resolve) => setTimeout(resolve, 50));

    // **PASO 2: Verificar y agregar columnas de forma secuencial (sin concurrencia)**
    await verificarYAgregarColumnasProducto();
    await new Promise((resolve) => setTimeout(resolve, 30));

    await verificarYAgregarColumnasAlmacenProducto();
    await new Promise((resolve) => setTimeout(resolve, 30));

    await verificarYAgregarColumnasAlmacen();
    await new Promise((resolve) => setTimeout(resolve, 30));

    await verificarYAgregarColumnasOferta();
    console.log("✅ Columnas verificadas");

    // Pausa antes de crear tablas especializadas
    await new Promise((resolve) => setTimeout(resolve, 50));

    // **PASO 3: Crear tablas especializadas (secuencialmente)**
    await createPrestamoDeudaTableSegura();
    await new Promise((resolve) => setTimeout(resolve, 30));

    await createPrestamoProductosTableSegura();
    await new Promise((resolve) => setTimeout(resolve, 30));

    await createAlmacenProductoTableSegura();
    await new Promise((resolve) => setTimeout(resolve, 30));

    await createGastosTableSegura();
    console.log("✅ Tablas especializadas creadas");

    // Pausa antes de tablas restantes
    await new Promise((resolve) => setTimeout(resolve, 50));

    // **PASO 4: Crear el resto de tablas (SIN borrar)**
    await db.execAsync(`
      -- Tabla: Almacen (Almacén general principal)
      CREATE TABLE IF NOT EXISTS Almacen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 0,
        ubicacion TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
      );

      -- Tabla: AlmacenPunto (DEPRECADA - Se migrará a AlmacenZona)
      CREATE TABLE IF NOT EXISTS AlmacenPunto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        punto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 0,
        precio_venta REAL NOT NULL,
        ganancia REAL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE,
        UNIQUE(producto_id, punto_id)
      );

      -- Tabla: Venta
      CREATE TABLE IF NOT EXISTS Venta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        punto_id INTEGER NOT NULL,
        total_venta REAL NOT NULL,
        total_efectivo REAL DEFAULT 0,
        total_transferencia REAL DEFAULT 0,
        tipo_pago TEXT CHECK(tipo_pago IN ('efectivo', 'transferencia', 'mixto')),
        metodo_transferencia TEXT CHECK(metodo_transferencia IN ('ENZONA', 'TRANSFERMOVIL', 'TARJETA', NULL)),
        es_directa BOOLEAN DEFAULT 0,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );

      -- Tabla: DetalleVenta
      CREATE TABLE IF NOT EXISTS DetalleVenta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        subtotal REAL,
        precio_coste_real REAL,
        FOREIGN KEY (venta_id) REFERENCES Venta(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
      );

      -- Tabla: VentaDirecta para ventas directas desde almacén
      CREATE TABLE IF NOT EXISTS VentaDirecta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_venta REAL NOT NULL,
        precio_coste_real REAL NOT NULL,
        tipo_pago TEXT CHECK(tipo_pago IN ('efectivo', 'transferencia')),
        metodo_transferencia TEXT CHECK(metodo_transferencia IN ('ENZONA', 'TRANSFERMOVIL', 'TARJETA', NULL)),
        subtotal REAL,
        ganancia REAL,
        notas TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
      );

      -- Tabla: CierreCaja
      CREATE TABLE IF NOT EXISTS CierreCaja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        punto_id INTEGER NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'cierre', -- 'apertura' o 'cierre'
        fondo_caja REAL NOT NULL DEFAULT 0, -- dinero inicial para aperturas
        total_ventas REAL NOT NULL DEFAULT 0,
        total_efectivo REAL NOT NULL DEFAULT 0,
        total_transferencia REAL NOT NULL DEFAULT 0,
        total_gastos REAL NOT NULL DEFAULT 0,
        total_ganancias REAL NOT NULL DEFAULT 0,
        total_extraido REAL NOT NULL DEFAULT 0,
        observaciones TEXT,
        fecha_cierre TEXT NOT NULL, -- fecha y hora del registro
        creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );

      -- Tabla: CierreCajaProducto para inventario físico
      CREATE TABLE IF NOT EXISTS CierreCajaProducto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cierre_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad_sistema INTEGER NOT NULL DEFAULT 0,
        cantidad_fisica INTEGER NOT NULL DEFAULT 0,
        diferencia INTEGER NOT NULL DEFAULT 0,
        precio_unitario REAL NOT NULL DEFAULT 0,
        total_diferencia REAL NOT NULL DEFAULT 0,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cierre_id) REFERENCES CierreCaja(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
      );

      -- Tabla: FormulasPan para fórmulas de pan
      CREATE TABLE IF NOT EXISTS FormulasPan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        harina REAL NOT NULL,
        levadura REAL NOT NULL,
        nucleo REAL NOT NULL,
        azucar REAL NOT NULL,
        sal REAL NOT NULL,
        aceite REAL NOT NULL,
        activo BOOLEAN DEFAULT 1,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla: Oferta
      CREATE TABLE IF NOT EXISTS Oferta (
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
        tipo TEXT NOT NULL DEFAULT 'porcentaje',
        valor REAL NOT NULL DEFAULT 0,
        tipo_descuento_todos TEXT DEFAULT 'porcentaje',
        valor_descuento_todos REAL DEFAULT 0,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
      
      -- Tabla: OfertaProducto
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
      
      -- Tabla: LogTransferencia para historial
      CREATE TABLE IF NOT EXISTS LogTransferencia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        punto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_venta REAL NOT NULL,
        precio_coste_real REAL NOT NULL,
        notas TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        cantidad_antes INTEGER DEFAULT 0,
        cantidad_despues INTEGER DEFAULT 0,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
      
      -- Tabla: CambioPrecio para historial de cambios de precios
      CREATE TABLE IF NOT EXISTS CambioPrecio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        punto_id INTEGER NOT NULL,
        precio_anterior REAL NOT NULL,
        precio_nuevo REAL NOT NULL,
        diferencia REAL NOT NULL,
        motivo TEXT DEFAULT 'Edición manual',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
      
      -- Tabla: CierreCajaCambioPrecio para cambios de precios en cierres
      CREATE TABLE IF NOT EXISTS CierreCajaCambioPrecio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cierre_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        precio_anterior REAL NOT NULL,
        precio_nuevo REAL NOT NULL,
        diferencia REAL NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cierre_id) REFERENCES CierreCaja(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE
      );
      
      -- Tabla: TopePrecio para límites de precios por producto
      CREATE TABLE IF NOT EXISTS TopePrecio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        tope_precio REAL NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Tabla: HistorialInventario para Ledger de movimientos de stock
      CREATE TABLE IF NOT EXISTS HistorialInventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        almacen_id INTEGER,
        punto_id INTEGER,
        zona_id INTEGER,
        tipo_movimiento TEXT NOT NULL CHECK(tipo_movimiento IN ('transferencia', 'venta', 'ajuste', 'cierre', 'devolucion', 'merma', 'produccion', 'creacion')),
        cantidad_variacion INTEGER NOT NULL,
        stock_anterior INTEGER NOT NULL DEFAULT 0,
        stock_nuevo INTEGER NOT NULL DEFAULT 0,
        entidad_origen_destino TEXT,
        notas TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
        FOREIGN KEY (almacen_id) REFERENCES Almacenes(id) ON DELETE SET NULL,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE SET NULL
      );
      
      -- Tabla: AuditoriaPorcentaje para registrar cambios de porcentaje de salarios
      CREATE TABLE IF NOT EXISTS AuditoriaPorcentaje (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gasto_id INTEGER NOT NULL,
        punto_id INTEGER NOT NULL,
        porcentaje_anterior REAL,
        porcentaje_nuevo REAL NOT NULL,
        fecha_cambio DATE NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gasto_id) REFERENCES Gastos(id) ON DELETE CASCADE,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
      
      -- Índices para AuditoriaPorcentaje
      CREATE INDEX IF NOT EXISTS idx_auditoria_gasto_id ON AuditoriaPorcentaje(gasto_id);
      CREATE INDEX IF NOT EXISTS idx_auditoria_punto_id ON AuditoriaPorcentaje(punto_id);
      CREATE INDEX IF NOT EXISTS idx_auditoria_fecha_cambio ON AuditoriaPorcentaje(fecha_cambio);

      -- Tabla: GastosManuales para gastos manuales por día y mes
      CREATE TABLE IF NOT EXISTS GastosManuales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        punto_id INTEGER NOT NULL,
        año INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        dia INTEGER NOT NULL,
        monto REAL NOT NULL DEFAULT 0,
        descripcion TEXT DEFAULT '',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(punto_id, año, mes, dia),
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
      
      -- Tabla: IngresosAjustados para ingresos modificados por el usuario
      CREATE TABLE IF NOT EXISTS IngresosAjustados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        punto_id INTEGER NOT NULL,
        año INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        dia INTEGER NOT NULL,
        monto_original REAL NOT NULL DEFAULT 0,
        monto_ajustado REAL NOT NULL DEFAULT 0,
        multiplicador_aplicado REAL NOT NULL DEFAULT 1,
        descripcion TEXT DEFAULT '',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(punto_id, año, mes, dia),
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
      
      -- Tabla: HistorialConsumosPropios para registrar consumos propios por trabajador y fecha
      CREATE TABLE IF NOT EXISTS HistorialConsumosPropios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        punto_id INTEGER NOT NULL,
        trabajador_id INTEGER NOT NULL,
        trabajador_nombre TEXT NOT NULL,
        fecha_consumo DATE NOT NULL,
        monto_consumo REAL NOT NULL,
        descripcion TEXT DEFAULT '',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(punto_id, trabajador_id, fecha_consumo),
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
      
      -- Índices para HistorialConsumosPropios
      CREATE INDEX IF NOT EXISTS idx_historial_consumos_punto_id ON HistorialConsumosPropios(punto_id);
      CREATE INDEX IF NOT EXISTS idx_historial_consumos_trabajador_id ON HistorialConsumosPropios(trabajador_id);
      CREATE INDEX IF NOT EXISTS idx_historial_consumos_fecha ON HistorialConsumosPropios(fecha_consumo);
      
      -- Índices para HistorialInventario
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_producto_id ON HistorialInventario(producto_id);
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_creado_en ON HistorialInventario(creado_en);
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_almacen_id ON HistorialInventario(almacen_id);
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_punto_id ON HistorialInventario(punto_id);
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_tipo_movimiento ON HistorialInventario(tipo_movimiento);
      CREATE INDEX IF NOT EXISTS idx_historial_inventario_compuesto ON HistorialInventario(producto_id, creado_en);
      
      -- Tabla: Agenda para citas, recordatorios y eventos
      CREATE TABLE IF NOT EXISTS Agenda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        tipo TEXT NOT NULL CHECK(tipo IN ('cita', 'recordatorio', 'evento')),
        prioridad TEXT NOT NULL CHECK(prioridad IN ('baja', 'media', 'alta')) DEFAULT 'media',
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        punto_id INTEGER,
        ubicacion TEXT,
        notas TEXT,
        estado TEXT NOT NULL CHECK(estado IN ('pendiente', 'completado', 'cancelado')) DEFAULT 'pendiente',
        -- Campos para eventos recurrentes
        es_recurrente INTEGER DEFAULT 0 CHECK(es_recurrente IN (0, 1)),
        tipo_repeticion TEXT CHECK(tipo_repeticion IN ('mensual', 'diario')),
        dia_semana TEXT CHECK(dia_semana IN ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')),
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE SET NULL
      );
      
      -- Índices para Agenda
      CREATE INDEX IF NOT EXISTS idx_agenda_fecha ON Agenda(fecha);
      CREATE INDEX IF NOT EXISTS idx_agenda_tipo ON Agenda(tipo);
      CREATE INDEX IF NOT EXISTS idx_agenda_estado ON Agenda(estado);
      CREATE INDEX IF NOT EXISTS idx_agenda_punto_id ON Agenda(punto_id);
      CREATE INDEX IF NOT EXISTS idx_agenda_compuesta ON Agenda(fecha, hora);
    `);
    console.log("✅ Todas las tablas verificadas");

    // Pausa antes de verificar columnas de Agenda
    await new Promise((resolve) => setTimeout(resolve, 30));

    // **PASO 5.5: Verificar y agregar columnas faltantes a Agenda**
    try {
      const esRecurrenteExiste = await verificarColumnaExiste(
        "Agenda",
        "es_recurrente",
      );
      if (!esRecurrenteExiste) {
        await db.runAsync(
          "ALTER TABLE Agenda ADD COLUMN es_recurrente INTEGER DEFAULT 0 CHECK(es_recurrente IN (0, 1))",
        );
        console.log("✅ Columna es_recurrente agregada a Agenda");
      }

      const tipoRepeticionExiste = await verificarColumnaExiste(
        "Agenda",
        "tipo_repeticion",
      );
      if (!tipoRepeticionExiste) {
        await db.runAsync(
          "ALTER TABLE Agenda ADD COLUMN tipo_repeticion TEXT CHECK(tipo_repeticion IN ('mensual', 'diario'))",
        );
        console.log("✅ Columna tipo_repeticion agregada a Agenda");
      }

      const diaSemanaExiste = await verificarColumnaExiste(
        "Agenda",
        "dia_semana",
      );
      if (!diaSemanaExiste) {
        await db.runAsync(
          "ALTER TABLE Agenda ADD COLUMN dia_semana TEXT CHECK(dia_semana IN ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'))",
        );
        console.log("✅ Columna dia_semana agregada a Agenda");
      }
    } catch (error) {
      console.error("❌ Error agregando columnas a Agenda:", error);
    }

    // Pausa antes de crear AlmacenZona
    await new Promise((resolve) => setTimeout(resolve, 50));

    // **PASO 5: Crear tabla AlmacenZona**
    await createAlmacenZonaTable();

    // Pausa antes de verificar columnas
    await new Promise((resolve) => setTimeout(resolve, 30));

    // **PASO 6: Verificar y agregar columnas faltantes a DetalleVenta**
    try {
      const precioCostoExiste = await verificarColumnaExiste(
        "DetalleVenta",
        "precio_coste_real",
      );
      if (!precioCostoExiste) {
        await db.runAsync(
          "ALTER TABLE DetalleVenta ADD COLUMN precio_coste_real REAL",
        );
        console.log("✅ Columna precio_coste_real agregada a DetalleVenta");
      }
    } catch (error) {
      console.warn(
        "⚠️  No se pudo verificar columna precio_coste_real en DetalleVenta:",
        error,
      );
    }

    // Pausa antes de índices
    await new Promise((resolve) => setTimeout(resolve, 30));

    // **PASO 7: Crear índices (MODO SEGURO)**
    await createIndicesSeguros();

    // Pausa antes de migraciones
    await new Promise((resolve) => setTimeout(resolve, 50));

    // **PASO 8: Migrar tabla Oferta a estructura completa**
    await migrarTablaOferta();

    // Pausa antes de siguiente migración
    await new Promise((resolve) => setTimeout(resolve, 50));

    // **PASO 9: Migrar tabla FormulasPan para agregar almacen_id**
    try {
      const columnCheck = await getSingleValue(
        `SELECT COUNT(*) as count FROM pragma_table_info('FormulasPan') WHERE name = 'almacen_id'`,
      );

      if (columnCheck === 0) {
        await executeNonQuery(
          `ALTER TABLE FormulasPan ADD COLUMN almacen_id INTEGER NOT NULL DEFAULT 1`,
        );
        console.log("✅ Columna almacen_id agregada a FormulasPan");
      } else {
        console.log("✅ Columna almacen_id ya existe en FormulasPan");
      }
    } catch (error) {
      console.warn(
        "⚠️ No se pudo verificar/agregar columna almacen_id en FormulasPan:",
        error,
      );
    }

    // Pausa antes de configuración
    await new Promise((resolve) => setTimeout(resolve, 30));

    // **PASO 9: Insertar configuración solo si no existe**
    await insertDefaultConfig();

    // Pausa antes de verificación final
    await new Promise((resolve) => setTimeout(resolve, 30));

    // **PASO 10: Verificar integridad de datos**
    await verificarIntegridadDatos();

    // **PASO 11: Migrar CierreCaja para soportar aperturas y fondo de caja**
    await migrarCierreCajaAperturas();

    // **PASO 12: Migrar LogTransferencia para soportar stock histórico**
    await migrarLogTransferenciaStockHistorico();

    // Pausa antes de siguiente migración
    await new Promise((resolve) => setTimeout(resolve, 50));

    // **PASO 13: Migrar HistorialInventario para soportar tipo 'creacion'**
    await migrateAddCreacionToHistorialInventario();

    // **PASO 14: Agregar campos de consumo propio a la tabla Venta**
    await migrateAddConsumoPropioToVenta();

    console.log("🎉 Base de datos completamente inicializada y SEGURA");
    return true;
  } catch (error) {
    console.error("💥 Error crítico inicializando base de datos:", error);
    return false;
  }
};

// **Migrar CierreCaja para soportar aperturas y fondo de caja**
const migrarCierreCajaAperturas = async (): Promise<void> => {
  try {
    console.log("🔄 Migrando CierreCaja para aperturas...");

    // Verificar si la columna 'tipo' existe
    const columnaTipoExiste = await verificarColumnaExiste(
      "CierreCaja",
      "tipo",
    );
    if (!columnaTipoExiste) {
      await db.runAsync(
        "ALTER TABLE CierreCaja ADD COLUMN tipo TEXT NOT NULL DEFAULT 'cierre'",
      );
      console.log("✅ Columna 'tipo' agregada a CierreCaja");
    }

    // Verificar si la columna 'fondo_caja' existe
    const columnaFondoCajaExiste = await verificarColumnaExiste(
      "CierreCaja",
      "fondo_caja",
    );
    if (!columnaFondoCajaExiste) {
      await db.runAsync(
        "ALTER TABLE CierreCaja ADD COLUMN fondo_caja REAL NOT NULL DEFAULT 0",
      );
      console.log("✅ Columna 'fondo_caja' agregada a CierreCaja");
    }

    // Verificar y agregar columna perdidas_inventario
    const columnaPerdidasInventarioExiste = await verificarColumnaExiste(
      "CierreCaja",
      "perdidas_inventario",
    );
    if (!columnaPerdidasInventarioExiste) {
      await db.runAsync(
        "ALTER TABLE CierreCaja ADD COLUMN perdidas_inventario REAL DEFAULT 0",
      );
      console.log("✅ Columna 'perdidas_inventario' agregada a CierreCaja");
    }

    // Verificar y agregar columna total_perdidas (si no existe)
    const columnaTotalPerdidasExiste = await verificarColumnaExiste(
      "CierreCaja",
      "total_perdidas",
    );
    if (!columnaTotalPerdidasExiste) {
      await db.runAsync(
        "ALTER TABLE CierreCaja ADD COLUMN total_perdidas REAL DEFAULT 0",
      );
      console.log("✅ Columna 'total_perdidas' agregada a CierreCaja");
    }

    // Verificar y agregar columna trabajador_id (para selección de trabajador en aperturas)
    const columnaTrabajadorIdExiste = await verificarColumnaExiste(
      "CierreCaja",
      "trabajador_id",
    );
    if (!columnaTrabajadorIdExiste) {
      await db.runAsync(
        "ALTER TABLE CierreCaja ADD COLUMN trabajador_id INTEGER",
      );
      console.log("✅ Columna 'trabajador_id' agregada a CierreCaja");
    }
  } catch (error) {
    console.error("❌ Error migrando CierreCaja:", error);
  }
};

// **Verificar integridad de datos**
const verificarIntegridadDatos = async (): Promise<void> => {
  try {
    console.log("🔍 Verificando integridad de datos...");

    // Verificar PrestamoDeuda
    const countPrestamos = await getSingleValue<number>(
      "SELECT COUNT(*) FROM PrestamoDeuda",
    );
    console.log(`📊 Préstamos/Deudas encontrados: ${countPrestamos || 0}`);

    // Verificar PrestamoProductos
    const countProductosPrestamo = await getSingleValue<number>(
      "SELECT COUNT(*) FROM PrestamoProductos",
    );
    console.log(`📦 Productos en préstamos: ${countProductosPrestamo || 0}`);

    // Verificar Productos
    const countProductos = await getSingleValue<number>(
      "SELECT COUNT(*) FROM Producto",
    );
    console.log(`🏷️  Productos totales: ${countProductos || 0}`);

    // Verificar Puntos
    const countPuntos = await getSingleValue<number>(
      "SELECT COUNT(*) FROM Punto",
    );
    console.log(`📍 Puntos totales: ${countPuntos || 0}`);

    // Verificar AlmacenZona
    const countAlmacenZona = await getSingleValue<number>(
      "SELECT COUNT(*) FROM AlmacenZona",
    );
    console.log(`🏪 Productos en zonas: ${countAlmacenZona || 0}`);

    console.log("✅ Integridad verificada correctamente");
  } catch (error) {
    console.error("⚠️  Error verificando integridad:", error);
  }
};

// **Migrar LogTransferencia para soportar stock histórico**
const migrarLogTransferenciaStockHistorico = async (): Promise<void> => {
  try {
    console.log(
      "🔄 Migrando LogTransferencia para soportar stock histórico...",
    );

    // Verificar si la columna cantidad_antes existe
    const columnaCantidadAntesExiste = await verificarColumnaExiste(
      "LogTransferencia",
      "cantidad_antes",
    );
    if (!columnaCantidadAntesExiste) {
      await db.runAsync(
        "ALTER TABLE LogTransferencia ADD COLUMN cantidad_antes INTEGER DEFAULT 0",
      );
      console.log("✅ Columna 'cantidad_antes' agregada a LogTransferencia");
    }

    // Verificar si la columna cantidad_despues existe
    const columnaCantidadDespuesExiste = await verificarColumnaExiste(
      "LogTransferencia",
      "cantidad_despues",
    );
    if (!columnaCantidadDespuesExiste) {
      await db.runAsync(
        "ALTER TABLE LogTransferencia ADD COLUMN cantidad_despues INTEGER DEFAULT 0",
      );
      console.log("✅ Columna 'cantidad_despues' agregada a LogTransferencia");
    }

    console.log("✅ Migración de LogTransferencia completada");
  } catch (error) {
    console.error("❌ Error migrando LogTransferencia:", error);
  }
};

// **Insertar configuración por defecto SOLO si no existe**
export const insertDefaultConfig = async (): Promise<void> => {
  try {
    // Verificar si ya hay configuración
    const countConfig = await getSingleValue<number>(
      "SELECT COUNT(*) FROM Configuracion",
    );

    if (countConfig === 0) {
      console.log("🔧 Insertando configuración por defecto...");

      await db.runAsync(`
        INSERT INTO Configuracion (clave, valor, descripcion) VALUES 
        ('password', 'admin123', 'Contraseña de administrador'),
        ('notificacion_dias', '7', 'Días para notificación de vencimientos'),
        ('porcentaje_onat', '2', 'Porcentaje a pagar a ONAT'),
        ('tasa_ganancia_base', '30', 'Porcentaje base de ganancia para precios'),
        ('dias_alerta_vencimiento', '30', 'Días para alerta de vencimiento'),
        ('prestamo_notificacion_dias', '7', 'Días para notificar préstamos/deudas'),
        ('zona_venta_id', '1', 'ID de la zona de venta'),
        ('zona_almacen_id', '2', 'ID de la zona de almacén')
      `);
      console.log("✅ Configuración por defecto insertada");
    } else {
      console.log(`ℹ️  Configuración ya existe (${countConfig} registros)`);

      // Verificar si existen las configuraciones de zona
      const zonaVentaExiste = await getSingleValue<number>(
        "SELECT COUNT(*) FROM Configuracion WHERE clave = 'zona_venta_id'",
      );

      if (!zonaVentaExiste || zonaVentaExiste === 0) {
        await db.runAsync(`
          INSERT INTO Configuracion (clave, valor, descripcion) VALUES 
          ('zona_venta_id', '1', 'ID de la zona de venta'),
          ('zona_almacen_id', '2', 'ID de la zona de almacén')
        `);
        console.log("✅ Configuraciones de zona insertadas");
      }
    }
  } catch (error) {
    console.error("❌ Error insertando configuración:", error);
  }
};

// **FUNCIÓN PARA DIAGNÓSTICO (útil para debugging)**
export const diagnosticarBaseDatos = async (): Promise<{
  tablas: string[];
  prestamos: number;
  productos: number;
  puntos: number;
  almacenzona: number;
  configuracion: number;
  integridad: boolean;
}> => {
  try {
    console.log("🩺 EJECUTANDO DIAGNÓSTICO DE BASE DE DATOS...");

    // Obtener todas las tablas
    const tablasResult = await executeQuery<any>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const tablas = tablasResult.map((t: any) => t.name);

    console.log("📋 Tablas encontradas:", tablas);

    // Contar registros en cada tabla importante
    const prestamos =
      (await getSingleValue<number>("SELECT COUNT(*) FROM PrestamoDeuda")) || 0;
    const productos =
      (await getSingleValue<number>("SELECT COUNT(*) FROM Producto")) || 0;
    const puntos =
      (await getSingleValue<number>("SELECT COUNT(*) FROM Punto")) || 0;
    const almacenzona =
      (await getSingleValue<number>("SELECT COUNT(*) FROM AlmacenZona")) || 0;
    const configuracion =
      (await getSingleValue<number>("SELECT COUNT(*) FROM Configuracion")) || 0;

    // Verificar integridad básica
    const integridad =
      (await verificarTablaExiste("AlmacenZona")) &&
      (await verificarTablaExiste("Producto"));

    console.log("📊 ESTADÍSTICAS:");
    console.log(`   • Préstamos/Deudas: ${prestamos}`);
    console.log(`   • Productos: ${productos}`);
    console.log(`   • Puntos: ${puntos}`);
    console.log(`   • Productos en zonas: ${almacenzona}`);
    console.log(`   • Configuración: ${configuracion}`);
    console.log(`   • Integridad: ${integridad ? "✅ OK" : "❌ PROBLEMA"}`);

    // Mostrar estructura de AlmacenZona
    if (await verificarTablaExiste("AlmacenZona")) {
      const estructura = await executeQuery<any>(
        "PRAGMA table_info(AlmacenZona)",
      );
      console.log("🏪 Estructura de AlmacenZona:");
      estructura.forEach((col: any) => {
        console.log(`   • ${col.name} (${col.type}) ${col.pk ? "PK" : ""}`);
      });
    }

    return {
      tablas,
      prestamos,
      productos,
      puntos,
      almacenzona,
      configuracion,
      integridad,
    };
  } catch (error) {
    console.error("💥 Error en diagnóstico:", error);
    return {
      tablas: [],
      prestamos: 0,
      productos: 0,
      puntos: 0,
      almacenzona: 0,
      configuracion: 0,
      integridad: false,
    };
  }
};

// **FUNCIÓN DE EMERGENCIA: Reparar base de datos**
export const repararBaseDatos = async (): Promise<boolean> => {
  try {
    console.log("🛠️  INICIANDO REPARACIÓN DE EMERGENCIA...");

    // 1. Crear tablas básicas si no existen
    await initDatabase();

    // 2. Verificar PrestamoDeuda
    const existePrestamoDeuda = await verificarTablaExiste("PrestamoDeuda");

    if (!existePrestamoDeuda) {
      await createPrestamoDeudaTableSegura();
      console.log("✅ Tabla PrestamoDeuda reparada");
    }

    // 3. Verificar PrestamoProductos
    const existePrestamoProductos =
      await verificarTablaExiste("PrestamoProductos");

    if (!existePrestamoProductos) {
      await createPrestamoProductosTableSegura();
      console.log("✅ Tabla PrestamoProductos reparada");
    }

    // 4. Verificar AlmacenProducto
    const existeAlmacenProducto = await verificarTablaExiste("AlmacenProducto");

    if (!existeAlmacenProducto) {
      await createAlmacenProductoTableSegura();
      console.log("✅ Tabla AlmacenProducto reparada");
    }

    // 5. Verificar Gastos
    const existeGastos = await verificarTablaExiste("Gastos");

    if (!existeGastos) {
      await createGastosTableSegura();
      console.log("✅ Tabla Gastos reparada");
    }

    // 6. Verificar AlmacenZona
    const existeAlmacenZona = await verificarTablaExiste("AlmacenZona");

    if (!existeAlmacenZona) {
      await createAlmacenZonaTable();
      console.log("✅ Tabla AlmacenZona reparada");
    }

    console.log("🎉 Base de datos reparada exitosamente");
    return true;
  } catch (error) {
    console.error("💥 Error reparando base de datos:", error);
    return false;
  }
};

// Transferir desde almacén general a zona de venta de un punto
export const transferirAlmacenAZonaVenta = async (
  productoId: number,
  puntoId: number,
  cantidad: number,
  precioVenta: number,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Verificar stock en almacén general
    const stockAlmacen = await getSingleValue<number>(
      "SELECT cantidad FROM Almacen WHERE producto_id = ?",
      [productoId],
    );

    if (!stockAlmacen || stockAlmacen < cantidad) {
      return {
        success: false,
        message: `Stock insuficiente en almacén general. Disponible: ${stockAlmacen || 0} unidades`,
      };
    }

    // Obtener precio costo real
    const producto = await getFirst<Producto>(
      "SELECT precio_coste, nombre FROM Producto WHERE id = ?",
      [productoId],
    );
    if (!producto) {
      return { success: false, message: "Producto no encontrado" };
    }

    const precioCostoReal = producto.precio_coste;
    const ganancia = (precioVenta - precioCostoReal) * cantidad;

    // Iniciar transacción
    await executeNonQuery("BEGIN TRANSACTION");

    try {
      // 1. Reducir cantidad en almacén general
      await executeNonQuery(
        "UPDATE Almacen SET cantidad = cantidad - ? WHERE producto_id = ?",
        [cantidad, productoId],
      );

      // 2. Verificar si existe en zona de venta del punto
      const existeEnZona = await getSingleValue<number>(
        "SELECT COUNT(*) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
        [productoId, puntoId],
      );

      if (existeEnZona && existeEnZona > 0) {
        // Actualizar cantidad en zona de venta
        await executeNonQuery(
          "UPDATE AlmacenZona SET cantidad = cantidad + ?, precio_venta = ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
          [cantidad, precioVenta, productoId, puntoId],
        );
      } else {
        // Insertar nuevo registro en zona de venta
        await executeNonQuery(
          "INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta) VALUES (?, ?, 1, ?, ?)",
          [productoId, puntoId, cantidad, precioVenta],
        );
      }

      // 3. Registrar en historial
      await executeNonQuery(
        "INSERT INTO LogTransferencia (producto_id, punto_id, cantidad, precio_venta, precio_coste_real) VALUES (?, ?, ?, ?, ?)",
        [productoId, puntoId, cantidad, precioVenta, precioCostoReal],
      );

      await executeNonQuery("COMMIT");

      return {
        success: true,
        message: `${cantidad} unidades transferidas a zona de venta`,
      };
    } catch (error) {
      await executeNonQuery("ROLLBACK");
      throw error;
    }
  } catch (error: any) {
    console.error("Error en transferirAlmacenAZonaVenta:", error);
    return {
      success: false,
      message: error.message || "Error al transferir a zona de venta",
    };
  }
};

// Transferir desde almacén del punto a zona de venta del mismo punto
export const transferirInternoAZonaVenta = async (
  productoId: number,
  puntoId: number,
  cantidad: number,
  precioVenta: number,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Verificar stock en almacén del punto (zona_id = 2)
    const stockAlmacenPunto = await getSingleValue<number>(
      "SELECT cantidad FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 2",
      [productoId, puntoId],
    );

    if (!stockAlmacenPunto || stockAlmacenPunto < cantidad) {
      return {
        success: false,
        message: `Stock insuficiente en almacén del punto. Disponible: ${stockAlmacenPunto || 0} unidades`,
      };
    }

    // Obtener precio costo real
    const producto = await getFirst<Producto>(
      "SELECT precio_coste, nombre FROM Producto WHERE id = ?",
      [productoId],
    );
    if (!producto) {
      return { success: false, message: "Producto no encontrado" };
    }

    const precioCostoReal = producto.precio_coste;

    // Iniciar transacción
    await executeNonQuery("BEGIN TRANSACTION");

    try {
      // 1. Reducir cantidad en almacén del punto (zona_id = 2)
      await executeNonQuery(
        "UPDATE AlmacenZona SET cantidad = cantidad - ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 2",
        [cantidad, productoId, puntoId],
      );

      // 2. Verificar si existe en zona de venta (zona_id = 1)
      const existeEnZonaVenta = await getSingleValue<number>(
        "SELECT COUNT(*) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
        [productoId, puntoId],
      );

      if (existeEnZonaVenta && existeEnZonaVenta > 0) {
        // Actualizar cantidad en zona de venta
        await executeNonQuery(
          "UPDATE AlmacenZona SET cantidad = cantidad + ?, precio_venta = ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
          [cantidad, precioVenta, productoId, puntoId],
        );
      } else {
        // Insertar nuevo registro en zona de venta
        await executeNonQuery(
          "INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta) VALUES (?, ?, 1, ?, ?)",
          [productoId, puntoId, cantidad, precioVenta],
        );
      }

      await executeNonQuery("COMMIT");

      return {
        success: true,
        message: `${cantidad} unidades transferidas a zona de venta del mismo punto`,
      };
    } catch (error) {
      await executeNonQuery("ROLLBACK");
      throw error;
    }
  } catch (error: any) {
    console.error("Error en transferirInternoAZonaVenta:", error);
    return {
      success: false,
      message: error.message || "Error al transferir internamente",
    };
  }
};

// Obtener productos en zona de venta de un punto
export const getProductosEnZonaVenta = async (
  puntoId: number,
): Promise<any[]> => {
  try {
    const query = `
      SELECT 
        p.*,
        az.cantidad,
        az.precio_venta,
        (az.precio_venta - p.precio_coste) as ganancia,
        p.precio_coste as precio_coste_real,
        CASE 
          WHEN p.fecha_caducidad IS NULL THEN 'sin_fecha'
          WHEN DATE(p.fecha_caducidad) < DATE('now') THEN 'vencido'
          WHEN JULIANDAY(p.fecha_caducidad) - JULIANDAY('now') <= 30 THEN 'por_vencer_rojo'
          WHEN JULIANDAY(p.fecha_caducidad) - JULIANDAY('now') <= 60 THEN 'por_vencer_naranja'
          ELSE 'seguro'
        END as estado_vencimiento,
        CASE 
          WHEN p.fecha_caducidad IS NULL THEN NULL
          ELSE CAST(JULIANDAY(p.fecha_caducidad) - JULIANDAY('now') AS INTEGER)
        END as dias_restantes
      FROM Producto p
      INNER JOIN AlmacenZona az ON p.id = az.producto_id
      WHERE az.punto_id = ? 
        AND az.zona_id = 1  -- Zona de venta
        AND az.cantidad > 0
      ORDER BY p.nombre
    `;

    return await executeQuery<any>(query, [puntoId]);
  } catch (error) {
    console.error("Error en getProductosEnZonaVenta:", error);
    return [];
  }
};

// Obtener productos en almacén de un punto (zona_id = 2)
export const getProductosEnAlmacenPunto = async (
  puntoId: number,
): Promise<any[]> => {
  try {
    const query = `
      SELECT 
        p.*,
        az.cantidad,
        p.precio_coste as precio_coste_real,
        CASE 
          WHEN p.fecha_caducidad IS NULL THEN 'sin_fecha'
          WHEN DATE(p.fecha_caducidad) < DATE('now') THEN 'vencido'
          WHEN JULIANDAY(p.fecha_caducidad) - JULIANDAY('now') <= 30 THEN 'por_vencer_rojo'
          WHEN JULIANDAY(p.fecha_caducidad) - JULIANDAY('now') <= 60 THEN 'por_vencer_naranja'
          ELSE 'seguro'
        END as estado_vencimiento
      FROM Producto p
      INNER JOIN AlmacenZona az ON p.id = az.producto_id
      WHERE az.punto_id = ? 
        AND az.zona_id = 2  -- Zona de almacén del punto
        AND az.cantidad > 0
      ORDER BY p.nombre
    `;

    return await executeQuery<any>(query, [puntoId]);
  } catch (error) {
    console.error("Error en getProductosEnAlmacenPunto:", error);
    return [];
  }
};

// Helper function for retry with exponential backoff
const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100,
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt} failed:`, error);

      // Check if it's a database locked error
      if (
        error.message?.includes("database is locked") &&
        attempt < maxRetries
      ) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // If it's the last attempt or not a locking error, throw the error
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
};

// **Funciones de base de datos**
export const executeQuery = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T[]> => {
  return executeWithRetry(async () => {
    try {
      const result = await db.getAllAsync(sql, params);
      return result as T[];
    } catch (error) {
      console.error("❌ Error en executeQuery:", error);
      try {
        console.error("❌ SQL:", sql);
        console.error("❌ Params:", params);
      } catch {}
      throw error;
    }
  });
};

export const getFirst = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T | null> => {
  return executeWithRetry(async () => {
    try {
      const result = await db.getFirstAsync(sql, params);
      return result as T | null;
    } catch (error) {
      console.error("❌ Error en getFirst:", error);
      return null;
    }
  });
};

export const getSingleValue = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T | null> => {
  return executeWithRetry(async () => {
    try {
      const result = await db.getFirstAsync(sql, params);
      if (result && typeof result === "object") {
        const keys = Object.keys(result);
        if (keys.length > 0) {
          return (result as any)[keys[0]] as T;
        }
      }
      return result as T | null;
    } catch (error) {
      console.error("❌ Error en getSingleValue:", error);
      return null;
    }
  });
};

export const executeNonQuery = async (
  sql: string,
  params: any[] = [],
): Promise<SQLiteRunResult> => {
  return executeWithRetry(async () => {
    try {
      const result = await db.runAsync(sql, params);
      return {
        lastInsertRowId: result.lastInsertRowId,
        changes: result.changes,
      };
    } catch (error) {
      console.error("❌ Error en executeNonQuery:", error);
      throw error;
    }
  });
};

export const calcularGanancia = async (
  precioVenta: number,
  productoId: number,
): Promise<number> => {
  try {
    const result = await getFirst<Producto>(
      "SELECT precio_coste FROM Producto WHERE id = ?",
      [productoId],
    );
    if (result?.precio_coste) {
      return precioVenta - result.precio_coste;
    }
    return 0;
  } catch (error) {
    console.error("❌ Error calculando ganancia:", error);
    return 0;
  }
};

// **Funciones para Gastos Manuales**
export const guardarGastoManual = async (
  puntoId: number,
  año: number,
  mes: number,
  dia: number,
  monto: number,
  descripcion: string = "",
): Promise<boolean> => {
  try {
    console.log(
      `💾 Intentando guardar gasto manual: puntoId=${puntoId}, año=${año}, mes=${mes}, dia=${dia}, monto=${monto}`,
    );

    await executeNonQuery(
      `
      INSERT OR REPLACE INTO GastosManuales 
      (punto_id, año, mes, dia, monto, descripcion, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
      [puntoId, año, mes, dia, monto, descripcion],
    );

    console.log(
      `✅ Gasto manual guardado exitosamente: ${año}-${mes}-${dia} = $${monto}`,
    );

    // Verificación inmediata
    const verificacion = await executeQuery(
      "SELECT * FROM GastosManuales WHERE punto_id = ? AND año = ? AND mes = ? AND dia = ?",
      [puntoId, año, mes, dia],
    );
    console.log(
      `🔍 Verificación: Se encontraron ${verificacion.length} registros para el gasto guardado:`,
      verificacion,
    );

    return true;
  } catch (error) {
    console.error("❌ Error guardando gasto manual:", error);
    return false;
  }
};

export const obtenerGastosManuales = async (
  puntoId: number,
  año: number,
): Promise<any[]> => {
  try {
    const gastos = await executeQuery(
      `
      SELECT mes, dia, monto, descripcion
      FROM GastosManuales
      WHERE punto_id = ? AND año = ?
      ORDER BY mes, dia
    `,
      [puntoId, año],
    );

    return gastos;
  } catch (error) {
    console.error("❌ Error obteniendo gastos manuales:", error);
    return [];
  }
};

export const eliminarGastoManual = async (
  puntoId: number,
  año: number,
  mes: number,
  dia: number,
): Promise<boolean> => {
  try {
    await executeNonQuery(
      `
      DELETE FROM GastosManuales
      WHERE punto_id = ? AND año = ? AND mes = ? AND dia = ?
    `,
      [puntoId, año, mes, dia],
    );

    console.log(`✅ Gasto manual eliminado: ${año}-${mes}-${dia}`);
    return true;
  } catch (error) {
    console.error("❌ Error eliminando gasto manual:", error);
    return false;
  }
};

// === FUNCIÓN TEMPORAL PARA LIMPIEZA COMPLETA ===
// USAR SOLO PARA DESARROLLO/DEBUG
export const limpiarTablaCierreCaja = async (): Promise<boolean> => {
  try {
    console.log("🧹 Iniciando limpieza completa de la tabla CierreCaja...");

    // Primero verificamos cuántos registros hay
    const antes = await executeQuery(
      "SELECT COUNT(*) as total FROM CierreCaja",
    );
    console.log(`📊 Registros antes de limpiar: ${antes[0]?.total || 0}`);

    // Mostramos los registros que se van a eliminar
    const registrosAEliminar = await executeQuery(
      "SELECT id, tipo, fecha_cierre, fondo_caja, observaciones FROM CierreCaja ORDER BY fecha_cierre DESC",
    );
    console.log("🗑️ Registros a eliminar:", registrosAEliminar);

    // Eliminamos todos los registros
    await executeNonQuery("DELETE FROM CierreCaja");

    // Verificamos que se eliminaron todos
    const despues = await executeQuery(
      "SELECT COUNT(*) as total FROM CierreCaja",
    );
    console.log(`✅ Registros después de limpiar: ${despues[0]?.total || 0}`);

    // Reiniciamos el contador de auto-incremento (opcional)
    await executeNonQuery(
      "DELETE FROM sqlite_sequence WHERE name='CierreCaja'",
    );

    console.log("🧹 Limpieza completada exitosamente");
    return true;
  } catch (error) {
    console.error("❌ Error limpiando tabla CierreCaja:", error);
    return false;
  }
};

// **Funciones para Ingresos Ajustados**
export const guardarIngresosAjustados = async (
  puntoId: number,
  año: number,
  mes: number,
  dia: number,
  montoOriginal: number,
  montoAjustado: number,
  multiplicadorAplicado: number,
  descripcion: string = "",
): Promise<boolean> => {
  try {
    console.log(
      `💾 Guardando ingreso ajustado: puntoId=${puntoId}, año=${año}, mes=${mes}, dia=${dia}, original=${montoOriginal}, ajustado=${montoAjustado}`,
    );

    await executeNonQuery(
      `
      INSERT OR REPLACE INTO IngresosAjustados 
      (punto_id, año, mes, dia, monto_original, monto_ajustado, multiplicador_aplicado, descripcion, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
      [
        puntoId,
        año,
        mes,
        dia,
        montoOriginal,
        montoAjustado,
        multiplicadorAplicado,
        descripcion,
      ],
    );

    console.log(
      `✅ Ingreso ajustado guardado exitosamente: ${año}-${mes}-${dia} = $${montoAjustado}`,
    );
    return true;
  } catch (error) {
    console.error("❌ Error guardando ingreso ajustado:", error);
    return false;
  }
};

export const obtenerIngresosAjustados = async (
  puntoId: number,
  año: number,
  mes?: number,
): Promise<any[]> => {
  try {
    let query = `
      SELECT mes, dia, monto_original, monto_ajustado, multiplicador_aplicado, descripcion
      FROM IngresosAjustados
      WHERE punto_id = ? AND año = ?
    `;
    let params: any[] = [puntoId, año];

    if (mes !== undefined) {
      query += " AND mes = ?";
      params.push(mes);
    }

    query += " ORDER BY mes, dia";

    const ingresosAjustados = await executeQuery(query, params);
    console.log(
      `📊 Se encontraron ${ingresosAjustados.length} ingresos ajustados para puntoId=${puntoId}, año=${año}${mes !== undefined ? `, mes=${mes}` : ""}`,
    );

    return ingresosAjustados;
  } catch (error) {
    console.error("❌ Error obteniendo ingresos ajustados:", error);
    return [];
  }
};

export const eliminarIngresosAjustados = async (
  puntoId: number,
  año: number,
  mes?: number,
): Promise<boolean> => {
  try {
    let query = "DELETE FROM IngresosAjustados WHERE punto_id = ? AND año = ?";
    let params: any[] = [puntoId, año];

    if (mes !== undefined) {
      query += " AND mes = ?";
      params.push(mes);
    }

    await executeNonQuery(query, params);
    console.log(
      `🗑️ Ingresos ajustados eliminados para puntoId=${puntoId}, año=${año}${mes !== undefined ? `, mes=${mes}` : ""}`,
    );

    return true;
  } catch (error) {
    console.error("❌ Error eliminando ingresos ajustados:", error);
    return false;
  }
};

export const tieneIngresosAjustados = async (
  puntoId: number,
  año: number,
  mes?: number,
): Promise<boolean> => {
  try {
    let query =
      "SELECT COUNT(*) as total FROM IngresosAjustados WHERE punto_id = ? AND año = ?";
    let params: any[] = [puntoId, año];

    if (mes !== undefined) {
      query += " AND mes = ?";
      params.push(mes);
    }

    const result = await executeQuery(query, params);
    const total = result[0]?.total || 0;

    return total > 0;
  } catch (error) {
    console.error("❌ Error verificando ingresos ajustados:", error);
    return false;
  }
};

// Exportar la instancia de la base de datos
export { db };

// Para uso en desarrollo
export const initDB = initDatabase;
