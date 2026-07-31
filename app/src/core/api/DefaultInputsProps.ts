export type DefaultInputsProps = {
  id: string | number;
  optionalId?: string;
};

export type DefaultInputsPropsForSearch = {
  id?: string | number;
  optionalId?: string | number;
  param: string;
  url?: string;
};

export type DefaultInputsPropsWithData<T> = {
  id?: string | number;
  optionalId?: string | number;
  data: T;
};

export type DefaultInputsPropsWithFilters = {
  id?: string | number;
  optionalId?: string | number;
  search?: string | null;
  page?: number | null;
  rowsPerPage?: number | null;
  filters?: string | null;
};

export type DefaultInputsPropsForPatch<T> = {
  id?: string | number;
  optionalId?: string;
  data: T;
};
