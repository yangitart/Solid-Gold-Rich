# Solid Gold Rich

## Alcance y estructura

- Esta carpeta contiene una app Expo/React Native con Expo Router, orientada principalmente a Android.
- La entrada de la app es `app/index.tsx`; el layout raíz está en `app/_layout.tsx`.
- `src/screens/AppRoot.tsx` coordina la pantalla de carga (`BootScreen`) y el panel principal (`RichScreen`).
- La composicion visual de `RichScreen` es estable y no debe redisenarse sin peticion explicita; las funciones nuevas se abren desde los accesos del encabezado en `src/screens/FinanceModulesScreen.tsx`.
- `FinanceProvider` mantiene el modelo financiero versionado para cuentas, transferencias, presupuestos, recurrentes, deudas, ahorros, recordatorios, notas y respaldos locales.
- `src/components/AuroraBackground.tsx` proporciona el fondo oscuro con gradientes animados. No hay partículas ni polvo dorado de fondo.
- El nombre público es `Solid Gold Rich` y el package Android es `com.escobar.solidgold`. No cambiar ninguno sin autorización explícita.
- No recrear archivos de documentación de Play Store que el usuario haya eliminado. No modificar archivos generados dentro de `dist/` o `android/`.

## Producto y comportamiento actual

- Es un gestor de patrimonio y presupuestos con estética oscura, dorada y premium.
- El usuario puede crear varias cuentas de presupuesto, elegir una cuenta activa y registrar ingresos o gastos por categoría.
- El panel muestra saldo, flujo de caja, actividad reciente, actividad global, límites de gasto y totales por período.
- El diamante de `src/components/Gem.tsx` evoluciona según el saldo positivo de la cuenta activa. Tocar el diamante solo activa su animación.
- Los presupuestos, la cuenta activa y las transacciones se guardan localmente con AsyncStorage usando las claves definidas en `src/screens/RichScreen.tsx`.
- Se conserva la migración de los datos antiguos `@solid-gold/transactions` y `@solid-gold/monthly-budget`.
- No reintroducir autenticación, huella, foto, captura o compartir salvo petición explícita del usuario.
- Mantener la interfaz estable: ningún texto o número grande debe desbordarse ni cambiar el tamaño general del layout.

## Fondo visual

- Mantener el fondo limpio: no agregar partículas, polvo dorado ni otros elementos flotantes decorativos.

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
