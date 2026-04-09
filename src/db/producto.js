import { getDB } from './database';

export const productoDB = {
  add: async (producto) => {
    const db = await getDB();

    const result = await db.runAsync(
      `INSERT INTO productos 
      (nombre, categoria, subcategoria, precio_de_coste, fecha_caducidad)
      VALUES (?, ?, ?, ?, ?)`,
      [
        producto.nombre,
        producto.categoria,
        producto.subcategoria,
        producto.precio_de_coste,
        producto.fecha_caducidad,
      ]
    );

    return result.lastInsertRowId;
  },

  getAll: async () => {
    const db = await getDB();

    return await db.getAllAsync(
      `SELECT * FROM productos`
    );
  },
};
