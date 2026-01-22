package main

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"os"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go <docx-path>")
		return
	}
	docxPath := os.Args[1]
	r, err := zip.OpenReader(docxPath)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer r.Close()

	var documentFile *zip.File
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			documentFile = f
			break
		}
	}

	if documentFile == nil {
		fmt.Println("No document.xml found")
		return
	}

	rc, _ := documentFile.Open()
	defer rc.Close()

	decoder := xml.NewDecoder(rc)
	inRun := false
	inRunProps := false
	runHasDirectFormat := false
	runDirectTypes := []string{}
	runText := ""
	count := 0

	for {
		tok, err := decoder.Token()
		if err != nil {
			break
		}

		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "r":
				inRun = true
				inRunProps = false
				runHasDirectFormat = false
				runDirectTypes = []string{}
				runText = ""
			case "rPr":
				if inRun {
					inRunProps = true
				}
			case "rStyle":
				// Character style - NOT direct formatting
			case "b", "i", "u", "sz", "color", "rFonts", "highlight", "strike", "dstrike", "vertAlign", "spacing":
				if inRun && inRunProps {
					runHasDirectFormat = true
					runDirectTypes = append(runDirectTypes, t.Name.Local)
				}
			}
		case xml.CharData:
			if inRun {
				runText += string(t)
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "rPr":
				inRunProps = false
			case "r":
				if runHasDirectFormat {
					trimmed := strings.TrimSpace(runText)
					onlyDash := true
					if trimmed != "" {
						for _, r := range trimmed {
							if r != '—' && r != '–' && r != '-' && r != ' ' {
								onlyDash = false
								break
							}
						}
					}
					if !onlyDash {
						count++
						fmt.Printf("Direct #%d: [%s] types=%v\n", count, runText, runDirectTypes)
					} else if trimmed != "" {
						fmt.Printf("Skipped em-dash: [%s] types=%v\n", runText, runDirectTypes)
					}
				}
				inRun = false
			}
		}
	}
	fmt.Printf("\nTotal non-dash direct formatting: %d\n", count)
}
