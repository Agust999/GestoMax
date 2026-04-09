// Script SQL para agregar la columna salario_fijo a la tabla Gastos
console.log('🔧 AGREGANDO COLUMNA salario_fijo A TABLA GASTOS');

// Este script debe ejecutarse en la base de datos SQLite
const sql = `
-- Verificar si la columna existe (opcional)
-- PRAGMA table_info(Gastos);

-- Agregar la columna si no existe
ALTER TABLE Gastos ADD COLUMN salario_fijo REAL;
`;

console.log('📝 SQL a ejecutar:');
console.log(sql);
console.log('');
console.log('🎯 PASOS PARA SOLUCIONAR EL PROBLEMA:');
console.log('1. Abre la base de datos SQLite');
console.log('2. Ejecuta el SQL anterior');
console.log('3. Reinicia la aplicación');
console.log('4. Intenta entrar en la pantalla de gastos');
console.log('');
console.log('✅ Esto debería resolver el error "no such column: salario_fijo"');
