// src/db/services/backup_service_final.ts
import * as DocumentPicker from "expo-document-picker";
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

// Servicio de Backup y Restauración - Versión Final
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

  // Crear y verificar carpeta GestoMax en Downloads
  private static async asegurarCarpetaGestoMax(): Promise<string> {
    try {
      console.log("📁 Verificando carpeta GestoMax...");

      // Para Android, usar el directorio de Downloads
      const downloadsDir =
        FileSystem.documentDirectory?.replace("files/", "Downloads/") || "";
      const gestomaxDir = `${downloadsDir}GestoMax/`;

      console.log(`📂 Intentando crear carpeta: ${gestomaxDir}`);

      // Verificar si la carpeta existe, si no, crearla
      const dirInfo = await FileSystem.getInfoAsync(gestomaxDir);
      if (!dirInfo.exists) {
        console.log("📁 Creando carpeta GestoMax...");
        await FileSystem.makeDirectoryAsync(gestomaxDir, {
          intermediates: true,
        }).catch((err) => {
          console.warn("No se pudo crear la carpeta:", err);
        });
      }

      // Verificar que se creó correctamente
      const finalCheck = await FileSystem.getInfoAsync(gestomaxDir);
      if (finalCheck.exists) {
        console.log(`✅ Carpeta GestoMax lista en: ${gestomaxDir}`);
        return gestomaxDir;
      } else {
        // Fallback: usar directorio de documentos
        const fallbackDir = FileSystem.documentDirectory || "";
        const fallbackGestomax = `${fallbackDir}GestoMax/`;

        console.log("📁 Creando carpeta GestoMax en Documents (fallback)...");
        await FileSystem.makeDirectoryAsync(fallbackGestomax, {
          intermediates: true,
        }).catch(() => {});

        return fallbackGestomax;
      }
    } catch (error) {
      console.error("❌ Error creando carpeta:", error);
      return FileSystem.documentDirectory || "";
    }
  }

  // Seleccionar carpeta para guardar backup
  static async seleccionarCarpeta(): Promise<{
    success: boolean;
    folderUri?: string;
    error?: string;
  }> {
    try {
      console.log("📂 Abriendo selector de carpetas...");

      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { success: false, error: "No se seleccionó ninguna carpeta" };
      }

      const asset = result.assets[0];
      console.log(`📁 Carpeta seleccionada: ${asset.name}`);

      return {
        success: true,
        folderUri: asset.uri.replace(/\/[^\/]+$/, ""), // Extraer ruta de la carpeta
      };
    } catch (error) {
      console.error("❌ Error seleccionando carpeta:", error);
      return {
        success: false,
        error: `Error al seleccionar carpeta: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }

  // Exportar base de datos a JSON en carpeta fija Download/GestoMax/
  static async exportarBaseDatos(): Promise<BackupResult> {
    try {
      console.log("🔄 Iniciando exportación de base de datos...");

      const tablas = await this.obtenerTablas();
      console.log(`📊 Encontradas ${tablas.length} tablas:`, tablas);

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

      const jsonString = JSON.stringify(backupData, null, 2);

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const fileName = `gestomax_backup_${timestamp}.json`;

      // Usar siempre la carpeta fija Download/GestoMax/
      const gestomaxDir = await this.asegurarCarpetaGestoMax();
      const fileUri = `${gestomaxDir}${fileName}`;

      console.log(`📁 Guardando backup en: ${fileUri}`);

      try {
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        console.log(`✅ Backup guardado como: ${fileUri}`);

        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          throw new Error("No se pudo verificar la creación del archivo");
        }

        // Mostrar ruta amigable para el usuario
        const rutaAmigable = fileUri.includes("Downloads/")
          ? fileUri.replace(/.*\/Downloads\//, "/storage/emulated/0/Downloads/")
          : fileUri;

        return {
          success: true,
          message: `✅ Backup creado exitosamente!\n\n📁 Ubicación: ${rutaAmigable}\n📄 Archivo: ${fileName}\n📊 Tablas: ${tablas.length}`,
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

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error("El archivo de backup no existe");
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error(
          "La función de compartir no está disponible en este dispositivo",
        );
      }

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

  // Restaurar base de datos desde un archivo JSON
  static async restaurarBaseDatos(filePath: string): Promise<RestoreResult> {
    try {
      console.log("🔄 Iniciando restauración de base de datos...");

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error("El archivo de backup no existe");
      }

      const jsonString = await FileSystem.readAsStringAsync(filePath);
      const backupData: BackupData = JSON.parse(jsonString);

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

      await this.limpiarBaseDatos();

      await db.execAsync("PRAGMA foreign_keys = OFF");

      const tablasRestauradas: string[] = [];
      let totalRegistros = 0;

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

  // Listar backups disponibles en la carpeta GestoMax
  static async listarBackupsDisponibles(): Promise<
    { fileName: string; uri: string; fecha: Date }[]
  > {
    try {
      console.log("📂 Buscando backups en carpeta GestoMax...");

      const gestomaxDir = await this.asegurarCarpetaGestoMax();
      const files = await FileSystem.readDirectoryAsync(gestomaxDir);

      const backupFiles = files
        .filter(
          (fileName) =>
            fileName.startsWith("gestomax_backup_") &&
            fileName.endsWith(".json"),
        )
        .map((fileName) => {
          const uri = `${gestomaxDir}${fileName}`;
          return {
            fileName,
            uri,
            fecha: new Date(), // Se extraerá del nombre del archivo
          };
        });

      const filesWithDate = backupFiles.map((file) => {
        const dateMatch = file.fileName.match(/gestomax_backup_(.+)\.json/);
        const fecha = dateMatch
          ? new Date(dateMatch[1].replace(/-/g, ":"))
          : new Date();
        return { ...file, fecha };
      });

      return filesWithDate.sort(
        (a, b) => b.fecha.getTime() - a.fecha.getTime(),
      );
    } catch (error) {
      console.error("Error listando backups:", error);
      return [];
    }
  }

  // Seleccionar archivo de backup usando el selector de archivos
  static async seleccionarArchivoBackup(): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
  }> {
    try {
      console.log("📂 Abriendo selector de archivos...");

      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
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
        fileName: asset.name,
      };
    } catch (error) {
      console.error("❌ Error seleccionando archivo:", error);
      return {
        success: false,
        error: `Error al seleccionar archivo: ${error instanceof Error ? error.message : "Error desconocido"}`,
      };
    }
  }

  // Función simplificada para importación (sin selector automático)
  static async mostrarInstruccionesImportacion(): Promise<{
    success: boolean;
    message: string;
  }> {
    return {
      success: true,
      message: `Para importar un backup:\n\n1. Primero exporte la base de datos actual\n2. Guarde el archivo JSON en su dispositivo\n3. Mueva el archivo a una ubicación accesible\n4. Use una app de archivos para copiar el contenido\n5. Contácte al soporte para asistencia técnica\n\nEsta es una medida de seguridad para proteger sus datos.`,
    };
  }
}
