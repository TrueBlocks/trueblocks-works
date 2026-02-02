package app

import (
	"fmt"
	"os"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
)

// ValidationResult holds the outcome of a validation check
type ValidationResult struct {
	Passed   bool     `json:"passed"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// PublicationReadiness holds validation status for all three areas
type PublicationReadiness struct {
	Content ValidationResult `json:"content"`
	Matter  ValidationResult `json:"matter"`
	Cover   ValidationResult `json:"cover"`
}

// joinTitles joins work titles for display in error messages
func joinTitles(titles []string) string {
	if len(titles) == 0 {
		return ""
	}
	if len(titles) <= 3 {
		return strings.Join(titles, ", ")
	}
	return strings.Join(titles[:3], ", ") + fmt.Sprintf(" (+%d more)", len(titles)-3)
}

// ValidateContent checks if the collection's works are publication-ready
func (a *App) ValidateContent(collID int64) (*ValidationResult, error) {
	result := &ValidationResult{
		Passed:   true,
		Errors:   []string{},
		Warnings: []string{},
	}

	// Check works exist
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("get works: %w", err)
	}
	if len(works) == 0 {
		result.Errors = append(result.Errors, "Collection has no works")
		result.Passed = false
	}

	// Check book/template exists
	book, err := a.db.GetBookByCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("get book: %w", err)
	}
	if book == nil || book.TemplatePath == nil || *book.TemplatePath == "" {
		result.Errors = append(result.Errors, "No template selected")
		result.Passed = false
	}

	// Style audit
	audit, err := a.AuditCollectionStyles(collID)
	if err != nil {
		return nil, fmt.Errorf("style audit: %w", err)
	}
	if audit.DirtyWorks > 0 {
		var dirtyTitles []string
		for _, r := range audit.Results {
			if !r.IsClean && r.Error == "" {
				dirtyTitles = append(dirtyTitles, r.Title)
			}
		}
		result.Errors = append(result.Errors, fmt.Sprintf("%d works have style issues: %s", audit.DirtyWorks, joinTitles(dirtyTitles)))
		result.Passed = false
	}

	// Heading analysis
	headings, err := a.AnalyzeCollectionHeadings(collID)
	if err != nil {
		return nil, fmt.Errorf("heading analysis: %w", err)
	}
	if headings.Failed > 0 {
		var failedTitles []string
		for _, r := range headings.Results {
			if r.Error != "" {
				failedTitles = append(failedTitles, r.Title)
			}
		}
		result.Errors = append(result.Errors, fmt.Sprintf("%d works have heading issues: %s", headings.Failed, joinTitles(failedTitles)))
		result.Passed = false
	}

	// Check galley PDF
	galleyInfo, err := a.GetGalleyInfo(collID)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Could not check galley: %v", err))
	} else if !galleyInfo.Exists {
		result.Warnings = append(result.Warnings, "Galley PDF not yet generated")
	} else {
		// Check font embedding in the galley PDF
		fontIssues, err := bookbuild.CheckFontsEmbedded(galleyInfo.Path)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Could not check font embedding: %v", err))
		} else if len(fontIssues) > 0 {
			for _, issue := range fontIssues {
				result.Errors = append(result.Errors,
					fmt.Sprintf("Non-embedded font: %s (%s) - will fail KDP print", issue.FontName, issue.FontType))
			}
			result.Passed = false
		}
	}

	return result, nil
}

// ValidateMatter checks if the book's front/back matter is publication-ready
func (a *App) ValidateMatter(collID int64) (*ValidationResult, error) {
	result := &ValidationResult{
		Passed:   true,
		Errors:   []string{},
		Warnings: []string{},
	}

	book, err := a.db.GetBookByCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("get book: %w", err)
	}
	if book == nil {
		result.Errors = append(result.Errors, "No book configuration found")
		result.Passed = false
		return result, nil
	}

	// Required fields
	if book.Title == "" {
		result.Errors = append(result.Errors, "Title is required")
		result.Passed = false
	}
	if book.Author == "" {
		result.Errors = append(result.Errors, "Author is required")
		result.Passed = false
	}
	if book.Copyright == nil || *book.Copyright == "" {
		result.Errors = append(result.Errors, "Copyright is required")
		result.Passed = false
	}
	if book.TemplatePath == nil || *book.TemplatePath == "" {
		result.Errors = append(result.Errors, "Template is required")
		result.Passed = false
	}

	// Optional but recommended
	if book.Dedication == nil || *book.Dedication == "" {
		result.Warnings = append(result.Warnings, "No dedication set")
	}
	if book.Acknowledgements == nil || *book.Acknowledgements == "" {
		result.Warnings = append(result.Warnings, "No acknowledgements set")
	}
	if book.AboutAuthor == nil || *book.AboutAuthor == "" {
		result.Warnings = append(result.Warnings, "No about author set")
	}

	return result, nil
}

// ValidateCover checks if the book's cover is publication-ready
func (a *App) ValidateCover(collID int64) (*ValidationResult, error) {
	result := &ValidationResult{
		Passed:   true,
		Errors:   []string{},
		Warnings: []string{},
	}

	book, err := a.db.GetBookByCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("get book: %w", err)
	}
	if book == nil {
		result.Errors = append(result.Errors, "No book configuration found")
		result.Passed = false
		return result, nil
	}

	// Front cover image
	if book.FrontCoverPath == nil || *book.FrontCoverPath == "" {
		result.Errors = append(result.Errors, "Front cover image is required")
		result.Passed = false
	} else {
		if _, err := os.Stat(*book.FrontCoverPath); os.IsNotExist(err) {
			result.Errors = append(result.Errors, "Front cover image file not found")
			result.Passed = false
		}
	}

	// Back cover description
	if book.DescriptionLong == nil || *book.DescriptionLong == "" {
		result.Errors = append(result.Errors, "Back cover description is required")
		result.Passed = false
	} else if len(*book.DescriptionLong) > 4000 {
		result.Errors = append(result.Errors, fmt.Sprintf("Description too long (%d chars, max 4000)", len(*book.DescriptionLong)))
		result.Passed = false
	}

	// Publisher
	if book.Publisher == nil || *book.Publisher == "" {
		result.Errors = append(result.Errors, "Publisher is required")
		result.Passed = false
	}

	// ISBN warning
	if book.ISBN == nil || *book.ISBN == "" || *book.ISBN == "ISBN-PENDING" {
		result.Warnings = append(result.Warnings, "ISBN not set")
	}

	// Cover PDF warning
	if book.CoverPath == nil || *book.CoverPath == "" {
		result.Warnings = append(result.Warnings, "Cover PDF not yet generated")
	} else {
		coverInfo, err := os.Stat(*book.CoverPath)
		if os.IsNotExist(err) {
			result.Warnings = append(result.Warnings, "Cover PDF file not found on disk")
		} else if err == nil {
			// Check that cover was generated after galley
			galleyInfo, galleyErr := a.GetGalleyInfo(collID)
			if galleyErr == nil && galleyInfo.Exists && galleyInfo.ModTime > 0 {
				if coverInfo.ModTime().Unix() < galleyInfo.ModTime {
					result.Errors = append(result.Errors, "Cover PDF is older than galley - regenerate cover after galley changes")
					result.Passed = false
				}
			}
		}
	}

	return result, nil
}

// GetPublicationReadiness returns validation status for all three areas
func (a *App) GetPublicationReadiness(collID int64) (*PublicationReadiness, error) {
	content, err := a.ValidateContent(collID)
	if err != nil {
		return nil, fmt.Errorf("validate content: %w", err)
	}

	matter, err := a.ValidateMatter(collID)
	if err != nil {
		return nil, fmt.Errorf("validate matter: %w", err)
	}

	cover, err := a.ValidateCover(collID)
	if err != nil {
		return nil, fmt.Errorf("validate cover: %w", err)
	}

	return &PublicationReadiness{
		Content: *content,
		Matter:  *matter,
		Cover:   *cover,
	}, nil
}
