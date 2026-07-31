import { Method } from 'axios';

/**
 * Definición para un recurso de API.
 * @template T El tipo de datos de carga útil enviada con la solicitud.
 * @param {...T[]} params Parámetros de tipo T.
 * @returns {{ path: string; method: Method; payload?: T; customHeader?: Record<string, string> }} Objeto que contiene las propiedades de definición del recurso.
 */
export type EndpointDefinition<T = never> = (...params: T[]) => {
  /**
   * La ruta del recurso.
   */
  path: string;

  /**
   * El método HTTP utilizado para acceder al recurso (GET, POST, PUT, DELETE, etc.).
   */
  method: Method;

  /**
   * Datos de carga útil enviados con la solicitud (opcional).
   */
  payload?: T;

  /**
   * Encabezados personalizados para la solicitud (opcional).
   */
  customHeader?: Record<string, string>;
};
