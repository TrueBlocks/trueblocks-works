package bookbuild

import (
	"bytes"
	"fmt"
	"os"
)

func CreateBlankPage(outputPath string, width, height float64) error {
	var buf bytes.Buffer

	buf.WriteString("%PDF-1.7\n%\x80\x81\x82\x83\n")

	obj1Offset := buf.Len()
	buf.WriteString("1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n")

	obj2Offset := buf.Len()
	buf.WriteString("2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n")

	obj3Offset := buf.Len()
	fmt.Fprintf(&buf, "3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 %.0f %.0f]/Resources<<>>>>\nendobj\n", width, height)

	xrefOffset := buf.Len()
	buf.WriteString("xref\n0 4\n")
	fmt.Fprintf(&buf, "0000000000 65535 f \n")
	fmt.Fprintf(&buf, "%010d 00000 n \n", obj1Offset)
	fmt.Fprintf(&buf, "%010d 00000 n \n", obj2Offset)
	fmt.Fprintf(&buf, "%010d 00000 n \n", obj3Offset)

	fmt.Fprintf(&buf, "trailer\n<</Size 4/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n", xrefOffset)

	return os.WriteFile(outputPath, buf.Bytes(), 0644)
}

type PageMapping struct {
	PhysicalPage int
	ContentItem  *ContentItem
	PageInItem   int
}

func (m *PageMapping) IsFirstPageOfWork() bool {
	if m.ContentItem == nil {
		return false
	}
	return m.ContentItem.Type == ContentTypeWork && m.PageInItem == 1
}

func (m *PageMapping) ShouldShowHeader() bool {
	if m.ContentItem == nil {
		return false
	}
	switch m.ContentItem.Type {
	case ContentTypeBlank, ContentTypeFrontMatter, ContentTypeTOC,
		ContentTypePartDivider, ContentTypeBackMatter:
		return false
	case ContentTypeWork:
		return m.PageInItem > 1
	}
	return false
}

func (m *PageMapping) ShouldShowPageNumber() bool {
	if m.ContentItem == nil {
		return false
	}
	if m.ContentItem.Type == ContentTypeBlank {
		return false
	}
	if m.ContentItem.Type == ContentTypeFrontMatter {
		return false
	}
	if m.ContentItem.Type == ContentTypePartDivider {
		return false
	}
	if m.ContentItem.Type == ContentTypeWork && m.PageInItem == 1 {
		return false
	}
	return true
}

func (m *PageMapping) GetNumberStyle() NumberStyle {
	if m.ContentItem == nil {
		return NumberStyleNone
	}
	switch m.ContentItem.Type {
	case ContentTypeFrontMatter, ContentTypeTOC:
		return NumberStyleRoman
	case ContentTypePartDivider, ContentTypeWork, ContentTypeBackMatter:
		return NumberStyleArabic
	}
	return NumberStyleNone
}

func (m *PageMapping) IsVerso() bool {
	return m.PhysicalPage%2 == 0
}

func (m *PageMapping) IsRecto() bool {
	return m.PhysicalPage%2 == 1
}
