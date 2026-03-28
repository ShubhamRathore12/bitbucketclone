export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  errors?: FieldError[];
  timestamp: string;
  path: string;
}

export interface FieldError {
  field: string;
  message: string;
  code: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export type SortDirection = "asc" | "desc";

export interface SortOptions {
  field: string;
  direction: SortDirection;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sort?: string;
  direction?: SortDirection;
}

export interface SearchParams extends PaginationParams {
  query: string;
}

export type Status = "active" | "inactive" | "archived";

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface UserReference {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}
