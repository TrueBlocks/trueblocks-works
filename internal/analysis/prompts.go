package analysis

import (
	"fmt"
	"strings"
)

// WorkAnalysisPrompt generates the prompt for analyzing a work
func WorkAnalysisPrompt(title string, workType string, text string) string {
	genreMode := inferGenreMode(workType)

	return fmt.Sprintf(`You are an expert literary editor analyzing a creative work. Provide a detailed critique following this exact JSON structure.

WORK TITLE: %s
GENRE MODE: %s

TEXT TO ANALYZE:
---
%s
---

Analyze this work and respond with ONLY valid JSON in this exact format:
{
    "genre_mode": "%s",
    "technical": {
        "score": <1-10>,
        "summary": "<2-3 sentences summarizing technical quality>",
        "annotations": [
            {
                "paragraph_num": <1-indexed paragraph number>,
                "text_snippet": "<20-50 chars of the issue text>",
                "issue_type": "grammar|spelling|punctuation|word_choice",
                "message": "<specific feedback>",
                "score_impact": <-1 to -3>
            }
        ]
    },
    "style": {
        "score": <1-10>,
        "summary": "<2-3 sentences on style>",
        "annotations": [...]
    },
    "structure": {
        "score": <1-10>,
        "summary": "<2-3 sentences on structure>",
        "annotations": [...]
    },
    "content": {
        "score": <1-10>,
        "summary": "<2-3 sentences on content quality>",
        "annotations": [...]
    },
    "genre": {
        "score": <1-10>,
        "summary": "<2-3 sentences on genre-specific elements>",
        "annotations": [...]
    },
    "overall_summary": "<1 paragraph overall assessment>"
}

SCORING GUIDE:
- 9-10: Publication-ready, exceptional quality
- 7-8: Strong work, minor revisions needed
- 5-6: Solid foundation, moderate revisions needed
- 3-4: Significant issues, major revision required
- 1-2: Fundamental problems throughout

For %s specifically, focus on:
%s`, title, genreMode, text, genreMode, genreMode, genreFocus(genreMode))
}

func inferGenreMode(workType string) GenreMode {
	t := strings.ToLower(workType)
	switch {
	case strings.Contains(t, "poem"):
		return GenrePoetry
	case strings.Contains(t, "essay"), strings.Contains(t, "article"):
		return GenreNonfiction
	default:
		return GenreFiction
	}
}

func genreFocus(mode GenreMode) string {
	switch mode {
	case GenrePoetry:
		return `- Sound devices (alliteration, assonance, rhyme)
- Line breaks and enjambment
- Compression and economy of language
- Imagery and metaphor
- Rhythm and meter`
	case GenreNonfiction:
		return `- Argument clarity and logic
- Evidence and support
- Thesis development
- Transitions and flow
- Credibility and voice`
	default:
		return `- Character development and voice
- Dialogue authenticity
- Scene construction
- Show vs. tell balance
- Narrative tension`
	}
}

// CollectionAnalysisPrompt generates the prompt for collection-level analysis
func CollectionAnalysisPrompt(collectionName string, workSummaries []WorkSummary) string {
	var sb strings.Builder
	for i, w := range workSummaries {
		sb.WriteString(fmt.Sprintf("%d. %s (%s)\n   First 100 words: %s\n\n", i+1, w.Title, w.Type, w.Preview))
	}

	return fmt.Sprintf(`You are an expert literary editor analyzing a collection of works for publication. Evaluate the collection as a whole.

COLLECTION: %s
WORKS:
%s

Analyze this collection and respond with ONLY valid JSON:
{
    "sequence": {
        "summary": "<assessment of current ordering>",
        "suggestions": [
            {
                "workTitle": "<title>",
                "currentPos": <current position 1-indexed>,
                "suggestedPos": <suggested position>,
                "rationale": "<why this change>"
            }
        ]
    },
    "themes": {
        "summary": "<thematic coherence assessment>",
        "identified_themes": ["theme1", "theme2"],
        "gaps": ["potential missing themes"]
    },
    "pacing": {
        "summary": "<rhythm and variety assessment>"
    },
    "balance": {
        "summary": "<genre mix and style consistency>"
    },
    "gaps": {
        "summary": "<missing pieces or perspectives>"
    },
    "overall_summary": "<1 paragraph collection assessment>"
}`, collectionName, sb.String())
}
