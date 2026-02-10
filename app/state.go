package app

import "github.com/TrueBlocks/trueblocks-works/v2/internal/state"

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

func (a *App) SetLastRoute(route string) {
	a.state.SetLastRoute(route)
}

func (a *App) SetDashboardTimeframe(timeframe string) {
	a.state.SetDashboardTimeframe(timeframe)
}

func (a *App) AddSearchHistory(query string) {
	a.state.AddSearchHistory(query)
}

func (a *App) GetSearchHistory() []string {
	return a.state.GetSearchHistory()
}

func (a *App) GetTableState(tableName string) state.TableState {
	return a.state.GetTableState(tableName)
}

func (a *App) SetTableState(tableName string, tableState state.TableState) {
	a.state.SetTableState(tableName, tableState)
}

func (a *App) GetTab(pageName string) string {
	return a.state.GetTab(pageName)
}

func (a *App) SetTab(pageName string, tab string) {
	a.state.SetTab(pageName, tab)
}

func (a *App) ClearAnalysisTabs() {
	a.state.ClearAnalysisTabs()
}

func (a *App) ToggleShowDeleted() bool {
	return a.state.ToggleShowDeleted()
}

func (a *App) SetShowDeleted(show bool) {
	a.state.SetShowDeleted(show)
}

func (a *App) SetSidebarWidth(width int) {
	a.state.SetSidebarWidth(width)
}
