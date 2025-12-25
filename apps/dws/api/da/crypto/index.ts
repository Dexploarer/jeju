/**
 * Cryptographic Primitives for DA Layer
 *
 * Production-ready implementations:
 * - BLS12-381 signatures with proper pairing verification
 * - KZG polynomial commitments with trusted setup
 * - 2D Reed-Solomon erasure coding
 * - Hash-to-curve per RFC 9380
 *
 * Note: These implementations are internal to the DA layer.
 * Import directly from specific modules if needed.
 */

// Re-export only the essential types and utilities that may be needed by other da modules
// The full implementations are available by importing directly from:
// - ./bls for BLS signatures
// - ./hash-to-curve for hash-to-curve
// - ./kzg for KZG commitments
// - ./reed-solomon-2d for erasure coding
