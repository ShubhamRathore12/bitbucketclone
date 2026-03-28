package pagination

import (
	"math"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

const (
	DefaultPage    = 1
	DefaultPerPage = 25
	MaxPerPage     = 100
)

// Params holds the parsed pagination parameters from a request.
type Params struct {
	Page    int `json:"page" query:"page"`
	PerPage int `json:"per_page" query:"per_page"`
}

// Offset returns the SQL OFFSET value for the current page.
func (p Params) Offset() int {
	return (p.Page - 1) * p.PerPage
}

// Limit returns the SQL LIMIT value (same as PerPage).
func (p Params) Limit() int {
	return p.PerPage
}

// Meta contains pagination metadata included in paginated API responses.
type Meta struct {
	Page       int  `json:"page"`
	PerPage    int  `json:"per_page"`
	Total      int  `json:"total"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

// Response wraps a paginated collection with metadata.
type Response struct {
	Data interface{} `json:"data"`
	Meta Meta        `json:"meta"`
}

// Parse reads page and per_page query parameters from a Fiber context and
// clamps them to valid ranges.
func Parse(c *fiber.Ctx) Params {
	page := queryInt(c, "page", DefaultPage)
	perPage := queryInt(c, "per_page", DefaultPerPage)

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = DefaultPerPage
	}
	if perPage > MaxPerPage {
		perPage = MaxPerPage
	}

	return Params{
		Page:    page,
		PerPage: perPage,
	}
}

// NewMeta builds a Meta struct from pagination parameters and the total
// record count.
func NewMeta(p Params, total int) Meta {
	totalPages := 0
	if p.PerPage > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(p.PerPage)))
	}

	return Meta{
		Page:       p.Page,
		PerPage:    p.PerPage,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    p.Page < totalPages,
		HasPrev:    p.Page > 1,
	}
}

// NewResponse is a convenience constructor that wraps data and metadata into a
// single Response struct ready for JSON serialization.
func NewResponse(data interface{}, p Params, total int) Response {
	return Response{
		Data: data,
		Meta: NewMeta(p, total),
	}
}

// queryInt reads a query parameter as an integer, returning fallback on failure.
func queryInt(c *fiber.Ctx, key string, fallback int) int {
	raw := c.Query(key)
	if raw == "" {
		return fallback
	}
	val, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return val
}
