# Checklist de cierre para Google Play

La aplicación ya está preparada sobre Expo SDK 54/API 36, pero este repositorio no genera ni publica el AAB automáticamente.

## Antes de compilar

- [ ] Probar una instalación limpia: onboarding, creación de la primera cuenta y panel vacío.
- [ ] Probar la migración con una copia real de datos v2 y confirmar que no aparezcan pérdidas ni duplicados.
- [ ] Completar el recorrido CRUD de cuentas, operaciones, transferencias, categorías, presupuestos, deudas, ahorros, recurrentes, fechas y notas.
- [ ] Confirmar en dispositivos 320×568, 360×800 y 412×915, además de una tablet, con teclado abierto y texto al 130 %.
- [ ] Probar PIN, importación/exportación, seis idiomas, monedas, archivado/restauración y reanudación desde segundo plano.
- [ ] Ejecutar `npx tsc --noEmit`, ESLint, `npx expo-doctor` y `npx expo export --platform android`.

## Ficha y privacidad

- [ ] Publicar una URL HTTPS estable para la política de privacidad y añadirla a Play Console.
- [ ] Declarar en Data Safety que no se recopilan ni comparten datos, verificando que coincida con el comportamiento final.
- [ ] Explicar que los datos son locales y que exportar una copia es una acción iniciada por el usuario.
- [ ] No describir el PIN como cifrado: es solamente un bloqueo local.
- [ ] Completar descripción, categoría, clasificación de contenido, correo de soporte, icono y capturas reales.

## Compilación y revisión final

- [ ] Configurar o confirmar las credenciales de firma administradas por EAS.
- [ ] Generar el AAB con el perfil de producción y conservar `appVersionSource: remote` y `autoIncrement`.
- [ ] Abrir el manifiesto combinado del AAB/APK y confirmar que no estén `INTERNET`, almacenamiento, vibración, alertas del sistema ni otros permisos inesperados.
- [ ] Confirmar `targetSdkVersion 36`, `allowBackup=false`, paquete `com.escobar.solidgold` y versión/código correctos.
- [ ] Instalar el artefacto firmado en un teléfono físico y repetir las rutas críticas, especialmente migración y persistencia.
- [ ] Subir primero a una pista de prueba interna; revisar Pre-launch report, accesibilidad, estabilidad y Data Safety antes de producción.
