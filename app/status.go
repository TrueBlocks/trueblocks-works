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
