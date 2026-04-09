// src/db/services/venta_service.ts - VERSIÓN CORREGIDA
import { getFechaLocal } from "../../utils/dateUtils";
import { db } from "../database";
import {
    OfertaHelper,
    PrestamoDeudaHelper,
    PuntoHelper,
    VentaHelper,
} from "../databaseHelper";

// Tipos
export interface ProductoVenta {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste: number;
  precio_venta: number;
  ganancia: number;
  cantidad: number;
  cantidadSeleccionada: number;
  disponible: number;
  precio_coste_real?: number; // <--- CORRECCIÓN: Mover aquí y hacer opcional
  estado_vencimiento?:
    | "vencido"
    | "por_vencer_rojo"
    | "por_vencer_naranja"
    | "seguro";
  dias_restantes?: number;
}

export interface ItemOrden {
  productoId: number;
  nombre: string;
  precioVenta: number;
  cantidad: number;
  subtotal: number;
  tipoPago?: string;
  metodoTransferencia?: string;
  precioCostoReal?: number;
}

export interface DatosVenta {
  puntoId: number;
  orden: ItemOrden[];
  totalOrden: number;
  ofertaActiva?: any;
}

export interface ResultadoVenta {
  success: boolean;
  ventaId?: number;
  error?: string;
  ventasEfectivo?: number;
  ventasTransferencia?: number;
}

export interface ResultadoDeuda {
  success: boolean;
  error?: string;
}

// Tipo para el resultado de la consulta de producto
interface ProductoDB {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste?: number;
  estado_vencimiento?: string;
  dias_restantes?: number;
  cantidad: number;
  zona_id: number;
  precio_venta?: number;
}

export class VentaService {
  /**
   * Obtener productos en zona de venta para un punto específico
   */
  async getProductosEnZonaVenta(puntoId: number): Promise<ProductoVenta[]> {
    try {
      // CONSULTA CORREGIDA: precio_venta viene de AlmacenZona, no de Producto
      const productos = await db.getAllAsync<ProductoDB>(
        `SELECT 
          p.id,
          p.nombre,
          p.categoria,
          p.subcategoria,
          p.precio_coste,
          p.estado_vencimiento,
          p.dias_restantes,
          az.cantidad,
          az.zona_id,
          az.precio_venta  -- ¡IMPORTANTE: precio_venta viene de AlmacenZona!
        FROM Producto p
        INNER JOIN AlmacenZona az ON p.id = az.producto_id
        WHERE az.punto_id = ? AND az.zona_id = 1
        ORDER BY p.categoria, p.nombre`,
        [puntoId],
      );

      return productos.map((p) => {
        const precioVenta = p.precio_venta || 0;
        const precioCosto = p.precio_coste || 0;
        const ganancia = precioVenta - precioCosto;

        return {
          id: p.id,
          nombre: p.nombre,
          categoria: p.categoria,
          subcategoria: p.subcategoria,
          precio_coste: precioCosto,
          precio_venta: precioVenta,
          ganancia: ganancia,
          cantidad: p.cantidad || 0,
          cantidadSeleccionada: 0,
          disponible: p.cantidad || 0,
          precio_coste_real: p.precio_coste,
          estado_vencimiento: p.estado_vencimiento as any,
          dias_restantes: p.dias_restantes,
        };
      });
    } catch (error) {
      console.error("Error obteniendo productos en zona de venta:", error);
      throw error;
    }
  }

  /**
   * Separar productos con y sin precio
   */
  separarProductosPorPrecio(productos: ProductoVenta[]): {
    conPrecio: ProductoVenta[];
    sinPrecio: ProductoVenta[];
  } {
    const conPrecio = productos.filter(
      (p) => p.precio_venta && p.precio_venta > 0,
    );
    const sinPrecio = productos.filter(
      (p) => !p.precio_venta || p.precio_venta === 0,
    );

    return { conPrecio, sinPrecio };
  }

  /**
   * Obtener categorías únicas de productos
   */
  getCategoriasUnicas(productos: ProductoVenta[]): string[] {
    return [...new Set(productos.map((p) => p.categoria))];
  }

  /**
   * Actualizar cantidad seleccionada de un producto
   */
  actualizarCantidadSeleccionada(
    productos: ProductoVenta[],
    productoId: number,
    incremento: number,
  ): ProductoVenta[] {
    return productos.map((p) => {
      if (p.id === productoId) {
        const nuevaCantidad = Math.max(
          0,
          Math.min(p.disponible, p.cantidadSeleccionada + incremento),
        );
        return { ...p, cantidadSeleccionada: nuevaCantidad };
      }
      return p;
    });
  }

  /**
   * Crear deuda para un producto
   */
  async crearDeuda(
    item: ItemOrden,
    puntoId: number,
    puntoNombre: string = "N/A",
  ): Promise<ResultadoDeuda> {
    try {
      const descripcion = `${item.cantidad} x ${item.nombre} (Punto: ${puntoNombre})`;

      const result = await PrestamoDeudaHelper.create(
        "deuda",
        descripcion,
        item.subtotal,
        getFechaLocal(),
        // Fecha de vencimiento a 30 días usando fecha local
        (() => {
          const fechaVence = new Date();
          fechaVence.setDate(fechaVence.getDate() + 30);
          const año = fechaVence.getFullYear();
          const mes = String(fechaVence.getMonth() + 1).padStart(2, "0");
          const día = String(fechaVence.getDate()).padStart(2, "0");
          return `${año}-${mes}-${día}`;
        })(),
        puntoId,
        "CUP",
        `Venta en deuda: ${item.nombre}`,
      );

      if (result.lastInsertRowId > 0) {
        // Actualizar stock del producto en ZONA DE VENTA
        await db.runAsync(
          "UPDATE AlmacenZona SET cantidad = cantidad - ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
          [item.cantidad, item.productoId, puntoId],
        );

        return { success: true };
      } else {
        return { success: false, error: "No se pudo crear la deuda" };
      }
    } catch (error: any) {
      console.error("Error creando deuda:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Aplicar descuento según oferta activa
   */
  aplicarDescuento(
    subtotal: number,
    tipoPago: string,
    ofertaActiva: any,
  ): number {
    if (tipoPago === "transferencia" && ofertaActiva && ofertaActiva.activa) {
      if (ofertaActiva.tipo === "porcentaje") {
        return subtotal * (1 - ofertaActiva.valor / 100);
      } else if (ofertaActiva.tipo === "valor") {
        return Math.max(0, subtotal - ofertaActiva.valor);
      }
    }
    return subtotal;
  }

  /**
   * Obtener precio de costo real del producto
   */
  private async getPrecioCostoReal(productoId: number): Promise<number> {
    try {
      // Buscar directamente en la base de datos
      const result = await db.getFirstAsync<{ precio_coste: number }>(
        "SELECT precio_coste FROM Producto WHERE id = ?",
        [productoId],
      );

      return result?.precio_coste || 0;
    } catch (error) {
      console.error("Error obteniendo precio costo real:", error);
      return 0;
    }
  }

  /**
   * Finalizar venta completa
   */
  async finalizarVenta(datosVenta: DatosVenta): Promise<ResultadoVenta> {
    try {
      const { orden, puntoId, totalOrden } = datosVenta;

      // Calcular totales por tipo de pago
      const ventasEfectivo = orden
        .filter((o) => o.tipoPago === "efectivo")
        .reduce((sum, o) => sum + o.subtotal, 0);

      const ventasTransferencia = orden
        .filter((o) => o.tipoPago === "transferencia")
        .reduce((sum, o) => sum + o.subtotal, 0);

      // Determinar tipo de pago general
      let tipoPagoGeneral: "efectivo" | "transferencia" | "mixto" = "efectivo";
      if (ventasEfectivo > 0 && ventasTransferencia > 0) {
        tipoPagoGeneral = "mixto";
      } else if (ventasTransferencia > 0) {
        tipoPagoGeneral = "transferencia";
      }

      // Para ventas mixtas, obtener método de transferencia del primer item de transferencia
      let metodoTransferenciaGeneral: string | undefined = undefined;
      if (tipoPagoGeneral === "transferencia" || tipoPagoGeneral === "mixto") {
        const primerItemTransferencia = orden.find(
          (o) => o.tipoPago === "transferencia",
        );
        metodoTransferenciaGeneral =
          primerItemTransferencia?.metodoTransferencia;
      }

      // Crear venta principal
      const ventaResult = await VentaHelper.crearVenta(
        puntoId,
        totalOrden,
        tipoPagoGeneral,
        ventasEfectivo,
        ventasTransferencia,
        metodoTransferenciaGeneral,
      );

      const ventaId = ventaResult.lastInsertRowId;

      if (!ventaId) {
        return { success: false, error: "No se pudo crear la venta principal" };
      }

      // Agregar detalles de venta y actualizar stock
      for (const item of orden) {
        // CALCULAR PRECIO REAL: Dividir el subtotal (que ya tiene el descuento)
        // entre la cantidad de unidades para obtener el precio real de venta.
        const precioUnitarioReal = item.subtotal / item.cantidad;

        // Agregar detalle de venta con precio real
        await VentaHelper.agregarDetalleVenta(
          ventaId,
          item.productoId,
          item.cantidad,
          precioUnitarioReal, // <--- CAMBIO CLAVE: Usar precio real con descuento
          item.subtotal,
        );

        // Actualizar stock en ZONA DE VENTA (zona_id = 1)
        await db.runAsync(
          "UPDATE AlmacenZona SET cantidad = cantidad - ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
          [item.cantidad, item.productoId, puntoId],
        );
      }

      return {
        success: true,
        ventaId,
        ventasEfectivo,
        ventasTransferencia,
      };
    } catch (error: any) {
      console.error("Error finalizando venta:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Dar de baja producto de la zona de venta
   */
  async darDeBajaProducto(
    productoId: number,
    puntoId: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Mover producto de zona de venta (zona_id = 1) a almacén del punto (zona_id = 2)
      await db.runAsync(
        `UPDATE AlmacenZona 
         SET zona_id = 2 
         WHERE producto_id = ? AND punto_id = ? AND zona_id = 1`,
        [productoId, puntoId],
      );

      return { success: true };
    } catch (error: any) {
      console.error("Error dando de baja:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Establecer precio de venta para producto nuevo
   */
  async establecerPrecioVenta(
    productoId: number,
    puntoId: number,
    precioVenta: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (precioVenta <= 0) {
        return { success: false, error: "Ingresa un precio válido" };
      }

      await db.runAsync(
        "UPDATE AlmacenZona SET precio_venta = ? WHERE producto_id = ? AND punto_id = ? AND zona_id = 1",
        [precioVenta, productoId, puntoId],
      );

      return { success: true };
    } catch (error: any) {
      console.error("Error actualizando precio:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Filtrar productos por categoría y nombre
   */
  filtrarProductos(
    productos: ProductoVenta[],
    filtroCategoria: string,
    filtroNombre: string,
  ): ProductoVenta[] {
    return productos.filter((p) => {
      const coincideCategoria =
        !filtroCategoria || p.categoria === filtroCategoria;
      const coincideNombre =
        !filtroNombre ||
        p.nombre.toLowerCase().includes(filtroNombre.toLowerCase());
      return coincideCategoria && coincideNombre;
    });
  }

  /**
   * Formatear moneda
   */
  formatMoneda(monto: number): string {
    return new Intl.NumberFormat("es-CU", {
      style: "currency",
      currency: "CUP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  }

  /**
   * Obtener color según estado de vencimiento
   */
  getColorVencimiento(estado?: string): string {
    switch (estado) {
      case "vencido":
        return "#ef4444";
      case "por_vencer_rojo":
        return "#ef4444";
      case "por_vencer_naranja":
        return "#f59e0b";
      case "seguro":
        return "#10b981";
      default:
        return "#6b7280";
    }
  }

  /**
   * Obtener emoji según categoría
   */
  getEmojiCategoria(categoria: string): string {
    switch (categoria.toLowerCase()) {
      case "panadería":
      case "pan":
        return "🥖";
      case "bebidas":
        return "🥤";
      case "lácteos":
      case "leche":
        return "🥛";
      case "frutas":
        return "🍎";
      case "verduras":
        return "🥬";
      case "carnes":
        return "🥩";
      case "pescado":
        return "🐟";
      case "huevos":
        return "🥚";
      case "aceite":
        return "🫒";
      case "arroz":
        return "🍚";
      case "azúcar":
        return "🍬";
      case "sal":
        return "🧂";
      case "café":
        return "☕";
      case "dulces":
        return "🍫";
      default:
        return "🛒";
    }
  }

  /**
   * Obtener texto de vencimiento
   */
  getTextoVencimiento(estado?: string, dias?: number): string {
    if (!estado) return "";

    switch (estado) {
      case "vencido":
        return `VENCIDO hace ${Math.abs(dias || 0)} días`;
      case "por_vencer_rojo":
        return `VENCE en ${dias || 0} días`;
      case "por_vencer_naranja":
        return `VENCE en ${dias || 0} días`;
      case "seguro":
        return `VENCE en ${dias || 0}+ días`;
      default:
        return "";
    }
  }

  /**
   * Calcular total de la orden
   */
  calcularTotalOrden(orden: ItemOrden[]): number {
    return orden.reduce((sum, item) => sum + item.subtotal, 0);
  }

  /**
   * Obtener información del punto
   */
  async getPuntoInfo(puntoId: number): Promise<any> {
    try {
      return await PuntoHelper.getById(puntoId);
    } catch (error) {
      console.error("Error obteniendo información del punto:", error);
      return null;
    }
  }

  /**
   * Obtener oferta activa para el punto
   */
  async getOfertaActiva(puntoId: number): Promise<any> {
    try {
      return await OfertaHelper.getOfertaActiva(puntoId);
    } catch (error) {
      console.error("Error obteniendo oferta activa:", error);
      return null;
    }
  }

  /**
   * Crear item para la orden
   */
  crearItemOrden(
    producto: ProductoVenta,
    tipoPago?: string,
    metodoTransferencia?: string,
    ofertaActiva?: any,
  ): ItemOrden {
    let subtotal = producto.precio_venta * producto.cantidadSeleccionada;

    // Aplicar descuento si es transferencia y hay oferta activa
    if (tipoPago === "transferencia" && ofertaActiva?.activa) {
      subtotal = this.aplicarDescuento(subtotal, tipoPago, ofertaActiva);
    }

    return {
      productoId: producto.id,
      nombre: producto.nombre,
      precioVenta: producto.precio_venta,
      cantidad: producto.cantidadSeleccionada,
      subtotal,
      tipoPago,
      metodoTransferencia,
      precioCostoReal: producto.precio_coste_real,
    };
  }

  /**
   * Validar si se puede agregar a la orden
   */
  validarAgregarALaOrden(cantidadSeleccionada: number): boolean {
    return cantidadSeleccionada > 0;
  }

  /**
   * Remover item de la orden
   */
  removerDeOrden(orden: ItemOrden[], index: number): ItemOrden[] {
    const nuevaOrden = [...orden];
    nuevaOrden.splice(index, 1);
    return nuevaOrden;
  }

  /**
   * Limpiar cantidad seleccionada de producto
   */
  limpiarCantidadSeleccionada(
    productos: ProductoVenta[],
    productoId: number,
  ): ProductoVenta[] {
    return productos.map((p) => {
      if (p.id === productoId) {
        return { ...p, cantidadSeleccionada: 0 };
      }
      return p;
    });
  }

  /**
   * Resetear estados después del pago
   */
  resetearDespuesDePago(
    productos: ProductoVenta[],
    productoId: number,
  ): ProductoVenta[] {
    return this.limpiarCantidadSeleccionada(productos, productoId);
  }

  /**
   * Cargar todos los datos iniciales para la pantalla de venta
   */
  async cargarDatos(puntoId: number): Promise<{
    punto: any;
    productos: ProductoVenta[];
    productosNuevos: ProductoVenta[];
    categorias: string[];
    ofertaActiva: any;
    descuentoTransferencia: number;
  }> {
    try {
      // Cargar información del punto
      const punto = await this.getPuntoInfo(puntoId);

      // Obtener productos en zona de venta
      const productosZonaVenta = await this.getProductosEnZonaVenta(puntoId);

      // Separar productos con y sin precio
      const { conPrecio, sinPrecio } =
        this.separarProductosPorPrecio(productosZonaVenta);

      // Extraer categorías únicas
      const categorias = this.getCategoriasUnicas(conPrecio);

      // Cargar oferta activa
      const ofertaActiva = await this.getOfertaActiva(puntoId);

      // Calcular descuento para transferencia
      let descuentoTransferencia = 0;
      if (ofertaActiva && ofertaActiva.activa) {
        if (ofertaActiva.tipo === "porcentaje") {
          descuentoTransferencia = ofertaActiva.valor;
        } else if (ofertaActiva.tipo === "valor") {
          descuentoTransferencia = 0;
        }
      }

      return {
        punto,
        productos: conPrecio,
        productosNuevos: sinPrecio,
        categorias,
        ofertaActiva,
        descuentoTransferencia,
      };
    } catch (error) {
      console.error("Error cargando datos:", error);
      throw error;
    }
  }

  /**
   * Agregar producto a la orden con validación
   */
  agregarALaOrden(
    producto: ProductoVenta,
    ordenActual: ItemOrden[],
    tipoPago?: string,
    metodoTransferencia?: string,
    ofertaActiva?: any,
  ): ItemOrden {
    if (!this.validarAgregarALaOrden(producto.cantidadSeleccionada)) {
      throw new Error("Selecciona al menos 1 unidad");
    }

    return this.crearItemOrden(
      producto,
      tipoPago,
      metodoTransferencia,
      ofertaActiva,
    );
  }

  /**
   * Confirmar método de pago con validaciones
   */
  validarMetodoPago(
    tipoPago: string,
    metodoTransferencia: string,
  ): { valido: boolean; error?: string } {
    if (tipoPago === "transferencia" && !metodoTransferencia) {
      return { valido: false, error: "Selecciona un método de transferencia" };
    }
    return { valido: true };
  }

  /**
   * Calcular total de la orden (alias para consistencia)
   */
  calcularTotal(orden: ItemOrden[]): number {
    return this.calcularTotalOrden(orden);
  }
}

// Exportar instancia singleton
export const ventaService = new VentaService();
