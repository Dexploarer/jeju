/**
 * Unit Tests for Utilities
 */

import { describe, expect, it } from 'bun:test';
import {
  bytesEqual,
  bytesToHex,
  concatBytes,
  hexToBytes,
  sleep,
} from '../../src/utils/index.js';

describe('Hex Utilities', () => {
  describe('hexToBytes', () => {
    it('should convert hex string to bytes', () => {
      const hex = '0x0102030405';
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should handle hex without 0x prefix', () => {
      const hex = 'abcdef';
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([0xab, 0xcd, 0xef]));
    });

    it('should handle empty hex', () => {
      const bytes = hexToBytes('0x');
      expect(bytes.length).toBe(0);
    });

    it('should handle uppercase hex', () => {
      const bytes = hexToBytes('0xABCDEF');
      expect(bytes).toEqual(new Uint8Array([0xab, 0xcd, 0xef]));
    });
  });

  describe('bytesToHex', () => {
    it('should convert bytes to hex with prefix', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const hex = bytesToHex(bytes, true);
      expect(hex).toBe('0x0102030405');
    });

    it('should convert bytes to hex without prefix', () => {
      const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
      const hex = bytesToHex(bytes, false);
      expect(hex).toBe('abcdef');
    });

    it('should handle empty bytes', () => {
      const hex = bytesToHex(new Uint8Array(0));
      expect(hex).toBe('0x');
    });
  });

  describe('concatBytes', () => {
    it('should concatenate multiple byte arrays', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5, 6]);
      const result = concatBytes(a, b, c);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it('should handle empty arrays', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array(0);
      const c = new Uint8Array([3, 4]);
      const result = concatBytes(a, b, c);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('should handle single array', () => {
      const a = new Uint8Array([1, 2, 3]);
      const result = concatBytes(a);
      expect(result).toEqual(a);
    });
  });

  describe('bytesEqual', () => {
    it('should return true for equal arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      expect(bytesEqual(a, b)).toBe(true);
    });

    it('should return false for different arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      expect(bytesEqual(a, b)).toBe(false);
    });

    it('should return false for different lengths', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2]);
      expect(bytesEqual(a, b)).toBe(false);
    });

    it('should handle empty arrays', () => {
      const a = new Uint8Array(0);
      const b = new Uint8Array(0);
      expect(bytesEqual(a, b)).toBe(true);
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow 5ms tolerance
      expect(elapsed).toBeLessThan(100);
    });
  });
});
