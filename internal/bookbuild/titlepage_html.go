package bookbuild

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// Page dimensions for 6x9 book (in inches)
const (
	pageWidthInches  = 6.0
	pageHeightInches = 9.0
)

// HTMLToPDFFile converts an HTML string to a PDF file using chromedp.
// This is the single source of truth for HTML→PDF conversion.
// The frontend generates the HTML (same as preview), backend just converts it.
func HTMLToPDFFile(html string, outputPath string) error {
	tempDir := filepath.Dir(outputPath)
	tempHTML := filepath.Join(tempDir, "titlepage_temp.html")
	if err := os.WriteFile(tempHTML, []byte(html), 0644); err != nil {
		return fmt.Errorf("write temp html: %w", err)
	}
	defer os.Remove(tempHTML)

	return htmlFileToPDF(tempHTML, outputPath)
}

// HTMLToPDFFileWithSize converts HTML to PDF with custom page dimensions.
// widthInches and heightInches specify the page size in inches.
// Used for book covers which have different dimensions than book pages.
func HTMLToPDFFileWithSize(html string, outputPath string, widthInches, heightInches float64) error {
	tempDir := filepath.Dir(outputPath)
	tempHTML := filepath.Join(tempDir, "cover_temp.html")
	if err := os.WriteFile(tempHTML, []byte(html), 0644); err != nil {
		return fmt.Errorf("write temp html: %w", err)
	}
	defer os.Remove(tempHTML)

	return htmlFileToPDFWithSize(tempHTML, outputPath, widthInches, heightInches)
}

// htmlFileToPDFWithSize converts an HTML file to PDF with custom dimensions
func htmlFileToPDFWithSize(htmlPath, pdfPath string, widthInches, heightInches float64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx,
		append(chromedp.DefaultExecAllocatorOptions[:],
			chromedp.DisableGPU,
			chromedp.NoSandbox,
		)...,
	)
	defer allocCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocCtx)
	defer taskCancel()

	var buf []byte
	absPath, err := filepath.Abs(htmlPath)
	if err != nil {
		return fmt.Errorf("abs path: %w", err)
	}

	fileURL := "file://" + absPath

	if err := chromedp.Run(taskCtx,
		chromedp.Navigate(fileURL),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			buf, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPaperWidth(widthInches).
				WithPaperHeight(heightInches).
				WithMarginTop(0).
				WithMarginBottom(0).
				WithMarginLeft(0).
				WithMarginRight(0).
				WithPreferCSSPageSize(true).
				Do(ctx)
			return err
		}),
	); err != nil {
		return fmt.Errorf("chromedp run: %w", err)
	}

	if err := os.WriteFile(pdfPath, buf, 0644); err != nil {
		return fmt.Errorf("write pdf: %w", err)
	}

	return nil
}

// htmlFileToPDF converts an HTML file to PDF using chromedp
func htmlFileToPDF(htmlPath, pdfPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx,
		append(chromedp.DefaultExecAllocatorOptions[:],
			chromedp.DisableGPU,
			chromedp.NoSandbox,
		)...,
	)
	defer allocCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocCtx)
	defer taskCancel()

	var buf []byte
	absPath, err := filepath.Abs(htmlPath)
	if err != nil {
		return fmt.Errorf("abs path: %w", err)
	}

	fileURL := "file://" + absPath

	if err := chromedp.Run(taskCtx,
		chromedp.Navigate(fileURL),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			buf, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPaperWidth(pageWidthInches).
				WithPaperHeight(pageHeightInches).
				WithMarginTop(0).
				WithMarginBottom(0).
				WithMarginLeft(0).
				WithMarginRight(0).
				WithPreferCSSPageSize(true).
				Do(ctx)
			return err
		}),
	); err != nil {
		return fmt.Errorf("chromedp run: %w", err)
	}

	if err := os.WriteFile(pdfPath, buf, 0644); err != nil {
		return fmt.Errorf("write pdf: %w", err)
	}

	return nil
}
