import type { AxiosProgressEvent } from 'axios';
export declare function onDownloadProgress(url: string, fileName: string): ({ loaded: downloadedBytes, total: totalDownloadBytes }: AxiosProgressEvent) => void;
//# sourceMappingURL=onDownloadProgress.d.ts.map