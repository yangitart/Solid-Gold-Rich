# Solid Gold Rich

## Proyecto

- App Expo/React Native para Android. Entrada: `index.js`; no usa Expo Router ni web.
- Nombre público: `Solid Gold Rich`. Package Android: `com.escobar.solidgold`. No cambiarlos sin autorización.
- Alias `@/` = `src/`. Capas por feature: `domain` → `application` → `infrastructure`; `presentation` consume casos de uso y contratos.
- `AppRoot.tsx` ensambla dependencias con Inversify. `AppStateContext.tsx` expone `useFinance`, mantiene Zustand y persiste mediante `AppStateRepository`. No duplicar el estado ni usar AsyncStorage desde presentación.
- No modificar archivos generados en `dist/` o `android/` ni recrear documentación eliminada.

## Producto

- Conservar la estética oscura, dorada y limpia; sin partículas. Evitar desbordes de textos e importes.
- No rediseñar `RichScreen` sin petición explícita. Los módulos financieros se abren desde `FinanceModulesScreen.tsx`.
- Usar componentes propios para confirmaciones, preferentemente `ConfirmDialog`; no usar `Alert.alert` para acciones destructivas.
- Mantener claves, versiones y migraciones del estado, incluidos `@solid-gold/transactions` y `@solid-gold/monthly-budget`.
- Importaciones y operaciones monetarias deben ser idempotentes, validar moneda/tasa, preservar importes históricos y evitar referencias huérfanas.

## Tienda

- La tienda vive en `AppState.store` y entra por `StoreScreen.tsx`. No mezclar productos, ventas o stock con finanzas personales salvo mediante movimientos enlazados explícitos.
- El stock se deriva de movimientos; las reservas reducen lo vendible, los servicios no consumen stock y anular ventas restaura existencias.
- Categorías e identificadores persistidos son estables. Mostrar la imagen del producto o su icono de respaldo.

## Idiomas y dependencias

- Todo texto visible usa i18next. Idiomas: `en`, `es`, `pt`, `fr`, `de`, `it`; inglés es fallback. Actualizar los seis JSON al cambiar claves.
- Detectar solo el idioma del teléfono mediante `expo-localization/getLocales`; no usar ubicación.
- Mantener la app ligera (objetivo APK <20 MB). No agregar dependencias si el código existente basta.
- No agregar web, Expo Router, `react-dom` ni `react-native-web`. No usar `npm audit fix --force`.

## Funciones futuras

- `src/legacy/future/config.ts` controla funciones futuras. Mantener sus banderas en `false` y su código fuera del runtime sin petición explícita.
- No activar autenticación, biometría, captura, compartir, premium, pagos, nube o bancos sin autorización e implementación completa.
- Nunca guardar secretos, tokens, credenciales o datos bancarios sensibles en cliente, estado, backups, logs o variables `EXPO_PUBLIC_*`.

## Entrega

- Ejecutar comprobaciones proporcionales: TypeScript, ESLint, traducciones, pruebas de dominio y bundle Android cuando correspondan.
- No crear commits ni hacer push salvo petición explícita.
- Commits en inglés usando Conventional Commits y sin scope: `type: description` (por ejemplo, `fix: prepare production release`).
