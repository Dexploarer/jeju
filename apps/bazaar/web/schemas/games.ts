/**
 * Game-related Zod schemas
 * Validation for game data from indexer and contracts
 */

import { NonEmptyStringSchema } from '@jejunetwork/types'
import { z } from 'zod'

// Game Item Category enum for filtering
const ItemCategorySchema = z.enum([
  'all',
  'weapons',
  'armor',
  'tools',
  'resources',
])
export type ItemCategory = z.infer<typeof ItemCategorySchema>

// Registered Game from ERC-8004 registry
const RegisteredGameSchema = z.object({
  id: NonEmptyStringSchema,
  agentId: z.number().int().nonnegative(),
  name: NonEmptyStringSchema,
  tags: z.array(z.string()),
  totalPlayers: z.number().int().nonnegative().optional(),
  totalItems: z.number().int().nonnegative().optional(),
})
export type RegisteredGame = z.infer<typeof RegisteredGameSchema>

// Game Item from Items.sol (ERC-1155)
const GameItemSchema = z.object({
  id: NonEmptyStringSchema,
  tokenId: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  rarity: z.number().int().min(0).max(4),
  attack: z.number().int().nonnegative(),
  defense: z.number().int().nonnegative(),
  strength: z.number().int().nonnegative(),
  stackable: z.boolean(),
  balance: NonEmptyStringSchema,
  owner: NonEmptyStringSchema,
  originalMinter: NonEmptyStringSchema.optional(),
  mintedAt: z.number().int().nonnegative().optional(),
})
export type GameItem = z.infer<typeof GameItemSchema>

// Response schemas for indexer queries
export const RegisteredGamesResponseSchema = z.object({
  registeredGames: z.array(RegisteredGameSchema),
})
