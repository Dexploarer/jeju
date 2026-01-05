/**
 * Removes the temporary context directory created per-worker basis.
 *
 * This function mirrors the one found in the Playwright source code:
 * https://github.com/microsoft/playwright/blob/d1d5fc67dc684a5d4b682749e59bba8cc0ad14de/packages/playwright-core/src/utils/processLauncher.ts#L142
 */
export declare function removeTempContextDir(contextDirPath: string): Promise<Error | null>;
//# sourceMappingURL=removeTempContextDir.d.ts.map