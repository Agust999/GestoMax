// src/db/services/backup_service.ts
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { openDatabase } from "../database";

const db = openDatabase();

export interface BackupData {
  version: string;
  fecha: string;
  tablas: {
    [key: string]: any[];
  };
}

export interface BackupResult {
  success: boolean;
  message: string;
  filePath?: string;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restoredTables?: string[];
}

// Servicio de Backup y Restauración de Base de Datos
export class BackupService {
  // Obtener todas las tablas de la base de datos
  private static async obtenerTablas(): Promise<string[]> {
    try {
      const result = (await db.getAllAsync(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)) as { name: string }[];

      return result.map((row) => row.name);
    } catch (error) {
      console.error("Error obteniendo tablas:", error);
      throw new Error("No se pudo obtener la lista de tablas");
    }
  }

  // Obtener datos de una tabla específica
  private static async obtenerDatosTabla(tabla: string): Promise<any[]> {
    try {
      const result = await db.getAllAsync(`SELECT * FROM ${tabla}`);
      return result;
    } catch (error) {
      console.error(`Error obteniendo datos de tabla ${tabla}:`, error);
      // Si una tabla falla, devolver array vacío para no detener el backup
      return [];
    }
  }

  // Exportar toda la base de datos a un JSON
  static async exportarBaseDatos(): Promise<BackupResult> {
    try {
      console.log("🔄 Iniciando exportación de base de datos...");

      // Obtener todas las tablas
      const tablas = await this.obtenerTablas();
      console.log(`📊 Encontradas ${tablas.length} tablas:`, tablas);

      // Obtener datos de todas las tablas
      const backupData: BackupData = {
        version: "1.0.0",
        fecha: new Date().toISOString(),
        tablas: {},
      };

      for (const tabla of tablas) {
        console.log(`📦 Exportando tabla: ${tabla}`);
        const datos = await this.obtenerDatosTabla(tabla);
        backupData.tablas[tabla] = datos;
        console.log(`✅ Tabla ${tabla}: ${datos.length} registros`);
      }

      // Convertir a JSON string
      const jsonString = JSON.stringify(backupData, null, 2);

      // Generar nombre de archivo con timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const fileName = `gestomax_backup_${timestamp}.json`;

      // Usar una ruta relativa que funcione en expo-file-system v19
      const fileUri = `${fileName}`;

      try {
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        console.log(`✅ Backup guardado en: ${fileUri}`);
      } catch (writeError) {
        console.error("Error escribiendo archivo:", writeError);
        throw new Error("No se pudo escribir el archivo de backup");
      }

      // Verificar que el archivo se creó correctamente
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error(
          "No se pudo verificar la creación del archivo de backup",
        );
      }

      console.log(`📄 Archivo creado correctamente`);

      return {
        success: true,
        message: `Backup creado exitosamente con ${tablas.length} tablas`,
        filePath: fileUri,
      };
    } catch (error) {
      console.error("❌ Error en exportación:", error);
      return {
        success: false,
        message: `Error al crear backup: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }

  // Compartir archivo de backup
  static async compartirBackup(filePath: string): Promise<BackupResult> {
    try {
      console.log("📤 Iniciando compartir backup...");

      // Verificar que el archivo existe
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error("El archivo de backup no existe");
      }

      // Verificar si Sharing está disponible
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error(
          "La función de compartir no está disponible en este dispositivo",
        );
      }

      // Compartir el archivo
      await Sharing.shareAsync(filePath, {
        mimeType: "application/json",
        dialogTitle: "Compartir Backup de GestoMax",
        UTI: "public.json",
      });

      console.log("✅ Backup compartido exitosamente");

      return {
        success: true,
        message: "Backup compartido exitosamente",
        filePath: filePath,
      };
    } catch (error) {
      console.error("❌ Error compartiendo backup:", error);
      return {
        success: false,
        message: `Error al compartir backup: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }

  // Validar estructura de backup
  private static validarBackupData(data: any): {
    valido: boolean;
    error?: string;
  } {
    try {
      // Verificar estructura básica
      if (!data || typeof data !== "object") {
        return {
          valido: false,
          error: "El archivo no tiene un formato válido",
        };
      }

      if (!data.version || !data.fecha || !data.tablas) {
        return {
          valido: false,
          error: "El archivo no contiene la estructura requerida",
        };
      }

      if (typeof data.tablas !== "object") {
        return { valido: false, error: "El formato de tablas es inválido" };
      }

      // Verificar que cada tabla sea un array
      for (const [nombreTabla, registros] of Object.entries(data.tablas)) {
        if (!Array.isArray(registros)) {
          return {
            valido: false,
            error: `La tabla ${nombreTabla} no tiene un formato válido`,
          };
        }
      }

      return { valido: true };
    } catch (error) {
      return {
        valido: false,
        error: "Error al validar la estructura del backup",
      };
    }
  }

  // Limpiar base de datos (eliminar todos los datos)
  private static async limpiarBaseDatos(): Promise<void> {
    try {
      console.log("🧹 Limpiando base de datos...");

      const tablas = await this.obtenerTablas();

      // Desactivar foreign keys temporalmente
      await db.execAsync("PRAGMA foreign_keys = OFF");

      // Eliminar datos de cada tabla
      for (const tabla of tablas) {
        try {
          await db.execAsync(`DELETE FROM ${tabla}`);
          console.log(`🗑️  Datos eliminados de tabla: ${tabla}`);
        } catch (error) {
          console.warn(`⚠️  No se pudo limpiar tabla ${tabla}:`, error);
        }
      }

      // Reactivar foreign keys
      await db.execAsync("PRAGMA foreign_keys = ON");

      console.log("✅ Base de datos limpiada");
    } catch (error) {
      console.error("❌ Error limpiando base de datos:", error);
      throw error;
    }
  }

  // Restaurar base de datos desde un archivo JSON
  static async restaurarBaseDatos(filePath: string): Promise<RestoreResult> {
    try {
      console.log("🔄 Iniciando restauración de base de datos...");

      // Verificar que el archivo existe
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error("El archivo de backup no existe");
      }

      // Leer y parsear el archivo
      const jsonString = await FileSystem.readAsStringAsync(filePath);
      const backupData: BackupData = JSON.parse(jsonString);

      // Validar estructura del backup
      const validacion = this.validarBackupData(backupData);
      if (!validacion.valido) {
        throw new Error(validacion.error);
      }

      console.log(
        `📊 Backup válido - Versión: ${backupData.version}, Fecha: ${backupData.fecha}`,
      );
      console.log(
        `📋 Tablas a restaurar: ${Object.keys(backupData.tablas).length}`,
      );

      // Limpiar base de datos actual
      await this.limpiarBaseDatos();

      // Desactivar foreign keys temporalmente para la restauración
      await db.execAsync("PRAGMA foreign_keys = OFF");

      const tablasRestauradas: string[] = [];
      let totalRegistros = 0;

      // Restaurar cada tabla
      for (const [nombreTabla, registros] of Object.entries(
        backupData.tablas,
      )) {
        try {
          if (Array.isArray(registros) && registros.length > 0) {
            // Obtener las columnas del primer registro
            const columnas = Object.keys(registros[0]);

            // Crear placeholders para los valores
            const placeholders = columnas.map(() => "?").join(", ");
            const columnNames = columnas.join(", ");

            // Insertar registros
            for (const registro of registros) {
              const valores = columnas.map((col) => registro[col]);

              await db.runAsync(
                `INSERT INTO ${nombreTabla} (${columnNames}) VALUES (${placeholders})`,
                valores,
              );
            }

            tablasRestauradas.push(nombreTabla);
            totalRegistros += registros.length;
            console.log(
              `✅ Tabla ${nombreTabla}: ${registros.length} registros restaurados`,
            );
          } else {
            tablasRestauradas.push(nombreTabla);
            console.log(`ℹ️  Tabla ${nombreTabla}: sin datos para restaurar`);
          }
        } catch (error) {
          console.error(`❌ Error restaurando tabla ${nombreTabla}:`, error);
          // Continuar con otras tablas incluso si una falla
        }
      }

      // Reactivar foreign keys
      await db.execAsync("PRAGMA foreign_keys = ON");

      console.log(
        `✅ Restauración completada: ${tablasRestauradas.length} tablas, ${totalRegistros} registros totales`,
      );

      return {
        success: true,
        message: `Base de datos restaurada exitosamente. ${tablasRestauradas.length} tablas y ${totalRegistros} registros recuperados.`,
        restoredTables: tablasRestauradas,
      };
    } catch (error) {
      console.error("❌ Error en restauración:", error);
      return {
        success: false,
        message: `Error al restaurar backup: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }

  // Obtener información de un archivo de backup
  static async obtenerInfoBackup(
    filePath: string,
  ): Promise<{ valido: boolean; info?: any; error?: string }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return { valido: false, error: "El archivo no existe" };
      }

      const jsonString = await FileSystem.readAsStringAsync(filePath);
      const backupData: BackupData = JSON.parse(jsonString);

      const validacion = this.validarBackupData(backupData);
      if (!validacion.valido) {
        return { valido: false, error: validacion.error };
      }

      // Calcular estadísticas
      const estadisticas = {
        version: backupData.version,
        fecha: backupData.fecha,
        totalTablas: Object.keys(backupData.tablas).length,
        totalRegistros: Object.values(backupData.tablas).reduce(
          (sum, tabla) => sum + tabla.length,
          0,
        ),
        tablas: Object.entries(backupData.tablas).map(([nombre, datos]) => ({
          nombre,
          registros: datos.length,
        })),
      };

      return { valido: true, info: estadisticas };
    } catch (error) {
      return {
        valido: false,
        error: `Error leyendo backup: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }

  // Listar todos los backups locales
  static async listarBackupsLocales(): Promise<
    { fileName: string; uri: string; fecha: Date }[]
  > {
    try {
      // Usar el directorio actual para buscar backups
      const files = await FileSystem.readDirectoryAsync(
        FileSystem.documentDirectory || "",
      );

      const backupFiles = files
        .filter(
          (fileName) =>
            fileName.startsWith("gestomax_backup_") &&
            fileName.endsWith(".json"),
        )
        .map((fileName) => {
          const uri = `${FileSystem.documentDirectory || ""}${fileName}`;
          return {
            fileName,
            uri,
            fecha: new Date(), // Se extraerá del nombre del archivo
          };
        });

      // Extraer fecha del nombre del archivo y ordenar
      const filesWithDate = backupFiles.map((file) => {
        const dateMatch = file.fileName.match(/gestomax_backup_(.+)\.json/);
        const fecha = dateMatch
          ? new Date(dateMatch[1].replace(/-/g, ":"))
          : new Date();
        return { ...file, fecha };
      });

      // Ordenar por fecha (más reciente primero)
      return filesWithDate.sort(
        (a, b) => b.fecha.getTime() - a.fecha.getTime(),
      );
    } catch (error) {
      console.error("Error listando backups:", error);
      return [];
    }
  }

  // Eliminar un backup local
  static async eliminarBackupLocal(
    fileName: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const cacheDir =
        (FileSystem as any).cacheDirectory ||
        (FileSystem as any).documentDirectory ||
        "";
      const uri = `${cacheDir}${fileName}`;

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        return { success: false, message: "El archivo de backup no existe" };
      }

      await FileSystem.deleteAsync(uri);

      return { success: true, message: "Backup eliminado exitosamente" };
    } catch (error) {
      return {
        success: false,
        message: `Error eliminando backup: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }
}
