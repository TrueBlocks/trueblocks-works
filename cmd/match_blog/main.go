package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	_ "modernc.org/sqlite"
)

type Work struct {
	ID    int
	Title string
	Type  string
	Path  string
}

type Match struct {
	BlogTitle          string
	BlogURL            string
	BlogDate           string // Date extracted from blog post (YYYY-MM-DD)
	WorkID             int
	WorkTitle          string
	WorkPath           string
	Score              float64
	MatchType          string
	IsCriticalAnalysis bool   // For unmatched posts, indicates if it's a critical analysis
	AnalysisSubject    string // What the post is analyzing (if applicable)
}

// Blog title to URL mapping
var blogURLs = map[string]string{
	"This and That and Why Donald Trump is an A-hole":  "http://stonylanepress.org/this-and-that-and-why-donald-trump-is-an-a-hole/",
	"There's Still Hope for Us All":                    "http://stonylanepress.org/theres-still-hope-for-us-all/",
	"Life as a Function":                               "http://stonylanepress.org/life-as-a-function/",
	"Possessives of Company Names Ending with 'x'":     "http://stonylanepress.org/possessives-of-company-names-ending-with-x/",
	"Writing Stats Since Graduating from Rosemont MFA": "http://stonylanepress.org/writing-stats-since-graduating-from-rosemont-mfa/",
	"Great Post":                       "http://stonylanepress.org/great-post/",
	"Filaments":                        "http://stonylanepress.org/filaments/",
	"Prediction":                       "http://stonylanepress.org/prediction/",
	"New Semester at Rosemont College": "http://stonylanepress.org/new-semester-at-rosemont-college/",
	"Beware the Abyss":                 "http://stonylanepress.org/beware-the-abyss/",
	"Rediscovering Nonfiction":         "http://stonylanepress.org/rediscovering-nonfiction/",
	"Two Things That Are Going to or Should Happen":          "http://stonylanepress.org/two-things-that-are-going-to-or-should-happen/",
	"Creative Nonfiction":                                    "http://stonylanepress.org/creative-nonfiction/",
	"My Celebrity Look Alikes":                               "http://stonylanepress.org/my-celebrity-look-alikes/",
	"Starting new semester at Rosemont":                      "http://stonylanepress.org/starting-new-semester-at-rosemont/",
	"Rome and Amalfi":                                        "http://stonylanepress.org/rome-and-amalfi/",
	"Hemingway's Six":                                        "http://stonylanepress.org/hemingways-six/",
	"NaShoWriMay 2011 – II":                                  "http://stonylanepress.org/nashowrimay-2011-ii/",
	"Contents of Blooming Glen, R.I.P.":                      "http://stonylanepress.org/contents-of-blooming-glen-r-i-p/",
	"NaShoWriMay 2011":                                       "http://stonylanepress.org/nanowrimay-20111/",
	"Contents of Short Fiction, Essays and Poetry, May 2011": "http://stonylanepress.org/nanowrimay-2011/",
	"What Was Raymond Carver Talking About?":                 "http://stonylanepress.org/what-was-raymond-carver-talking-about/",
	"T-Shirt Fiction":                                        "http://stonylanepress.org/t-shirt-fiction/",
	"Dancing in the Dark":                                    "http://stonylanepress.org/dancing-in-the-dark/",
	"Charlie's in Trouble – A One Act Play":                  "http://stonylanepress.org/charlies-in-trouble-a-one-act-play/",
	"Contents of Collected Short Stories – November 2010":    "http://stonylanepress.org/table-of-contents-from-my-short-story-collection/",
	"Winner! 2010 NaNoWriMo Winner":                          "http://stonylanepress.org/winner-2010-nanowrimo-winner/",
	"NaNoWriCrap II":                                         "http://stonylanepress.org/nanowrishit-ii/",
	"NaNoWriCrap":                                            "http://stonylanepress.org/nanowrishit/",
	"Double Duty":                                            "http://stonylanepress.org/849/",
	"Scribblefolio":                                          "http://stonylanepress.org/scribofolio/",
	"Inception – The 'Miles incepted Cobb' Theory":           "http://stonylanepress.org/inception-greatest-movie-ever/",
	"I Finished the First Draft of my Second Novel":          "http://stonylanepress.org/new-novel/",
	"Picture Book from Beach Haven, NJ – 2002":               "http://stonylanepress.org/picture-book-from-beach-haven-nj-2002/",
	"I See What I Was Missing":                               "http://stonylanepress.org/i-see/",
	"The Birth of Flash Fiction":                             "http://stonylanepress.org/the-birth-of-flash-fiction/",
	"Semi-comma":                                             "http://stonylanepress.org/semi-comma/",
	"Short Stories Websites and Blogs":                       "http://stonylanepress.org/blogs-devoted-to-short-stories/",
	"Weirdest Spam Ever":                                     "http://stonylanepress.org/weirdest-spam-ever/",
	"Animation of \"Robert Frost is Lazy\"":                  "http://stonylanepress.org/animation-of-robert-frost-is-lazy/",
	"Under Water":                                            "http://stonylanepress.org/under-water/",
	"Animation of 'That Face'":                               "http://stonylanepress.org/animation-of-my-poem-that-face/",
	"What Not To Do With Your Blog":                          "http://stonylanepress.org/what-not-to-do-in-a-blog/",
	"Short and Sweet":                                        "http://stonylanepress.org/292/",
	"A Little Too Cute":                                      "http://stonylanepress.org/a-little-too-cute/",
	"Bad Writers are Easy to Find":                           "http://stonylanepress.org/bad-writers-are-hard-to-find/",
	"Katie is So Funny":                                      "http://stonylanepress.org/katie-is-so-funny/",
	"Deus Ex Machina":                                        "http://stonylanepress.org/deus-ex-machina/",
	"Turning a Phrase":                                       "http://stonylanepress.org/turn-a-phrase-john/",
	"Another Billy Collins Poem":                             "http://stonylanepress.org/another-billy-collins-poem/",
	"Interesting Animated Poem":                              "http://stonylanepress.org/205/",
	"Pillows":                                                "http://stonylanepress.org/pillows/",
	"NaNoWriMo (Nov 13, 2009)":                               "http://stonylanepress.org/nanowrimo-2/",
	"Day #10":                                                "http://stonylanepress.org/day-10/",
	"Day #9":                                                 "http://stonylanepress.org/day-9/",
	"Day #8 (redux)":                                         "http://stonylanepress.org/day-8-redux/",
	"Day #8":                                                 "http://stonylanepress.org/day-8/",
	"Day #7":                                                 "http://stonylanepress.org/day-7-2/",
	"Day #6":                                                 "http://stonylanepress.org/day-7/",
	"NaNoWriMo (Nov 6, 2009)":                                "http://stonylanepress.org/nanowrimo/",
	"Symbolism in the Hands of a Master":                     "http://stonylanepress.org/symbolism_in_the_hands_of_a_master/",
	"Watch the Glue":                                         "http://stonylanepress.org/watch-the-glue/",
	"The Baby Babbles Baba":                                  "http://stonylanepress.org/the-baby-babbles-baba/",
	"The Birth of Emily":                                     "http://stonylanepress.org/the-birth-of-emily-marie-rush/",
	"Dream – March 1991":                                     "http://stonylanepress.org/dream-%e2%80%93-march-1991/",
	"My Brother's Death":                                     "http://stonylanepress.org/my-brother%e2%80%99s-death/",
}

func main() {
	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting home dir: %v\n", err)
		os.Exit(1)
	}

	// Read blog titles
	blogTitles, err := readBlogTitles("data/blog-post-titles.txt")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading blog titles: %v\n", err)
		os.Exit(1)
	}

	// Open database
	dbPath := filepath.Join(home, ".works", "works.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Get all works
	works, err := getAllWorks(db)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting works: %v\n", err)
		os.Exit(1)
	}

	// Manual matches for titles with parenthetical notes or different naming
	manualMatches := map[string]string{
		"A Little Too Cute":                               "Chopin - The Story of an Hour (A Little Too Cute)",
		"Bad Writers are Easy to Find":                    "Asimov - The Fun They Had (Bad Writers are Hard to Find)",
		"Symbolism in the Hands of a Master":              "Hemmingway - Hills Like White Elephants (Symbolism in the Hands of a Master)",
		"This and That and Why Donald Trump is an A-hole": "This and That and Why Donald Trump is an Asshole",
		"What Was Raymond Carver Talking About?":          "What is Raymond Carver Talking About",
		"The Birth of Emily":                              "Emily's Birth",
		"Dancing in the Dark":                             "Carver - Why Don't You Dance",
		"The Birth of Flash Fiction":                      "Thurber - The Little Girl and the Wolf (The Birth of Flash Fiction)",
		"Katie is So Funny":                               "Katie is so Funny",
		"Semi-comma":                                      "Semi-Comma",
		"Picture Book from Beach Haven, NJ – 2002":        "Our Trip to Beach Haven, NJ",
	}

	// Work IDs that are false positives - should not be matched
	excludedWorkIDs := map[int]bool{
		3587:  true,
		3545:  true,
		21832: true,
		21545: true,
		21045: true,
		3023:  true,
		3372:  true,
		23606: true,
		21086: true,
	}

	// Manual dates for posts where date extraction doesn't work
	manualDates := map[string]string{
		"Writing Stats Since Graduating from Rosemont MFA": "2015-01-16",
	}

	// Posts that should not be downloaded (not original content)
	doNotDownload := map[string]bool{
		"Another Billy Collins Poem":                             true,
		"Interesting Animated Poem":                              true,
		"Animation of 'That Face'":                               true,
		"Short Stories Websites and Blogs":                       true,
		"Contents of Collected Short Stories – November 2010":    true,
		"Contents of Short Fiction, Essays and Poetry, May 2011": true,
		"Hemingway's Six":                                        true,
		"My Celebrity Look Alikes":                               true,
		"Great Post":                                             true,
		"Writing Stats Since Graduating from Rosemont MFA":       true,
		"There's Still Hope for Us All":                          true,
	}

	// Already processed - skip entirely (already in database with correct match)
	alreadyProcessed := map[string]bool{
		"Pillows":                       true,
		"Deus Ex Machina":               true,
		"What Not To Do With Your Blog": true,
		"Weirdest Spam Ever":            true,
		"I Finished the First Draft of my Second Novel": true,
		"Scribblefolio":                                 true,
		"Winner! 2010 NaNoWriMo Winner":                 true,
		"T-Shirt Fiction":                               true,
		"Rome and Amalfi":                               true,
		"Starting new semester at Rosemont":             true,
		"Two Things That Are Going to or Should Happen": true,
		"New Semester at Rosemont College":              true,
		"Possessives of Company Names Ending with 'x'":  true,
		"Contents of Blooming Glen, R.I.P.":             true,
	}

	// Build work title lookup
	workByTitle := make(map[string]Work)
	for _, w := range works {
		workByTitle[w.Title] = w
	}

	// Find matches and non-matches
	var matches []Match
	var noMatches []Match
	var skipped []string
	for _, blogTitle := range blogTitles {
		// Skip already processed posts - already in database
		if alreadyProcessed[blogTitle] {
			skipped = append(skipped, blogTitle)
			continue
		}

		// Skip Day # posts - they won't match anything
		if strings.HasPrefix(blogTitle, "Day #") {
			skipped = append(skipped, blogTitle)
			continue
		}

		// Skip NaNo posts - they won't match anything meaningful
		if strings.HasPrefix(blogTitle, "NaNo") || strings.HasPrefix(blogTitle, "NaSho") {
			skipped = append(skipped, blogTitle)
			continue
		}

		// Check for manual match first
		if workTitle, ok := manualMatches[blogTitle]; ok {
			if w, found := workByTitle[workTitle]; found {
				matches = append(matches, Match{
					BlogTitle: blogTitle,
					BlogURL:   blogURLs[blogTitle],
					WorkID:    w.ID,
					WorkTitle: w.Title,
					WorkPath:  w.Path,
					Score:     1.0,
					MatchType: "manual",
				})
				continue
			} else {
				// Manual match to a work not yet in database
				matches = append(matches, Match{
					BlogTitle: blogTitle,
					BlogURL:   blogURLs[blogTitle],
					WorkID:    0,
					WorkTitle: workTitle + " (pending import)",
					WorkPath:  "",
					Score:     1.0,
					MatchType: "manual",
				})
				continue
			}
		}

		match := findBestMatch(blogTitle, works)
		match.BlogURL = blogURLs[blogTitle]
		// Check if this is a false positive match
		if excludedWorkIDs[match.WorkID] {
			noMatches = append(noMatches, match)
		} else if match.Score >= 0.5 {
			matches = append(matches, match)
		} else {
			noMatches = append(noMatches, match)
		}
	}

	if len(skipped) > 0 {
		fmt.Printf("Skipped %d 'Day #' and 'NaNo' posts\n", len(skipped))
	}

	// Build list of Review works for second-pass matching (critical analysis posts)
	var reviewWorks []Work
	for _, w := range works {
		if w.Type == "Review" {
			reviewWorks = append(reviewWorks, w)
		}
	}

	// Second pass: check noMatches for critical analysis posts and fetch dates
	fmt.Printf("Checking %d unmatched posts for critical analyses and dates...\n", len(noMatches))
	var stillNoMatch []Match
	critiqueMatches := 0
	for _, m := range noMatches {
		if m.BlogURL == "" {
			stillNoMatch = append(stillNoMatch, m)
			continue
		}

		// Fetch blog content for date and critical analysis
		blogDate, critiqueOf := fetchBlogInfo(m.BlogURL)
		// Use manual date if available
		if manualDate, ok := manualDates[m.BlogTitle]; ok {
			blogDate = manualDate
		}
		m.BlogDate = blogDate

		if critiqueOf == "" {
			stillNoMatch = append(stillNoMatch, m)
			continue
		}

		// Try to match against Review works
		critiqueMatch := findBestCritiqueMatch(critiqueOf, reviewWorks)
		if critiqueMatch.Score >= 0.4 {
			critiqueMatch.BlogTitle = m.BlogTitle
			critiqueMatch.BlogURL = m.BlogURL
			critiqueMatch.BlogDate = blogDate
			critiqueMatch.MatchType = "critique"
			matches = append(matches, critiqueMatch)
			critiqueMatches++
			fmt.Printf("  Found critique match: %q -> %q (%.2f)\n", m.BlogTitle, critiqueMatch.WorkTitle, critiqueMatch.Score)
		} else {
			// It's a critical analysis but no matching work found
			m.IsCriticalAnalysis = true
			m.AnalysisSubject = critiqueOf
			stillNoMatch = append(stillNoMatch, m)
		}
	}
	noMatches = stillNoMatch
	if critiqueMatches > 0 {
		fmt.Printf("Found %d critique matches\n", critiqueMatches)
	}

	// Sort non-matches: critical analyses first, then by full date, then alphabetically
	sort.Slice(noMatches, func(i, j int) bool {
		if noMatches[i].IsCriticalAnalysis != noMatches[j].IsCriticalAnalysis {
			return noMatches[i].IsCriticalAnalysis
		}
		// Sort by full date (YYYY-MM-DD)
		if noMatches[i].BlogDate != noMatches[j].BlogDate {
			return noMatches[i].BlogDate < noMatches[j].BlogDate
		}
		return noMatches[i].BlogTitle < noMatches[j].BlogTitle
	})

	// Sort matches by folder, then filename
	sort.Slice(matches, func(i, j int) bool {
		folderI := filepath.Dir(matches[i].WorkPath)
		folderJ := filepath.Dir(matches[j].WorkPath)
		if folderI != folderJ {
			return folderI < folderJ
		}
		filenameI := filepath.Base(matches[i].WorkPath)
		filenameJ := filepath.Base(matches[j].WorkPath)
		return filenameI < filenameJ
	})

	// Write matches HTML
	previewPath := filepath.Join(home, ".works", "previews")
	matchesHTML := buildMatchesHTML(matches, previewPath)
	if err := os.WriteFile("data/blog-matches.html", []byte(matchesHTML), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing matches file: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Wrote data/blog-matches.html")

	// Separate do-not-download items from regular non-matches
	var regularNoMatches []Match
	var skipItems []Match
	for _, m := range noMatches {
		if doNotDownload[m.BlogTitle] {
			skipItems = append(skipItems, m)
		} else {
			regularNoMatches = append(regularNoMatches, m)
		}
	}

	// Write non-matches HTML (without do-not-download items)
	noMatchesHTML := buildNoMatchesHTML(regularNoMatches)
	if err := os.WriteFile("data/blog-not-matches.html", []byte(noMatchesHTML), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing non-matches file: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Wrote data/blog-not-matches.html")

	// Write do-not-download HTML
	doNotDownloadHTML := buildDoNotDownloadHTML(skipItems)
	if err := os.WriteFile("data/do-not-download.html", []byte(doNotDownloadHTML), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing do-not-download file: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Wrote data/do-not-download.html")

	fmt.Printf("---\nTotal blog titles: %d\n", len(blogTitles))
	fmt.Printf("Matches found (score >= 0.5): %d\n", len(matches))
	fmt.Printf("No match: %d\n", len(regularNoMatches))
	fmt.Printf("Do not download: %d\n", len(skipItems))
}

func readBlogTitles(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var titles []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			titles = append(titles, line)
		}
	}
	return titles, scanner.Err()
}

func getAllWorks(db *sql.DB) ([]Work, error) {
	rows, err := db.Query("SELECT workID, title, COALESCE(type, ''), COALESCE(path, '') FROM Works")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var works []Work
	for rows.Next() {
		var w Work
		if err := rows.Scan(&w.ID, &w.Title, &w.Type, &w.Path); err != nil {
			return nil, err
		}
		works = append(works, w)
	}
	return works, rows.Err()
}

func findBestMatch(blogTitle string, works []Work) Match {
	best := Match{BlogTitle: blogTitle, Score: 0}

	blogNorm := normalize(blogTitle)

	for _, w := range works {
		workNorm := normalize(w.Title)

		// Exact match
		if blogNorm == workNorm {
			return Match{
				BlogTitle: blogTitle,
				WorkID:    w.ID,
				WorkTitle: w.Title,
				WorkPath:  w.Path,
				Score:     1.0,
				MatchType: "exact",
			}
		}

		// Contains match
		if strings.Contains(workNorm, blogNorm) || strings.Contains(blogNorm, workNorm) {
			score := float64(min(len(blogNorm), len(workNorm))) / float64(max(len(blogNorm), len(workNorm)))
			if score > best.Score {
				best = Match{
					BlogTitle: blogTitle,
					WorkID:    w.ID,
					WorkTitle: w.Title,
					WorkPath:  w.Path,
					Score:     score,
					MatchType: "contains",
				}
			}
			continue
		}

		// Levenshtein-based similarity
		score := similarity(blogNorm, workNorm)
		if score > best.Score {
			best = Match{
				BlogTitle: blogTitle,
				WorkID:    w.ID,
				WorkTitle: w.Title,
				WorkPath:  w.Path,
				Score:     score,
				MatchType: "fuzzy",
			}
		}
	}

	return best
}

func normalize(s string) string {
	s = strings.ToLower(s)
	var result strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' {
			result.WriteRune(r)
		}
	}
	return strings.Join(strings.Fields(result.String()), " ")
}

func similarity(a, b string) float64 {
	if a == b {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}

	dist := levenshtein(a, b)
	maxLen := max(len(a), len(b))
	return 1.0 - float64(dist)/float64(maxLen)
}

func levenshtein(a, b string) int {
	if len(a) == 0 {
		return len(b)
	}
	if len(b) == 0 {
		return len(a)
	}

	prev := make([]int, len(b)+1)
	curr := make([]int, len(b)+1)

	for j := range prev {
		prev[j] = j
	}

	for i := 1; i <= len(a); i++ {
		curr[0] = i
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			curr[j] = min(
				prev[j]+1,
				curr[j-1]+1,
				prev[j-1]+cost,
			)
		}
		prev, curr = curr, prev
	}

	return prev[len(b)]
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func htmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func buildMatchesHTML(matches []Match, previewPath string) string {
	var b strings.Builder
	b.WriteString(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog Post Matches</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; background: #f5f5f5; }
        h1 { color: #333; }
        p { color: #666; }
        table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
        th { background: #4a5568; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        tr:hover { background: #e8f4ff; }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .score { font-family: monospace; }
        .match-exact { color: #059669; font-weight: bold; }
        .match-manual { color: #7c3aed; font-weight: bold; }
        .match-critique { color: #0891b2; font-weight: bold; }
        .match-contains { color: #d97706; }
        .match-fuzzy { color: #6b7280; }
        .total { margin-top: 1rem; font-weight: bold; color: #333; }
    </style>
</head>
<body>
    <h1>Blog Post Matches</h1>
    <p>Blog posts from stonylanepress.org that match works in the database.</p>
    <table>
        <tr>
            <th>Blog Title</th>
            <th>Work Title (Preview)</th>
            <th>Folder</th>
            <th>Filename</th>
        </tr>
`)
	for _, m := range matches {
		blogLink := fmt.Sprintf(`<a href="%s" target="_blank">%s</a>`, m.BlogURL, htmlEscape(m.BlogTitle))
		pdfPath := filepath.Join(previewPath, fmt.Sprintf("%d.pdf", m.WorkID))
		workLink := htmlEscape(truncate(m.WorkTitle, 50))
		if _, err := os.Stat(pdfPath); err == nil {
			workLink = fmt.Sprintf(`<a href="file://%s" target="_blank">%s</a>`, pdfPath, htmlEscape(truncate(m.WorkTitle, 50)))
		}
		folder := "-"
		filename := "-"
		if m.WorkPath != "" {
			folder = filepath.Dir(m.WorkPath)
			filename = filepath.Base(m.WorkPath)
			if folder == "." {
				folder = "-"
			}
		}
		b.WriteString(fmt.Sprintf(`        <tr>
            <td>%s</td>
            <td>%s</td>
            <td>%s</td>
            <td>%s</td>
        </tr>
`, blogLink, workLink, htmlEscape(folder), htmlEscape(filename)))
	}
	b.WriteString(fmt.Sprintf(`    </table>
    <p class="total">Total matches: %d</p>
</body>
</html>
`, len(matches)))
	return b.String()
}

func buildNoMatchesHTML(noMatches []Match) string {
	var b strings.Builder
	b.WriteString(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog Posts Without Matches</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; background: #f5f5f5; }
        h1 { color: #333; }
        p { color: #666; }
        table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
        th { background: #4a5568; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        tr:hover { background: #e8f4ff; }
        tr.year-separator { background: #e5e7eb; height: 8px; }
        tr.year-separator:hover { background: #e5e7eb; }
        tr.critical-analysis { background: #fef3c7; }
        tr.critical-analysis:hover { background: #fde68a; }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .analysis-type { color: #b45309; font-weight: bold; }
        .date { font-family: monospace; color: #6b7280; }
        .total { margin-top: 1rem; font-weight: bold; color: #333; }
    </style>
</head>
<body>
    <h1>Blog Posts Without Matches</h1>
    <p>Blog posts from stonylanepress.org that don't have a matching work in the database. Critical analyses are listed first, then sorted by date.</p>
    <table>
        <tr>
            <th>#</th>
            <th>Date</th>
            <th>Blog Title</th>
            <th>Type</th>
            <th>Subject</th>
        </tr>
`)
	prevYear := ""
	for i, m := range noMatches {
		// Extract year from date (YYYY-MM-DD format)
		currentYear := ""
		if len(m.BlogDate) >= 4 {
			currentYear = m.BlogDate[:4]
		}
		// Insert blank separator row when year changes
		if prevYear != "" && currentYear != "" && currentYear != prevYear {
			b.WriteString(`        <tr class="year-separator"><td colspan="5"></td></tr>
`)
		}
		prevYear = currentYear

		blogLink := fmt.Sprintf(`<a href="%s" target="_blank">%s</a>`, m.BlogURL, htmlEscape(m.BlogTitle))
		rowClass := ""
		analysisType := ""
		subject := ""
		if m.IsCriticalAnalysis {
			rowClass = ` class="critical-analysis"`
			analysisType = `<span class="analysis-type">Critical Analysis</span>`
			subject = htmlEscape(m.AnalysisSubject)
		}
		dateDisplay := m.BlogDate
		if dateDisplay == "" {
			dateDisplay = "-"
		}
		b.WriteString(fmt.Sprintf(`        <tr%s>
            <td>%d</td>
            <td class="date">%s</td>
            <td>%s</td>
            <td>%s</td>
            <td>%s</td>
        </tr>
`, rowClass, i+1, dateDisplay, blogLink, analysisType, subject))
	}
	b.WriteString(fmt.Sprintf(`    </table>
    <p class="total">Total unmatched: %d</p>
</body>
</html>
`, len(noMatches)))
	return b.String()
}

func buildDoNotDownloadHTML(items []Match) string {
	var b strings.Builder
	b.WriteString(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog Posts - Do Not Download</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; background: #f5f5f5; }
        h1 { color: #333; }
        p { color: #666; }
        table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
        th { background: #dc2626; color: white; }
        tr:nth-child(even) { background: #fef2f2; }
        tr:hover { background: #fee2e2; }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .date { font-family: monospace; color: #6b7280; }
        .total { margin-top: 1rem; font-weight: bold; color: #333; }
    </style>
</head>
<body>
    <h1>Blog Posts - Do Not Download</h1>
    <p>Blog posts that are not original content and should not be imported into the Works database.</p>
    <table>
        <tr>
            <th>#</th>
            <th>Date</th>
            <th>Blog Title</th>
        </tr>
`)
	for i, m := range items {
		blogLink := fmt.Sprintf(`<a href="%s" target="_blank">%s</a>`, m.BlogURL, htmlEscape(m.BlogTitle))
		dateDisplay := m.BlogDate
		if dateDisplay == "" {
			dateDisplay = "-"
		}
		b.WriteString(fmt.Sprintf(`        <tr>
            <td>%d</td>
            <td class="date">%s</td>
            <td>%s</td>
        </tr>
`, i+1, dateDisplay, blogLink))
	}
	b.WriteString(fmt.Sprintf(`    </table>
    <p class="total">Total: %d</p>
</body>
</html>
`, len(items)))
	return b.String()
}

// fetchBlogInfo fetches the blog post and extracts the date and critical analysis subject
func fetchBlogInfo(url string) (date string, critiqueOf string) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	// Read first 15KB of content
	body, err := io.ReadAll(io.LimitReader(resp.Body, 15*1024))
	if err != nil {
		return "", ""
	}

	content := string(body)

	// Extract date from <time class="entry-date" datetime="2010-02-05T15:01:54+00:00">
	datePattern := `<time[^>]*datetime="(\d{4}-\d{2}-\d{2})T[^"]*"`
	dateRe := regexp.MustCompile(datePattern)
	if matches := dateRe.FindStringSubmatch(content); len(matches) > 1 {
		date = matches[1]
	}

	// The blog format is:
	//   A Critical Analysis of<br />
	//   Author's Short Story<br />
	//   Title<br />
	// We need to extract "Title"

	// Pattern to match the full block and capture the title (third line)
	pattern := `(?i)A Critical Analysis of\s*<br\s*/?>\s*[^<]+(?:Short Story|Essay|Poem|Novel)[^<]*<br\s*/?>\s*([^<\n]+)`
	re := regexp.MustCompile(pattern)
	if matches := re.FindStringSubmatch(content); len(matches) > 1 {
		result := strings.TrimSpace(matches[1])
		// Clean up any remaining HTML entities
		result = strings.ReplaceAll(result, "&#8217;", "'")
		result = strings.ReplaceAll(result, "&#8220;", "\"")
		result = strings.ReplaceAll(result, "&#8221;", "\"")
		if result != "" && len(result) > 3 {
			critiqueOf = result
		}
	}

	return date, critiqueOf
}

// extractDay extracts the day (DD) from a date string (YYYY-MM-DD)
// func extractDay(date string) string {
// 	if len(date) >= 10 {
// 		return date[8:10]
// 	}
// 	return "99" // Sort unknown dates last
// }

// findBestCritiqueMatch finds the best match among Review works
func findBestCritiqueMatch(subject string, reviewWorks []Work) Match {
	best := Match{Score: 0}
	subjectNorm := normalize(subject)

	for _, w := range reviewWorks {
		workNorm := normalize(w.Title)

		// Check if subject is contained in work title - this is a strong match
		if strings.Contains(workNorm, subjectNorm) && len(subjectNorm) >= 5 {
			// Use a high base score for contains matches, adjusted by coverage
			coverage := float64(len(subjectNorm)) / float64(len(workNorm))
			score := 0.7 + (0.3 * coverage) // Score ranges from 0.7 to 1.0
			if score > best.Score {
				best = Match{
					WorkID:    w.ID,
					WorkTitle: w.Title,
					WorkPath:  w.Path,
					Score:     score,
				}
			}
			continue
		}

		// Fuzzy match
		score := similarity(subjectNorm, workNorm)
		if score > best.Score {
			best = Match{
				WorkID:    w.ID,
				WorkTitle: w.Title,
				WorkPath:  w.Path,
				Score:     score,
			}
		}
	}

	return best
}
