// Utilidades para manejo de fechas locales (Cuba)
// Resuelve el problema del cambio de día a las 8:00 PM UTC

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando la zona horaria local
 * Esto resuelve el problema donde new Date().toISOString() usa UTC
 */
export const getFechaLocal = (): string => {
  const ahora = new Date();
  // Forzar la fecha usando la zona horaria de Cuba (UTC-4 o UTC-5 según horario de verano)
  const opciones: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Havana",
  };
  const fechaStr = ahora.toLocaleDateString("es-CU", opciones);
  // Convertir de DD/MM/YYYY a YYYY-MM-DD
  const [dia, mes, año] = fechaStr.split("/");
  return `${año}-${mes}-${dia}`;
};

/**
 * Obtiene fecha y hora actual en formato YYYY-MM-DD HH:MM:SS usando zona horaria local
 * Reemplaza a CURRENT_TIMESTAMP para consistencia
 */
export const getFechaHoraLocalCompleta = (): string => {
  const ahora = new Date();
  // Obtener componentes de fecha local directamente
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const día = String(ahora.getDate()).padStart(2, "0");
  const hora = String(ahora.getHours()).padStart(2, "0");
  const minuto = String(ahora.getMinutes()).padStart(2, "0");
  const segundo = String(ahora.getSeconds()).padStart(2, "0");

  return `${año}-${mes}-${día} ${hora}:${minuto}:${segundo}`;
};

/**
 * Obtiene la fecha y hora actual en formato local
 */
export const getFechaHoraLocal = (): string => {
  return new Date().toLocaleString("es-CU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

/**
 * Convierte una fecha de UTC a formato local YYYY-MM-DD
 */
export const convertirFechaUTCaLocal = (fechaISO: string): string => {
  const fecha = new Date(fechaISO);
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const día = String(fecha.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
};

/**
 * Obtiene fecha de inicio de mes en formato local
 */
export const getInicioMesLocal = (): string => {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  return `${año}-${mes}-01`;
};

/**
 * Obtiene fecha de hace N días en formato local
 */
export const getFechaHaceDias = (dias: number): string => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const día = String(fecha.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
};

/**
 * Formatea una fecha para visualización
 */
export const formatearFecha = (fecha: string): string => {
  // Parsear la fecha directamente sin problemas de zona horaria
  const [año, mes, dia] = fecha.split("-");
  const date = new Date(Number(año), Number(mes) - 1, Number(dia)); // Mes es 0-indexed

  return date.toLocaleDateString("es-CU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Verifica si una fecha es hoy (usando zona horaria local)
 */
export const esHoy = (fecha: string): boolean => {
  return fecha === getFechaLocal();
};

/**
 * Obtiene el rango de fechas de la última semana (usando zona horaria local)
 */
export const getRangoSemanaLocal = (): { inicio: string; fin: string } => {
  const fin = getFechaLocal();
  const inicio = getFechaHaceDias(6); // Últimos 7 días incluyendo hoy
  return { inicio, fin };
};

/**
 * Obtiene el rango de fechas del mes actual (usando zona horaria local)
 */
export const getRangoMesLocal = (): { inicio: string; fin: string } => {
  const inicio = getInicioMesLocal();
  const fin = getFechaLocal();
  return { inicio, fin };
};

/**
 * Obtiene fecha de dentro de N días en formato local
 */
export const getFechaDentroDeDias = (dias: number): string => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const día = String(fecha.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
};
