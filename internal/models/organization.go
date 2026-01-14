package models

// Organization represents a literary journal, magazine, or publisher
type Organization struct {
	OrgID          int64   `json:"orgID" db:"orgID"`
	Name           string  `json:"name" db:"name"`
	OtherName      *string `json:"otherName,omitempty" db:"other_name"`
	URL            *string `json:"url,omitempty" db:"url"`
	OtherURL       *string `json:"otherURL,omitempty" db:"other_url"`
	Status         string  `json:"status" db:"status"`
	Type           string  `json:"type" db:"type"`
	Timing         *string `json:"timing,omitempty" db:"timing"`
	SubmissionType *string `json:"submissionTypes,omitempty" db:"submission_types"`
	Accepts        *string `json:"accepts,omitempty" db:"accepts"`
	MyInterest     *string `json:"myInterest,omitempty" db:"my_interest"`
	Ranking        *int    `json:"ranking,omitempty" db:"ranking"`
	Source         *string `json:"source,omitempty" db:"source"`
	WebsiteMenu    *string `json:"websiteMenu,omitempty" db:"website_menu"`
	DuotropeNum    *int    `json:"duotropeNum,omitempty" db:"duotrope_num"`
	NPushFiction   int     `json:"nPushFiction" db:"n_push_fiction"`
	NPushNonfict   int     `json:"nPushNonfiction" db:"n_push_nonfiction"`
	NPushPoetry    int     `json:"nPushPoetry" db:"n_push_poetry"`
	ContestEnds    *string `json:"contestEnds,omitempty" db:"contest_ends"`
	ContestFee     *string `json:"contestFee,omitempty" db:"contest_fee"`
	ContestPrize   *string `json:"contestPrize,omitempty" db:"contest_prize"`
	ContestPrize2  *string `json:"contestPrize2,omitempty" db:"contest_prize_2"`
	Attributes     string  `json:"attributes" db:"attributes"`
	DateAdded      *string `json:"dateAdded,omitempty" db:"date_added"`
	ModifiedAt     *string `json:"modifiedAt,omitempty" db:"modified_at"`
}

// OrganizationView extends Organization with computed fields
type OrganizationView struct {
	Organization
	NPushcarts   int `json:"nPushcarts" db:"n_pushcarts"`
	Rating       int `json:"rating" db:"rating"`
	NSubmissions int `json:"nSubmissions" db:"n_submissions"`
}

// OrganizationWithNotes includes concatenated journal notes
type OrganizationWithNotes struct {
	Organization
	NSubmissions int     `json:"nSubmissions" db:"n_submissions"`
	Notes        *string `json:"notes,omitempty"`
}

func (o *Organization) IsDeleted() bool {
	return IsDeleted(o.Attributes)
}
