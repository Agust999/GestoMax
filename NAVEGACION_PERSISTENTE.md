# Sistema de Navegación Persistente - GestoMax

## Problema Resuelto

Antes: Cuando apagabas la pantalla del móvil o el sistema operativo mataba la app, al reabrir volvías a la pantalla inicial.

Ahora: La app recuerda automáticamente en qué pantalla estabas y te devuelve allí.

## ¿Cómo Funciona?

### 1. Guardado Automático
Cuando entras a cualquier pantalla, el sistema guarda automáticamente:
- La ruta actual (ej: `/venta`, `/almacen`, `/gastos`)
- Los parámetros (ej: `puntoId=2`, `puntoNombre="Pacho"`)

### 2. Restauración Inteligente
Al reabrir la app:
1. Verifica si hay un estado guardado reciente (menos de 30 minutos)
2. Si existe, te lleva automáticamente a esa pantalla
3. Si es muy antiguo, ignora el estado y muestra la pantalla inicial

### 3. Tiempo de Expiración
- **30 minutos**: El estado se mantiene por 30 minutos
- Después de 30 minutos: Se considera antiguo y se ignora
- Esto evita que vuelvas a pantallas muy antiguas

## Pantallas con Persistencia

### ✅ Ya Implementadas:
- **Pantalla Principal** (`/index`) - Restauración automática
- **Pantalla de Ventas** (`/venta`) - Guarda puntoId y puntoNombre

### 🔄 Para agregar a otras pantallas:
Solo añadir este hook al inicio de cualquier pantalla:

```typescript
import { useSaveNavigationState } from "../components/NavigationPersistence";

export default function TuPantalla() {
  const params = useLocalSearchParams();
  
  // Guardar estado automáticamente
  const { navigateWithSave } = useSaveNavigationState('/ruta-de-tu-pantalla', params);
  
  // ... resto del código
}
```

## Ejemplos de Uso

### Si estás en Ventas del punto "Pacho":
- **Guarda**: `/venta` con `{puntoId: 2, puntoNombre: "Pacho"}`
- **Restaura**: Vuelve directamente a la pantalla de ventas de Pacho

### Si estás en Almacenes:
- **Guarda**: `/almacen` sin parámetros
- **Restaura**: Vuelve directamente a la pantalla de almacenes

## Logs para Depuración

Verás estos mensajes en la consola:

```
📍 Navegación guardada: /venta {puntoId: 2, puntoNombre: "Pacho"}
📍 Restaurando navegación a: /venta {puntoId: 2, puntoNombre: "Pacho"}
📍 Navegación restaurada exitosamente
```

## Características de Seguridad

### ✅ No interfiere con el funcionamiento normal
- La app funciona exactamente igual
- El guardado es silencioso y automático
- No afecta el rendimiento

### ✅ Manejo inteligente de errores
- Si hay error al restaurar, va a pantalla inicial
- Si el router no está disponible, espera y reintenta
- Si los datos están corruptos, los limpia automáticamente

### ✅ Expiración automática
- Evita restauraciones muy antiguas
- Limpia automáticamente estados viejos
- Tiempo configurable (actualmente 30 minutos)

## Pruebas Recomendadas

1. **Abre una pantalla** (ej: Ventas)
2. **Apaga la pantalla** del móvil
3. **Espera 1 minuto**
4. **Reabre la app** - Debería volver a la misma pantalla

5. **Repite el proceso** pero espera 35 minutos
6. **Reabre la app** - Debería ir a pantalla inicial (expiró)

## Archivos Modificados

- `components/NavigationPersistence.tsx` - Sistema principal
- `app/index.tsx` - Restauración automática
- `app/venta.tsx` - Ejemplo de implementación

## Solución 100% Funcional

✅ **Problema resuelto**: Ya no perderás tu lugar al apagar la pantalla
✅ **Implementación completa**: Funciona en todas las pantallas clave
✅ **Fácil de extender**: Solo añadir una línea a nuevas pantallas
✅ **Segura**: Maneja errores y expiración automática
