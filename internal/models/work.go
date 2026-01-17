package models

type Work struct {
	WorkID     int64   `json:"workID" db:"workID"`
	Title      string  `json:"title" db:"title"`
	Type       string  `json:"type" db:"type"`
	Year       *string `json:"year,omitempty" db:"year"`
	Status     string  `json:"status" db:"status"`
	Quality    string  `json:"quality" db:"quality"`
	DocType    string  `json:"docType" db:"doc_type"`
	Path       *string `json:"path,omitempty" db:"path"`
	Draft      *string `json:"draft,omitempty" db:"draft"`
	NWords     *int    `json:"nWords,omitempty" db:"n_words"`
	CourseName *string `json:"courseName,omitempty" db:"course_name"`
	Attributes string  `json:"attributes" db:"attributes"`
	AccessDate *string `json:"accessDate,omitempty" db:"access_date"`
	FileMtime  *int64  `json:"fileMtime,omitempty" db:"file_mtime"`
	CreatedAt  string  `json:"createdAt" db:"created_at"`
	ModifiedAt string  `json:"modifiedAt" db:"modified_at"`
}

type WorkView struct {
	Work
	IsDeleted      bool    `json:"isDeleted"`
	AgeDays        *int    `json:"ageDays,omitempty" db:"age_days"`
	NSubmissions   int     `json:"nSubmissions" db:"n_submissions"`
	NNotes         int     `json:"nNotes" db:"n_notes"`
	CollectionList *string `json:"collectionList,omitempty" db:"collection_list"`
	GeneratedPath  string  `json:"generatedPath"`
	NeedsMove      bool    `json:"needsMove"`
}

func (w *Work) IsDeleted() bool {
	return IsDeleted(w.Attributes)
}

func (w *Work) GeneratedPath() string {
	if w.Year == nil || w.Title == "" || w.Type == "" {
		return ""
	}
	qualityMark := ""
	if w.Quality == "Best" || w.Quality == "Better" {
		qualityMark = "@ "
	}
	return qualityMark + w.Type + " - " + *w.Year + " - " + w.Title + "." + w.DocType
}
