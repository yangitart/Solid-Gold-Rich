// Importar el archivo JSON
import translations from './translation_es.json';

export default function getTranslationKey(key: any) {
  // Función auxiliar para buscar la traducción recursivamente
  function findTranslation(obj: any, keyToFind: string) {
    // Iterar sobre las propiedades del objeto
    for (const prop in obj) {
      // Si el valor es un objeto, buscar recursivamente
      if (typeof obj[prop] === 'object') {
        const translation: any = findTranslation(obj[prop], keyToFind);
        if (translation) {
          return translation;
        }
      }
      // Si el valor es una cadena y coincide con la clave, devolver el valor
      else if (typeof obj[prop] === 'string' && prop === keyToFind) {
        return obj[prop];
      }
    }
    // Si no se encuentra la traducción, devolver null
    return null;
  }

  // Llamar a la función auxiliar con el objeto JSON importado y la clave proporcionada
  return findTranslation(translations, key);
}
