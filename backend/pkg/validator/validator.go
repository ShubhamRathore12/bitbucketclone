package validator

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

// V is the shared, thread-safe validator instance.
var V *validator.Validate

func init() {
	V = validator.New(validator.WithRequiredStructEnabled())

	// Register custom validations.
	_ = V.RegisterValidation("slug", validateSlug)
	_ = V.RegisterValidation("gitref", validateGitRef)
}

// validateSlug ensures the field contains only lowercase alphanumeric
// characters, hyphens, and underscores (1-128 chars).
func validateSlug(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	if len(s) == 0 || len(s) > 128 {
		return false
	}
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

// validateGitRef ensures the field looks like a plausible git branch/tag name.
func validateGitRef(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	if len(s) == 0 || len(s) > 256 {
		return false
	}
	if strings.Contains(s, "..") || strings.Contains(s, " ") || strings.HasPrefix(s, "-") {
		return false
	}
	return true
}

// ValidationError is a structured validation error returned in API responses.
type ValidationError struct {
	Field   string `json:"field"`
	Tag     string `json:"tag"`
	Message string `json:"message"`
}

// ParseBody reads the request body into dst and validates it. On failure it
// sends a 422 response with structured error details and returns a non-nil error.
func ParseBody(c *fiber.Ctx, dst interface{}) error {
	if err := c.BodyParser(dst); err != nil {
		_ = c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
		return err
	}

	if err := V.Struct(dst); err != nil {
		errs := formatValidationErrors(err)
		_ = c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":   "validation failed",
			"details": errs,
		})
		return err
	}

	return nil
}

// ParseQuery reads query parameters into dst and validates it.
func ParseQuery(c *fiber.Ctx, dst interface{}) error {
	if err := c.QueryParser(dst); err != nil {
		_ = c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid query parameters",
		})
		return err
	}

	if err := V.Struct(dst); err != nil {
		errs := formatValidationErrors(err)
		_ = c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":   "validation failed",
			"details": errs,
		})
		return err
	}

	return nil
}

// Validate runs struct validation on an arbitrary value and returns structured
// errors suitable for JSON serialization.
func Validate(v interface{}) []ValidationError {
	if err := V.Struct(v); err != nil {
		return formatValidationErrors(err)
	}
	return nil
}

// formatValidationErrors converts validator errors into a user-friendly slice.
func formatValidationErrors(err error) []ValidationError {
	var out []ValidationError

	validationErrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return []ValidationError{{
			Field:   "unknown",
			Tag:     "parse",
			Message: err.Error(),
		}}
	}

	for _, fe := range validationErrs {
		out = append(out, ValidationError{
			Field:   toSnakeCase(fe.Field()),
			Tag:     fe.Tag(),
			Message: buildMessage(fe),
		})
	}

	return out
}

// buildMessage creates a human-readable error message from a field error.
func buildMessage(fe validator.FieldError) string {
	field := toSnakeCase(fe.Field())

	switch fe.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "email":
		return fmt.Sprintf("%s must be a valid email address", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters", field, fe.Param())
	case "max":
		return fmt.Sprintf("%s must be at most %s characters", field, fe.Param())
	case "slug":
		return fmt.Sprintf("%s must be a valid slug (lowercase alphanumeric, hyphens, underscores)", field)
	case "gitref":
		return fmt.Sprintf("%s must be a valid git reference", field)
	case "url":
		return fmt.Sprintf("%s must be a valid URL", field)
	case "oneof":
		return fmt.Sprintf("%s must be one of: %s", field, fe.Param())
	default:
		return fmt.Sprintf("%s failed %s validation", field, fe.Tag())
	}
}

// toSnakeCase does a simple conversion of PascalCase field names to snake_case.
func toSnakeCase(s string) string {
	var b strings.Builder
	for i, r := range s {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				b.WriteByte('_')
			}
			b.WriteRune(r + 32) // lowercase
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
