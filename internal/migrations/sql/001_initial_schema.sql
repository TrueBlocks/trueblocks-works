-- Schema for Works database
-- Version: 2.0 (squashed from migrations 1-10)
-- Updated: 2026-01-05

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
    collID INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_name TEXT NOT NULL,
    type TEXT,
    attributes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Works: creative writing pieces with metadata
CREATE TABLE Works (
    workID INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    year TEXT,
    status TEXT NOT NULL DEFAULT '',
    quality TEXT NOT NULL DEFAULT '',
    doc_type TEXT NOT NULL DEFAULT '',
    path TEXT,
    draft TEXT,
    n_words INTEGER,
    course_name TEXT,
    attributes TEXT DEFAULT '',
    access_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- CollectionDetails: many-to-many join between Collections and Works
CREATE TABLE CollectionDetails (
    id INTEGER PRIMARY KEY,
    collID INTEGER NOT NULL,
    workID INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    FOREIGN KEY (collID) REFERENCES Collections(collID),
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
    UNIQUE(collID, workID)
);

-- Organizations: literary journals, magazines, publishers
CREATE TABLE Organizations (
    orgID INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    other_name TEXT,
    url TEXT,
    other_url TEXT,
    status TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT '',
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
    attributes TEXT DEFAULT '',
    date_added TEXT,
    modified_at TEXT
);

-- Submissions: tracking submissions to organizations
CREATE TABLE Submissions (
    submissionID INTEGER PRIMARY KEY AUTOINCREMENT,
    workID INTEGER NOT NULL,
    orgID INTEGER NOT NULL,
    draft TEXT,
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
    attributes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workID) REFERENCES Works(workID),
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID)
);

-- Notes: unified notes for all entity types (works, journals, submissions, collections)
CREATE TABLE Notes (
    id INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,  -- 'work', 'journal', 'submission', 'collection'
    entity_id INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX idx_notes_entity ON Notes(entity_type, entity_id);
CREATE INDEX idx_notes_type ON Notes(type);

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

-- Full-text search for Notes
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note,
    type,
    content='Notes',
    content_rowid='id',
    tokenize='porter'
);

-- Full-text search for Submissions (contest names)
CREATE VIRTUAL TABLE submissions_fts USING fts5(
    contest_name,
    content='Submissions',
    content_rowid='submissionID',
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

-- Notes FTS triggers
CREATE TRIGGER notes_fts_ai AFTER INSERT ON Notes BEGIN
    INSERT INTO notes_fts(rowid, note, type) VALUES (NEW.id, NEW.note, NEW.type);
END;

CREATE TRIGGER notes_fts_ad AFTER DELETE ON Notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, note, type) VALUES ('delete', OLD.id, OLD.note, OLD.type);
END;

CREATE TRIGGER notes_fts_au AFTER UPDATE ON Notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, note, type) VALUES ('delete', OLD.id, OLD.note, OLD.type);
    INSERT INTO notes_fts(rowid, note, type) VALUES (NEW.id, NEW.note, NEW.type);
END;

-- Submissions FTS triggers
CREATE TRIGGER submissions_fts_ai AFTER INSERT ON Submissions BEGIN
    INSERT INTO submissions_fts(rowid, contest_name) VALUES (NEW.submissionID, NEW.contest_name);
END;

CREATE TRIGGER submissions_fts_ad AFTER DELETE ON Submissions BEGIN
    INSERT INTO submissions_fts(submissions_fts, rowid, contest_name) VALUES ('delete', OLD.submissionID, OLD.contest_name);
END;

CREATE TRIGGER submissions_fts_au AFTER UPDATE ON Submissions BEGIN
    INSERT INTO submissions_fts(submissions_fts, rowid, contest_name) VALUES ('delete', OLD.submissionID, OLD.contest_name);
    INSERT INTO submissions_fts(rowid, contest_name) VALUES (NEW.submissionID, NEW.contest_name);
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
    (SELECT GROUP_CONCAT(c.collection_name, ', ') 
     FROM CollectionDetails cd
     JOIN Collections c ON cd.collID = c.collID
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
    COALESCE(o.status, 'Open') AS journal_status,
    CASE 
        WHEN s.response_date IS NULL AND (s.response_type IS NULL OR s.response_type = '' OR s.response_type = 'Waiting')
        THEN 'yes' 
        ELSE 'no' 
    END AS decision_pending
FROM Submissions s
LEFT JOIN Works w ON s.workID = w.workID
LEFT JOIN Organizations o ON s.orgID = o.orgID;

-- Collections view with item count
CREATE VIEW CollectionsView AS
SELECT 
    c.*,
    (SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID) AS n_items
FROM Collections c;

--------------------------------------------------------------------------------
-- Initial migration record (marks all migrations as applied)
--------------------------------------------------------------------------------

INSERT INTO schema_migrations (version, description) VALUES (1, 'Initial schema');
INSERT INTO schema_migrations (version, description) VALUES (2, 'populate_year_from_path');
INSERT INTO schema_migrations (version, description) VALUES (3, 'consolidate_notes_tables');
INSERT INTO schema_migrations (version, description) VALUES (4, 'add_position_to_collection_details');
INSERT INTO schema_migrations (version, description) VALUES (5, 'drop_collection_name_from_details');
INSERT INTO schema_migrations (version, description) VALUES (6, 'populate_position_from_title');
INSERT INTO schema_migrations (version, description) VALUES (7, 'add_attributes_and_mark');
INSERT INTO schema_migrations (version, description) VALUES (8, 'populate_attributes_from_booleans');
INSERT INTO schema_migrations (version, description) VALUES (9, 'drop_boolean_columns');
INSERT INTO schema_migrations (version, description) VALUES (10, 'drop_mark_column');
INSERT INTO schema_migrations (version, description) VALUES (11, 'fts_notes_and_submissions');
INSERT INTO schema_migrations (version, description) VALUES (12, 'rename_modified_columns');
INSERT INTO schema_migrations (version, description) VALUES (13, 'drop_is_status_column');
