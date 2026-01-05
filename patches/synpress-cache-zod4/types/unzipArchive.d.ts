type UnzipArchiveOptions = {
    archivePath: string;
    overwrite?: boolean;
};
type UnzipArchiveResult = {
    outputPath: string;
    unzipSkipped: boolean;
};
export declare function unzipArchive(options: UnzipArchiveOptions): Promise<UnzipArchiveResult>;
export declare function unzipArchivePhantom(options: UnzipArchiveOptions): Promise<{
    outputPath: string;
    unzipSkipped: boolean;
} | {
    outputPath: string;
    unzipSkipped?: never;
}>;
export {};
//# sourceMappingURL=unzipArchive.d.ts.map