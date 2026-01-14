package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

var buildTime = "unknown"

const numWorkers = 3
const destDir = "Development/trueblocks-art/works/imports/files"

type job struct {
	inputFile   string
	modelPath   string
	destDirPath string
	copyOnly    bool
	noCopy      bool
}

type result struct {
	inputFile string
	err       error
}

func main() {
	if len(os.Args) < 2 || os.Args[1] == "-h" || os.Args[1] == "--help" {
		printHelp()
		if len(os.Args) >= 2 {
			os.Exit(0)
		}
		os.Exit(1)
	}

	// Parse flags
	copyOnly := false
	noCopy := false
	args := os.Args[1:]
	for len(args) > 0 && strings.HasPrefix(args[0], "--") {
		switch args[0] {
		case "--copy-only":
			copyOnly = true
		case "--no-copy":
			noCopy = true
		default:
			fmt.Fprintf(os.Stderr, "Error: unknown flag %s\n", args[0])
			os.Exit(1)
		}
		args = args[1:]
	}
	if copyOnly && noCopy {
		fmt.Fprintf(os.Stderr, "Error: --copy-only and --no-copy are mutually exclusive\n")
		os.Exit(1)
	}
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "Error: at least one file required\n")
		os.Exit(1)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting home directory: %v\n", err)
		os.Exit(1)
	}

	modelPath := ""
	if !copyOnly {
		modelPath = filepath.Join(home, ".cache", "whisper", "ggml-medium.en.bin")
		if _, err := os.Stat(modelPath); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "Error: Whisper model not found at %s\n", modelPath)
			fmt.Fprintf(os.Stderr, "Download it with:\n")
			fmt.Fprintf(os.Stderr, "  curl -L -o ~/.cache/whisper/ggml-medium.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin\n")
			os.Exit(1)
		}
	}

	files := args

	// Validate all input files are in a /Fixed folder
	for _, f := range files {
		absPath, err := filepath.Abs(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: cannot resolve path %s: %v\n", f, err)
			os.Exit(1)
		}
		dir := filepath.Dir(absPath)
		if !strings.HasSuffix(dir, "/Fixed") {
			fmt.Fprintf(os.Stderr, "Error: input files must be in a folder ending with /Fixed\n")
			fmt.Fprintf(os.Stderr, "  Got: %s\n", dir)
			os.Exit(1)
		}
	}

	// Validate destination folder exists and is empty (skip if --no-copy)
	destDirPath := ""
	if !noCopy {
		destDirPath = filepath.Join(home, destDir)
		info, err := os.Stat(destDirPath)
		if os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "Error: destination folder does not exist: %s\n", destDirPath)
			os.Exit(1)
		}
		if !info.IsDir() {
			fmt.Fprintf(os.Stderr, "Error: destination is not a folder: %s\n", destDirPath)
			os.Exit(1)
		}
		entries, err := os.ReadDir(destDirPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: cannot read destination folder: %v\n", err)
			os.Exit(1)
		}
		var visibleFiles int
		for _, e := range entries {
			if !strings.HasPrefix(e.Name(), ".") {
				visibleFiles++
			}
		}
		if visibleFiles > 0 {
			fmt.Fprintf(os.Stderr, "Error: destination folder must be empty: %s\n", destDirPath)
			fmt.Fprintf(os.Stderr, "  Found %d items\n", visibleFiles)
			os.Exit(1)
		}
	}
	fmt.Printf("Processing %d files with %d workers...\n\n", len(files), numWorkers)

	jobs := make(chan job, len(files))
	results := make(chan result, len(files))

	var wg sync.WaitGroup
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go worker(i+1, jobs, results, &wg)
	}

	for _, inputFile := range files {
		jobs <- job{inputFile: inputFile, modelPath: modelPath, destDirPath: destDirPath, copyOnly: copyOnly, noCopy: noCopy}
	}
	close(jobs)

	go func() {
		wg.Wait()
		close(results)
	}()

	type failure struct {
		file string
		err  error
	}

	var succeeded int
	var failures []failure
	for r := range results {
		if r.err != nil {
			fmt.Fprintf(os.Stderr, "❌ %s\n   Error: %v\n", r.inputFile, r.err)
			failures = append(failures, failure{file: r.inputFile, err: r.err})
		} else {
			succeeded++
		}
	}

	fmt.Println()
	if len(failures) == 0 {
		fmt.Printf("✅ Done: %d files transcribed successfully\n", succeeded)
	} else {
		fmt.Printf("⚠️  Done: %d succeeded, %d failed\n\n", succeeded, len(failures))
		fmt.Println("Failed files:")
		for _, f := range failures {
			fmt.Printf("  • %s\n    %v\n", filepath.Base(f.file), f.err)
		}
	}
}

func worker(id int, jobs <-chan job, results chan<- result, wg *sync.WaitGroup) {
	defer wg.Done()
	for j := range jobs {
		err := processFile(j.inputFile, j.modelPath, j.destDirPath, j.copyOnly, j.noCopy, id)
		results <- result{inputFile: j.inputFile, err: err}
	}
}

func processFile(inputFile, modelPath, destDirPath string, copyOnly, noCopy bool, workerID int) error {
	baseName := strings.TrimSuffix(filepath.Base(inputFile), filepath.Ext(inputFile))
	dir := filepath.Dir(inputFile)
	outputDocx := filepath.Join(dir, baseName+".docx")

	var srcModTime time.Time

	if copyOnly {
		// Copy-only mode: just copy existing docx to destination
		info, err := os.Stat(outputDocx)
		if os.IsNotExist(err) {
			return fmt.Errorf("docx not found: %s", outputDocx)
		}
		if err != nil {
			return fmt.Errorf("cannot stat docx: %w", err)
		}
		srcModTime = info.ModTime()
		fmt.Printf("[W%d] Copying: %s\n", workerID, filepath.Base(outputDocx))
	} else {
		// Full transcription mode
		info, err := os.Stat(inputFile)
		if os.IsNotExist(err) {
			return fmt.Errorf("file not found: %s", inputFile)
		}
		if err != nil {
			return fmt.Errorf("cannot stat file: %w", err)
		}
		srcModTime = info.ModTime()

		ext := strings.ToLower(filepath.Ext(inputFile))
		if ext != ".m4a" && ext != ".mp3" && ext != ".wav" {
			return fmt.Errorf("unsupported format: %s (use .m4a, .mp3, or .wav)", ext)
		}

		fmt.Printf("[W%d] Processing: %s\n", workerID, filepath.Base(inputFile))

		tmpWav := filepath.Join(os.TempDir(), fmt.Sprintf("listen_%d_%d.wav", workerID, time.Now().UnixNano()))
		defer os.Remove(tmpWav)

		cmd := exec.Command("ffmpeg", "-y", "-i", inputFile, "-ar", "16000", "-ac", "1", tmpWav)
		cmd.Stderr = nil
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("ffmpeg conversion failed: %w", err)
		}

		var stdout bytes.Buffer
		cmd = exec.Command("whisper-cli", "-m", modelPath, tmpWav)
		cmd.Stdout = &stdout
		cmd.Stderr = nil
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("whisper transcription failed: %w", err)
		}

		transcript := parseWhisperOutput(stdout.String())
		if transcript == "" {
			return fmt.Errorf("no transcription produced")
		}

		recordedDate := extractDateFromFilename(baseName)
		tmpMd := filepath.Join(os.TempDir(), fmt.Sprintf("listen_%d_%d.md", workerID, time.Now().UnixNano()))
		defer os.Remove(tmpMd)

		mdContent := fmt.Sprintf("# %s\n\n**Recorded:** %s\n\n---\n\n%s\n", baseName, recordedDate, transcript)
		if err := os.WriteFile(tmpMd, []byte(mdContent), 0644); err != nil {
			return fmt.Errorf("failed to write markdown: %w", err)
		}

		cmd = exec.Command("pandoc", tmpMd, "-o", outputDocx)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("pandoc conversion failed: %w", err)
		}

		// Set modification time to match source file
		if err := os.Chtimes(outputDocx, srcModTime, srcModTime); err != nil {
			fmt.Printf("  ⚠️  Could not set modification time: %v\n", err)
		}

		// Set creation time using SetFile (macOS specific)
		dateStr := srcModTime.Format("01/02/2006 15:04:05")
		setFileCmd := exec.Command("SetFile", "-d", dateStr, outputDocx)
		if err := setFileCmd.Run(); err != nil {
			fmt.Printf("  ⚠️  Could not set creation time: %v\n", err)
		}
	}

	// Copy to imports/files with renamed format: cEssay Idea - YYYY - Name.docx (skip if --no-copy)
	if !noCopy {
		newName := buildImportFilename(baseName)
		destPath := filepath.Join(destDirPath, newName)
		if err := copyFile(outputDocx, destPath); err != nil {
			return fmt.Errorf("failed to copy to imports: %w", err)
		}

		// Set dates on copied file
		dateStr := srcModTime.Format("01/02/2006 15:04:05")
		if err := os.Chtimes(destPath, srcModTime, srcModTime); err != nil {
			fmt.Printf("  ⚠️  Could not set modification time on copy: %v\n", err)
		}
		setFileCmd := exec.Command("SetFile", "-d", dateStr, destPath)
		if err := setFileCmd.Run(); err != nil {
			fmt.Printf("  ⚠️  Could not set creation time on copy: %v\n", err)
		}
	}

	fmt.Printf("[W%d] ✓ %s\n", workerID, filepath.Base(outputDocx))
	return nil
}

func parseWhisperOutput(output string) string {
	re := regexp.MustCompile(`\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*(.+)`)
	matches := re.FindAllStringSubmatch(output, -1)

	var parts []string
	for _, m := range matches {
		if len(m) > 1 {
			text := strings.TrimSpace(m[1])
			if text != "" {
				parts = append(parts, text)
			}
		}
	}

	return strings.Join(parts, " ")
}

func extractDateFromFilename(baseName string) string {
	re := regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})`)
	matches := re.FindStringSubmatch(baseName)
	if len(matches) == 7 {
		t, err := time.Parse("2006-01-02-15-04-05", matches[0])
		if err == nil {
			return t.Format("January 2, 2006 at 3:04 PM")
		}
	}
	return "Unknown date"
}

func buildImportFilename(baseName string) string {
	re := regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2}) - (.+)$`)
	matches := re.FindStringSubmatch(baseName)
	if len(matches) == 8 {
		year := matches[1]
		name := matches[7]
		return fmt.Sprintf("cEssay Idea - %s - %s.docx", year, name)
	}
	return fmt.Sprintf("cEssay Idea - Unknown - %s.docx", baseName)
}

func copyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, input, 0644)
}

func printHelp() {
	fmt.Printf(`listen - Transcribe audio files to DOCX using whisper-cpp

Usage: listen <file.m4a> [file2.m4a ...]

Description:
  Transcribes audio files (.m4a, .mp3, .wav) to Word documents (.docx).
  Uses whisper-cpp with the medium.en model for transcription.
  Processes files in parallel with %d workers.

Constraints:
  - Input files MUST be in a folder ending with /Fixed
  - Destination folder ~/Development/trueblocks-art/works/imports/files/
    must exist and be empty (unless --no-copy)

Requirements:
  - whisper-cpp (brew install whisper-cpp)
  - ffmpeg (brew install ffmpeg)  
  - pandoc (brew install pandoc)
  - Model file at ~/.cache/whisper/ggml-medium.en.bin

Options:
  -h, --help     Show this help message
  --copy-only    Skip transcription, just copy existing .docx files to destination
  --no-copy      Skip copying to imports/files/, only create local .docx

Output:
  Creates a .docx file in the same directory as the input file.
  Also copies to imports/files/ as: cEssay Idea - YYYY - Name.docx (unless --no-copy)
  All docx files' creation/modification dates match the source audio.

Examples:
  cd ~/path/to/Fixed; listen *.m4a
  cd ~/path/to/Fixed; listen --copy-only *.m4a
  cd ~/path/to/Fixed; listen --no-copy *.m4a

Built: %s
`, numWorkers, buildTime)
}
