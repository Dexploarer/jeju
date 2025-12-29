package types

import (
	"sqlit/src/marshalhash"
)

// MarshalHash implementations for types that need verifier.MarshalHasher interface
// These use msgpack encoding for compatibility with the original HashStablePack format.

// MarshalHash marshals AckHeader for hash computation
func (h *AckHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 4)
	// Response
	respBytes, err := h.Response.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, respBytes...)
	b = marshalhash.AppendBytes(b, h.ResponseHash[:])
	b = marshalhash.AppendString(b, string(h.NodeID))
	b = marshalhash.AppendTime(b, h.Timestamp)
	return b, nil
}
func (h *AckHeader) Msgsize() int { return 256 }

// MarshalHash marshals BaseAccount for hash computation
func (a *BaseAccount) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 128)
	b = marshalhash.AppendArrayHeader(b, 3)
	b = marshalhash.AppendBytes(b, a.Address[:])
	b = marshalhash.AppendFloat64(b, a.Rating)
	b = marshalhash.AppendUint64(b, uint64(a.NextNonce))
	return b, nil
}
func (a *BaseAccount) Msgsize() int { return 128 }

// MarshalHash marshals Header for hash computation
func (h *Header) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	// Encode as array with 6 elements matching struct field order
	b = marshalhash.AppendArrayHeader(b, 6)
	b = marshalhash.AppendInt32(b, h.Version)
	b = marshalhash.AppendString(b, string(h.Producer))
	b = marshalhash.AppendBytes(b, h.GenesisHash[:])
	b = marshalhash.AppendBytes(b, h.ParentHash[:])
	b = marshalhash.AppendBytes(b, h.MerkleRoot[:])
	b = marshalhash.AppendTime(b, h.Timestamp)
	return b, nil
}
func (h *Header) Msgsize() int { return 256 }

// MarshalHash marshals BPHeader for hash computation
func (h *BPHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 5)
	b = marshalhash.AppendInt32(b, h.Version)
	b = marshalhash.AppendBytes(b, h.Producer[:])
	b = marshalhash.AppendBytes(b, h.MerkleRoot[:])
	b = marshalhash.AppendBytes(b, h.ParentHash[:])
	b = marshalhash.AppendTime(b, h.Timestamp)
	return b, nil
}
func (h *BPHeader) Msgsize() int { return 256 }

// MarshalHash marshals CreateDatabaseHeader for hash computation
func (h *CreateDatabaseHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 3)
	b = marshalhash.AppendBytes(b, h.Owner[:])
	// ResourceMeta
	rmBytes, err := h.ResourceMeta.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, rmBytes...)
	b = marshalhash.AppendUint64(b, uint64(h.Nonce))
	return b, nil
}
func (h *CreateDatabaseHeader) Msgsize() int { return 512 }

// MarshalHash marshals ResourceMeta for hash computation
func (rm *ResourceMeta) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 9)
	// TargetMiners - array of AccountAddress
	b = marshalhash.AppendArrayHeader(b, uint32(len(rm.TargetMiners)))
	for _, addr := range rm.TargetMiners {
		b = marshalhash.AppendBytes(b, addr[:])
	}
	b = marshalhash.AppendUint(b, uint64(rm.Node))
	b = marshalhash.AppendUint64(b, rm.Space)
	b = marshalhash.AppendUint64(b, rm.Memory)
	b = marshalhash.AppendFloat64(b, rm.LoadAvgPerCPU)
	b = marshalhash.AppendString(b, rm.EncryptionKey)
	b = marshalhash.AppendBool(b, rm.UseEventualConsistency)
	b = marshalhash.AppendFloat64(b, rm.ConsistencyLevel)
	b = marshalhash.AppendInt(b, rm.IsolationLevel)
	return b, nil
}
func (rm *ResourceMeta) Msgsize() int { return 256 }

// MarshalHash marshals CreateDatabase for hash computation
func (h *CreateDatabase) MarshalHash() ([]byte, error) {
	return h.CreateDatabaseHeader.MarshalHash()
}
func (h *CreateDatabase) Msgsize() int { return 512 }

// MarshalHash marshals CreateDatabaseRequestHeader for hash computation
func (h *CreateDatabaseRequestHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 1)
	// ResourceMeta
	rmBytes, err := h.ResourceMeta.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, rmBytes...)
	return b, nil
}
func (h *CreateDatabaseRequestHeader) Msgsize() int { return 256 }

// MarshalHash marshals CreateDatabaseResponseHeader for hash computation
func (h *CreateDatabaseResponseHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 1)
	// InstanceMeta
	instBytes, err := h.InstanceMeta.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, instBytes...)
	return b, nil
}
func (h *CreateDatabaseResponseHeader) Msgsize() int { return 256 }

// MarshalHash marshals DropDatabaseRequestHeader for hash computation
func (h *DropDatabaseRequestHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 1)
	b = marshalhash.AppendString(b, string(h.DatabaseID))
	return b, nil
}
func (h *DropDatabaseRequestHeader) Msgsize() int { return 256 }

// MarshalHash marshals GetDatabaseRequestHeader for hash computation
func (h *GetDatabaseRequestHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 1)
	b = marshalhash.AppendString(b, string(h.DatabaseID))
	return b, nil
}
func (h *GetDatabaseRequestHeader) Msgsize() int { return 256 }

// MarshalHash marshals GetDatabaseResponseHeader for hash computation
func (h *GetDatabaseResponseHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 1)
	// InstanceMeta
	instBytes, err := h.InstanceMeta.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, instBytes...)
	return b, nil
}
func (h *GetDatabaseResponseHeader) Msgsize() int { return 256 }

// MarshalHash marshals InitServiceResponseHeader for hash computation
func (h *InitServiceResponseHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	// Instances array
	b = marshalhash.AppendArrayHeader(b, uint32(len(h.Instances)))
	for _, inst := range h.Instances {
		instBytes, err := inst.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, instBytes...)
	}
	return b, nil
}
func (h *InitServiceResponseHeader) Msgsize() int { return 512 }

// MarshalHash marshals IssueKeys for hash computation
func (h *IssueKeys) MarshalHash() ([]byte, error) {
	return h.IssueKeysHeader.MarshalHash()
}
func (h *IssueKeys) Msgsize() int { return 512 }

// MarshalHash marshals IssueKeysHeader for hash computation
func (h *IssueKeysHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 3)
	b = marshalhash.AppendBytes(b, h.TargetSQLChain[:])
	// MinerKeys array
	b = marshalhash.AppendArrayHeader(b, uint32(len(h.MinerKeys)))
	for _, mk := range h.MinerKeys {
		mkBytes, err := mk.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, mkBytes...)
	}
	b = marshalhash.AppendUint64(b, uint64(h.Nonce))
	return b, nil
}
func (h *IssueKeysHeader) Msgsize() int { return 256 }

// MarshalHash marshals MinerKey for hash computation
func (mk *MinerKey) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 128)
	b = marshalhash.AppendArrayHeader(b, 2)
	b = marshalhash.AppendBytes(b, mk.Miner[:])
	b = marshalhash.AppendString(b, mk.EncryptionKey)
	return b, nil
}
func (mk *MinerKey) Msgsize() int { return 128 }

// MarshalHash marshals ProvideService for hash computation
func (h *ProvideService) MarshalHash() ([]byte, error) {
	return h.ProvideServiceHeader.MarshalHash()
}
func (h *ProvideService) Msgsize() int { return 512 }

// MarshalHash marshals ProvideServiceHeader for hash computation
func (h *ProvideServiceHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 6)
	b = marshalhash.AppendUint64(b, h.Space)
	b = marshalhash.AppendUint64(b, h.Memory)
	b = marshalhash.AppendFloat64(b, h.LoadAvgPerCPU)
	// TargetUser - array of AccountAddress
	b = marshalhash.AppendArrayHeader(b, uint32(len(h.TargetUser)))
	for _, addr := range h.TargetUser {
		b = marshalhash.AppendBytes(b, addr[:])
	}
	b = marshalhash.AppendString(b, string(h.NodeID))
	b = marshalhash.AppendUint64(b, uint64(h.Nonce))
	return b, nil
}
func (h *ProvideServiceHeader) Msgsize() int { return 256 }

// MarshalHash marshals RequestHeader for hash computation
func (h *RequestHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 5)
	b = marshalhash.AppendInt32(b, int32(h.QueryType))
	b = marshalhash.AppendString(b, string(h.NodeID))
	b = marshalhash.AppendString(b, string(h.DatabaseID))
	b = marshalhash.AppendUint64(b, h.ConnectionID)
	b = marshalhash.AppendUint64(b, h.SeqNo)
	return b, nil
}
func (h *RequestHeader) Msgsize() int { return 256 }

// MarshalHash marshals RequestPayload for hash computation
func (h *RequestPayload) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 1024)
	// Queries as array
	b = marshalhash.AppendArrayHeader(b, uint32(len(h.Queries)))
	for _, q := range h.Queries {
		qb, err := q.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, qb...)
	}
	return b, nil
}
func (h *RequestPayload) Msgsize() int { return 1024 }

// MarshalHash marshals Query for hash computation
func (q *Query) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 2)
	b = marshalhash.AppendString(b, q.Pattern)
	// Args
	b = marshalhash.AppendArrayHeader(b, uint32(len(q.Args)))
	for _, arg := range q.Args {
		ab, err := arg.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, ab...)
	}
	return b, nil
}
func (q *Query) Msgsize() int { return 256 }

// MarshalHash marshals NamedArg for hash computation
func (na *NamedArg) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 64)
	b = marshalhash.AppendArrayHeader(b, 2)
	b = marshalhash.AppendString(b, na.Name)
	vb, err := marshalhash.AppendIntf(nil, na.Value)
	if err != nil {
		return nil, err
	}
	b = append(b, vb...)
	return b, nil
}
func (na *NamedArg) Msgsize() int { return 64 }

// MarshalHash marshals ResponseHeader for hash computation
func (h *ResponseHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 10)
	// Request header
	reqBytes, err := h.Request.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, reqBytes...)
	b = marshalhash.AppendBytes(b, h.RequestHash[:])
	b = marshalhash.AppendString(b, string(h.NodeID))
	b = marshalhash.AppendTime(b, h.Timestamp)
	b = marshalhash.AppendUint64(b, h.RowCount)
	b = marshalhash.AppendUint64(b, h.LogOffset)
	b = marshalhash.AppendInt64(b, h.LastInsertID)
	b = marshalhash.AppendInt64(b, h.AffectedRows)
	b = marshalhash.AppendBytes(b, h.PayloadHash[:])
	b = marshalhash.AppendBytes(b, h.ResponseAccount[:])
	return b, nil
}
func (h *ResponseHeader) Msgsize() int { return 512 }

// MarshalHash marshals ResponsePayload for hash computation
func (h *ResponsePayload) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 1024)
	b = marshalhash.AppendArrayHeader(b, 3)
	// Columns as array of strings
	b = marshalhash.AppendArrayHeader(b, uint32(len(h.Columns)))
	for _, c := range h.Columns {
		b = marshalhash.AppendString(b, c)
	}
	// DeclTypes as array of strings
	b = marshalhash.AppendArrayHeader(b, uint32(len(h.DeclTypes)))
	for _, d := range h.DeclTypes {
		b = marshalhash.AppendString(b, d)
	}
	// Rows as array of arrays
	b = marshalhash.AppendArrayHeader(b, uint32(len(h.Rows)))
	for _, row := range h.Rows {
		rb, err := row.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, rb...)
	}
	return b, nil
}
func (h *ResponsePayload) Msgsize() int { return 1024 }

// MarshalHash marshals ResponseRow for hash computation
func (r ResponseRow) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, uint32(len(r.Values)))
	for _, v := range r.Values {
		vb, err := marshalhash.AppendIntf(nil, v)
		if err != nil {
			return nil, err
		}
		b = append(b, vb...)
	}
	return b, nil
}
func (r ResponseRow) Msgsize() int { return 256 }

// MarshalHash marshals UpdatePermission for hash computation
func (h *UpdatePermission) MarshalHash() ([]byte, error) {
	return h.UpdatePermissionHeader.MarshalHash()
}
func (h *UpdatePermission) Msgsize() int { return 256 }

// MarshalHash marshals UpdatePermissionHeader for hash computation
func (h *UpdatePermissionHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 4)
	b = marshalhash.AppendBytes(b, h.TargetSQLChain[:])
	b = marshalhash.AppendBytes(b, h.TargetUser[:])
	if h.Permission != nil {
		permBytes, err := h.Permission.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, permBytes...)
	} else {
		b = marshalhash.AppendNil(b)
	}
	b = marshalhash.AppendUint64(b, uint64(h.Nonce))
	return b, nil
}
func (h *UpdatePermissionHeader) Msgsize() int { return 256 }

// MarshalHash marshals UserPermission for hash computation
func (up *UserPermission) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 128)
	b = marshalhash.AppendArrayHeader(b, 2)
	b = marshalhash.AppendInt32(b, int32(up.Role))
	b = marshalhash.AppendArrayHeader(b, uint32(len(up.Patterns)))
	for _, p := range up.Patterns {
		b = marshalhash.AppendString(b, p)
	}
	return b, nil
}
func (up *UserPermission) Msgsize() int { return 128 }

// MarshalHash marshals UpdateServiceHeader for hash computation
func (h *UpdateServiceHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 256)
	b = marshalhash.AppendArrayHeader(b, 2)
	b = marshalhash.AppendInt(b, int(h.Op))
	// Instance
	instBytes, err := h.Instance.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, instBytes...)
	return b, nil
}
func (h *UpdateServiceHeader) Msgsize() int { return 256 }

// MarshalHash marshals ServiceInstance for hash computation
func (si *ServiceInstance) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 4)
	b = marshalhash.AppendString(b, string(si.DatabaseID))
	// Peers
	if si.Peers != nil {
		peersBytes, err := si.Peers.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, peersBytes...)
	} else {
		b = marshalhash.AppendNil(b)
	}
	// ResourceMeta
	rmBytes, err := si.ResourceMeta.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, rmBytes...)
	// GenesisBlock
	if si.GenesisBlock != nil {
		gbBytes, err := si.GenesisBlock.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, gbBytes...)
	} else {
		b = marshalhash.AppendNil(b)
	}
	return b, nil
}
func (si *ServiceInstance) Msgsize() int { return 512 }

// MarshalHash marshals Block for hash computation
func (b *Block) MarshalHash() ([]byte, error) {
	buf := make([]byte, 0, 1024)
	buf = marshalhash.AppendArrayHeader(buf, 2)
	// SignedHeader
	shBytes, err := b.SignedHeader.MarshalHash()
	if err != nil {
		return nil, err
	}
	buf = append(buf, shBytes...)
	// QueryTxs
	buf = marshalhash.AppendArrayHeader(buf, uint32(len(b.QueryTxs)))
	for _, qtx := range b.QueryTxs {
		qtxBytes, err := qtx.MarshalHash()
		if err != nil {
			return nil, err
		}
		buf = append(buf, qtxBytes...)
	}
	return buf, nil
}
func (b *Block) Msgsize() int { return 1024 }

// MarshalHash marshals SignedHeader for hash computation
func (sh *SignedHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 2)
	// Embedded Header
	hdrBytes, err := sh.Header.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hdrBytes...)
	// HSV (hash signature verifier)
	hsvBytes, err := sh.HSV.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hsvBytes...)
	return b, nil
}
func (sh *SignedHeader) Msgsize() int { return 512 }

// MarshalHash marshals QueryAsTx for hash computation
func (qtx *QueryAsTx) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 2)
	// Request
	if qtx.Request != nil {
		reqBytes, err := qtx.Request.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, reqBytes...)
	} else {
		b = marshalhash.AppendNil(b)
	}
	// Response
	if qtx.Response != nil {
		respBytes, err := qtx.Response.MarshalHash()
		if err != nil {
			return nil, err
		}
		b = append(b, respBytes...)
	} else {
		b = marshalhash.AppendNil(b)
	}
	return b, nil
}
func (qtx *QueryAsTx) Msgsize() int { return 512 }

// MarshalHash marshals Blocks for hash computation
func (b Blocks) MarshalHash() ([]byte, error) {
	buf := make([]byte, 0, 2048)
	buf = marshalhash.AppendArrayHeader(buf, uint32(len(b)))
	for _, blk := range b {
		blkBytes, err := blk.MarshalHash()
		if err != nil {
			return nil, err
		}
		buf = append(buf, blkBytes...)
	}
	return buf, nil
}

// MarshalHash marshals BPBlock for hash computation
func (b *BPBlock) MarshalHash() ([]byte, error) {
	buf := make([]byte, 0, 1024)
	buf = marshalhash.AppendArrayHeader(buf, 2)
	// BPSignedHeader
	shBytes, err := b.SignedHeader.MarshalHash()
	if err != nil {
		return nil, err
	}
	buf = append(buf, shBytes...)
	// Transactions
	buf = marshalhash.AppendArrayHeader(buf, uint32(len(b.Transactions)))
	for _, tx := range b.Transactions {
		txBytes, err := tx.MarshalHash()
		if err != nil {
			return nil, err
		}
		buf = append(buf, txBytes...)
	}
	return buf, nil
}
func (b *BPBlock) Msgsize() int { return 1024 }

// MarshalHash marshals BPSignedHeader for hash computation
func (sbh *BPSignedHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 2)
	// Embedded BPHeader
	hdrBytes, err := sbh.BPHeader.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hdrBytes...)
	// DefaultHashSignVerifierImpl
	hsvBytes, err := sbh.DefaultHashSignVerifierImpl.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hsvBytes...)
	return b, nil
}
func (sbh *BPSignedHeader) Msgsize() int { return 512 }

// MarshalHash marshals Request for hash computation
func (r *Request) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 1024)
	b = marshalhash.AppendArrayHeader(b, 2)
	// Header
	hdrBytes, err := r.Header.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hdrBytes...)
	// Payload
	payBytes, err := r.Payload.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, payBytes...)
	return b, nil
}
func (r *Request) Msgsize() int { return 1024 }

// MarshalHash marshals SignedRequestHeader for hash computation
func (srh *SignedRequestHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 2)
	// Embedded RequestHeader
	hdrBytes, err := srh.RequestHeader.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hdrBytes...)
	// DefaultHashSignVerifierImpl
	hsvBytes, err := srh.DefaultHashSignVerifierImpl.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hsvBytes...)
	return b, nil
}
func (srh *SignedRequestHeader) Msgsize() int { return 512 }

// MarshalHash marshals SignedResponseHeader for hash computation
func (srh *SignedResponseHeader) MarshalHash() ([]byte, error) {
	b := make([]byte, 0, 512)
	b = marshalhash.AppendArrayHeader(b, 2)
	// Embedded ResponseHeader
	hdrBytes, err := srh.ResponseHeader.MarshalHash()
	if err != nil {
		return nil, err
	}
	b = append(b, hdrBytes...)
	// ResponseHash
	b = marshalhash.AppendBytes(b, srh.ResponseHash[:])
	return b, nil
}
func (srh *SignedResponseHeader) Msgsize() int { return 512 }
