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
	ISBN             *string `json:"isbn,omitempty" db:"isbn"`
	PublishedDate    *string `json:"publishedDate,omitempty" db:"published_date"`
	TemplatePath     *string `json:"templatePath,omitempty" db:"template_path"`
	ExportPath       *string `json:"exportPath,omitempty" db:"export_path"`
	Status           string  `json:"status" db:"status"`
	HeaderFont       *string `json:"headerFont,omitempty" db:"header_font"`
	HeaderSize       *int    `json:"headerSize,omitempty" db:"header_size"`
	PageNumFont      *string `json:"pageNumFont,omitempty" db:"page_num_font"`
	PageNumSize      *int    `json:"pageNumSize,omitempty" db:"page_num_size"`
	CreatedAt        string  `json:"createdAt" db:"created_at"`
	ModifiedAt       string  `json:"modifiedAt" db:"updated_at"`
}

// BookStatus constants
const (
	BookStatusDraft     = "draft"
	BookStatusReady     = "ready"
	BookStatusPublished = "published"
)
