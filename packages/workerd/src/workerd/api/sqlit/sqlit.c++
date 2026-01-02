// Copyright (c) 2024 Jeju Network
// Native SQLit bindings for workerd

#include "sqlit.h"

#include <workerd/io/io-context.h>
#include <workerd/jsg/jsg.h>

#include <kj/async-io.h>
#include <kj/debug.h>
#include <kj/encoding.h>

namespace workerd::api::sqlit {

namespace {

// Binary protocol constants
constexpr uint32_t MAGIC_NUMBER = 0x544C5153;  // "SQLT" little-endian
constexpr uint8_t PROTOCOL_VERSION = 1;
constexpr size_t HEADER_SIZE = 12;
constexpr size_t MAX_MESSAGE_SIZE = 16 * 1024 * 1024;  // 16MB

// Message types
constexpr uint8_t TYPE_QUERY = 1;
constexpr uint8_t TYPE_EXEC = 2;
constexpr uint8_t TYPE_TX_BEGIN = 3;
constexpr uint8_t TYPE_TX_COMMIT = 4;
constexpr uint8_t TYPE_TX_ROLLBACK = 5;
constexpr uint8_t TYPE_PING = 6;
constexpr uint8_t TYPE_RESULT = 128;
constexpr uint8_t TYPE_ERROR = 129;
constexpr uint8_t TYPE_ROWS = 130;
constexpr uint8_t TYPE_ROWS_END = 131;
constexpr uint8_t TYPE_PONG = 134;

// Value types
constexpr uint8_t VALUE_NULL = 0;
constexpr uint8_t VALUE_INT64 = 1;
constexpr uint8_t VALUE_FLOAT64 = 2;
constexpr uint8_t VALUE_STRING = 3;
constexpr uint8_t VALUE_BLOB = 4;
constexpr uint8_t VALUE_BOOL = 5;

// Flags
constexpr uint16_t FLAG_STREAMING = 1 << 0;
constexpr uint16_t FLAG_ASSOC = 1 << 2;

// Helper to write little-endian integers
template <typename T>
void writeLE(kj::ArrayPtr<byte> buf, T value) {
  for (size_t i = 0; i < sizeof(T); ++i) {
    buf[i] = static_cast<byte>((value >> (i * 8)) & 0xFF);
  }
}

// Helper to read little-endian integers
template <typename T>
T readLE(kj::ArrayPtr<const byte> buf) {
  T value = 0;
  for (size_t i = 0; i < sizeof(T); ++i) {
    value |= static_cast<T>(buf[i]) << (i * 8);
  }
  return value;
}

// Convert SQLitValue to wire format
kj::Array<byte> serializeValue(const SQLitValue& value) {
  KJ_IF_SOME(v, value) {
    KJ_SWITCH_ONEOF(v) {
      KJ_CASE_ONEOF(bytes, kj::Array<const byte>) {
        auto result = kj::heapArray<byte>(1 + 4 + bytes.size());
        result[0] = VALUE_BLOB;
        writeLE(result.slice(1, 5), static_cast<uint32_t>(bytes.size()));
        memcpy(result.begin() + 5, bytes.begin(), bytes.size());
        return result;
      }
      KJ_CASE_ONEOF(str, kj::String) {
        auto result = kj::heapArray<byte>(1 + 4 + str.size());
        result[0] = VALUE_STRING;
        writeLE(result.slice(1, 5), static_cast<uint32_t>(str.size()));
        memcpy(result.begin() + 5, str.begin(), str.size());
        return result;
      }
      KJ_CASE_ONEOF(num, double) {
        auto result = kj::heapArray<byte>(1 + 4 + 8);
        result[0] = VALUE_FLOAT64;
        writeLE(result.slice(1, 5), static_cast<uint32_t>(8));
        uint64_t bits;
        memcpy(&bits, &num, sizeof(bits));
        writeLE(result.slice(5, 13), bits);
        return result;
      }
      KJ_CASE_ONEOF(num, int64_t) {
        auto result = kj::heapArray<byte>(1 + 4 + 8);
        result[0] = VALUE_INT64;
        writeLE(result.slice(1, 5), static_cast<uint32_t>(8));
        writeLE(result.slice(5, 13), static_cast<uint64_t>(num));
        return result;
      }
      KJ_CASE_ONEOF(b, bool) {
        auto result = kj::heapArray<byte>(1 + 4 + 1);
        result[0] = VALUE_BOOL;
        writeLE(result.slice(1, 5), static_cast<uint32_t>(1));
        result[5] = b ? 1 : 0;
        return result;
      }
    }
  }
  
  // Null value
  auto result = kj::heapArray<byte>(1);
  result[0] = VALUE_NULL;
  return result;
}

// Parse value from wire format
SQLitValue deserializeValue(kj::ArrayPtr<const byte>& data) {
  KJ_REQUIRE(data.size() >= 1, "truncated value");
  
  uint8_t type = data[0];
  data = data.slice(1, data.size());
  
  if (type == VALUE_NULL) {
    return kj::none;
  }
  
  KJ_REQUIRE(data.size() >= 4, "truncated value length");
  uint32_t len = readLE<uint32_t>(data.slice(0, 4));
  data = data.slice(4, data.size());
  
  KJ_REQUIRE(data.size() >= len, "truncated value data");
  auto valueData = data.slice(0, len);
  data = data.slice(len, data.size());
  
  switch (type) {
    case VALUE_INT64: {
      KJ_REQUIRE(len == 8, "invalid int64 length");
      int64_t value = static_cast<int64_t>(readLE<uint64_t>(valueData));
      return SQLitValue(value);
    }
    case VALUE_FLOAT64: {
      KJ_REQUIRE(len == 8, "invalid float64 length");
      uint64_t bits = readLE<uint64_t>(valueData);
      double value;
      memcpy(&value, &bits, sizeof(value));
      return SQLitValue(value);
    }
    case VALUE_STRING: {
      auto str = kj::heapString(reinterpret_cast<const char*>(valueData.begin()), len);
      return SQLitValue(kj::mv(str));
    }
    case VALUE_BLOB: {
      auto blob = kj::heapArray<const byte>(valueData);
      return SQLitValue(kj::mv(blob));
    }
    case VALUE_BOOL: {
      KJ_REQUIRE(len == 1, "invalid bool length");
      return SQLitValue(valueData[0] != 0);
    }
    default:
      KJ_FAIL_REQUIRE("unknown value type", type);
  }
}

// Build request message
kj::Array<byte> buildRequest(uint8_t type, uint32_t requestId, uint16_t flags,
                              kj::StringPtr databaseId, kj::StringPtr sql,
                              kj::ArrayPtr<SQLitValue> bindings) {
  // Calculate body size
  size_t bodySize = 4;  // body length field
  bodySize += 4 + databaseId.size();  // database ID
  bodySize += 4 + sql.size();  // SQL
  bodySize += 2;  // binding count
  
  kj::Vector<kj::Array<byte>> serializedBindings;
  for (auto& binding : bindings) {
    auto serialized = serializeValue(binding);
    bodySize += serialized.size();
    serializedBindings.add(kj::mv(serialized));
  }
  
  // Build message
  auto message = kj::heapArray<byte>(HEADER_SIZE + bodySize);
  
  // Header
  writeLE(message.slice(0, 4), MAGIC_NUMBER);
  message[4] = PROTOCOL_VERSION;
  message[5] = type;
  writeLE(message.slice(6, 8), flags);
  writeLE(message.slice(8, 12), requestId);
  
  // Body length
  size_t offset = HEADER_SIZE;
  writeLE(message.slice(offset, offset + 4), static_cast<uint32_t>(bodySize - 4));
  offset += 4;
  
  // Database ID
  writeLE(message.slice(offset, offset + 4), static_cast<uint32_t>(databaseId.size()));
  offset += 4;
  memcpy(message.begin() + offset, databaseId.begin(), databaseId.size());
  offset += databaseId.size();
  
  // SQL
  writeLE(message.slice(offset, offset + 4), static_cast<uint32_t>(sql.size()));
  offset += 4;
  memcpy(message.begin() + offset, sql.begin(), sql.size());
  offset += sql.size();
  
  // Binding count
  writeLE(message.slice(offset, offset + 2), static_cast<uint16_t>(bindings.size()));
  offset += 2;
  
  // Bindings
  for (auto& serialized : serializedBindings) {
    memcpy(message.begin() + offset, serialized.begin(), serialized.size());
    offset += serialized.size();
  }
  
  return message;
}

// Parse response header
struct ResponseHeader {
  uint32_t magic;
  uint8_t version;
  uint8_t type;
  uint16_t flags;
  uint32_t requestId;
};

ResponseHeader parseHeader(kj::ArrayPtr<const byte> data) {
  KJ_REQUIRE(data.size() >= HEADER_SIZE, "truncated header");
  
  ResponseHeader header;
  header.magic = readLE<uint32_t>(data.slice(0, 4));
  header.version = data[4];
  header.type = data[5];
  header.flags = readLE<uint16_t>(data.slice(6, 8));
  header.requestId = readLE<uint32_t>(data.slice(8, 12));
  
  KJ_REQUIRE(header.magic == MAGIC_NUMBER, "invalid magic number");
  KJ_REQUIRE(header.version <= PROTOCOL_VERSION, "unsupported protocol version");
  
  return header;
}

// Read length-prefixed string
kj::String readString(kj::ArrayPtr<const byte>& data) {
  KJ_REQUIRE(data.size() >= 4, "truncated string length");
  uint32_t len = readLE<uint32_t>(data.slice(0, 4));
  data = data.slice(4, data.size());
  
  KJ_REQUIRE(data.size() >= len, "truncated string data");
  auto str = kj::heapString(reinterpret_cast<const char*>(data.begin()), len);
  data = data.slice(len, data.size());
  
  return str;
}

}  // namespace

// ============================================================================
// SQLitConnection Implementation
// ============================================================================

SQLitConnection::SQLitConnection(Config config)
    : config(kj::mv(config)) {}

SQLitConnection::~SQLitConnection() {
  close();
}

kj::Promise<void> SQLitConnection::connect() {
  auto& ioContext = IoContext::current();
  auto& network = ioContext.getNetwork();
  
  auto addr = co_await network.parseAddress(
      kj::str(config.host, ":", config.port),
      config.port);
  
  stream = co_await addr->connect();
  connected = true;
}

void SQLitConnection::close() {
  if (stream != nullptr) {
    stream = nullptr;
    connected = false;
  }
}

bool SQLitConnection::isConnected() const {
  return connected;
}

kj::Promise<void> SQLitConnection::writeRequest(uint8_t type, kj::StringPtr sql,
                                                 kj::ArrayPtr<SQLitValue> bindings) {
  static std::atomic<uint32_t> requestIdCounter{0};
  uint32_t requestId = requestIdCounter.fetch_add(1, std::memory_order_relaxed);
  
  auto message = buildRequest(type, requestId, FLAG_ASSOC, config.databaseId, sql, bindings);
  co_await stream->write(message);
}

kj::Promise<kj::Array<byte>> SQLitConnection::readResponse() {
  // Read header first
  auto headerBuf = kj::heapArray<byte>(HEADER_SIZE);
  co_await stream->read(headerBuf.begin(), HEADER_SIZE);
  
  auto header = parseHeader(headerBuf);
  
  // Handle different response types
  if (header.type == TYPE_ERROR) {
    // Read error string length
    auto lenBuf = kj::heapArray<byte>(4);
    co_await stream->read(lenBuf.begin(), 4);
    uint32_t errorLen = readLE<uint32_t>(lenBuf);
    
    KJ_REQUIRE(errorLen <= MAX_MESSAGE_SIZE, "error message too large");
    
    auto errorBuf = kj::heapArray<byte>(errorLen);
    co_await stream->read(errorBuf.begin(), errorLen);
    
    auto errorMsg = kj::heapString(reinterpret_cast<const char*>(errorBuf.begin()), errorLen);
    KJ_FAIL_REQUIRE("SQLit error", errorMsg);
  }
  
  // For result responses, read the full body
  // First byte is success flag
  auto successBuf = kj::heapArray<byte>(1);
  co_await stream->read(successBuf.begin(), 1);
  
  KJ_REQUIRE(successBuf[0] == 1, "query failed");
  
  // Read remaining response - varies by type
  // For simplicity, read until we have all the data
  // In production, would implement proper framing
  
  // Return header + success flag for now
  auto result = kj::heapArray<byte>(HEADER_SIZE + 1);
  memcpy(result.begin(), headerBuf.begin(), HEADER_SIZE);
  result[HEADER_SIZE] = successBuf[0];
  
  co_return result;
}

kj::Promise<kj::Tuple<kj::Array<kj::String>, kj::Array<kj::Array<SQLitValue>>>>
SQLitConnection::query(kj::StringPtr sql, kj::ArrayPtr<SQLitValue> bindings) {
  KJ_REQUIRE(connected, "not connected");
  
  static std::atomic<uint32_t> requestIdCounter{0};
  uint32_t requestId = requestIdCounter.fetch_add(1, std::memory_order_relaxed);
  
  auto message = buildRequest(TYPE_QUERY, requestId, FLAG_ASSOC, config.databaseId, sql, bindings);
  co_await stream->write(message);
  
  // Read header
  auto headerBuf = kj::heapArray<byte>(HEADER_SIZE);
  co_await stream->read(headerBuf.begin(), HEADER_SIZE);
  
  auto header = parseHeader(headerBuf);
  
  if (header.type == TYPE_ERROR) {
    auto lenBuf = kj::heapArray<byte>(4);
    co_await stream->read(lenBuf.begin(), 4);
    uint32_t errorLen = readLE<uint32_t>(lenBuf);
    
    auto errorBuf = kj::heapArray<byte>(errorLen);
    co_await stream->read(errorBuf.begin(), errorLen);
    
    auto errorMsg = kj::heapString(reinterpret_cast<const char*>(errorBuf.begin()), errorLen);
    KJ_FAIL_REQUIRE("SQLit query error", errorMsg);
  }
  
  KJ_REQUIRE(header.type == TYPE_RESULT, "unexpected response type");
  
  // Read success flag
  auto successBuf = kj::heapArray<byte>(1);
  co_await stream->read(successBuf.begin(), 1);
  KJ_REQUIRE(successBuf[0] == 1, "query failed");
  
  // Read column count
  auto colCountBuf = kj::heapArray<byte>(1);
  co_await stream->read(colCountBuf.begin(), 1);
  uint8_t colCount = colCountBuf[0];
  
  // Read column names
  kj::Vector<kj::String> columns;
  for (uint8_t i = 0; i < colCount; ++i) {
    auto lenBuf = kj::heapArray<byte>(4);
    co_await stream->read(lenBuf.begin(), 4);
    uint32_t nameLen = readLE<uint32_t>(lenBuf);
    
    auto nameBuf = kj::heapArray<byte>(nameLen);
    co_await stream->read(nameBuf.begin(), nameLen);
    
    columns.add(kj::heapString(reinterpret_cast<const char*>(nameBuf.begin()), nameLen));
  }
  
  // Read row count
  auto rowCountBuf = kj::heapArray<byte>(4);
  co_await stream->read(rowCountBuf.begin(), 4);
  uint32_t rowCount = readLE<uint32_t>(rowCountBuf);
  
  // Read rows
  kj::Vector<kj::Array<SQLitValue>> rows;
  for (uint32_t r = 0; r < rowCount; ++r) {
    kj::Vector<SQLitValue> row;
    for (uint8_t c = 0; c < colCount; ++c) {
      // Read value type
      auto typeBuf = kj::heapArray<byte>(1);
      co_await stream->read(typeBuf.begin(), 1);
      uint8_t valueType = typeBuf[0];
      
      if (valueType == VALUE_NULL) {
        row.add(kj::none);
        continue;
      }
      
      // Read value length
      auto valLenBuf = kj::heapArray<byte>(4);
      co_await stream->read(valLenBuf.begin(), 4);
      uint32_t valLen = readLE<uint32_t>(valLenBuf);
      
      // Read value data
      auto valData = kj::heapArray<byte>(valLen);
      co_await stream->read(valData.begin(), valLen);
      
      // Parse value
      switch (valueType) {
        case VALUE_INT64: {
          int64_t value = static_cast<int64_t>(readLE<uint64_t>(valData));
          row.add(SQLitValue(value));
          break;
        }
        case VALUE_FLOAT64: {
          uint64_t bits = readLE<uint64_t>(valData);
          double value;
          memcpy(&value, &bits, sizeof(value));
          row.add(SQLitValue(value));
          break;
        }
        case VALUE_STRING: {
          auto str = kj::heapString(reinterpret_cast<const char*>(valData.begin()), valLen);
          row.add(SQLitValue(kj::mv(str)));
          break;
        }
        case VALUE_BLOB: {
          auto blob = kj::heapArray<const byte>(valData.asPtr());
          row.add(SQLitValue(kj::mv(blob)));
          break;
        }
        case VALUE_BOOL: {
          row.add(SQLitValue(valData[0] != 0));
          break;
        }
        default:
          KJ_FAIL_REQUIRE("unknown value type", valueType);
      }
    }
    rows.add(row.releaseAsArray());
  }
  
  co_return kj::tuple(columns.releaseAsArray(), rows.releaseAsArray());
}

kj::Promise<int64_t> SQLitConnection::exec(kj::StringPtr sql, kj::ArrayPtr<SQLitValue> bindings) {
  KJ_REQUIRE(connected, "not connected");
  
  static std::atomic<uint32_t> requestIdCounter{0};
  uint32_t requestId = requestIdCounter.fetch_add(1, std::memory_order_relaxed);
  
  auto message = buildRequest(TYPE_EXEC, requestId, 0, config.databaseId, sql, bindings);
  co_await stream->write(message);
  
  // Read header
  auto headerBuf = kj::heapArray<byte>(HEADER_SIZE);
  co_await stream->read(headerBuf.begin(), HEADER_SIZE);
  
  auto header = parseHeader(headerBuf);
  
  if (header.type == TYPE_ERROR) {
    auto lenBuf = kj::heapArray<byte>(4);
    co_await stream->read(lenBuf.begin(), 4);
    uint32_t errorLen = readLE<uint32_t>(lenBuf);
    
    auto errorBuf = kj::heapArray<byte>(errorLen);
    co_await stream->read(errorBuf.begin(), errorLen);
    
    auto errorMsg = kj::heapString(reinterpret_cast<const char*>(errorBuf.begin()), errorLen);
    KJ_FAIL_REQUIRE("SQLit exec error", errorMsg);
  }
  
  KJ_REQUIRE(header.type == TYPE_RESULT, "unexpected response type");
  
  // Read success flag
  auto successBuf = kj::heapArray<byte>(1);
  co_await stream->read(successBuf.begin(), 1);
  KJ_REQUIRE(successBuf[0] == 1, "exec failed");
  
  // Read lastInsertID
  auto lastIdBuf = kj::heapArray<byte>(8);
  co_await stream->read(lastIdBuf.begin(), 8);
  
  // Read rowsAffected
  auto affectedBuf = kj::heapArray<byte>(8);
  co_await stream->read(affectedBuf.begin(), 8);
  int64_t rowsAffected = static_cast<int64_t>(readLE<uint64_t>(affectedBuf));
  
  co_return rowsAffected;
}

kj::Promise<bool> SQLitConnection::ping() {
  KJ_REQUIRE(connected, "not connected");
  
  static std::atomic<uint32_t> requestIdCounter{0};
  uint32_t requestId = requestIdCounter.fetch_add(1, std::memory_order_relaxed);
  
  // Build ping message (header only, no body)
  auto message = kj::heapArray<byte>(HEADER_SIZE);
  writeLE(message.slice(0, 4), MAGIC_NUMBER);
  message[4] = PROTOCOL_VERSION;
  message[5] = TYPE_PING;
  writeLE(message.slice(6, 8), static_cast<uint16_t>(0));
  writeLE(message.slice(8, 12), requestId);
  
  co_await stream->write(message);
  
  // Read response
  auto headerBuf = kj::heapArray<byte>(HEADER_SIZE);
  co_await stream->read(headerBuf.begin(), HEADER_SIZE);
  
  auto header = parseHeader(headerBuf);
  
  co_return header.type == TYPE_PONG;
}

kj::Promise<kj::String> SQLitConnection::beginTransaction() {
  KJ_REQUIRE(connected, "not connected");
  
  static std::atomic<uint32_t> requestIdCounter{0};
  uint32_t requestId = requestIdCounter.fetch_add(1, std::memory_order_relaxed);
  
  // Build transaction begin message
  auto message = kj::heapArray<byte>(HEADER_SIZE + 4 + 4 + config.databaseId.size() + 4 + 2);
  
  writeLE(message.slice(0, 4), MAGIC_NUMBER);
  message[4] = PROTOCOL_VERSION;
  message[5] = TYPE_TX_BEGIN;
  writeLE(message.slice(6, 8), static_cast<uint16_t>(0));
  writeLE(message.slice(8, 12), requestId);
  
  size_t offset = HEADER_SIZE;
  uint32_t bodyLen = 4 + config.databaseId.size() + 4 + 2;
  writeLE(message.slice(offset, offset + 4), bodyLen);
  offset += 4;
  
  writeLE(message.slice(offset, offset + 4), static_cast<uint32_t>(config.databaseId.size()));
  offset += 4;
  memcpy(message.begin() + offset, config.databaseId.begin(), config.databaseId.size());
  offset += config.databaseId.size();
  
  // Empty SQL
  writeLE(message.slice(offset, offset + 4), static_cast<uint32_t>(0));
  offset += 4;
  
  // Zero bindings
  writeLE(message.slice(offset, offset + 2), static_cast<uint16_t>(0));
  
  co_await stream->write(message);
  
  // Read response
  auto headerBuf = kj::heapArray<byte>(HEADER_SIZE);
  co_await stream->read(headerBuf.begin(), HEADER_SIZE);
  
  auto header = parseHeader(headerBuf);
  
  if (header.type == TYPE_ERROR) {
    auto lenBuf = kj::heapArray<byte>(4);
    co_await stream->read(lenBuf.begin(), 4);
    uint32_t errorLen = readLE<uint32_t>(lenBuf);
    
    auto errorBuf = kj::heapArray<byte>(errorLen);
    co_await stream->read(errorBuf.begin(), errorLen);
    
    auto errorMsg = kj::heapString(reinterpret_cast<const char*>(errorBuf.begin()), errorLen);
    KJ_FAIL_REQUIRE("SQLit beginTransaction error", errorMsg);
  }
  
  // Read success flag
  auto successBuf = kj::heapArray<byte>(1);
  co_await stream->read(successBuf.begin(), 1);
  KJ_REQUIRE(successBuf[0] == 1, "beginTransaction failed");
  
  // Read transaction ID
  auto txIdLenBuf = kj::heapArray<byte>(4);
  co_await stream->read(txIdLenBuf.begin(), 4);
  uint32_t txIdLen = readLE<uint32_t>(txIdLenBuf);
  
  auto txIdBuf = kj::heapArray<byte>(txIdLen);
  co_await stream->read(txIdBuf.begin(), txIdLen);
  
  co_return kj::heapString(reinterpret_cast<const char*>(txIdBuf.begin()), txIdLen);
}

kj::Promise<void> SQLitConnection::commitTransaction(kj::StringPtr txId) {
  KJ_REQUIRE(connected, "not connected");
  
  static std::atomic<uint32_t> requestIdCounter{0};
  uint32_t requestId = requestIdCounter.fetch_add(1, std::memory_order_relaxed);
  
  // Include transaction ID in SQL field
  auto message = buildRequest(TYPE_TX_COMMIT, requestId, 0, config.databaseId, txId, {});
  co_await stream->write(message);
  
  // Read response
  auto headerBuf = kj::heapArray<byte>(HEADER_SIZE);
  co_await stream->read(headerBuf.begin(), HEADER_SIZE);
  
  auto header = parseHeader(headerBuf);
  
  if (header.type == TYPE_ERROR) {
    auto lenBuf = kj::heapArray<byte>(4);
    co_await stream->read(lenBuf.begin(), 4);
    uint32_t errorLen = readLE<uint32_t>(lenBuf);
    
    auto errorBuf = kj::heapArray<byte>(errorLen);
    co_await stream->read(errorBuf.begin(), errorLen);
    
    auto errorMsg = kj::heapString(reinterpret_cast<const char*>(errorBuf.begin()), errorLen);
    KJ_FAIL_REQUIRE("SQLit commit error", errorMsg);
  }
  
  // Read success flag
  auto successBuf = kj::heapArray<byte>(1);
  co_await stream->read(successBuf.begin(), 1);
  KJ_REQUIRE(successBuf[0] == 1, "commit failed");
}

kj::Promise<void> SQLitConnection::rollbackTransaction(kj::StringPtr txId) {
  KJ_REQUIRE(connected, "not connected");
  
  static std::atomic<uint32_t> requestIdCounter{0};
  uint32_t requestId = requestIdCounter.fetch_add(1, std::memory_order_relaxed);
  
  auto message = buildRequest(TYPE_TX_ROLLBACK, requestId, 0, config.databaseId, txId, {});
  co_await stream->write(message);
  
  // Read response
  auto headerBuf = kj::heapArray<byte>(HEADER_SIZE);
  co_await stream->read(headerBuf.begin(), HEADER_SIZE);
  
  auto header = parseHeader(headerBuf);
  
  if (header.type == TYPE_ERROR) {
    auto lenBuf = kj::heapArray<byte>(4);
    co_await stream->read(lenBuf.begin(), 4);
    uint32_t errorLen = readLE<uint32_t>(lenBuf);
    
    auto errorBuf = kj::heapArray<byte>(errorLen);
    co_await stream->read(errorBuf.begin(), errorLen);
    
    auto errorMsg = kj::heapString(reinterpret_cast<const char*>(errorBuf.begin()), errorLen);
    KJ_FAIL_REQUIRE("SQLit rollback error", errorMsg);
  }
  
  // Read success flag
  auto successBuf = kj::heapArray<byte>(1);
  co_await stream->read(successBuf.begin(), 1);
  KJ_REQUIRE(successBuf[0] == 1, "rollback failed");
}

// ============================================================================
// SQLitConnectionPool Implementation
// ============================================================================

SQLitConnectionPool::SQLitConnectionPool(Config config)
    : config(kj::mv(config)) {}

SQLitConnectionPool::~SQLitConnectionPool() {
  // Close all connections
  for (auto& conn : available) {
    conn->close();
  }
}

kj::Promise<kj::Own<SQLitConnection>> SQLitConnectionPool::acquire() {
  // Try to get an available connection
  if (!available.empty()) {
    auto conn = kj::mv(available.back());
    available.removeLast();
    ++inUse;
    co_return kj::mv(conn);
  }
  
  // Check if we can create a new connection
  if (inUse < config.poolSize) {
    SQLitConnection::Config connConfig {
      .host = kj::heapString(config.host),
      .port = config.port,
      .databaseId = kj::heapString(config.databaseId),
      .timeoutMs = config.timeoutMs
    };
    
    auto conn = kj::heap<SQLitConnection>(kj::mv(connConfig));
    co_await conn->connect();
    ++inUse;
    co_return kj::mv(conn);
  }
  
  // Wait for a connection to become available
  auto paf = kj::newPromiseAndFulfiller<kj::Own<SQLitConnection>>();
  
  {
    auto lock = waiters.lockExclusive();
    lock->add(kj::mv(paf.fulfiller));
  }
  
  co_return co_await kj::mv(paf.promise);
}

void SQLitConnectionPool::release(kj::Own<SQLitConnection> conn) {
  --inUse;
  
  // Check if anyone is waiting
  {
    auto lock = waiters.lockExclusive();
    if (!lock->empty()) {
      auto fulfiller = kj::mv(lock->back());
      lock->removeLast();
      fulfiller->fulfill(kj::mv(conn));
      ++inUse;
      return;
    }
  }
  
  // Return to pool
  if (conn->isConnected()) {
    available.add(kj::mv(conn));
  }
}

SQLitConnectionPool::Stats SQLitConnectionPool::getStats() const {
  return {
    .total = config.poolSize,
    .available = static_cast<uint32_t>(available.size()),
    .inUse = inUse
  };
}

// ============================================================================
// SQLitCursor Implementation
// ============================================================================

SQLitCursor::SQLitCursor(kj::Array<kj::String> columns,
                         kj::Array<kj::Array<SQLitValue>> rows)
    : columns(kj::mv(columns)),
      rows(kj::mv(rows)) {}

SQLitCursor::~SQLitCursor() noexcept(false) {}

SQLitCursor::NextResult SQLitCursor::next(jsg::Lock& js) {
  if (currentRow >= rows.size()) {
    return { .done = true, .value = kj::none };
  }
  
  auto& row = rows[currentRow++];
  auto obj = js.obj();
  
  for (size_t i = 0; i < columns.size() && i < row.size(); ++i) {
    KJ_IF_SOME(v, row[i]) {
      KJ_SWITCH_ONEOF(v) {
        KJ_CASE_ONEOF(bytes, kj::Array<const byte>) {
          obj.set(js, columns[i], js.wrapBytes(kj::heapArray(bytes)));
        }
        KJ_CASE_ONEOF(str, kj::String) {
          obj.set(js, columns[i], js.str(str));
        }
        KJ_CASE_ONEOF(num, double) {
          obj.set(js, columns[i], js.num(num));
        }
        KJ_CASE_ONEOF(num, int64_t) {
          obj.set(js, columns[i], js.num(static_cast<double>(num)));
        }
        KJ_CASE_ONEOF(b, bool) {
          obj.set(js, columns[i], js.boolean(b));
        }
      }
    } else {
      obj.set(js, columns[i], js.null());
    }
  }
  
  return { .done = false, .value = kj::mv(obj) };
}

jsg::JsArray SQLitCursor::toArray(jsg::Lock& js) {
  auto arr = js.arr();
  
  for (auto& row : rows) {
    auto obj = js.obj();
    
    for (size_t i = 0; i < columns.size() && i < row.size(); ++i) {
      KJ_IF_SOME(v, row[i]) {
        KJ_SWITCH_ONEOF(v) {
          KJ_CASE_ONEOF(bytes, kj::Array<const byte>) {
            obj.set(js, columns[i], js.wrapBytes(kj::heapArray(bytes)));
          }
          KJ_CASE_ONEOF(str, kj::String) {
            obj.set(js, columns[i], js.str(str));
          }
          KJ_CASE_ONEOF(num, double) {
            obj.set(js, columns[i], js.num(num));
          }
          KJ_CASE_ONEOF(num, int64_t) {
            obj.set(js, columns[i], js.num(static_cast<double>(num)));
          }
          KJ_CASE_ONEOF(b, bool) {
            obj.set(js, columns[i], js.boolean(b));
          }
        }
      } else {
        obj.set(js, columns[i], js.null());
      }
    }
    
    arr.add(js, kj::mv(obj));
  }
  
  return arr;
}

jsg::JsValue SQLitCursor::one(jsg::Lock& js) {
  JSG_REQUIRE(rows.size() == 1, Error,
      "Expected exactly one row, got ", rows.size());
  
  auto& row = rows[0];
  auto obj = js.obj();
  
  for (size_t i = 0; i < columns.size() && i < row.size(); ++i) {
    KJ_IF_SOME(v, row[i]) {
      KJ_SWITCH_ONEOF(v) {
        KJ_CASE_ONEOF(bytes, kj::Array<const byte>) {
          obj.set(js, columns[i], js.wrapBytes(kj::heapArray(bytes)));
        }
        KJ_CASE_ONEOF(str, kj::String) {
          obj.set(js, columns[i], js.str(str));
        }
        KJ_CASE_ONEOF(num, double) {
          obj.set(js, columns[i], js.num(num));
        }
        KJ_CASE_ONEOF(num, int64_t) {
          obj.set(js, columns[i], js.num(static_cast<double>(num)));
        }
        KJ_CASE_ONEOF(b, bool) {
          obj.set(js, columns[i], js.boolean(b));
        }
      }
    } else {
      obj.set(js, columns[i], js.null());
    }
  }
  
  return jsg::JsValue(kj::mv(obj));
}

jsg::JsArray SQLitCursor::getColumnNames(jsg::Lock& js) {
  auto arr = js.arr();
  for (auto& col : columns) {
    arr.add(js, js.str(col));
  }
  return arr;
}

double SQLitCursor::getRowCount() {
  return static_cast<double>(rows.size());
}

kj::Maybe<jsg::JsObject> SQLitCursor::rowIteratorNext(jsg::Lock& js, jsg::Ref<SQLitCursor>& obj) {
  if (obj->currentRow >= obj->rows.size()) {
    return kj::none;
  }
  
  auto result = obj->next(js);
  KJ_IF_SOME(v, result.value) {
    return kj::mv(v);
  }
  return kj::none;
}

kj::Maybe<jsg::JsArray> SQLitCursor::rawIteratorNext(jsg::Lock& js, jsg::Ref<SQLitCursor>& obj) {
  if (obj->currentRow >= obj->rows.size()) {
    return kj::none;
  }
  
  auto& row = obj->rows[obj->currentRow++];
  auto arr = js.arr();
  
  for (auto& val : row) {
    KJ_IF_SOME(v, val) {
      KJ_SWITCH_ONEOF(v) {
        KJ_CASE_ONEOF(bytes, kj::Array<const byte>) {
          arr.add(js, js.wrapBytes(kj::heapArray(bytes)));
        }
        KJ_CASE_ONEOF(str, kj::String) {
          arr.add(js, js.str(str));
        }
        KJ_CASE_ONEOF(num, double) {
          arr.add(js, js.num(num));
        }
        KJ_CASE_ONEOF(num, int64_t) {
          arr.add(js, js.num(static_cast<double>(num)));
        }
        KJ_CASE_ONEOF(b, bool) {
          arr.add(js, js.boolean(b));
        }
      }
    } else {
      arr.add(js, js.null());
    }
  }
  
  return arr;
}

void SQLitCursor::visitForMemoryInfo(jsg::MemoryTracker& tracker) const {
  tracker.trackField("columns", columns);
  tracker.trackField("rows", rows);
}

// ============================================================================
// SQLitTransaction Implementation
// ============================================================================

SQLitTransaction::SQLitTransaction(kj::Own<SQLitConnection> conn, kj::String txId)
    : connection(kj::mv(conn)),
      transactionId(kj::mv(txId)) {}

SQLitTransaction::~SQLitTransaction() noexcept(false) {
  // Auto-rollback if not committed
  if (!committed && !rolledBack && connection != nullptr) {
    // Can't await in destructor, but we should try to rollback
    // In practice, the connection will be cleaned up
  }
}

jsg::Ref<SQLitCursor> SQLitTransaction::query(jsg::Lock& js, kj::String sql,
                                               jsg::Arguments<SQLitValue> bindings) {
  JSG_REQUIRE(!committed && !rolledBack, Error,
      "Transaction has already been completed");
  
  auto& ioContext = IoContext::current();
  
  // Execute query synchronously (blocking)
  auto bindingsArray = KJ_MAP(b, bindings) -> SQLitValue { return kj::mv(b); };
  
  auto [columns, rows] = ioContext.waitForPromise(js,
      connection->query(sql, bindingsArray));
  
  return js.alloc<SQLitCursor>(kj::mv(columns), kj::mv(rows));
}

jsg::Promise<double> SQLitTransaction::exec(jsg::Lock& js, kj::String sql,
                                             jsg::Arguments<SQLitValue> bindings) {
  JSG_REQUIRE(!committed && !rolledBack, Error,
      "Transaction has already been completed");
  
  auto bindingsArray = KJ_MAP(b, bindings) -> SQLitValue { return kj::mv(b); };
  
  return IoContext::current().awaitIo(js,
      connection->exec(sql, bindingsArray),
      [](jsg::Lock&, int64_t rowsAffected) {
        return static_cast<double>(rowsAffected);
      });
}

jsg::Promise<void> SQLitTransaction::commit(jsg::Lock& js) {
  JSG_REQUIRE(!committed && !rolledBack, Error,
      "Transaction has already been completed");
  
  committed = true;
  
  return IoContext::current().awaitIo(js,
      connection->commitTransaction(transactionId),
      [](jsg::Lock&) {});
}

jsg::Promise<void> SQLitTransaction::rollback(jsg::Lock& js) {
  JSG_REQUIRE(!committed && !rolledBack, Error,
      "Transaction has already been completed");
  
  rolledBack = true;
  
  return IoContext::current().awaitIo(js,
      connection->rollbackTransaction(transactionId),
      [](jsg::Lock&) {});
}

void SQLitTransaction::visitForMemoryInfo(jsg::MemoryTracker& tracker) const {
  tracker.trackField("transactionId", transactionId);
}

// ============================================================================
// SQLitStorage Implementation
// ============================================================================

SQLitStorage::SQLitStorage(SQLitConfig config)
    : config(kj::mv(config)) {
  // Parse endpoint into host:port
  auto endpoint = this->config.endpoint;
  auto colonPos = endpoint.findLast(':');
  
  kj::String host;
  uint16_t port;
  
  KJ_IF_SOME(pos, colonPos) {
    host = kj::heapString(endpoint.slice(0, pos));
    port = static_cast<uint16_t>(strtoul(endpoint.slice(pos + 1).cStr(), nullptr, 10));
  } else {
    host = kj::heapString(endpoint);
    port = 4662;  // Default port
  }
  
  SQLitConnection::Config connConfig {
    .host = kj::mv(host),
    .port = port,
    .databaseId = kj::heapString(this->config.databaseId),
    .timeoutMs = this->config.timeoutMs
  };
  
  connection = kj::heap<SQLitConnection>(kj::mv(connConfig));
}

SQLitStorage::~SQLitStorage() {}

jsg::Ref<SQLitCursor> SQLitStorage::query(jsg::Lock& js, kj::String sql,
                                           jsg::Arguments<SQLitValue> bindings) {
  auto& ioContext = IoContext::current();
  
  // Ensure connected
  if (!connection->isConnected()) {
    ioContext.waitForPromise(js, connection->connect());
  }
  
  auto bindingsArray = KJ_MAP(b, bindings) -> SQLitValue { return kj::mv(b); };
  
  auto [columns, rows] = ioContext.waitForPromise(js,
      connection->query(sql, bindingsArray));
  
  return js.alloc<SQLitCursor>(kj::mv(columns), kj::mv(rows));
}

jsg::Promise<double> SQLitStorage::exec(jsg::Lock& js, kj::String sql,
                                         jsg::Arguments<SQLitValue> bindings) {
  auto& ioContext = IoContext::current();
  
  // Ensure connected
  if (!connection->isConnected()) {
    ioContext.waitForPromise(js, connection->connect());
  }
  
  auto bindingsArray = KJ_MAP(b, bindings) -> SQLitValue { return kj::mv(b); };
  
  return ioContext.awaitIo(js,
      connection->exec(sql, bindingsArray),
      [](jsg::Lock&, int64_t rowsAffected) {
        return static_cast<double>(rowsAffected);
      });
}

jsg::Promise<jsg::Ref<SQLitTransaction>> SQLitStorage::transaction(jsg::Lock& js) {
  auto& ioContext = IoContext::current();
  
  // Ensure connected
  if (!connection->isConnected()) {
    ioContext.waitForPromise(js, connection->connect());
  }
  
  // Create a new connection for the transaction
  auto endpoint = config.endpoint;
  auto colonPos = endpoint.findLast(':');
  
  kj::String host;
  uint16_t port;
  
  KJ_IF_SOME(pos, colonPos) {
    host = kj::heapString(endpoint.slice(0, pos));
    port = static_cast<uint16_t>(strtoul(endpoint.slice(pos + 1).cStr(), nullptr, 10));
  } else {
    host = kj::heapString(endpoint);
    port = 4662;
  }
  
  SQLitConnection::Config connConfig {
    .host = kj::mv(host),
    .port = port,
    .databaseId = kj::heapString(config.databaseId),
    .timeoutMs = config.timeoutMs
  };
  
  auto txConn = kj::heap<SQLitConnection>(kj::mv(connConfig));
  
  return ioContext.awaitIo(js,
      txConn->connect().then([conn = kj::mv(txConn)]() mutable {
        return conn->beginTransaction().then([conn = kj::mv(conn)](kj::String txId) mutable {
          return kj::tuple(kj::mv(conn), kj::mv(txId));
        });
      }),
      [](jsg::Lock& js, kj::Tuple<kj::Own<SQLitConnection>, kj::String> result) {
        auto [conn, txId] = kj::mv(result);
        return js.alloc<SQLitTransaction>(kj::mv(conn), kj::mv(txId));
      });
}

jsg::Promise<bool> SQLitStorage::ping(jsg::Lock& js) {
  auto& ioContext = IoContext::current();
  
  // Ensure connected
  if (!connection->isConnected()) {
    ioContext.waitForPromise(js, connection->connect());
  }
  
  return ioContext.awaitIo(js,
      connection->ping(),
      [](jsg::Lock&, bool result) { return result; });
}

jsg::JsObject SQLitStorage::stats(jsg::Lock& js) {
  auto obj = js.obj();
  obj.set(js, "connected", js.boolean(connection->isConnected()));
  obj.set(js, "endpoint", js.str(config.endpoint));
  obj.set(js, "databaseId", js.str(config.databaseId));
  return obj;
}

void SQLitStorage::visitForMemoryInfo(jsg::MemoryTracker& tracker) const {
  tracker.trackField("config.endpoint", config.endpoint);
  tracker.trackField("config.databaseId", config.databaseId);
}

}  // namespace workerd::api::sqlit
