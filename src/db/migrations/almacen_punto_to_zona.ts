// Script para migrar datos de AlmacenPunto a AlmacenZona
import { executeNonQuery, executeQuery, getSingleValue } from "../database";

export const migrarAlmacenPuntoToAlmacenZona = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    console.log("🔄 Iniciando migración de AlmacenPunto a AlmacenZona...");

    // 1. Verificar si existen datos en AlmacenPunto
    const countAlmacenPunto = await getSingleValue<number>(
      "SELECT COUNT(*) FROM AlmacenPunto",
    );

    if (!countAlmacenPunto || countAlmacenPunto === 0) {
      return {
        success: true,
        message: "No hay datos que migrar de AlmacenPunto",
      };
    }

    console.log(
      `📊 Se encontraron ${countAlmacenPunto} registros en AlmacenPunto`,
    );

    // 2. Obtener todos los datos de AlmacenPunto
    const datosAlmacenPunto = await executeQuery<any>(`
      SELECT producto_id, punto_id, cantidad, precio_venta, ganancia
      FROM AlmacenPunto 
      WHERE cantidad > 0
    `);

    console.log(
      `📦 Migrando ${datosAlmacenPunto.length} productos con stock...`,
    );

    // 3. Iniciar transacción para migración
    await executeNonQuery("BEGIN TRANSACTION");

    try {
      let migrados = 0;
      let omitidos = 0;

      for (const registro of datosAlmacenPunto) {
        // Verificar si ya existe en AlmacenZona (zona_id = 2 para almacén del punto)
        const existeEnZona = await getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenZona WHERE producto_id = ? AND punto_id = ? AND zona_id = 2",
          [registro.producto_id, registro.punto_id],
        );

        if (existeEnZona && existeEnZona > 0) {
          // Ya existe, omitir
          omitidos++;
          continue;
        }

        // Insertar en AlmacenZona como almacén del punto (zona_id = 2)
        await executeNonQuery(
          `
          INSERT INTO AlmacenZona (producto_id, punto_id, zona_id, cantidad, precio_venta, ganancia)
          VALUES (?, ?, 2, ?, ?, ?)
        `,
          [
            registro.producto_id,
            registro.punto_id,
            registro.cantidad,
            registro.precio_venta,
            registro.ganancia || 0,
          ],
        );

        migrados++;
      }

      await executeNonQuery("COMMIT");

      console.log(`✅ Migración completada:`);
      console.log(`   • Registros migrados: ${migrados}`);
      console.log(`   • Registros omitidos (ya existían): ${omitidos}`);

      return {
        success: true,
        message: `Migración completada. ${migrados} registros migrados, ${omitidos} omitidos.`,
      };
    } catch (error) {
      await executeNonQuery("ROLLBACK");
      throw error;
    }
  } catch (error: any) {
    console.error("❌ Error en migración:", error);
    return {
      success: false,
      message: `Error en migración: ${error.message}`,
    };
  }
};

// Función para verificar estado de la migración
export const verificarEstadoMigracion = async (): Promise<{
  almacenPunto: number;
  almacenZona: number;
  almacenZonaAlmacen: number;
  almacenZonaVenta: number;
}> => {
  try {
    const [almacenPunto, almacenZona, almacenZonaAlmacen, almacenZonaVenta] =
      await Promise.all([
        getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenPunto WHERE cantidad > 0",
        ),
        getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenZona WHERE cantidad > 0",
        ),
        getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenZona WHERE cantidad > 0 AND zona_id = 2",
        ),
        getSingleValue<number>(
          "SELECT COUNT(*) FROM AlmacenZona WHERE cantidad > 0 AND zona_id = 1",
        ),
      ]);

    return {
      almacenPunto: almacenPunto || 0,
      almacenZona: almacenZona || 0,
      almacenZonaAlmacen: almacenZonaAlmacen || 0,
      almacenZonaVenta: almacenZonaVenta || 0,
    };
  } catch (error) {
    console.error("Error verificando estado:", error);
    return {
      almacenPunto: 0,
      almacenZona: 0,
      almacenZonaAlmacen: 0,
      almacenZonaVenta: 0,
    };
  }
};
