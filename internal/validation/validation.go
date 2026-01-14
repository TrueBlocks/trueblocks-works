package validation

import (
	"fmt"
	"net/url"
	"strings"
)

// FieldError represents a validation error for a specific field
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// FieldWarning represents a validation warning for a specific field
type FieldWarning struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationResult contains validation errors and warnings
type ValidationResult struct {
	Errors   []FieldError   `json:"errors,omitempty"`
	Warnings []FieldWarning `json:"warnings,omitempty"`
}

// IsValid returns true if there are no validation errors
func (v *ValidationResult) IsValid() bool {
	return len(v.Errors) == 0
}

// AddError adds a validation error
func (v *ValidationResult) AddError(field, message string) {
	v.Errors = append(v.Errors, FieldError{
		Field:   field,
		Message: message,
	})
}

// AddWarning adds a validation warning
func (v *ValidationResult) AddWarning(field, message string) {
	v.Warnings = append(v.Warnings, FieldWarning{
		Field:   field,
		Message: message,
	})
}

// Required checks if a string field is non-empty after trimming
func Required(value, fieldName string) *FieldError {
	if strings.TrimSpace(value) == "" {
		return &FieldError{
			Field:   fieldName,
			Message: fmt.Sprintf("%s is required", fieldName),
		}
	}
	return nil
}

// MaxLength checks if a string exceeds maximum length
func MaxLength(value string, max int, fieldName string) *FieldError {
	if len(value) > max {
		return &FieldError{
			Field:   fieldName,
			Message: fmt.Sprintf("%s must not exceed %d characters (got %d)", fieldName, max, len(value)),
		}
	}
	return nil
}

// InRange checks if an integer is within min/max bounds (inclusive)
func InRange(value, min, max int, fieldName string) *FieldError {
	if value < min || value > max {
		return &FieldError{
			Field:   fieldName,
			Message: fmt.Sprintf("%s must be between %d and %d (got %d)", fieldName, min, max, value),
		}
	}
	return nil
}

// NonNegative checks if an integer is >= 0
func NonNegative(value int, fieldName string) *FieldError {
	if value < 0 {
		return &FieldError{
			Field:   fieldName,
			Message: fmt.Sprintf("%s must be non-negative (got %d)", fieldName, value),
		}
	}
	return nil
}

// NonNegativeFloat checks if a float64 is >= 0
func NonNegativeFloat(value float64, fieldName string) *FieldError {
	if value < 0 {
		return &FieldError{
			Field:   fieldName,
			Message: fmt.Sprintf("%s must be non-negative (got %.2f)", fieldName, value),
		}
	}
	return nil
}

// ValidURL checks if a string is empty or a valid URL
func ValidURL(value, fieldName string) *FieldError {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil // Empty URLs are allowed
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return &FieldError{
			Field:   fieldName,
			Message: fmt.Sprintf("%s must be a valid HTTP/HTTPS URL", fieldName),
		}
	}
	return nil
}

// AddIfError adds a FieldError to ValidationResult if not nil
func (v *ValidationResult) AddIfError(err *FieldError) {
	if err != nil {
		v.Errors = append(v.Errors, *err)
	}
}
