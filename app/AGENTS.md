# Solid Gold Rich

## Alcance

- Esta carpeta contiene una app Expo/React Native enfocada en Android.
- La entrada visual es `src/screens/AppRoot.tsx`; la ficha principal está en `src/screens/RichScreen.tsx`.
- El nombre público es `Solid Gold Rich` y el package Android es `com.yangitart.imrich`. No cambiar ninguno sin autorización explícita.
- No recrear archivos de documentación de Play Store que el usuario haya eliminado. No modificar archivos generados dentro de `dist/` o `android/`.

## Decisiones de producto que se deben preservar

- Es una app meme presentada como una ficha premium de riqueza; no es un juego de taps.
- El usuario introduce su patrimonio y el diamante cambia según la escala definida en `src/components/Gem.tsx`.
- El patrimonio comienza en `0` y se conserva con AsyncStorage usando `@im-rich/net-worth`.
- No mostrar mensajes técnicos como “guardado localmente”.
- Tocar el diamante solo activa una animación satisfactoria; nunca cambia el patrimonio ni crea un contador.
- Mantener la interfaz estable: ningún texto o número grande debe desbordarse ni cambiar el tamaño general del layout.
- La estética debe seguir siendo oscura, dorada, exagerada y premium.
- No reintroducir autenticación, huella, foto, captura o compartir salvo petición explícita del usuario.

## Idiomas

- Usar i18next y detectar únicamente el idioma configurado del teléfono mediante `expo-localization/getLocales`; no consultar GPS ni pedir permisos de ubicación.
- Idiomas actuales: inglés, español, portugués, francés, alemán e italiano. Inglés es el fallback.
- Todo texto visible nuevo debe usar claves de traducción.
- Al agregar o renombrar una clave, actualizar todos los archivos `src/core/locales/translation_*.json`.

## Peso y dependencias

- La app debe mantenerse ligera; objetivo del usuario: APK menor de 20 MB.
- No agregar una dependencia si React Native, Expo o el código actual pueden resolverlo razonablemente.
- `expo-constants` y `expo-linking` parecen indirectas, pero deben permanecer porque son peer dependencies obligatorias de `expo-router`.
- Evitar dependencias web, imágenes pesadas y fuentes empaquetadas innecesarias.
- Después de cambiar dependencias, ejecutar Expo Doctor y comprobar el bundle Android.

## Validación antes de entregar

Ejecutar desde esta carpeta:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src/screens src/components src/core/locales
npx.cmd expo-doctor
npx.cmd expo export --platform android
```

- Validar también que todos los JSON de traducción se puedan parsear.
- No usar `npm audit fix --force`; puede actualizar Expo con cambios incompatibles.
- No crear commits ni hacer push salvo que el usuario lo solicite explícitamente.
