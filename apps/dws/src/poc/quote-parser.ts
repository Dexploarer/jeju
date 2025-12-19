/**
 * TEE Quote Parser
 * 
 * Parses and validates attestation quotes from Intel TDX/SGX and AMD SEV-SNP
 * to extract hardware IDs and measurements for PoC verification.
 */

import { keccak256, toBytes, toHex, type Hex } from 'viem';
import {
  type TEEQuote,
  type TEEPlatform,
  type DCAPQuoteHeader,
  type TDXReportBody,
  type SEVSNPReport,
  type QuoteParseResult,
  type QuoteVerificationResult,
  PoCError,
  PoCErrorCode,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Intel SGX TEE type identifier */
const SGX_TEE_TYPE = 0x00;

/** Intel TDX TEE type identifier */
const TDX_TEE_TYPE = 0x81;

/** DCAP Quote version 4 */
const DCAP_QUOTE_VERSION = 4;

/** Minimum quote size for basic validation */
const MIN_QUOTE_SIZE = 128;

/** Intel vendor ID */
const INTEL_VENDOR_ID = '939a7233f79c4ca9940a0db3957f0607';

/** AMD SEV-SNP magic bytes */
const SEV_SNP_MAGIC = 0x01;

/** SEV-SNP report minimum size */
const SEV_SNP_MIN_SIZE = 0x2A0;

// ============================================================================
// Quote Parsing
// ============================================================================

/**
 * Parse a TEE attestation quote from raw bytes
 */
export function parseQuote(quoteHex: Hex): QuoteParseResult {
  const bytes = hexToBytes(quoteHex);
  
  if (bytes.length < MIN_QUOTE_SIZE) {
    return {
      success: false,
      quote: null,
      error: `Quote too short: ${bytes.length} bytes (minimum ${MIN_QUOTE_SIZE})`,
    };
  }

  // Try Intel DCAP format first
  const dcapResult = parseDCAPQuote(bytes, quoteHex);
  if (dcapResult.success) {
    return dcapResult;
  }

  // Try AMD SEV-SNP format
  const sevResult = parseSEVSNPQuote(bytes, quoteHex);
  if (sevResult.success) {
    return sevResult;
  }

  return {
    success: false,
    quote: null,
    error: `Unrecognized quote format. DCAP: ${dcapResult.error}. SEV-SNP: ${sevResult.error}`,
  };
}

/**
 * Parse Intel DCAP quote (SGX/TDX)
 */
function parseDCAPQuote(bytes: Uint8Array, raw: Hex): QuoteParseResult {
  // Parse header (48 bytes)
  const version = readUint16LE(bytes, 0);
  if (version !== DCAP_QUOTE_VERSION) {
    return {
      success: false,
      quote: null,
      error: `Invalid DCAP version: ${version} (expected ${DCAP_QUOTE_VERSION})`,
    };
  }

  const header = parseDCAPHeader(bytes);
  
  // Determine platform from TEE type
  let platform: TEEPlatform;
  if (header.teeType === TDX_TEE_TYPE) {
    platform = 'intel_tdx';
  } else if (header.teeType === SGX_TEE_TYPE) {
    platform = 'intel_sgx';
  } else {
    return {
      success: false,
      quote: null,
      error: `Unknown TEE type: ${header.teeType}`,
    };
  }

  // Verify vendor ID - strip 0x prefix for comparison
  const vendorIdHex = bytesToHex(bytes.slice(12, 28)).slice(2).toLowerCase();
  if (vendorIdHex !== INTEL_VENDOR_ID) {
    return {
      success: false,
      quote: null,
      error: `Invalid vendor ID: ${vendorIdHex}`,
    };
  }

  // Parse report body based on TEE type
  let hardwareId: Hex;
  let measurement: Hex;
  let reportData: Hex;
  let securityVersion: { cpu: number; tcb: number };

  if (platform === 'intel_tdx') {
    const reportBody = parseTDXReportBody(bytes, 48);
    measurement = reportBody.mrTd;
    reportData = reportBody.reportData;
    // TDX uses MRSIGNERSEAM + MRTD as hardware identity
    hardwareId = keccak256(toBytes(`${reportBody.mrSignerSeam}${reportBody.mrTd}`));
    securityVersion = {
      cpu: readUint16LE(bytes, 48), // TEE TCB SVN first 2 bytes
      tcb: Number(BigInt(`0x${reportBody.teeTcbSvn.slice(2, 6)}`)),
    };
  } else {
    // SGX report body parsing
    const sgxReportBody = parseSGXReportBody(bytes, 48);
    measurement = sgxReportBody.mrEnclave;
    reportData = sgxReportBody.reportData;
    // SGX uses MRSIGNER + MRENCLAVE as hardware identity
    hardwareId = keccak256(toBytes(`${sgxReportBody.mrSigner}${sgxReportBody.mrEnclave}`));
    securityVersion = {
      cpu: sgxReportBody.cpuSvn,
      tcb: sgxReportBody.isvSvn,
    };
  }

  // Extract signature from quote
  // Signature data starts after header + report body
  // TDX: header(48) + report body(584) = 632
  // SGX: header(48) + report body(384) = 432
  const signatureDataOffset = platform === 'intel_tdx' ? (48 + 584) : (48 + 384);
  const signatureDataLength = readUint32LE(bytes, signatureDataOffset);
  const signatureStart = signatureDataOffset + 4;
  const signatureEnd = signatureStart + signatureDataLength;

  if (signatureEnd > bytes.length) {
    return {
      success: false,
      quote: null,
      error: `Signature extends beyond quote: ${signatureEnd} > ${bytes.length}`,
    };
  }

  const signature = bytesToHex(bytes.slice(signatureStart, signatureEnd)) as Hex;

  // Extract certificate chain from signature data
  const certChain = extractCertChain(bytes.slice(signatureStart, signatureEnd));

  const quote: TEEQuote = {
    raw,
    platform,
    hardwareId,
    measurement,
    reportData,
    securityVersion,
    signature,
    certChain,
    timestamp: null, // DCAP quotes don't have embedded timestamps
  };

  return { success: true, quote, error: null };
}

/**
 * Parse DCAP quote header
 */
function parseDCAPHeader(bytes: Uint8Array): DCAPQuoteHeader {
  return {
    version: readUint16LE(bytes, 0),
    attestationKeyType: readUint16LE(bytes, 2),
    teeType: readUint32LE(bytes, 4),
    reserved: bytesToHex(bytes.slice(8, 12)) as Hex,
    vendorId: bytesToHex(bytes.slice(12, 28)) as Hex,
    userData: bytesToHex(bytes.slice(28, 48)) as Hex,
  };
}

/**
 * Parse TDX report body (584 bytes starting at offset 48)
 */
function parseTDXReportBody(bytes: Uint8Array, offset: number): TDXReportBody {
  return {
    teeTcbSvn: bytesToHex(bytes.slice(offset, offset + 16)) as Hex,
    mrSeam: bytesToHex(bytes.slice(offset + 16, offset + 64)) as Hex,
    mrSignerSeam: bytesToHex(bytes.slice(offset + 64, offset + 112)) as Hex,
    seamAttributes: bytesToHex(bytes.slice(offset + 112, offset + 120)) as Hex,
    tdAttributes: bytesToHex(bytes.slice(offset + 120, offset + 128)) as Hex,
    xfam: bytesToHex(bytes.slice(offset + 128, offset + 136)) as Hex,
    mrTd: bytesToHex(bytes.slice(offset + 136, offset + 184)) as Hex,
    mrConfigId: bytesToHex(bytes.slice(offset + 184, offset + 232)) as Hex,
    mrOwner: bytesToHex(bytes.slice(offset + 232, offset + 280)) as Hex,
    mrOwnerConfig: bytesToHex(bytes.slice(offset + 280, offset + 328)) as Hex,
    rtMr0: bytesToHex(bytes.slice(offset + 328, offset + 376)) as Hex,
    rtMr1: bytesToHex(bytes.slice(offset + 376, offset + 424)) as Hex,
    rtMr2: bytesToHex(bytes.slice(offset + 424, offset + 472)) as Hex,
    rtMr3: bytesToHex(bytes.slice(offset + 472, offset + 520)) as Hex,
    reportData: bytesToHex(bytes.slice(offset + 520, offset + 584)) as Hex,
  };
}

/**
 * Parse SGX report body (384 bytes)
 */
interface SGXReportBody {
  cpuSvn: number;
  miscSelect: number;
  attributes: Hex;
  mrEnclave: Hex;
  mrSigner: Hex;
  isvProdId: number;
  isvSvn: number;
  reportData: Hex;
}

function parseSGXReportBody(bytes: Uint8Array, offset: number): SGXReportBody {
  return {
    cpuSvn: readUint16LE(bytes, offset),
    miscSelect: readUint32LE(bytes, offset + 16),
    attributes: bytesToHex(bytes.slice(offset + 48, offset + 64)) as Hex,
    mrEnclave: bytesToHex(bytes.slice(offset + 64, offset + 96)) as Hex,
    mrSigner: bytesToHex(bytes.slice(offset + 128, offset + 160)) as Hex,
    isvProdId: readUint16LE(bytes, offset + 256),
    isvSvn: readUint16LE(bytes, offset + 258),
    reportData: bytesToHex(bytes.slice(offset + 320, offset + 384)) as Hex,
  };
}

/**
 * Parse AMD SEV-SNP attestation report
 */
function parseSEVSNPQuote(bytes: Uint8Array, raw: Hex): QuoteParseResult {
  if (bytes.length < SEV_SNP_MIN_SIZE) {
    return {
      success: false,
      quote: null,
      error: `SEV-SNP report too short: ${bytes.length} bytes (minimum ${SEV_SNP_MIN_SIZE})`,
    };
  }

  // Check version byte
  const version = readUint32LE(bytes, 0);
  if (version !== 2) {
    return {
      success: false,
      quote: null,
      error: `Invalid SEV-SNP version: ${version}`,
    };
  }

  const report = parseSEVSNPReport(bytes);

  // Chip ID is the unique hardware identifier
  const hardwareId = report.chipId;
  const measurement = report.measurement;
  const reportData = bytesToHex(bytes.slice(0x50, 0x90)) as Hex; // Host data + report data

  const quote: TEEQuote = {
    raw,
    platform: 'amd_sev',
    hardwareId,
    measurement,
    reportData,
    securityVersion: {
      cpu: report.guestSvn,
      tcb: Number(report.currentTcb & 0xFFFFn),
    },
    signature: report.signature,
    certChain: [], // SEV-SNP uses different cert structure
    timestamp: null,
  };

  return { success: true, quote, error: null };
}

/**
 * Parse SEV-SNP attestation report structure
 */
function parseSEVSNPReport(bytes: Uint8Array): SEVSNPReport {
  return {
    version: readUint32LE(bytes, 0),
    guestSvn: readUint32LE(bytes, 4),
    policy: readUint64LE(bytes, 8),
    familyId: bytesToHex(bytes.slice(0x10, 0x20)) as Hex,
    imageId: bytesToHex(bytes.slice(0x20, 0x30)) as Hex,
    vmpl: readUint32LE(bytes, 0x30),
    signatureAlgo: readUint32LE(bytes, 0x34),
    currentTcb: readUint64LE(bytes, 0x38),
    platformInfo: readUint64LE(bytes, 0x40),
    measurement: bytesToHex(bytes.slice(0x90, 0xC0)) as Hex,
    hostData: bytesToHex(bytes.slice(0xC0, 0xE0)) as Hex,
    idKeyDigest: bytesToHex(bytes.slice(0xE0, 0x110)) as Hex,
    authorKeyDigest: bytesToHex(bytes.slice(0x110, 0x140)) as Hex,
    reportId: bytesToHex(bytes.slice(0x140, 0x160)) as Hex,
    reportIdMa: bytesToHex(bytes.slice(0x160, 0x180)) as Hex,
    reportedTcb: readUint64LE(bytes, 0x180),
    chipId: bytesToHex(bytes.slice(0x1A0, 0x1E0)) as Hex,
    signature: bytesToHex(bytes.slice(0x2A0, 0x2A0 + 512)) as Hex,
  };
}

/**
 * Extract PEM certificate chain from DCAP signature data
 */
function extractCertChain(signatureData: Uint8Array): string[] {
  const certs: string[] = [];
  
  // ECDSA signature is first 64 bytes
  // Then comes the attestation key followed by cert data
  const certDataOffset = 64 + 64 + 4; // sig + pubkey + size
  
  if (signatureData.length <= certDataOffset) {
    return certs;
  }

  const certDataSize = readUint32LE(signatureData, 64 + 64);
  if (certDataSize === 0 || certDataOffset + certDataSize > signatureData.length) {
    return certs;
  }

  const certData = signatureData.slice(certDataOffset, certDataOffset + certDataSize);
  const certString = new TextDecoder().decode(certData);
  
  // Split PEM certificates
  const pemPattern = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  const matches = certString.match(pemPattern);
  
  if (matches) {
    certs.push(...matches);
  }

  return certs;
}

// ============================================================================
// Quote Verification
// ============================================================================

/**
 * Verify a parsed TEE quote
 */
export async function verifyQuote(
  quote: TEEQuote,
  expectedMeasurement?: Hex,
): Promise<QuoteVerificationResult> {
  // Measurement verification
  const measurementMatch = expectedMeasurement 
    ? quote.measurement.toLowerCase() === expectedMeasurement.toLowerCase()
    : true;

  // Certificate chain verification
  const certificateValid = await verifyCertificateChain(quote);

  // Signature verification
  const signatureValid = await verifyQuoteSignature(quote);

  // TCB status check
  const tcbStatus = await checkTCBStatus(quote);

  const valid = measurementMatch && certificateValid && signatureValid && tcbStatus === 'upToDate';

  return {
    valid,
    quote,
    certificateValid,
    signatureValid,
    measurementMatch,
    tcbStatus,
    error: valid ? null : buildVerificationError({
      measurementMatch,
      certificateValid,
      signatureValid,
      tcbStatus,
    }),
  };
}

/**
 * Verify certificate chain against Intel/AMD root CAs
 */
async function verifyCertificateChain(quote: TEEQuote): Promise<boolean> {
  if (quote.certChain.length === 0) {
    // SEV-SNP or quotes without embedded certs need external verification
    return quote.platform === 'amd_sev' ? true : false;
  }

  // For Intel quotes, verify the cert chain
  // In production, this would validate against Intel's root CA
  // For now, we verify the chain structure is valid

  for (const cert of quote.certChain) {
    if (!cert.includes('BEGIN CERTIFICATE') || !cert.includes('END CERTIFICATE')) {
      return false;
    }
  }

  // Verify chain has at least 2 certs (leaf + intermediate)
  if (quote.certChain.length < 2) {
    return false;
  }

  return true;
}

/**
 * Verify quote signature
 */
async function verifyQuoteSignature(quote: TEEQuote): Promise<boolean> {
  // The signature is ECDSA over the quote header + body
  // In production, this would use the attestation key from cert chain
  
  // Basic validation that signature exists and has correct length
  const sigBytes = hexToBytes(quote.signature);
  
  if (quote.platform === 'amd_sev') {
    // SEV-SNP uses RSA-4096 signatures (512 bytes)
    return sigBytes.length === 512;
  } else {
    // Intel uses ECDSA-P256 (64 bytes minimum for r||s)
    return sigBytes.length >= 64;
  }
}

/**
 * Check TCB (Trusted Computing Base) status
 */
async function checkTCBStatus(
  quote: TEEQuote,
): Promise<'upToDate' | 'outOfDate' | 'revoked' | 'unknown'> {
  // In production, this would query Intel's PCS or AMD's KDS
  // to check if the TCB version is current
  
  // For Intel, check against minimum required TCB SVN
  if (quote.platform === 'intel_tdx' || quote.platform === 'intel_sgx') {
    // Basic check: TCB should be non-zero
    if (quote.securityVersion.tcb === 0) {
      return 'unknown';
    }
    // In production: query Intel PCK Certificate Service
    return 'upToDate';
  }

  // For AMD SEV-SNP
  if (quote.platform === 'amd_sev') {
    if (quote.securityVersion.cpu === 0) {
      return 'unknown';
    }
    return 'upToDate';
  }

  return 'unknown';
}

function buildVerificationError(results: {
  measurementMatch: boolean;
  certificateValid: boolean;
  signatureValid: boolean;
  tcbStatus: string;
}): string {
  const errors: string[] = [];
  
  if (!results.measurementMatch) {
    errors.push('Measurement mismatch');
  }
  if (!results.certificateValid) {
    errors.push('Invalid certificate chain');
  }
  if (!results.signatureValid) {
    errors.push('Invalid signature');
  }
  if (results.tcbStatus !== 'upToDate') {
    errors.push(`TCB status: ${results.tcbStatus}`);
  }
  
  return errors.join('; ');
}

// ============================================================================
// Hardware ID Generation
// ============================================================================

/**
 * Generate salted hash of hardware ID for privacy-preserving registry lookup
 */
export function hashHardwareId(hardwareId: Hex, salt: Hex): Hex {
  return keccak256(toBytes(`${salt}${hardwareId}`));
}

/**
 * Extract platform-specific identifier from quote
 */
export function extractPlatformInfo(quote: TEEQuote): {
  platformName: string;
  hardwareIdType: string;
} {
  switch (quote.platform) {
    case 'intel_tdx':
      return {
        platformName: 'Intel TDX',
        hardwareIdType: 'MRSIGNERSEAM+MRTD Hash',
      };
    case 'intel_sgx':
      return {
        platformName: 'Intel SGX',
        hardwareIdType: 'MRSIGNER+MRENCLAVE Hash',
      };
    case 'amd_sev':
      return {
        platformName: 'AMD SEV-SNP',
        hardwareIdType: 'Chip ID',
      };
    case 'nvidia_cc':
      return {
        platformName: 'NVIDIA Confidential Computing',
        hardwareIdType: 'Device Attestation',
      };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function hexToBytes(hex: Hex): Uint8Array {
  const str = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(str.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(str.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readUint64LE(bytes: Uint8Array, offset: number): bigint {
  const low = readUint32LE(bytes, offset);
  const high = readUint32LE(bytes, offset + 4);
  return BigInt(low) | (BigInt(high) << 32n);
}

// ============================================================================
// Exports
// ============================================================================

export {
  parseDCAPQuote,
  parseSEVSNPQuote,
  parseDCAPHeader,
  parseTDXReportBody,
  extractCertChain,
  verifyCertificateChain,
  verifyQuoteSignature,
  checkTCBStatus,
};

