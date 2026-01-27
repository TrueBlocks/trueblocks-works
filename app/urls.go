package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) OpenURL(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

func (a *App) OpenOrgURL(orgID int64) error {
	org, err := a.db.GetOrganization(orgID)
	if err != nil {
		return err
	}
	if org.URL != nil && *org.URL != "" {
		runtime.BrowserOpenURL(a.ctx, *org.URL)
		return nil
	}
	return fmt.Errorf("organization has no URL")
}

func (a *App) OpenOrgOtherURL(orgID int64) error {
	org, err := a.db.GetOrganization(orgID)
	if err != nil {
		return err
	}
	if org.OtherURL != nil && *org.OtherURL != "" {
		runtime.BrowserOpenURL(a.ctx, *org.OtherURL)
		return nil
	}
	return fmt.Errorf("organization has no other URL")
}

func (a *App) OpenDuotrope(orgID int64) error {
	org, err := a.db.GetOrganization(orgID)
	if err != nil {
		return err
	}
	if org.DuotropeNum != nil && *org.DuotropeNum > 0 {
		url := fmt.Sprintf("https://duotrope.com/listing/%d", *org.DuotropeNum)
		runtime.BrowserOpenURL(a.ctx, url)
		return nil
	}
	return fmt.Errorf("organization has no Duotrope number")
}

func (a *App) GetDuotropeURL(orgID int64) (string, error) {
	org, err := a.db.GetOrganization(orgID)
	if err != nil {
		return "", err
	}
	if org.DuotropeNum != nil && *org.DuotropeNum > 0 {
		return fmt.Sprintf("https://duotrope.com/listing/%d", *org.DuotropeNum), nil
	}
	return "", nil
}

// OpenKDPManuscriptSpecs opens the KDP manuscript specifications document
func (a *App) OpenKDPManuscriptSpecs() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	docPath := filepath.Join(home, ".works", "docs", "kdp-manuscript-specs.md")
	if _, err := os.Stat(docPath); os.IsNotExist(err) {
		return fmt.Errorf("KDP specs document not found at %s", docPath)
	}

	return exec.Command("open", docPath).Start()
}
