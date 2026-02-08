package bookbuild

import (
	"os"
	"path/filepath"
	"testing"
)

func TestIsLandscape(t *testing.T) {
	tests := []struct {
		name     string
		width    float64
		height   float64
		expected bool
	}{
		{"portrait 6x9", 432, 648, false},
		{"landscape 9x6", 648, 432, true},
		{"square", 500, 500, false},
		{"letter portrait", 612, 792, false},
		{"letter landscape", 792, 612, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsLandscape(tt.width, tt.height)
			if result != tt.expected {
				t.Errorf("IsLandscape(%v, %v) = %v, want %v", tt.width, tt.height, result, tt.expected)
			}
		})
	}
}

func TestPageDimensionsEffective(t *testing.T) {
	tests := []struct {
		name              string
		dims              PageDimensions
		expectedWidth     float64
		expectedHeight    float64
		expectedLandscape bool
	}{
		{
			name:              "portrait no rotation",
			dims:              PageDimensions{Width: 432, Height: 648, Rotation: 0},
			expectedWidth:     432,
			expectedHeight:    648,
			expectedLandscape: false,
		},
		{
			name:              "landscape no rotation",
			dims:              PageDimensions{Width: 648, Height: 432, Rotation: 0},
			expectedWidth:     648,
			expectedHeight:    432,
			expectedLandscape: true,
		},
		{
			name:              "portrait with 90 rotation appears landscape",
			dims:              PageDimensions{Width: 432, Height: 648, Rotation: 90},
			expectedWidth:     648,
			expectedHeight:    432,
			expectedLandscape: true,
		},
		{
			name:              "landscape with 90 rotation appears portrait",
			dims:              PageDimensions{Width: 648, Height: 432, Rotation: 90},
			expectedWidth:     432,
			expectedHeight:    648,
			expectedLandscape: false,
		},
		{
			name:              "portrait with 270 rotation appears landscape",
			dims:              PageDimensions{Width: 432, Height: 648, Rotation: 270},
			expectedWidth:     648,
			expectedHeight:    432,
			expectedLandscape: true,
		},
		{
			name:              "portrait with -90 rotation appears landscape",
			dims:              PageDimensions{Width: 432, Height: 648, Rotation: -90},
			expectedWidth:     648,
			expectedHeight:    432,
			expectedLandscape: true,
		},
		{
			name:              "portrait with 180 rotation stays portrait",
			dims:              PageDimensions{Width: 432, Height: 648, Rotation: 180},
			expectedWidth:     432,
			expectedHeight:    648,
			expectedLandscape: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if w := tt.dims.EffectiveWidth(); w != tt.expectedWidth {
				t.Errorf("EffectiveWidth() = %v, want %v", w, tt.expectedWidth)
			}
			if h := tt.dims.EffectiveHeight(); h != tt.expectedHeight {
				t.Errorf("EffectiveHeight() = %v, want %v", h, tt.expectedHeight)
			}
			if l := tt.dims.IsEffectiveLandscape(); l != tt.expectedLandscape {
				t.Errorf("IsEffectiveLandscape() = %v, want %v", l, tt.expectedLandscape)
			}
		})
	}
}

func TestRotationForPage(t *testing.T) {
	tests := []struct {
		name        string
		pageNum     int
		isLandscape bool
		expected    int
	}{
		{"portrait page 1", 1, false, 0},
		{"portrait page 2", 2, false, 0},
		{"landscape page 1 (recto)", 1, true, -90},
		{"landscape page 2 (verso)", 2, true, 90},
		{"landscape page 3 (recto)", 3, true, -90},
		{"landscape page 4 (verso)", 4, true, 90},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := RotationForPage(tt.pageNum, tt.isLandscape)
			if result != tt.expected {
				t.Errorf("RotationForPage(%d, %v) = %d, want %d", tt.pageNum, tt.isLandscape, result, tt.expected)
			}
		})
	}
}

func TestGetPageDimensions(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "rotate-test-")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	t.Run("portrait PDF", func(t *testing.T) {
		path := filepath.Join(tempDir, "portrait.pdf")
		if err := CreateTestPortraitPDF(path); err != nil {
			t.Fatalf("failed to create portrait PDF: %v", err)
		}

		dims, err := GetPageDimensions(path, 1)
		if err != nil {
			t.Fatalf("GetPageDimensions failed: %v", err)
		}

		if dims.Width != 432 || dims.Height != 648 {
			t.Errorf("expected 432x648, got %vx%v", dims.Width, dims.Height)
		}
		if dims.IsEffectiveLandscape() {
			t.Error("portrait PDF should not be effective landscape")
		}
	})

	t.Run("landscape PDF", func(t *testing.T) {
		path := filepath.Join(tempDir, "landscape.pdf")
		if err := CreateTestLandscapePDF(path); err != nil {
			t.Fatalf("failed to create landscape PDF: %v", err)
		}

		dims, err := GetPageDimensions(path, 1)
		if err != nil {
			t.Fatalf("GetPageDimensions failed: %v", err)
		}

		if dims.Width != 648 || dims.Height != 432 {
			t.Errorf("expected 648x432, got %vx%v", dims.Width, dims.Height)
		}
		if !dims.IsEffectiveLandscape() {
			t.Error("landscape PDF should be effective landscape")
		}
	})

	t.Run("mixed PDF", func(t *testing.T) {
		path := filepath.Join(tempDir, "mixed.pdf")
		if err := CreateTestMixedPDF(path, []bool{false, true, false}); err != nil {
			t.Fatalf("failed to create mixed PDF: %v", err)
		}

		dims1, err := GetPageDimensions(path, 1)
		if err != nil {
			t.Fatalf("GetPageDimensions page 1 failed: %v", err)
		}
		if dims1.IsEffectiveLandscape() {
			t.Error("page 1 should be portrait")
		}

		dims2, err := GetPageDimensions(path, 2)
		if err != nil {
			t.Fatalf("GetPageDimensions page 2 failed: %v", err)
		}
		if !dims2.IsEffectiveLandscape() {
			t.Error("page 2 should be landscape")
		}

		dims3, err := GetPageDimensions(path, 3)
		if err != nil {
			t.Fatalf("GetPageDimensions page 3 failed: %v", err)
		}
		if dims3.IsEffectiveLandscape() {
			t.Error("page 3 should be portrait")
		}
	})

	t.Run("invalid page number", func(t *testing.T) {
		path := filepath.Join(tempDir, "portrait.pdf")
		_, err := GetPageDimensions(path, 5)
		if err == nil {
			t.Error("expected error for invalid page number")
		}
	})
}

func TestRotatePDF(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "rotate-test-")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	t.Run("rotate landscape to portrait", func(t *testing.T) {
		srcPath := filepath.Join(tempDir, "landscape_src.pdf")
		dstPath := filepath.Join(tempDir, "landscape_rotated.pdf")

		if err := CreateTestLandscapePDF(srcPath); err != nil {
			t.Fatalf("failed to create landscape PDF: %v", err)
		}

		rotations := []PageRotation{{PageNum: 1, Rotation: 90}}
		if err := RotatePDF(srcPath, dstPath, rotations); err != nil {
			t.Fatalf("RotatePDF failed: %v", err)
		}

		dims, err := GetPageDimensions(dstPath, 1)
		if err != nil {
			t.Fatalf("GetPageDimensions failed: %v", err)
		}

		if dims.IsEffectiveLandscape() {
			t.Error("rotated page should now be effectively portrait")
		}
	})

	t.Run("no rotations copies file", func(t *testing.T) {
		srcPath := filepath.Join(tempDir, "portrait_src.pdf")
		dstPath := filepath.Join(tempDir, "portrait_copy.pdf")

		if err := CreateTestPortraitPDF(srcPath); err != nil {
			t.Fatalf("failed to create portrait PDF: %v", err)
		}

		if err := RotatePDF(srcPath, dstPath, nil); err != nil {
			t.Fatalf("RotatePDF failed: %v", err)
		}

		if _, err := os.Stat(dstPath); os.IsNotExist(err) {
			t.Error("destination file should exist")
		}

		dims, err := GetPageDimensions(dstPath, 1)
		if err != nil {
			t.Fatalf("GetPageDimensions failed: %v", err)
		}

		if dims.IsEffectiveLandscape() {
			t.Error("copied portrait should still be portrait")
		}
	})

	t.Run("rotate mixed PDF selective pages", func(t *testing.T) {
		srcPath := filepath.Join(tempDir, "mixed_src.pdf")
		dstPath := filepath.Join(tempDir, "mixed_rotated.pdf")

		if err := CreateTestMixedPDF(srcPath, []bool{false, true, true, false}); err != nil {
			t.Fatalf("failed to create mixed PDF: %v", err)
		}

		rotations := []PageRotation{
			{PageNum: 2, Rotation: 90},
			{PageNum: 3, Rotation: -90},
		}
		if err := RotatePDF(srcPath, dstPath, rotations); err != nil {
			t.Fatalf("RotatePDF failed: %v", err)
		}

		dims1, _ := GetPageDimensions(dstPath, 1)
		if dims1.IsEffectiveLandscape() {
			t.Error("page 1 should remain portrait")
		}

		dims2, _ := GetPageDimensions(dstPath, 2)
		if dims2.IsEffectiveLandscape() {
			t.Error("page 2 should now be effectively portrait after rotation")
		}

		dims3, _ := GetPageDimensions(dstPath, 3)
		if dims3.IsEffectiveLandscape() {
			t.Error("page 3 should now be effectively portrait after rotation")
		}

		dims4, _ := GetPageDimensions(dstPath, 4)
		if dims4.IsEffectiveLandscape() {
			t.Error("page 4 should remain portrait")
		}
	})
}
