export interface BaseState<T> {
  isLoading : boolean;
  data? : T | null;
  error : string | null;
  listData? : T[] | null;
  otherData? : T | null;
}

export interface CustomPagination<T> {
  meta : PaginationMeta;
  data : T[];
}

export interface PaginationMeta {
  itemCount : number;
  pageCount : number;
  currentPage : number;
  nextPage : any;
  previousPage : any;
  previous : any;
  next : any;
}
