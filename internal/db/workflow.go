package db

import (
	"database/sql"
	"fmt"
)

func (db *DB) GetCollectionByName(name string) (int64, error) {
	var collID int64
	err := db.conn.QueryRow(
		`SELECT collID FROM Collections WHERE collection_name = ?`,
		name,
	).Scan(&collID)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("get collection by name: %w", err)
	}
	return collID, nil
}

func (db *DB) UpdateCollectionMembership(workID int64, oldStatus, newStatus string) error {
	if oldStatus == newStatus {
		return nil
	}

	if oldStatus != "" {
		oldCollID, err := db.GetCollectionByName(oldStatus)
		if err != nil {
			return err
		}
		if oldCollID > 0 {
			if err := db.RemoveWorkFromCollection(oldCollID, workID); err != nil {
				return err
			}
		}
	}

	if newStatus != "" {
		newCollID, err := db.GetCollectionByName(newStatus)
		if err != nil {
			return err
		}
		if newCollID > 0 {
			if err := db.AddWorkToCollection(newCollID, workID); err != nil {
				return err
			}
		}
	}

	return nil
}
