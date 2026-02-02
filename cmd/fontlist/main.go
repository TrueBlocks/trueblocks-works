package main

import (
	"fmt"
	"os"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/pdfcpu/pdfcpu/pkg/font"
)

func main() {
	fmt.Println("pdfcpu UserFontDir:", font.UserFontDir)

	// Check if font dir exists
	if info, err := os.Stat(font.UserFontDir); err != nil {
		fmt.Printf("  Font dir error: %v\n", err)
	} else {
		fmt.Printf("  Font dir exists: %v (isDir=%v)\n", info.Name(), info.IsDir())
	}

	fmt.Println()
	fmt.Println("Before EnsureFontsInstalled:")
	fmt.Println("  User fonts:", font.UserFontNames())

	err := bookbuild.EnsureFontsInstalled()
	if err != nil {
		fmt.Printf("  EnsureFontsInstalled ERROR: %v\n", err)
	} else {
		fmt.Println("  EnsureFontsInstalled: OK")
	}

	fmt.Println()
	fmt.Println("After EnsureFontsInstalled:")
	fmt.Println("  User fonts:", font.UserFontNames())
}
