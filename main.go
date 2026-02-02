package main

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-works/v2/app"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/state"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	application := app.NewApp()

	// Load saved state to get window geometry
	homeDir, _ := os.UserHomeDir()
	statePath := filepath.Join(homeDir, ".works", "state.json")
	stateManager := state.NewManager()
	x, y, width, height := stateManager.GetWindowGeometry()

	// Use defaults if no saved geometry
	if width == 0 {
		width = 1024
	}
	if height == 0 {
		height = 768
	}

	// Store state path for the app to use
	_ = statePath
	_ = x
	_ = y

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Works",
		Width:  width,
		Height: height,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        application.Startup,
		OnShutdown:       application.Shutdown,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: true,
			CSSDropProperty:    "--wails-drop-target",
			CSSDropValue:       "drop",
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "com.trueblocks.works.8f3a9c2e-4b1d-4e5f-9a7b-2c8d6e0f1a3b",
			OnSecondInstanceLaunch: func(data options.SecondInstanceData) {
				_ = data
				fmt.Println("Cannot start a second instance")
			},
		},
		Bind: []interface{}{
			application,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
