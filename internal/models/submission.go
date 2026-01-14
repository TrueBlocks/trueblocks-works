package models

// Submission tracks when works are submitted to organizations
type Submission struct {
	SubmissionID   int64    `json:"submissionID" db:"submissionID"`
	WorkID         int64    `json:"workID" db:"workID"`
	OrgID          int64    `json:"orgID" db:"orgID"`
	Draft          string   `json:"draft" db:"draft"`
	SubmissionDate *string  `json:"submissionDate,omitempty" db:"submission_date"`
	SubmissionType *string  `json:"submissionType,omitempty" db:"submission_type"`
	QueryDate      *string  `json:"queryDate,omitempty" db:"query_date"`
	ResponseDate   *string  `json:"responseDate,omitempty" db:"response_date"`
	ResponseType   *string  `json:"responseType,omitempty" db:"response_type"`
	ContestName    *string  `json:"contestName,omitempty" db:"contest_name"`
	Cost           *float64 `json:"cost,omitempty" db:"cost"`
	UserID         *string  `json:"userID,omitempty" db:"user_id"`
	Password       *string  `json:"password,omitempty" db:"password"`
	WebAddress     *string  `json:"webAddress,omitempty" db:"web_address"`
	Attributes     string   `json:"attributes" db:"attributes"`
	CreatedAt      string   `json:"createdAt" db:"created_at"`
	ModifiedAt     string   `json:"modifiedAt" db:"modified_at"`
}

// SubmissionView extends Submission with lookup fields
type SubmissionView struct {
	Submission
	IsDeleted       bool   `json:"isDeleted"`
	TitleOfWork     string `json:"titleOfWork" db:"title_of_work"`
	JournalName     string `json:"journalName" db:"journal_name"`
	JournalStatus   string `json:"journalStatus" db:"journal_status"`
	DecisionPending string `json:"decisionPending" db:"decision_pending"`
}

// IsPending returns true if the submission is still awaiting response
func (s *Submission) IsPending() bool {
	return s.ResponseType == nil || *s.ResponseType == "" || *s.ResponseType == "Waiting"
}

func (s *Submission) IsDeleted() bool {
	return IsDeleted(s.Attributes)
}
