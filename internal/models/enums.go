package models

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

var StatusOrder = map[string]int{
	"Out":       1,
	"Focus":     2,
	"Active":    3,
	"Working":   4,
	"Resting":   5,
	"Waiting":   6,
	"Gestating": 7,
	"Sound":     8,
	"Published": 9,
	"Sleeping":  10,
	"Dying":     11,
	"Dead":      12,
	"Done":      13,
}

var QualityList = []string{
	"Best",
	"Better",
	"Good",
	"Okay",
	"Bad",
	"Worst",
	"Unknown",
}

var QualityOrder = map[string]int{
	"Best":    1,
	"Better":  2,
	"Good":    3,
	"Okay":    4,
	"Bad":     5,
	"Worst":   6,
	"Unknown": 7,
}

var WorkTypeList = []string{
	"Article",
	"Book",
	"Chapter",
	"Critique",
	"Essay",
	"Flash",
	"Interview",
	"Freewrite",
	"Journal",
	"Micro",
	"Poem",
	"Paper",
	"Lesson",
	"Character",
	"Research",
	"Review",
	"Song",
	"Story",
	"Travel",
	"Essay Idea",
	"Poem Idea",
	"Article Idea",
	"Book Idea",
	"Story Idea",
	"Paper Idea",
	"Interview Idea",
	"Flash Idea",
	"Micro Idea",
	"Other",
}

var TypeOrder = map[string]int{
	"Article":        1,
	"Book":           2,
	"Chapter":        3,
	"Critique":       4,
	"Essay":          5,
	"Flash":          6,
	"Interview":      7,
	"Freewrite":      8,
	"Journal":        9,
	"Micro":          10,
	"Poem":           11,
	"Paper":          12,
	"Lesson":         13,
	"Character":      14,
	"Research":       15,
	"Review":         16,
	"Song":           17,
	"Story":          18,
	"Travel":         19,
	"Essay Idea":     20,
	"Poem Idea":      21,
	"Article Idea":   22,
	"Book Idea":      23,
	"Story Idea":     24,
	"Paper Idea":     25,
	"Interview Idea": 26,
	"Flash Idea":     27,
	"Micro Idea":     28,
	"Other":          99,
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
}
