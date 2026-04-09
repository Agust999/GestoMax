// app/precios.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoPrint from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSaveNavigationState } from "../components/NavigationPersistence";
import { executeQuery } from "../src/db/database";
import { AuthService } from "../src/db/services/auth_service";

interface ProductoConPrecio {
  id: number;
  nombre: string;
  categoria: string;
  subcategoria: string;
  precio_coste_max: number;
  precio_con_30: number;
  fecha_vencimiento: string | null;
  precio_venta: number | null;
  tope_precio: number | null;
  precio_coste_temporal?: number;
}

export default function PreciosScreen() {
  const params = useLocalSearchParams();
  const puntoId = params.puntoId ? parseInt(params.puntoId as string) : null;
  const puntoNombre = (params.puntoNombre as string) || "Punto";

  // Guardar estado de navegación automáticamente
  const { navigateWithSave } = useSaveNavigationState("/precios", params);

  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<ProductoConPrecio[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [progresoPDF, setProgresoPDF] = useState(0);
  const [mostrarModalProgreso, setMostrarModalProgreso] = useState(false);
  const [mostrarModalTope, setMostrarModalTope] = useState(false);
  const [mostrarModalTopesMasivo, setMostrarModalTopesMasivo] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<ProductoConPrecio | null>(null);
  const [nuevoTope, setNuevoTope] = useState("");
  const [topesTemporales, setTopesTemporales] = useState<{
    [key: string]: string;
  }>({});
  const [mostrarModalCostos, setMostrarModalCostos] = useState(false);
  const [costosTemporales, setCostosTemporales] = useState<{
    [key: string]: string;
  }>({});
  const router = useRouter();
  const [authModalVisible, setAuthModalVisible] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Función para obtener la fecha de vencimiento más próxima de un producto
  const getFechaVencimientoProxima = async (
    nombre: string,
  ): Promise<string | null> => {
    try {
      const nombreLimpio = nombre.trim();
      const result = await executeQuery(
        "SELECT MIN(fecha_caducidad) as fecha_proxima FROM Producto WHERE TRIM(nombre) = ? AND fecha_caducidad IS NOT NULL AND fecha_caducidad != ''",
        [nombreLimpio],
      );
      return result[0]?.fecha_proxima || null;
    } catch (error) {
      console.error("Error obteniendo fecha de vencimiento próxima:", error);
      return null;
    }
  };

  // Función para verificar si la tabla TopePrecio existe
  const verificarTablaTopePrecio = async (): Promise<boolean> => {
    try {
      const result = await executeQuery(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='TopePrecio'",
      );
      return (result[0]?.count || 0) > 0;
    } catch (error) {
      console.error("Error verificando tabla TopePrecio:", error);
      return false;
    }
  };

  // Función para obtener el tope de precio de un producto
  const getTopePrecio = async (nombre: string): Promise<number | null> => {
    try {
      // Primero verificar si la tabla existe
      const tablaExiste = await verificarTablaTopePrecio();
      if (!tablaExiste) {
        return null;
      }

      const nombreLimpio = nombre.trim();
      const result = await executeQuery(
        "SELECT tope_precio FROM TopePrecio WHERE TRIM(nombre) = ? LIMIT 1",
        [nombreLimpio],
      );
      return result[0]?.tope_precio || null;
    } catch (error) {
      console.error("Error obteniendo tope de precio:", error);
      return null;
    }
  };

  // Función para guardar o actualizar el tope de precio
  const guardarTopePrecio = async (
    nombre: string,
    tope: number,
  ): Promise<void> => {
    try {
      // Primero verificar si la tabla existe
      const tablaExiste = await verificarTablaTopePrecio();
      if (!tablaExiste) {
        throw new Error(
          "La función de topes de precio no está disponible. Reinicie la aplicación para activarla.",
        );
      }

      const nombreLimpio = nombre.trim();

      // Verificar si ya existe un tope para este producto
      const existente = await executeQuery(
        "SELECT id FROM TopePrecio WHERE TRIM(nombre) = ? LIMIT 1",
        [nombreLimpio],
      );

      if (existente.length > 0) {
        // Actualizar tope existente
        await executeQuery(
          "UPDATE TopePrecio SET tope_precio = ? WHERE TRIM(nombre) = ?",
          [tope, nombreLimpio],
        );
      } else {
        // Insertar nuevo tope
        await executeQuery(
          "INSERT INTO TopePrecio (nombre, tope_precio) VALUES (?, ?)",
          [nombreLimpio, tope],
        );
      }
    } catch (error) {
      console.error("Error guardando tope de precio:", error);
      throw error;
    }
  };

  // Función para guardar todos los topes masivamente
  const guardarTopesMasivos = async (): Promise<void> => {
    try {
      const tablaExiste = await verificarTablaTopePrecio();
      if (!tablaExiste) {
        throw new Error(
          "La función de topes de precio no está disponible. Reinicie la aplicación para activarla.",
        );
      }

      let guardados = 0;
      let errores = 0;

      for (const [nombreProducto, topeStr] of Object.entries(topesTemporales)) {
        if (topeStr && topeStr.trim() !== "") {
          const topeNum = parseFloat(topeStr);
          if (!isNaN(topeNum)) {
            try {
              if (topeNum > 0) {
                // Guardar tope normal
                await guardarTopePrecio(nombreProducto, topeNum);
                guardados++;
              } else {
                // Valor 0 significa eliminar el tope (producto no topado)
                await eliminarTopePrecio(nombreProducto);
                guardados++;
              }
            } catch (error) {
              console.error(
                `Error guardando tope para ${nombreProducto}:`,
                error,
              );
              errores++;
            }
          }
        }
      }

      if (guardados > 0) {
        Alert.alert(
          "Operación Completada",
          `Se procesaron ${guardados} productos correctamente${errores > 0 ? ` y ${errores} con errores` : ""}\n\nNota: Los productos con valor 0 han sido eliminados de la lista de topes.`,
        );
        await cargarProductos();
        setTopesTemporales({});
        setMostrarModalTopesMasivo(false);
      } else {
        Alert.alert(
          "Información",
          "No se realizaron cambios. Verifique los valores ingresados.",
        );
      }
    } catch (error) {
      console.error("Error guardando topes masivos:", error);
      Alert.alert("Error", "No se pudieron guardar los topes");
    }
  };

  // Función para guardar costos temporales en AsyncStorage
  const guardarCostosTemporalesEnStorage = async (costos: {
    [key: string]: string;
  }) => {
    try {
      const storageKey = puntoId
        ? `costos_temporales_punto_${puntoId}`
        : "costos_temporales_general";
      await AsyncStorage.setItem(storageKey, JSON.stringify(costos));
      console.log(
        `✅ Costos temporales guardados en storage con key: ${storageKey}`,
      );
    } catch (error) {
      console.error("Error guardando costos temporales en storage:", error);
    }
  };

  // Función para cargar costos temporales desde AsyncStorage
  const cargarCostosTemporalesDesdeStorage = async () => {
    try {
      const storageKey = puntoId
        ? `costos_temporales_punto_${puntoId}`
        : "costos_temporales_general";
      const costosGuardados = await AsyncStorage.getItem(storageKey);
      if (costosGuardados) {
        const costos = JSON.parse(costosGuardados);
        console.log(
          `📂 Costos temporales cargados desde storage con key: ${storageKey}`,
          Object.keys(costos).length,
          "productos",
        );
        return costos;
      }
      return {};
    } catch (error) {
      console.error("Error cargando costos temporales desde storage:", error);
      return {};
    }
  };

  // Función para inicializar costos temporales al abrir el modal
  const inicializarCostosTemporales = async () => {
    // Cargar costos guardados desde storage
    const costosGuardados = await cargarCostosTemporalesDesdeStorage();

    // Combinar con costos existentes en los productos
    const iniciales: { [key: string]: string } = { ...costosGuardados };

    productos.forEach((producto) => {
      if (producto.precio_coste_temporal) {
        iniciales[producto.nombre] = producto.precio_coste_temporal.toString();
      }
    });

    setCostosTemporales(iniciales);
  };

  // Función para guardar todos los costos masivamente
  const guardarCostosMasivos = async (): Promise<void> => {
    try {
      let guardados = 0;
      let eliminados = 0;
      let errores = 0;
      const nuevosCostosTemporales: { [key: string]: string } = {};

      for (const [nombreProducto, costoStr] of Object.entries(
        costosTemporales,
      )) {
        if (costoStr && costoStr.trim() !== "") {
          const costoNum = parseFloat(costoStr);
          if (!isNaN(costoNum)) {
            if (costoNum === 0) {
              // Si es 0, eliminamos la modificación temporal
              eliminados++;
            } else if (costoNum > 0) {
              // Si es mayor a 0, guardamos la modificación temporal
              nuevosCostosTemporales[nombreProducto] = costoStr;
              guardados++;
            } else {
              // Si es negativo, es un error
              errores++;
            }
          } else {
            errores++;
          }
        }
      }

      // Actualizamos el estado con los costos temporales actualizados
      setCostosTemporales(nuevosCostosTemporales);

      // Guardar los cambios en AsyncStorage para persistencia
      await guardarCostosTemporalesEnStorage(nuevosCostosTemporales);

      if (guardados > 0 || eliminados > 0) {
        Alert.alert(
          "Operación Completada",
          `Se procesaron ${guardados} productos con nuevos precios y se eliminaron ${eliminados} modificaciones temporales${errores > 0 ? ` y ${errores} con errores` : ""}\n\nNota: Los cambios se guardarán y persistirán al salir de la pantalla. No modifican el precio de coste real de los productos.`,
        );
        await cargarProductos();
        setMostrarModalCostos(false);
      } else {
        Alert.alert(
          "Información",
          "No se realizaron cambios. Verifique los valores ingresados.",
        );
      }
    } catch (error) {
      console.error("Error guardando costos masivos:", error);
      Alert.alert("Error", "No se pudieron procesar los cambios");
    }
  };

  // Función para inicializar topes temporales al abrir el modal
  const inicializarTopesTemporales = () => {
    const iniciales: { [key: string]: string } = {};
    productos.forEach((producto) => {
      if (producto.tope_precio) {
        iniciales[producto.nombre] = producto.tope_precio.toString();
      }
    });
    setTopesTemporales(iniciales);
  };
  const eliminarTopePrecio = async (nombre: string): Promise<void> => {
    try {
      // Primero verificar si la tabla existe
      const tablaExiste = await verificarTablaTopePrecio();
      if (!tablaExiste) {
        throw new Error(
          "La función de topes de precio no está disponible. Reinicie la aplicación para activarla.",
        );
      }

      const nombreLimpio = nombre.trim();
      await executeQuery("DELETE FROM TopePrecio WHERE TRIM(nombre) = ?", [
        nombreLimpio,
      ]);
    } catch (error) {
      console.error("Error eliminando tope de precio:", error);
      throw error;
    }
  };

  // Función para obtener productos de un punto específico
  const getProductosDelPunto = async (puntoId: number): Promise<any[]> => {
    try {
      // Obtener productos que tienen stock en la zona de venta (zona_id = 1) de este punto
      const productos = await executeQuery(
        `
        SELECT DISTINCT
          p.id,
          TRIM(p.nombre) as nombre,
          p.categoria,
          p.subcategoria
        FROM Producto p
        INNER JOIN AlmacenZona az ON p.id = az.producto_id
        WHERE az.punto_id = ? 
          AND az.zona_id = 1 
          AND az.cantidad > 0
          AND p.nombre IS NOT NULL 
          AND TRIM(p.nombre) != ''
        ORDER BY TRIM(p.nombre)
      `,
        [puntoId],
      );

      return productos;
    } catch (error) {
      console.error("Error obteniendo productos del punto:", error);
      return [];
    }
  };

  // Función para obtener el precio de venta de un producto en un punto específico
  const getPrecioVenta = async (nombre: string): Promise<number | null> => {
    try {
      const nombreLimpio = nombre.trim();

      if (!puntoId) {
        // Si no hay puntoId, buscar en cualquier zona de venta
        const producto = await executeQuery(
          "SELECT id FROM Producto WHERE TRIM(nombre) = ? LIMIT 1",
          [nombreLimpio],
        );
        if (producto.length === 0) return null;

        const resultado = await executeQuery(
          "SELECT precio_venta FROM AlmacenZona WHERE producto_id = ? AND zona_id = 1 AND precio_venta IS NOT NULL LIMIT 1",
          [producto[0].id],
        );
        return resultado[0]?.precio_venta || null;
      } else {
        // Buscar precio de venta específico para este punto
        const resultado = await executeQuery(
          `
          SELECT az.precio_venta 
          FROM AlmacenZona az
          INNER JOIN Producto p ON az.producto_id = p.id
          WHERE az.punto_id = ? 
            AND az.zona_id = 1 
            AND TRIM(p.nombre) = ?
            AND az.precio_venta IS NOT NULL
          LIMIT 1
        `,
          [puntoId, nombreLimpio],
        );

        return resultado[0]?.precio_venta || null;
      }
    } catch (error) {
      console.error("Error obteniendo precio de venta:", error);
      return null;
    }
  };

  // Función para obtener el precio de costo máximo de cada producto
  const getPrecioCosteMaximo = async (nombre: string): Promise<number> => {
    try {
      // Limpiamos el nombre para buscar coincidencias exactas
      const nombreLimpio = nombre.trim();
      const result = await executeQuery(
        "SELECT COALESCE(MAX(precio_coste), 0) as max_precio FROM Producto WHERE TRIM(nombre) = ?",
        [nombreLimpio],
      );
      return result[0]?.max_precio || 0;
    } catch (error) {
      console.error("Error obteniendo precio costo máximo:", error);
      return 0;
    }
  };

  // Función para cargar todos los productos con sus precios
  const cargarProductos = async () => {
    try {
      setLoading(true);

      // Cargar costos temporales desde AsyncStorage primero
      const costosGuardados = await cargarCostosTemporalesDesdeStorage();
      setCostosTemporales(costosGuardados);

      let productosUnicos: any[] = [];

      if (puntoId) {
        // Obtener productos específicos del punto
        productosUnicos = await getProductosDelPunto(puntoId);
      } else {
        // Obtener todos los productos únicos por nombre (comportamiento original)
        productosUnicos = await executeQuery(`
          SELECT 
            MIN(id) as id,
            TRIM(nombre) as nombre,
            MIN(categoria) as categoria,
            MIN(subcategoria) as subcategoria
          FROM Producto 
          WHERE nombre IS NOT NULL AND TRIM(nombre) != ''
          GROUP BY TRIM(nombre)
          ORDER BY TRIM(nombre)
        `);
      }

      // Para cada producto, obtener su precio de costo máximo, fecha de vencimiento próxima, precio de venta, tope de precio y calcular el precio con 30% de margen
      const productosConPrecios: ProductoConPrecio[] = [];

      for (const producto of productosUnicos) {
        const precioCosteMax = await getPrecioCosteMaximo(producto.nombre);
        const precioCon30Margen = precioCosteMax / 0.7;
        const fechaVencimiento = await getFechaVencimientoProxima(
          producto.nombre,
        );
        const precioVenta = await getPrecioVenta(producto.nombre);
        const topePrecio = await getTopePrecio(producto.nombre);

        productosConPrecios.push({
          id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          subcategoria: producto.subcategoria,
          precio_coste_max: precioCosteMax,
          precio_con_30: precioCon30Margen,
          fecha_vencimiento: fechaVencimiento,
          precio_venta: precioVenta,
          tope_precio: topePrecio,
          precio_coste_temporal: costosGuardados[producto.nombre]
            ? parseFloat(costosGuardados[producto.nombre])
            : undefined,
        });
      }

      setProductos(productosConPrecios);
    } catch (error) {
      console.error("Error cargando productos:", error);
      Alert.alert("Error", "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Función para generar HTML de una página específica
  const generarHTMLPagina = (
    productosPagina: ProductoConPrecio[],
    numeroPagina: number,
    totalPaginas: number,
  ): string => {
    const productosHTML = productosPagina
      .map((producto) => {
        const precioAMostrar =
          producto.tope_precio &&
          producto.precio_venta &&
          producto.precio_venta > producto.tope_precio
            ? producto.tope_precio
            : producto.precio_venta;
        const precioCosteAMostrar =
          producto.precio_coste_temporal || producto.precio_coste_max;
        const precioCon30MargenModificado = precioCosteAMostrar / 0.7;
        return `
              <tr>
                <td><strong>${producto.nombre}</strong></td>
                <td>${producto.fecha_vencimiento ? new Date(producto.fecha_vencimiento).toLocaleDateString("es-ES") : "N/A"}</td>
                <td class="precio-max">$${precioCosteAMostrar.toFixed(2)}</td>
                <td class="precio">$${precioCon30MargenModificado.toFixed(2)}</td>
                <td class="precio">${precioAMostrar ? `$${precioAMostrar.toFixed(2)}` : "N/A"}</td>
              </tr>
            `;
      })
      .join("");

    return `
      <div class="pagina">
        ${
          numeroPagina === 1
            ? `
          <div class="header">
            <h1>LISTA DE PRECIOS${puntoId ? ` - ${puntoNombre}` : ""}</h1>
            <p>Generado: ${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES")}</p>
            ${puntoId ? `<p>Productos con stock en: ${puntoNombre}</p>` : ""}
          </div>
        `
            : `
          <div class="header-continuo">
            <h1>LISTA DE PRECIOS${puntoId ? ` - ${puntoNombre}` : ""} (Cont.)</h1>
            <p>Página ${numeroPagina} de ${totalPaginas}</p>
          </div>
        `
        }
        
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Fecha Vencimiento</th>
              <th>Precio Coste</th>
              <th>+30%</th>
              <th>Precio Venta</th>
            </tr>
          </thead>
          <tbody>
            ${productosHTML}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Página ${numeroPagina} de ${totalPaginas} | Total de productos: ${productos.length}</p>
        </div>
      </div>
      
      ${numeroPagina < totalPaginas ? '<div class="page-break"></div>' : ""}
    `;
  };

  // Función para generar y exportar PDF con paginación
  const exportarPDF = async () => {
    try {
      // Validación preventiva
      if (productos.length > 100) {
        const confirmar = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Muchos Productos Detectados",
            `Se encontraron ${productos.length} productos. La generación del PDF puede tardar varios minutos.\n\n¿Deseas continuar?`,
            [
              {
                text: "Cancelar",
                style: "cancel",
                onPress: () => resolve(false),
              },
              { text: "Continuar", onPress: () => resolve(true) },
            ],
          );
        });

        if (!confirmar) return;
      }

      setGeneratingPDF(true);
      setMostrarModalProgreso(true);
      setProgresoPDF(0);

      const PRODUCTOS_POR_PAGINA = 25;
      const totalPaginas = Math.ceil(productos.length / PRODUCTOS_POR_PAGINA);

      // Generar HTML completo con todas las páginas
      let htmlCompleto = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Lista de Precios</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
              font-size: 12px;
            }
            .pagina {
              page-break-after: always;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #1f2937;
              padding-bottom: 15px;
            }
            .header-continuo {
              text-align: center;
              margin-bottom: 15px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .header h1, .header-continuo h1 {
              color: #1f2937;
              margin: 0;
              font-size: 20px;
            }
            .header p, .header-continuo p {
              color: #6b7280;
              margin: 3px 0 0 0;
              font-size: 11px;
            }
            .page-break {
              page-break-after: always;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 10px;
            }
            th {
              background-color: #1f2937;
              color: white;
              padding: 8px 4px;
              text-align: center;
              font-weight: bold;
              border: 1px solid #374151;
              font-size: 9px;
            }
            td {
              padding: 6px 4px;
              border: 1px solid #e5e7eb;
              text-align: center;
              vertical-align: top;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .text-right {
              text-align: right;
            }
            .categoria {
              background-color: #f3f4f6;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 8px;
              color: #4b5563;
            }
            .precio {
              font-weight: bold;
              color: #059669;
            }
            .precio-max {
              color: #dc2626;
            }
            .footer {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 9px;
            }
            @media print {
              .pagina {
                page-break-after: always;
              }
              body {
                margin: 10px;
              }
            }
          </style>
        </head>
        <body>
      `;

      // Generar páginas de forma asíncrona por lotes
      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        const inicio = (pagina - 1) * PRODUCTOS_POR_PAGINA;
        const fin = Math.min(inicio + PRODUCTOS_POR_PAGINA, productos.length);
        const productosPagina = productos.slice(inicio, fin);

        // Generar HTML para esta página
        const htmlPagina = generarHTMLPagina(
          productosPagina,
          pagina,
          totalPaginas,
        );
        htmlCompleto += htmlPagina;

        // Actualizar progreso
        const progreso = Math.round((pagina / totalPaginas) * 100);
        setProgresoPDF(progreso);

        // Pequeña pausa para no bloquear la UI
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      htmlCompleto += `
        </body>
        </html>
      `;

      // Crear el PDF con expo-print
      const { uri } = await ExpoPrint.printToFileAsync({
        html: htmlCompleto,
      });

      // Generar nombre personalizado
      const fechaActual = new Date()
        .toLocaleDateString("es-ES")
        .replace(/\//g, "-");
      const nombreArchivo = `LISTA_DE_PRECIOS_${fechaActual}.pdf`;

      // Cerrar modal de progreso
      setMostrarModalProgreso(false);
      setProgresoPDF(0);

      // Mostrar alerta de éxito con opciones
      Alert.alert(
        "PDF Generado Exitosamente",
        `Se generó un PDF con ${totalPaginas} página(s) y ${productos.length} productos.\n\nEl archivo "${nombreArchivo}" ha sido guardado. ¿Qué deseas hacer?`,
        [
          {
            text: "Compartir",
            onPress: async () => {
              try {
                const isSharingAvailable = await Sharing.isAvailableAsync();
                if (!isSharingAvailable) {
                  Alert.alert(
                    "No Disponible",
                    "No hay aplicaciones disponibles para compartir archivos en este dispositivo.",
                    [{ text: "OK" }],
                  );
                  return;
                }

                await Sharing.shareAsync(uri, {
                  mimeType: "application/pdf",
                  dialogTitle: nombreArchivo,
                });
              } catch (error) {
                console.error("Error compartiendo PDF:", error);
                Alert.alert(
                  "Error al Compartir",
                  "No se pudo compartir el archivo. El PDF está guardado en tu dispositivo y puedes compartirlo manualmente.",
                  [{ text: "OK" }],
                );
              }
            },
          },
          {
            text: "Ver Información",
            onPress: () => {
              Alert.alert(
                "Información del Archivo",
                `📄 Nombre: ${nombreArchivo}\n\n📅 Fecha: ${fechaActual}\n\n📊 Total páginas: ${totalPaginas}\n\n📦 Total productos: ${productos.length}\n\n💾 El archivo está guardado en el dispositivo. Puedes acceder a él desde aplicaciones de archivos y compartirlo manualmente si es necesario.`,
                [{ text: "Entendido" }],
              );
            },
          },
          {
            text: "Cerrar",
            style: "cancel",
          },
        ],
      );
    } catch (error) {
      console.error("Error generando PDF:", error);
      setMostrarModalProgreso(false);
      setProgresoPDF(0);
      Alert.alert("Error", "No se pudo generar el archivo PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const verificarPassword = async () => {
    const isValid = await AuthService.verifyPassword(password);
    if (isValid) {
      setIsAuthenticated(true);
      setAuthModalVisible(false);
      setPassword("");
    } else {
      Alert.alert("Error", "Contraseña incorrecta");
      setPassword("");
    }
  };

  useEffect(() => {
    const inicializar = async () => {
      if (isAuthenticated) {
        await cargarProductos();
        setLoading(false);
      }
    };
    inicializar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Renderizar item de producto
  const renderProducto = ({
    item,
    index,
  }: {
    item: ProductoConPrecio;
    index: number;
  }) => {
    const precioAMostrar =
      item.tope_precio &&
      item.precio_venta &&
      item.precio_venta > item.tope_precio
        ? item.tope_precio
        : item.precio_venta;
    const esTopeAplicado =
      item.tope_precio &&
      item.precio_venta &&
      item.precio_venta > item.tope_precio;

    return (
      <View style={[styles.tableRow, index % 2 === 0 && styles.rowEven]}>
        <Text style={[styles.tableCell, { flex: 3 }]}>{item.nombre}</Text>
        <Text style={[styles.tableCell, { flex: 2, textAlign: "center" }]}>
          {item.fecha_vencimiento
            ? new Date(item.fecha_vencimiento).toLocaleDateString("es-ES")
            : "N/A"}
        </Text>
        <Text
          style={[
            styles.tableCell,
            { flex: 2, textAlign: "center" },
            item.precio_coste_temporal ? { color: "#dc2626" } : {},
          ]}
        >
          $
          {item.precio_coste_temporal
            ? item.precio_coste_temporal.toFixed(2)
            : item.precio_coste_max.toFixed(2)}
        </Text>
        <Text
          style={[
            styles.tableCell,
            { flex: 2, textAlign: "center" },
            item.precio_coste_temporal ? { color: "#dc2626" } : {},
          ]}
        >
          $
          {item.precio_coste_temporal
            ? (item.precio_coste_temporal / 0.7).toFixed(2)
            : item.precio_con_30.toFixed(2)}
        </Text>
        <View
          style={[
            styles.tableCell,
            {
              flex: 2,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Text
            style={[esTopeAplicado ? styles.precioTope : styles.precioNormal]}
          >
            {precioAMostrar ? `$${precioAMostrar.toFixed(2)}` : "N/A"}
          </Text>
        </View>
      </View>
    );
  };

  // Renderizar header de la tabla
  const renderHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerText, { flex: 3 }]}>Producto</Text>
      <Text style={[styles.headerText, { flex: 2 }]}>Fecha Venc.</Text>
      <Text style={[styles.headerText, { flex: 2 }]}>Precio Coste</Text>
      <Text style={[styles.headerText, { flex: 2 }]}>+30%</Text>
      <Text style={[styles.headerText, { flex: 2 }]}>Precio Venta</Text>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Modal
          visible={authModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => router.back()}
        >
          <View style={styles.authModalOverlay}>
            <View style={styles.authModalContainer}>
              <View style={styles.authModalHeader}>
                <Text style={styles.authModalTitle}>Acceso Restringido</Text>
              </View>

              <View style={styles.authModalContent}>
                <Text
                  style={{
                    fontSize: 16,
                    marginBottom: 20,
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  Esta pantalla requiere autenticación para acceder
                </Text>

                <View style={styles.authFormGroup}>
                  <Text style={styles.authFormLabel}>Contraseña</Text>
                  <TextInput
                    style={styles.authFormInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Ingrese la contraseña"
                    secureTextEntry
                    autoFocus
                    maxLength={20}
                  />
                </View>
              </View>

              <View style={styles.authModalFooter}>
                <TouchableOpacity
                  style={[styles.authModalButton, styles.authCancelButton]}
                  onPress={() => router.back()}
                >
                  <Text style={styles.authCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.authModalButton, styles.authSaveButton]}
                  onPress={verificarPassword}
                >
                  <Text style={styles.authSaveButtonText}>Acceder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f2937" />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={[styles.iconButton, styles.backButton]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Lista de Precios</Text>
            <Text style={styles.headerSubtitle}>
              {puntoId
                ? `${puntoNombre} - Productos con stock`
                : "Precios con costo máximo y 30% de ganancia"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.iconButton, styles.topesButton]}
            onPress={() => {
              inicializarTopesTemporales();
              setMostrarModalTopesMasivo(true);
            }}
            disabled={productos.length === 0}
          >
            <Ionicons name="bar-chart-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.costosButton]}
            onPress={async () => {
              await inicializarCostosTemporales();
              setMostrarModalCostos(true);
            }}
            disabled={productos.length === 0}
          >
            <Ionicons name="cash-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.exportButton]}
            onPress={exportarPDF}
            disabled={generatingPDF || productos.length === 0}
          >
            {generatingPDF ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="document-text-outline" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido principal */}
      <View style={styles.content}>
        {productos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No hay productos disponibles</Text>
            <Text style={styles.emptySubtext}>
              No se encontraron productos en la base de datos
            </Text>
          </View>
        ) : (
          <FlatList
            data={productos}
            renderItem={renderProducto}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={renderHeader}
            ListHeaderComponentStyle={styles.listHeader}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={cargarProductos}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>

      {/* Modal para gestión de costos masivos */}
      {mostrarModalCostos && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainerMasivo}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestión de Precios de Coste</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setMostrarModalCostos(false);
                  setCostosTemporales({});
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContentMasivo}>
              <Text style={styles.modalSubtext}>
                Ingrese los precios de coste temporales para cada producto. Los
                campos vacíos no se modificarán. Ingrese 0 para eliminar la
                modificación temporal de un producto. Estos cambios solo se
                reflejarán en esta pantalla y en el PDF exportado.
              </Text>

              <FlatList
                data={productos}
                renderItem={({ item }) => (
                  <View style={styles.productoRow}>
                    <View style={styles.productoInfo}>
                      <Text style={styles.productoNombreLista}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.productoPrecioActual}>
                        Coste actual: ${item.precio_coste_max.toFixed(2)}
                      </Text>
                      {item.precio_coste_temporal && (
                        <Text style={styles.productoTopeActual}>
                          Coste temporal: $
                          {item.precio_coste_temporal.toFixed(2)}
                        </Text>
                      )}
                    </View>
                    <TextInput
                      style={styles.topeInput}
                      value={costosTemporales[item.nombre] || ""}
                      onChangeText={(text) => {
                        setCostosTemporales((prev) => ({
                          ...prev,
                          [item.nombre]: text,
                        }));
                      }}
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                  </View>
                )}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listaProductosContainer}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={() => {
                  setMostrarModalCostos(false);
                  setCostosTemporales({});
                }}
              >
                <Text style={styles.buttonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.buttonSave]}
                onPress={guardarCostosMasivos}
              >
                <Text style={styles.buttonSaveText}>Guardar Todos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal para gestión de topes de precio masivos */}
      {mostrarModalTopesMasivo && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainerMasivo}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestión de Topes de Precio</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setMostrarModalTopesMasivo(false);
                  setTopesTemporales({});
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContentMasivo}>
              <Text style={styles.modalSubtext}>
                Ingrese los topes de precio para cada producto. Los campos
                vacíos no se modificarán. Use valor 0 para eliminar el tope de
                un producto.
              </Text>

              <FlatList
                data={productos}
                renderItem={({ item }) => (
                  <View style={styles.productoRow}>
                    <View style={styles.productoInfo}>
                      <Text style={styles.productoNombreLista}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.productoPrecioActual}>
                        Precio actual: $
                        {item.precio_venta
                          ? item.precio_venta.toFixed(2)
                          : "N/A"}
                      </Text>
                      {item.tope_precio && (
                        <Text style={styles.productoTopeActual}>
                          Tope actual: ${item.tope_precio.toFixed(2)}
                        </Text>
                      )}
                    </View>
                    <TextInput
                      style={styles.topeInput}
                      value={topesTemporales[item.nombre] || ""}
                      onChangeText={(text) => {
                        setTopesTemporales((prev) => ({
                          ...prev,
                          [item.nombre]: text,
                        }));
                      }}
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                  </View>
                )}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listaProductosContainer}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={() => {
                  setMostrarModalTopesMasivo(false);
                  setTopesTemporales({});
                }}
              >
                <Text style={styles.buttonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.buttonSave]}
                onPress={guardarTopesMasivos}
              >
                <Text style={styles.buttonSaveText}>Guardar Todos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal para gestión de topes de precio individual */}
      {mostrarModalTope && productoSeleccionado && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestionar Tope de Precio</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setMostrarModalTope(false);
                  setProductoSeleccionado(null);
                  setNuevoTope("");
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.productoNombre}>
                {productoSeleccionado.nombre}
              </Text>
              <Text style={styles.precioActual}>
                Precio actual: $
                {productoSeleccionado.precio_venta
                  ? productoSeleccionado.precio_venta.toFixed(2)
                  : "N/A"}
              </Text>
              {productoSeleccionado.tope_precio && (
                <Text style={styles.topeActual}>
                  Tope actual: ${productoSeleccionado.tope_precio.toFixed(2)}
                </Text>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nuevo tope de precio:</Text>
                <TextInput
                  style={styles.input}
                  value={nuevoTope}
                  onChangeText={setNuevoTope}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={() => {
                  setMostrarModalTope(false);
                  setProductoSeleccionado(null);
                  setNuevoTope("");
                }}
              >
                <Text style={styles.buttonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              {productoSeleccionado.tope_precio && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonDelete]}
                  onPress={async () => {
                    Alert.alert(
                      "Eliminar Tope",
                      "¿Estás seguro de que deseas eliminar el tope de precio?",
                      [
                        { text: "No", style: "cancel" },
                        {
                          text: "Sí",
                          onPress: async () => {
                            try {
                              await eliminarTopePrecio(
                                productoSeleccionado.nombre,
                              );
                              await cargarProductos();
                              setMostrarModalTope(false);
                              setProductoSeleccionado(null);
                              setNuevoTope("");
                              Alert.alert("Éxito", "Tope de precio eliminado");
                            } catch (error) {
                              console.error("Error eliminando tope:", error);
                              Alert.alert(
                                "Error",
                                "No se pudo eliminar el tope",
                              );
                            }
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.buttonDeleteText}>Eliminar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.modalButton, styles.buttonSave]}
                onPress={async () => {
                  const topeNum = parseFloat(nuevoTope);
                  if (isNaN(topeNum) || topeNum <= 0) {
                    Alert.alert("Error", "Ingrese un tope válido");
                    return;
                  }

                  try {
                    await guardarTopePrecio(
                      productoSeleccionado.nombre,
                      topeNum,
                    );
                    await cargarProductos();
                    setMostrarModalTope(false);
                    setProductoSeleccionado(null);
                    setNuevoTope("");
                    Alert.alert("Éxito", "Tope de precio guardado");
                  } catch (error) {
                    console.error("Error guardando tope:", error);
                    Alert.alert("Error", "No se pudo guardar el tope");
                  }
                }}
              >
                <Text style={styles.buttonSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal de progreso para generación de PDF */}
      {mostrarModalProgreso && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generando PDF...</Text>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.progresoContainer}>
                <Text style={styles.progresoTexto}>
                  Generando PDF: {progresoPDF}%
                </Text>
                <View style={styles.progresoBarContainer}>
                  <View
                    style={[styles.progresoBar, { width: `${progresoPDF}%` }]}
                  />
                </View>
                <Text style={styles.progresoDetalle}>
                  {progresoPDF === 0
                    ? "Preparando generación..."
                    : `Procesando página ${Math.ceil((progresoPDF / 100) * Math.ceil(productos.length / 25))} de ${Math.ceil(productos.length / 25)}`}
                </Text>
              </View>

              <View style={styles.progresoInfo}>
                <Text style={styles.progresoInfoText}>
                  📄 Total productos: {productos.length}
                </Text>
                <Text style={styles.progresoInfoText}>
                  📑 Páginas totales: {Math.ceil(productos.length / 25)}
                </Text>
                <Text style={styles.progresoInfoText}>
                  📦 Productos por página: 25
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  backButton: {
    backgroundColor: "transparent",
  },
  topesButton: {
    backgroundColor: "#8b5cf6",
  },
  exportButton: {
    backgroundColor: "#059669",
  },
  costosButton: {
    backgroundColor: "#f59e0b",
  },
  content: {
    flex: 1,
  },
  listHeader: {
    marginBottom: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: "space-between",
  },
  headerText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "center",
  },
  rowEven: {
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 14,
    color: "#1f2937",
    paddingHorizontal: 4,
    flex: 1,
    textAlign: "left",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  iconText: {
    fontSize: 20,
    color: "white",
  },
  emptyIcon: {
    fontSize: 60,
    color: "#9ca3af",
    marginBottom: 16,
  },
  // Estilos para topes de precio
  precioTope: {
    color: "#dc2626",
    fontWeight: "bold",
  },
  precioNormal: {
    color: "#059669",
    fontWeight: "bold",
  },
  btnTope: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  btnTopeText: {
    fontSize: 12,
    color: "white",
  },
  // Estilos del modal
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    margin: 20,
    maxWidth: 400,
    width: "90%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 16,
    color: "#6b7280",
  },
  modalContent: {
    padding: 16,
  },
  productoNombre: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  precioActual: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  topeActual: {
    fontSize: 14,
    color: "#dc2626",
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
  },
  buttonCancel: {
    backgroundColor: "#6b7280",
  },
  buttonCancelText: {
    color: "white",
    textAlign: "center",
    fontWeight: "500",
  },
  buttonDelete: {
    backgroundColor: "#dc2626",
  },
  buttonDeleteText: {
    color: "white",
    textAlign: "center",
    fontWeight: "500",
  },
  buttonSave: {
    backgroundColor: "#059669",
  },
  buttonSaveText: {
    color: "white",
    textAlign: "center",
    fontWeight: "500",
  },
  // Estilos para modal masivo
  modalContainerMasivo: {
    backgroundColor: "white",
    borderRadius: 12,
    margin: 20,
    maxWidth: 600,
    width: "95%",
    maxHeight: "85%",
  },
  modalContentMasivo: {
    padding: 16,
    maxHeight: "70%",
  },
  modalSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    textAlign: "center",
  },
  listaProductosContainer: {
    paddingBottom: 16,
  },
  productoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  productoInfo: {
    flex: 3,
    paddingRight: 16,
  },
  productoNombreLista: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  productoPrecioActual: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  productoTopeActual: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "500",
  },
  topeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: "right",
    minWidth: 80,
  },
  // Estilos para el modal de autenticación (idénticos a almacenes.tsx)
  authModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  authModalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
  },
  authModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  authModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  authModalContent: {
    maxHeight: "60%",
  },
  authFormGroup: {
    marginBottom: 20,
  },
  authFormLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  authFormInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
  },
  authModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  authModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  authCancelButton: {
    backgroundColor: "#f3f4f6",
  },
  authCancelButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  authSaveButton: {
    backgroundColor: "#3b82f6",
  },
  authSaveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // Estilos para modal de progreso PDF
  progresoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  progresoTexto: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 15,
    textAlign: "center",
  },
  progresoBarContainer: {
    width: "100%",
    height: 20,
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
  },
  progresoBar: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    minWidth: 2,
  },
  progresoDetalle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  progresoInfo: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 16,
    width: "100%",
  },
  progresoInfoText: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 8,
    textAlign: "center",
  },
});
