
package storage

import (
	"database/sql"

	"sqlit/src/client"
)

// SqlitStorage defines the sqlit database abstraction.
type SqlitStorage struct {
	mirrorServerAddr string
}

// NewSqlitStorage returns new sqlit storage handler.
func NewSqlitStorage(mirrorServerAddr string) (s *SqlitStorage) {
	s = &SqlitStorage{mirrorServerAddr: mirrorServerAddr}
	return
}

// Create implements the Storage abstraction interface.
func (s *SqlitStorage) Create(nodeCnt int) (dbID string, err error) {
	var meta = client.ResourceMeta{}
	meta.Node = uint16(nodeCnt)

	var dsn string
	if _, dsn, err = client.Create(meta); err != nil {
		return
	}

	var cfg *client.Config
	if cfg, err = client.ParseDSN(dsn); err != nil {
		return
	}

	dbID = cfg.DatabaseID
	return
}

// Drop implements the Storage abstraction interface.
func (s *SqlitStorage) Drop(dbID string) (err error) {
	cfg := client.NewConfig()
	cfg.DatabaseID = dbID
	_, err = client.Drop(cfg.FormatDSN())
	return
}

// Query implements the Storage abstraction interface.
func (s *SqlitStorage) Query(dbID string, query string, args ...interface{}) (columns []string, types []string, result [][]interface{}, err error) {
	var conn *sql.DB
	if conn, err = s.getConn(dbID); err != nil {
		return
	}
	defer conn.Close()

	var rows *sql.Rows
	if rows, err = conn.Query(query, args...); err != nil {
		return
	}
	defer rows.Close()

	if columns, err = rows.Columns(); err != nil {
		return
	}

	var colTypes []*sql.ColumnType

	if colTypes, err = rows.ColumnTypes(); err != nil {
		return
	}

	types = make([]string, len(colTypes))

	for i, c := range colTypes {
		if c != nil {
			types[i] = c.DatabaseTypeName()
		}
	}

	result, err = readAllRows(rows)
	return
}

// Exec implements the Storage abstraction interface.
func (s *SqlitStorage) Exec(dbID string, query string, args ...interface{}) (affectedRows int64, lastInsertID int64, err error) {
	var conn *sql.DB
	if conn, err = s.getConn(dbID); err != nil {
		return
	}
	defer conn.Close()

	var result sql.Result
	result, err = conn.Exec(query, args...)

	if err == nil {
		affectedRows, _ = result.RowsAffected()
		lastInsertID, _ = result.LastInsertId()
	}

	return
}

func (s *SqlitStorage) getConn(dbID string) (db *sql.DB, err error) {
	cfg := client.NewConfig()
	cfg.DatabaseID = dbID
	if s.mirrorServerAddr != "" {
		cfg.Mirror = s.mirrorServerAddr
	}

	return sql.Open("sqlit", cfg.FormatDSN())
}
