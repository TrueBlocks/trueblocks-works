-- Schema for Works database
-- Version: 1.0
-- Created: 2026-01-03

-- Enable foreign keys
PRAGMA foreign_keys = ON;

--------------------------------------------------------------------------------
-- Schema Migrations Table
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

--------------------------------------------------------------------------------
-- Core Tables
--------------------------------------------------------------------------------

-- Collections: groupings/categories for organizing works
CREATE TABLE Collections (
    collID INTEGER PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    is_status TEXT,
    type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Works: creative writing pieces with metadata
CREATE TABLE Works (
    workID INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    year TEXT,
    status TEXT DEFAULT 'Working',
    quality TEXT DEFAULT 'Okay',
    doc_type TEXT DEFAULT 'docx',
    path TEXT,
    draft TEXT,
    n_words INTEGER,
    course_name TEXT,
    is_blog TEXT,
    is_printed TEXT,
    is_prose_poem TEXT,
    is_revised TEXT,
    mark TEXT,
    access_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- CollectionDetails: many-to-many join between Collections and Works
CREATE TABLE CollectionDetails (
    id INTEGER PRIMARY KEY,
    collID INTEGER NOT NULL,
    workID INTEGER NOT NULL,
    collection_name TEXT,
    FOREIGN KEY (collID) REFERENCES Collections(collID),
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
    UNIQUE(collID, workID)
);

-- Organizations: literary journals, magazines, publishers
CREATE TABLE Organizations (
    orgID INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    other_name TEXT,
    url TEXT,
    other_url TEXT,
    status TEXT DEFAULT 'Open',
    type TEXT DEFAULT 'Journal',
    timing TEXT,
    submission_types TEXT,
    accepts TEXT,
    my_interest TEXT,
    ranking INTEGER,
    source TEXT,
    website_menu TEXT,
    duotrope_num INTEGER,
    n_push_fiction INTEGER DEFAULT 0,
    n_push_nonfiction INTEGER DEFAULT 0,
    n_push_poetry INTEGER DEFAULT 0,
    contest_ends TEXT,
    contest_fee TEXT,
    contest_prize TEXT,
    contest_prize_2 TEXT,
    date_added TEXT DEFAULT CURRENT_TIMESTAMP,
    date_modified TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Submissions: tracking submissions to organizations
CREATE TABLE Submissions (
    submissionID INTEGER PRIMARY KEY,
    workID INTEGER NOT NULL,
    orgID INTEGER NOT NULL,
    draft TEXT NOT NULL,
    submission_date TEXT,
    submission_type TEXT,
    query_date TEXT,
    response_date TEXT,
    response_type TEXT,
    contest_name TEXT,
    cost REAL,
    user_id TEXT,
    password TEXT,
    web_address TEXT,
    mark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workID) REFERENCES Works(workID),
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID)
);

-- WorkNotes: notes, critiques, history for individual works
CREATE TABLE WorkNotes (
    id INTEGER PRIMARY KEY,
    workID INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE
);

-- JournalNotes: notes about organizations/journals
CREATE TABLE JournalNotes (
    id INTEGER PRIMARY KEY,
    orgID INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID) ON DELETE CASCADE
);

--------------------------------------------------------------------------------
-- Indexes
--------------------------------------------------------------------------------

-- Works indexes
CREATE INDEX idx_works_title ON Works(title);
CREATE INDEX idx_works_type ON Works(type);
CREATE INDEX idx_works_year ON Works(year);
CREATE INDEX idx_works_status ON Works(status);
CREATE INDEX idx_works_quality ON Works(quality);
CREATE INDEX idx_works_doc_type ON Works(doc_type);

-- CollectionDetails indexes
CREATE INDEX idx_colldet_collid ON CollectionDetails(collID);
CREATE INDEX idx_colldet_workid ON CollectionDetails(workID);
CREATE INDEX idx_colldet_name ON CollectionDetails(collection_name);

-- Organizations indexes
CREATE INDEX idx_orgs_name ON Organizations(name);
CREATE INDEX idx_orgs_status ON Organizations(status);
CREATE INDEX idx_orgs_interest ON Organizations(my_interest);
CREATE INDEX idx_orgs_type ON Organizations(type);

-- Submissions indexes
CREATE INDEX idx_submissions_workid ON Submissions(workID);
CREATE INDEX idx_submissions_orgid ON Submissions(orgID);
CREATE INDEX idx_submissions_response ON Submissions(response_type);
CREATE INDEX idx_submissions_date ON Submissions(submission_date);

-- Notes indexes
CREATE INDEX idx_worknotes_workid ON WorkNotes(workID);
CREATE INDEX idx_worknotes_type ON WorkNotes(type);
CREATE INDEX idx_journalnotes_orgid ON JournalNotes(orgID);
CREATE INDEX idx_journalnotes_type ON JournalNotes(type);

--------------------------------------------------------------------------------
-- FTS5 Virtual Tables (Full-Text Search)
--------------------------------------------------------------------------------

-- Full-text search for Works
CREATE VIRTUAL TABLE works_fts USING fts5(
    title,
    type,
    year,
    status,
    quality,
    course_name,
    content='Works',
    content_rowid='workID'
);

-- Full-text search for Organizations
CREATE VIRTUAL TABLE orgs_fts USING fts5(
    name,
    other_name,
    url,
    accepts,
    source,
    content='Organizations',
    content_rowid='orgID'
);

-- Full-text search for Notes (combined work and journal notes)
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note,
    type,
    entity_type,
    entity_id,
    tokenize='porter'
);

--------------------------------------------------------------------------------
-- FTS5 Triggers (keep FTS in sync with base tables)
--------------------------------------------------------------------------------

-- Works FTS triggers
CREATE TRIGGER works_fts_ai AFTER INSERT ON Works BEGIN
    INSERT INTO works_fts(rowid, title, type, year, status, quality, course_name)
    VALUES (NEW.workID, NEW.title, NEW.type, NEW.year, NEW.status, NEW.quality, NEW.course_name);
END;

CREATE TRIGGER works_fts_ad AFTER DELETE ON Works BEGIN
    INSERT INTO works_fts(works_fts, rowid, title, type, year, status, quality, course_name)
    VALUES ('delete', OLD.workID, OLD.title, OLD.type, OLD.year, OLD.status, OLD.quality, OLD.course_name);
END;

CREATE TRIGGER works_fts_au AFTER UPDATE ON Works BEGIN
    INSERT INTO works_fts(works_fts, rowid, title, type, year, status, quality, course_name)
    VALUES ('delete', OLD.workID, OLD.title, OLD.type, OLD.year, OLD.status, OLD.quality, OLD.course_name);
    INSERT INTO works_fts(rowid, title, type, year, status, quality, course_name)
    VALUES (NEW.workID, NEW.title, NEW.type, NEW.year, NEW.status, NEW.quality, NEW.course_name);
END;

-- Organizations FTS triggers
CREATE TRIGGER orgs_fts_ai AFTER INSERT ON Organizations BEGIN
    INSERT INTO orgs_fts(rowid, name, other_name, url, accepts, source)
    VALUES (NEW.orgID, NEW.name, NEW.other_name, NEW.url, NEW.accepts, NEW.source);
END;

CREATE TRIGGER orgs_fts_ad AFTER DELETE ON Organizations BEGIN
    INSERT INTO orgs_fts(orgs_fts, rowid, name, other_name, url, accepts, source)
    VALUES ('delete', OLD.orgID, OLD.name, OLD.other_name, OLD.url, OLD.accepts, OLD.source);
END;

CREATE TRIGGER orgs_fts_au AFTER UPDATE ON Organizations BEGIN
    INSERT INTO orgs_fts(orgs_fts, rowid, name, other_name, url, accepts, source)
    VALUES ('delete', OLD.orgID, OLD.name, OLD.other_name, OLD.url, OLD.accepts, OLD.source);
    INSERT INTO orgs_fts(rowid, name, other_name, url, accepts, source)
    VALUES (NEW.orgID, NEW.name, NEW.other_name, NEW.url, NEW.accepts, NEW.source);
END;

--------------------------------------------------------------------------------
-- Views (computed columns)
--------------------------------------------------------------------------------

-- Works view with computed fields
CREATE VIEW WorksView AS
SELECT 
    w.*,
    CAST((julianday('now') - julianday(w.access_date)) AS INTEGER) AS age_days,
    (SELECT COUNT(*) FROM Submissions s WHERE s.workID = w.workID) AS n_submissions,
    (SELECT GROUP_CONCAT(cd.collection_name, ', ') 
     FROM CollectionDetails cd 
     WHERE cd.workID = w.workID) AS collection_list
FROM Works w;

-- Organizations view with computed fields
CREATE VIEW OrganizationsView AS
SELECT 
    o.*,
    (o.n_push_fiction + o.n_push_nonfiction + o.n_push_poetry) AS n_pushcarts,
    (CASE WHEN o.n_push_poetry > 0 THEN 1000 ELSE 2000 END + COALESCE(o.ranking, 9999)) AS rating,
    (SELECT COUNT(*) FROM Submissions s WHERE s.orgID = o.orgID) AS n_submissions
FROM Organizations o;

-- Submissions view with lookups
CREATE VIEW SubmissionsView AS
SELECT 
    s.*,
    w.title AS title_of_work,
    o.name AS journal_name,
    CASE 
        WHEN s.response_type IS NOT NULL AND s.response_type != 'Waiting' 
        THEN 'no' 
        ELSE 'yes' 
    END AS decision_pending
FROM Submissions s
JOIN Works w ON s.workID = w.workID
JOIN Organizations o ON s.orgID = o.orgID;

-- Collections view with item count
CREATE VIEW CollectionsView AS
SELECT 
    c.*,
    CASE WHEN c.is_status = 'yes' THEN c.collection_name ELSE 'None' END AS status_list,
    (SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID) AS n_items
FROM Collections c;

--------------------------------------------------------------------------------
-- Initial migration record
--------------------------------------------------------------------------------

INSERT INTO schema_migrations (version, description) VALUES (1, 'Initial schema');
