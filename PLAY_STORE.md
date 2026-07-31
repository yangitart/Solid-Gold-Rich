# Solid Gold Rich · publicación en Google Play

## Antes de compilar

- Completar una política de privacidad pública y enlazarla en Play Console.
- Preparar icono Play de 512×512 PNG y capturas reales de Android.
- Crear la app en Play Console con el paquete `com.yangitart.imrich`.
- Completar clasificación por edades, anuncios y **Data safety**.

## Generar el archivo para Play

Desde `app/`:

```bash
eas login
eas build --platform android --profile production
```

El perfil `production` genera un `.aab` firmado para Google Play.

## Orden recomendado en Play Console

1. Subir el `.aab` a **Internal testing** y probarlo en un teléfono real.
2. Si la cuenta personal es nueva, crear **Closed testing** con 12 testers durante 14 días.
3. Completar todos los formularios de **App content** y la ficha de tienda.
4. Solicitar acceso a producción y crear el release final.

## Datos importantes

- Nombre: `Solid Gold Rich`
- Paquete: `com.yangitart.imrich` (no cambiar después de publicar)
- La autenticación usa huella, rostro o PIN del dispositivo.
- El net worth se almacena localmente; declarar los datos según el comportamiento real de la versión publicada.
- Antes del 31 de agosto de 2026, comprobar que la build cumple el target API exigido por Google Play.
