package bookbuild

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

func IsLandscape(width, height float64) bool {
	return width > height
}

type PageDimensions struct {
	Width    float64
	Height   float64
	Rotation int
}

func (p PageDimensions) EffectiveWidth() float64 {
	if p.Rotation == 90 || p.Rotation == 270 || p.Rotation == -90 {
		return p.Height
	}
	return p.Width
}

func (p PageDimensions) EffectiveHeight() float64 {
	if p.Rotation == 90 || p.Rotation == 270 || p.Rotation == -90 {
		return p.Width
	}
	return p.Height
}

func (p PageDimensions) IsEffectiveLandscape() bool {
	return IsLandscape(p.EffectiveWidth(), p.EffectiveHeight())
}

func GetPageDimensions(pdfPath string, pageNum int) (PageDimensions, error) {
	expanded := ExpandPath(pdfPath)
	ctx, err := api.ReadContextFile(expanded)
	if err != nil {
		return PageDimensions{}, fmt.Errorf("failed to read PDF: %w", err)
	}

	if pageNum < 1 || pageNum > ctx.PageCount {
		return PageDimensions{}, fmt.Errorf("page %d out of range (1-%d)", pageNum, ctx.PageCount)
	}

	pageDict, _, _, err := ctx.PageDict(pageNum, false)
	if err != nil {
		return PageDimensions{}, fmt.Errorf("failed to get page dict: %w", err)
	}

	dims := PageDimensions{
		Width:  612,
		Height: 792,
	}

	mediaBox := pageDict.ArrayEntry("MediaBox")
	if len(mediaBox) >= 4 {
		dims.Width = toFloat64(mediaBox[2]) - toFloat64(mediaBox[0])
		dims.Height = toFloat64(mediaBox[3]) - toFloat64(mediaBox[1])
	}

	if rot := pageDict.IntEntry("Rotate"); rot != nil {
		dims.Rotation = *rot
	}

	return dims, nil
}

func toFloat64(v any) float64 {
	switch n := v.(type) {
	case types.Float:
		return float64(n)
	case types.Integer:
		return float64(n)
	case float64:
		return n
	case int:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}

type PageRotation struct {
	PageNum  int
	Rotation int
}

func RotatePDF(srcPath, dstPath string, rotations []PageRotation) error {
	if len(rotations) == 0 {
		return copyFile(srcPath, dstPath)
	}

	expanded := ExpandPath(srcPath)

	grouped := make(map[int][]string)
	for _, r := range rotations {
		grouped[r.Rotation] = append(grouped[r.Rotation], fmt.Sprintf("%d", r.PageNum))
	}

	if err := copyFile(expanded, dstPath); err != nil {
		return fmt.Errorf("failed to copy source PDF: %w", err)
	}

	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed

	for rotation, pages := range grouped {
		if err := api.RotateFile(dstPath, dstPath, rotation, pages, conf); err != nil {
			return fmt.Errorf("failed to rotate pages: %w", err)
		}
	}

	return nil
}

func RotationForPage(finalPageNum int, isLandscape bool) int {
	if !isLandscape {
		return 0
	}
	if IsRecto(finalPageNum) {
		return -90
	}
	return 90
}

type RotationResult struct {
	OutputPath   string
	WasRotated   bool
	RotatedPages []int
	OriginalPath string
}

func PrepareRotatedPDF(srcPath, buildDir string, startingPageNum int, itemIndex int) (*RotationResult, error) {
	expanded := ExpandPath(srcPath)

	pageCount, err := GetPageCount(expanded)
	if err != nil {
		return nil, fmt.Errorf("failed to get page count: %w", err)
	}

	var rotations []PageRotation
	var rotatedPages []int

	for p := 1; p <= pageCount; p++ {
		dims, err := GetPageDimensions(expanded, p)
		if err != nil {
			return nil, fmt.Errorf("failed to get dimensions for page %d: %w", p, err)
		}

		if dims.IsEffectiveLandscape() {
			finalPageNum := startingPageNum + p - 1
			rotation := RotationForPage(finalPageNum, true)
			rotations = append(rotations, PageRotation{
				PageNum:  p,
				Rotation: rotation,
			})
			rotatedPages = append(rotatedPages, p)
		}
	}

	if len(rotations) == 0 {
		return &RotationResult{
			OutputPath:   expanded,
			WasRotated:   false,
			OriginalPath: srcPath,
		}, nil
	}

	rotatedPath := filepath.Join(buildDir, fmt.Sprintf("rotated_%d.pdf", itemIndex))
	if err := RotatePDF(expanded, rotatedPath, rotations); err != nil {
		return nil, fmt.Errorf("failed to rotate PDF: %w", err)
	}

	return &RotationResult{
		OutputPath:   rotatedPath,
		WasRotated:   true,
		RotatedPages: rotatedPages,
		OriginalPath: srcPath,
	}, nil
}

func CreateTestPortraitPDF(outputPath string) error {
	return CreateBlankPage(outputPath, 432, 648)
}

func CreateTestLandscapePDF(outputPath string) error {
	return CreateBlankPage(outputPath, 648, 432)
}

func CreateTestMixedPDF(outputPath string, pageOrientations []bool) error {
	if len(pageOrientations) == 0 {
		return fmt.Errorf("pageOrientations cannot be empty")
	}

	tempDir, err := os.MkdirTemp("", "mixed-pdf-")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	pdfPaths := make([]string, 0, len(pageOrientations))
	for i, isLandscape := range pageOrientations {
		pagePath := filepath.Join(tempDir, fmt.Sprintf("page_%d.pdf", i+1))
		var w, h float64
		if isLandscape {
			w, h = 648, 432
		} else {
			w, h = 432, 648
		}
		if err := CreateBlankPage(pagePath, w, h); err != nil {
			return fmt.Errorf("failed to create page %d: %w", i+1, err)
		}
		pdfPaths = append(pdfPaths, pagePath)
	}

	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed
	if err := api.MergeCreateFile(pdfPaths, outputPath, false, conf); err != nil {
		return fmt.Errorf("failed to merge pages: %w", err)
	}

	return nil
}
