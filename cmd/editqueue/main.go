package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func main() {
	if _, err := os.Stat("files.txt"); os.IsNotExist(err) {
		fmt.Println("Error: files.txt not found in current directory")
		os.Exit(1)
	}

	file, err := os.Open("files.txt")
	if err != nil {
		fmt.Println("Error opening files.txt:", err)
		os.Exit(1)
	}
	defer file.Close()

	var files []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			files = append(files, line)
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Println("Error reading files.txt:", err)
		os.Exit(1)
	}

	if len(files) == 0 {
		fmt.Println("No files found in files.txt")
		os.Exit(0)
	}

	fmt.Printf("Found %d files to edit\n\n", len(files))

	for i, f := range files {
		absPath, err := filepath.Abs(f)
		if err != nil {
			fmt.Printf("[%d/%d] Error resolving path %s: %v\n", i+1, len(files), f, err)
			continue
		}

		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			fmt.Printf("[%d/%d] File not found: %s\n", i+1, len(files), f)
			continue
		}

		fmt.Printf("[%d/%d] Opening: %s\n", i+1, len(files), filepath.Base(f))
		fmt.Println("       Close Word to continue to next file...")

		cmd := exec.Command("open", "-W", "-a", "Microsoft Word", absPath)
		if err := cmd.Run(); err != nil {
			fmt.Printf("       Error: %v\n", err)
		}

		fmt.Println("       Done.\n")
	}

	fmt.Println("All files processed!")
}
