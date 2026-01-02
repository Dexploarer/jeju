// Package proto implements the binary protocol for high-performance SQLit communication.
//
// Protocol Format:
//
//	┌─────────────────────────────────────────────────────────────┐
//	│ Header (12 bytes)                                           │
//	├─────────────────────────────────────────────────────────────┤
//	│ Magic: 0x53514C54 (4 bytes - "SQLT")                        │
//	│ Version: uint8                                              │
//	│ Type: uint8 (Query=1, Exec=2, TxBegin=3, TxCommit=4...)    │
//	│ Flags: uint16 (streaming, compression, etc.)                │
//	│ RequestID: uint32                                           │
//	├─────────────────────────────────────────────────────────────┤
//	│ Body (variable)                                             │
//	├─────────────────────────────────────────────────────────────┤
//	│ BodyLength: uint32                                          │
//	│ DatabaseID: string (length-prefixed)                        │
//	│ SQL: string (length-prefixed)                               │
//	│ BindingCount: uint16                                        │
//	│ Bindings: [type:uint8, value:bytes]...                      │
//	└─────────────────────────────────────────────────────────────┘
//
// Response Format:
//
//	┌─────────────────────────────────────────────────────────────┐
//	│ Header (12 bytes)                                           │
//	├─────────────────────────────────────────────────────────────┤
//	│ Magic: 0x53514C54 (4 bytes - "SQLT")                        │
//	│ Version: uint8                                              │
//	│ Type: uint8 (Result=128, Error=129, Rows=130...)           │
//	│ Flags: uint16                                               │
//	│ RequestID: uint32 (matches request)                         │
//	├─────────────────────────────────────────────────────────────┤
//	│ Body (variable)                                             │
//	└─────────────────────────────────────────────────────────────┘
package proto

import (
	"encoding/binary"
	"errors"
	"io"
	"math"
)

// Protocol constants
const (
	// Magic number "SQLT" in little-endian
	MagicNumber uint32 = 0x544C5153

	// Protocol version
	ProtocolVersion uint8 = 1

	// Header size in bytes
	HeaderSize = 12
)

// Message types
const (
	TypeQuery    uint8 = 1   // SELECT query
	TypeExec     uint8 = 2   // INSERT/UPDATE/DELETE
	TypeTxBegin  uint8 = 3   // Begin transaction
	TypeTxCommit uint8 = 4   // Commit transaction
	TypeTxRoll   uint8 = 5   // Rollback transaction
	TypePing     uint8 = 6   // Health check
	TypeResult   uint8 = 128 // Query result
	TypeError    uint8 = 129 // Error response
	TypeRows     uint8 = 130 // Row data (streaming)
	TypeRowsEnd  uint8 = 131 // End of rows
	TypePong     uint8 = 134 // Ping response
)

// Flags
const (
	FlagStreaming   uint16 = 1 << 0 // Enable streaming results
	FlagCompression uint16 = 1 << 1 // Enable compression
	FlagAssoc       uint16 = 1 << 2 // Return associative arrays
)

// Value types for bindings
const (
	ValueNull    uint8 = 0
	ValueInt64   uint8 = 1
	ValueFloat64 uint8 = 2
	ValueString  uint8 = 3
	ValueBlob    uint8 = 4
	ValueBool    uint8 = 5
)

// Header represents a protocol message header
type Header struct {
	Magic     uint32
	Version   uint8
	Type      uint8
	Flags     uint16
	RequestID uint32
}

// Request represents a query or exec request
type Request struct {
	Header
	DatabaseID string
	SQL        string
	Bindings   []Value
}

// Value represents a binding value or result column
type Value struct {
	Type uint8
	Data []byte
}

// Response represents a query response
type Response struct {
	Header
	Success bool
	Error   string
	Columns []string
	Rows    [][]Value
	// For exec results
	LastInsertID int64
	RowsAffected int64
}

// Errors
var (
	ErrInvalidMagic    = errors.New("invalid magic number")
	ErrInvalidVersion  = errors.New("unsupported protocol version")
	ErrInvalidMessage  = errors.New("invalid message format")
	ErrMessageTooLarge = errors.New("message exceeds maximum size")
)

// MaxMessageSize is the maximum allowed message size (16MB)
const MaxMessageSize = 16 * 1024 * 1024

// ReadHeader reads a message header from the reader
func ReadHeader(r io.Reader) (*Header, error) {
	buf := make([]byte, HeaderSize)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}

	h := &Header{
		Magic:     binary.LittleEndian.Uint32(buf[0:4]),
		Version:   buf[4],
		Type:      buf[5],
		Flags:     binary.LittleEndian.Uint16(buf[6:8]),
		RequestID: binary.LittleEndian.Uint32(buf[8:12]),
	}

	if h.Magic != MagicNumber {
		return nil, ErrInvalidMagic
	}

	if h.Version > ProtocolVersion {
		return nil, ErrInvalidVersion
	}

	return h, nil
}

// WriteHeader writes a message header to the writer
func WriteHeader(w io.Writer, h *Header) error {
	buf := make([]byte, HeaderSize)
	binary.LittleEndian.PutUint32(buf[0:4], MagicNumber)
	buf[4] = h.Version
	buf[5] = h.Type
	binary.LittleEndian.PutUint16(buf[6:8], h.Flags)
	binary.LittleEndian.PutUint32(buf[8:12], h.RequestID)
	_, err := w.Write(buf)
	return err
}

// ReadString reads a length-prefixed string
func ReadString(r io.Reader) (string, error) {
	lenBuf := make([]byte, 4)
	if _, err := io.ReadFull(r, lenBuf); err != nil {
		return "", err
	}
	length := binary.LittleEndian.Uint32(lenBuf)

	if length > MaxMessageSize {
		return "", ErrMessageTooLarge
	}

	if length == 0 {
		return "", nil
	}

	strBuf := make([]byte, length)
	if _, err := io.ReadFull(r, strBuf); err != nil {
		return "", err
	}

	return string(strBuf), nil
}

// WriteString writes a length-prefixed string
func WriteString(w io.Writer, s string) error {
	lenBuf := make([]byte, 4)
	binary.LittleEndian.PutUint32(lenBuf, uint32(len(s)))
	if _, err := w.Write(lenBuf); err != nil {
		return err
	}
	if len(s) > 0 {
		_, err := w.Write([]byte(s))
		return err
	}
	return nil
}

// ReadValue reads a typed value
func ReadValue(r io.Reader) (*Value, error) {
	typeBuf := make([]byte, 1)
	if _, err := io.ReadFull(r, typeBuf); err != nil {
		return nil, err
	}

	v := &Value{Type: typeBuf[0]}

	if v.Type == ValueNull {
		return v, nil
	}

	lenBuf := make([]byte, 4)
	if _, err := io.ReadFull(r, lenBuf); err != nil {
		return nil, err
	}
	length := binary.LittleEndian.Uint32(lenBuf)

	if length > MaxMessageSize {
		return nil, ErrMessageTooLarge
	}

	if length > 0 {
		v.Data = make([]byte, length)
		if _, err := io.ReadFull(r, v.Data); err != nil {
			return nil, err
		}
	}

	return v, nil
}

// WriteValue writes a typed value
func WriteValue(w io.Writer, v *Value) error {
	if _, err := w.Write([]byte{v.Type}); err != nil {
		return err
	}

	if v.Type == ValueNull {
		return nil
	}

	lenBuf := make([]byte, 4)
	binary.LittleEndian.PutUint32(lenBuf, uint32(len(v.Data)))
	if _, err := w.Write(lenBuf); err != nil {
		return err
	}

	if len(v.Data) > 0 {
		_, err := w.Write(v.Data)
		return err
	}

	return nil
}

// ReadRequest reads a complete request from the reader
func ReadRequest(r io.Reader) (*Request, error) {
	h, err := ReadHeader(r)
	if err != nil {
		return nil, err
	}

	req := &Request{Header: *h}

	// Read body length
	lenBuf := make([]byte, 4)
	if _, err := io.ReadFull(r, lenBuf); err != nil {
		return nil, err
	}
	bodyLen := binary.LittleEndian.Uint32(lenBuf)

	if bodyLen > MaxMessageSize {
		return nil, ErrMessageTooLarge
	}

	// Read database ID
	req.DatabaseID, err = ReadString(r)
	if err != nil {
		return nil, err
	}

	// Read SQL
	req.SQL, err = ReadString(r)
	if err != nil {
		return nil, err
	}

	// Read binding count
	countBuf := make([]byte, 2)
	if _, err := io.ReadFull(r, countBuf); err != nil {
		return nil, err
	}
	bindingCount := binary.LittleEndian.Uint16(countBuf)

	// Read bindings
	req.Bindings = make([]Value, bindingCount)
	for i := uint16(0); i < bindingCount; i++ {
		v, err := ReadValue(r)
		if err != nil {
			return nil, err
		}
		req.Bindings[i] = *v
	}

	return req, nil
}

// WriteRequest writes a complete request to the writer
func WriteRequest(w io.Writer, req *Request) error {
	if err := WriteHeader(w, &req.Header); err != nil {
		return err
	}

	// Calculate body length (approximate, we'll write it properly)
	bodyLen := uint32(4 + len(req.DatabaseID) + 4 + len(req.SQL) + 2)
	for _, v := range req.Bindings {
		bodyLen += 1 + 4 + uint32(len(v.Data))
	}

	// Write body length
	lenBuf := make([]byte, 4)
	binary.LittleEndian.PutUint32(lenBuf, bodyLen)
	if _, err := w.Write(lenBuf); err != nil {
		return err
	}

	// Write database ID
	if err := WriteString(w, req.DatabaseID); err != nil {
		return err
	}

	// Write SQL
	if err := WriteString(w, req.SQL); err != nil {
		return err
	}

	// Write binding count
	countBuf := make([]byte, 2)
	binary.LittleEndian.PutUint16(countBuf, uint16(len(req.Bindings)))
	if _, err := w.Write(countBuf); err != nil {
		return err
	}

	// Write bindings
	for _, v := range req.Bindings {
		if err := WriteValue(w, &v); err != nil {
			return err
		}
	}

	return nil
}

// WriteErrorResponse writes an error response
func WriteErrorResponse(w io.Writer, requestID uint32, errMsg string) error {
	h := &Header{
		Magic:     MagicNumber,
		Version:   ProtocolVersion,
		Type:      TypeError,
		Flags:     0,
		RequestID: requestID,
	}

	if err := WriteHeader(w, h); err != nil {
		return err
	}

	return WriteString(w, errMsg)
}

// WriteSuccessResponse writes a success response for exec operations
func WriteSuccessResponse(w io.Writer, requestID uint32, lastInsertID, rowsAffected int64) error {
	h := &Header{
		Magic:     MagicNumber,
		Version:   ProtocolVersion,
		Type:      TypeResult,
		Flags:     0,
		RequestID: requestID,
	}

	if err := WriteHeader(w, h); err != nil {
		return err
	}

	// Write success flag
	if _, err := w.Write([]byte{1}); err != nil {
		return err
	}

	// Write lastInsertID
	buf := make([]byte, 8)
	binary.LittleEndian.PutUint64(buf, uint64(lastInsertID))
	if _, err := w.Write(buf); err != nil {
		return err
	}

	// Write rowsAffected
	binary.LittleEndian.PutUint64(buf, uint64(rowsAffected))
	_, err := w.Write(buf)
	return err
}

// ValueFromInt64 creates a Value from int64
func ValueFromInt64(v int64) Value {
	buf := make([]byte, 8)
	binary.LittleEndian.PutUint64(buf, uint64(v))
	return Value{Type: ValueInt64, Data: buf}
}

// ValueFromFloat64 creates a Value from float64
func ValueFromFloat64(v float64) Value {
	buf := make([]byte, 8)
	bits := math.Float64bits(v)
	binary.LittleEndian.PutUint64(buf, bits)
	return Value{Type: ValueFloat64, Data: buf}
}

// ValueFromString creates a Value from string
func ValueFromString(s string) Value {
	return Value{Type: ValueString, Data: []byte(s)}
}

// ValueFromBlob creates a Value from bytes
func ValueFromBlob(b []byte) Value {
	return Value{Type: ValueBlob, Data: b}
}

// ValueFromBool creates a Value from bool
func ValueFromBool(b bool) Value {
	if b {
		return Value{Type: ValueBool, Data: []byte{1}}
	}
	return Value{Type: ValueBool, Data: []byte{0}}
}

// ValueNull creates a null Value
func ValueNullV() Value {
	return Value{Type: ValueNull}
}

// AsInt64 converts the value to int64
func (v *Value) AsInt64() int64 {
	if v.Type != ValueInt64 || len(v.Data) != 8 {
		return 0
	}
	return int64(binary.LittleEndian.Uint64(v.Data))
}

// AsFloat64 converts the value to float64
func (v *Value) AsFloat64() float64 {
	if v.Type != ValueFloat64 || len(v.Data) != 8 {
		return 0
	}
	bits := binary.LittleEndian.Uint64(v.Data)
	return math.Float64frombits(bits)
}

// AsString converts the value to string
func (v *Value) AsString() string {
	if v.Type != ValueString {
		return ""
	}
	return string(v.Data)
}

// AsBlob converts the value to bytes
func (v *Value) AsBlob() []byte {
	if v.Type != ValueBlob {
		return nil
	}
	return v.Data
}

// AsBool converts the value to bool
func (v *Value) AsBool() bool {
	if v.Type != ValueBool || len(v.Data) != 1 {
		return false
	}
	return v.Data[0] != 0
}

// IsNull returns true if the value is null
func (v *Value) IsNull() bool {
	return v.Type == ValueNull
}
