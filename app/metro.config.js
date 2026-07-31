// metro.config.js
const { getDefaultConfig } = require("expo/metro-config")

// Obtén la configuración predeterminada de Expo
const config = getDefaultConfig(__dirname)

// --- AÑADE ESTO: Configuración para WASM ---
// Añadir el soporte para archivos .wasm como assets
config.resolver.assetExts.push("wasm")

// Esto es a menudo necesario para que Metro maneje correctamente los .wasm como assets
// cuando se usan importaciones directas como las de expo-sqlite/web.
// getDefaultConfig ya incluye 'expo-asset/tools/hashAssetFiles' por defecto,
// pero si alguna configuración lo anula, puede ser útil volver a incluirlo.
// Sin embargo, para la mayoría de los casos, solo añadir a assetExts.push('wasm') es suficiente.
// Si el error persiste, podrías intentar añadir:
// config.transformer.assetPlugins = [
//   ...(config.transformer.assetPlugins || []),
//   'expo-asset/tools/hashAssetFiles',
// ];
// Pero intenta primero solo con assetExts.push('wasm').
// --- FIN DE LA ADICIÓN ---

module.exports = config
// Force cache invalidation
