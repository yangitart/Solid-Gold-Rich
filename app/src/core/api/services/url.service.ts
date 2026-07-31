import { createGraphQLQuery } from "@/core/api/services/graphQl.service";

export interface Query {
  page?: number | undefined;
  limit?: number | undefined;
  ordering?: string | undefined;
  search?: string | undefined;
  filters?: string | undefined;
  fields?: any | Query;
}

interface CreateEndpointProps {
  version: number;
  basePath: string;
  queryParams?: {
    [key: string]: string | string[] | number | boolean | null | undefined;
  };
  filters?: string | undefined;
  queryFields?: string;
}

/**
 * Crea una URL y, opcionalmente, una consulta GraphQL.
 * @param {number} version - La versión de la API.
 * @param {string} basePath - La ruta base del endpoint.
 * @param {object} [urlParams={}] - Un objeto que contiene los parámetros para la URL.
 * @param {object} [queryParams={}] - Un objeto que contiene los parámetros para la consulta GraphQL.
 * @param {object} [queryFields={}] - Un objeto que especifica los campos a incluir en la consulta GraphQL.
 * @param {string} [operationName] - El nombre de la operación GraphQL (opcional).
 * @returns {{path: string, params: object, query?: string}} Un objeto que contiene la ruta, los parámetros y, opcionalmente, la consulta GraphQL generadas.
 */

export function generateUrlAndQuery({
  basePath,
  version,
  filters,
  queryFields,
  queryParams,
}: CreateEndpointProps): { path: string; query?: string } {
  const url = generateUrl(basePath, version);
  const query = createGraphQLQuery(queryParams, queryFields, filters);

  // console.debug('CREATE_URL_AND_QUERYS', {
  // URL: url,
  // QUERY: query,
  // });

  return {
    path: url,
    query,
  };
}

/**
 * @param path
 * @param version
 * @description Genera la url según un path y un version.
 * @returns {url: string}
 */

export function generateUrl(path: string, version: number): string {
  let url;
  let base: string = path;
  const BASE_PATH = `${process.env.BASE_URL}`;

  if (BASE_PATH.startsWith("https://") && path.startsWith("http://")){
    base = path.replace("http", "https");
  }

  if (base.startsWith(BASE_PATH)) {
    // Expresión regular para eliminar la base URL y cualquier versión (v1, v2, v3, etc.)
    const baseURLPattern = new RegExp(`${BASE_PATH}/v\\d+/`);

    // Usamos replace con la expresión regular para eliminar la base URL y la versión
    url = base.replace(baseURLPattern, '');
  } else {
    url = BASE_PATH + `/api` + `/v${version}/${base}`;
  }

  return url;
}
