package app

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

func (a *App) GetOrganizations() ([]models.Organization, error) {
	return a.db.ListOrganizations(a.state.GetShowDeleted())
}

func (a *App) GetOrganizationsWithNotes() ([]models.OrganizationWithNotes, error) {
	return a.db.ListOrganizationsWithNotes()
}

func (a *App) GetOrganization(id int64) (*models.Organization, error) {
	return a.db.GetOrganization(id)
}

func (a *App) CreateOrganization(org *models.Organization) (*validation.ValidationResult, error) {
	return a.db.CreateOrganization(org)
}

func (a *App) UpdateOrganization(org *models.Organization) (*validation.ValidationResult, error) {
	return a.db.UpdateOrganization(org)
}

func (a *App) DeleteOrganization(id int64) error {
	return a.db.DeleteOrganization(id)
}

func (a *App) UndeleteOrganization(id int64) (*validation.ValidationResult, error) {
	return a.db.UndeleteOrganization(id)
}

func (a *App) GetOrganizationDeleteConfirmation(id int64) (*db.DeleteConfirmation, error) {
	return a.db.GetOrganizationDeleteConfirmation(id)
}

func (a *App) DeleteOrganizationPermanent(id int64) error {
	return a.db.DeleteOrganizationPermanent(id)
}
