/**
 * Otto Chat API
 * REST API for web-based chat with Otto
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Address, Hex } from 'viem';
import { verifyMessage } from 'viem';
import type { ChatMessage, ChatSession, ChatRequest, ChatResponse, PlatformMessage, CommandResult } from '../types';
import { commandHandler } from '../agent/commands';
import { getWalletService } from '../services/wallet';
import { getConfig } from '../config';

const walletService = getWalletService();
const sessions = new Map<string, ChatSession>();

export const chatApi = new Hono();

chatApi.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-Wallet-Address'],
}));

// Create session
chatApi.post('/session', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { walletAddress?: Address };
  
  const sessionId = crypto.randomUUID();
  const session: ChatSession = {
    sessionId,
    userId: body.walletAddress ?? sessionId,
    messages: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  
  sessions.set(sessionId, session);
  
  const welcome: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: body.walletAddress 
      ? `Connected: ${body.walletAddress.slice(0, 6)}...${body.walletAddress.slice(-4)}\n\nReady to trade. Try: swap 1 ETH to USDC`
      : `Otto here. Connect your wallet to trade, or type \`help\`.`,
    timestamp: Date.now(),
  };
  
  session.messages.push(welcome);
  return c.json({ sessionId, messages: session.messages });
});

// Get session
chatApi.get('/session/:id', (c) => {
  const session = sessions.get(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json({ sessionId: session.sessionId, messages: session.messages, userId: session.userId });
});

// Send message - THE CORE FLOW
chatApi.post('/chat', async (c) => {
  const body = await c.req.json() as ChatRequest;
  const walletAddress = c.req.header('X-Wallet-Address') as Address | undefined;
  
  let sessionId = body.sessionId ?? c.req.header('X-Session-Id');
  let session = sessionId ? sessions.get(sessionId) : null;
  
  if (!session) {
    sessionId = crypto.randomUUID();
    session = {
      sessionId,
      userId: walletAddress ?? body.userId ?? sessionId,
      messages: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    sessions.set(sessionId, session);
  }
  
  // Add user message
  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: body.message,
    timestamp: Date.now(),
  };
  session.messages.push(userMsg);
  session.lastActiveAt = Date.now();
  
  // Process through REAL command handler
  const platformMessage: PlatformMessage = {
    platform: 'web',
    messageId: userMsg.id,
    channelId: sessionId,
    userId: session.userId,
    content: body.message.trim(),
    timestamp: Date.now(),
    isCommand: true,
  };
  
  const command = commandHandler.parseCommand(platformMessage);
  let result: CommandResult;
  
  if (command) {
    result = await commandHandler.execute(command);
  } else {
    // Not a known command - try to be helpful
    result = {
      success: true,
      message: `Unknown command. Type \`help\` for options.`,
    };
  }
  
  // Create response
  const assistantMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: result.message,
    timestamp: Date.now(),
    embed: result.embed,
    buttons: result.buttons,
  };
  session.messages.push(assistantMsg);
  
  const requiresAuth = !walletAddress && result.message.toLowerCase().includes('connect');
  const config = getConfig();
  
  return c.json({
    sessionId,
    message: assistantMsg,
    requiresAuth,
    authUrl: requiresAuth ? `${config.baseUrl}/auth/connect` : undefined,
  } as ChatResponse);
});

// Auth message for signing
chatApi.get('/auth/message', (c) => {
  const address = c.req.query('address') as Address;
  if (!address) return c.json({ error: 'Address required' }, 400);
  
  const nonce = crypto.randomUUID();
  const message = `Sign in to Otto\nAddress: ${address}\nNonce: ${nonce}`;
  return c.json({ message, nonce });
});

// Verify signature
chatApi.post('/auth/verify', async (c) => {
  const body = await c.req.json() as {
    address: Address;
    message: string;
    signature: Hex;
    sessionId: string;
  };
  
  const valid = await verifyMessage({
    address: body.address,
    message: body.message,
    signature: body.signature,
  });
  
  if (!valid) return c.json({ error: 'Invalid signature' }, 401);
  
  const session = sessions.get(body.sessionId);
  if (session) session.userId = body.address;
  
  const nonce = body.message.match(/Nonce: ([a-zA-Z0-9-]+)/)?.[1];
  if (nonce) {
    await walletService.verifyAndConnect('web', body.sessionId, body.address, body.address, body.signature, nonce);
  }
  
  return c.json({ success: true, address: body.address });
});

export default chatApi;
