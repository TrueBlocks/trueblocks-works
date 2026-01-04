package main

import "works/internal/models"

func (a *App) GetSubmissions() ([]models.Submission, error) {
	return a.db.ListSubmissions()
}

func (a *App) GetSubmission(id int64) (*models.Submission, error) {
	return a.db.GetSubmission(id)
}

func (a *App) GetSubmissionsByWork(workID int64) ([]models.Submission, error) {
	return a.db.ListSubmissionsByWork(workID)
}

func (a *App) GetSubmissionViewsByWork(workID int64) ([]models.SubmissionView, error) {
	return a.db.ListSubmissionViewsByWork(workID)
}

func (a *App) GetSubmissionViewsByOrg(orgID int64) ([]models.SubmissionView, error) {
	return a.db.ListSubmissionViewsByOrg(orgID)
}

func (a *App) CreateSubmission(sub *models.Submission) error {
	return a.db.CreateSubmission(sub)
}

func (a *App) UpdateSubmission(sub *models.Submission) error {
	return a.db.UpdateSubmission(sub)
}

func (a *App) DeleteSubmission(id int64) error {
	return a.db.DeleteSubmission(id)
}
