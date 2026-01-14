package models

import (
	"slices"
	"strings"
)

func HasAttribute(attributes, attr string) bool {
	if attributes == "" {
		return false
	}
	attrs := strings.Split(attributes, ",")
	return slices.Contains(attrs, attr)
}

func AddAttribute(attributes, attr string) string {
	if HasAttribute(attributes, attr) {
		return attributes
	}
	if attributes == "" {
		return attr
	}
	return attributes + "," + attr
}

func RemoveAttribute(attributes, attr string) string {
	if attributes == "" {
		return ""
	}
	attrs := strings.Split(attributes, ",")
	result := make([]string, 0, len(attrs))
	for _, a := range attrs {
		if a != attr {
			result = append(result, a)
		}
	}
	return strings.Join(result, ",")
}

func GetAttributes(attributes string) []string {
	if attributes == "" {
		return []string{}
	}
	return strings.Split(attributes, ",")
}

func IsDeleted(attributes string) bool {
	return HasAttribute(attributes, "deleted")
}

func MarkDeleted(attributes string) string {
	return AddAttribute(attributes, "deleted")
}

func Undelete(attributes string) string {
	return RemoveAttribute(attributes, "deleted")
}
