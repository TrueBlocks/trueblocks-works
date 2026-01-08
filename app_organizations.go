package main

import "works/internal/models"

func (a *App) GetOrganizations() ([]models.Organization, error) {
	return a.db.ListOrganizations(a.state.GetShowDeleted())
}

func (a *App) GetOrganizationsWithNotes() ([]models.OrganizationWithNotes, error) {
	return a.db.ListOrganizationsWithNotes()
}

func (a *App) GetOrganization(id int64) (*models.Organization, error) {
	return a.db.GetOrganization(id)
}

func (a *App) CreateOrganization(org *models.Organization) error {
	return a.db.CreateOrganization(org)
}

func (a *App) UpdateOrganization(org *models.Organization) error {
	return a.db.UpdateOrganization(org)
}

func (a *App) DeleteOrganization(id int64) error {
	return a.db.DeleteOrganization(id)
}

func (a *App) UndeleteOrganization(id int64) error {
	return a.db.UndeleteOrganization(id)
}
