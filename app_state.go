package main

import "works/internal/state"

func (a *App) GetAppState() state.AppState {
	return a.state.GetState()
}

func (a *App) SetLastWorkID(id int64) {
	a.state.SetLastWorkID(id)
}

func (a *App) SetLastOrgID(id int64) {
	a.state.SetLastOrgID(id)
}

func (a *App) SetLastCollectionID(id int64) {
	a.state.SetLastCollectionID(id)
}

func (a *App) SetLastSubmissionID(id int64) {
	a.state.SetLastSubmissionID(id)
}

func (a *App) SetWorksFilter(filter string) {
	a.state.SetWorksFilter(filter)
}

func (a *App) SetOrgsFilter(filter string) {
	a.state.SetOrgsFilter(filter)
}

func (a *App) SetSubmissionsFilter(filter string) {
	a.state.SetSubmissionsFilter(filter)
}

func (a *App) SetCollectionsFilter(filter string) {
	a.state.SetCollectionsFilter(filter)
}

func (a *App) SetLastRoute(route string) {
	a.state.SetLastRoute(route)
}

func (a *App) SetOrgsStatusFilter(statuses []string) {
	a.state.SetOrgsStatusFilter(statuses)
}

func (a *App) SetViewSort(view string, sort state.ViewSort) {
	a.state.SetViewSort(view, sort)
}
