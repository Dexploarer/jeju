
package bftraft

import (
	"sqlit/src/proto"
	rpc "sqlit/src/rpc/mux"
)

// Caller defines the rpc caller, supports mocks for the default rpc.PersistCaller.
type Caller interface {
	Call(method string, req interface{}, resp interface{}) error
}

// NewCallerFunc defines the function type to return a Caller object.
type NewCallerFunc func(target proto.NodeID) Caller

var defaultNewCallerFunc = func(target proto.NodeID) Caller {
	return rpc.NewPersistentCaller(target)
}
