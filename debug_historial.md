// Script para probar la inserción en HistorialInventario
// Este script simula la creación de un producto para generar un registro

console.log('🧪 Script de prueba para HistorialInventario');
console.log('==========================================');

console.log('📋 Pasos para verificar el historial:');
console.log('');
console.log('1. Abre la aplicación GestoMax');
console.log('2. Ve a la pantalla de Almacén');
console.log('3. Selecciona un almacén específico (no "Almacén General")');
console.log('4. Crea un nuevo producto con stock inicial');
console.log('5. O ajusta el stock de un producto existente');
console.log('6. O transfiere productos entre almacenes');
console.log('7. Luego verifica el historial en la misma pantalla');
console.log('');
console.log('🔍 El historial debería mostrar:');
console.log('- Creación de productos (tipo: "ajuste")');
console.log('- Transferencias (tipo: "transferencia")');
console.log('- Ajustes de stock (tipo: "ajuste")');
console.log('');
console.log('⚠️ Si no muestra nada, revisa:');
console.log('1. Que estés viendo un almacén específico (ID > 0)');
console.log('2. Que el filtro de tipo de movimiento esté en "todos"');
console.log('3. Que haya registros creados después de los cambios');
console.log('');
console.log('📝 Logs que deberías ver en la consola:');
console.log('- "🔍 Contexto actual - AlmacenActual: {id: X, nombre: "..."}"');
console.log('- "🏭 Filtrando por almacén ID: X"');
console.log('- "📊 Obtenidos X movimientos del historial de inventario"');
console.log('');
console.log('🚀 Si después de crear productos el historial sigue vacío,');
console.log('entonces el problema está en la inserción de registros.');
