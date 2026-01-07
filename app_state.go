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

func (a *App) SetLastCollectionType(collType string) {
	a.state.SetLastCollectionType(collType)
}

func (a *App) SetWorksFilter(filter string) {
	a.state.SetWorksFilter(filter)
}

func (a *App) SetWorksYearFilter(years []string) {
	a.state.SetWorksYearFilter(years)
}

func (a *App) SetWorksTypeFilter(types []string) {
	a.state.SetWorksTypeFilter(types)
}

func (a *App) SetWorksStatusFilter(statuses []string) {
	a.state.SetWorksStatusFilter(statuses)
}

func (a *App) SetWorksQualityFilter(qualities []string) {
	a.state.SetWorksQualityFilter(qualities)
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

func (a *App) SetOrgsTypeFilter(types []string) {
	a.state.SetOrgsTypeFilter(types)
}

func (a *App) SetOrgsTimingFilter(timings []string) {
	a.state.SetOrgsTimingFilter(timings)
}

func (a *App) SetOrgsPushcartsFilter(min, max *int) {
	a.state.SetOrgsPushcartsFilter(min, max)
}

func (a *App) SetOrgsSubmissionsFilter(min, max *int) {
	a.state.SetOrgsSubmissionsFilter(min, max)
}

func (a *App) SetSubmissionsTypeFilter(types []string) {
	a.state.SetSubmissionsTypeFilter(types)
}

func (a *App) SetSubmissionsResponseFilter(responses []string) {
	a.state.SetSubmissionsResponseFilter(responses)
}

func (a *App) SetSubmissionsStatusFilter(statuses []string) {
	a.state.SetSubmissionsStatusFilter(statuses)
}

func (a *App) SetViewSort(view string, sort state.ViewSort) {
	a.state.SetViewSort(view, sort)
}

func (a *App) AddSearchHistory(query string) {
	a.state.AddSearchHistory(query)
}

func (a *App) GetSearchHistory() []string {
	return a.state.GetSearchHistory()
}
