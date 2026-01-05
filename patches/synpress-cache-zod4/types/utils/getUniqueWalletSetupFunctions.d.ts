import type { WalletSetupFunction } from '../defineWalletSetup';
export declare function getUniqueWalletSetupFunctions(walletSetupDirPath: string): Promise<Map<string, {
    fileName: string;
    setupFunction: WalletSetupFunction;
}>>;
//# sourceMappingURL=getUniqueWalletSetupFunctions.d.ts.map