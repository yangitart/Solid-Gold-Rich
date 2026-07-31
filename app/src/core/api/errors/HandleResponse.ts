import { left, right } from 'fp-ts/Either';
import { handleError } from '../hooks/handleError';

/**
 * Convierte la respuesta de la petición en la right de {Either}
 * @param data Datos a devolver
 */

export const SuccessData = <T>(data: T) => right(data);

/**
 * Convierte la error de la petición en la left de {Either}
 * @param error Error capturado en el catch
 */

export const ErrorData = (error: any) => {
  const errorMessage = handleError(error);
  return left(errorMessage);
};
