type DownloaderOptions = {
    url: string;
    outputDir: string;
    fileName: string;
    overrideFile?: boolean;
};
type DownloadFileResult = {
    filePath: string;
    downloadSkipped: boolean;
};
export declare function downloadFile(options: DownloaderOptions): Promise<DownloadFileResult>;
export {};
//# sourceMappingURL=downloadFile.d.ts.map