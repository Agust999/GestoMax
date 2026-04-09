// ARCHIVO TEMPORAL PARA ARREGLAR LA BASE DE DATOS
import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabaseFix = () => {
  if (!db) {
    try {
      db = SQLite.openDatabaseSync("gestion_almacen.db");
      console.log("✅ Base de datos inicializada correctamente");
    } catch (error) {
      console.error("❌ Error inicializando base de datos:", error);
      throw error;
    }
  }
  return db;
};

export const executeQueryFix = async <T>(
  query: string,
  params: any[] = [],
): Promise<T[]> => {
  const database = initDatabaseFix();
  try {
    const result = await database.getAllAsync(query, params);
    return result as T[];
  } catch (error) {
    console.error("❌ Error en executeQueryFix:", error);
    throw error;
  }
};

export const getSingleValueFix = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T | null> => {
  const database = initDatabaseFix();
  try {
    const result = await database.getFirstAsync(sql, params);
    if (result && typeof result === "object") {
      const keys = Object.keys(result);
      if (keys.length > 0) {
        return (result as any)[keys[0]] as T;
      }
    }
    return result as T | null;
  } catch (error) {
    console.error("❌ Error en getSingleValueFix:", error);
    return null;
  }
};

export const getFirstFix = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T | null> => {
  const database = initDatabaseFix();
  try {
    const result = await database.getFirstAsync(sql, params);
    return result as T | null;
  } catch (error) {
    console.error("❌ Error en getFirstFix:", error);
    return null;
  }
};
