// src/db/services/ganancias_compartidas_service.ts
import { executeNonQuery, executeQuery, getSingleValue } from "../database";

export interface PersonaGananciaCompartida {
  id?: number;
  punto_id: number;
  nombre: string;
  tipo_comparticion: "porcentaje" | "cantidad_fija";
  valor: number; // porcentaje (0-100) o cantidad fija
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface GananciaCompartidaCalculo {
  persona: PersonaGananciaCompartida;
  monto_a_recibir: number;
}

export class GananciasCompartidasService {
  // Crear tabla de ganancias compartidas
  static async crearTabla(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS ganancias_compartidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        punto_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        tipo_comparticion TEXT NOT NULL CHECK (tipo_comparticion IN ('porcentaje', 'cantidad_fija')),
        valor REAL NOT NULL CHECK (valor >= 0),
        activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await executeNonQuery(query);
      console.log("✅ Tabla ganancias_compartidas creada exitosamente");
    } catch (error) {
      console.error("❌ Error creando tabla ganancias_compartidas:", error);
      throw error;
    }
  }

  // Crear nueva persona para compartir ganancias
  static async crearPersona(
    puntoId: number,
    nombre: string,
    tipoComparticion: "porcentaje" | "cantidad_fija",
    valor: number,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Validaciones
      if (!nombre.trim()) {
        return { success: false, message: "El nombre es requerido" };
      }

      if (tipoComparticion === "porcentaje" && (valor < 0 || valor > 100)) {
        return {
          success: false,
          message: "El porcentaje debe estar entre 0 y 100",
        };
      }

      if (tipoComparticion === "cantidad_fija" && valor < 0) {
        return {
          success: false,
          message: "La cantidad fija debe ser mayor o igual a 0",
        };
      }

      // Verificar si ya existe una persona con el mismo nombre
      const existe = await getSingleValue<number>(
        "SELECT COUNT(*) as count FROM ganancias_compartidas WHERE punto_id = ? AND nombre = ? AND activo = 1",
        [puntoId, nombre.trim()],
      );

      if (existe && existe > 0) {
        return {
          success: false,
          message: "Ya existe una persona con ese nombre",
        };
      }

      // Insertar nueva persona
      const resultado = await executeNonQuery(
        `INSERT INTO ganancias_compartidas (punto_id, nombre, tipo_comparticion, valor) 
         VALUES (?, ?, ?, ?)`,
        [puntoId, nombre.trim(), tipoComparticion, valor],
      );

      if (resultado.changes && resultado.changes > 0) {
        const nuevaPersona = await this.obtenerPersonaPorId(
          resultado.lastInsertRowId,
        );
        return {
          success: true,
          message: `Persona "${nombre}" creada exitosamente`,
          data: nuevaPersona,
        };
      } else {
        return { success: false, message: "No se pudo crear la persona" };
      }
    } catch (error) {
      console.error("Error creando persona de ganancias compartidas:", error);
      return { success: false, message: "Error al crear la persona" };
    }
  }

  // Obtener todas las personas activas de un punto
  static async obtenerPersonas(
    puntoId: number,
  ): Promise<PersonaGananciaCompartida[]> {
    try {
      // Primero verificar si la tabla existe
      await this.crearTabla();

      const query = `
        SELECT id, punto_id, nombre, tipo_comparticion, valor, activo, creado_en, actualizado_en
        FROM ganancias_compartidas 
        WHERE punto_id = ? AND activo = 1
        ORDER BY nombre
      `;

      console.log("🔍 Ejecutando query para obtener personas:", query);
      console.log("🔍 Parámetros:", [puntoId]);

      const personas = await executeQuery(query, [puntoId]);
      console.log("✅ Personas obtenidas:", personas);
      return personas as PersonaGananciaCompartida[];
    } catch (error) {
      console.error(
        "Error obteniendo personas de ganancias compartidas:",
        error,
      );
      // Si hay un error, retornar array vacío en lugar de lanzar el error
      console.log("🔄 Retornando array vacío debido a error");
      return [];
    }
  }

  // Obtener persona por ID
  static async obtenerPersonaPorId(
    id: number,
  ): Promise<PersonaGananciaCompartida | null> {
    try {
      const query = `
        SELECT id, punto_id, nombre, tipo_comparticion, valor, activo, creado_en, actualizado_en
        FROM ganancias_compartidas 
        WHERE id = ?
      `;
      const personas = await executeQuery(query, [id]);
      return personas.length > 0
        ? (personas[0] as PersonaGananciaCompartida)
        : null;
    } catch (error) {
      console.error("Error obteniendo persona por ID:", error);
      return null;
    }
  }

  // Actualizar persona
  static async actualizarPersona(
    id: number,
    nombre: string,
    tipoComparticion: "porcentaje" | "cantidad_fija",
    valor: number,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Validaciones
      if (!nombre.trim()) {
        return { success: false, message: "El nombre es requerido" };
      }

      if (tipoComparticion === "porcentaje" && (valor < 0 || valor > 100)) {
        return {
          success: false,
          message: "El porcentaje debe estar entre 0 y 100",
        };
      }

      if (tipoComparticion === "cantidad_fija" && valor < 0) {
        return {
          success: false,
          message: "La cantidad fija debe ser mayor o igual a 0",
        };
      }

      // Verificar si ya existe otra persona con el mismo nombre
      const personaActual = await this.obtenerPersonaPorId(id);
      if (!personaActual) {
        return { success: false, message: "Persona no encontrada" };
      }

      const existe = await getSingleValue<number>(
        "SELECT COUNT(*) as count FROM ganancias_compartidas WHERE punto_id = ? AND nombre = ? AND activo = 1 AND id != ?",
        [personaActual.punto_id, nombre.trim(), id],
      );

      if (existe && existe > 0) {
        return {
          success: false,
          message: "Ya existe otra persona con ese nombre",
        };
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      // Actualizar persona
      const resultado = await executeNonQuery(
        `UPDATE ganancias_compartidas 
         SET nombre = ?, tipo_comparticion = ?, valor = ?, actualizado_en = ?
         WHERE id = ?`,
        [nombre.trim(), tipoComparticion, valor, ahora, id],
      );

      if (resultado.changes && resultado.changes > 0) {
        const personaActualizada = await this.obtenerPersonaPorId(id);
        return {
          success: true,
          message: `Persona "${nombre}" actualizada exitosamente`,
          data: personaActualizada,
        };
      } else {
        return { success: false, message: "No se pudo actualizar la persona" };
      }
    } catch (error) {
      console.error(
        "Error actualizando persona de ganancias compartidas:",
        error,
      );
      return { success: false, message: "Error al actualizar la persona" };
    }
  }

  // Eliminar persona (desactivar)
  static async eliminarPersona(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      const resultado = await executeNonQuery(
        "UPDATE ganancias_compartidas SET activo = 0, actualizado_en = ? WHERE id = ?",
        [ahora, id],
      );

      if (resultado.changes && resultado.changes > 0) {
        return { success: true, message: "Persona eliminada exitosamente" };
      } else {
        return { success: false, message: "No se pudo eliminar la persona" };
      }
    } catch (error) {
      console.error(
        "Error eliminando persona de ganancias compartidas:",
        error,
      );
      return { success: false, message: "Error al eliminar la persona" };
    }
  }

  // Calcular distribución de ganancias
  static async calcularDistribucion(
    puntoId: number,
    gananciaTotal: number,
  ): Promise<{
    totalUsuario: number;
    distribuciones: GananciaCompartidaCalculo[];
    mensaje?: string;
  }> {
    try {
      const personas = await this.obtenerPersonas(puntoId);
      const distribuciones: GananciaCompartidaCalculo[] = [];
      let totalRepartido = 0;

      // Calcular para cada persona
      for (const persona of personas) {
        let monto_a_recibir = 0;

        if (persona.tipo_comparticion === "porcentaje") {
          monto_a_recibir = (gananciaTotal * persona.valor) / 100;
        } else if (persona.tipo_comparticion === "cantidad_fija") {
          monto_a_recibir = persona.valor;
        }

        totalRepartido += monto_a_recibir;

        distribuciones.push({
          persona,
          monto_a_recibir,
        });
      }

      // Calcular lo que le queda al usuario
      const totalUsuario = gananciaTotal - totalRepartido;

      // Validar que no se reparta más de lo disponible
      if (totalUsuario < 0) {
        return {
          totalUsuario: 0,
          distribuciones: distribuciones.map((d) => ({
            ...d,
            monto_a_recibir: 0,
          })),
          mensaje:
            "Advertencia: La suma de comparticiones excede la ganancia total. Ajustando montos a 0.",
        };
      }

      return {
        totalUsuario,
        distribuciones,
      };
    } catch (error) {
      console.error("Error calculando distribución de ganancias:", error);
      return {
        totalUsuario: gananciaTotal,
        distribuciones: [],
        mensaje: "Error al calcular la distribución",
      };
    }
  }

  // Verificar si hay personas configuradas
  static async hayPersonasConfiguradas(puntoId: number): Promise<boolean> {
    try {
      const count = await getSingleValue<number>(
        "SELECT COUNT(*) as count FROM ganancias_compartidas WHERE punto_id = ? AND activo = 1",
        [puntoId],
      );
      return (count || 0) > 0;
    } catch (error) {
      console.error("Error verificando personas configuradas:", error);
      return false;
    }
  }

  // Calcular el total de porcentajes existentes para un punto
  static async calcularTotalPorcentajes(puntoId: number): Promise<number> {
    try {
      const total = await getSingleValue<number>(
        "SELECT COALESCE(SUM(valor), 0) as total_porcentajes FROM ganancias_compartidas WHERE punto_id = ? AND activo = 1 AND tipo_comparticion = 'porcentaje'",
        [puntoId],
      );
      return total || 0;
    } catch (error) {
      console.error("Error calculando total de porcentajes:", error);
      return 0;
    }
  }
}
