import feeds from './feeds.json';
import staking from './staking.json';
import vrf from './vrf.json';
import automation from './automation.json';
import nodes from './nodes.json';

export { feeds, staking, vrf, automation, nodes };

export interface ChainlinkFeed {
  pair: string;
  address: string;
  decimals: number;
  heartbeatSeconds: number;
}

export interface VRFConfig {
  coordinator: string;
  keyHash: string;
  callbackGasLimit: number;
  requestConfirmations: number;
  linkPremiumPpm: number;
}

export interface AutomationConfig {
  registry: string;
  minBalance: string;
  defaultGasLimit: number;
  keeperRewardBps: number;
}

export function getChainlinkFeeds(chainId: number): ChainlinkFeed[] {
  const chainFeeds = feeds.chains[chainId.toString() as keyof typeof feeds.chains];
  if (!chainFeeds) return [];
  return Object.entries(chainFeeds).map(([pair, config]) => ({
    pair,
    ...(config as Omit<ChainlinkFeed, 'pair'>),
  }));
}

export function getVRFConfig(chainId: number): VRFConfig | undefined {
  return vrf.chains[chainId.toString() as keyof typeof vrf.chains];
}

export function getAutomationConfig(chainId: number): AutomationConfig | undefined {
  return automation.chains[chainId.toString() as keyof typeof automation.chains];
}

export function getLinkTokenAddress(chainId: number): string | undefined {
  return feeds.linkToken[chainId.toString() as keyof typeof feeds.linkToken];
}
