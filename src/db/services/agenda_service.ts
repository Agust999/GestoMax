import { getFechaLocal } from "../../utils/dateUtils";
import { db } from "../database";

// Tipos para la Agenda
export interface EventoAgenda {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: "cita" | "recordatorio" | "evento";
  prioridad: "baja" | "media" | "alta";
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  punto_id: number | null;
  ubicacion: string | null;
  notas: string | null;
  estado: "pendiente" | "completado" | "cancelado";
  es_recurrente: number; // 0 o 1
  tipo_repeticion: "mensual" | "diario" | null;
  dia_semana: string | null;
  creado_en: string;
  actualizado_en: string;
  punto_nombre: string | null; // Nombre del punto de venta
}

export interface NuevoEvento {
  titulo: string;
  descripcion?: string;
  tipo: "cita" | "recordatorio" | "evento";
  prioridad?: "baja" | "media" | "alta";
  fecha: string;
  hora: string;
  punto_id?: number;
  ubicacion?: string;
  notas?: string;
  es_recurrente?: number;
  tipo_repeticion?: "mensual" | "diario";
  dia_semana?: string;
}

export interface FiltrosAgenda {
  tipo?: "todos" | "cita" | "recordatorio" | "evento";
  estado?: "todos" | "pendiente" | "completado" | "cancelado";
  punto_id?: "todos" | number | null;
  fecha?: "todos" | "hoy" | "semana" | "mes";
}

export class AgendaService {
  // Obtener todos los eventos con filtros opcionales
  static async getAll(
    limit?: number,
    filtros?: FiltrosAgenda,
  ): Promise<EventoAgenda[]> {
    try {
      let query = `
        SELECT 
          a.*,
          p.nombre as punto_nombre
        FROM Agenda a
        LEFT JOIN Punto p ON a.punto_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // Aplicar filtros
      if (filtros?.tipo && filtros.tipo !== "todos") {
        query += ` AND tipo = ?`;
        params.push(filtros.tipo);
      }

      if (filtros?.estado && filtros.estado !== "todos") {
        query += ` AND estado = ?`;
        params.push(filtros.estado);
      }

      if (filtros?.punto_id !== undefined && filtros.punto_id !== "todos") {
        if (filtros.punto_id === null) {
          query += ` AND punto_id IS NULL`;
        } else {
          query += ` AND punto_id = ?`;
          params.push(filtros.punto_id);
        }
      }

      if (filtros?.fecha && filtros.fecha !== "todos") {
        const fechaActual = getFechaLocal();
        switch (filtros.fecha) {
          case "hoy":
            query += ` AND fecha = ?`;
            params.push(fechaActual);
            break;
          case "semana":
            // Próximos 7 días desde hoy (incluyendo hoy)
            const fechaFin = new Date(fechaActual);
            fechaFin.setDate(new Date(fechaActual).getDate() + 7);

            query += ` AND fecha BETWEEN ? AND ?`;
            params.push(
              fechaActual, // Hoy
              fechaFin.toISOString().split("T")[0], // Hoy + 7 días
            );
            break;
          case "mes":
            query += ` AND strftime('%Y-%m', fecha) = strftime('%Y-%m', ?)`;
            params.push(fechaActual);
            break;
        }
      }

      query += ` ORDER BY fecha, hora ASC`;

      if (limit) {
        query += ` LIMIT ?`;
        params.push(limit);
      }

      const resultado = (await db.getAllAsync(query, params)) as EventoAgenda[];
      console.log(`📅 Obtenidos ${resultado.length} eventos de la agenda`);
      return resultado;
    } catch (error) {
      console.error("❌ Error obteniendo eventos de agenda:", error);
      return [];
    }
  }

  // Obtener un evento por ID
  static async getById(id: number): Promise<EventoAgenda | null> {
    try {
      const resultado = (await db.getFirstAsync(
        "SELECT a.*, p.nombre as punto_nombre FROM Agenda a LEFT JOIN Punto p ON a.punto_id = p.id WHERE a.id = ?",
        [id],
      )) as EventoAgenda;

      if (resultado) {
        console.log(`📅 Evento obtenido: ${resultado.titulo}`);
        return resultado;
      }
      return null;
    } catch (error) {
      console.error("❌ Error obteniendo evento por ID:", error);
      return null;
    }
  }

  // Crear nuevo evento
  static async create(evento: NuevoEvento): Promise<number | null> {
    try {
      const ahora = new Date().toISOString();

      const resultado = await db.runAsync(
        `INSERT INTO Agenda (
          titulo, descripcion, tipo, prioridad, fecha, hora, 
          punto_id, ubicacion, notas, estado, es_recurrente, tipo_repeticion, dia_semana, creado_en, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          evento.titulo,
          evento.descripcion || null,
          evento.tipo,
          evento.prioridad || "media",
          evento.fecha,
          evento.hora,
          evento.punto_id || null,
          evento.ubicacion || null,
          evento.notas || null,
          "pendiente",
          evento.es_recurrente || 0,
          evento.tipo_repeticion || null,
          evento.dia_semana || null,
          ahora,
          ahora,
        ],
      );

      console.log(
        `✅ Evento creado: ${evento.titulo} (ID: ${resultado.lastInsertRowId})`,
      );
      return resultado.lastInsertRowId;
    } catch (error) {
      console.error("❌ Error creando evento:", error);
      return null;
    }
  }

  // Actualizar evento existente
  static async update(
    id: number,
    evento: Partial<NuevoEvento> & {
      estado?: "pendiente" | "completado" | "cancelado";
    },
  ): Promise<boolean> {
    try {
      const campos: string[] = [];
      const valores: any[] = [];

      // Construir dinámicamente los campos a actualizar
      if (evento.titulo !== undefined) {
        campos.push("titulo = ?");
        valores.push(evento.titulo);
      }
      if (evento.descripcion !== undefined) {
        campos.push("descripcion = ?");
        valores.push(evento.descripcion);
      }
      if (evento.tipo !== undefined) {
        campos.push("tipo = ?");
        valores.push(evento.tipo);
      }
      if (evento.prioridad !== undefined) {
        campos.push("prioridad = ?");
        valores.push(evento.prioridad);
      }
      if (evento.fecha !== undefined) {
        campos.push("fecha = ?");
        valores.push(evento.fecha);
      }
      if (evento.hora !== undefined) {
        campos.push("hora = ?");
        valores.push(evento.hora);
      }
      if (evento.punto_id !== undefined) {
        campos.push("punto_id = ?");
        valores.push(evento.punto_id);
      }
      if (evento.ubicacion !== undefined) {
        campos.push("ubicacion = ?");
        valores.push(evento.ubicacion);
      }
      if (evento.notas !== undefined) {
        campos.push("notas = ?");
        valores.push(evento.notas);
      }
      if (evento.estado !== undefined) {
        campos.push("estado = ?");
        valores.push(evento.estado);
      }

      // Agregar timestamp de actualización
      campos.push("actualizado_en = ?");
      valores.push(new Date().toISOString());

      // Agregar ID al final
      valores.push(id);

      if (campos.length === 1) {
        // Solo el timestamp
        console.log("⚠️ No hay campos para actualizar");
        return false;
      }

      const resultado = await db.runAsync(
        `UPDATE Agenda SET ${campos.join(", ")} WHERE id = ?`,
        valores,
      );

      const exitoso = resultado.changes > 0;
      if (exitoso) {
        console.log(`✅ Evento actualizado: ID ${id}`);
      } else {
        console.log(`⚠️ No se encontró el evento: ID ${id}`);
      }
      return exitoso;
    } catch (error) {
      console.error("❌ Error actualizando evento:", error);
      return false;
    }
  }

  // Eliminar evento
  static async delete(id: number): Promise<boolean> {
    try {
      const resultado = await db.runAsync("DELETE FROM Agenda WHERE id = ?", [
        id,
      ]);

      const exitoso = resultado.changes > 0;
      if (exitoso) {
        console.log(`🗑️ Evento eliminado: ID ${id}`);
      } else {
        console.log(`⚠️ No se encontró el evento para eliminar: ID ${id}`);
      }
      return exitoso;
    } catch (error) {
      console.error("❌ Error eliminando evento:", error);
      return false;
    }
  }

  // Obtener estadísticas de la agenda
  static async getEstadisticas(puntoId?: number): Promise<{
    total_pendientes: number;
    total_hoy: number;
    total_semana: number;
    total_completados: number;
  }> {
    try {
      const fechaActual = getFechaLocal();

      // Próximos 7 días desde hoy (misma lógica que getEventosSemana)
      const fechaFin = new Date(fechaActual);
      fechaFin.setDate(new Date(fechaActual).getDate() + 7);

      let whereClause = "";
      const params: any[] = [];

      if (puntoId !== undefined && puntoId !== "todos") {
        whereClause = " WHERE punto_id = ?";
        params.push(puntoId);
      }

      const [pendientes, hoy, semana, completados] = await Promise.all([
        db.getFirstAsync(
          `SELECT COUNT(*) as count FROM Agenda${whereClause} ${whereClause ? "AND" : "WHERE"} estado = 'pendiente'`,
          params,
        ) as any,
        db.getFirstAsync(
          `SELECT COUNT(*) as count FROM Agenda${whereClause} ${whereClause ? "AND" : "WHERE"} fecha = ? AND estado != 'cancelado'`,
          [...params, fechaActual],
        ) as any,
        db.getFirstAsync(
          `SELECT COUNT(*) as count FROM Agenda${whereClause} ${whereClause ? "AND" : "WHERE"} fecha BETWEEN ? AND ? AND estado != 'cancelado'`,
          [
            ...params,
            fechaActual, // Hoy
            fechaFin.toISOString().split("T")[0], // Hoy + 7 días
          ],
        ) as any,
        db.getFirstAsync(
          `SELECT COUNT(*) as count FROM Agenda${whereClause} ${whereClause ? "AND" : "WHERE"} estado = 'completado'`,
          params,
        ) as any,
      ]);

      return {
        total_pendientes: (pendientes as any)?.count || 0,
        total_hoy: (hoy as any)?.count || 0,
        total_semana: (semana as any)?.count || 0,
        total_completados: (completados as any)?.count || 0,
      };
    } catch (error) {
      return {
        total_pendientes: 0,
        total_hoy: 0,
        total_semana: 0,
        total_completados: 0,
      };
    }
  }

  // Marcar evento como completado
  static async marcarComoCompletado(id: number): Promise<boolean> {
    return this.update(id, { estado: "completado" });
  }

  // Marcar evento como cancelado
  static async marcarComoCancelado(id: number): Promise<boolean> {
    return this.update(id, { estado: "cancelado" });
  }

  // Reactivar evento (cambiar a pendiente)
  static async reactivar(id: number): Promise<boolean> {
    return this.update(id, { estado: "pendiente" });
  }

  // Obtener eventos para hoy
  static async getEventosHoy(puntoId?: number): Promise<EventoAgenda[]> {
    return this.getAll(undefined, {
      fecha: "hoy",
      estado: "pendiente",
      punto_id: puntoId || "todos",
    });
  }

  // Obtener eventos de esta semana
  static async getEventosSemana(puntoId?: number): Promise<EventoAgenda[]> {
    return this.getAll(undefined, {
      fecha: "semana",
      estado: "pendiente",
      punto_id: puntoId || "todos",
    });
  }
}
