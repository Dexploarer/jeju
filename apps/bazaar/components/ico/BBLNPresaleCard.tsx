'use client'

import { useState, useEffect } from 'react'
import { formatEther, parseEther } from 'viem'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'

type AuctionPhase = 'NOT_STARTED' | 'EARLY_BIRD' | 'PUBLIC_AUCTION' | 'CLEARING' | 'DISTRIBUTION' | 'COMPLETED'

interface AuctionStats {
  totalTokens: bigint
  committed: bigint
  allocated: bigint
  bidders: number
  currentPrice: bigint
  clearingPrice: bigint
  phase: AuctionPhase
}

interface BidInfo {
  ethAmount: bigint
  maxPrice: bigint
  allocation: bigint
  refundAmount: bigint
  isElizaHolder: boolean
  claimed: boolean
  refunded: boolean
}

const BBLN_PRESALE_ABI = [
  {
    name: 'bid',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'maxPrice', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'claimAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getAuctionStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalTokens', type: 'uint256' },
      { name: 'committed', type: 'uint256' },
      { name: 'allocated', type: 'uint256' },
      { name: 'bidders', type: 'uint256' },
      { name: 'currentPrice', type: 'uint256' },
      { name: 'clearing', type: 'uint256' },
      { name: 'phase', type: 'uint8' },
    ],
  },
  {
    name: 'getBid',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bidder', type: 'address' }],
    outputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'maxPrice', type: 'uint256' },
      { name: 'allocation', type: 'uint256' },
      { name: 'refundAmount', type: 'uint256' },
      { name: 'isElizaHolder', type: 'bool' },
      { name: 'claimed', type: 'bool' },
      { name: 'refunded', type: 'bool' },
    ],
  },
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'previewAllocation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'isElizaHolder', type: 'bool' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const PHASES: AuctionPhase[] = ['NOT_STARTED', 'EARLY_BIRD', 'PUBLIC_AUCTION', 'CLEARING', 'DISTRIBUTION', 'COMPLETED']

// BBLN Tokenomics (from packages/token/src/config/tokenomics.ts)
const BBLN_TOKENOMICS = {
  name: 'Babylon',
  symbol: 'BBLN',
  totalSupply: 1_000_000_000n,
  publicSaleTokens: 100_000_000n, // 10% of total
  elizaBonusMultiplier: 150, // 1.5x
}

// Contract addresses - to be updated after deployment
const BBLN_CONTRACTS = {
  sepolia: {
    token: '0x0000000000000000000000000000000000000000',
    presale: '0x0000000000000000000000000000000000000000',
  },
  mainnet: {
    token: '0x0000000000000000000000000000000000000000',
    presale: '0x0000000000000000000000000000000000000000',
  },
}

export function BBLNPresaleCard() {
  const { address, isConnected, chain } = useAccount()
  const [amount, setAmount] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 })
  
  const isMainnet = chain?.id === 1
  const presaleAddress = isMainnet 
    ? BBLN_CONTRACTS.mainnet.presale 
    : BBLN_CONTRACTS.sepolia.presale
  
  const isDeployed = presaleAddress !== '0x0000000000000000000000000000000000000000'
  
  // Read auction stats
  const { data: statsData } = useReadContract({
    address: presaleAddress as `0x${string}`,
    abi: BBLN_PRESALE_ABI,
    functionName: 'getAuctionStats',
    query: {
      enabled: isDeployed,
      refetchInterval: 10000,
    },
  })
  
  const stats: AuctionStats = statsData ? {
    totalTokens: statsData[0],
    committed: statsData[1],
    allocated: statsData[2],
    bidders: Number(statsData[3]),
    currentPrice: statsData[4],
    clearingPrice: statsData[5],
    phase: PHASES[Number(statsData[6])] ?? 'NOT_STARTED',
  } : {
    totalTokens: BBLN_TOKENOMICS.publicSaleTokens * 10n ** 18n,
    committed: 0n,
    allocated: 0n,
    bidders: 0,
    currentPrice: parseEther('0.001'), // Demo price
    clearingPrice: 0n,
    phase: 'PUBLIC_AUCTION', // Demo mode
  }
  
  // Read user's bid
  const { data: bidData } = useReadContract({
    address: presaleAddress as `0x${string}`,
    abi: BBLN_PRESALE_ABI,
    functionName: 'getBid',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    query: {
      enabled: isDeployed && !!address,
      refetchInterval: 10000,
    },
  })
  
  const userBid: BidInfo | null = bidData ? {
    ethAmount: bidData[0],
    maxPrice: bidData[1],
    allocation: bidData[2],
    refundAmount: bidData[3],
    isElizaHolder: bidData[4],
    claimed: bidData[5],
    refunded: bidData[6],
  } : null
  
  // Preview allocation
  const { data: previewData } = useReadContract({
    address: presaleAddress as `0x${string}`,
    abi: BBLN_PRESALE_ABI,
    functionName: 'previewAllocation',
    args: [amount ? parseEther(amount) : 0n, false],
    query: {
      enabled: isDeployed && !!amount && parseFloat(amount) > 0,
    },
  })
  
  // Bid
  const { writeContract: writeBid, data: bidHash, isPending: isBidding } = useWriteContract()
  const { isLoading: isConfirmingBid, isSuccess: bidSuccess } = useWaitForTransactionReceipt({ hash: bidHash })
  
  // Claim
  const { writeContract: writeClaim, data: claimHash, isPending: isClaiming } = useWriteContract()
  const { isLoading: isConfirmingClaim, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })
  
  useEffect(() => {
    if (bidSuccess) {
      toast.success('Bid placed successfully', { description: 'Your bid has been recorded' })
      setAmount('')
      setMaxPrice('')
    }
  }, [bidSuccess])
  
  useEffect(() => {
    if (claimSuccess) {
      toast.success('Claim successful', { description: 'BBLN tokens have been sent to your wallet' })
    }
  }, [claimSuccess])
  
  // Countdown timer
  useEffect(() => {
    const endTime = new Date('2025-01-15T00:00:00Z').getTime() // Demo end date
    
    const timer = setInterval(() => {
      const now = Date.now()
      const diff = Math.max(0, endTime - now)
      
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])
  
  const handleBid = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    
    writeBid({
      address: presaleAddress as `0x${string}`,
      abi: BBLN_PRESALE_ABI,
      functionName: 'bid',
      args: [maxPrice ? parseEther(maxPrice) : 0n],
      value: parseEther(amount),
    })
  }
  
  const handleClaim = () => {
    writeClaim({
      address: presaleAddress as `0x${string}`,
      abi: BBLN_PRESALE_ABI,
      functionName: 'claimAll',
    })
  }
  
  const progressPercent = stats.totalTokens > 0n
    ? Number((stats.allocated * 100n) / stats.totalTokens)
    : 0
  
  const formatPrice = (wei: bigint) => {
    return `${formatEther(wei)} ETH`
  }
  
  const formatTokens = (wei: bigint) => {
    const tokens = Number(wei) / 1e18
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(2)}K`
    return tokens.toFixed(2)
  }
  
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-black to-orange-950/20 p-6 shadow-xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-2xl font-bold text-white">
            B
          </div>
          <div>
            <h2 className="text-xl font-bold text-amber-100">Babylon Token Sale</h2>
            <p className="text-sm text-amber-300/70">CCA Auction • 100M BBLN</p>
          </div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-medium ${
          stats.phase === 'PUBLIC_AUCTION' ? 'bg-green-500/20 text-green-400' :
          stats.phase === 'EARLY_BIRD' ? 'bg-amber-500/20 text-amber-400' :
          stats.phase === 'CLEARING' ? 'bg-blue-500/20 text-blue-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {stats.phase.replace('_', ' ')}
        </div>
      </div>
      
      {/* Countdown */}
      <div className="mb-6 grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Days', value: countdown.days },
          { label: 'Hours', value: countdown.hours },
          { label: 'Mins', value: countdown.mins },
          { label: 'Secs', value: countdown.secs },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-amber-950/30 p-3">
            <div className="text-2xl font-bold text-amber-100">{value}</div>
            <div className="text-xs text-amber-300/50">{label}</div>
          </div>
        ))}
      </div>
      
      {/* Current Price */}
      <div className="mb-6 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-amber-300/70">Current Price</span>
          <span className="text-lg font-bold text-amber-100">{formatPrice(stats.currentPrice)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-amber-300/50">
          <span>Price decreases over time</span>
          <span>~${(Number(formatEther(stats.currentPrice)) * 3000).toFixed(2)} per BBLN</span>
        </div>
      </div>
      
      {/* Stats */}
      <div className="mb-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-amber-300/70">Total Committed</span>
          <span className="font-medium text-amber-100">{formatEther(stats.committed)} ETH</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-amber-300/70">Participants</span>
          <span className="font-medium text-amber-100">{stats.bidders.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-amber-300/70">Tokens Available</span>
          <span className="font-medium text-amber-100">{formatTokens(stats.totalTokens)} BBLN</span>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-amber-300/50">Allocation Progress</span>
            <span className="text-amber-300/50">{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-amber-950/50">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* User's Bid */}
      {userBid && userBid.ethAmount > 0n && (
        <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-950/20 p-4">
          <h3 className="mb-3 text-sm font-medium text-amber-300">Your Bid</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-amber-300/70">Committed</span>
              <span className="text-amber-100">{formatEther(userBid.ethAmount)} ETH</span>
            </div>
            {userBid.allocation > 0n && (
              <div className="flex justify-between">
                <span className="text-amber-300/70">Allocation</span>
                <span className="text-amber-100">{formatTokens(userBid.allocation)} BBLN</span>
              </div>
            )}
            {userBid.isElizaHolder && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                <span>✓</span>
                <span>ELIZA Holder Bonus (1.5x)</span>
              </div>
            )}
          </div>
          
          {/* Claim button */}
          {stats.phase === 'DISTRIBUTION' && !userBid.claimed && userBid.allocation > 0n && (
            <button
              onClick={handleClaim}
              disabled={isClaiming || isConfirmingClaim}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2 font-medium text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
            >
              {isClaiming || isConfirmingClaim ? 'Claiming...' : 'Claim BBLN'}
            </button>
          )}
        </div>
      )}
      
      {/* Bid Form */}
      {(stats.phase === 'EARLY_BIRD' || stats.phase === 'PUBLIC_AUCTION') && (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-amber-300/70">Bid Amount (ETH)</label>
            <input
              type="number"
              step="0.01"
              min="0.1"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-amber-100 placeholder:text-amber-300/30 focus:border-amber-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm text-amber-300/70">
              Max Price (optional, leave empty to accept any price)
            </label>
            <input
              type="number"
              step="0.0001"
              placeholder="0.0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-amber-100 placeholder:text-amber-300/30 focus:border-amber-500 focus:outline-none"
            />
          </div>
          
          {/* Preview */}
          {previewData && previewData > 0n && (
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm">
              <span className="text-amber-300/70">Estimated allocation: </span>
              <span className="font-medium text-amber-100">{formatTokens(previewData)} BBLN</span>
            </div>
          )}
          
          {!isConnected ? (
            <div className="rounded-lg bg-amber-950/30 p-4 text-center text-sm text-amber-300/70">
              Connect wallet to participate
            </div>
          ) : !isDeployed ? (
            <div className="rounded-lg bg-amber-950/30 p-4 text-center text-sm text-amber-300/70">
              Sale not yet deployed - coming soon
            </div>
          ) : (
            <button
              onClick={handleBid}
              disabled={isBidding || isConfirmingBid || !amount}
              className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
            >
              {isBidding || isConfirmingBid ? 'Processing...' : 'Place Bid'}
            </button>
          )}
        </div>
      )}
      
      {/* Info */}
      <div className="mt-6 rounded-lg bg-amber-950/20 p-4 text-xs text-amber-300/50">
        <p className="font-medium text-amber-300/70">About CCA Auction</p>
        <p className="mt-1">
          Continuous Clearing Auction - price starts high and decreases over time. 
          All successful bidders pay the same final clearing price. 
          ELIZA OS holders get 1.5x allocation bonus.
        </p>
      </div>
    </div>
  )
}
