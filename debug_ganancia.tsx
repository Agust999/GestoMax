// ARCHIVO DE DEBUG PARA VERIFICAR DATOS REALES EN LA APP
// Copia y pega este código en tu componente ganancia.tsx para depurar

import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";

// 1. Reemplaza tu función get_producto_mas_vendido con esta versión:
export const get_producto_mas_vendido_debug = async (
  tipoPeriodo: string,
  puntoId: number | null,
  fechaInicio: Date | null,
  fechaFin: Date | null,
  setProductosMasVendidos: (productos: any[]) => void,
  PuntoHelper: any,
) => {
  try {
    let productos: any[] = [];

    console.log(
      "🔍 DEBUG: get_producto_mas_vendido - tipoPeriodo:",
      tipoPeriodo,
    );
    console.log("🔍 DEBUG: get_producto_mas_vendido - puntoId:", puntoId);
    console.log(
      "🔍 DEBUG: get_producto_mas_vendido - fechaInicio:",
      fechaInicio,
    );
    console.log("🔍 DEBUG: get_producto_mas_vendido - fechaFin:", fechaFin);

    switch (tipoPeriodo) {
      case "dia":
        console.log("📅 DEBUG: Ejecutando getProductosMasVendidosHoy");
        productos = await PuntoHelper.getProductosMasVendidosHoy(puntoId!, 10);
        break;
      case "semana":
        console.log("📅 DEBUG: Ejecutando getProductosMasVendidosSemana");
        productos = await PuntoHelper.getProductosMasVendidosSemana(
          puntoId!,
          10,
        );
        break;
      case "mes":
        console.log("📅 DEBUG: Ejecutando getProductosMasVendidosMes");
        productos = await PuntoHelper.getProductosMasVendidosMes(puntoId!, 10);
        break;
      case "personalizado":
        if (fechaInicio && fechaFin) {
          console.log("📅 DEBUG: Ejecutando getProductosMasVendidosPeriodo");
          productos = await PuntoHelper.getProductosMasVendidosPeriodo(
            puntoId!,
            fechaInicio,
            fechaFin,
            10,
          );
        }
        break;
      default:
        console.log("📅 DEBUG: Ejecutando caso default (hoy)");
        productos = await PuntoHelper.getProductosMasVendidosHoy(puntoId!, 10);
    }

    console.log("✅ DEBUG: get_producto_mas_vendido - resultados:", productos);
    console.log(
      "✅ DEBUG: get_producto_mas_vendido - cantidad:",
      productos.length,
    );

    setProductosMasVendidos(productos);
    return productos;
  } catch (error) {
    console.error("❌ DEBUG: Error en get_producto_mas_vendido:", error);
    return [];
  }
};

// 2. Reemplaza tu función get_producto_menos_vendido con esta versión:
export const get_producto_menos_vendido_debug = async (
  tipoPeriodo: string,
  puntoId: number | null,
  fechaInicio: Date | null,
  fechaFin: Date | null,
  setProductosMenosVendidos: (productos: any[]) => void,
  PuntoHelper: any,
) => {
  try {
    let productos: any[] = [];

    console.log(
      "🔍 DEBUG: get_producto_menos_vendido - tipoPeriodo:",
      tipoPeriodo,
    );
    console.log("🔍 DEBUG: get_producto_menos_vendido - puntoId:", puntoId);
    console.log(
      "🔍 DEBUG: get_producto_menos_vendido - fechaInicio:",
      fechaInicio,
    );
    console.log("🔍 DEBUG: get_producto_menos_vendido - fechaFin:", fechaFin);

    switch (tipoPeriodo) {
      case "dia":
        console.log("📉 DEBUG: Ejecutando getProductosMenosVendidosHoy");
        productos = await PuntoHelper.getProductosMenosVendidosHoy(puntoId!, 5);
        break;
      case "semana":
        console.log("📉 DEBUG: Ejecutando getProductosMenosVendidosSemana");
        productos = await PuntoHelper.getProductosMenosVendidosSemana(
          puntoId!,
          5,
        );
        break;
      case "mes":
        console.log("📉 DEBUG: Ejecutando getProductosMenosVendidosMes");
        productos = await PuntoHelper.getProductosMenosVendidosMes(puntoId!, 5);
        break;
      case "personalizado":
        if (fechaInicio && fechaFin) {
          console.log("📉 DEBUG: Ejecutando getProductosMenosVendidosPeriodo");
          productos = await PuntoHelper.getProductosMenosVendidosPeriodo(
            puntoId!,
            fechaInicio,
            fechaFin,
            5,
          );
        }
        break;
      default:
        console.log("📉 DEBUG: Ejecutando caso default (hoy)");
        productos = await PuntoHelper.getProductosMenosVendidosHoy(puntoId!, 5);
    }

    console.log(
      "✅ DEBUG: get_producto_menos_vendido - resultados:",
      productos,
    );
    console.log(
      "✅ DEBUG: get_producto_menos_vendido - cantidad:",
      productos.length,
    );

    setProductosMenosVendidos(productos);
    return productos;
  } catch (error) {
    console.error("❌ DEBUG: Error en get_producto_menos_vendido:", error);
    return [];
  }
};

// 3. Componente de botón de debug:
export const BotonDebug = ({
  tipoPeriodo,
  gananciaActual,
  gananciaPeriodo,
  productosMasVendidos,
  productosMenosVendidos,
  fechaInicio,
  fechaFin,
  onProbarFunciones,
}: {
  tipoPeriodo: string;
  gananciaActual: number;
  gananciaPeriodo: number;
  productosMasVendidos: any[];
  productosMenosVendidos: any[];
  fechaInicio: Date | null;
  fechaFin: Date | null;
  onProbarFunciones: () => void;
}) => (
  <View style={{ padding: 20, backgroundColor: "#f0f0f0", margin: 10 }}>
    <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
      🔍 DEBUG DE DATOS
    </Text>

    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, color: "#666" }}>Estado actual:</Text>
      <Text style={{ fontSize: 10 }}>• tipoPeriodo: {tipoPeriodo}</Text>
      <Text style={{ fontSize: 10 }}>• gananciaActual: {gananciaActual}</Text>
      <Text style={{ fontSize: 10 }}>• gananciaPeriodo: {gananciaPeriodo}</Text>
      <Text style={{ fontSize: 10 }}>
        • productosMasVendidos: {productosMasVendidos.length}
      </Text>
      <Text style={{ fontSize: 10 }}>
        • productosMenosVendidos: {productosMenosVendidos.length}
      </Text>
      <Text style={{ fontSize: 10 }}>
        • fechaInicio: {fechaInicio?.toDateString()}
      </Text>
      <Text style={{ fontSize: 10 }}>
        • fechaFin: {fechaFin?.toDateString()}
      </Text>
    </View>

    <TouchableOpacity
      style={{ backgroundColor: "#3b82f6", padding: 10, borderRadius: 5 }}
      onPress={onProbarFunciones}
    >
      <Text style={{ color: "white", textAlign: "center" }}>
        PROBAR FUNCIONES
      </Text>
    </TouchableOpacity>
  </View>
);

// 4. Hook de monitoreo:
export const useDebugMonitor = (
  tipoPeriodo: string,
  gananciaActual: number,
  productosMasVendidos: any[],
  productosMenosVendidos: any[],
) => {
  useEffect(() => {
    console.log("🔄 DEBUG: Cambio en estado detectado");
    console.log("- tipoPeriodo:", tipoPeriodo);
    console.log("- gananciaActual:", gananciaActual);
    console.log("- productosMasVendidos:", productosMasVendidos.length);
    console.log("- productosMenosVendidos:", productosMenosVendidos.length);

    // Verificar que los datos sean diferentes
    if (productosMasVendidos.length > 0 && productosMenosVendidos.length > 0) {
      const masVendidosNames = productosMasVendidos.map((p) => p.nombre);
      const menosVendidosNames = productosMenosVendidos.map((p) => p.nombre);

      console.log("📊 Productos más vendidos:", masVendidosNames);
      console.log("📊 Productos menos vendidos:", menosVendidosNames);

      const sonDiferentes =
        JSON.stringify(masVendidosNames) !== JSON.stringify(menosVendidosNames);
      console.log("✅ ¿Son diferentes los productos?", sonDiferentes);
    }
  }, [
    tipoPeriodo,
    gananciaActual,
    productosMasVendidos,
    productosMenosVendidos,
  ]);
};

/*
INSTRUCCIONES DE USO:

1. En tu archivo ganancia.tsx:
   - Importa las funciones y componentes de este archivo
   - Reemplaza tus funciones existentes con las versiones _debug
   - Agrega el componente BotonDebug en tu renderizado
   - Usa el hook useDebugMonitor

2. Ejemplo de uso en tu componente:

import { 
  get_producto_mas_vendido_debug, 
  get_producto_menos_vendido_debug, 
  BotonDebug, 
  useDebugMonitor 
} from './debug_ganancia';

// En tu componente:
const get_producto_mas_vendido = () => {
  return get_producto_mas_vendido_debug(
    tipoPeriodo, 
    puntoId, 
    fechaInicio, 
    fechaFin, 
    setProductosMasVendidos, 
    PuntoHelper
  );
};

const get_producto_menos_vendido = () => {
  return get_producto_menos_vendido_debug(
    tipoPeriodo, 
    puntoId, 
    fechaInicio, 
    fechaFin, 
    setProductosMenosVendidos, 
    PuntoHelper
  );
};

// Agregar monitoreo:
useDebugMonitor(tipoPeriodo, gananciaActual, productosMasVendidos, productosMenosVendidos);

// En tu renderizado:
<BotonDebug
  tipoPeriodo={tipoPeriodo}
  gananciaActual={gananciaActual}
  gananciaPeriodo={gananciaPeriodo}
  productosMasVendidos={productosMasVendidos}
  productosMenosVendidos={productosMenosVendidos}
  fechaInicio={fechaInicio}
  fechaFin={fechaFin}
  onProbarFunciones={() => {
    console.log('\n🚀 INICIANDO DEBUG MANUAL');
    get_producto_mas_vendido();
    setTimeout(() => {
      get_producto_menos_vendido();
    }, 1000);
  }}
/>

3. Abre la consola de desarrollo y observa los logs cuando:
   - Entres a la pantalla
   - Cambies los filtros en el modal
   - Presiones "Calcular Ganancias"
   - Presiones el botón de prueba

4. Busca estos logs específicos:
   - "🔍 DEBUG:" - Para ver qué función se está ejecutando
   - "✅ DEBUG:" - Para ver los resultados obtenidos
   - "🔄 DEBUG:" - Para ver cambios en el estado
   - "📊 Productos más/menos vendidos:" - Para comparar resultados

Esto te mostrará exactamente qué datos están devolviendo tus funciones y si son correctos.
*/
