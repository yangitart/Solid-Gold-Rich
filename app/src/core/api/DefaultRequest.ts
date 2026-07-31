/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Represents the default request object.
 */

export interface DefaultRequest {
  id?: string | number;
  id__in?: string[];
  extraId?: string;
}

/**
 * Represents a request object with filters.
 * @property {string | null} search - The search value.
 * @property {number | null} page - The page number.
 * @property {number | null} rowsPerPage - The number of rows per page.
 * @property {string | null} filters - The filters value.
 * @property {string[]} id__in - The list of IDs to filter by.
 */

export interface RequestWithFilters<FILTER> extends DefaultRequest {
  search?: string | null | undefined;
  page?: number | null | undefined;
  rowsPerPage?: number | null | undefined;
  filters?: FILTER;
}

export interface RequestForPostOrUpdate<T> extends DefaultRequest {
  data: T;
}

/**
 * Represents a request object for search .
 * @property {string | null} url - The resource url.
 * @property {number | null} params - The params for this search.
 */

export interface RequestForSearch extends DefaultRequest {
  url: string;
  params: any;
}
export interface RequestUri {
  url: string;
  id?: string;
}
