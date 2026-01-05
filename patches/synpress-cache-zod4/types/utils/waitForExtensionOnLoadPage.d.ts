import { type BrowserContext, type Page } from 'playwright-core';
/**
 * Waits for the extension page to load and ensures it's not blank or has errors
 */
export declare function waitForExtensionOnLoadPage(context: BrowserContext, extensionPath: string): Promise<Page>;
//# sourceMappingURL=waitForExtensionOnLoadPage.d.ts.map