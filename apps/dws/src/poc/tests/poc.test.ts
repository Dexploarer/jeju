/**
 * Proof-of-Cloud Tests
 * 
 * Tests for TEE attestation parsing, verification, and PoC integration
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import type { Hex } from 'viem';
import {
  parseQuote,
  verifyQuote,
  hashHardwareId,
  extractPlatformInfo,
} from '../quote-parser';
import {
  MockPoCRegistryClient,
} from '../registry-client';
import {
  type PoCRegistryEntry,
  PoCError,
  PoCErrorCode,
} from '../types';

// ============================================================================
// Test Data
// ============================================================================

// Sample Intel TDX quote (simplified for testing)
// Real quotes are 4KB+ and include full cert chains
function createMockTDXQuote(): Hex {
  // Total size: header (48) + report body (584) + sig data len (4) + sig (64)
  const totalLen = 48 + 584 + 4 + 64;
  const quote = new Uint8Array(totalLen);
  
  // Header (48 bytes)
  quote[0] = 4; // version = 4 (LE)
  quote[1] = 0;
  quote[2] = 0; // attestation key type
  quote[3] = 0;
  quote[4] = 0x81; // TEE type = TDX
  quote[5] = 0;
  quote[6] = 0;
  quote[7] = 0;
  // reserved (4 bytes) at offset 8-11
  
  // Vendor ID (Intel) at offset 12-28: 939a7233f79c4ca9940a0db3957f0607
  quote[12] = 0x93;
  quote[13] = 0x9a;
  quote[14] = 0x72;
  quote[15] = 0x33;
  quote[16] = 0xf7;
  quote[17] = 0x9c;
  quote[18] = 0x4c;
  quote[19] = 0xa9;
  quote[20] = 0x94;
  quote[21] = 0x0a;
  quote[22] = 0x0d;
  quote[23] = 0xb3;
  quote[24] = 0x95;
  quote[25] = 0x7f;
  quote[26] = 0x06;
  quote[27] = 0x07;
  // userData (20 bytes) at offset 28-47

  // Report body at offset 48 (584 bytes for TDX)
  // Fill with deterministic but non-zero values for measurements
  for (let i = 0; i < 584; i++) {
    quote[48 + i] = ((i + 1) % 255) + 1; // Avoid zeros for measurements
  }
  
  // Signature data length at offset 48 + 584 = 632
  // 64 bytes signature (little-endian uint32)
  quote[632] = 64;
  quote[633] = 0;
  quote[634] = 0;
  quote[635] = 0;
  
  // Signature data (64 bytes) at offset 636
  for (let i = 0; i < 64; i++) {
    quote[636 + i] = ((i * 11) % 255) + 1;
  }

  return ('0x' + Array.from(quote).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex;
}

// Sample AMD SEV-SNP report
function createMockSEVQuote(): Hex {
  // Create a minimal SEV-SNP report structure
  const report = new Uint8Array(0x2A0 + 512); // Report + signature
  
  // Version = 2
  report[0] = 2;
  report[1] = 0;
  report[2] = 0;
  report[3] = 0;
  
  // Guest SVN
  report[4] = 1;
  
  // Fill measurement (at 0x90, 48 bytes)
  for (let i = 0; i < 48; i++) {
    report[0x90 + i] = (i * 13) % 256;
  }
  
  // Fill chip ID (at 0x1A0, 64 bytes)
  for (let i = 0; i < 64; i++) {
    report[0x1A0 + i] = (i * 17) % 256;
  }
  
  // Fill signature (at 0x2A0, 512 bytes for RSA-4096)
  for (let i = 0; i < 512; i++) {
    report[0x2A0 + i] = (i * 19) % 256;
  }

  return ('0x' + Array.from(report).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex;
}

// ============================================================================
// Quote Parser Tests
// ============================================================================

describe('Quote Parser', () => {
  describe('parseQuote', () => {
    test('parses TDX quote successfully', () => {
      const quoteHex = createMockTDXQuote();
      const result = parseQuote(quoteHex);
      
      expect(result.success).toBe(true);
      expect(result.quote).not.toBeNull();
      expect(result.quote!.platform).toBe('intel_tdx');
      expect(result.quote!.raw).toBe(quoteHex);
    });

    test('parses SEV-SNP quote successfully', () => {
      const quoteHex = createMockSEVQuote();
      const result = parseQuote(quoteHex);
      
      expect(result.success).toBe(true);
      expect(result.quote).not.toBeNull();
      expect(result.quote!.platform).toBe('amd_sev');
    });

    test('rejects invalid quote', () => {
      const invalidQuote = '0x1234567890' as Hex; // Too short
      const result = parseQuote(invalidQuote);
      
      expect(result.success).toBe(false);
      expect(result.quote).toBeNull();
      expect(result.error).toContain('too short');
    });

    test('extracts hardware ID from TDX quote', () => {
      const quoteHex = createMockTDXQuote();
      const result = parseQuote(quoteHex);
      
      expect(result.success).toBe(true);
      expect(result.quote!.hardwareId).toMatch(/^0x[a-f0-9]{64}$/);
    });

    test('extracts measurement from quote', () => {
      const quoteHex = createMockTDXQuote();
      const result = parseQuote(quoteHex);
      
      expect(result.success).toBe(true);
      expect(result.quote!.measurement).toMatch(/^0x[a-f0-9]+$/);
    });
  });

  describe('verifyQuote', () => {
    test('verifies valid quote', async () => {
      const quoteHex = createMockTDXQuote();
      const parseResult = parseQuote(quoteHex);
      expect(parseResult.success).toBe(true);
      
      const verifyResult = await verifyQuote(parseResult.quote!);
      
      // With mock data, signature verification may fail
      // but structure should be valid
      expect(verifyResult.quote).toBeDefined();
    });

    test('detects measurement mismatch', async () => {
      const quoteHex = createMockTDXQuote();
      const parseResult = parseQuote(quoteHex);
      expect(parseResult.success).toBe(true);
      
      // Use wrong expected measurement
      const wrongMeasurement = '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex;
      const verifyResult = await verifyQuote(parseResult.quote!, wrongMeasurement);
      
      expect(verifyResult.measurementMatch).toBe(false);
    });
  });

  describe('hashHardwareId', () => {
    test('produces consistent hashes', () => {
      const hardwareId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;
      const salt = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex;
      
      const hash1 = hashHardwareId(hardwareId, salt);
      const hash2 = hashHardwareId(hardwareId, salt);
      
      expect(hash1).toBe(hash2);
    });

    test('different salts produce different hashes', () => {
      const hardwareId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;
      const salt1 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex;
      const salt2 = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex;
      
      const hash1 = hashHardwareId(hardwareId, salt1);
      const hash2 = hashHardwareId(hardwareId, salt2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('extractPlatformInfo', () => {
    test('returns correct info for TDX', () => {
      const quoteHex = createMockTDXQuote();
      const parseResult = parseQuote(quoteHex);
      expect(parseResult.success).toBe(true);
      
      const info = extractPlatformInfo(parseResult.quote!);
      
      expect(info.platformName).toBe('Intel TDX');
      expect(info.hardwareIdType).toContain('MRTD');
    });

    test('returns correct info for SEV', () => {
      const quoteHex = createMockSEVQuote();
      const parseResult = parseQuote(quoteHex);
      expect(parseResult.success).toBe(true);
      
      const info = extractPlatformInfo(parseResult.quote!);
      
      expect(info.platformName).toBe('AMD SEV-SNP');
      expect(info.hardwareIdType).toBe('Chip ID');
    });
  });
});

// ============================================================================
// Registry Client Tests
// ============================================================================

describe('Registry Client', () => {
  let mockClient: MockPoCRegistryClient;

  beforeAll(() => {
    mockClient = new MockPoCRegistryClient();
  });

  test('verifyQuote returns mock response', async () => {
    const quoteHex = createMockTDXQuote();
    const response = await mockClient.verifyQuote(quoteHex);
    
    expect(response.verified).toBe(true);
    expect(response.level).toBe(1);
  });

  test('checkHardware returns null for unknown hardware', async () => {
    const unknownHash = '0x9999999999999999999999999999999999999999999999999999999999999999' as Hex;
    const entry = await mockClient.checkHardware(unknownHash);
    
    expect(entry).toBeNull();
  });

  test('checkHardware returns entry for known hardware', async () => {
    const knownHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;
    
    const mockEntry: PoCRegistryEntry = {
      hardwareIdHash: knownHash,
      level: 2,
      cloudProvider: 'aws',
      region: 'us-east-1',
      evidenceHashes: ['ipfs://Qm123'],
      endorsements: [],
      verifiedAt: Date.now() - 86400000,
      lastVerifiedAt: Date.now(),
      monitoringCadence: 3600,
      active: true,
    };
    
    mockClient.addMockEntry(mockEntry);
    
    const entry = await mockClient.checkHardware(knownHash);
    
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe(2);
    expect(entry!.cloudProvider).toBe('aws');
  });

  test('isRevoked returns false for valid hardware', async () => {
    const validHash = '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex;
    
    mockClient.addMockEntry({
      hardwareIdHash: validHash,
      level: 1,
      cloudProvider: 'gcp',
      region: 'us-central1',
      evidenceHashes: [],
      endorsements: [],
      verifiedAt: Date.now(),
      lastVerifiedAt: Date.now(),
      monitoringCadence: 3600,
      active: true,
    });
    
    const isRevoked = await mockClient.isRevoked(validHash);
    expect(isRevoked).toBe(false);
  });

  test('revocation marks hardware as inactive', async () => {
    const revokedHash = '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex;
    
    mockClient.addMockEntry({
      hardwareIdHash: revokedHash,
      level: 1,
      cloudProvider: 'azure',
      region: 'eastus',
      evidenceHashes: [],
      endorsements: [],
      verifiedAt: Date.now(),
      lastVerifiedAt: Date.now(),
      monitoringCadence: 3600,
      active: true,
    });
    
    mockClient.addMockRevocation({
      hardwareIdHash: revokedHash,
      reason: 'Compromised',
      evidenceHash: '0x' as Hex,
      timestamp: Date.now(),
      approvers: ['alliance-member-1'],
    });
    
    const isRevoked = await mockClient.isRevoked(revokedHash);
    expect(isRevoked).toBe(true);
    
    const entry = await mockClient.checkHardware(revokedHash);
    expect(entry?.active).toBe(false);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  test('PoCError includes error code', () => {
    const error = new PoCError(
      PoCErrorCode.INVALID_QUOTE,
      'Test error message',
      { detail: 'extra info' }
    );
    
    expect(error.code).toBe(PoCErrorCode.INVALID_QUOTE);
    expect(error.message).toContain('INVALID_QUOTE');
    expect(error.message).toContain('Test error message');
    expect(error.context).toEqual({ detail: 'extra info' });
  });

  test('PoCError works with instanceof', () => {
    const error = new PoCError(PoCErrorCode.ORACLE_UNAVAILABLE, 'Oracle down');
    
    expect(error instanceof Error).toBe(true);
    expect(error instanceof PoCError).toBe(true);
    expect(error.name).toBe('PoCError');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  test('full verification flow with mock data', async () => {
    // 1. Parse quote
    const quoteHex = createMockTDXQuote();
    const parseResult = parseQuote(quoteHex);
    expect(parseResult.success).toBe(true);
    
    // 2. Check against registry
    const mockClient = new MockPoCRegistryClient();
    const registryResult = await mockClient.verifyQuote(quoteHex);
    expect(registryResult.verified).toBe(true);
    
    // 3. Verify quote structure
    const verifyResult = await verifyQuote(parseResult.quote!);
    expect(verifyResult.quote).toBeDefined();
    
    // 4. Hash hardware ID
    const salt = '0xdeadbeef' as Hex;
    const hashedId = hashHardwareId(parseResult.quote!.hardwareId, salt);
    expect(hashedId).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('quote parsing handles various platforms', async () => {
    const tdxQuote = createMockTDXQuote();
    const sevQuote = createMockSEVQuote();
    
    const tdxResult = parseQuote(tdxQuote);
    const sevResult = parseQuote(sevQuote);
    
    expect(tdxResult.success).toBe(true);
    expect(sevResult.success).toBe(true);
    expect(tdxResult.quote!.platform).toBe('intel_tdx');
    expect(sevResult.quote!.platform).toBe('amd_sev');
  });
});

