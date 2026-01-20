package models

// NOTE: These lists are for reference only. Actual values are now
// loaded dynamically from the database using GetDistinctValues.

var StatusList = []string{
	"Out",
	"Focus",
	"Active",
	"Working",
	"Resting",
	"Waiting",
	"Gestating",
	"Sound",
	"Published",
	"Sleeping",
	"Dying",
	"Dead",
	"Done",
}

var QualityList = []string{
	"Published",
	"Best",
	"Better",
	"Good",
	"Okay",
	"Bad",
	"Worst",
	"Unknown",
}

var ResponseTypeList = []string{
	"Accepted",
	"Email",
	"Form",
	"No Response",
	"Personal",
	"Personal Note",
	"Waiting",
}

var NoteTypeList = []string{
	"Acceptance",
	"Note",
	"Problem",
	"Response",
	"Review",
	"Critique",
	"TitleChange",
	"Submission",
	"Contest",
	"Reading",
	"Export",
	"Revised",
	"Posting",
	"Query",
}

var SubmissionTypeList = []string{
	"submittable",
	"online",
	"snail mail",
	"email",
}

var AcceptTypeList = []string{
	"poetry",
	"short fiction",
	"cnf",
	"flash fiction",
	"craft",
	"reviews",
	"interviews",
	"contests",
}

var JournalStatusList = []string{
	"Open",
	"Boring",
}

var JournalTypeList = []string{
	"Journal",
	"Magazine",
	"Publisher",
	"Contest",
	"Anthology",
	"Blog",
}

var InterestList = QualityList

var CollectionTypeList = []string{
	"Active",
	"Process",
	"Dead",
	"Book",
	"Other",
	"Hidden",
	"System",
}
