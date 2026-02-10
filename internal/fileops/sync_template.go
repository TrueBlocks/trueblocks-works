package fileops

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func SyncTemplateToDocument(templatePath, docxPath string) error {
	absTemplate, err := filepath.Abs(templatePath)
	if err != nil {
		return fmt.Errorf("abs template path: %w", err)
	}

	absDocx, err := filepath.Abs(docxPath)
	if err != nil {
		return fmt.Errorf("abs docx path: %w", err)
	}

	script := buildSyncTemplateScript(absTemplate, absDocx)

	// Write script to temp file for reliable execution
	tmpFile, err := os.CreateTemp("", "sync_template_*.scpt")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	scriptPath := tmpFile.Name()

	if _, err := tmpFile.WriteString(script); err != nil {
		tmpFile.Close()
		os.Remove(scriptPath)
		return fmt.Errorf("write script: %w", err)
	}
	tmpFile.Close()

	// 60 second timeout - template sync can take a while but shouldn't hang forever
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "osascript", scriptPath)
	output, err := cmd.CombinedOutput()
	os.Remove(scriptPath)
	if ctx.Err() == context.DeadlineExceeded {
		return fmt.Errorf("template sync timed out - Word may have a dialog open")
	}
	if err != nil {
		return fmt.Errorf("applescript failed: %w: %s", err, string(output))
	}

	return nil
}

func buildSyncTemplateScript(templatePath, docxPath string) string {
	// Escape paths for AppleScript
	escapedTemplate := escapeAppleScriptString(templatePath)
	escapedDocx := escapeAppleScriptString(docxPath)

	// Extract essay title from filename (without path and extension)
	baseName := filepath.Base(docxPath)
	essayTitle := baseName[:len(baseName)-len(filepath.Ext(baseName))]
	escapedTitle := escapeAppleScriptString(essayTitle)

	return `
tell application "Microsoft Word"
	launch
	
	-- Open template to read page setup
	set templatePath to (POSIX file "` + escapedTemplate + `" as text)
	open templatePath
	set templateDoc to active document
	set templatePageSetup to page setup of section 1 of templateDoc
	set templatePageWidth to page width of templatePageSetup
	set templatePageHeight to page height of templatePageSetup
	set templateTopMargin to top margin of templatePageSetup
	set templateBottomMargin to bottom margin of templatePageSetup
	set templateLeftMargin to left margin of templatePageSetup
	set templateRightMargin to right margin of templatePageSetup
	set templateMirrorMargins to mirror margins of templatePageSetup
	set templateGutter to gutter of templatePageSetup
	close templateDoc saving no
	
	-- Open the document
	open (POSIX file "` + escapedDocx + `" as text)
	set theDoc to active document
	set docPageSetup to page setup of section 1 of theDoc
	set docPageWidth to page width of docPageSetup
	set docPageHeight to page height of docPageSetup
	
	-- Check if target document is landscape (width > height)
	set docIsLandscape to (docPageWidth > docPageHeight)
	
	-- If target is landscape, swap template dimensions to match orientation
	if docIsLandscape then
		set tempWidth to templatePageWidth
		set templatePageWidth to templatePageHeight
		set templatePageHeight to tempWidth
		-- Also swap margins to match rotated orientation
		set tempTopMargin to templateTopMargin
		set tempBottomMargin to templateBottomMargin
		set templateTopMargin to templateLeftMargin
		set templateBottomMargin to templateRightMargin
		set templateLeftMargin to tempTopMargin
		set templateRightMargin to tempBottomMargin
	end if
	
	-- Calculate scale factor (minimum of width and height ratios)
	set widthRatio to templatePageWidth / docPageWidth
	set heightRatio to templatePageHeight / docPageHeight
	if widthRatio < heightRatio then
		set scaleFactor to widthRatio
	else
		set scaleFactor to heightRatio
	end if
	
	-- Scale inline shapes
	set inlineShapeCount to count of inline shapes of theDoc
	repeat with i from 1 to inlineShapeCount
		try
			set inlineShape to inline shape i of theDoc
			set width of inlineShape to (width of inlineShape) * scaleFactor
			set height of inlineShape to (height of inlineShape) * scaleFactor
		end try
	end repeat
	
	-- Scale floating shapes
	set floatShapeCount to count of shapes of theDoc
	repeat with i from 1 to floatShapeCount
		try
			set floatShape to shape i of theDoc
			set width of floatShape to (width of floatShape) * scaleFactor
			set height of floatShape to (height of floatShape) * scaleFactor
		end try
	end repeat
	
	-- Copy styles from template
	tell theDoc to copy styles from template template templatePath
	
	-- Apply page setup from template
	set page width of docPageSetup to templatePageWidth
	set page height of docPageSetup to templatePageHeight
	set mirror margins of docPageSetup to templateMirrorMargins
	set gutter of docPageSetup to templateGutter
	set top margin of docPageSetup to templateTopMargin
	set bottom margin of docPageSetup to templateBottomMargin
	set left margin of docPageSetup to templateLeftMargin
	set right margin of docPageSetup to templateRightMargin
	
	-- Set Title document property for header field
	set title of properties of theDoc to "` + escapedTitle + `"
	
	-- Save and close document, then quit Word
	save theDoc
	close theDoc
	quit
end tell
`
}

func escapeAppleScriptString(s string) string {
	result := ""
	for _, c := range s {
		switch c {
		case '"', '\u201C', '\u201D': // straight quote, left curly, right curly
			result += `\"`
		case '\\':
			result += `\\`
		default:
			result += string(c)
		}
	}
	return result
}
