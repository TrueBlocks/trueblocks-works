package state

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type SortColumn struct {
	Column    string `json:"column"`
	Direction string `json:"direction"` // "asc", "desc", or ""
}

type ViewSort struct {
	Primary   SortColumn `json:"primary"`
	Secondary SortColumn `json:"secondary"`
}

type AppState struct {
	LastWorkID                *int64              `json:"lastWorkID,omitempty"`
	LastOrgID                 *int64              `json:"lastOrgID,omitempty"`
	LastCollectionID          *int64              `json:"lastCollectionID,omitempty"`
	LastSubmissionID          *int64              `json:"lastSubmissionID,omitempty"`
	WorksFilter               string              `json:"worksFilter,omitempty"`
	WorksYearFilter           []string            `json:"worksYearFilter"`
	WorksTypeFilter           []string            `json:"worksTypeFilter"`
	WorksStatusFilter         []string            `json:"worksStatusFilter"`
	WorksQualityFilter        []string            `json:"worksQualityFilter"`
	OrgsFilter                string              `json:"orgsFilter,omitempty"`
	OrgsStatusFilter          []string            `json:"orgsStatusFilter"`
	OrgsTypeFilter            []string            `json:"orgsTypeFilter"`
	OrgsTimingFilter          []string            `json:"orgsTimingFilter"`
	OrgsSubmissionsMin        *int                `json:"orgsSubmissionsMin"`
	OrgsSubmissionsMax        *int                `json:"orgsSubmissionsMax"`
	OrgsPushcartsMin          *int                `json:"orgsPushcartsMin"`
	OrgsPushcartsMax          *int                `json:"orgsPushcartsMax"`
	SubmissionsFilter         string              `json:"submissionsFilter,omitempty"`
	SubmissionsTypeFilter     []string            `json:"submissionsTypeFilter"`
	SubmissionsResponseFilter []string            `json:"submissionsResponseFilter"`
	SubmissionsStatusFilter   []string            `json:"submissionsStatusFilter"`
	CollectionsFilter         string              `json:"collectionsFilter,omitempty"`
	LastRoute                 string              `json:"lastRoute,omitempty"`
	SidebarCollapsed          bool                `json:"sidebarCollapsed"`
	PreviewPanelWidth         int                 `json:"previewPanelWidth,omitempty"`
	WindowX                   int                 `json:"windowX,omitempty"`
	WindowY                   int                 `json:"windowY,omitempty"`
	WindowWidth               int                 `json:"windowWidth,omitempty"`
	WindowHeight              int                 `json:"windowHeight,omitempty"`
	ViewSorts                 map[string]ViewSort `json:"viewSorts,omitempty"`
	SearchHistory             []string            `json:"searchHistory,omitempty"`
}

type Manager struct {
	mu       sync.RWMutex
	state    *AppState
	filePath string
}

func NewManager() *Manager {
	homeDir, _ := os.UserHomeDir()
	statePath := filepath.Join(homeDir, ".works", "state.json")

	m := &Manager{
		state:    &AppState{},
		filePath: statePath,
	}

	_ = m.Load()
	return m
}

func (m *Manager) Load() error {
	data, err := os.ReadFile(m.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	return json.Unmarshal(data, m.state)
}

func (m *Manager) Save() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.MarshalIndent(m.state, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(m.filePath), 0755); err != nil {
		return err
	}

	return os.WriteFile(m.filePath, data, 0644)
}

func (m *Manager) GetState() AppState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return *m.state
}

func (m *Manager) SetLastWorkID(id int64) {
	m.mu.Lock()
	m.state.LastWorkID = &id
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetLastOrgID(id int64) {
	m.mu.Lock()
	m.state.LastOrgID = &id
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetLastCollectionID(id int64) {
	m.mu.Lock()
	m.state.LastCollectionID = &id
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetLastSubmissionID(id int64) {
	m.mu.Lock()
	m.state.LastSubmissionID = &id
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetWorksFilter(filter string) {
	m.mu.Lock()
	m.state.WorksFilter = filter
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetWorksYearFilter(years []string) {
	m.mu.Lock()
	m.state.WorksYearFilter = years
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetWorksTypeFilter(types []string) {
	m.mu.Lock()
	m.state.WorksTypeFilter = types
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetWorksStatusFilter(statuses []string) {
	m.mu.Lock()
	m.state.WorksStatusFilter = statuses
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetWorksQualityFilter(qualities []string) {
	m.mu.Lock()
	m.state.WorksQualityFilter = qualities
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetOrgsFilter(filter string) {
	m.mu.Lock()
	m.state.OrgsFilter = filter
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetSubmissionsFilter(filter string) {
	m.mu.Lock()
	m.state.SubmissionsFilter = filter
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetCollectionsFilter(filter string) {
	m.mu.Lock()
	m.state.CollectionsFilter = filter
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetLastRoute(route string) {
	m.mu.Lock()
	m.state.LastRoute = route
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetSidebarCollapsed(collapsed bool) {
	m.mu.Lock()
	m.state.SidebarCollapsed = collapsed
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetPreviewPanelWidth(width int) {
	m.mu.Lock()
	m.state.PreviewPanelWidth = width
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetWindowGeometry(x, y, width, height int) {
	m.mu.Lock()
	m.state.WindowX = x
	m.state.WindowY = y
	m.state.WindowWidth = width
	m.state.WindowHeight = height
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) GetWindowGeometry() (x, y, width, height int) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state.WindowX, m.state.WindowY, m.state.WindowWidth, m.state.WindowHeight
}

func (m *Manager) SetOrgsStatusFilter(statuses []string) {
	m.mu.Lock()
	m.state.OrgsStatusFilter = statuses
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetOrgsTypeFilter(types []string) {
	m.mu.Lock()
	m.state.OrgsTypeFilter = types
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetOrgsTimingFilter(timings []string) {
	m.mu.Lock()
	m.state.OrgsTimingFilter = timings
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetOrgsPushcartsFilter(min, max *int) {
	m.mu.Lock()
	m.state.OrgsPushcartsMin = min
	m.state.OrgsPushcartsMax = max
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetOrgsSubmissionsFilter(min, max *int) {
	m.mu.Lock()
	m.state.OrgsSubmissionsMin = min
	m.state.OrgsSubmissionsMax = max
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetSubmissionsTypeFilter(types []string) {
	m.mu.Lock()
	m.state.SubmissionsTypeFilter = types
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetSubmissionsResponseFilter(responses []string) {
	m.mu.Lock()
	m.state.SubmissionsResponseFilter = responses
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetSubmissionsStatusFilter(statuses []string) {
	m.mu.Lock()
	m.state.SubmissionsStatusFilter = statuses
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) SetViewSort(view string, sort ViewSort) {
	m.mu.Lock()
	if m.state.ViewSorts == nil {
		m.state.ViewSorts = make(map[string]ViewSort)
	}
	m.state.ViewSorts[view] = sort
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) AddSearchHistory(query string) {
	if query == "" {
		return
	}
	m.mu.Lock()
	// Remove if already exists (to move to front)
	history := make([]string, 0, len(m.state.SearchHistory))
	for _, h := range m.state.SearchHistory {
		if h != query {
			history = append(history, h)
		}
	}
	// Add to front
	history = append([]string{query}, history...)
	// Limit to 25
	if len(history) > 25 {
		history = history[:25]
	}
	m.state.SearchHistory = history
	m.mu.Unlock()
	_ = m.Save()
}

func (m *Manager) GetSearchHistory() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.state.SearchHistory == nil {
		return []string{}
	}
	return m.state.SearchHistory
}
