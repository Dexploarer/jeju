// Copyright (c) 2024 Jeju Network
// Native SQLit bindings for workerd
//
// This provides high-performance SQLit access via binary protocol,
// bypassing HTTP overhead for database operations.

#pragma once

#include <workerd/io/io-context.h>
#include <workerd/jsg/jsg.h>
#include <workerd/io/compatibility-date.capnp.h>

#include <kj/async.h>
#include <kj/compat/http.h>
#include <kj/string.h>
#include <kj/timer.h>

namespace workerd::api::sqlit {

// Forward declarations
class SQLitConnection;
class SQLitCursor;
class SQLitTransaction;

// Value type for bindings and results
using SQLitValue = kj::Maybe<kj::OneOf<kj::Array<const byte>, kj::String, double, int64_t, bool>>;

// Configuration for SQLit connection
struct SQLitConfig {
  kj::String endpoint;     // SQLit server endpoint (host:port)
  kj::String databaseId;   // Database ID
  uint32_t poolSize;       // Connection pool size
  uint32_t timeoutMs;      // Query timeout in milliseconds
  
  JSG_STRUCT(endpoint, databaseId, poolSize, timeoutMs);
};

// Main SQLit storage class exposed to JavaScript
class SQLitStorage final: public jsg::Object {
public:
  SQLitStorage(SQLitConfig config);
  ~SQLitStorage();

  // Execute a SELECT query
  jsg::Ref<SQLitCursor> query(jsg::Lock& js, kj::String sql, 
                               jsg::Arguments<SQLitValue> bindings);
  
  // Execute a write query (INSERT/UPDATE/DELETE)
  jsg::Promise<double> exec(jsg::Lock& js, kj::String sql,
                            jsg::Arguments<SQLitValue> bindings);
  
  // Begin a transaction
  jsg::Promise<jsg::Ref<SQLitTransaction>> transaction(jsg::Lock& js);
  
  // Check connection health
  jsg::Promise<bool> ping(jsg::Lock& js);
  
  // Get connection pool stats
  jsg::JsObject stats(jsg::Lock& js);

  JSG_RESOURCE_TYPE(SQLitStorage, CompatibilityFlags::Reader flags) {
    JSG_METHOD(query);
    JSG_METHOD(exec);
    JSG_METHOD(transaction);
    JSG_METHOD(ping);
    JSG_METHOD(stats);

    JSG_NESTED_TYPE(SQLitCursor);
    JSG_NESTED_TYPE(SQLitTransaction);

    JSG_TS_OVERRIDE({
      query<T extends Record<string, SQLitValue>>(sql: string, ...bindings: any[]): SQLitCursor<T>;
      exec(sql: string, ...bindings: any[]): Promise<number>;
      transaction(): Promise<SQLitTransaction>;
      ping(): Promise<boolean>;
      stats(): SQLitStats;
    });
  }

  void visitForMemoryInfo(jsg::MemoryTracker& tracker) const;

private:
  void visitForGc(jsg::GcVisitor& visitor) {}
  
  SQLitConfig config;
  kj::Own<SQLitConnection> connection;
};

// Cursor for iterating over query results
class SQLitCursor final: public jsg::Object {
public:
  SQLitCursor(kj::Array<kj::String> columns, 
              kj::Array<kj::Array<SQLitValue>> rows);
  ~SQLitCursor() noexcept(false);

  // Get next row
  struct NextResult {
    bool done;
    kj::Maybe<jsg::JsObject> value;
    
    JSG_STRUCT(done, value);
  };
  NextResult next(jsg::Lock& js);
  
  // Get all rows as array
  jsg::JsArray toArray(jsg::Lock& js);
  
  // Get exactly one row (throws if 0 or >1)
  jsg::JsValue one(jsg::Lock& js);
  
  // Get column names
  jsg::JsArray getColumnNames(jsg::Lock& js);
  
  // Get row count
  double getRowCount();

  JSG_RESOURCE_TYPE(SQLitCursor, CompatibilityFlags::Reader flags) {
    JSG_METHOD(next);
    JSG_METHOD(toArray);
    JSG_METHOD(one);
    
    JSG_ITERABLE(rows);
    JSG_METHOD(raw);
    
    JSG_READONLY_PROTOTYPE_PROPERTY(columnNames, getColumnNames);
    JSG_READONLY_PROTOTYPE_PROPERTY(rowCount, getRowCount);

    JSG_TS_OVERRIDE(<T extends Record<string, SQLitValue>> {
      [Symbol.iterator](): IterableIterator<T>;
      raw<U extends SQLitValue[]>(): IterableIterator<U>;
      next(): { done?: false, value: T } | { done: true, value?: never };
      toArray(): T[];
      one(): T;
      columnNames: string[];
      rowCount: number;
    });
  }

  JSG_ITERATOR(RowIterator, rows, jsg::JsObject, jsg::Ref<SQLitCursor>, rowIteratorNext);
  JSG_ITERATOR(RawIterator, raw, jsg::JsArray, jsg::Ref<SQLitCursor>, rawIteratorNext);

  void visitForMemoryInfo(jsg::MemoryTracker& tracker) const;

private:
  static kj::Maybe<jsg::JsObject> rowIteratorNext(jsg::Lock& js, jsg::Ref<SQLitCursor>& obj);
  static kj::Maybe<jsg::JsArray> rawIteratorNext(jsg::Lock& js, jsg::Ref<SQLitCursor>& obj);
  
  kj::Array<kj::String> columns;
  kj::Array<kj::Array<SQLitValue>> rows;
  size_t currentRow = 0;

  void visitForGc(jsg::GcVisitor& visitor) {}
};

// Transaction context
class SQLitTransaction final: public jsg::Object {
public:
  SQLitTransaction(kj::Own<SQLitConnection> conn, kj::String txId);
  ~SQLitTransaction() noexcept(false);

  // Execute query within transaction
  jsg::Ref<SQLitCursor> query(jsg::Lock& js, kj::String sql,
                               jsg::Arguments<SQLitValue> bindings);
  
  // Execute write within transaction  
  jsg::Promise<double> exec(jsg::Lock& js, kj::String sql,
                            jsg::Arguments<SQLitValue> bindings);
  
  // Commit transaction
  jsg::Promise<void> commit(jsg::Lock& js);
  
  // Rollback transaction
  jsg::Promise<void> rollback(jsg::Lock& js);

  JSG_RESOURCE_TYPE(SQLitTransaction, CompatibilityFlags::Reader flags) {
    JSG_METHOD(query);
    JSG_METHOD(exec);
    JSG_METHOD(commit);
    JSG_METHOD(rollback);
  }

  void visitForMemoryInfo(jsg::MemoryTracker& tracker) const;

private:
  void visitForGc(jsg::GcVisitor& visitor) {}
  
  kj::Own<SQLitConnection> connection;
  kj::String transactionId;
  bool committed = false;
  bool rolledBack = false;
};

// Native connection to SQLit server
class SQLitConnection {
public:
  struct Config {
    kj::String host;
    uint16_t port;
    kj::String databaseId;
    uint32_t timeoutMs;
  };

  explicit SQLitConnection(Config config);
  ~SQLitConnection();

  // Connect to server
  kj::Promise<void> connect();
  
  // Close connection
  void close();
  
  // Check if connected
  bool isConnected() const;
  
  // Execute a query
  kj::Promise<kj::Tuple<kj::Array<kj::String>, kj::Array<kj::Array<SQLitValue>>>>
  query(kj::StringPtr sql, kj::ArrayPtr<SQLitValue> bindings);
  
  // Execute a write
  kj::Promise<int64_t> exec(kj::StringPtr sql, kj::ArrayPtr<SQLitValue> bindings);
  
  // Ping server
  kj::Promise<bool> ping();
  
  // Begin transaction
  kj::Promise<kj::String> beginTransaction();
  
  // Commit transaction
  kj::Promise<void> commitTransaction(kj::StringPtr txId);
  
  // Rollback transaction
  kj::Promise<void> rollbackTransaction(kj::StringPtr txId);

private:
  Config config;
  kj::Own<kj::AsyncIoStream> stream;
  bool connected = false;
  
  // Protocol methods
  kj::Promise<void> writeRequest(uint8_t type, kj::StringPtr sql,
                                  kj::ArrayPtr<SQLitValue> bindings);
  kj::Promise<kj::Array<byte>> readResponse();
};

// Connection pool for SQLit
class SQLitConnectionPool {
public:
  struct Config {
    kj::String host;
    uint16_t port;
    kj::String databaseId;
    uint32_t poolSize;
    uint32_t timeoutMs;
  };

  explicit SQLitConnectionPool(Config config);
  ~SQLitConnectionPool();

  // Get a connection from the pool
  kj::Promise<kj::Own<SQLitConnection>> acquire();
  
  // Return a connection to the pool
  void release(kj::Own<SQLitConnection> conn);
  
  // Get pool statistics
  struct Stats {
    uint32_t total;
    uint32_t available;
    uint32_t inUse;
  };
  Stats getStats() const;

private:
  Config config;
  kj::Vector<kj::Own<SQLitConnection>> available;
  uint32_t inUse = 0;
  kj::MutexGuarded<kj::Vector<kj::PromiseFulfiller<kj::Own<SQLitConnection>>>> waiters;
};

// Type definitions for JSG
#define EW_SQLIT_ISOLATE_TYPES                                                  \
  api::sqlit::SQLitStorage,                                                     \
  api::sqlit::SQLitCursor,                                                      \
  api::sqlit::SQLitTransaction,                                                 \
  api::sqlit::SQLitCursor::RowIterator,                                         \
  api::sqlit::SQLitCursor::RowIterator::Next,                                   \
  api::sqlit::SQLitCursor::RawIterator,                                         \
  api::sqlit::SQLitCursor::RawIterator::Next,                                   \
  api::sqlit::SQLitConfig

}  // namespace workerd::api::sqlit
