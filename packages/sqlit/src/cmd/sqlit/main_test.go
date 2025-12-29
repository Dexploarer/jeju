// +build testbinary

package main

import (
	"testing"

	"sqlit/src/cmd/sqlit/internal"
)

func TestMain(m *testing.M) {
	internal.AtExit(func() {
		m.Run()
	})
	main()
}
