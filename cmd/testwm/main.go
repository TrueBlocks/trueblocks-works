package main

import (
	"fmt"
	"os"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: testwm <pdf>")
		return
	}
	pdf := os.Args[1]
	out := "/tmp/test_wm.pdf"

	data, err := os.ReadFile(pdf)
	if err != nil {
		fmt.Printf("Read error: %v\n", err)
		return
	}
	if err := os.WriteFile(out, data, 0644); err != nil {
		fmt.Printf("Write error: %v\n", err)
		return
	}

	wm, err := api.TextWatermark("TEST 123",
		"font:Times-Roman, points:24, position:bc, offset:0 50, scale:1 abs, rotation:0, opacity:1",
		true, false, types.POINTS)
	if err != nil {
		fmt.Printf("Watermark error: %v\n", err)
		return
	}

	conf := model.NewDefaultConfiguration()
	err = api.AddWatermarksFile(out, out, []string{"1"}, wm, conf)
	if err != nil {
		fmt.Printf("AddWatermarks error: %v\n", err)
		return
	}

	orig, _ := os.Stat(pdf)
	newf, _ := os.Stat(out)
	fmt.Printf("Original: %d, New: %d, Diff: %d\n", orig.Size(), newf.Size(), newf.Size()-orig.Size())
	fmt.Printf("Output: %s\n", out)
}
