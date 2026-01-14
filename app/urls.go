package app

import (
	"fmt"

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
