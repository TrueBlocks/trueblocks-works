package app

import "github.com/wailsapp/wails/v2/pkg/runtime"

type StatusMessage struct {
	Level   string `json:"level"`
	Message string `json:"message"`
}

func (a *App) EmitStatus(level, message string) {
	msg := StatusMessage{Level: level, Message: message}

	switch level {
	case "error":
		runtime.LogError(a.ctx, message)
	case "success":
		runtime.LogInfo(a.ctx, "✓ "+message)
	default:
		runtime.LogInfo(a.ctx, message)
	}

	runtime.EventsEmit(a.ctx, "status:message", msg)
}

// OpenStatusBar opens the status bar and keeps it open until CloseStatusBar is called.
// Use this before a series of status updates during long-running operations.
func (a *App) OpenStatusBar() {
	runtime.EventsEmit(a.ctx, "status:open", nil)
}

// CloseStatusBar closes the status bar after a brief delay to show the final message.
// Call this when a long-running operation completes.
func (a *App) CloseStatusBar() {
	runtime.EventsEmit(a.ctx, "status:close", nil)
}
