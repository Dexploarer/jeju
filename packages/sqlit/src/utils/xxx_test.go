
package utils

import (
	"os"
	"testing"

	"sqlit/src/utils/log"
)

func testSetup() {
	log.SetOutput(os.Stdout)
	log.SetLevel(log.DebugLevel)
}

func TestMain(m *testing.M) {
	testSetup()
	os.Exit(m.Run())
}
