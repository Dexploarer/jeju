/**
 * Formatting Utilities - Re-exports from @jejunetwork/shared
 */

export {
  formatBytes,
  formatBytesBinary,
  formatMs,
  formatDuration,
  formatDurationVerbose,
  formatTimeAgo,
  formatTimestamp,
  formatNumber,
  formatUsd,
  formatPercent,
  formatAddress,
  shortenAddress,
  formatEth,
  formatGas,
  formatGasPrice,
  generateId,
  generatePrefixedId,
  classNames,
  cn,
  delay,
  chunk,
} from '@jejunetwork/shared';

// Legacy aliases for backward compatibility
export const formatUSD = formatUsd;
export const formatETH = formatEth;
