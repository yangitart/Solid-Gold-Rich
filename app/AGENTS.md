# Solid Gold Rich

## Commit convention

- Use Conventional Commits with the format `type(scope): description`.
- The `scope` must always be `front` or `back`.
- Write messages in English; keep them brief, clear, and descriptive.
- Examples: `feat(front): add budget categories` or `fix(back): handle invalid imports`.

## Alcance y estructura

- Esta carpeta contiene una app Expo/React Native orientada principalmente a Android.
- La entrada nativa de la app es `index.js`, registrada con `registerRootComponent`; no usa Expo Router ni rutas web.
- `src/components/AppRoot.tsx` es la raíz visual de la aplicación e inyecta mediante Inversify las dependencias registradas en `src/ioc/dependencies.ts`; `src/components/AppContent.tsx` coordina la pantalla de carga (`BootScreen`) y el panel principal (`RichScreen`).
- El código se organiza por capas: `src/components/` para el shell React global, `src/ioc/` para ensamblar dependencias, `src/domain/` para el agregado global, `src/features/` para funcionalidades, `src/shared/` para contratos y recursos transversales y `src/legacy/` para scaffolding futuro todavía inactivo. Dentro de cada feature, `domain` no depende de capas externas, `application` depende de `domain`, `infrastructure` implementa ports de `application` y `presentation` consume casos de uso y contratos. Cada port y adaptador pertenece a la feature que lo consume; solo los servicios realmente transversales viven en `src/shared/`. El alias `@/` apunta a `src/`.
- La composición visual de `RichScreen` es estable y no debe rediseñarse sin petición explícita; las funciones nuevas se abren desde los accesos del encabezado en `src/features/finance/presentation/screens/FinanceModulesScreen.tsx`.
- `src/features/app-state/presentation/components/AppStateContext.tsx` expone la API compatible `useFinance` sobre una store Zustand y persiste el agregado global mediante el puerto `AppStateRepository`; no duplicar el estado en otros componentes ni acoplar la presentación directamente a AsyncStorage.
- `src/shared/ui/AuroraBackground.tsx` proporciona el fondo oscuro con gradientes animados. No hay partículas ni polvo dorado de fondo.
- El nombre público es `Solid Gold Rich` y el package Android es `com.escobar.solidgold`. No cambiar ninguno sin autorización explícita.
- No recrear archivos de documentación de Play Store que el usuario haya eliminado. No modificar archivos generados dentro de `dist/` o `android/`.

## Producto y comportamiento actual

- Es un gestor de patrimonio y presupuestos con estética oscura, dorada y premium.
- El usuario puede crear varias cuentas de presupuesto, elegir una cuenta activa y registrar ingresos o gastos por categoría.
- El panel muestra saldo, flujo de caja, actividad reciente, actividad global, límites de gasto y totales por período.
- El modal de estadísticas de `src/features/finance/presentation/screens/RichScreen.tsx` ofrece vista de gráficos y calendario, filtros de hoy/semana/mes/año, flujo de ingresos y gastos, categoría principal y desglose por categorías. La vista de actividad global convierte los importes a la moneda base.
- El diamante de `src/shared/ui/Gem.tsx` evoluciona según el saldo positivo de la cuenta activa. Tocar el diamante solo activa su animación.
- El estado global se guarda localmente mediante `src/features/app-state/infrastructure/storage/appStateRepository.ts` y `appStateStorage.ts`; conservar las claves y migraciones históricas.
- Las categorías de gastos e ingresos se administran desde el módulo `Categories` del menú izquierdo y se usan en el formulario de operaciones.
- Se conserva la migración de los datos antiguos `@solid-gold/transactions` y `@solid-gold/monthly-budget`.
- No activar ni exponer autenticación, huella, foto, captura o compartir salvo petición explícita del usuario. El scaffolding futuro descrito abajo no autoriza UI ni comportamiento en runtime.
- Mantener la interfaz estable: ningún texto o número grande debe desbordarse ni cambiar el tamaño general del layout.

## Fondo visual

- Mantener el fondo limpio: no agregar partículas, polvo dorado ni otros elementos flotantes decorativos.

## Modales y confirmaciones

- No usar diálogos genéricos de React Native (`Alert.alert`) para confirmaciones. Crear o reutilizar siempre un modal propio integrado con el sistema visual de la app, preferentemente `ConfirmDialog` de `src/shared/ui/FormKit.tsx` para acciones destructivas, como el restablecimiento de datos en Ajustes.

## Idiomas

- Usar i18next y detectar únicamente el idioma configurado del teléfono mediante `expo-localization/getLocales`; no consultar GPS ni pedir permisos de ubicación.
- Idiomas actuales: inglés, español, portugués, francés, alemán e italiano. Inglés es el fallback.
- Todo texto visible nuevo debe usar claves de traducción.
- Al agregar o renombrar una clave, actualizar todos los archivos `src/shared/i18n/translation_*.json`.

## Peso y dependencias

- La app debe mantenerse ligera; objetivo del usuario: APK menor de 20 MB.
- No agregar una dependencia si React Native, Expo o el código actual pueden resolverlo razonablemente.
- No agregar `react-dom`, `react-native-web`, Expo Router ni archivos/configuración web salvo petición explícita; la app de producción es Android nativa.
- Evitar dependencias web, imágenes pesadas y fuentes empaquetadas innecesarias.
- Después de cambiar dependencias, ejecutar Expo Doctor y comprobar el bundle Android.

## Validación antes de entregar

Ejecutar desde esta carpeta:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src
npx.cmd expo-doctor
npx.cmd expo export --platform android
```

- Validar también que todos los JSON de traducción se puedan parsear.
- No usar `npm audit fix --force`; puede actualizar Expo con cambios incompatibles.
- No crear commits ni hacer push salvo que el usuario lo solicite explícitamente.

## Store workspace

- The app has a separate Store workspace backed by `AppState.store` inside the version 7 app state; do not mix store products, stock movements, or sales with personal accounts and transactions.
- `src/features/store/presentation/screens/StoreScreen.tsx` is the single Store entry point. Its left menu stays limited to Inventory, Employees, Clients, Services, Sales, and Settings.
- The workspace switch is an icon-only action at the bottom of the right quick menu. Do not re-add a large text toggle to the left drawer.
- Inventory uses a fixed search field for product name, key, and SKU. The floating `+` opens the single responsive product form directly; there is no add-method chooser or scanner flow.
- Built-in store product categories use stable IDs and must always resolve their visible names through i18n. Whenever a category is added or renamed, update all six `translation_*.json` files and run `npm run check:i18n`; never ship a new category with a hardcoded display name.
- Product fields include key, name, type, unit, purchase price, sale price, optional additional sale prices, optional picture URI, fallback icon, category, quantity, reserved quantity, stock minimum, optional expiration, and optional additional information. When a picture exists, show it in the product icon slot; otherwise show the selected icon.
- Keep product stock derived from stock movements. Reserved quantity reduces sellable stock, services do not consume inventory, and cancelled sales restore product stock.
- Keep all Store strings in the six locale files. Never add visible English-only labels or scanner/menu copy without updating every `translation_*.json` file.

## Futuro: soporte, premium e integraciones externas (oculto)

- Existe scaffolding interno en `src/legacy/future/`. Su presencia no cambia el producto actual.
- `src/legacy/future/config.ts` es la fuente de verdad. Todas las banderas deben permanecer en `false` hasta una petición explícita de activación; ningún screen, menú, modal, drawer, deep link, notificación o tarea de fondo puede revelar estas capacidades mientras estén apagadas.
- No importar el scaffolding futuro desde `src/components/`, `src/ioc/`, `src/features/` ni componentes compartidos. Mantenerlo fuera del bundle visible hasta que una función sea aprobada e implementada de extremo a extremo.

### Regalar un café a los desarrolladores

- La futura opción de soporte es voluntaria y no debe bloquear, degradar ni condicionar funciones existentes.
- `DEVELOPER_SUPPORT_CONFIG.destination` debe permanecer en `null` hasta que el usuario proporcione la cuenta o enlace de destino y autorice mostrarlo.
- La aplicación nunca debe capturar, procesar ni almacenar tarjetas o credenciales de pago. Usar en el futuro un checkout o enlace externo de un proveedor aprobado.
- No incluir montos, moneda, proveedor, textos visibles ni enlaces provisionales antes de recibir los datos definitivos.

### Modo premium

- Premium permanece desactivado. Las ideas reservadas son respaldo cifrado en nube, sincronización multidispositivo, importación bancaria automática, pronósticos avanzados, plantillas de reportes y soporte prioritario.
- No convertir silenciosamente funciones actuales en premium. Cualquier cambio de acceso, precio, prueba o restauración de compras requiere una decisión explícita del usuario.
- Los derechos premium deben verificarse con el proveedor/backend; no confiar en un booleano editable de AsyncStorage ni guardarlo como autoridad dentro de `AppState`.

### Google y respaldo en nube

- El inicio de sesión con Google y el respaldo remoto requieren backend, consentimiento, política de privacidad actualizada, configuración por ambiente y manejo seguro de sesión antes de activarse.
- Nunca guardar access tokens, refresh tokens, secretos OAuth, claves de cifrado o cookies de sesión en `AppState`, AsyncStorage, backups exportados, logs, analytics o el repositorio.
- No usar variables `EXPO_PUBLIC_*` para secretos. Los secretos y el intercambio de tokens pertenecen al backend; en el cliente solo pueden existir referencias opacas de sesión y credenciales públicas permitidas por el proveedor.
- Cualquier backup de nube debe cifrarse antes de subirse, tener versión de sobre, control de revisiones, borrado remoto y una estrategia explícita de conflictos/recuperación.

### Vinculación con bancos de Estados Unidos

- Usar en el futuro un agregador bancario aprobado y un backend propio para crear sesiones e intercambiar tokens. Nunca solicitar ni almacenar usuario, contraseña, routing number o número completo de cuenta bancaria.
- La configuración inicial debe ser solo lectura: `readOnly: true` y `allowMoneyMovement: false`. Mover dinero requiere otro alcance, revisión legal y autorización explícita.
- En el dispositivo solo se permiten identificadores externos opacos, nombre de institución, tipo de cuenta, moneda y los últimos dígitos permitidos. Los tokens de acceso bancario deben permanecer en backend.
- La importación futura debe ser idempotente, conservar cursores, detectar duplicados, distinguir pendientes/confirmadas y pedir confirmación antes de mezclar movimientos externos con las finanzas locales.

### Requisitos antes de activar cualquier capacidad futura

- Confirmación explícita del usuario sobre alcance y UI.
- Proveedor definitivo, backend operativo, ambientes sandbox/producción y secretos fuera del cliente.
- Modelo de datos versionado, migración reversible y compatibilidad con backups antiguos.
- Consentimiento, privacidad, eliminación de cuenta/datos, manejo de errores y recuperación offline.
- Traducciones completas en los seis idiomas, pruebas de dominio/integración y validación Android.
- Una prueba debe seguir garantizando que todas las banderas estén apagadas mientras estas funciones permanezcan ocultas.
