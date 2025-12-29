
package blockproducer

import (
	"math/rand"
	"os"
	"path"
	"testing"

	"sqlit/src/conf"
	ca "sqlit/src/crypto/asymmetric"
	"sqlit/src/crypto/hash"
	"sqlit/src/crypto/kms"
	"sqlit/src/route"
	"sqlit/src/utils/log"
)

var (
	genesisHash               = hash.Hash{}
	testingDataDir            string
	testingConfigFile         = "../../test/node_standalone/config.yaml"
	testingPrivateKeyFile     = "../../test/node_standalone/private.key"
	testingPublicKeyStoreFile string
	testingNonceDifficulty    int
	testingPrivateKey         *ca.PrivateKey
	testingPublicKey          *ca.PublicKey
)

func setup() {
	var err error
	rand.Read(genesisHash[:])

	// Create temp dir for test data
	if testingDataDir, err = os.MkdirTemp("", "SQLIT"); err != nil {
		panic(err)
	}

	// Initialze kms
	testingNonceDifficulty = 2
	testingPublicKeyStoreFile = path.Join(testingDataDir, "public.keystore")

	if conf.GConf, err = conf.LoadConfig(testingConfigFile); err != nil {
		panic(err)
	}
	route.InitKMS(testingPublicKeyStoreFile)
	if err = kms.InitLocalKeyPair(testingPrivateKeyFile, []byte{}); err != nil {
		panic(err)
	}
	if testingPrivateKey, err = kms.GetLocalPrivateKey(); err != nil {
		panic(err)
	}
	testingPublicKey = testingPrivateKey.PubKey()

	// Setup logging
	log.SetOutput(os.Stdout)
	log.SetLevel(log.DebugLevel)
}

func teardown() {
	if err := os.RemoveAll(testingDataDir); err != nil {
		panic(err)
	}
}

func TestMain(m *testing.M) {
	os.Exit(func() int {
		setup()
		defer teardown()
		return m.Run()
	}())
}
