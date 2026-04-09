import { getFechaLocal } from "../../utils/dateUtils";
import {
    executeNonQuery,
    executeQuery,
    getFirst,
    getSingleValue,
} from "../database";
import { AlmacenService } from "./almacen_service";

// Interfaz local para ProductoAlmacen
export interface ProductoAlmacen {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  precio_coste_real?: number;
  precio_coste_promedio?: number;
  fecha_caducidad?: string;
  cantidad: number;
  total_costo?: number;
  dias_restantes?: number;
  estado_vencimiento?:
    | "vencido"
    | "por_vencer_rojo"
    | "por_vencer_naranja"
    | "seguro";
  ubicacion?: string;
  creado_en?: string;
  actualizado_en?: string;
  zona_id?: number;
  formato_almacen?: string;
  unidades_por_formato?: number;
  cantidad_inicial?: number;
}

export class ProductoService {
  // Helper function para insertar HistorialInventario
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
      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

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
          notas,
          creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          ahora,
        ],
      );
    } catch (error) {
      console.error("Error insertando en HistorialInventario:", error);
      throw error;
    }
  }

  // 1. OBTENER TODOS LOS PRODUCTOS (SOLO DATOS BÁSICOS)
  static async getAllProductos(limit?: number): Promise<any[]> {
    try {
      const limitClause = limit ? ` LIMIT ${limit}` : "";
      const query = `SELECT * FROM Producto ORDER BY nombre${limitClause}`;
      return await executeQuery<any>(query);
    } catch (error) {
      console.error("Error en ProductoService.getAllProductos:", error);
      return [];
    }
  }

  // 2. OBTENER PRODUCTO POR ID (CON DATOS REALES)
  static async getProductoById(id: number): Promise<any | null> {
    try {
      return await getFirst<any>("SELECT * FROM Producto WHERE id = ?", [id]);
    } catch (error) {
      console.error("Error en ProductoService.getProductoById:", error);
      return null;
    }
  }

  // 3. CREAR PRODUCTO (GUARDAR PRECIO COSTO REAL Y FORMATO)
  static async createProducto(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
    descripcion?: string,
  ): Promise<any> {
    try {
      const result = await executeNonQuery(
        `INSERT INTO Producto (nombre, categoria, subcategoria, precio_coste, fecha_caducidad, formato_almacen, unidades_por_formato, descripcion) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nombre,
          categoria,
          subcategoria,
          precio_coste,
          fecha_caducidad || null,
          formato_almacen || null,
          unidades_por_formato || null,
          descripcion || null,
        ],
      );
      return result;
    } catch (error) {
      console.error("Error en ProductoService.createProducto:", error);
      throw error;
    }
  }

  // 4. ACTUALIZAR PRODUCTO
  static async updateProducto(
    id: number,
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    descripcion?: string,
  ): Promise<any> {
    try {
      // Obtener información actual del producto antes de actualizar
      const productoActual = await getFirst<any>(
        "SELECT * FROM Producto WHERE id = ?",
        [id],
      );

      // Registrar actualización en HistorialInventario
      await this.insertarHistorialInventario(
        id,
        null, // almacen_id (null para actualización general)
        null, // punto_id
        null, // zona_id
        "ajuste", // tipo_movimiento
        0, // cantidad_variación (no hay cambio de stock)
        0, // stock_anterior (no aplica para actualización de datos)
        0, // stock_nuevo (no aplica para actualización de datos)
        "Actualización de datos",
        `Producto actualizado: ${productoActual?.nombre || "Desconocido"} → ${nombre}. Precio: ${productoActual?.precio_coste || 0} → ${precio_coste}`,
      );

      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const result = await executeNonQuery(
        `UPDATE Producto 
         SET nombre = ?, categoria = ?, subcategoria = ?, 
             precio_coste = ?, fecha_caducidad = ?, 
             formato_almacen = ?, unidades_por_formato = ?,
             descripcion = ?, actualizado_en = ? 
         WHERE id = ?`,
        [
          nombre,
          categoria,
          subcategoria,
          precio_coste,
          fecha_caducidad || null,
          formato_almacen || null,
          unidades_por_formato || null,
          descripcion || null,
          ahora,
          id,
        ],
      );
      return result;
    } catch (error) {
      console.error("Error en ProductoService.updateProducto:", error);
      throw error;
    }
  }

  // 5. ELIMINAR PRODUCTO
  static async deleteProducto(id: number): Promise<any> {
    try {
      // Obtener información del producto antes de eliminar
      const producto = await getFirst<any>(
        "SELECT nombre, COALESCE(SUM(a.cantidad), 0) as stock_total FROM Producto p LEFT JOIN Almacen a ON p.id = a.producto_id WHERE p.id = ?",
        [id],
      );

      // Obtener stock por ubicación antes de eliminar
      const stockAlmacen =
        (await getSingleValue<number>(
          "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
          [id],
        )) || 0;

      const stockAlmacenPuntos =
        (await getSingleValue<number>(
          "SELECT COALESCE(SUM(cantidad), 0) FROM AlmacenPunto WHERE producto_id = ?",
          [id],
        )) || 0;

      const stockZonas =
        (await getSingleValue<number>(
          "SELECT COALESCE(SUM(cantidad), 0) FROM AlmacenZona WHERE producto_id = ?",
          [id],
        )) || 0;

      const stockTotal = stockAlmacen + stockAlmacenPuntos + stockZonas;

      // Registrar eliminación en HistorialInventario
      await this.insertarHistorialInventario(
        id,
        null, // almacen_id (eliminación general)
        null, // punto_id
        null, // zona_id
        "merma", // tipo_movimiento (usamos merma para eliminación)
        -stockTotal, // cantidad_variación negativa
        stockTotal, // stock_anterior
        0, // stock_nuevo
        "Eliminación de producto",
        `Producto "${producto?.nombre || "Desconocido"}" eliminado con ${stockTotal} unidades totales`,
      );

      await executeNonQuery("DELETE FROM AlmacenPunto WHERE producto_id = ?", [
        id,
      ]);
      await executeNonQuery("DELETE FROM Almacen WHERE producto_id = ?", [id]);
      const result = await executeNonQuery(
        "DELETE FROM Producto WHERE id = ?",
        [id],
      );
      return result;
    } catch (error) {
      console.error("Error en ProductoService.deleteProducto:", error);
      throw error;
    }
  }

  // 6. OBTENER SUBCATEGORÍAS ÚNICAS
  static async getSubcategoriasUnicas(categoria?: string): Promise<string[]> {
    try {
      let query = "SELECT DISTINCT subcategoria FROM Producto";
      const params: any[] = [];

      if (categoria) {
        query += " WHERE categoria = ?";
        params.push(categoria);
      }

      query += " ORDER BY subcategoria";

      const subcategorias = await executeQuery<any>(query, params);
      return subcategorias.map((s: any) => s.subcategoria);
    } catch (error) {
      console.error("Error en ProductoService.getSubcategoriasUnicas:", error);
      return [];
    }
  }

  // 7. OBTENER STOCK TOTAL UNIFICADO
  static async getStockTotalUnificado(
    nombre: string,
    fecha_caducidad?: string,
    puntoId?: number,
    zonaId?: number,
  ): Promise<number> {
    try {
      console.log(
        `📊 CALCULANDO STOCK TOTAL para: ${nombre}, fecha: ${fecha_caducidad}, punto: ${puntoId}, zona: ${zonaId}`,
      );

      let query = `
        SELECT COALESCE(SUM(cantidad), 0) as total
        FROM Producto p
        INNER JOIN Almacen a ON p.id = a.producto_id
        WHERE TRIM(p.nombre) = TRIM(?)
      `;

      const params: any[] = [nombre];

      // Agregar filtro por fecha de caducidad si se proporciona
      if (fecha_caducidad) {
        query += ` AND (p.fecha_caducidad IS NULL AND ? IS NULL OR p.fecha_caducidad = ?)`;
        params.push(fecha_caducidad || null, fecha_caducidad);
      } else {
        query += ` AND p.fecha_caducidad IS NULL`;
      }

      // Agregar filtros por punto y zona si se proporcionan
      if (puntoId && zonaId) {
        query = `
          SELECT COALESCE(SUM(cantidad), 0) as total
          FROM Producto p
          INNER JOIN AlmacenZona az ON p.id = az.producto_id
          WHERE TRIM(p.nombre) = TRIM(?)
          AND az.punto_id = ?
          AND az.zona_id = ?
        `;

        const paramsZona: any[] = [nombre, puntoId, zonaId];

        if (fecha_caducidad) {
          query += ` AND (p.fecha_caducidad IS NULL AND ? IS NULL OR p.fecha_caducidad = ?)`;
          paramsZona.push(fecha_caducidad || null, fecha_caducidad);
        } else {
          query += ` AND p.fecha_caducidad IS NULL`;
        }

        const result = await getSingleValue<number>(query, paramsZona);
        console.log(`✅ Resultado stock total (zona): ${result}`);
        return result || 0;
      }

      const result = await getSingleValue<number>(query, params);
      console.log(`✅ Resultado stock total: ${result}`);

      return result || 0;
    } catch (error) {
      console.error("Error en ProductoService.getStockTotalUnificado:", error);
      return 0;
    }
  }

  // 8. OBTENER STOCK TOTAL UNIFICADO POR PRODUCTO_ID
  static async getStockTotalUnificadoPorProductoId(
    productoId: number,
    puntoId?: number,
    zonaId?: number,
  ): Promise<number> {
    try {
      console.log(
        `🔍 BUSCANDO STOCK UNIFICADO para productoId: ${productoId}, puntoId: ${puntoId}, zonaId: ${zonaId}`,
      );

      const producto = await getFirst<any>(
        "SELECT nombre, fecha_caducidad FROM Producto WHERE id = ?",
        [productoId],
      );

      if (!producto) {
        console.log(`❌ Producto no encontrado con ID: ${productoId}`);
        return 0;
      }

      console.log(
        `📋 Producto encontrado: ${producto.nombre}, fecha: ${producto.fecha_caducidad}`,
      );

      const stock = await this.getStockTotalUnificado(
        producto.nombre,
        producto.fecha_caducidad,
        puntoId,
        zonaId,
      );

      console.log(`✅ Stock unificado calculado: ${stock}`);
      return stock;
    } catch (error) {
      console.error(
        "Error en ProductoService.getStockTotalUnificadoPorProductoId:",
        error,
      );
      return 0;
    }
  }

  // 9. REDUCIR STOCK UNIFICADO (FIFO) con reintentos automáticos
  static async reducirStockUnificado(
    nombre: string,
    fecha_caducidad: string | undefined,
    cantidadAReducir: number,
    puntoId?: number,
    zonaId?: number,
    transaccionExterna: boolean = false,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (cantidadAReducir <= 0) {
        return { success: false, message: "La cantidad debe ser mayor a 0" };
      }

      console.log(
        `🔄 REDUCIENDO STOCK UNIFICADO: ${nombre}, cantidad: ${cantidadAReducir}`,
      );

      const query = `
        SELECT p.id, a.cantidad, a.id as almacen_id
        FROM Producto p
        INNER JOIN Almacen a ON p.id = a.producto_id
        WHERE TRIM(p.nombre) = TRIM(?) 
          AND a.cantidad > 0
        ORDER BY p.creado_en ASC
      `;

      const productosConStock = await executeQuery<any>(query, [nombre]);
      let cantidadRestante = cantidadAReducir;

      console.log(`📦 Productos encontrados: ${productosConStock.length}`);

      // Función de reintento con backoff exponencial
      const executeWithRetry = async (
        operation: () => Promise<any>,
        maxRetries: number = 10,
        initialDelay: number = 1000,
      ): Promise<any> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error: any) {
            if (
              error.message &&
              (error.message.includes("database is locked") ||
                error.message.includes("NativeStatement.finalizeAsync")) &&
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

      for (const producto of productosConStock) {
        if (cantidadRestante <= 0) break;

        const cantidadAReducirDeEste = Math.min(
          producto.cantidad,
          cantidadRestante,
        );

        console.log(
          `  📉 Producto ID ${producto.id}: ${producto.cantidad} -> ${producto.cantidad - cantidadAReducirDeEste}`,
        );

        // Usar reintentos para el UPDATE
        await executeWithRetry(async () => {
          await executeNonQuery(
            "UPDATE Almacen SET cantidad = cantidad - ? WHERE id = ?",
            [cantidadAReducirDeEste, producto.almacen_id],
          );
        });

        const nuevoStock = producto.cantidad - cantidadAReducirDeEste;
        if (nuevoStock <= 0) {
          // Usar reintentos para el DELETE
          await executeWithRetry(async () => {
            await executeNonQuery("DELETE FROM Almacen WHERE id = ?", [
              producto.almacen_id,
            ]);
          });
        }

        cantidadRestante -= cantidadAReducirDeEste;
      }

      return { success: true, message: "Stock reducido correctamente" };
    } catch (error) {
      console.error("Error en reducirStockUnificado:", error);
      return { success: false, message: "Error al reducir stock" };
    }
  }

  // 10. OBTENER PRODUCTOS EN ALMACÉN (CON STOCK UNIFICADO)
  static async getProductosEnAlmacen(limit?: number): Promise<any[]> {
    try {
      const limitClause = limit ? ` LIMIT ${limit}` : "";

      // 0. Check if cantidad_inicial column exists in Almacen table
      let hasCantidadInicial = false;
      try {
        const tableInfo = await executeQuery<any>(`PRAGMA table_info(Almacen)`);
        hasCantidadInicial = tableInfo.some(
          (col: any) => col.name === "cantidad_inicial",
        );
        console.log(
          `🔍 Column cantidad_inicial exists in Almacen: ${hasCantidadInicial}`,
        );
      } catch (pragmaError) {
        console.warn("⚠️ Could not check table info:", pragmaError);
      }

      // 1. Obtener todos los productos con stock (sin agrupar)
      const query = hasCantidadInicial
        ? `
        SELECT 
          p.id,
          p.nombre,
          p.categoria,
          p.subcategoria,
          p.fecha_caducidad,
          p.precio_coste,
          p.creado_en,
          p.actualizado_en,
          p.formato_almacen,
          p.unidades_por_formato,
          p.descripcion,
          a.cantidad_inicial,
          a.cantidad as cantidad
        FROM Producto p
        INNER JOIN Almacen a ON p.id = a.producto_id
        WHERE a.cantidad > 0
        ORDER BY p.nombre, p.fecha_caducidad, p.creado_en${limitClause}
      `
        : `
        SELECT 
          p.id,
          p.nombre,
          p.categoria,
          p.subcategoria,
          p.fecha_caducidad,
          p.precio_coste,
          p.creado_en,
          p.actualizado_en,
          p.formato_almacen,
          p.unidades_por_formato,
          p.descripcion,
          NULL as cantidad_inicial,
          a.cantidad as cantidad
        FROM Producto p
        INNER JOIN Almacen a ON p.id = a.producto_id
        WHERE a.cantidad > 0
        ORDER BY p.nombre, p.fecha_caducidad, p.creado_en${limitClause}
      `;

      const todosLosProductos = await executeQuery<any>(query);
      console.log(
        `📊 Se encontraron ${todosLosProductos.length} productos totales con stock`,
      );

      // 2. Agrupar por nombre y fecha de caducidad en JavaScript
      const productosAgrupados = todosLosProductos.reduce(
        (acc: any, producto) => {
          const clave = `${producto.nombre}|${producto.fecha_caducidad || "null"}`;

          if (!acc[clave]) {
            acc[clave] = {
              nombre: producto.nombre,
              categoria: producto.categoria,
              subcategoria: producto.subcategoria,
              fecha_caducidad: producto.fecha_caducidad,
              creado_en: producto.creado_en,
              actualizado_en: producto.actualizado_en,
              formato_almacen: producto.formato_almacen,
              unidades_por_formato: producto.unidades_por_formato,
              descripcion: producto.descripcion,
              cantidad_inicial: producto.cantidad_inicial,
              productos: [],
              cantidad_total: 0,
            };
          }

          acc[clave].productos.push(producto);
          acc[clave].cantidad_total += producto.cantidad;

          return acc;
        },
        {},
      );

      // 3. Para cada grupo, calcular el stock total y promedio
      const productosConStockUnificado = Object.values(productosAgrupados).map(
        async (grupo: any) => {
          // Calcular el stock total unificado para este grupo
          const stockTotal = await this.getStockTotalUnificado(
            grupo.nombre,
            grupo.fecha_caducidad,
          );

          // Calcular el promedio de precios para este grupo
          const promedio = await this.calcularPrecioCostePromedio(
            grupo.nombre,
            undefined, // almacén general
            undefined, // sin punto
          );

          // Calcular días restantes
          let dias_restantes: number | undefined;
          let estado_vencimiento:
            | "vencido"
            | "por_vencer_rojo"
            | "por_vencer_naranja"
            | "seguro"
            | undefined;

          if (grupo.fecha_caducidad) {
            const fechaCad = new Date(grupo.fecha_caducidad);
            const hoy = new Date();
            const diffTime = fechaCad.getTime() - hoy.getTime();
            dias_restantes = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (dias_restantes < 0) {
              estado_vencimiento = "vencido";
            } else if (dias_restantes <= 30) {
              estado_vencimiento = "por_vencer_rojo";
            } else if (dias_restantes <= 150) {
              estado_vencimiento = "por_vencer_naranja";
            } else {
              estado_vencimiento = "seguro";
            }
          }

          const total_costo = promedio * stockTotal;

          return {
            id: grupo.productos[0].id, // Usar el ID del primer producto como representativo
            nombre: grupo.nombre,
            categoria: grupo.categoria,
            subcategoria: grupo.subcategoria,
            precio_coste: promedio,
            precio_coste_real: promedio,
            precio_coste_promedio: promedio,
            fecha_caducidad: grupo.fecha_caducidad,
            creado_en: grupo.creado_en,
            actualizado_en: grupo.actualizado_en,
            formato_almacen: grupo.formato_almacen,
            unidades_por_formato: grupo.unidades_por_formato,
            descripcion: grupo.descripcion,
            cantidad_inicial: grupo.cantidad_inicial,
            cantidad: stockTotal,
            total_costo,
            dias_restantes,
            estado_vencimiento,
            ubicacion: "Almacén General",
            productos_originales: grupo.productos, // Guardar referencia a todos los productos originales
          };
        },
      );

      return productosConStockUnificado;
    } catch (error) {
      console.error("Error en ProductoService.getProductosEnAlmacen:", error);
      return [];
    }
  }

  // 11. OBTENER PRODUCTOS EN ALMACÉN ESPECÍFICO (CON STOCK UNIFICADO)
  static async getProductosEnAlmacenEspecifico(
    almacenId: number,
    limit?: number,
  ): Promise<any[]> {
    try {
      console.log(` Cargando productos del almacén específico ${almacenId}`);
      const limitClause = limit ? ` LIMIT ${limit}` : "";

      // Primero obtener el nombre del almacén
      const almacenQuery = `SELECT nombre FROM Almacenes WHERE id = ?`;
      const almacenResult = await getFirst<any>(almacenQuery, [almacenId]);
      const nombreAlmacen = almacenResult?.nombre || "Almacén Específico";

      console.log(` Nombre del almacén ${almacenId}: "${nombreAlmacen}"`);

      const query = `
        SELECT 
          p.*, 
          COALESCE(ap.cantidad, 0) as cantidad,
          ap.ubicacion,
          julianday(p.fecha_caducidad) - julianday('now') as dias_restantes,
          p.precio_coste as precio_coste_real,
          (p.precio_coste * COALESCE(ap.cantidad, 0)) as total_costo_real
        FROM Producto p
        INNER JOIN AlmacenProducto ap ON p.id = ap.producto_id AND ap.almacen_id = ?
        WHERE ap.cantidad >= 0
        ORDER BY p.nombre${limitClause}
      `;

      const productos = await executeQuery<any>(query, [almacenId]);
      console.log(
        ` Se encontraron ${productos.length} productos en el almacén ${almacenId}`,
      );

      // Calcular promedio para cada producto y crear nuevo array
      const productosConPromedio = await Promise.all(
        productos.map(async (producto: any) => {
          // Obtener el promedio para productos con el mismo nombre SOLO en este almacén
          const promedio = await this.calcularPrecioCostePromedio(
            producto.nombre,
            almacenId, // almacén específico
            undefined, // sin punto
          );

          const total_costo = promedio * (producto.cantidad || 0);
          const dias_restantes = producto.fecha_caducidad
            ? Math.floor(producto.dias_restantes || 0)
            : undefined;

          let estado_vencimiento:
            | "vencido"
            | "por_vencer_rojo"
            | "por_vencer_naranja"
            | "seguro"
            | undefined;

          if (producto.fecha_caducidad) {
            if (dias_restantes! < 0) {
              estado_vencimiento = "vencido";
            } else if (dias_restantes! <= 30) {
              estado_vencimiento = "por_vencer_rojo";
            } else if (dias_restantes! <= 150) {
              estado_vencimiento = "por_vencer_naranja";
            } else {
              estado_vencimiento = "seguro";
            }
          }

          return {
            id: producto.id,
            nombre: producto.nombre,
            categoria: producto.categoria,
            subcategoria: producto.subcategoria,
            precio_coste: promedio,
            precio_coste_real: producto.precio_coste_real,
            precio_coste_promedio: promedio,
            fecha_caducidad: producto.fecha_caducidad,
            creado_en: producto.creado_en,
            actualizado_en: producto.actualizado_en,
            formato_almacen: producto.formato_almacen,
            unidades_por_formato: producto.unidades_por_formato,
            descripcion: producto.descripcion,
            cantidad_inicial: producto.cantidad_inicial,
            cantidad: producto.cantidad || 0,
            total_costo,
            dias_restantes,
            estado_vencimiento,
            ubicacion: nombreAlmacen, // Usar el nombre real del almacén
            almacen_id: almacenId, // Agregar el ID del almacén
          };
        }),
      );

      return productosConPromedio;
    } catch (error) {
      console.error(
        "Error en ProductoService.getProductosEnAlmacenEspecifico:",
        error,
      );
      return [];
    }
  }

  // 12. OBTENER PRODUCTOS EN ALMACÉN DEL PUNTO
  static async getProductosEnAlmacenDelPunto(
    puntoId: number,
    limit?: number,
  ): Promise<any[]> {
    try {
      const limitClause = limit ? ` LIMIT ${limit}` : "";
      const query = `
        SELECT 
          p.*, 
          COALESCE(az.cantidad, 0) as cantidad,
          az.zona_id,
          julianday(p.fecha_caducidad) - julianday('now') as dias_restantes,
          p.precio_coste as precio_coste_real,
          (p.precio_coste * COALESCE(az.cantidad, 0)) as total_costo_real
        FROM Producto p
        LEFT JOIN AlmacenZona az ON p.id = az.producto_id AND az.punto_id = ?
        WHERE COALESCE(az.cantidad, 0) > 0
        ORDER BY p.nombre${limitClause}
      `;

      const productos = await executeQuery<any>(query, [puntoId]);

      // Calcular promedio para cada producto
      const productosConPromedio = await Promise.all(
        productos.map(async (producto: any) => {
          const promedio = await this.calcularPrecioCostePromedio(
            producto.nombre,
            undefined, // almacén general
            undefined, // sin punto
          );

          const total_costo = promedio * (producto.cantidad || 0);
          const dias_restantes = producto.fecha_caducidad
            ? Math.floor(producto.dias_restantes || 0)
            : undefined;

          let estado_vencimiento:
            | "vencido"
            | "por_vencer_rojo"
            | "por_vencer_naranja"
            | "seguro"
            | undefined;

          if (producto.fecha_caducidad) {
            if (dias_restantes! < 0) {
              estado_vencimiento = "vencido";
            } else if (dias_restantes! <= 30) {
              estado_vencimiento = "por_vencer_rojo";
            } else if (dias_restantes! <= 150) {
              estado_vencimiento = "por_vencer_naranja";
            } else {
              estado_vencimiento = "seguro";
            }
          }

          return {
            id: producto.id,
            nombre: producto.nombre,
            categoria: producto.categoria,
            subcategoria: producto.subcategoria,
            precio_coste: promedio,
            precio_coste_real: producto.precio_coste_real,
            precio_coste_promedio: promedio,
            fecha_caducidad: producto.fecha_caducidad,
            creado_en: producto.creado_en,
            actualizado_en: producto.actualizado_en,
            formato_almacen: producto.formato_almacen,
            unidades_por_formato: producto.unidades_por_formato,
            descripcion: producto.descripcion,
            cantidad_inicial: producto.cantidad_inicial,
            cantidad: producto.cantidad || 0,
            total_costo,
            dias_restantes,
            estado_vencimiento,
            ubicacion:
              producto.zona_id === 1 ? "Zona de Venta" : "Almacén del Punto",
            zona_id: producto.zona_id,
          };
        }),
      );

      return productosConPromedio;
    } catch (error) {
      console.error(
        "Error en ProductoService.getProductosEnAlmacenDelPunto:",
        error,
      );
      return [];
    }
  }

  // 12.1. OBTENER PRODUCTOS DE ZONA ESPECÍFICA DEL PUNTO
  static async getProductosDeZonaPunto(
    puntoId: number,
    zonaId: number, // 1 = Zona de Venta, 2 = Almacén del Punto
    limit?: number,
  ): Promise<any[]> {
    try {
      const limitClause = limit ? ` LIMIT ${limit}` : "";
      console.log(`🔍 Buscando productos en punto ${puntoId}, zona ${zonaId}`);

      const query = `
        SELECT 
          p.*, 
          COALESCE(az.cantidad, 0) as cantidad,
          az.zona_id,
          julianday(p.fecha_caducidad) - julianday('now') as dias_restantes,
          p.precio_coste as precio_coste_real,
          (p.precio_coste * COALESCE(az.cantidad, 0)) as total_costo_real
        FROM Producto p
        LEFT JOIN AlmacenZona az ON p.id = az.producto_id AND az.punto_id = ? AND az.zona_id = ?
        WHERE COALESCE(az.cantidad, 0) > 0
        ORDER BY p.nombre${limitClause}
      `;

      const productos = await executeQuery<any>(query, [puntoId, zonaId]);
      console.log(
        `📊 Encontrados ${productos.length} productos en zona ${zonaId}`,
      );

      // Calcular promedio para cada producto
      const productosConPromedio = await Promise.all(
        productos.map(async (producto: any) => {
          const promedio = await this.calcularPrecioCostePromedio(
            producto.nombre,
            undefined, // almacén general
            undefined, // sin punto
          );

          const total_costo = promedio * (producto.cantidad || 0);
          const dias_restantes = producto.fecha_caducidad
            ? Math.floor(producto.dias_restantes || 0)
            : undefined;

          let estado_vencimiento:
            | "vencido"
            | "por_vencer_rojo"
            | "por_vencer_naranja"
            | "seguro"
            | undefined;

          if (producto.fecha_caducidad) {
            if (dias_restantes! < 0) {
              estado_vencimiento = "vencido";
            } else if (dias_restantes! <= 30) {
              estado_vencimiento = "por_vencer_rojo";
            } else if (dias_restantes! <= 150) {
              estado_vencimiento = "por_vencer_naranja";
            } else {
              estado_vencimiento = "seguro";
            }
          }

          return {
            id: producto.id,
            nombre: producto.nombre,
            categoria: producto.categoria,
            subcategoria: producto.subcategoria,
            precio_coste: promedio,
            precio_coste_real: producto.precio_coste_real,
            precio_coste_promedio: promedio,
            fecha_caducidad: producto.fecha_caducidad,
            creado_en: producto.creado_en,
            actualizado_en: producto.actualizado_en,
            formato_almacen: producto.formato_almacen,
            unidades_por_formato: producto.unidades_por_formato,
            descripcion: producto.descripcion,
            cantidad_inicial: producto.cantidad_inicial,
            cantidad: producto.cantidad || 0,
            total_costo,
            dias_restantes,
            estado_vencimiento,
            ubicacion:
              producto.zona_id === 1 ? "Zona de Venta" : "Almacén del Punto",
            zona_id: producto.zona_id,
          };
        }),
      );

      return productosConPromedio;
    } catch (error) {
      console.error("Error en ProductoService.getProductosDeZonaPunto:", error);
      return [];
    }
  }

  // 13. CALCULAR PRECIO COSTE PROMEDIO (SOLO PRODUCTOS CON STOCK EN ALMACÉN ESPECÍFICO)
  static async calcularPrecioCostePromedio(
    nombre: string,
    almacenId?: number,
    puntoId?: number,
  ): Promise<number> {
    try {
      let whereClause = `TRIM(p.nombre) = TRIM(?)`;
      const params: any[] = [nombre];

      if (almacenId !== undefined) {
        // Filtrar por almacén específico
        whereClause += ` AND EXISTS (
          SELECT 1 FROM AlmacenProducto ap 
          WHERE ap.producto_id = p.id AND ap.almacen_id = ? AND ap.cantidad > 0
        )`;
        params.push(almacenId);
      } else if (puntoId !== undefined) {
        // Filtrar por punto específico (zona de venta)
        whereClause += ` AND EXISTS (
          SELECT 1 FROM AlmacenZona az 
          WHERE az.producto_id = p.id AND az.punto_id = ? AND az.zona_id = 1 AND az.cantidad > 0
        )`;
        params.push(puntoId);
      } else {
        // Filtrar por almacén general (por defecto)
        whereClause += ` AND EXISTS (
          SELECT 1 FROM Almacen a 
          WHERE a.producto_id = p.id AND a.cantidad > 0
        )`;
      }

      const result = await getSingleValue<number>(
        `SELECT COALESCE(AVG(p.precio_coste), 0) as promedio 
         FROM Producto p
         WHERE ${whereClause}`,
        params,
      );
      return result || 0;
    } catch (error) {
      console.error(
        "Error en ProductoService.calcularPrecioCostePromedio:",
        error,
      );
      return 0;
    }
  }

  // 14. OBTENER TOTAL DINERO EN ALMACÉN
  static async getTotalDineroAlmacen(): Promise<number> {
    try {
      const query = `
        SELECT COALESCE(SUM(a.cantidad * p.precio_coste), 0) as total
        FROM Producto p
        INNER JOIN Almacen a ON p.id = a.producto_id
        WHERE a.cantidad > 0
      `;
      const result = await getSingleValue<number>(query);
      return result || 0;
    } catch (error) {
      console.error("Error en ProductoService.getTotalDineroAlmacen:", error);
      return 0;
    }
  }

  // 15. OBTENER TOTAL DINERO EN ALMACÉN (PROMEDIO)
  static async getTotalDineroAlmacenPromedio(): Promise<number> {
    try {
      const productos = await this.getProductosEnAlmacen();
      const total = productos.reduce((sum, producto) => {
        return sum + (producto.total_costo || 0);
      }, 0);
      return total;
    } catch (error) {
      console.error(
        "Error en ProductoService.getTotalDineroAlmacenPromedio:",
        error,
      );
      return 0;
    }
  }

  // 16. OBTENER TOTAL DINERO EN ALMACÉN POR PUNTO
  static async getTotalDineroAlmacenPorPunto(puntoId: number): Promise<number> {
    try {
      const query = `
        SELECT COALESCE(SUM(az.cantidad * p.precio_coste), 0) as total
        FROM Producto p
        INNER JOIN AlmacenZona az ON p.id = az.producto_id
        WHERE az.punto_id = ? AND az.cantidad > 0
      `;
      const result = await getSingleValue<number>(query, [puntoId]);
      return result || 0;
    } catch (error) {
      console.error(
        "Error en ProductoService.getTotalDineroAlmacenPorPunto:",
        error,
      );
      return 0;
    }
  }

  // 17. OBTENER TOTAL DINERO EN ALMACÉN POR PUNTO (PROMEDIO)
  static async getTotalDineroAlmacenPorPuntoPromedio(
    puntoId: number,
  ): Promise<number> {
    try {
      const productos = await this.getProductosEnAlmacenDelPunto(puntoId);
      const total = productos.reduce((sum, producto) => {
        return sum + (producto.total_costo_real || 0);
      }, 0);
      return total;
    } catch (error) {
      console.error(
        "Error en ProductoService.getTotalDineroAlmacenPorPuntoPromedio:",
        error,
      );
      return 0;
    }
  }

  // 18. OBTENER COLOR SEGÚN ESTADO DE VENCIMIENTO
  static getColorVencimiento(
    estado?: "vencido" | "por_vencer_rojo" | "por_vencer_naranja" | "seguro",
  ): string {
    switch (estado) {
      case "vencido":
        return "#ef4444"; // Rojo
      case "por_vencer_rojo":
        return "#ef4444"; // Rojo (1 mes o menos)
      case "por_vencer_naranja":
        return "#f59e0b"; // Naranja (2-5 meses)
      case "seguro":
        return "#10b981"; // Verde (más de 5 meses)
      default:
        return "#6b7280"; // Gris (sin fecha)
    }
  }

  // 19. CREAR PRODUCTO CON UNIFICACIÓN AUTOMÁTICA
  static async createProductoConStockUnificado(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number = 0,
    fecha_caducidad?: string,
    ubicacion?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    try {
      console.log(
        `🔄 CREANDO PRODUCTO CON UNIFICACIÓN: ${nombre}, cantidad: ${cantidad}, fecha: ${fecha_caducidad}`,
      );

      // Iniciar transacción
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 1. Buscar si existe un producto con el mismo nombre y fecha de caducidad
        const productoExistente = await getFirst<any>(
          `SELECT id, nombre, categoria, subcategoria, precio_coste, fecha_caducidad 
           FROM Producto 
           WHERE TRIM(nombre) = TRIM(?) 
           AND (fecha_caducidad IS NULL AND ? IS NULL OR fecha_caducidad = ?)`,
          [nombre, fecha_caducidad || null, fecha_caducidad || null],
        );

        let productoId: number;

        if (productoExistente) {
          // 2. Si existe, usar ese producto y actualizar su información si es necesario
          productoId = productoExistente.id;
          console.log(
            `✅ Producto existente encontrado: ID ${productoId}, actualizando información...`,
          );

          // 2.1. Verificar si ya tiene stock en almacén general
          const stockExistente = await getSingleValue<number>(
            "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
            [productoId],
          );

          // 2.2. Calcular el promedio SIEMPRE que exista un producto con mismo nombre y fecha
          let precioPromedioNuevo: number;

          // Obtener todos los productos con mismo nombre y fecha para calcular el promedio
          const productosMismoNombreFecha = await executeQuery<any>(
            `SELECT p.precio_coste, COALESCE(a.cantidad, 0) as cantidad
             FROM Producto p
             LEFT JOIN Almacen a ON p.id = a.producto_id
             WHERE TRIM(p.nombre) = TRIM(?) 
               AND (p.fecha_caducidad IS NULL AND ? IS NULL OR p.fecha_caducidad = ?)`,
            [nombre, fecha_caducidad || null, fecha_caducidad || null],
          );

          if (productosMismoNombreFecha.length > 1) {
            // Hay múltiples productos con mismo nombre y fecha → calcular promedio
            const totalPrecio = productosMismoNombreFecha.reduce(
              (sum, p) => sum + p.precio_coste * p.cantidad,
              0,
            );
            const totalCantidad = productosMismoNombreFecha.reduce(
              (sum, p) => sum + p.cantidad,
              0,
            );

            if (totalCantidad > 0) {
              // Hay productos con stock → promedio ponderado por cantidad
              const promedioActual = totalPrecio / totalCantidad;
              precioPromedioNuevo =
                (promedioActual * (stockExistente || 0) +
                  precio_coste * cantidad) /
                ((stockExistente || 0) + cantidad);
              console.log(
                `📊 Promedio ponderado calculado: ${promedioActual} → ${precioPromedioNuevo}`,
              );
            } else {
              // No hay stock en ningún producto → promedio simple de precios
              const promedioSimple =
                productosMismoNombreFecha.reduce(
                  (sum, p) => sum + p.precio_coste,
                  0,
                ) / productosMismoNombreFecha.length;
              precioPromedioNuevo = (promedioSimple + precio_coste) / 2;
              console.log(
                `📊 Promedio simple calculado: ${promedioSimple} → ${precioPromedioNuevo}`,
              );
            }
          } else {
            // Solo existe un producto con ese nombre y fecha → usar promedio simple
            precioPromedioNuevo =
              (productoExistente.precio_coste + precio_coste) / 2;
            console.log(
              `📊 Promedio simple con producto existente: ${productoExistente.precio_coste} + ${precio_coste} → ${precioPromedioNuevo}`,
            );
          }

          // Actualizar categoría, subcategoría, precio de coste y formato
          await executeNonQuery(
            `UPDATE Producto 
             SET categoria = COALESCE(?, categoria), 
                 subcategoria = COALESCE(?, subcategoria),
                 precio_coste = ?, -- Usar el nuevo promedio calculado
                 formato_almacen = COALESCE(?, formato_almacen),
                 unidades_por_formato = COALESCE(?, unidades_por_formato),
                 actualizado_en = ?
             WHERE id = ?`,
            [
              categoria && categoria.trim() !== ""
                ? categoria
                : productoExistente.categoria,
              subcategoria && subcategoria.trim() !== ""
                ? subcategoria
                : productoExistente.subcategoria,
              precioPromedioNuevo,
              formato_almacen || productoExistente.formato_almacen,
              unidades_por_formato || productoExistente.unidades_por_formato,
              productoId,
            ],
          );

          if (stockExistente && stockExistente > 0) {
            // Sumar la cantidad al stock existente
            await executeNonQuery(
              "UPDATE Almacen SET cantidad = cantidad + ?, actualizado_en = ? WHERE producto_id = ?",
              [cantidad, productoId],
            );
            console.log(
              `📈 Stock actualizado: ${stockExistente} + ${cantidad} = ${stockExistente + cantidad}`,
            );

            // Registrar en HistorialInventario
            await this.insertarHistorialInventario(
              productoId,
              null, // almacen_id (null para almacén general)
              null, // punto_id
              null, // zona_id
              "ajuste", // tipo_movimiento
              cantidad, // cantidad_variación positiva
              stockExistente, // stock_anterior
              stockExistente + cantidad, // stock_nuevo
              "Ajuste de stock",
              `Stock aumentado en ${cantidad} unidades en ${ubicacion || "almacén general"}`,
            );
          } else {
            // Crear nuevo registro en almacén
            await executeNonQuery(
              "INSERT INTO Almacen (producto_id, cantidad, ubicacion) VALUES (?, ?, ?)",
              [productoId, cantidad, ubicacion || null],
            );
            console.log(`📦 Nuevo stock creado: ${cantidad} unidades`);
          }

          // 4. Actualizar precio de coste promedio para todos los productos con el mismo nombre (considerando todos)
          await this.actualizarPrecioCostePromedio(nombre);

          await executeNonQuery("COMMIT");

          return {
            success: true,
            message: `Producto unificado correctamente. Stock total actualizado: ${(stockExistente || 0) + cantidad} unidades. Nuevo precio promedio: ${precioPromedioNuevo.toFixed(2)}`,
            productoId,
          };
        } else {
          // 5. Si no existe, crear nuevo producto
          console.log(`➕ Creando nuevo producto...`);
          console.log(`📋 Datos del nuevo producto:`);
          console.log(`  - nombre: ${nombre}`);
          console.log(`  - formato_almacen: ${formato_almacen}`);
          console.log(`  - unidades_por_formato: ${unidades_por_formato}`);
          console.log(`  - cantidad_inicial: ${cantidad_inicial}`);
          console.log(`  - cantidad (stock): ${cantidad}`);

          const productoResult = await executeNonQuery(
            `INSERT INTO Producto (nombre, categoria, subcategoria, precio_coste, fecha_caducidad, formato_almacen, unidades_por_formato) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              nombre,
              categoria,
              subcategoria,
              precio_coste,
              fecha_caducidad || null,
              formato_almacen || null,
              unidades_por_formato || null,
            ],
          );

          productoId = productoResult.lastInsertRowId;

          // 6. Si hay cantidad, agregar al almacén
          if (cantidad > 0) {
            await executeNonQuery(
              `INSERT INTO Almacen (producto_id, cantidad, ubicacion, cantidad_inicial) 
               VALUES (?, ?, ?, ?)`,
              [productoId, cantidad, ubicacion || null, cantidad],
            );
            console.log(
              `📦 Stock inicial creado: ${cantidad} unidades (inicial: ${cantidad})`,
            );

            // Registrar en HistorialInventario
            await this.insertarHistorialInventario(
              productoId,
              null, // almacen_id (null para almacén general)
              null, // punto_id
              null, // zona_id
              "creacion", // tipo_movimiento
              cantidad, // cantidad_variación positiva
              0, // stock_anterior
              cantidad, // stock_nuevo
              "Creación inicial",
              `Producto creado con ${cantidad} unidades iniciales en ${ubicacion || "almacén general"}`,
            );
          }

          await executeNonQuery("COMMIT");

          return {
            success: true,
            message: `Nuevo producto creado con ${cantidad} unidades`,
            productoId,
          };
        }
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en createProductoConStockUnificado:", error);
      return {
        success: false,
        message: error.message || "Error al crear producto unificado",
      };
    }
  }

  // 20. ACTUALIZAR PRECIO COSTE PROMEDIO (función auxiliar)
  static async actualizarPrecioCostePromedio(nombre: string): Promise<void> {
    try {
      const promedio = await this.calcularPrecioCostePromedio(nombre);

      // Actualizar todos los productos con este nombre al promedio
      await executeNonQuery(
        `UPDATE Producto 
         SET precio_coste = ?, actualizado_en = ? 
         WHERE nombre = ?`,
        [promedio, nombre],
      );

      console.log(`💰 Precio promedio actualizado para ${nombre}: ${promedio}`);
    } catch (error) {
      console.error("Error en actualizarPrecioCostePromedio:", error);
    }
  }

  // 22. CREAR PRODUCTO CON STOCK EN ALMACÉN ESPECÍFICO (CON UNIFICACIÓN)
  static async createProductoConStockEnAlmacen(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number,
    almacenId: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    try {
      console.log(
        `🔄 CREANDO PRODUCTO EN ALMACÉN ESPECÍFICO CON UNIFICACIÓN: ${nombre}, cantidad: ${cantidad}, almacén: ${almacenId}`,
      );

      // 1. Primero crear o unificar el producto en el almacén general
      const resultadoUnificacion = await this.createProductoConStockUnificado(
        nombre,
        categoria,
        subcategoria,
        precio_coste,
        cantidad, // Stock inicial en almacén general
        fecha_caducidad,
        undefined, // ubicacion
        formato_almacen,
        unidades_por_formato,
        cantidad_inicial,
      );

      if (!resultadoUnificacion.success) {
        return resultadoUnificacion;
      }

      const productoId = resultadoUnificacion.productoId!;

      // 2. Si hay almacenId, también agregar stock en el almacén específico
      if (almacenId && cantidad > 0) {
        console.log(
          `📦 Agregando ${cantidad} unidades al almacén específico ${almacenId}`,
        );

        await executeNonQuery("BEGIN TRANSACTION");

        try {
          // Verificar si ya existe en AlmacenProducto
          const existenteEnAlmacen = await getFirst<any>(
            "SELECT * FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
            [productoId, almacenId],
          );

          console.log(
            `🔍 Producto existente en almacén específico:`,
            existenteEnAlmacen,
          );

          if (existenteEnAlmacen) {
            // Sumar cantidad existente
            // Usar fecha local en lugar de UTC
            const { getFechaHoraLocalCompleta } =
              await import("../../utils/dateUtils");
            const ahora = getFechaHoraLocalCompleta();

            await executeNonQuery(
              "UPDATE AlmacenProducto SET cantidad = cantidad + ?, actualizado_en = ? WHERE id = ?",
              [cantidad, ahora, existenteEnAlmacen.id],
            );
            console.log(
              `✅ Actualizado stock existente: ${existenteEnAlmacen.cantidad} + ${cantidad}`,
            );

            // Registrar en HistorialInventario
            await this.insertarHistorialInventario(
              productoId,
              almacenId, // almacen_id específico
              null, // punto_id
              null, // zona_id
              "ajuste", // tipo_movimiento
              cantidad, // cantidad_variación positiva
              existenteEnAlmacen.cantidad, // stock_anterior
              existenteEnAlmacen.cantidad + cantidad, // stock_nuevo
              `Almacén ${almacenId}`,
              `Stock aumentado en ${cantidad} unidades en almacén específico ${almacenId}`,
            );
          } else {
            // Crear nuevo registro
            const ahora =
              getFechaLocal() + " " + new Date().toLocaleTimeString();
            await executeNonQuery(
              "INSERT INTO AlmacenProducto (producto_id, almacen_id, cantidad, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
              [productoId, almacenId, cantidad, ahora, ahora],
            );
            console.log(
              `✅ Creado nuevo registro en almacén específico: ${cantidad} unidades (inicial: ${cantidad})`,
            );

            // Registrar en HistorialInventario
            await this.insertarHistorialInventario(
              productoId,
              almacenId, // almacen_id específico
              null, // punto_id
              null, // zona_id
              "ajuste", // tipo_movimiento
              cantidad, // cantidad_variación positiva
              0, // stock_anterior
              cantidad, // stock_nuevo
              `Almacén ${almacenId}`,
              `Producto creado con ${cantidad} unidades iniciales en almacén específico ${almacenId}`,
            );
          }

          await executeNonQuery("COMMIT");
        } catch (error) {
          await executeNonQuery("ROLLBACK");
          throw error;
        }
      }

      return {
        success: true,
        message: `Producto unificado y agregado al almacén específico correctamente`,
        productoId,
      };
    } catch (error: any) {
      console.error("Error en createProductoConStockEnAlmacen:", error);
      return {
        success: false,
        message:
          error.message || "Error al crear producto en almacén específico",
      };
    }
  }

  // 23. CREAR PRODUCTO CON STOCK EN PUNTO (CON UNIFICACIÓN)
  static async createProductoConStockEnPunto(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number,
    puntoId: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    try {
      console.log(
        `🔄 CREANDO PRODUCTO EN PUNTO CON UNIFICACIÓN: ${nombre}, cantidad: ${cantidad}, punto: ${puntoId}`,
      );

      // 1. Primero crear o unificar el producto en el almacén general
      const resultadoUnificacion = await this.createProductoConStockUnificado(
        nombre,
        categoria,
        subcategoria,
        precio_coste,
        cantidad, // Stock inicial en almacén general
        fecha_caducidad,
        undefined, // ubicacion
        formato_almacen,
        unidades_por_formato,
        cantidad_inicial,
      );

      if (!resultadoUnificacion.success) {
        return resultadoUnificacion;
      }

      const productoId = resultadoUnificacion.productoId!;

      // 2. Si hay puntoId, también agregar stock en AlmacenZona
      if (puntoId && cantidad > 0) {
        console.log(
          `📦 Agregando ${cantidad} unidades al almacén del punto ${puntoId}`,
        );

        await executeNonQuery("BEGIN TRANSACTION");

        try {
          // Verificar si ya existe en AlmacenZona (zona_id = 2 es almacén del punto)
          const existenteEnZona = await getFirst<any>(
            "SELECT * FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 2",
            [productoId, puntoId],
          );

          console.log(
            `🔍 Producto existente en almacén del punto:`,
            existenteEnZona,
          );

          if (existenteEnZona) {
            // Sumar cantidad existente
            // Usar fecha local en lugar de UTC
            const { getFechaHoraLocalCompleta } =
              await import("../../utils/dateUtils");
            const ahora = getFechaHoraLocalCompleta();

            await executeNonQuery(
              "UPDATE AlmacenZona SET cantidad = cantidad + ?, actualizado_en = ? WHERE id = ?",
              [cantidad, ahora, existenteEnZona.id],
            );
            console.log(
              `✅ Actualizado stock existente: ${existenteEnZona.cantidad} + ${cantidad}`,
            );
          } else {
            // Crear nuevo registro
            const ahora =
              getFechaLocal() + " " + new Date().toLocaleTimeString();
            await executeNonQuery(
              "INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia, creado_en, actualizado_en) VALUES (?, ?, 2, ?, ?, ?, ?, ?)",
              [productoId, puntoId, cantidad, 0, 0, ahora, ahora],
            );
            console.log(
              `✅ Creado nuevo registro en almacén del punto: ${cantidad} unidades`,
            );
          }

          await executeNonQuery("COMMIT");
        } catch (error) {
          await executeNonQuery("ROLLBACK");
          throw error;
        }
      }

      return {
        success: true,
        message: `Producto unificado y agregado al almacén del punto correctamente`,
        productoId,
      };
    } catch (error: any) {
      console.error("Error en createProductoConStockEnPunto:", error);
      return {
        success: false,
        message:
          error.message || "Error al crear producto en almacén del punto",
      };
    }
  }

  // 24. CREAR PRODUCTO CON STOCK (ALMACÉN GENERAL - CON UNIFICACIÓN)
  static async createProductoConStock(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number,
    fecha_caducidad?: string,
    ubicacion?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    // Esta función ahora usa la unificación automática
    return await this.createProductoConStockUnificado(
      nombre,
      categoria,
      subcategoria,
      precio_coste,
      cantidad,
      fecha_caducidad,
      ubicacion,
      formato_almacen,
      unidades_por_formato,
      cantidad_inicial,
    );
  }

  // 25. TRANSFERIR DESDE ALMACÉN GENERAL A ZONA DE VENTA DE PUNTO
  static async transferirAlmacenAZona({
    productoId,
    puntoId,
    cantidad,
    precioVenta,
  }: {
    productoId: number;
    puntoId: number;
    cantidad: number;
    precioVenta: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      console.log(
        `🔄 TRANSFIRIENDO DESDE ALMACÉN GENERAL: productoId=${productoId}, puntoId=${puntoId}, cantidad=${cantidad}`,
      );

      // 1. Verificar stock disponible en almacén general
      const stockDisponible = await getSingleValue<number>(
        "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
        [productoId],
      );

      if (!stockDisponible || stockDisponible < cantidad) {
        return {
          success: false,
          message: `Stock insuficiente en almacén general. Disponible: ${stockDisponible || 0} unidades`,
        };
      }

      // 2. Obtener información del producto
      const producto = await getFirst<any>(
        "SELECT nombre, precio_coste FROM Producto WHERE id = ?",
        [productoId],
      );

      if (!producto) {
        return { success: false, message: "Producto no encontrado" };
      }

      const precioCoste = producto.precio_coste;
      const gananciaUnitaria = precioVenta - precioCoste;

      // 3. Iniciar transacción
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 4. Capturar stock ANTES de la transferencia
        const stockAntesAlmacen = await getSingleValue<number>(
          "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
          [productoId],
        );

        const stockAntesZona =
          (await getSingleValue<number>(
            "SELECT COALESCE(cantidad, 0) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
            [productoId, puntoId],
          )) || 0;

        // 5. Reducir cantidad en almacén general (ORIGEN)
        // Usar fecha local en lugar de UTC
        const { getFechaHoraLocalCompleta } =
          await import("../../utils/dateUtils");
        const ahora = getFechaHoraLocalCompleta();

        await executeNonQuery(
          "UPDATE Almacen SET cantidad = cantidad - ?, actualizado_en = ? WHERE producto_id = ?",
          [cantidad, ahora, productoId],
        );

        // 6. Verificar si existe un producto con el mismo nombre en zona de venta del punto (DESTINO)
        const productoMismoNombre = await getFirst<any>(
          `SELECT az.*, p.nombre as nombre_producto 
           FROM AlmacenZona az 
           INNER JOIN Producto p ON az.producto_id = p.id 
           WHERE TRIM(p.nombre) = TRIM(?) AND az.punto_id = ? AND az.zona_id = 1`,
          [producto.nombre, puntoId],
        );

        if (productoMismoNombre) {
          // Actualizar cantidad existente y usar el último precio de venta
          const nuevaGananciaUnitaria = precioVenta - precioCoste;
          await executeNonQuery(
            "UPDATE AlmacenZona SET cantidad = cantidad + ?, precio_venta = ?, ganancia = ?, actualizado_en = ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
            [
              cantidad,
              precioVenta,
              nuevaGananciaUnitaria,
              productoMismoNombre.producto_id,
              puntoId,
            ],
          );
          console.log(
            `✅ Producto agrupado: "${producto.nombre}" actualizado con nuevo precio ${ProductoService.formatMoneda(
              precioVenta,
            )} y cantidad +${cantidad}`,
          );
        } else {
          // Crear nuevo registro en zona de venta
          const ahora = getFechaLocal() + " " + new Date().toLocaleTimeString();
          await executeNonQuery(
            "INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia, creado_en, actualizado_en) VALUES (?, ?, 1, ?, ?, ?, ?, ?)",
            [
              productoId,
              puntoId,
              cantidad,
              precioVenta,
              gananciaUnitaria,
              ahora,
              ahora,
            ],
          );
          console.log(
            `✅ Nuevo producto creado: "${producto.nombre}" en zona de venta con precio ${ProductoService.formatMoneda(
              precioVenta,
            )}`,
          );
        }

        // 7. Capturar stock DESPUÉS de la transferencia
        const stockDespuesAlmacen =
          (await getSingleValue<number>(
            "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
            [productoId],
          )) || 0;

        const stockDespuesZona =
          (await getSingleValue<number>(
            "SELECT COALESCE(cantidad, 0) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
            [productoId, puntoId],
          )) || 0;

        // 8. Insertar registros en HistorialInventario
        // Registro para el almacén general (salida)
        await this.insertarHistorialInventario(
          productoId,
          null, // almacen_id (null para almacén general)
          null, // punto_id
          null, // zona_id
          "transferencia",
          -cantidad, // salida negativa
          stockAntesAlmacen || 0, // asegurar que no sea null
          stockDespuesAlmacen || 0, // asegurar que no sea null
          `Punto ${puntoId} - Zona de Venta`,
          `Transferencia de ${cantidad} unidades a zona de venta del Punto ${puntoId}`,
        );

        // Registro para la zona de venta (entrada)
        await this.insertarHistorialInventario(
          productoId,
          null, // almacen_id (null para zonas)
          puntoId,
          1, // zona_id (1 = zona de venta)
          "transferencia",
          cantidad, // entrada positiva
          stockAntesZona,
          stockDespuesZona,
          `Almacén General`,
          `Transferencia de ${cantidad} unidades desde almacén general`,
        );

        // 9. Registrar en historial con nota individual del stock restante
        const stockRestante = stockDespuesAlmacen || 0;
        const notas = `Transferencia desde Almacén General a Punto ${puntoId} (Quedaron: ${stockRestante} unidades)`;

        // Usar fecha local en lugar de UTC para el historial
        await executeNonQuery(
          "INSERT INTO LogTransferencia (producto_id, punto_id, cantidad, precio_venta, precio_coste_real, notas, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            productoId,
            puntoId,
            cantidad,
            precioVenta,
            precioCoste,
            notas,
            ahora,
          ],
        );

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: `Transferencia completada: ${cantidad} unidades movidas a zona de venta`,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en transferirAlmacenAZona:", error);
      return {
        success: false,
        message: error.message || "Error al transferir a zona de venta",
      };
    }
  }

  // 26. TRANSFERIR DESDE ALMACÉN ESPECÍFICO A ZONA DE VENTA DE PUNTO
  static async transferirAlmacenEspecificoAZona({
    productoId,
    almacenOrigenId,
    puntoId,
    cantidad,
    precioVenta,
  }: {
    productoId: number;
    almacenOrigenId: number;
    puntoId: number;
    cantidad: number;
    precioVenta: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      console.log(
        `🔄 TRANSFIRIENDO DESDE ALMACÉN ESPECÍFICO: productoId=${productoId}, almacenOrigenId=${almacenOrigenId}, puntoId=${puntoId}, cantidad=${cantidad}`,
      );

      // 1. Verificar stock disponible en almacén específico
      const stockDisponible = await getSingleValue<number>(
        "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
        [productoId, almacenOrigenId],
      );

      if (!stockDisponible || stockDisponible < cantidad) {
        return {
          success: false,
          message: `Stock insuficiente en almacén específico. Disponible: ${stockDisponible || 0} unidades`,
        };
      }

      // 2. Obtener información del producto
      const producto = await getFirst<any>(
        "SELECT nombre, precio_coste FROM Producto WHERE id = ?",
        [productoId],
      );

      if (!producto) {
        return { success: false, message: "Producto no encontrado" };
      }

      const precioCoste = producto.precio_coste;
      const gananciaUnitaria = precioVenta - precioCoste;

      // 3. Iniciar transacción
      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 4. Capturar stock ANTES de la transferencia
        const stockAntesAlmacen =
          (await getSingleValue<number>(
            "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
            [productoId, almacenOrigenId],
          )) || 0;

        // 5. Reducir cantidad en almacén específico (ORIGEN)
        // Usar fecha local en lugar de UTC
        const { getFechaHoraLocalCompleta } =
          await import("../../utils/dateUtils");
        const ahora = getFechaHoraLocalCompleta();

        await executeNonQuery(
          "UPDATE AlmacenProducto SET cantidad = cantidad - ?, actualizado_en = ? WHERE producto_id = ? AND almacen_id = ?",
          [cantidad, ahora, productoId, almacenOrigenId],
        );

        // 6. Verificar si existe un producto con el mismo nombre en zona de venta del punto (DESTINO)
        const productoMismoNombre = await getFirst<any>(
          `SELECT az.*, p.nombre as nombre_producto 
           FROM AlmacenZona az 
           INNER JOIN Producto p ON az.producto_id = p.id 
           WHERE TRIM(p.nombre) = TRIM(?) AND az.punto_id = ? AND az.zona_id = 1`,
          [producto.nombre, puntoId],
        );

        if (productoMismoNombre) {
          // Actualizar cantidad existente y usar el último precio de venta
          const nuevaGananciaUnitaria = precioVenta - precioCoste;
          await executeNonQuery(
            "UPDATE AlmacenZona SET cantidad = cantidad + ?, precio_venta = ?, ganancia = ?, actualizado_en = ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
            [
              cantidad,
              precioVenta,
              nuevaGananciaUnitaria,
              productoMismoNombre.producto_id,
              puntoId,
            ],
          );
          console.log(
            `✅ Producto agrupado: "${producto.nombre}" actualizado con nuevo precio ${this.formatMoneda(precioVenta)} y cantidad +${cantidad}`,
          );
        } else {
          // Crear nuevo registro en zona de venta
          const ahora = getFechaLocal() + " " + new Date().toLocaleTimeString();
          await executeNonQuery(
            "INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia, creado_en, actualizado_en) VALUES (?, ?, 1, ?, ?, ?, ?, ?)",
            [
              productoId,
              puntoId,
              cantidad,
              precioVenta,
              gananciaUnitaria,
              ahora,
              ahora,
            ],
          );
          console.log(
            `✅ Nuevo producto creado: "${producto.nombre}" en zona de venta con precio ${this.formatMoneda(precioVenta)}`,
          );
        }

        // 7. Capturar stock DESPUÉS de la transferencia
        const stockDespuesAlmacen =
          (await getSingleValue<number>(
            "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
            [productoId, almacenOrigenId],
          )) || 0;

        // 8. Insertar SOLO UN registro en HistorialInventario (para el almacén específico)
        await this.insertarHistorialInventario(
          productoId,
          almacenOrigenId, // almacen_id específico
          null, // punto_id
          null, // zona_id
          "transferencia",
          -cantidad, // salida negativa
          stockAntesAlmacen,
          stockDespuesAlmacen,
          `Punto ${puntoId} - Zona de Venta`,
          `Transferencia de ${cantidad} unidades desde almacén ${almacenOrigenId} a zona de venta del Punto ${puntoId}`,
        );

        // 9. Registrar en historial con nota individual del stock restante
        const stockRestante = stockDespuesAlmacen || 0;
        const notas = `Transferencia desde Almacén ${almacenOrigenId} a Punto ${puntoId} (Quedaron: ${stockRestante} unidades)`;

        // Usar fecha local en lugar de UTC para el historial
        await executeNonQuery(
          "INSERT INTO LogTransferencia (producto_id, punto_id, cantidad, precio_venta, precio_coste_real, notas, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            productoId,
            puntoId,
            cantidad,
            precioVenta,
            precioCoste,
            notas,
            ahora,
          ],
        );

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: `Transferencia completada: ${cantidad} unidades movidas desde almacén específico a zona de venta`,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en transferirAlmacenEspecificoAZona:", error);
      return {
        success: false,
        message:
          error.message || "Error al transferir desde almacén específico",
      };
    }
  }

  // 27. ACTUALIZAR CANTIDAD EN ALMACÉN ESPECÍFICO - VERSIÓN REFACTORIZADA CON ajustarStock
  static async updateCantidadAlmacenEspecifico(
    productoId: number,
    almacenId: number,
    cantidad: number,
    operacion: "set" | "add" | "subtract" = "set",
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(
        `🔄 ACTUALIZANDO CANTIDAD EN ALMACÉN ESPECÍFICO (WRAPPER): productoId=${productoId}, almacenId=${almacenId}, cantidad=${cantidad}, operacion=${operacion}`,
      );

      // Convertir operación a delta
      let delta: number;
      switch (operacion) {
        case "set":
          // Para "set", necesitamos obtener el stock actual y calcular el delta
          const stockActual =
            (await getSingleValue<number>(
              "SELECT COALESCE(cantidad, 0) FROM AlmacenProducto WHERE producto_id = ? AND almacen_id = ?",
              [productoId, almacenId],
            )) || 0;
          delta = cantidad - stockActual;
          break;
        case "add":
          delta = cantidad;
          break;
        case "subtract":
          delta = -cantidad;
          break;
        default:
          return { success: false, message: "Operación no válida" };
      }

      console.log(`📊 Delta calculado: ${delta > 0 ? "+" : ""}${delta}`);

      // Usar la función centralizada ajustarStock
      const resultado = await AlmacenService.ajustarStock(
        productoId,
        almacenId,
        delta,
        `Ajuste manual (${operacion}) en Almacén ${almacenId}`,
      );

      if (!resultado.success) {
        return {
          success: false,
          message: resultado.message || "Error al ajustar stock",
        };
      }

      // Registrar en HistorialInventario si es necesario
      if (operacion !== "set") {
        await this.insertarHistorialInventario(
          productoId,
          almacenId,
          null, // punto_id
          null, // zona_id
          "ajuste",
          delta,
          0, // stock_anterior (no se usa en este wrapper)
          resultado.stockFinal || 0,
          `Almacén ${almacenId}`,
          `Ajuste manual: ${operacion} ${Math.abs(cantidad)} unidades`,
        );
      }

      return { success: true, message: "Cantidad actualizada correctamente" };
    } catch (error: any) {
      console.error("Error en updateCantidadAlmacenEspecifico:", error);
      return {
        success: false,
        message:
          error.message || "Error al actualizar cantidad en almacén específico",
      };
    }
  }

  // 28. ACTUALIZAR CANTIDAD EN PUNTO (ALMACÉN ZONA) - VERSIÓN REFACTORIZADA CON ajustarStockZona
  static async updateCantidadPunto(
    productoId: number,
    puntoId: number,
    cantidad: number,
    operacion: "set" | "add" | "subtract" = "set",
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(
        `🔄 ACTUALIZANDO CANTIDAD EN PUNTO (WRAPPER): productoId=${productoId}, puntoId=${puntoId}, cantidad=${cantidad}, operacion=${operacion}`,
      );

      // Convertir operación a delta
      let delta: number;
      switch (operacion) {
        case "set":
          // Para "set", necesitamos obtener el stock actual y calcular el delta
          const stockActual =
            (await getSingleValue<number>(
              "SELECT COALESCE(cantidad, 0) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 2",
              [productoId, puntoId],
            )) || 0;
          delta = cantidad - stockActual;
          break;
        case "add":
          delta = cantidad;
          break;
        case "subtract":
          delta = -cantidad;
          break;
        default:
          return { success: false, message: "Operación no válida" };
      }

      console.log(`📊 Delta calculado: ${delta > 0 ? "+" : ""}${delta}`);

      // Usar la función centralizada ajustarStockZona
      const resultado = await AlmacenService.ajustarStockZona(
        productoId,
        puntoId,
        2, // zona_id (2 = zona de puntos)
        delta,
        `Ajuste manual (${operacion}) en Punto ${puntoId}`,
      );

      if (!resultado.success) {
        return {
          success: false,
          message: resultado.message || "Error al ajustar stock en punto",
        };
      }

      // Registrar en HistorialInventario si es necesario
      if (operacion !== "set") {
        await this.insertarHistorialInventario(
          productoId,
          null, // almacen_id (null para zonas)
          puntoId,
          2, // zona_id (2 = zona de puntos)
          "ajuste",
          delta,
          0, // stock_anterior (no se usa en este wrapper)
          resultado.stockFinal || 0,
          `Punto ${puntoId} - Zona de Puntos`,
          `Ajuste manual: ${operacion} ${Math.abs(cantidad)} unidades`,
        );
      }

      return { success: true, message: "Cantidad actualizada correctamente" };
    } catch (error: any) {
      console.error("Error en updateCantidadPunto:", error);
      return {
        success: false,
        message: error.message || "Error al actualizar cantidad en punto",
      };
    }
  }

  // 29. ACTUALIZAR CANTIDAD EN ALMACÉN GENERAL - VERSIÓN REFACTORIZADA CON ajustarStock
  static async updateCantidadAlmacen(
    productoId: number,
    cantidad: number,
    operacion: "set" | "add" | "subtract" = "set",
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(
        `🔄 ACTUALIZANDO CANTIDAD EN ALMACÉN GENERAL (WRAPPER): productoId=${productoId}, cantidad=${cantidad}, operacion=${operacion}`,
      );

      // Convertir operación a delta
      let delta: number;
      switch (operacion) {
        case "set":
          // Para "set", necesitamos obtener el stock actual y calcular el delta
          const stockActual =
            (await getSingleValue<number>(
              "SELECT COALESCE(cantidad, 0) FROM Almacen WHERE producto_id = ?",
              [productoId],
            )) || 0;
          delta = cantidad - stockActual;
          break;
        case "add":
          delta = cantidad;
          break;
        case "subtract":
          delta = -cantidad;
          break;
        default:
          return { success: false, message: "Operación no válida" };
      }

      console.log(`📊 Delta calculado: ${delta > 0 ? "+" : ""}${delta}`);

      // Para el almacén general, usamos un almacén virtual ID 0
      // Pero como ajustarStock requiere un almacenId válido, usamos 0 como identificador
      const resultado = await AlmacenService.ajustarStock(
        productoId,
        0, // ID 0 para almacén general
        delta,
        `Ajuste manual (${operacion}) en Almacén General`,
      );

      if (!resultado.success) {
        return {
          success: false,
          message:
            resultado.message || "Error al ajustar stock en almacén general",
        };
      }

      // Actualizar directamente en la tabla Almacen (para compatibilidad)
      if (operacion === "set") {
        // Usar fecha local en lugar de UTC
        const { getFechaHoraLocalCompleta } =
          await import("../../utils/dateUtils");
        const ahora = getFechaHoraLocalCompleta();

        await executeNonQuery(
          "INSERT OR REPLACE INTO Almacen (producto_id, cantidad, actualizado_en) VALUES (?, ?, ?)",
          [productoId, Math.max(0, cantidad), ahora],
        );
      }

      // Registrar en HistorialInventario si es necesario
      if (operacion !== "set") {
        await this.insertarHistorialInventario(
          productoId,
          null, // almacen_id (null para almacén general)
          null, // punto_id
          null, // zona_id
          "ajuste",
          delta,
          0, // stock_anterior (no se usa en este wrapper)
          resultado.stockFinal || 0,
          "Almacén General",
          `Ajuste manual: ${operacion} ${Math.abs(cantidad)} unidades`,
        );
      }

      return { success: true, message: "Cantidad actualizada correctamente" };
    } catch (error: any) {
      console.error("Error en updateCantidadAlmacen:", error);
      return {
        success: false,
        message: error.message || "Error al actualizar cantidad en almacén",
      };
    }
  }

  // 30. CREAR PRODUCTO DIRECTO EN ZONA DE VENTA
  static async createProductoDirectoEnZonaVenta(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number,
    puntoId: number,
    precio_venta: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    try {
      console.log(
        `🔄 CREANDO PRODUCTO DIRECTO EN ZONA DE VENTA: ${nombre}, cantidad: ${cantidad}, punto: ${puntoId}, precio_venta: ${precio_venta}`,
      );

      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 1. Buscar si existe un producto con el mismo nombre en la zona de venta del punto
        const productoExistente = await getFirst<any>(
          `SELECT az.*, p.nombre as nombre_producto, p.precio_coste as precio_coste_producto
           FROM AlmacenZona az 
           INNER JOIN Producto p ON az.producto_id = p.id 
           WHERE TRIM(p.nombre) = TRIM(?) AND az.punto_id = ? AND az.zona_id = 1`,
          [nombre, puntoId],
        );

        if (productoExistente) {
          console.log(
            `✅ Producto existente encontrado: ID ${productoExistente.producto_id}`,
          );

          // 2. Determinar los precios más beneficiosos
          const precioVentaActual = productoExistente.precio_venta;
          const precioCosteActual = productoExistente.precio_coste_producto;
          const nuevoPrecioVenta =
            precio_venta > precioVentaActual ? precio_venta : precioVentaActual;
          const nuevoPrecioCoste =
            precio_coste < precioCosteActual ? precio_coste : precioCosteActual;
          const nuevaGanancia = nuevoPrecioVenta - nuevoPrecioCoste;

          // 3. Actualizar cantidad y precios en la zona de venta
          await executeNonQuery(
            "UPDATE AlmacenZona SET cantidad = cantidad + ?, precio_venta = ?, ganancia = ?, actualizado_en = ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
            [
              cantidad,
              nuevoPrecioVenta,
              nuevaGanancia,
              productoExistente.producto_id,
              puntoId,
            ],
          );

          console.log(
            `✅ Producto actualizado: cantidad +${cantidad}, nuevo precio venta: ${nuevoPrecioVenta}, nuevo precio coste: ${nuevoPrecioCoste}`,
          );

          // 5. Registrar en historial de transferencias
          await executeNonQuery(
            "INSERT INTO LogTransferencia (producto_id, punto_id, cantidad, precio_venta, precio_coste_real) VALUES (?, ?, ?, ?, ?)",
            [
              productoExistente.producto_id,
              puntoId,
              cantidad,
              nuevoPrecioVenta,
              nuevoPrecioCoste,
            ],
          );

          await executeNonQuery("COMMIT");

          return {
            success: true,
            message: `Producto existente actualizado: cantidad agregada y precios optimizados. Precio venta: $${nuevoPrecioVenta.toFixed(2)}, Precio coste: $${nuevoPrecioCoste.toFixed(2)}`,
            productoId: productoExistente.producto_id,
          };
        } else {
          // 6. Si no existe, crear nuevo producto
          console.log(`➕ Creando nuevo producto...`);

          const productoResult = await executeNonQuery(
            `INSERT INTO Producto (nombre, categoria, subcategoria, precio_coste, fecha_caducidad, formato_almacen, unidades_por_formato) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              nombre,
              categoria,
              subcategoria,
              precio_coste,
              fecha_caducidad || null,
              formato_almacen || null,
              unidades_por_formato || null,
            ],
          );

          const productoId = productoResult.lastInsertRowId;
          console.log(`✅ Producto creado con ID: ${productoId}`);

          // 7. Calcular ganancia
          const ganancia = precio_venta - precio_coste;

          // 8. Agregar directamente a la zona de venta del punto (zona_id = 1)
          const ahora = getFechaLocal() + " " + new Date().toLocaleTimeString();
          await executeNonQuery(
            `INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia, creado_en, actualizado_en) 
             VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
            [
              productoId,
              puntoId,
              cantidad,
              precio_venta,
              ganancia,
              ahora,
              ahora,
            ],
          );
          console.log(
            `✅ Producto agregado a zona de venta del punto ${puntoId}`,
          );

          // 9. Registrar en historial de transferencias (para mantener consistencia)
          // Usar fecha local en lugar de UTC para el historial
          const { getFechaHoraLocalCompleta } =
            await import("../../utils/dateUtils");
          const ahoraHistorial = getFechaHoraLocalCompleta();

          await executeNonQuery(
            "INSERT INTO LogTransferencia (producto_id, punto_id, cantidad, precio_venta, precio_coste_real, creado_en) VALUES (?, ?, ?, ?, ?, ?)",
            [
              productoId,
              puntoId,
              cantidad,
              precio_venta,
              precio_coste,
              ahoraHistorial,
            ],
          );
          console.log(`✅ Transferencia registrada en historial`);

          await executeNonQuery("COMMIT");

          return {
            success: true,
            message: `Producto creado y agregado directamente a zona de venta correctamente`,
            productoId,
          };
        }
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en createProductoDirectoEnZonaVenta:", error);
      return {
        success: false,
        message:
          error.message || "Error al crear producto directo en zona de venta",
      };
    }
  }

  // 27. FORMATEAR MONEDA
  // 25. CREAR PRODUCTO DIRECTAMENTE EN ALMACÉN ESPECÍFICO (SIN UNIFICACIÓN)
  static async createProductoDirectoEnAlmacen(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number,
    almacenId: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
    descripcion?: string,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    try {
      console.log(
        `🔄 CREANDO PRODUCTO DIRECTO EN ALMACÉN ESPECÍFICO: ${nombre}, cantidad: ${cantidad}, almacén: ${almacenId}`,
      );

      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 1. Crear el producto en la tabla Producto
        const productoResult = await executeNonQuery(
          `INSERT INTO Producto (nombre, categoria, subcategoria, precio_coste, fecha_caducidad, formato_almacen, unidades_por_formato, descripcion) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nombre,
            categoria,
            subcategoria,
            precio_coste,
            fecha_caducidad || null,
            formato_almacen || null,
            unidades_por_formato || null,
            descripcion || null,
          ],
        );

        const productoId = productoResult.lastInsertRowId;
        console.log(`✅ Producto creado con ID: ${productoId}`);

        // 2. Crear el stock directamente en el almacén específico
        if (cantidad > 0) {
          const ahora = getFechaLocal() + " " + new Date().toLocaleTimeString();
          await executeNonQuery(
            "INSERT INTO AlmacenProducto (producto_id, almacen_id, cantidad, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
            [productoId, almacenId, cantidad, ahora, ahora],
          );
          console.log(
            `📦 Stock creado directamente en almacén ${almacenId}: ${cantidad} unidades (inicial: ${cantidad})`,
          );

          // Registrar en HistorialInventario
          await this.insertarHistorialInventario(
            productoId,
            almacenId, // almacen_id específico
            null, // punto_id
            null, // zona_id
            "creacion", // tipo_movimiento
            cantidad, // cantidad_variación positiva
            0, // stock_anterior
            cantidad, // stock_nuevo
            "Creación inicial",
            `Producto creado con ${cantidad} unidades iniciales en almacén ${almacenId}`,
          );
        }

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: `Producto creado directamente en almacén con ${cantidad} unidades`,
          productoId,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en createProductoDirectoEnAlmacen:", error);
      return {
        success: false,
        message:
          error.message ||
          "Error al crear producto directamente en almacén específico",
      };
    }
  }

  // 26. CREAR PRODUCTO DIRECTAMENTE EN PUNTO (SIN UNIFICACIÓN)
  static async createProductoDirectoEnPunto(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number,
    puntoId: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
    descripcion?: string,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    try {
      console.log(
        `🔄 CREANDO PRODUCTO DIRECTO EN PUNTO: ${nombre}, cantidad: ${cantidad}, punto: ${puntoId}`,
      );

      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 1. Crear el producto en la tabla Producto
        const productoResult = await executeNonQuery(
          `INSERT INTO Producto (nombre, categoria, subcategoria, precio_coste, fecha_caducidad, formato_almacen, unidades_por_formato, descripcion) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nombre,
            categoria,
            subcategoria,
            precio_coste,
            fecha_caducidad || null,
            formato_almacen || null,
            unidades_por_formato || null,
            descripcion || null,
          ],
        );

        const productoId = productoResult.lastInsertRowId;
        console.log(`✅ Producto creado con ID: ${productoId}`);

        // 2. Crear el stock directamente en el almacén del punto (zona_id = 2)
        if (cantidad > 0) {
          const ahora = getFechaLocal() + " " + new Date().toLocaleTimeString();
          await executeNonQuery(
            "INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia, creado_en, actualizado_en) VALUES (?, ?, 2, ?, ?, ?, ?, ?)",
            [productoId, puntoId, cantidad, 0, 0, ahora, ahora],
          );
          console.log(
            `📦 Stock creado directamente en punto ${puntoId}: ${cantidad} unidades`,
          );

          // Registrar en HistorialInventario
          await this.insertarHistorialInventario(
            productoId,
            null, // almacen_id (null para punto)
            puntoId, // punto_id específico
            2, // zona_id (almacén del punto)
            "creacion", // tipo_movimiento
            cantidad, // cantidad_variación positiva
            0, // stock_anterior
            cantidad, // stock_nuevo
            "Creación inicial",
            `Producto creado con ${cantidad} unidades iniciales en punto ${puntoId}`,
          );
        }

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: `Producto creado directamente en punto con ${cantidad} unidades`,
          productoId,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en createProductoDirectoEnPunto:", error);
      return {
        success: false,
        message:
          error.message || "Error al crear producto directamente en punto",
      };
    }
  }

  // 27. CREAR PRODUCTO DIRECTAMENTE EN ALMACÉN GENERAL (SIN UNIFICACIÓN)
  static async createProductoDirectoEnAlmacenGeneral(
    nombre: string,
    categoria: string,
    subcategoria: string,
    precio_coste: number,
    cantidad: number,
    fecha_caducidad?: string,
    formato_almacen?: string,
    unidades_por_formato?: number,
    cantidad_inicial?: number,
    descripcion?: string,
  ): Promise<{ success: boolean; message: string; productoId?: number }> {
    try {
      console.log(
        `🔄 CREANDO PRODUCTO DIRECTO EN ALMACÉN GENERAL: ${nombre}, cantidad: ${cantidad}`,
      );

      await executeNonQuery("BEGIN TRANSACTION");

      try {
        // 1. Crear el producto en la tabla Producto
        const productoResult = await executeNonQuery(
          `INSERT INTO Producto (nombre, categoria, subcategoria, precio_coste, fecha_caducidad, formato_almacen, unidades_por_formato, descripcion) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nombre,
            categoria,
            subcategoria,
            precio_coste,
            fecha_caducidad || null,
            formato_almacen || null,
            unidades_por_formato || null,
            descripcion || null,
          ],
        );

        const productoId = productoResult.lastInsertRowId;
        console.log(`✅ Producto creado con ID: ${productoId}`);

        // 2. Crear el stock directamente en el almacén general
        if (cantidad > 0) {
          await executeNonQuery(
            "INSERT INTO Almacen (producto_id, cantidad, cantidad_inicial) VALUES (?, ?, ?)",
            [productoId, cantidad, cantidad],
          );
          console.log(
            `📦 Stock creado directamente en almacén general: ${cantidad} unidades (inicial: ${cantidad})`,
          );

          // Registrar en HistorialInventario
          await this.insertarHistorialInventario(
            productoId,
            0, // almacen_id (0 para almacén general)
            null, // punto_id
            null, // zona_id
            "creacion", // tipo_movimiento
            cantidad, // cantidad_variación positiva
            0, // stock_anterior
            cantidad, // stock_nuevo
            "Creación inicial",
            `Producto creado con ${cantidad} unidades iniciales en almacén general`,
          );
        }

        await executeNonQuery("COMMIT");

        return {
          success: true,
          message: `Producto creado directamente en almacén general con ${cantidad} unidades`,
          productoId,
        };
      } catch (error) {
        await executeNonQuery("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error en createProductoDirectoEnAlmacenGeneral:", error);
      return {
        success: false,
        message:
          error.message ||
          "Error al crear producto directamente en almacén general",
      };
    }
  }

  static formatMoneda(monto: number): string {
    return new Intl.NumberFormat("es-CU", {
      style: "currency",
      currency: "CUP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  }
}
