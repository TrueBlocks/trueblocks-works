# Full-Text Search: Use Cases

> **Document:** fts-use-cases.md  
> **Parent:** [specification.md](specification.md)  
> **Related:** [fts-specification.md](fts-specification.md)  
> **Status:** Draft  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Human-Initiated Search](#2-human-initiated-search)
3. [AI-Assisted Discovery](#3-ai-assisted-discovery)
4. [AI-Assisted Analysis](#4-ai-assisted-analysis)
5. [AI-Assisted Writing Support](#5-ai-assisted-writing-support)
6. [AI-Assisted Career & Submission Support](#6-ai-assisted-career--submission-support)
7. [AI-Assisted Self-Understanding](#7-ai-assisted-self-understanding)
8. [Priority Matrix](#8-priority-matrix)

---

## 1. Overview

### Purpose

Full-text search enables querying the actual content of creative works, not just metadata. While traditional FTS serves human phrase lookup, the primary value proposition for this system is **AI-assisted corpus analysis** — using an AI agent to help the writer understand patterns, themes, evolution, and opportunities within their own body of work.

### Design Philosophy

The writer's corpus is a **unique dataset about themselves** — decades of creative output reflecting their obsessions, growth, blind spots, and voice. No external dataset can provide this. FTS transforms the corpus from a static archive into an queryable mirror of the creative self.

### Scale Context

| Metric | Value |
|--------|-------|
| Total works | ~2,000 documents |
| Document types | docx, md, xlsx |
| Estimated text | ~30-50 MB |
| Time span | 1985 - present (~40 years) |
| Types | Poems, stories, essays, chapters, blogs, journals |

---

## 2. Human-Initiated Search

Traditional full-text search use cases where the human directly queries the corpus.

### 2.1 Phrase Recovery

> "I wrote something about 'morning light on water' but can't remember the title."

**Query**: `morning light water`  
**Returns**: List of works containing those terms, ranked by relevance  
**Value**: Locate half-remembered pieces without browsing hundreds of files

### 2.2 Character/Name Search

> "Find every piece where I mention 'Eleanor' or 'Aunt Ruth'."

**Query**: `Eleanor OR "Aunt Ruth"`  
**Returns**: Works containing these names  
**Value**: Track recurring characters across memoir/fiction boundary

### 2.3 Place-Based Search

> "What have I written about Philadelphia?"

**Query**: `Philadelphia OR Philly OR "City of Brotherly Love"`  
**Returns**: Works referencing the city  
**Value**: Gather location-based pieces for themed collection

### 2.4 Quote Verification

> "Did I already use the line 'silence is the language of stones'?"

**Query**: `"silence is the language"`  
**Returns**: Exact phrase matches  
**Value**: Avoid unintentional self-plagiarism

### 2.5 Research Retrieval

> "Find my notes on Rilke's Duino Elegies."

**Query**: `Rilke Duino`  
**Returns**: Journal entries, essays, or annotations mentioning Rilke  
**Value**: Retrieve research without knowing which file contains it

---

## 3. AI-Assisted Discovery

Use cases where AI helps the writer discover things in their corpus they didn't know were there.

### 3.1 Hidden Thematic Threads

> "What themes appear repeatedly across my work that I might not be aware of?"

**AI Process**:
1. Query FTS for high-frequency nouns, images, and concepts
2. Cluster by semantic similarity
3. Cross-reference with dates and work types
4. Identify patterns the writer hasn't consciously noticed

**Example Output**:
> "Your corpus shows recurring engagement with:
> - **Water/drowning** (47 works, concentrated in 2012-2016)
> - **Doors/thresholds** (31 works, distributed throughout)
> - **Hands/touch** (28 works, peaks in early and late career)
> 
> The water imagery correlates with your 'Working' status pieces — you seem drawn to water when processing difficult material."

**Value**: Surface unconscious obsessions; reveal the writer's "deep grammar"

### 3.2 Forgotten Works

> "Show me pieces I haven't looked at in 5+ years that might be worth revisiting."

**AI Process**:
1. Filter by `access_date` > 5 years ago
2. Query FTS for quality indicators (complexity, imagery density)
3. Cross-reference with current interests
4. Rank by "hidden gem" potential

**Example Output**:
> "Found 3 dormant pieces that connect to your current project:
> - 'The Carpenter's Hands' (2008) — shares imagery with your new father sequence
> - 'November Fugue' (2011) — never submitted, 4.2 quality score
> - 'What the River Knows' (2009) — thematic precursor to 'Water Table'"

**Value**: Mine the archive for overlooked material

### 3.3 Influence Mapping

> "Which of my pieces reference or echo other writers?"

**AI Process**:
1. Query FTS for author names, titles, literary references
2. Identify allusive patterns and echoes
3. Map influence network across time

**Example Output**:
> "Your Rilke references (12 works) cluster around 2008-2010. Bishop appears steadily throughout. After 2018, Lucille Clifton becomes your most-referenced poet. Your 'Spiral' manuscript shows no external references — entirely your own voice."

**Value**: Understand literary lineage and evolution of influences

### 3.4 Form Inventory

> "What poetic forms have I experimented with?"

**AI Process**:
1. Query FTS for form indicators (stanza patterns, repetition structures)
2. Identify sonnets, villanelles, prose poems, etc.
3. Map form usage across career

**Example Output**:
> "Form distribution across 619 poems:
> - Free verse: 78%
> - Prose poems: 12% (mostly 2014-2016)
> - Sonnets: 4% (early career only)
> - List poems: 3%
> - Villanelles: 2 total
> 
> You abandoned received forms after 2012. Consider revisiting?"

**Value**: Reveal formal habits and gaps

---

## 4. AI-Assisted Analysis

Use cases where AI performs deeper analytical work on the corpus.

### 4.1 Voice Fingerprinting

> "What are the distinctive features of my writing voice?"

**AI Process**:
1. Analyze sentence structure, word choice, rhythmic patterns
2. Compare early vs. late career
3. Identify signature moves

**Example Output**:
> "Your voice signatures include:
> - Sentence fragments as emphasis (83% of pieces)
> - Second-person address in emotional peaks
> - Color words: grey/gray dominates (3x more than other colors)
> - Characteristic opener: present participle ('Walking...', 'Watching...')
> - Avoidance: exclamation points (only 4 in entire corpus)"

**Value**: Conscious awareness of unconscious style

### 4.2 Evolution Tracking

> "How has my writing changed from 2000 to 2020?"

**AI Process**:
1. Segment corpus by decade
2. Compare vocabulary, complexity, themes, forms
3. Identify inflection points

**Example Output**:
> "Major shifts detected:
> - **2008**: Sentence length drops 40% (more compression)
> - **2012**: Abstract nouns decrease, concrete imagery increases
> - **2015**: 'I' usage drops 60% — shift away from confessional mode
> - **2019**: Return of longer sentences, but with new syntactic complexity
> 
> Your MFA period (2010-2012) appears to be the primary inflection point."

**Value**: See artistic development objectively

### 4.3 Contradiction Detection

> "In my memoir chapters, do I contradict myself about dates, facts, or characterizations?"

**AI Process**:
1. Extract factual claims across memoir pieces
2. Cross-reference for inconsistencies
3. Flag contradictions with source citations

**Example Output**:
> "Potential inconsistencies found:
> - **Father's job**: 'accountant' in Ch. 3, 'bookkeeper' in Ch. 7
> - **1987 move**: 'spring' in 'First House', 'August' in 'Packing Day'
> - **Aunt Ruth's age**: varies by 4 years across 3 mentions
> 
> These may be intentional (unreliable narrator) or errors to reconcile."

**Value**: Fact-checking across long projects

### 4.4 Sentiment Archaeology

> "What was I emotionally processing in each period of my writing?"

**AI Process**:
1. Sentiment analysis across time-stamped works
2. Correlate with biographical markers
3. Map emotional landscape

**Example Output**:
> "Emotional tenor by period:
> - **2005-2008**: Predominant anger, grief (correlates with divorce)
> - **2009-2012**: Curiosity, exploration (MFA period)
> - **2013-2016**: Elegiac tone, father references increase
> - **2017-present**: Integration, acceptance, retrospective mode
> 
> Your 'Dead' collection pieces cluster in 2014-2015."

**Value**: Understand writing as emotional record

---

## 5. AI-Assisted Writing Support

Use cases where AI uses FTS to directly support current writing projects.

### 5.1 Self-Allusion

> "Find lines from my past work I could allude to in this new piece about my father."

**AI Process**:
1. Query FTS for father-related imagery in corpus
2. Extract memorable lines and images
3. Suggest allusive connections

**Example Output**:
> "Lines from your archive that could resonate:
> - 'His hands knew wood before they knew my name' (2008)
> - 'The silence between hammer strokes' (2014)
> - 'I learned to read his silences like weather' (2011)
> 
> Echoing your own earlier work creates internal resonance."

**Value**: Build a unified body of work through intentional self-reference

### 5.2 Avoiding Repetition

> "Have I already written a poem about this image/topic?"

**AI Process**:
1. Query FTS for proposed topic/image
2. Return existing treatments
3. Identify fresh angles

**Example Output**:
> "You have 4 existing 'birds at window' poems:
> - 'Cardinal' (2007) — loss
> - 'The Wren' (2012) — persistence
> - 'Glass' (2015) — barrier/separation
> - 'What the Crow Said' (2018) — messenger
> 
> Untried angles: humor, scientific observation, environmental concern."

**Value**: Avoid redundancy; find fresh entry points

### 5.3 Draft Archaeology

> "I know I tried writing about this before. Find my earlier attempts."

**AI Process**:
1. Query FTS for topic/image across all statuses
2. Include 'Dead' and 'Sleeping' works
3. Retrieve abandoned drafts

**Example Output**:
> "Found 3 prior attempts at 'grandmother's kitchen':
> - 'Bread Rising' (2006, Dead) — too sentimental, abandoned
> - 'The Apron' (2011, Sleeping) — fragment, 47 words
> - 'What She Made' (2016, Dead) — prose poem, over-explained
> 
> Pattern: you've struggled with sentimentality on this topic."

**Value**: Learn from past failures; harvest usable fragments

### 5.4 Companion Pieces

> "What other pieces might pair well with this one for a reading or submission?"

**AI Process**:
1. Analyze current piece for theme, form, tone
2. Query FTS for complementary works
3. Suggest pairings with rationale

**Example Output**:
> "For 'The Last Hammer' (elegy, father, craft imagery), consider:
> - 'Sharpening' — same hand/tool imagery, different emotional register
> - 'What He Left' — list poem, same subject, formal contrast
> - 'Inheritance' — mother poem, creates parent diptych"

**Value**: Curate readings and submissions strategically

---

## 6. AI-Assisted Career & Submission Support

Use cases where AI uses FTS to support the professional side of writing.

### 6.1 Themed Call Response

> "A journal wants poems about 'the body.' What do I have?"

**AI Process**:
1. Query FTS for body-related terms and imagery
2. Filter by status (publishable), submission history
3. Rank by fit and quality

**Example Output**:
> "12 unpublished 'body' poems found:
> 1. 'Anatomy Lesson' — hands, clinical tone, never submitted
> 2. 'What the Scar Remembers' — trauma, body memory
> 3. 'Cartilage' — aging, athletic body
> ...
> Recommend 1 and 3 for medical humanities journals."

**Value**: Respond to calls efficiently; mine back catalog

### 6.2 Submission History Context

> "Before I submit to [Journal], what's my history with similar venues?"

**AI Process**:
1. Pull submission records for comparable journals
2. Query FTS for what succeeded vs. failed
3. Identify patterns

**Example Output**:
> "At similar literary journals, your acceptance rate is 12%.
> Accepted pieces share: concrete imagery, under 30 lines, no overt politics.
> Rejected pieces trend: abstract, longer, experimental form.
> 
> For [Journal], consider 'The Well' or 'Night Fishing' — both fit the pattern."

**Value**: Data-informed submission strategy

### 6.3 Collection Assembly

> "Help me build a manuscript from my published poems."

**AI Process**:
1. Query FTS for all 'Published' status poems
2. Cluster by theme, form, chronology
3. Propose sections and ordering

**Example Output**:
> "From 47 published poems, I propose a 4-section structure:
> 
> **I. Inheritance** (11 poems) — family, memory, objects
> **II. Water Table** (9 poems) — your water imagery cluster
> **III. The Work of Hands** (12 poems) — craft, labor, making
> **IV. Late Light** (15 poems) — elegiac, retrospective
> 
> Opening poem: 'The Carpenter's Hands' (establishes voice)
> Closing poem: 'What Remains' (summation, looking forward)"

**Value**: Manuscript assembly from component pieces

---

## 7. AI-Assisted Self-Understanding

The deepest use case: using the corpus as a mirror for self-knowledge.

### 7.1 Obsession Mapping

> "What am I really writing about, underneath the surface subjects?"

**AI Process**:
1. Semantic analysis across full corpus
2. Identify deep structures beneath surface topics
3. Name the underlying concerns

**Example Output**:
> "Across 40 years and 2,000 pieces, your core concerns appear to be:
> 
> 1. **Transmission** — What passes between generations? Can it be chosen?
> 2. **Attention** — What does it mean to truly see something/someone?
> 3. **Silence** — What can't be said? What gets lost in translation?
> 4. **Making** — Craft as meaning-making, hands as knowing
> 
> These four concerns appear in different guises across all periods and forms."

**Value**: Articulate your artistic project to yourself

### 7.2 Blind Spot Detection

> "What subjects, perspectives, or experiences are absent from my work?"

**AI Process**:
1. Inventory topics present in corpus
2. Compare to expected range for biographical context
3. Identify significant absences

**Example Output**:
> "Notable absences from your corpus:
> - **Siblings** — 2 mentions in 2,000 pieces
> - **Professional life** — almost no workplace poems
> - **Technology** — the digital world is largely absent
> - **Politics** — present only in 2016-2020, then disappears
> 
> These may be intentional omissions or unconscious avoidances."

**Value**: See what you're not seeing

### 7.3 Wound Mapping

> "What hurts still appear in my recent work that I thought I'd resolved?"

**AI Process**:
1. Identify emotionally charged content across time
2. Track persistence of specific wounds/themes
3. Note what appears "healed" vs. "active"

**Example Output**:
> "Recurring wounds across career:
> - **Father's emotional distance** — Active (appears in 2024 work)
> - **Divorce** — Resolved (last appearance 2012)
> - **Professional failure (X)** — Active but transformed (bitter → ironic)
> - **Lost child** — Dormant (intense 2005-2008, absent since)
> 
> The father material remains generative; the divorce is fully metabolized."

**Value**: Understand what's still alive creatively

### 7.4 Future Direction

> "Based on my trajectory, what might I write next?"

**AI Process**:
1. Analyze recent work for emerging themes
2. Identify unfulfilled gestures and incomplete arcs
3. Project based on evolution patterns

**Example Output**:
> "Emerging directions in your 2023-2025 work:
> - Increased interest in **deep time** (geology, prehistory)
> - Growing use of **second person** — distancing or invitation?
> - **Humor** appearing for first time in serious poems
> 
> Unexplored territories your work points toward:
> - The sibling relationship (conspicuously absent)
> - Integration of digital life into poetic subject matter
> - A return to longer forms (you abandoned narrative after 2012)
> 
> Your next book might be: 'longer, funnier, geologic.'"

**Value**: See your own trajectory from outside

---

## 8. Priority Matrix

| Use Case Category | Frequency | Value | Implementation Complexity |
|-------------------|-----------|-------|---------------------------|
| Human Phrase Search | Low | Medium | Low |
| Thematic Discovery | Medium | Very High | Medium |
| Voice Analysis | Low | High | High |
| Evolution Tracking | Low | High | High |
| Writing Support | High | High | Medium |
| Submission Support | Medium | Medium | Medium |
| Self-Understanding | Low | **Transformative** | High |

### Recommended Implementation Order

1. **Foundation**: Basic FTS infrastructure (all use cases depend on this)
2. **Human Search**: Phrase lookup, name search (validates infrastructure)
3. **Discovery**: Thematic threads, forgotten works (high value, medium effort)
4. **Writing Support**: Self-allusion, repetition check (practical daily value)
5. **Deep Analysis**: Voice, evolution, self-understanding (aspirational, highest value)

---

*Document created: January 13, 2026*
