// src/db/services/backup_service_simple.ts
import { DocumentPicker } from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
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

// Servicio simplificado de Backup y Restauración
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
      return [];
    }
  }

  // Exportar base de datos a JSON
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

      // Usar el directorio de documentos que es writable
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        throw new Error("No se pudo acceder al directorio de documentos");
      }

      const fileUri = `${documentsDir}${fileName}`;
      console.log(`📁 Intentando guardar en: ${fileUri}`);

      // Guardar en el directorio de documentos
      try {
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        console.log(`✅ Backup guardado como: ${fileUri}`);

        // Verificar que el archivo se creó
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          throw new Error("No se pudo verificar la creación del archivo");
        }

        return {
          success: true,
          message: `Backup creado exitosamente con ${tablas.length} tablas`,
          filePath: fileUri,
        };
      } catch (writeError) {
        console.error("Error escribiendo archivo:", writeError);
        throw new Error("No se pudo escribir el archivo de backup");
      }
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

  // Limpiar base de datos
  private static async limpiarBaseDatos(): Promise<void> {
    try {
      console.log("🧹 Limpiando base de datos...");

      const tablas = await this.obtenerTablas();

      await db.execAsync("PRAGMA foreign_keys = OFF");

      for (const tabla of tablas) {
        try {
          await db.execAsync(`DELETE FROM ${tabla}`);
          console.log(`🗑️  Datos eliminados de tabla: ${tabla}`);
        } catch (error) {
          console.warn(`⚠️  No se pudo limpiar tabla ${tabla}:`, error);
        }
      }

      await db.execAsync("PRAGMA foreign_keys = ON");

      console.log("✅ Base de datos limpiada");
    } catch (error) {
      console.error("❌ Error limpiando base de datos:", error);
      throw error;
    }
  }

  // Seleccionar archivo de backup usando el selector de archivos
  static async seleccionarArchivoBackup(): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    try {
      console.log("📂 Abriendo selector de archivos...");

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { success: false, error: "No se seleccionó ningún archivo" };
      }

      const asset = result.assets[0];
      console.log(`📄 Archivo seleccionado: ${asset.name}`);

      return {
        success: true,
        filePath: asset.uri,
      };
    } catch (error) {
      console.error("❌ Error seleccionando archivo:", error);
      return {
        success: false,
        error: `Error al seleccionar archivo: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }

  // Restaurar base de datos desde un archivo JSON (actualizado para usar selector)
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

      await db.execAsync("PRAGMA foreign_keys = OFF");

      const tablasRestauradas: string[] = [];
      let totalRegistros = 0;

      // Restaurar cada tabla
      for (const [nombreTabla, registros] of Object.entries(
        backupData.tablas,
      )) {
        try {
          if (Array.isArray(registros) && registros.length > 0) {
            const columnas = Object.keys(registros[0]);
            const placeholders = columnas.map(() => "?").join(", ");
            const columnNames = columnas.join(", ");

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
        }
      }

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

  // Obtener información de un backup
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

  // Listar backups locales (versión simplificada)
  static async listarBackupsLocales(): Promise<
    { fileName: string; uri: string; fecha: Date }[]
  > {
    try {
      // Por ahora, devolvemos un array vacío ya que no podemos listar archivos fácilmente
      // Los usuarios deberán guardar los archivos manualmente y seleccionarlos al restaurar
      console.log(
        "ℹ️  Listado de backups locales no disponible en esta versión",
      );
      return [];
    } catch (error) {
      console.error("Error listando backups:", error);
      return [];
    }
  }

  // Eliminar backup local (versión simplificada)
  static async eliminarBackupLocal(
    fileName: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await FileSystem.deleteAsync(fileName);
      return { success: true, message: "Backup eliminado exitosamente" };
    } catch (error) {
      return {
        success: false,
        message: `Error eliminando backup: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }
}
