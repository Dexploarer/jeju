/**
 * Application Constants
 */

export const APP_NAME = 'Babylon'

export const DEFAULT_PAGE_SIZE = 20

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10MB

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const REFRESH_INTERVAL = 30000 // 30 seconds
