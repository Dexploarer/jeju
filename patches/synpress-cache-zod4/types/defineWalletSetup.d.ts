import type { BrowserContext, Page } from 'playwright-core';
export type WalletSetupFunction = (context: BrowserContext, walletPage: Page) => Promise<void>;
/**
 * This function is used to define how a wallet should be set up.
 * Based on the contents of this function, a browser with the wallet extension is set up and cached so that it can be used by the tests later.
 *
 * @param walletPassword - The password of the wallet.
 * @param fn - A function describing the setup of the wallet.
 *
 * @returns An object containing the hash of the function, the function itself, and the wallet password. The `testWithWalletSetup` function uses this object.
 */
export declare function defineWalletSetup(walletPassword: string, fn: WalletSetupFunction): {
    hash: string;
    fn: WalletSetupFunction;
    walletPassword: string;
};
//# sourceMappingURL=defineWalletSetup.d.ts.map