package secp256k1

import "C"
import "unsafe"

// Callbacks for converting libsecp256k1 internal faults into
// recoverable Go panics.

//export sqlit_secp256k1GoPanicIllegal
func sqlit_secp256k1GoPanicIllegal(msg *C.char, data unsafe.Pointer) {
	panic("illegal argument: " + C.GoString(msg))
}

//export sqlit_secp256k1GoPanicError
func sqlit_secp256k1GoPanicError(msg *C.char, data unsafe.Pointer) {
	panic("internal error: " + C.GoString(msg))
}
