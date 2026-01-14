package app

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

func (a *App) GetSubmissions() ([]models.Submission, error) {
	return a.db.ListSubmissions(a.state.GetShowDeleted())
}

func (a *App) GetAllSubmissionViews() ([]models.SubmissionView, error) {
	return a.db.ListAllSubmissionViews(a.state.GetShowDeleted())
}

func (a *App) GetSubmission(id int64) (*models.Submission, error) {
	return a.db.GetSubmission(id)
}

func (a *App) GetSubmissionsByWork(workID int64) ([]models.Submission, error) {
	return a.db.ListSubmissionsByWork(workID)
}

func (a *App) GetSubmissionViewsByWork(workID int64) ([]models.SubmissionView, error) {
	return a.db.ListSubmissionViewsByWork(workID, a.state.GetShowDeleted())
}

func (a *App) GetSubmissionViewsByOrg(orgID int64) ([]models.SubmissionView, error) {
	return a.db.ListSubmissionViewsByOrg(orgID, a.state.GetShowDeleted())
}

func (a *App) GetSubmissionViewsByCollection(collID int64) ([]models.SubmissionView, error) {
	return a.db.ListSubmissionViewsByCollection(collID, a.state.GetShowDeleted())
}

func (a *App) CreateSubmission(sub *models.Submission) (*validation.ValidationResult, error) {
	return a.db.CreateSubmission(sub)
}

func (a *App) UpdateSubmission(sub *models.Submission) (*validation.ValidationResult, error) {
	return a.db.UpdateSubmission(sub)
}

func (a *App) DeleteSubmission(id int64) error {
	return a.db.DeleteSubmission(id)
}

func (a *App) UndeleteSubmission(id int64) (*validation.ValidationResult, error) {
	return a.db.UndeleteSubmission(id)
}

func (a *App) GetSubmissionDeleteConfirmation(id int64) (*db.DeleteConfirmation, error) {
	return a.db.GetSubmissionDeleteConfirmation(id)
}

func (a *App) DeleteSubmissionPermanent(id int64) error {
	return a.db.DeleteSubmissionPermanent(id)
}
