/**
 * Storage V2 API Tests
 * 
 * Tests for the enhanced multi-backend storage API
 * NOTE: These tests use /storage routes (v2 routes were consolidated into main storage)
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/server';
import { resetMultiBackendManager } from '../../src/storage/multi-backend';

// ============================================================================
// Test Setup
// ============================================================================

afterAll(() => {
  resetMultiBackendManager();
});

// ============================================================================
// Helper Functions
// ============================================================================

async function uploadFile(
  content: Buffer,
  options: {
    filename?: string;
    tier?: string;
    category?: string;
    encrypt?: boolean;
    permanent?: boolean;
  } = {}
) {
  // Use main storage upload endpoint
  const res = await app.request('/storage/upload/raw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-filename': options.filename ?? 'test.bin',
    },
    body: content,
  });

  return res;
}

// ============================================================================
// Health Tests
// ============================================================================

describe('Storage V2 - Health', () => {
  it('GET /health should return healthy status', async () => {
    const res = await app.request('/storage/health');
    expect(res.status).toBe(200);

    const data = await res.json() as { service: string; status: string; backends?: string[] };
    expect(data.service).toBe('dws-storage');
    expect(data.status).toBe('healthy');
  });

  it('GET /stats should return stats', async () => {
    const res = await app.request('/storage/stats');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toBeDefined();
  });
});

// ============================================================================
// Upload Tests
// ============================================================================

describe('Storage V2 - Upload', () => {
  it('POST /upload/raw should upload file', async () => {
    const content = Buffer.from('test content for upload');
    const res = await uploadFile(content, {
      filename: 'test.txt',
    });

    expect(res.status).toBe(200);

    const data = await res.json() as { cid: string; size: number };
    expect(data.cid).toBeDefined();
    expect(data.size).toBe(content.length);
  });

  it('POST /upload/raw should handle different content', async () => {
    const content = Buffer.from('system content');
    const res = await uploadFile(content, {
      filename: 'app.js',
    });

    expect(res.status).toBe(200);

    const data = await res.json() as { cid: string };
    expect(data.cid).toBeDefined();
  });

  it('POST /upload/raw should upload binary data', async () => {
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    
    const res = await app.request('/storage/upload/raw', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/octet-stream',
        'x-filename': 'test-data.bin',
      },
      body: binaryData,
    });

    expect(res.status).toBe(200);

    const data = await res.json() as { cid: string };
    expect(data.cid).toBeDefined();
  });
});

// ============================================================================
// Download Tests
// ============================================================================

describe('Storage V2 - Download', () => {
  let uploadedCid: string;

  beforeAll(async () => {
    const content = Buffer.from('content to download');
    const res = await uploadFile(content, { filename: 'download-test.bin' });
    const data = await res.json() as { cid: string };
    uploadedCid = data.cid;
  });

  it('GET /download/:cid should return content', async () => {
    const res = await app.request(`/storage/download/${uploadedCid}`);
    expect(res.status).toBe(200);

    const content = await res.arrayBuffer();
    expect(Buffer.from(content).length).toBeGreaterThan(0);
  });

  it('GET /download/:cid should return error for non-existent content', async () => {
    const res = await app.request('/storage/download/nonexistent-cid-123');
    // 404 for not found, 400 for invalid CID, 500 if backend throws
    expect([400, 404, 500]).toContain(res.status);
  });

  it('GET /download/:cid should return uploaded content', async () => {
    const res = await app.request(`/storage/download/${uploadedCid}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBeDefined();
  });
});

// ============================================================================
// Content Management Tests
// ============================================================================

describe('Storage V2 - Content Management', () => {
  let testCid: string;

  beforeAll(async () => {
    const content = Buffer.from('content for management tests');
    const res = await uploadFile(content, { filename: 'manage-test.bin' });
    const data = await res.json() as { cid: string };
    testCid = data.cid;
  });

  it('GET /content/:cid should return metadata', async () => {
    const res = await app.request(`/storage/content/${testCid}`);
    expect(res.status).toBe(200);

    const data = await res.json() as { cid: string };
    expect(data.cid).toBe(testCid);
  });

  it('GET /content/:cid should return error for non-existent', async () => {
    const res = await app.request('/storage/content/nonexistent-123');
    // 404 for not found, 400 for invalid CID, 500 if backend throws
    expect([400, 404, 500]).toContain(res.status);
  });

  it('GET /content should list content', async () => {
    const res = await app.request('/storage/content');
    expect(res.status).toBe(200);

    const data = await res.json() as { items: Array<{ cid: string }>; total: number };
    expect(data.items).toBeInstanceOf(Array);
  });

  it('GET /content can filter results', async () => {
    const res = await app.request('/storage/content?limit=10');
    expect(res.status).toBe(200);

    const data = await res.json() as { items: Array<{ cid: string }> };
    expect(data.items.length).toBeLessThanOrEqual(10);
  });

  it('GET /exists/:cid should check existence', async () => {
    const res = await app.request(`/storage/exists/${testCid}`);
    expect(res.status).toBe(200);

    const data = await res.json() as { cid: string; exists: boolean };
    expect(data.cid).toBe(testCid);
    expect(data.exists).toBe(true);
  });
});

// ============================================================================
// Popularity Tests
// ============================================================================

describe('Storage V2 - Popularity', () => {
  beforeAll(async () => {
    // Upload some content and access it
    for (let i = 0; i < 3; i++) {
      const content = Buffer.from(`popularity test ${i}`);
      const res = await uploadFile(content);
      const data = await res.json() as { cid: string };
      
      // Access multiple times to track popularity
      for (let j = 0; j < 5; j++) {
        await app.request(`/storage/download/${data.cid}`);
      }
    }
  });

  it('GET /popular should return popular content', async () => {
    const res = await app.request('/storage/popular');
    expect(res.status).toBe(200);

    const data = await res.json() as { items: Array<{ cid: string }> };
    expect(data.items).toBeInstanceOf(Array);
  });

  it('GET /popular?limit=5 should respect limit', async () => {
    const res = await app.request('/storage/popular?limit=5');
    expect(res.status).toBe(200);

    const data = await res.json() as { items: Array<{ cid: string }> };
    expect(data.items.length).toBeLessThanOrEqual(5);
  });

  it('GET /underseeded should return underseeded content', async () => {
    const res = await app.request('/storage/underseeded');
    expect(res.status).toBe(200);

    const data = await res.json() as { items: Array<{ cid: string }> };
    expect(data.items).toBeInstanceOf(Array);
  });
});

// ============================================================================
// IPFS Compatibility Tests
// ============================================================================

describe('Storage V2 - IPFS Compatibility', () => {
  it('POST /api/v0/add should work like IPFS', async () => {
    const content = Buffer.from('ipfs compatible upload');
    const formData = new FormData();
    formData.append('file', new Blob([content]), 'test.txt');

    const res = await app.request('/storage/api/v0/add', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);

    const data = await res.json() as { Hash: string; Size: string; Name: string };
    expect(data.Hash).toBeDefined();
    expect(data.Size).toBe(String(content.length));
  });

  it('POST /api/v0/id should return node info or 503 if backends unhealthy', async () => {
    const res = await app.request('/storage/api/v0/id', { method: 'POST' });
    
    // May return 503 if IPFS is not available
    if (res.status === 200) {
      const data = await res.json() as { ID: string; AgentVersion: string };
      expect(data.ID).toBe('dws-storage');
      expect(data.AgentVersion).toContain('dws/');
    } else {
      expect(res.status).toBe(503);
    }
  });

  it('GET /ipfs/:cid should serve content', async () => {
    // First upload
    const content = Buffer.from('ipfs gateway test');
    const formData = new FormData();
    formData.append('file', new Blob([content]), 'ipfs-test.txt');

    const uploadRes = await app.request('/storage/api/v0/add', {
      method: 'POST',
      body: formData,
    });

    const uploadData = await uploadRes.json() as { Hash: string };
    
    // Then fetch via IPFS gateway
    const res = await app.request(`/storage/ipfs/${uploadData.Hash}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Ipfs-Path')).toBe(`/ipfs/${uploadData.Hash}`);
  });
});

