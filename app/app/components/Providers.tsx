'use client';

import React from 'react';
import {
  RainbowKitProvider,
  darkTheme,
  connectorsForWallets,
} from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  injectedWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, createConfig, http } from 'wagmi';
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
    default: { http: ['https://hashkeychain-mainnet.alt.technology'] },
    public:  { http: ['https://hashkeychain-mainnet.alt.technology'] },
  },
  blockExplorers: {
    default: { name: 'HashKey Explorer', url: 'https://hashkeychain-mainnet-explorer.alt.technology' },
  },
} as const;

// ── WalletConnect project ID ───────────────────────────────────────────────
// Get a free project ID at: https://cloud.walletconnect.com
// Then add to app/.env.local:  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id_here
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo_zkgate_hackathon';

// ── Wallet connectors ──────────────────────────────────────────────────────
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, injectedWallet, coinbaseWallet],
    },
    {
      groupName: 'More',
      wallets: [walletConnectWallet, rainbowWallet],
    },
  ],
  {
    appName:   'ZKGate',
    projectId: PROJECT_ID,
  }
);

// ── Wagmi config ───────────────────────────────────────────────────────────
const wagmiConfig = createConfig({
  chains: [hashkeyTestnet, hashkeyMainnet],
  connectors,
  transports: {
    [hashkeyTestnet.id]: http('https://hashkeychain-testnet.alt.technology'),
    [hashkeyMainnet.id]: http('https://hashkeychain-mainnet.alt.technology'),
  },
  ssr: true,
});

const queryClient = new QueryClient();

// ── Provider ───────────────────────────────────────────────────────────────
export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  // Avoid hydration mismatch — don't render wallet UI on server
  if (!mounted) return <>{children}</>;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor:          '#00f0ff',
            accentColorForeground: '#050510',
            borderRadius:          'large',
            fontStack:             'system',
            overlayBlur:           'small',
          })}
          initialChain={hashkeyTestnet}
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
