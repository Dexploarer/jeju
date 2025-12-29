package proto

import (
	"sqlit/src/marshalhash"
)

// MarshalHash marshals PeersHeader for hash computation
func (ph *PeersHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 4)
	b = marshalhash.AppendUint64(b, ph.Version)
	b = marshalhash.AppendUint64(b, ph.Term)
	b = marshalhash.AppendString(b, string(ph.Leader))
	// Servers array
	b = marshalhash.AppendArrayHeader(b, uint32(len(ph.Servers)))
	for _, s := range ph.Servers {
		b = marshalhash.AppendString(b, string(s))
	}
	return b, nil
}

// Msgsize returns the estimated size for msgpack encoding
func (ph *PeersHeader) Msgsize() int { return 256 }

// MarshalHash marshals Peers for hash computation
func (p *Peers) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 2)
	// PeersHeader
	hdrBytes, err := p.PeersHeader.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hdrBytes...)
	// DefaultHashSignVerifierImpl
	hsvBytes, err := p.DefaultHashSignVerifierImpl.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hsvBytes...)
	return b, nil
}

// Msgsize returns the estimated size for msgpack encoding
func (p *Peers) Msgsize() int { return 512 }
