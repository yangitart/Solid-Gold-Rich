/**
 * Crea una consulta GraphQL.
 * @param {object} [queryParams={}] - Un objeto que contiene los parámetros para la consulta.
 * @param {string|number|boolean|null|undefined} [queryParams.key] - Parámetros de consulta que se utilizarán en la consulta.
 * @param {Array<string>} [include=[]] - Una lista de campos a incluir en la consulta GraphQL.
 * @param {string} [filters] - Filtros adicionales que se pueden agregar a la consulta.
 * @returns {string} La consulta GraphQL generada.
 */

export function createGraphQLQuery(
  queryParams: {
    [key: string]: string | string[] | number | boolean | null | undefined;
  } = {},
  include?: string,
  filters?: string | undefined,
): string {
  const getParams = (param: any, value: any) => {
    switch (param) {
      case 'search':
        return value ? `${param}:'${value}'` : '';
      case 'urls':
        return `urls:'${(value as string[]).map((e) => `${e}`).join(',')}'`;
      default:
        return `${param}:${value}`;
    }
  };

  const variables = Object.keys(queryParams)
    .map((param) =>
      queryParams[param] !== undefined
        ? getParams(param, queryParams[param])
        : undefined,
    )
    .join(' ');

  // Filtrar los campos que se deben incluir en la consulta
  // const fields = include.length > 0
  // ? include.join( '\n' )
  // : '*'; // Si no hay campos, usar '*' o dejar vacío según la lógica deseada

  // Construir la consulta
  const query = `
      (${variables} ${filters ? filters : ''} ) {
        ${include ?? '*'}
      }
  `;

  return query.trim(); // Retornar la consulta eliminando espacios en blanco
}

/**
 * @description Función que permite formatear los filtros en un String
 * @param filters {string}
 * @returns {string}
 */
export function formatFilters(filters: { [key: string]: any }): string {
  let __filters = '';

  for (const key in filters) {
    if (
      filters[key] !== null &&
      filters[key] !== undefined &&
      filters[key] !== ''
    ) {
      const value = filters[key];

      // Si el valor es un string, lo envolvemos entre comillas
      const formattedValue = typeof value === 'string' ? `"${value}"` : value;

      // Agregar el filtro solo si el valor no es nulo o indefinido
      if (formattedValue !== null && formattedValue !== undefined) {
        __filters += `${key} : ${formattedValue} `;
      }
    }
  }

  // Eliminar el espacio extra al final
  return __filters.trim();
}
