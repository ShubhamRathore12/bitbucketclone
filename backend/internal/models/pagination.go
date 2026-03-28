package models

// Pagination holds offset-based pagination parameters.
type Pagination struct {
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}

// Offset returns the SQL OFFSET value for the current page.
func (p Pagination) Offset() int {
	if p.Page < 1 {
		return 0
	}
	return (p.Page - 1) * p.Limit()
}

// Limit returns the clamped per-page size.
func (p Pagination) Limit() int {
	if p.PerPage <= 0 {
		return 25
	}
	if p.PerPage > 100 {
		return 100
	}
	return p.PerPage
}

// PaginatedResult wraps a slice of items with total count for the client.
type PaginatedResult[T any] struct {
	Items   []T `json:"items"`
	Total   int `json:"total"`
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}
