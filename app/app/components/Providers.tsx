'use client';

import React from 'react';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

// ── HashKey Chain definitions ──────────────────────────────────────────────
const hashkeyTestnet = {
  id: 133,
  name: 'HashKey Chain Testnet',
  nativeCurrency: { name: 'HashKey Token', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://hashkeychain-testnet.alt.technology'] },
    public:  { http: ['https://hashkeychain-testnet.alt.technology'] },
  },
  blockExplorers: {
    default: { name: 'HashKey Explorer', url: 'https://hashkey-testnet-explorer.alt.technology' },
  },
  testnet: true,
} as const;

const hashkeyMainnet = {
  id: 177,
  name: 'HashKey Chain',
  nativeCurrency: { name: 'HashKey Token', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.hsk.xyz'] },
    public:  { http: ['https://mainnet.hsk.xyz'] },
  },
  blockExplorers: {
    default: { name: 'HashKey Explorer', url: 'https://explorer.hsk.xyz' },
  },
} as const;

// ── Wagmi + RainbowKit config ──────────────────────────────────────────────
// WalletConnect projectId: create a free one at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'YOUR_WALLETCONNECT_PROJECT_ID';

const wagmiConfig = getDefaultConfig({
  appName: 'ZKGate',
  projectId,
  chains: [hashkeyTestnet, hashkeyMainnet] as any,
  ssr: false, // SSR is handled by Web3Providers (next/dynamic ssr:false)
});

const queryClient = new QueryClient();

// ── Provider ───────────────────────────────────────────────────────────────
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor:           '#00f0ff',
            accentColorForeground: '#050510',
            borderRadius:          'large',
            fontStack:             'system',
            overlayBlur:           'small',
          })}
          initialChain={hashkeyMainnet as any}
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
