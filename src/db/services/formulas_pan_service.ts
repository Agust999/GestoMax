// src/db/services/formulas_pan_service.ts
import {
    executeNonQuery,
    executeQuery,
    getFirst,
    getSingleValue,
} from "../database";

export interface FormulaPan {
  id: number;
  almacen_id: number;
  nombre: string;
  harina: number;
  levadura: number;
  nucleo: number;
  azucar: number;
  sal: number;
  aceite: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

// Interfaz para crear una nueva fórmula
export interface CrearFormulaPan {
  almacen_id: number;
  nombre: string;
  harina: number;
  levadura: number;
  nucleo: number;
  azucar: number;
  sal: number;
  aceite: number;
}

export interface ActualizarFormulaPan {
  nombre?: string;
  harina?: number;
  levadura?: number;
  nucleo?: number;
  azucar?: number;
  sal?: number;
  aceite?: number;
  activo?: boolean;
}

export class FormulasPanService {
  // Obtener todas las fórmulas activas de un almacén específico
  static async obtenerFormulasActivas(
    almacenId: number,
  ): Promise<FormulaPan[]> {
    try {
      const formulas = await executeQuery<FormulaPan>(
        `SELECT * FROM FormulasPan 
         WHERE activo = 1 AND almacen_id = ?
         ORDER BY nombre ASC`,
        [almacenId],
      );
      return formulas;
    } catch (error) {
      console.error("Error obteniendo fórmulas activas:", error);
      return [];
    }
  }

  // Obtener todas las fórmulas (incluyendo inactivas)
  static async obtenerTodasLasFormulas(): Promise<FormulaPan[]> {
    try {
      const formulas = await executeQuery<FormulaPan>(
        `SELECT * FROM FormulasPan 
         ORDER BY nombre ASC`,
      );
      return formulas;
    } catch (error) {
      console.error("Error obteniendo todas las fórmulas:", error);
      return [];
    }
  }

  // Obtener una fórmula por ID
  static async obtenerFormulaPorId(id: number): Promise<FormulaPan | null> {
    try {
      const formula = await getFirst<FormulaPan>(
        `SELECT * FROM FormulasPan WHERE id = ?`,
        [id],
      );
      return formula || null;
    } catch (error) {
      console.error("Error obteniendo fórmula por ID:", error);
      return null;
    }
  }

  // Crear una nueva fórmula
  static async crearFormula(
    formula: CrearFormulaPan,
  ): Promise<{ success: boolean; message: string; data?: FormulaPan }> {
    try {
      // Validar que todos los campos estén completos
      if (!formula.nombre.trim()) {
        return {
          success: false,
          message: "El nombre de la fórmula es obligatorio",
        };
      }

      // Validar que los ingredientes tengan valores válidos
      if (
        formula.harina <= 0 ||
        formula.levadura < 0 ||
        formula.nucleo < 0 ||
        formula.azucar < 0 ||
        formula.sal < 0 ||
        formula.aceite < 0
      ) {
        return {
          success: false,
          message:
            "Todos los ingredientes deben tener valores válidos (la harina debe ser mayor a 0)",
        };
      }

      // Verificar si ya existe una fórmula con el mismo nombre en este almacén
      const existeFormula = await getSingleValue<number>(
        `SELECT COUNT(*) as count FROM FormulasPan WHERE nombre = ? AND almacen_id = ? AND activo = 1`,
        [formula.nombre.trim(), formula.almacen_id],
      );

      if (existeFormula && existeFormula > 0) {
        return {
          success: false,
          message: `Ya existe una fórmula con el nombre "${formula.nombre}"`,
        };
      }

      // Insertar la nueva fórmula
      const resultado = await executeNonQuery(
        `INSERT INTO FormulasPan (almacen_id, nombre, harina, levadura, nucleo, azucar, sal, aceite, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          formula.almacen_id,
          formula.nombre.trim(),
          formula.harina,
          formula.levadura,
          formula.nucleo,
          formula.azucar,
          formula.sal,
          formula.aceite,
        ],
      );

      if (resultado.changes > 0) {
        // Obtener la fórmula recién creada
        const nuevaFormula = await this.obtenerFormulaPorId(
          resultado.lastInsertRowId,
        );

        return {
          success: true,
          message: `Fórmula "${formula.nombre}" creada exitosamente`,
          data: nuevaFormula || undefined,
        };
      } else {
        return {
          success: false,
          message: "No se pudo crear la fórmula",
        };
      }
    } catch (error: any) {
      console.error("Error creando fórmula:", error);
      return {
        success: false,
        message: error.message || "Error al crear la fórmula",
      };
    }
  }

  // Actualizar una fórmula existente
  static async actualizarFormula(
    id: number,
    datos: ActualizarFormulaPan,
  ): Promise<{ success: boolean; message: string; data?: FormulaPan }> {
    try {
      // Verificar que la fórmula existe
      const formulaExistente = await this.obtenerFormulaPorId(id);
      if (!formulaExistente) {
        return {
          success: false,
          message: "La fórmula que intentas actualizar no existe",
        };
      }

      // Si se está actualizando el nombre, verificar que no exista otra fórmula con ese nombre
      if (datos.nombre && datos.nombre.trim() !== formulaExistente.nombre) {
        const existeFormula = await getSingleValue<number>(
          `SELECT COUNT(*) as count FROM FormulasPan 
           WHERE nombre = ? AND almacen_id = ? AND id != ? AND activo = 1`,
          [datos.nombre.trim(), formulaExistente.almacen_id, id],
        );

        if (existeFormula && existeFormula > 0) {
          return {
            success: false,
            message: `Ya existe otra fórmula con el nombre "${datos.nombre}"`,
          };
        }
      }

      // Construir la consulta de actualización dinámicamente
      const camposActualizar: string[] = [];
      const valoresActualizar: any[] = [];

      if (datos.nombre !== undefined) {
        camposActualizar.push("nombre = ?");
        valoresActualizar.push(datos.nombre.trim());
      }
      if (datos.harina !== undefined) {
        if (datos.harina <= 0) {
          return {
            success: false,
            message: "La harina debe ser mayor a 0",
          };
        }
        camposActualizar.push("harina = ?");
        valoresActualizar.push(datos.harina);
      }
      if (datos.levadura !== undefined) {
        if (datos.levadura < 0) {
          return {
            success: false,
            message: "La levadura no puede ser negativa",
          };
        }
        camposActualizar.push("levadura = ?");
        valoresActualizar.push(datos.levadura);
      }
      if (datos.nucleo !== undefined) {
        if (datos.nucleo < 0) {
          return {
            success: false,
            message: "El núcleo no puede ser negativo",
          };
        }
        camposActualizar.push("nucleo = ?");
        valoresActualizar.push(datos.nucleo);
      }
      if (datos.azucar !== undefined) {
        if (datos.azucar < 0) {
          return {
            success: false,
            message: "El azúcar no puede ser negativa",
          };
        }
        camposActualizar.push("azucar = ?");
        valoresActualizar.push(datos.azucar);
      }
      if (datos.sal !== undefined) {
        if (datos.sal < 0) {
          return {
            success: false,
            message: "La sal no puede ser negativa",
          };
        }
        camposActualizar.push("sal = ?");
        valoresActualizar.push(datos.sal);
      }
      if (datos.aceite !== undefined) {
        if (datos.aceite < 0) {
          return {
            success: false,
            message: "El aceite no puede ser negativo",
          };
        }
        camposActualizar.push("aceite = ?");
        valoresActualizar.push(datos.aceite);
      }
      if (datos.activo !== undefined) {
        camposActualizar.push("activo = ?");
        valoresActualizar.push(datos.activo ? 1 : 0);
      }

      if (camposActualizar.length === 0) {
        return {
          success: false,
          message: "No hay campos para actualizar",
        };
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      // Agregar timestamp de actualización
      camposActualizar.push("actualizado_en = ?");
      valoresActualizar.push(ahora);

      // Ejecutar la actualización
      const resultado = await executeNonQuery(
        `UPDATE FormulasPan SET ${camposActualizar.join(", ")} WHERE id = ?`,
        [...valoresActualizar, id],
      );

      if (resultado.changes > 0) {
        // Obtener la fórmula actualizada
        const formulaActualizada = await this.obtenerFormulaPorId(id);

        return {
          success: true,
          message: "Fórmula actualizada exitosamente",
          data: formulaActualizada || undefined,
        };
      } else {
        return {
          success: false,
          message: "No se pudo actualizar la fórmula",
        };
      }
    } catch (error: any) {
      console.error("Error actualizando fórmula:", error);
      return {
        success: false,
        message: error.message || "Error al actualizar la fórmula",
      };
    }
  }

  // Eliminar (desactivar) una fórmula
  static async eliminarFormula(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verificar que la fórmula existe
      const formulaExistente = await this.obtenerFormulaPorId(id);

      if (!formulaExistente) {
        return {
          success: false,
          message: "La fórmula que intentas eliminar no existe",
        };
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      // Desactivar la fórmula (eliminación lógica)
      const resultado = await executeNonQuery(
        `UPDATE FormulasPan SET activo = 0, actualizado_en = ? WHERE id = ?`,
        [ahora, id],
      );

      if (resultado.changes > 0) {
        return {
          success: true,
          message: `Fórmula "${formulaExistente.nombre}" eliminada exitosamente`,
        };
      } else {
        return {
          success: false,
          message: "No se pudo eliminar la fórmula",
        };
      }
    } catch (error: any) {
      console.error("Error eliminando fórmula:", error);
      return {
        success: false,
        message: error.message || "Error al eliminar la fórmula",
      };
    }
  }

  // Reactivar una fórmula
  static async reactivarFormula(
    id: number,
  ): Promise<{ success: boolean; message: string; data?: FormulaPan }> {
    try {
      // Verificar que la fórmula existe
      const formulaExistente = await this.obtenerFormulaPorId(id);
      if (!formulaExistente) {
        return {
          success: false,
          message: "La fórmula que intentas reactivar no existe",
        };
      }

      if (formulaExistente.activo) {
        return {
          success: false,
          message: "La fórmula ya está activa",
        };
      }

      // Usar fecha local en lugar de UTC
      const { getFechaHoraLocalCompleta } =
        await import("../../utils/dateUtils");
      const ahora = getFechaHoraLocalCompleta();

      // Reactivar la fórmula
      const resultado = await executeNonQuery(
        `UPDATE FormulasPan SET activo = 1, actualizado_en = ? WHERE id = ?`,
        [ahora, id],
      );

      if (resultado.changes > 0) {
        // Obtener la fórmula reactivada
        const formulaReactivada = await this.obtenerFormulaPorId(id);

        return {
          success: true,
          message: `Fórmula "${formulaExistente.nombre}" reactivada exitosamente`,
          data: formulaReactivada || undefined,
        };
      } else {
        return {
          success: false,
          message: "No se pudo reactivar la fórmula",
        };
      }
    } catch (error: any) {
      console.error("Error reactivando fórmula:", error);
      return {
        success: false,
        message: error.message || "Error al reactivar la fórmula",
      };
    }
  }

  // Eliminar permanentemente una fórmula (eliminación física)
  static async eliminarFormulaPermanentemente(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verificar que la fórmula existe
      const formulaExistente = await this.obtenerFormulaPorId(id);
      if (!formulaExistente) {
        return {
          success: false,
          message: "La fórmula que intentas eliminar no existe",
        };
      }

      // Eliminar la fórmula permanentemente
      const resultado = await executeNonQuery(
        `DELETE FROM FormulasPan WHERE id = ?`,
        [id],
      );

      if (resultado.changes > 0) {
        return {
          success: true,
          message: `Fórmula "${formulaExistente.nombre}" eliminada permanentemente`,
        };
      } else {
        return {
          success: false,
          message: "No se pudo eliminar la fórmula permanentemente",
        };
      }
    } catch (error: any) {
      console.error("Error eliminando permanentemente fórmula:", error);
      return {
        success: false,
        message:
          error.message || "Error al eliminar permanentemente la fórmula",
      };
    }
  }

  // Buscar fórmulas por nombre en un almacén específico
  static async buscarFormulasPorNombre(
    termino: string,
    almacenId: number,
  ): Promise<FormulaPan[]> {
    try {
      if (!termino.trim()) {
        return await this.obtenerFormulasActivas(almacenId);
      }

      const formulas = await executeQuery<FormulaPan>(
        `SELECT * FROM FormulasPan 
         WHERE activo = 1 AND almacen_id = ? AND nombre LIKE ? 
         ORDER BY nombre ASC`,
        [almacenId, `%${termino.trim()}%`],
      );
      return formulas;
    } catch (error: any) {
      console.error("Error buscando fórmulas por nombre:", error);
      return [];
    }
  }

  // Verificar si existe una fórmula con el mismo nombre (excluyendo un ID específico)
  static async verificarNombreUnico(
    nombre: string,
    excluirId?: number,
  ): Promise<boolean> {
    try {
      let query = `SELECT COUNT(*) as count FROM FormulasPan WHERE nombre = ? AND activo = 1`;
      let params: any[] = [nombre.trim()];

      if (excluirId) {
        query += ` AND id != ?`;
        params.push(excluirId);
      }

      const resultado = await getSingleValue<number>(query, params);
      return (resultado || 0) === 0;
    } catch (error) {
      console.error("Error verificando nombre único:", error);
      return false;
    }
  }
}
