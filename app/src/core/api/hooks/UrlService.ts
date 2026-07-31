/**
 * Obtiene la ruta relativa de una url generada por el backend
 * @param {string | null} url La Url dada por el backend
 * @returns {string | null} ruta relativa
 */

import { URL } from 'url';

/**
 * Construye la ruta completa de un recurso de la API a partir de su ruta relativa.
 * @param {string} resource La ruta relativa del recurso de la API.
 * @returns {string} La ruta completa del recurso de la API, incluyendo la URL base del entorno.
 */

export const ApiPath = (resource: string): string => {
  const fullUrl = `${process.env.BASE_URL}/${resource}`;
  return fullUrl;
};

export function getRelativeUrl(urlCompleta: string): string {
  // Eliminar la parte del protocolo y dominio de la url base para obtener solo la ruta base
  // const rutaBase = new URL(urlBase).pathname;

  const baseUrl = `${process.env.BASE_URL}`;

  // Eliminar la parte del protocolo y dominio de la url completa para obtener la ruta completa
  const rutaCompleta = urlCompleta;

  // Eliminar la ruta base de la ruta completa para obtener la url relativa
  let urlRelativa = rutaCompleta.replace(baseUrl, '');

  // Expresión regular para identificar y eliminar versiones en la ruta (por ejemplo, /v1/, /v2/, etc.)
  const versionRegex = /\/v\d+\//;

  // Reemplazar la versión si existe
  urlRelativa = urlRelativa.replace(versionRegex, '/');

  // Retornar la url relativa
  return urlRelativa;
}

export function hasQueryParams(url: URL): boolean {
  // Crear un objeto URL a partir de la cadena proporcionada
  const urlObj = url;

  // Verificar si la propiedad searchParams tiene alguna entrada
  return urlObj.searchParams.toString().length > 0;
}
