package bookbuild

type PageType int

const (
	PageTypeBlank PageType = iota
	PageTypeFrontMatter
	PageTypeTOC
	PageTypePartDivider
	PageTypeEssayFirst
	PageTypeEssayBody
	PageTypeBackMatter
)

type PageInfo struct {
	PageNumber     int
	PhysicalPage   int
	PageType       PageType
	IsVerso        bool
	IsRecto        bool
	EssayTitle     string
	PartTitle      string
	SectionType    string
	ShowHeader     bool
	ShowPageNumber bool
	NumberStyle    NumberStyle
}

type NumberStyle int

const (
	NumberStyleNone NumberStyle = iota
	NumberStyleRoman
	NumberStyleArabic
)

type DocumentPlan struct {
	Pages           []PageInfo
	FrontMatterEnd  int
	BodyStart       int
	BodyEnd         int
	BackMatterStart int
	TotalPages      int
	TOCPageCount    int
}

func (p *PageInfo) ShouldShowHeader() bool {
	switch p.PageType {
	case PageTypeBlank, PageTypeFrontMatter, PageTypeTOC,
		PageTypePartDivider, PageTypeEssayFirst, PageTypeBackMatter:
		return false
	case PageTypeEssayBody:
		return true
	}
	return false
}

func (p *PageInfo) ShouldShowPageNumber() bool {
	return p.PageType != PageTypeBlank
}

func (p *PageInfo) GetNumberStyle() NumberStyle {
	switch p.PageType {
	case PageTypeFrontMatter, PageTypeTOC:
		return NumberStyleRoman
	case PageTypeBackMatter, PageTypePartDivider, PageTypeEssayFirst, PageTypeEssayBody:
		return NumberStyleArabic
	}
	return NumberStyleNone
}

func IsVerso(pageNum int) bool {
	return pageNum%2 == 0
}

func IsRecto(pageNum int) bool {
	return pageNum%2 == 1
}

func ToRoman(num int) string {
	if num <= 0 {
		return ""
	}

	values := []int{1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1}
	numerals := []string{"m", "cm", "d", "cd", "c", "xc", "l", "xl", "x", "ix", "v", "iv", "i"}

	result := ""
	for i, v := range values {
		for num >= v {
			result += numerals[i]
			num -= v
		}
	}
	return result
}
