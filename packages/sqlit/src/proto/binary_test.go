package proto

import (
	"bytes"
	"testing"
)

func TestMagicNumber(t *testing.T) {
	// SQLT in little-endian
	expected := uint32(0x544C5153)
	if MagicNumber != expected {
		t.Errorf("expected magic number %x, got %x", expected, MagicNumber)
	}
}

func TestReadWriteHeader(t *testing.T) {
	original := &Header{
		Magic:     MagicNumber,
		Version:   ProtocolVersion,
		Type:      TypeQuery,
		Flags:     FlagStreaming | FlagAssoc,
		RequestID: 12345,
	}

	var buf bytes.Buffer
	err := WriteHeader(&buf, original)
	if err != nil {
		t.Fatalf("WriteHeader failed: %v", err)
	}

	if buf.Len() != HeaderSize {
		t.Fatalf("expected header size %d, got %d", HeaderSize, buf.Len())
	}

	header, err := ReadHeader(&buf)
	if err != nil {
		t.Fatalf("ReadHeader failed: %v", err)
	}

	if header.Magic != original.Magic {
		t.Errorf("magic mismatch: expected %x, got %x", original.Magic, header.Magic)
	}
	if header.Version != original.Version {
		t.Errorf("version mismatch: expected %d, got %d", original.Version, header.Version)
	}
	if header.Type != original.Type {
		t.Errorf("type mismatch: expected %d, got %d", original.Type, header.Type)
	}
	if header.Flags != original.Flags {
		t.Errorf("flags mismatch: expected %d, got %d", original.Flags, header.Flags)
	}
	if header.RequestID != original.RequestID {
		t.Errorf("requestID mismatch: expected %d, got %d", original.RequestID, header.RequestID)
	}
}

func TestReadWriteString(t *testing.T) {
	tests := []string{
		"",
		"hello",
		"SELECT * FROM users WHERE id = ?",
		"unicode: 日本語 emoji: 🎉",
	}

	for _, original := range tests {
		var buf bytes.Buffer
		err := WriteString(&buf, original)
		if err != nil {
			t.Fatalf("WriteString failed for %q: %v", original, err)
		}

		result, err := ReadString(&buf)
		if err != nil {
			t.Fatalf("ReadString failed for %q: %v", original, err)
		}

		if result != original {
			t.Errorf("string mismatch: expected %q, got %q", original, result)
		}
	}
}

func TestReadWriteValue(t *testing.T) {
	tests := []struct {
		name  string
		value Value
	}{
		{"null", ValueNullV()},
		{"int64", ValueFromInt64(42)},
		{"int64_negative", ValueFromInt64(-12345678901234)},
		{"float64", ValueFromFloat64(3.14159)},
		{"string", ValueFromString("hello world")},
		{"blob", ValueFromBlob([]byte{0x00, 0x01, 0x02, 0xff})},
		{"bool_true", ValueFromBool(true)},
		{"bool_false", ValueFromBool(false)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := WriteValue(&buf, &tt.value)
			if err != nil {
				t.Fatalf("WriteValue failed: %v", err)
			}

			result, err := ReadValue(&buf)
			if err != nil {
				t.Fatalf("ReadValue failed: %v", err)
			}

			if result.Type != tt.value.Type {
				t.Errorf("type mismatch: expected %d, got %d", tt.value.Type, result.Type)
			}

			if tt.value.Type != ValueNull {
				if !bytes.Equal(result.Data, tt.value.Data) {
					t.Errorf("data mismatch: expected %v, got %v", tt.value.Data, result.Data)
				}
			}
		})
	}
}

func TestValueConversions(t *testing.T) {
	// Int64
	intVal := ValueFromInt64(-9223372036854775808)
	if intVal.AsInt64() != -9223372036854775808 {
		t.Errorf("int64 conversion failed")
	}

	// Float64
	floatVal := ValueFromFloat64(2.718281828)
	if floatVal.AsFloat64() != 2.718281828 {
		t.Errorf("float64 conversion failed")
	}

	// String
	strVal := ValueFromString("test string")
	if strVal.AsString() != "test string" {
		t.Errorf("string conversion failed")
	}

	// Blob
	blobVal := ValueFromBlob([]byte{1, 2, 3})
	blob := blobVal.AsBlob()
	if len(blob) != 3 || blob[0] != 1 || blob[1] != 2 || blob[2] != 3 {
		t.Errorf("blob conversion failed")
	}

	// Bool
	boolVal := ValueFromBool(true)
	if !boolVal.AsBool() {
		t.Errorf("bool conversion failed")
	}

	// Null
	nullVal := ValueNullV()
	if !nullVal.IsNull() {
		t.Errorf("null check failed")
	}
}

func TestReadWriteRequest(t *testing.T) {
	original := &Request{
		Header: Header{
			Magic:     MagicNumber,
			Version:   ProtocolVersion,
			Type:      TypeQuery,
			Flags:     FlagAssoc,
			RequestID: 99999,
		},
		DatabaseID: "test-database-id",
		SQL:        "SELECT * FROM users WHERE id = ? AND name = ?",
		Bindings: []Value{
			ValueFromInt64(42),
			ValueFromString("Alice"),
		},
	}

	var buf bytes.Buffer
	err := WriteRequest(&buf, original)
	if err != nil {
		t.Fatalf("WriteRequest failed: %v", err)
	}

	result, err := ReadRequest(&buf)
	if err != nil {
		t.Fatalf("ReadRequest failed: %v", err)
	}

	if result.RequestID != original.RequestID {
		t.Errorf("requestID mismatch: expected %d, got %d", original.RequestID, result.RequestID)
	}
	if result.DatabaseID != original.DatabaseID {
		t.Errorf("databaseID mismatch: expected %q, got %q", original.DatabaseID, result.DatabaseID)
	}
	if result.SQL != original.SQL {
		t.Errorf("SQL mismatch: expected %q, got %q", original.SQL, result.SQL)
	}
	if len(result.Bindings) != len(original.Bindings) {
		t.Errorf("bindings count mismatch: expected %d, got %d", len(original.Bindings), len(result.Bindings))
	}
}

func TestWriteErrorResponse(t *testing.T) {
	var buf bytes.Buffer
	err := WriteErrorResponse(&buf, 12345, "test error message")
	if err != nil {
		t.Fatalf("WriteErrorResponse failed: %v", err)
	}

	// Read header
	header, err := ReadHeader(&buf)
	if err != nil {
		t.Fatalf("ReadHeader failed: %v", err)
	}

	if header.Type != TypeError {
		t.Errorf("expected type %d, got %d", TypeError, header.Type)
	}
	if header.RequestID != 12345 {
		t.Errorf("expected requestID 12345, got %d", header.RequestID)
	}

	// Read error message
	errMsg, err := ReadString(&buf)
	if err != nil {
		t.Fatalf("ReadString failed: %v", err)
	}
	if errMsg != "test error message" {
		t.Errorf("expected error message %q, got %q", "test error message", errMsg)
	}
}

func TestWriteSuccessResponse(t *testing.T) {
	var buf bytes.Buffer
	err := WriteSuccessResponse(&buf, 54321, 100, 5)
	if err != nil {
		t.Fatalf("WriteSuccessResponse failed: %v", err)
	}

	// Read header
	header, err := ReadHeader(&buf)
	if err != nil {
		t.Fatalf("ReadHeader failed: %v", err)
	}

	if header.Type != TypeResult {
		t.Errorf("expected type %d, got %d", TypeResult, header.Type)
	}
	if header.RequestID != 54321 {
		t.Errorf("expected requestID 54321, got %d", header.RequestID)
	}

	// Read success flag
	successBuf := make([]byte, 1)
	if _, err := buf.Read(successBuf); err != nil {
		t.Fatalf("Read success flag failed: %v", err)
	}
	if successBuf[0] != 1 {
		t.Errorf("expected success flag 1, got %d", successBuf[0])
	}
}

func TestInvalidMagic(t *testing.T) {
	buf := []byte{0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}
	_, err := ReadHeader(bytes.NewReader(buf))
	if err != ErrInvalidMagic {
		t.Errorf("expected ErrInvalidMagic, got %v", err)
	}
}

func TestTruncatedHeader(t *testing.T) {
	buf := []byte{0x53, 0x51, 0x4C, 0x54} // Only magic number
	_, err := ReadHeader(bytes.NewReader(buf))
	if err == nil {
		t.Error("expected error for truncated header")
	}
}

func BenchmarkWriteRequest(b *testing.B) {
	req := &Request{
		Header: Header{
			Magic:     MagicNumber,
			Version:   ProtocolVersion,
			Type:      TypeQuery,
			Flags:     FlagAssoc,
			RequestID: 1,
		},
		DatabaseID: "benchmark-db",
		SQL:        "SELECT id, name, email, created_at FROM users WHERE status = ? ORDER BY id LIMIT ?",
		Bindings: []Value{
			ValueFromString("active"),
			ValueFromInt64(100),
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var buf bytes.Buffer
		WriteRequest(&buf, req)
	}
}

func BenchmarkReadRequest(b *testing.B) {
	req := &Request{
		Header: Header{
			Magic:     MagicNumber,
			Version:   ProtocolVersion,
			Type:      TypeQuery,
			Flags:     FlagAssoc,
			RequestID: 1,
		},
		DatabaseID: "benchmark-db",
		SQL:        "SELECT id, name, email, created_at FROM users WHERE status = ? ORDER BY id LIMIT ?",
		Bindings: []Value{
			ValueFromString("active"),
			ValueFromInt64(100),
		},
	}

	var buf bytes.Buffer
	WriteRequest(&buf, req)
	data := buf.Bytes()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ReadRequest(bytes.NewReader(data))
	}
}
