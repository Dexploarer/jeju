import type { WalletSetupFunction } from '../defineWalletSetup';
export declare function triggerCacheCreation(setupFunctions: Map<string, {
    fileName: string;
    setupFunction: WalletSetupFunction;
}>, hashes: string[], downloadExtension: () => Promise<string>, force: boolean): Promise<void[]>;
//# sourceMappingURL=triggerCacheCreation.d.ts.map