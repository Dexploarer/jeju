/**
 * Playwright config for chain preflight smoke tests
 *
 * Fast, non-wallet tests that verify chain infrastructure.
 * Run without Synpress.
 */

import { createAppConfig } from '../shared/playwright.config.base'

export default createAppConfig({
  name: 'smoke',
  port: 0, // No web server needed for chain tests
  testDir: '.',
  timeout: 60000,
  // No webServer - these tests run against existing infrastructure
})
