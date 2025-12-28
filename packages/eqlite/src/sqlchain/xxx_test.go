
package sqlchain

import (
	crand "crypto/rand"
	"math/rand"
	"os"
	"path"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eqlite/src/crypto/asymmetric"
	"eqlite/src/crypto/hash"
	"eqlite/src/crypto/kms"
	"eqlite/src/crypto/verifier"
	"eqlite/src/pow/cpuminer"
	"eqlite/src/proto"
	"eqlite/src/types"
	"eqlite/src/utils/log"
)

var (
	genesisHash      = hash.Hash{}
	testDifficulty   = 4
	testMasterKey    = []byte(".9K.sgch!3;C>w0v")
	testConnIDSeed   = rand.Uint64()
	testDataDir      string
	testPrivKeyFile  string
	testPubKeysFile  string
	testDHTStoreFile string
	testPrivKey      *asymmetric.PrivateKey
	testPubKey       *asymmetric.PublicKey
)

type nodeProfile struct {
	NodeID       proto.NodeID
	PrivateKey   *asymmetric.PrivateKey
	PublicKey    *asymmetric.PublicKey
	ConnectionID uint64
	SeqNo        uint64
	Chain        *Chain
	IsLeader     bool
}

func newRandomNode(chain *Chain, isLeader bool) (node *nodeProfile, err error) {
	priv, pub, err := asymmetric.GenSecp256k1KeyPair()

	if err != nil {
		return
	}

	h := &hash.Hash{}
	crand.Read(h[:])

	node = &nodeProfile{
		NodeID:       proto.NodeID(h.String()),
		PrivateKey:   priv,
		PublicKey:    pub,
		ConnectionID: atomic.AddUint64(&testConnIDSeed, 1),
		SeqNo:        rand.Uint64(),
		Chain:        chain,
		IsLeader:     isLeader,
	}

	return
}

func createRandomTimeAfter(now time.Time, maxDelayMillisecond int) time.Time {
	return now.Add(time.Duration(rand.Intn(maxDelayMillisecond)+1) * time.Millisecond)
}

func createRandomQueryAckWithResponse(resp *types.SignedResponseHeader, cli *nodeProfile) (
	r *types.SignedAckHeader, err error,
) {
	ack := &types.Ack{
		Header: types.SignedAckHeader{
			AckHeader: types.AckHeader{
				Response:     resp.ResponseHeader,
				ResponseHash: resp.Hash(),
				NodeID:       cli.NodeID,
				Timestamp:    createRandomTimeAfter(resp.Timestamp, 100),
			},
		},
	}

	if err = ack.Sign(cli.PrivateKey); err != nil {
		return
	}

	r = &ack.Header
	return
}

func registerNodesWithPublicKey(pub *asymmetric.PublicKey, diff int, num int) (
	nis []cpuminer.NonceInfo, err error) {
	nis = make([]cpuminer.NonceInfo, num)

	miner := cpuminer.NewCPUMiner(nil)
	nCh := make(chan cpuminer.NonceInfo)
	defer close(nCh)
	block := cpuminer.MiningBlock{
		Data:      pub.Serialize(),
		NonceChan: nCh,
		Stop:      nil,
	}
	next := cpuminer.Uint256{}
	wg := &sync.WaitGroup{}

	for i := range nis {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = miner.ComputeBlockNonce(block, next, diff)
		}()
		n := <-nCh
		nis[i] = n
		next = n.Nonce
		next.Inc()

		if err = kms.SetPublicKey(proto.NodeID(n.Hash.String()), n.Nonce, pub); err != nil {
			return
		}

		wg.Wait()
	}

	// Register a local nonce, don't know what is the matter though
	kms.SetLocalNodeIDNonce(nis[0].Hash[:], &nis[0].Nonce)
	return
}

func createRandomBlock(parent hash.Hash, isGenesis bool) (b *types.Block, err error) {
	b, err = types.CreateRandomBlock(parent, isGenesis)
	if err != nil {
		return
	}

	if isGenesis {
		return
	}

	// Generate key pair
	priv, _, err := asymmetric.GenSecp256k1KeyPair()
	if err != nil {
		return
	}

	for i, n := 0, rand.Intn(10)+10; i < n; i++ {
		h := &hash.Hash{}
		crand.Read(h[:])
		b.Acks = []*types.SignedAckHeader{
			{
				DefaultHashSignVerifierImpl: verifier.DefaultHashSignVerifierImpl{
					DataHash: *h,
				},
			},
		}
	}

	err = b.PackAndSignBlock(priv)
	return
}

func createTestPeers(num int) (nis []cpuminer.NonceInfo, p *proto.Peers, err error) {
	if num <= 0 {
		return
	}

	// Use a same key pair for all the servers, so that we can run multiple instances of sql-chain
	// locally without breaking the LocalKeyStore
	pub, err := kms.GetLocalPublicKey()

	if err != nil {
		return
	}

	priv, err := kms.GetLocalPrivateKey()

	if err != nil {
		return
	}

	nis, err = registerNodesWithPublicKey(pub, testDifficulty, num)

	if err != nil {
		return
	}

	s := make([]proto.NodeID, num)
	h := &hash.Hash{}

	for i := range s {
		crand.Read(h[:])
		s[i] = proto.NodeID(nis[i].Hash.String())
	}

	p = &proto.Peers{
		PeersHeader: proto.PeersHeader{
			Term:    0,
			Leader:  s[0],
			Servers: s,
		},
	}

	if err = p.Sign(priv); err != nil {
		return
	}

	return
}

func setup() {
	// Setup RNG
	crand.Read(genesisHash[:])

	// Create temp dir
	var err error
	testDataDir, err = os.MkdirTemp("", "eqlite")

	if err != nil {
		panic(err)
	}

	testPubKeysFile = path.Join(testDataDir, "public.keystore")
	testPrivKeyFile = path.Join(testDataDir, "private.key")
	testDHTStoreFile = path.Join(testDataDir, "dht.db")

	// Setup public key store
	if err = kms.InitPublicKeyStore(testPubKeysFile, nil); err != nil {
		panic(err)
	}

	// Setup local key store
	kms.Unittest = true
	testPrivKey, testPubKey, err = asymmetric.GenSecp256k1KeyPair()

	if err != nil {
		panic(err)
	}

	kms.SetLocalKeyPair(testPrivKey, testPubKey)

	if err = kms.SavePrivateKey(testPrivKeyFile, testPrivKey, testMasterKey); err != nil {
		panic(err)
	}

	// Setup logging
	log.SetOutput(os.Stdout)
	log.SetLevel(log.DebugLevel)
}

func teardown() {
	if err := os.RemoveAll(testDataDir); err != nil {
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

func buildQuery(query string, args ...interface{}) types.Query {
	var nargs = make([]types.NamedArg, len(args))
	for i := range args {
		nargs[i] = types.NamedArg{
			Name:  "",
			Value: args[i],
		}
	}
	return types.Query{
		Pattern: query,
		Args:    nargs,
	}
}

func (p *nodeProfile) buildQuery(
	qt types.QueryType, qs []types.Query) (req *types.Request, err error,
) {
	req = &types.Request{
		Header: types.SignedRequestHeader{
			RequestHeader: types.RequestHeader{
				QueryType:    qt,
				NodeID:       p.NodeID,
				DatabaseID:   p.Chain.databaseID,
				ConnectionID: p.ConnectionID,
				SeqNo:        atomic.AddUint64(&p.SeqNo, 1),
				Timestamp:    time.Now().UTC(),
				// BatchCount and QueriesHash will be set by req.Sign()
			},
		},
		Payload: types.RequestPayload{Queries: qs},
	}
	if err = req.Sign(p.PrivateKey); err != nil {
		return
	}
	return
}
func (p *nodeProfile) sendQuery(req *types.Request) (err error) {
	return p.sendQueryEx(req, true)
}

func (p *nodeProfile) sendQueryEx(req *types.Request, genAck bool) (err error) {
	tracker, resp, err := p.Chain.Query(req, p.IsLeader)
	if err != nil {
		return
	}
	if err = resp.BuildHash(); err != nil {
		return
	}
	if err = p.Chain.AddResponse(&resp.Header); err != nil {
		return
	}
	tracker.UpdateResp(resp)

	if !genAck {
		return
	}

	ack, err := createRandomQueryAckWithResponse(&resp.Header, p)
	if err != nil {
		return
	}
	if err = p.Chain.VerifyAndPushAckedQuery(ack); err != nil {
		return
	}
	return
}

func (p *nodeProfile) query(
	qt types.QueryType, qs []types.Query, genAck bool) (err error,
) {
	req, err := p.buildQuery(qt, qs)
	if err != nil {
		return
	}
	return p.sendQueryEx(req, genAck)
}
