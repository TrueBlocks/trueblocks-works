package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

func main() {
	if len(os.Args) < 3 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]
	pdfPath := os.Args[2]

	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: file not found: %s\n", pdfPath)
		os.Exit(1)
	}

	switch command {
	case "fonts":
		if err := listFonts(pdfPath); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	case "check":
		if err := checkFonts(pdfPath); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	case "validate":
		if err := validatePDF(pdfPath); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("pdfcheck - PDF font and validation checker")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  pdfcheck fonts <file.pdf>     List all fonts and their embedding status")
	fmt.Println("  pdfcheck check <file.pdf>     Check for non-embedded fonts (exit 1 if found)")
	fmt.Println("  pdfcheck validate <file.pdf>  Validate PDF structure")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  pdfcheck fonts ~/Desktop/book.pdf")
	fmt.Println("  pdfcheck check ~/Desktop/book.pdf")
	fmt.Println("  pdfcheck validate ~/Desktop/book.pdf")
}

func listFonts(pdfPath string) error {
	conf := model.NewDefaultConfiguration()

	f, err := os.Open(pdfPath)
	if err != nil {
		return fmt.Errorf("opening file: %w", err)
	}
	defer f.Close()

	// Use api.PDFInfo directly which handles fonts properly
	info, err := api.PDFInfo(f, pdfPath, nil, true, conf)
	if err != nil {
		return fmt.Errorf("getting PDF info: %w", err)
	}

	fmt.Printf("Fonts in %s:\n", pdfPath)
	fmt.Println(strings.Repeat("-", 80))

	if len(info.Fonts) == 0 {
		fmt.Println("No fonts found (may be image-only PDF)")
	} else {
		for _, font := range info.Fonts {
			embeddedStr := "NOT EMBEDDED ⚠️"
			if font.Embedded {
				embeddedStr = "embedded ✓"
			}
			fmt.Printf("  %-35s  %-12s  %s\n", font.Name, font.Type, embeddedStr)
		}
	}

	fmt.Println(strings.Repeat("-", 80))
	fmt.Printf("Total: %d fonts\n", len(info.Fonts))
	fmt.Println()
	fmt.Println("Legend: 'embedded ✓' = safe for printing")
	fmt.Println("        'NOT EMBEDDED ⚠️' = may cause issues with KDP")

	return nil
}

func validatePDF(pdfPath string) error {
	conf := model.NewDefaultConfiguration()

	f, err := os.Open(pdfPath)
	if err != nil {
		return fmt.Errorf("opening file: %w", err)
	}
	defer f.Close()

	if err := api.Validate(f, conf); err != nil {
		fmt.Printf("❌ Validation FAILED for %s\n", pdfPath)
		return fmt.Errorf("validation error: %w", err)
	}

	fmt.Printf("✓ Validation PASSED for %s\n", pdfPath)
	fmt.Println("  PDF structure is valid.")

	return nil
}

func checkFonts(pdfPath string) error {
	conf := model.NewDefaultConfiguration()

	f, err := os.Open(pdfPath)
	if err != nil {
		return fmt.Errorf("opening file: %w", err)
	}
	defer f.Close()

	info, err := api.PDFInfo(f, pdfPath, nil, true, conf)
	if err != nil {
		return fmt.Errorf("getting PDF info: %w", err)
	}

	var unembedded []string
	seen := make(map[string]bool)

	for _, font := range info.Fonts {
		if !font.Embedded {
			key := font.Name + "|" + font.Type
			if !seen[key] {
				unembedded = append(unembedded, fmt.Sprintf("%s (%s)", font.Name, font.Type))
				seen[key] = true
			}
		}
	}

	if len(unembedded) > 0 {
		fmt.Printf("❌ FONT EMBEDDING CHECK FAILED for %s\n", pdfPath)
		fmt.Println("  The following fonts are NOT embedded:")
		for _, font := range unembedded {
			fmt.Printf("    ⚠️  %s\n", font)
		}
		fmt.Println()
		fmt.Println("  Non-embedded fonts may cause printing issues with KDP.")
		fmt.Println("  These fonts will appear in preview but may be missing in print.")
		return fmt.Errorf("found %d non-embedded fonts", len(unembedded))
	}

	fmt.Printf("✓ FONT EMBEDDING CHECK PASSED for %s\n", pdfPath)
	fmt.Printf("  All %d font references are properly embedded.\n", len(info.Fonts))
	return nil
}
