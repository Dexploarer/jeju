/**
 * Token-related Zod schemas
 */

import { NonEmptyStringSchema, UrlSchema } from '@jejunetwork/types'
import { z } from 'zod'

export const TokenMetadataSchema = z.object({
  name: NonEmptyStringSchema,
  symbol: NonEmptyStringSchema.max(10, 'Symbol must be 10 characters or less'),
  description: z.string().optional(),
  imageUrl: UrlSchema.optional(),
  website: UrlSchema.optional(),
  twitter: z
    .string()
    .regex(/^[a-zA-Z0-9_]{1,15}$/, 'Invalid Twitter handle')
    .optional(),
  telegram: z.string().optional(),
  discord: UrlSchema.optional(),
})

export type TokenMetadata = z.infer<typeof TokenMetadataSchema>
