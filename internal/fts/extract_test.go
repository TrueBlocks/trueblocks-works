package fts

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func createTestDocx(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create docx file: %v", err)
	}
	defer f.Close()

	w := zip.NewWriter(f)

	docXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>` + content + `</w:body>
</w:document>`

	docFile, err := w.Create("word/document.xml")
	if err != nil {
		t.Fatalf("create document.xml: %v", err)
	}
	if _, err := docFile.Write([]byte(docXML)); err != nil {
		t.Fatalf("write document.xml: %v", err)
	}

	if err := w.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}

	return path
}

func TestExtractDocxSimple(t *testing.T) {
	dir := t.TempDir()
	path := createTestDocx(t, dir, "simple.docx", `
		<w:p><w:r><w:t>Hello World</w:t></w:r></w:p>
	`)

	text, err := ExtractDocx(path)
	if err != nil {
		t.Fatalf("ExtractDocx failed: %v", err)
	}

	if text != "Hello World" {
		t.Errorf("expected 'Hello World', got '%s'", text)
	}
}

func TestExtractDocxMultipleParagraphs(t *testing.T) {
	dir := t.TempDir()
	path := createTestDocx(t, dir, "multi.docx", `
		<w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>
		<w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
		<w:p><w:r><w:t>Third paragraph</w:t></w:r></w:p>
	`)

	text, err := ExtractDocx(path)
	if err != nil {
		t.Fatalf("ExtractDocx failed: %v", err)
	}

	expected := "First paragraph\n\nSecond paragraph\n\nThird paragraph"
	if text != expected {
		t.Errorf("expected '%s', got '%s'", expected, text)
	}
}

func TestExtractDocxWithBreaks(t *testing.T) {
	dir := t.TempDir()
	path := createTestDocx(t, dir, "breaks.docx", `
		<w:p>
			<w:r><w:t>Line one</w:t></w:r>
			<w:r><w:br/></w:r>
			<w:r><w:t>Line two</w:t></w:r>
		</w:p>
	`)

	text, err := ExtractDocx(path)
	if err != nil {
		t.Fatalf("ExtractDocx failed: %v", err)
	}

	if text != "Line one\nLine two" {
		t.Errorf("expected 'Line one\\nLine two', got '%s'", text)
	}
}

func TestExtractDocxEmpty(t *testing.T) {
	dir := t.TempDir()
	path := createTestDocx(t, dir, "empty.docx", `
		<w:p></w:p>
	`)

	text, err := ExtractDocx(path)
	if err != nil {
		t.Fatalf("ExtractDocx failed: %v", err)
	}

	if text != "" {
		t.Errorf("expected empty string, got '%s'", text)
	}
}

func TestExtractDocxNotFound(t *testing.T) {
	_, err := ExtractDocx("/nonexistent/file.docx")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}

func TestExtractDocxInvalidZip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "invalid.docx")
	if err := os.WriteFile(path, []byte("not a zip"), 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	_, err := ExtractDocx(path)
	if err == nil {
		t.Error("expected error for invalid zip")
	}
}

func TestExtractMarkdown(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.md")

	content := "# Heading\n\nSome **bold** text.\n\n- Item 1\n- Item 2"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	text, err := ExtractMarkdown(path)
	if err != nil {
		t.Fatalf("ExtractMarkdown failed: %v", err)
	}

	if text != content {
		t.Errorf("expected '%s', got '%s'", content, text)
	}
}

func TestExtractPlainText(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")

	content := "Just some plain text.\nWith multiple lines."
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	text, err := ExtractPlainText(path)
	if err != nil {
		t.Fatalf("ExtractPlainText failed: %v", err)
	}

	if text != content {
		t.Errorf("expected '%s', got '%s'", content, text)
	}
}

func TestExtractByType(t *testing.T) {
	dir := t.TempDir()

	mdPath := filepath.Join(dir, "test.md")
	if err := os.WriteFile(mdPath, []byte("# Test"), 0644); err != nil {
		t.Fatalf("write md: %v", err)
	}

	text, err := ExtractByType(mdPath, "md")
	if err != nil {
		t.Fatalf("ExtractByType md failed: %v", err)
	}
	if text != "# Test" {
		t.Errorf("expected '# Test', got '%s'", text)
	}

	_, err = ExtractByType(mdPath, "pdf")
	if err == nil {
		t.Error("expected error for unsupported type")
	}
}

func TestCountWords(t *testing.T) {
	tests := []struct {
		text     string
		expected int
	}{
		{"", 0},
		{"hello", 1},
		{"hello world", 2},
		{"Hello, world!", 2},
		{"The morning light falls on the water", 7},
		{"one\ntwo\nthree", 3},
		{"   spaces   everywhere   ", 2},
		{"numbers123 and456 words", 3},
		{"hyphenated-word", 2},
	}

	for _, tt := range tests {
		got := CountWords(tt.text)
		if got != tt.expected {
			t.Errorf("CountWords(%q) = %d, want %d", tt.text, got, tt.expected)
		}
	}
}
