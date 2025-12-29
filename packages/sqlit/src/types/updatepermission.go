

package types

import (
	"sqlit/src/blockproducer/interfaces"
	"sqlit/src/crypto"
	"sqlit/src/crypto/asymmetric"
	"sqlit/src/crypto/verifier"
	"sqlit/src/proto"
)

//go:generate hsp

// UpdatePermissionHeader defines the updating sqlchain permission transaction header.
type UpdatePermissionHeader struct {
	TargetSQLChain proto.AccountAddress
	TargetUser     proto.AccountAddress
	Permission     *UserPermission
	Nonce          interfaces.AccountNonce
}

// GetAccountNonce implements interfaces/Transaction.GetAccountNonce.
func (u *UpdatePermissionHeader) GetAccountNonce() interfaces.AccountNonce {
	return u.Nonce
}

// UpdatePermission defines the updating sqlchain permission transaction.
type UpdatePermission struct {
	UpdatePermissionHeader
	interfaces.TransactionTypeMixin
	verifier.DefaultHashSignVerifierImpl
}

// NewUpdatePermission returns new instance.
func NewUpdatePermission(header *UpdatePermissionHeader) *UpdatePermission {
	return &UpdatePermission{
		UpdatePermissionHeader: *header,
		TransactionTypeMixin:   *interfaces.NewTransactionTypeMixin(interfaces.TransactionTypeUpdatePermission),
	}
}

// Sign implements interfaces/Transaction.Sign.
func (up *UpdatePermission) Sign(signer *asymmetric.PrivateKey) (err error) {
	return up.DefaultHashSignVerifierImpl.Sign(&up.UpdatePermissionHeader, signer)
}

// Verify implements interfaces/Transaction.Verify.
func (up *UpdatePermission) Verify() error {
	return up.DefaultHashSignVerifierImpl.Verify(&up.UpdatePermissionHeader)
}

// GetAccountAddress implements interfaces/Transaction.GetAccountAddress.
func (up *UpdatePermission) GetAccountAddress() proto.AccountAddress {
	addr, _ := crypto.PubKeyHash(up.Signee)
	return addr
}

func init() {
	interfaces.RegisterTransaction(interfaces.TransactionTypeUpdatePermission, (*UpdatePermission)(nil))
}
