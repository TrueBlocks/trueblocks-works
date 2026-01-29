package models

// Book represents book publishing metadata for a collection
type Book struct {
	BookID           int64   `json:"bookID" db:"bookID"`
	CollID           int64   `json:"collID" db:"collID"`
	Title            string  `json:"title" db:"title"`
	Subtitle         *string `json:"subtitle,omitempty" db:"subtitle"`
	Author           string  `json:"author" db:"author"`
	Copyright        *string `json:"copyright,omitempty" db:"copyright"`
	Dedication       *string `json:"dedication,omitempty" db:"dedication"`
	Acknowledgements *string `json:"acknowledgements,omitempty" db:"acknowledgements"`
	AboutAuthor      *string `json:"aboutAuthor,omitempty" db:"about_author"`
	CoverPath        *string `json:"coverPath,omitempty" db:"cover_path"`
	FrontCoverPath   *string `json:"frontCoverPath,omitempty" db:"front_cover_path"`
	BackCoverPath    *string `json:"backCoverPath,omitempty" db:"back_cover_path"`
	SpineText        *string `json:"spineText,omitempty" db:"spine_text"`
	DescriptionShort *string `json:"descriptionShort,omitempty" db:"description_short"`
	DescriptionLong  *string `json:"descriptionLong,omitempty" db:"description_long"`
	ISBN             *string `json:"isbn,omitempty" db:"isbn"`
	PublishedDate    *string `json:"publishedDate,omitempty" db:"published_date"`
	TemplatePath     *string `json:"templatePath,omitempty" db:"template_path"`
	ExportPath       *string `json:"exportPath,omitempty" db:"export_path"`
	Status           string  `json:"status" db:"status"`
	HeaderFont       *string `json:"headerFont,omitempty" db:"header_font"`
	HeaderSize       *int    `json:"headerSize,omitempty" db:"header_size"`
	PageNumFont      *string `json:"pageNumFont,omitempty" db:"page_num_font"`
	PageNumSize      *int    `json:"pageNumSize,omitempty" db:"page_num_size"`
	TitleFont        *string `json:"titleFont,omitempty" db:"title_font"`
	TitleSize        *int    `json:"titleSize,omitempty" db:"title_size"`
	SubtitleFont     *string `json:"subtitleFont,omitempty" db:"subtitle_font"`
	SubtitleSize     *int    `json:"subtitleSize,omitempty" db:"subtitle_size"`
	AuthorFont       *string `json:"authorFont,omitempty" db:"author_font"`
	AuthorSize       *int    `json:"authorSize,omitempty" db:"author_size"`
	TitleOffsetY     *int    `json:"titleOffsetY,omitempty" db:"title_offset_y"`
	SubtitleOffsetY  *int    `json:"subtitleOffsetY,omitempty" db:"subtitle_offset_y"`
	AuthorOffsetY    *int    `json:"authorOffsetY,omitempty" db:"author_offset_y"`
	Publisher        *string `json:"publisher,omitempty" db:"publisher"`
	BackgroundColor  *string `json:"backgroundColor,omitempty" db:"background_color"`
	WorksStartRecto  *bool   `json:"worksStartRecto,omitempty" db:"works_start_recto"`
	ShowPageNumbers  *bool   `json:"showPageNumbers,omitempty" db:"show_page_numbers"`
	SelectedParts    *string `json:"selectedParts,omitempty" db:"selected_parts"`
	CreatedAt        string  `json:"createdAt" db:"created_at"`
	ModifiedAt       string  `json:"modifiedAt" db:"updated_at"`
}

// BookStatus constants
const (
	BookStatusDraft     = "draft"
	BookStatusReady     = "ready"
	BookStatusPublished = "published"
)
