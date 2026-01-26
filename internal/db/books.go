package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

func (db *DB) CreateBook(b *models.Book) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Books (
		collID, title, subtitle, author, copyright, dedication,
		acknowledgements, about_author, cover_path, isbn, published_date,
		template_path, export_path, status, header_font, header_size,
		page_num_font, page_num_size, title_font, title_size,
		subtitle_font, subtitle_size, author_font, author_size,
		works_start_recto, show_page_numbers, selected_parts, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query,
		b.CollID, b.Title, b.Subtitle, b.Author, b.Copyright, b.Dedication,
		b.Acknowledgements, b.AboutAuthor, b.CoverPath, b.ISBN, b.PublishedDate,
		b.TemplatePath, b.ExportPath, b.Status, b.HeaderFont, b.HeaderSize,
		b.PageNumFont, b.PageNumSize, b.TitleFont, b.TitleSize,
		b.SubtitleFont, b.SubtitleSize, b.AuthorFont, b.AuthorSize,
		b.WorksStartRecto, b.ShowPageNumbers, b.SelectedParts, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert book: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	b.BookID = id
	b.CreatedAt = now
	b.ModifiedAt = now
	return nil
}

func (db *DB) GetBook(id int64) (*models.Book, error) {
	query := `SELECT bookID, collID, title, subtitle, author, copyright, dedication,
		acknowledgements, about_author, cover_path, isbn, published_date,
		template_path, export_path, status, header_font, header_size,
		page_num_font, page_num_size, title_font, title_size,
		subtitle_font, subtitle_size, author_font, author_size,
		works_start_recto, show_page_numbers, selected_parts, created_at, updated_at
		FROM Books WHERE bookID = ?`

	b := &models.Book{}
	err := db.conn.QueryRow(query, id).Scan(
		&b.BookID, &b.CollID, &b.Title, &b.Subtitle, &b.Author, &b.Copyright,
		&b.Dedication, &b.Acknowledgements, &b.AboutAuthor, &b.CoverPath,
		&b.ISBN, &b.PublishedDate, &b.TemplatePath, &b.ExportPath,
		&b.Status, &b.HeaderFont, &b.HeaderSize, &b.PageNumFont, &b.PageNumSize,
		&b.TitleFont, &b.TitleSize, &b.SubtitleFont, &b.SubtitleSize,
		&b.AuthorFont, &b.AuthorSize, &b.WorksStartRecto, &b.ShowPageNumbers,
		&b.SelectedParts, &b.CreatedAt, &b.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query book: %w", err)
	}
	return b, nil
}

func (db *DB) GetBookByCollection(collID int64) (*models.Book, error) {
	query := `SELECT bookID, collID, title, subtitle, author, copyright, dedication,
		acknowledgements, about_author, cover_path, isbn, published_date,
		template_path, export_path, status, header_font, header_size,
		page_num_font, page_num_size, title_font, title_size,
		subtitle_font, subtitle_size, author_font, author_size,
		works_start_recto, show_page_numbers, selected_parts, created_at, updated_at
		FROM Books WHERE collID = ?`

	b := &models.Book{}
	err := db.conn.QueryRow(query, collID).Scan(
		&b.BookID, &b.CollID, &b.Title, &b.Subtitle, &b.Author, &b.Copyright,
		&b.Dedication, &b.Acknowledgements, &b.AboutAuthor, &b.CoverPath,
		&b.ISBN, &b.PublishedDate, &b.TemplatePath, &b.ExportPath,
		&b.Status, &b.HeaderFont, &b.HeaderSize, &b.PageNumFont, &b.PageNumSize,
		&b.TitleFont, &b.TitleSize, &b.SubtitleFont, &b.SubtitleSize,
		&b.AuthorFont, &b.AuthorSize, &b.WorksStartRecto, &b.ShowPageNumbers,
		&b.SelectedParts, &b.CreatedAt, &b.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query book by collection: %w", err)
	}
	return b, nil
}

func (db *DB) UpdateBook(b *models.Book) error {
	query := `UPDATE Books SET
		title = ?, subtitle = ?, author = ?, copyright = ?, dedication = ?,
		acknowledgements = ?, about_author = ?, cover_path = ?, isbn = ?,
		published_date = ?, template_path = ?, export_path = ?, status = ?,
		header_font = ?, header_size = ?, page_num_font = ?, page_num_size = ?,
		title_font = ?, title_size = ?, subtitle_font = ?, subtitle_size = ?,
		author_font = ?, author_size = ?, works_start_recto = ?, show_page_numbers = ?,
		selected_parts = ?, updated_at = CURRENT_TIMESTAMP
		WHERE bookID = ?`

	_, err := db.conn.Exec(query,
		b.Title, b.Subtitle, b.Author, b.Copyright, b.Dedication,
		b.Acknowledgements, b.AboutAuthor, b.CoverPath, b.ISBN,
		b.PublishedDate, b.TemplatePath, b.ExportPath, b.Status,
		b.HeaderFont, b.HeaderSize, b.PageNumFont, b.PageNumSize,
		b.TitleFont, b.TitleSize, b.SubtitleFont, b.SubtitleSize,
		b.AuthorFont, b.AuthorSize, b.WorksStartRecto, b.ShowPageNumbers,
		b.SelectedParts, b.BookID,
	)
	if err != nil {
		return fmt.Errorf("update book: %w", err)
	}

	var modifiedAt string
	err = db.conn.QueryRow("SELECT updated_at FROM Books WHERE bookID = ?", b.BookID).Scan(&modifiedAt)
	if err == nil {
		b.ModifiedAt = modifiedAt
	}

	return nil
}

func (db *DB) DeleteBook(id int64) error {
	_, err := db.conn.Exec("DELETE FROM Books WHERE bookID = ?", id)
	if err != nil {
		return fmt.Errorf("delete book: %w", err)
	}
	return nil
}

func (db *DB) SetCollectionIsBook(collID int64, isBook bool) error {
	value := 0
	if isBook {
		value = 1
	}
	_, err := db.conn.Exec("UPDATE Collections SET is_book = ? WHERE collID = ?", value, collID)
	if err != nil {
		return fmt.Errorf("set collection is_book: %w", err)
	}
	return nil
}

func (db *DB) GetCollectionIsBook(collID int64) (bool, error) {
	var isBook int
	err := db.conn.QueryRow("SELECT COALESCE(is_book, 0) FROM Collections WHERE collID = ?", collID).Scan(&isBook)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("get collection is_book: %w", err)
	}
	return isBook == 1, nil
}
