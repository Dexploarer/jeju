// Package proto implements the binary protocol server for SQLit.
//
// The server listens on a TCP port and handles binary protocol requests
// for high-performance database operations from workerd native bindings.
package proto

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"sqlit/src/utils/log"
)

// ServerConfig holds server configuration
type ServerConfig struct {
	// ListenAddr is the address to listen on (e.g., "0.0.0.0:4662")
	ListenAddr string

	// MaxConnections is the maximum number of concurrent connections
	MaxConnections int

	// ReadTimeout is the timeout for reading requests
	ReadTimeout time.Duration

	// WriteTimeout is the timeout for writing responses
	WriteTimeout time.Duration

	// IdleTimeout is the timeout for idle connections
	IdleTimeout time.Duration
}

// DefaultServerConfig returns a default server configuration
func DefaultServerConfig() *ServerConfig {
	return &ServerConfig{
		ListenAddr:     "0.0.0.0:4662",
		MaxConnections: 1000,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
		IdleTimeout:    60 * time.Second,
	}
}

// DatabaseProvider is the interface for getting database connections
type DatabaseProvider interface {
	// GetDatabase returns a database connection for the given database ID
	GetDatabase(dbID string) (*sql.DB, error)
}

// Server handles binary protocol connections
type Server struct {
	config     *ServerConfig
	dbProvider DatabaseProvider
	listener   net.Listener

	ctx    context.Context
	cancel context.CancelFunc

	connCount    int64
	requestCount uint64

	mu    sync.Mutex
	conns map[net.Conn]struct{}
}

// NewServer creates a new binary protocol server
func NewServer(config *ServerConfig, dbProvider DatabaseProvider) *Server {
	ctx, cancel := context.WithCancel(context.Background())
	return &Server{
		config:     config,
		dbProvider: dbProvider,
		ctx:        ctx,
		cancel:     cancel,
		conns:      make(map[net.Conn]struct{}),
	}
}

// Start starts the server
func (s *Server) Start() error {
	l, err := net.Listen("tcp", s.config.ListenAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", s.config.ListenAddr, err)
	}
	s.listener = l

	log.WithField("addr", s.config.ListenAddr).Info("binary protocol server started")

	go s.acceptLoop()

	return nil
}

// Stop stops the server gracefully
func (s *Server) Stop() error {
	s.cancel()

	if s.listener != nil {
		s.listener.Close()
	}

	// Close all connections
	s.mu.Lock()
	for conn := range s.conns {
		conn.Close()
	}
	s.mu.Unlock()

	return nil
}

// acceptLoop accepts new connections
func (s *Server) acceptLoop() {
	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		conn, err := s.listener.Accept()
		if err != nil {
			if s.ctx.Err() != nil {
				return // Server is shutting down
			}
			log.WithError(err).Warn("failed to accept connection")
			continue
		}

		// Check connection limit
		if atomic.LoadInt64(&s.connCount) >= int64(s.config.MaxConnections) {
			log.Warn("connection limit reached, rejecting")
			conn.Close()
			continue
		}

		atomic.AddInt64(&s.connCount, 1)

		s.mu.Lock()
		s.conns[conn] = struct{}{}
		s.mu.Unlock()

		go s.handleConnection(conn)
	}
}

// handleConnection handles a single connection
func (s *Server) handleConnection(conn net.Conn) {
	defer func() {
		conn.Close()
		atomic.AddInt64(&s.connCount, -1)

		s.mu.Lock()
		delete(s.conns, conn)
		s.mu.Unlock()
	}()

	log.WithField("remote", conn.RemoteAddr().String()).Debug("new connection")

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		// Set read deadline
		if s.config.ReadTimeout > 0 {
			conn.SetReadDeadline(time.Now().Add(s.config.ReadTimeout))
		}

		// Read request
		req, err := ReadRequest(conn)
		if err != nil {
			if err == io.EOF {
				return // Client closed connection
			}
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				return // Timeout
			}
			log.WithError(err).Debug("failed to read request")
			return
		}

		// Process request
		s.handleRequest(conn, req)
	}
}

// handleRequest handles a single request
func (s *Server) handleRequest(conn net.Conn, req *Request) {
	atomic.AddUint64(&s.requestCount, 1)

	// Set write deadline
	if s.config.WriteTimeout > 0 {
		conn.SetWriteDeadline(time.Now().Add(s.config.WriteTimeout))
	}

	switch req.Type {
	case TypePing:
		s.handlePing(conn, req)
	case TypeQuery:
		s.handleQuery(conn, req)
	case TypeExec:
		s.handleExec(conn, req)
	default:
		WriteErrorResponse(conn, req.RequestID, fmt.Sprintf("unknown request type: %d", req.Type))
	}
}

// handlePing handles a ping request
func (s *Server) handlePing(conn net.Conn, req *Request) {
	h := &Header{
		Magic:     MagicNumber,
		Version:   ProtocolVersion,
		Type:      TypePong,
		Flags:     0,
		RequestID: req.RequestID,
	}
	WriteHeader(conn, h)
}

// handleQuery handles a SELECT query
func (s *Server) handleQuery(conn net.Conn, req *Request) {
	db, err := s.dbProvider.GetDatabase(req.DatabaseID)
	if err != nil {
		WriteErrorResponse(conn, req.RequestID, fmt.Sprintf("database not found: %s", req.DatabaseID))
		return
	}

	// Convert bindings to interface{}
	args := make([]interface{}, len(req.Bindings))
	for i, v := range req.Bindings {
		args[i] = bindingToInterface(&v)
	}

	// Execute query
	rows, err := db.Query(req.SQL, args...)
	if err != nil {
		WriteErrorResponse(conn, req.RequestID, err.Error())
		return
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		WriteErrorResponse(conn, req.RequestID, err.Error())
		return
	}

	// Check if streaming is requested
	streaming := req.Flags&FlagStreaming != 0

	if streaming {
		s.streamRows(conn, req, rows, columns)
	} else {
		s.sendAllRows(conn, req, rows, columns)
	}
}

// streamRows streams rows one at a time
func (s *Server) streamRows(conn net.Conn, req *Request, rows *sql.Rows, columns []string) {
	// First, send column names
	h := &Header{
		Magic:     MagicNumber,
		Version:   ProtocolVersion,
		Type:      TypeRows,
		Flags:     FlagStreaming,
		RequestID: req.RequestID,
	}

	WriteHeader(conn, h)

	// Write column count
	var buf bytes.Buffer
	buf.WriteByte(byte(len(columns)))
	for _, col := range columns {
		WriteString(&buf, col)
	}
	conn.Write(buf.Bytes())

	// Stream rows
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			WriteErrorResponse(conn, req.RequestID, err.Error())
			return
		}

		// Send row
		buf.Reset()
		for _, v := range values {
			val := interfaceToValue(v)
			WriteValue(&buf, &val)
		}
		conn.Write(buf.Bytes())
	}

	// Send end of rows
	h.Type = TypeRowsEnd
	WriteHeader(conn, h)
}

// sendAllRows sends all rows in a single response
func (s *Server) sendAllRows(conn net.Conn, req *Request, rows *sql.Rows, columns []string) {
	// Collect all rows
	var allRows [][]Value

	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			WriteErrorResponse(conn, req.RequestID, err.Error())
			return
		}

		row := make([]Value, len(columns))
		for i, v := range values {
			row[i] = interfaceToValue(v)
		}
		allRows = append(allRows, row)
	}

	if err := rows.Err(); err != nil {
		WriteErrorResponse(conn, req.RequestID, err.Error())
		return
	}

	// Send response
	h := &Header{
		Magic:     MagicNumber,
		Version:   ProtocolVersion,
		Type:      TypeResult,
		Flags:     0,
		RequestID: req.RequestID,
	}

	WriteHeader(conn, h)

	// Write success flag
	conn.Write([]byte{1})

	// Write column count
	var buf bytes.Buffer
	buf.WriteByte(byte(len(columns)))
	for _, col := range columns {
		WriteString(&buf, col)
	}
	conn.Write(buf.Bytes())

	// Write row count
	rowCountBuf := make([]byte, 4)
	rowCountBuf[0] = byte(len(allRows))
	rowCountBuf[1] = byte(len(allRows) >> 8)
	rowCountBuf[2] = byte(len(allRows) >> 16)
	rowCountBuf[3] = byte(len(allRows) >> 24)
	conn.Write(rowCountBuf)

	// Write rows
	for _, row := range allRows {
		buf.Reset()
		for _, v := range row {
			WriteValue(&buf, &v)
		}
		conn.Write(buf.Bytes())
	}
}

// handleExec handles an INSERT/UPDATE/DELETE query
func (s *Server) handleExec(conn net.Conn, req *Request) {
	db, err := s.dbProvider.GetDatabase(req.DatabaseID)
	if err != nil {
		WriteErrorResponse(conn, req.RequestID, fmt.Sprintf("database not found: %s", req.DatabaseID))
		return
	}

	// Convert bindings to interface{}
	args := make([]interface{}, len(req.Bindings))
	for i, v := range req.Bindings {
		args[i] = bindingToInterface(&v)
	}

	// Execute query
	result, err := db.Exec(req.SQL, args...)
	if err != nil {
		WriteErrorResponse(conn, req.RequestID, err.Error())
		return
	}

	lastInsertID, _ := result.LastInsertId()
	rowsAffected, _ := result.RowsAffected()

	WriteSuccessResponse(conn, req.RequestID, lastInsertID, rowsAffected)
}

// bindingToInterface converts a Value to interface{} for sql.Query
func bindingToInterface(v *Value) interface{} {
	switch v.Type {
	case ValueNull:
		return nil
	case ValueInt64:
		return v.AsInt64()
	case ValueFloat64:
		return v.AsFloat64()
	case ValueString:
		return v.AsString()
	case ValueBlob:
		return v.AsBlob()
	case ValueBool:
		return v.AsBool()
	default:
		return nil
	}
}

// interfaceToValue converts an interface{} to Value
func interfaceToValue(v interface{}) Value {
	if v == nil {
		return ValueNullV()
	}

	switch val := v.(type) {
	case int64:
		return ValueFromInt64(val)
	case float64:
		return ValueFromFloat64(val)
	case string:
		return ValueFromString(val)
	case []byte:
		return ValueFromBlob(val)
	case bool:
		return ValueFromBool(val)
	case int:
		return ValueFromInt64(int64(val))
	case int32:
		return ValueFromInt64(int64(val))
	default:
		// Convert to string for unknown types
		return ValueFromString(fmt.Sprintf("%v", val))
	}
}

// Stats returns server statistics
func (s *Server) Stats() map[string]interface{} {
	return map[string]interface{}{
		"connections":   atomic.LoadInt64(&s.connCount),
		"total_requests": atomic.LoadUint64(&s.requestCount),
	}
}
