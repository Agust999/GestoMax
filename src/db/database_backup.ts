// src/database/database.ts
import * as SQLite from "expo-sqlite";

// Tipos para los resultados
export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  fecha_caducidad: string | null;
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
const verificarTablaExiste = async (nombreTabla: string): Promise<boolean> => {
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

// **CREAR TABLA Gastos de forma SEGURA (NO borra datos)**
const createGastosTableSegura = async (): Promise<void> => {
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
          tipo TEXT NOT NULL CHECK(tipo IN ('casual', 'pasivo')) DEFAULT 'casual',
          categoria TEXT DEFAULT 'general',
          descripcion TEXT,
          fecha_gasto DATE NOT NULL,
          recurrente BOOLEAN DEFAULT FALSE,
          periodicidad TEXT CHECK(periodicidad IN ('diario', 'semanal', 'mensual')),
          activo BOOLEAN DEFAULT TRUE,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
        )
      `);
      console.log("✅ Tabla Gastos CREADA NUEVA");
    } else {
      // La tabla ya existe - verificar y agregar columnas faltantes
      console.log("ℹ️  Tabla Gastos YA EXISTE, verificando columnas...");

      // Verificar si la columna 'activo' existe
      const columnaActivo = await verificarColumnaExiste("Gastos", "activo");
      if (!columnaActivo) {
        await db.execAsync(
          `ALTER TABLE Gastos ADD COLUMN activo BOOLEAN DEFAULT TRUE`,
        );
        console.log("✅ Columna 'activo' agregada a Gastos");
      }

      // Verificar si la columna 'precio' existe
      const columnaPrecio = await verificarColumnaExiste("Gastos", "precio");
      if (!columnaPrecio) {
        await db.execAsync(
          `ALTER TABLE Gastos ADD COLUMN precio REAL NOT NULL DEFAULT 0`,
        );
        console.log("✅ Columna 'precio' agregada a Gastos");
      }

      // Verificar otras columnas que podrían faltar
      const columnasRequeridas = [
        "tipo",
        "categoria",
        "descripcion",
        "fecha_gasto",
        "recurrente",
        "periodicidad",
        "creado_en",
        "actualizado_en",
      ];

      for (const columna of columnasRequeridas) {
        const existe = await verificarColumnaExiste("Gastos", columna);
        if (!existe) {
          let definicion = "";
          switch (columna) {
            case "tipo":
              definicion = `TEXT NOT NULL CHECK(tipo IN ('casual', 'pasivo')) DEFAULT 'casual'`;
              break;
            case "categoria":
              definicion = `TEXT DEFAULT 'general'`;
              break;
            case "descripcion":
              definicion = `TEXT`;
              break;
            case "fecha_gasto":
              definicion = `DATE NOT NULL`;
              break;
            case "recurrente":
              definicion = `BOOLEAN DEFAULT FALSE`;
              break;
            case "periodicidad":
              definicion = `TEXT CHECK(periodicidad IN ('diario', 'semanal', 'mensual'))`;
              break;
            case "creado_en":
              definicion = `DATETIME DEFAULT CURRENT_TIMESTAMP`;
              break;
            case "actualizado_en":
              definicion = `DATETIME DEFAULT CURRENT_TIMESTAMP`;
              break;
          }
          await db.execAsync(
            `ALTER TABLE Gastos ADD COLUMN ${columna} ${definicion}`,
          );
          console.log(`✅ Columna '${columna}' agregada a Gastos`);
        }
      }

      console.log("✅ Verificación de columnas de Gastos completada");
    }
  } catch (error) {
    console.error("❌ Error creando tabla Gastos:", error);
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
      await execAsyncWithRetry(`
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
      await execAsyncWithRetry(`
        CREATE INDEX IF NOT EXISTS idx_prestamo_productos_prestamo_deuda_id ON PrestamoProductos(prestamo_deuda_id);
        CREATE INDEX IF NOT EXISTS idx_prestamo_productos_producto_id ON PrestamoProductos(producto_id);
      `);
      console.log("✅ Índices de PrestamoProductos creados/verificados");
    }

    // Índices para AlmacenZona (solo si la tabla existe)
    const existeAlmacenZona = await verificarTablaExiste("AlmacenZona");
const waitForDatabaseUnlock = async (
  maxWaitTime: number = 10000,
  checkInterval: number = 500,
): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Intentar una operación simple para verificar si la BD está desbloqueada
      await getFirst("SELECT 1");
      return true; // Si funciona, la BD está desbloqueada
    } catch (error: any) {
      if (error.message.includes("database is locked") || 
          error.message.includes("locked")) {
        console.log(` Esperando desbloqueo de BD... (${Math.round((Date.now() - startTime) / 1000)}s)`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      } else {
        // Otro tipo de error, no es de bloqueo
        return false;
      }
    }
  }
  
  return false; // Tiempo de espera agotado
};

// Función para forzar cierre de conexiones pendientes
const forceDatabaseCleanup = async (): Promise<void> => {
  try {
    // Intentar ejecutar un PRAGMA para forzar limpieza
    await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
    console.log(" Limpieza de BD forzada");
  } catch (error) {
    console.debug("No se pudo forzar limpieza:", error);
  }
};

// Función execAsync segura con reintentos y recuperación agresiva
export const execAsyncWithRetry = async (
  sql: string,
  maxRetries: number = 8,
  initialDelay: number = 500,
): Promise<void> => {
  let intentos = 0;
  let esperaMs = initialDelay;

  // Primero, esperar a que la BD se desbloquee
  console.log("⏳ Esperando que la base de datos esté disponible...");
  const isUnlocked = await waitForDatabaseUnlock(8000, 1000);

  if (!isUnlocked) {
    console.warn(
      "⚠️ La base de datos permanece bloqueada, intentando limpieza forzada...",
    );
    await forceDatabaseCleanup();

    // Reintentar la espera después de la limpieza
    const stillLocked = !(await waitForDatabaseUnlock(5000, 1000));
    if (stillLocked) {
      throw new Error(
        "No se pudo desbloquear la base de datos después de limpieza forzada",
      );
    }
  }

  while (intentos < maxRetries) {
    try {
      await db.execAsync(sql);
      console.log("✅ Operación execAsync completada");
      return; // Éxito, salir de la función
    } catch (error: any) {
      intentos++;

      if (
        error instanceof Error &&
        (error.message.includes("database is locked") ||
          error.message.includes("locked"))
      ) {
        console.error(
          `❌ Error en execAsync (intento ${intentos}/${maxRetries}):`,
          error,
        );

        if (intentos < maxRetries) {
          console.log(
            ` Base de datos bloqueada, reintentando en ${esperaMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, esperaMs));

          // Espera más agresiva: aumentar más rápido
          esperaMs = Math.min(esperaMs * 2, 3000);

          // Intentar esperar desbloqueo antes del siguiente intento
          await waitForDatabaseUnlock(2000, 500);
          continue;
        } else {
          console.error("❌ Máximo de intentos alcanzado en execAsync");

          // Último intento: forzar limpieza y esperar más tiempo
          console.log(" Intentando recuperación de emergencia...");
          await forceDatabaseCleanup();
          await waitForDatabaseUnlock(5000, 1000);

          // Reintentar una última vez
          try {
            await db.execAsync(sql);
            console.log("✅ Operación recuperada exitosamente");
            return;
          } catch (finalError: any) {
            throw new Error(
              `Base de datos bloqueada después de ${maxRetries} intentos y recuperación: ${finalError.message}`,
            );
          }
        }
      }

      // Si no es un error de bloqueo, lanzar el error inmediatamente
      console.error("❌ Error en execAsync:", error);
      throw error;
    }
  }
};

// **FUNCIÓN PRINCIPAL: Inicializar base de datos SIN perder datos**
export const initDatabase = async (): Promise<boolean> => {
  try {
    console.log("🚀 INICIANDO BASE DE DATOS (MODO SEGURO)...");

    // **PASO 1: Crear tablas básicas SIN borrar**
    await execAsyncWithRetry(`
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

    // **PASO 2: Crear PrestamoDeuda (MODO SEGURO - NO BORRA)**
    await createPrestamoDeudaTableSegura();

    // **PASO 3: Crear PrestamoProductos (MODO SEGURO)**
    await createPrestamoProductosTableSegura();

    // **PASO 3.5: Crear AlmacenProducto (MODO SEGURO)**
    await createAlmacenProductoTableSegura();

    // **PASO 3.6: Crear Gastos (MODO SEGURO)**
    await createGastosTableSegura();

    // **PASO 4: Crear el resto de tablas (SIN borrar)**
    await execAsyncWithRetry(`
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
        metodo_transferencia TEXT CHECK(metodo_transferencia IN ('ENZONA', 'TRANSFERMOVIL', 'Tarjeta', NULL)),
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
        metodo_transferencia TEXT CHECK(metodo_transferencia IN ('ENZONA', 'TRANSFERMOVIL', 'Tarjeta', NULL)),
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
        total_ventas REAL NOT NULL DEFAULT 0,
        total_efectivo REAL NOT NULL DEFAULT 0,
        total_transferencia REAL NOT NULL DEFAULT 0,
        total_gastos REAL NOT NULL DEFAULT 0,
        total_ganancias REAL NOT NULL DEFAULT 0,
        observaciones TEXT,
        fecha_cierre DATETIME DEFAULT CURRENT_TIMESTAMP,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );

      -- Tabla: Oferta
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
        FOREIGN KEY (producto_id) REFERENCES Producto(id) ON DELETE CASCADE,
        FOREIGN KEY (punto_id) REFERENCES Punto(id) ON DELETE CASCADE
      );
    `);
    console.log("✅ Todas las tablas verificadas");

    // **PASO 5: Crear tabla AlmacenZona**
    await createAlmacenZonaTable();

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

    // **PASO 7: Crear índices (MODO SEGURO)**
    await createIndicesSeguros();

    // **PASO 8: Insertar configuración solo si no existe**
    await insertDefaultConfig();

    // **PASO 9: Verificar integridad de datos**
    await verificarIntegridadDatos();

    console.log("🎉 Base de datos completamente inicializada y SEGURA");
    return true;
  } catch (error) {
    console.error("💥 Error crítico inicializando base de datos:", error);
    return false;
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
      console.log("⚠️  Tabla PrestamoDeuda perdida, recreando...");
      await createPrestamoDeudaTableSegura();
    }

    // 3. Verificar PrestamoProductos
    const existePrestamoProductos =
      await verificarTablaExiste("PrestamoProductos");
    if (!existePrestamoProductos) {
      console.log("⚠️  Tabla PrestamoProductos perdida, recreando...");
      await createPrestamoProductosTableSegura();
    }

    // 4. Verificar AlmacenZona
    const existeAlmacenZona = await verificarTablaExiste("AlmacenZona");
    if (!existeAlmacenZona) {
      console.log("⚠️  Tabla AlmacenZona perdida, recreando...");
      await createAlmacenZonaTable();
    }

    // 5. Verificar Gastos
    const existeGastos = await verificarTablaExiste("Gastos");
    if (!existeGastos) {
      console.log("⚠️  Tabla Gastos perdida, recreando...");
      await createGastosTableSegura();
    }

    // 6. Volver a crear índices
    await createIndicesSeguros();

    console.log("✅ Reparación completada");
    return true;
  } catch (error) {
    console.error("💥 Error en reparación:", error);
    return false;
  }
};

// **FUNCIONES DE TRANSFERENCIA A ZONA DE VENTA**

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

export const executeQuery = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T[]> => {
  try {
    const result = await db.getAllAsync(sql, params);
    return result as T[];
  } catch (error) {
    console.error("❌ Error en executeQuery:", error);
    try {
      console.error("❌ SQL:", sql);
      console.error("❌ Params:", params);
    } catch (e) {
      // Ignorar errores al intentar loguear
    }
    throw error;
  }
};

export const getFirst = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T | null> => {
  try {
    const result = await db.getFirstAsync(sql, params);
    return result as T | null;
  } catch (error) {
    console.error("❌ Error en getFirst:", error);
    return null;
  }
};

export const getSingleValue = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T | null> => {
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
};

// Exportar la instancia de la base de datos
export { createGastosTableSegura, db, verificarTablaExiste };

// Para uso en desarrollo
export const initDB = initDatabase;

// Sistema de cola para serializar operaciones de base de datos
let dbQueue: Promise<any> = Promise.resolve();

// Función para ejecutar operaciones en cola
export const executeInQueue = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  dbQueue = dbQueue
    .then(async () => {
      return await operation();
    })
    .catch(() => {
      // Ignorar errores de operaciones anteriores en la cola
    });

  return await dbQueue;
};

// Función mejorada para ejecutar non-query con manejo de transacciones simplificado
export const executeNonQuery = async (
  sql: string,
  params: any[] = [],
): Promise<SQLiteRunResult> => {
  return await executeInQueue(async () => {
    let intentos = 0;
    const maxIntentos = 5; // Aumentado a 5 intentos
    let esperaMs = 300; // Reducido a 300ms inicial
    let statement: any = null;

    while (intentos < maxIntentos) {
      try {
        // Para operaciones que no son de control de transacciones,
        // envolverlas en una transacción automática si no hay una activa
        const esControlTransaccion =
          sql.trim().toUpperCase().startsWith("BEGIN") ||
          sql.trim().toUpperCase().startsWith("COMMIT") ||
          sql.trim().toUpperCase().startsWith("ROLLBACK");

        if (!esControlTransaccion) {
          // Verificar si ya hay una transacción activa
          try {
            const txStatus = await getFirst("PRAGMA transaction_status");
            const enTransaccion =
              txStatus && (txStatus as any).transaction_status === 1;

            if (!enTransaccion) {
              // Iniciar transacción automática para operaciones individuales
              await db.runAsync("BEGIN IMMEDIATE");
              statement = await db.prepareAsync(sql);
              const result = await statement.executeAsync(params);
              await statement.finalizeAsync();
              await db.runAsync("COMMIT");

              return {
                lastInsertRowId: result.lastInsertRowId,
                changes: result.changes,
              };
            }
          } catch (pragmaError) {
            // Si falla el PRAGMA, continuar sin verificación de transacción
            console.debug(
              "No se pudo verificar estado de transacción:",
              pragmaError,
            );
          }
        }

        // Ejecución normal (con o sin transacción manual)
        statement = await db.prepareAsync(sql);
        const result = await statement.executeAsync(params);
        await statement.finalizeAsync();

        return {
          lastInsertRowId: result.lastInsertRowId,
          changes: result.changes,
        };
      } catch (error) {
        // Asegurar que el statement se libere si hay error
        if (statement) {
          try {
            await statement.finalizeAsync();
          } catch (finalizeError) {
            // Ignorar error al finalizar
          }
          statement = null;
        }

        intentos++;

        if (
          error instanceof Error &&
          (error.message.includes("database is locked") ||
            error.message.includes("NativeStatement.finalizeAsync") ||
            error.message.includes("locked"))
        ) {
          console.error(
            `❌ Error en executeNonQuery (intento ${intentos}/${maxIntentos}):`,
            error,
          );
          console.error("❌ SQL:", sql);
          console.error("❌ Params:", params);

          if (intentos < maxIntentos) {
            console.log(
              `🔄 Base de datos bloqueada, reintentando en ${esperaMs}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, esperaMs));
            esperaMs = Math.min(esperaMs * 1.5, 2000); // Espera exponencial pero máx 2s
            continue;
          } else {
            console.error("❌ Máximo de intentos alcanzado, operación fallida");
            throw new Error(
              `Base de datos bloqueada después de ${maxIntentos} intentos: ${error.message}`,
            );
          }
        }

        // Si no es un error de bloqueo, lanzar el error inmediatamente
        console.error("❌ Error en executeNonQuery:", error);
        throw error;
      }
    }

    // Esto nunca debería alcanzarse, pero TypeScript lo requiere
    throw new Error("Error inesperado en executeNonQuery");
  });
};

// Función para ejecutar operaciones dentro de una transacción segura
export const executeInTransaction = async <T>(
  operations: () => Promise<T>,
): Promise<T> => {
  let transactionStarted = false;

  try {
    await executeNonQuery("BEGIN TRANSACTION");
    transactionStarted = true;

    const result = await operations();

    await executeNonQuery("COMMIT");
    console.log("✅ Transacción completada exitosamente");

    return result;
  } catch (error) {
    console.error("❌ Error en transacción:", error);

    if (transactionStarted) {
      try {
        await executeNonQuery("ROLLBACK");
        console.log("🔄 Rollback ejecutado");
      } catch (rollbackError) {
        console.error("❌ Error en ROLLBACK:", rollbackError);
      }
    }

    throw error;
  }
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
