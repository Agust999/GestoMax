
-- PRUEBA DE ACTUALIZACIÓN DE PORCENTAJE
-- Verificar estado actual
SELECT 'ANTES:' as info;
SELECT id, nombre, porcentaje FROM Gastos WHERE id = 22;

-- Simular la actualización que debería hacer el sistema
UPDATE Gastos 
SET porcentaje = 3, actualizado_en = CURRENT_TIMESTAMP 
WHERE id = 22;

-- Verificar resultado
SELECT 'DESPUÉS:' as info;
SELECT id, nombre, porcentaje, actualizado_en FROM Gastos WHERE id = 22;

-- Restaurar valor original (para no afectar los datos)
UPDATE Gastos 
SET porcentaje = 5, actualizado_en = CURRENT_TIMESTAMP 
WHERE id = 22;

SELECT 'RESTAURADO:' as info;
SELECT id, nombre, porcentaje FROM Gastos WHERE id = 22;
    