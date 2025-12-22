/**
 * Eden Client
 *
 * Type-safe API client for backend communication
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '@babylon/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const edenClient = treaty<App>(API_URL);
