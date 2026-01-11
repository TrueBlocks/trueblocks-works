-- Migration 016: Add CASCADE deletes to foreign keys
-- This allows SQLite to automatically delete orphaned records when parent entities are deleted

PRAGMA foreign_keys = OFF;

-- Drop dependent views
DROP VIEW IF EXISTS SubmissionsView;

-- Drop FTS for Submissions (will recreate later)
DROP TRIGGER IF EXISTS submissions_fts_insert;
DROP TRIGGER IF EXISTS submissions_fts_update;
DROP TRIGGER IF EXISTS submissions_fts_delete;
DROP TABLE IF EXISTS submissions_fts;

-- Drop indexes on tables we're recreating
DROP INDEX IF EXISTS idx_submissions_workid;
DROP INDEX IF EXISTS idx_submissions_orgid;
DROP INDEX IF EXISTS idx_submissions_response;
DROP INDEX IF EXISTS idx_submissions_date;
DROP INDEX IF EXISTS idx_colldet_collid;
DROP INDEX IF EXISTS idx_colldet_workid;

-- Recreate Submissions with CASCADE on both foreign keys
DROP TABLE IF EXISTS Submissions_new;
CREATE TABLE Submissions_new (
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
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID) ON DELETE CASCADE
);

INSERT INTO Submissions_new SELECT * FROM Submissions;
DROP TABLE Submissions;
ALTER TABLE Submissions_new RENAME TO Submissions;

-- Recreate CollectionDetails with CASCADE on collID
DROP TABLE IF EXISTS CollectionDetails_new;
CREATE TABLE CollectionDetails_new (
    id INTEGER PRIMARY KEY,
    collID INTEGER NOT NULL,
    workID INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    FOREIGN KEY (collID) REFERENCES Collections(collID) ON DELETE CASCADE,
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
    UNIQUE(collID, workID)
);

INSERT INTO CollectionDetails_new SELECT * FROM CollectionDetails;
DROP TABLE CollectionDetails;
ALTER TABLE CollectionDetails_new RENAME TO CollectionDetails;

-- Recreate indexes
CREATE INDEX idx_submissions_workid ON Submissions(workID);
CREATE INDEX idx_submissions_orgid ON Submissions(orgID);
CREATE INDEX idx_submissions_response ON Submissions(response_type);
CREATE INDEX idx_submissions_date ON Submissions(submission_date);
CREATE INDEX idx_colldet_collid ON CollectionDetails(collID);
CREATE INDEX idx_colldet_workid ON CollectionDetails(workID);

-- Recreate FTS for Submissions
CREATE VIRTUAL TABLE submissions_fts USING fts5(
    title_of_work,
    journal_name,
    draft,
    submission_type,
    response_type,
    contest_name,
    content=SubmissionsView,
    content_rowid=submissionID,
    tokenize='porter unicode61 remove_diacritics 2'
);

-- Recreate SubmissionsView
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

-- Recreate FTS triggers for Submissions
CREATE TRIGGER submissions_fts_insert AFTER INSERT ON Submissions BEGIN
    INSERT INTO submissions_fts(rowid, title_of_work, journal_name, draft, submission_type, response_type, contest_name)
    SELECT submissionID, title_of_work, journal_name, draft, submission_type, response_type, contest_name
    FROM SubmissionsView WHERE submissionID = NEW.submissionID;
END;

CREATE TRIGGER submissions_fts_update AFTER UPDATE ON Submissions BEGIN
    DELETE FROM submissions_fts WHERE rowid = OLD.submissionID;
    INSERT INTO submissions_fts(rowid, title_of_work, journal_name, draft, submission_type, response_type, contest_name)
    SELECT submissionID, title_of_work, journal_name, draft, submission_type, response_type, contest_name
    FROM SubmissionsView WHERE submissionID = NEW.submissionID;
END;

CREATE TRIGGER submissions_fts_delete AFTER DELETE ON Submissions BEGIN
    DELETE FROM submissions_fts WHERE rowid = OLD.submissionID;
END;

-- Rebuild FTS index
INSERT INTO submissions_fts(rowid, title_of_work, journal_name, draft, submission_type, response_type, contest_name)
SELECT submissionID, title_of_work, journal_name, draft, submission_type, response_type, contest_name
FROM SubmissionsView;

PRAGMA foreign_keys = ON;
