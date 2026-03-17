'use client';

import React from 'react';
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

// Define HashKey Chain Testnet
const hashkeyTestnet = {
  id: 133,
  name: 'HashKey Chain Testnet',
  nativeCurrency: { name: 'HashKey', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://hashkeychain-testnet.alt.technology'] },
  },
  blockExplorers: {
    default: { name: 'HashKeyExplorer', url: 'https://hashkey-testnet-explorer.alt.technology' },
  },
} as const;



export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  
  // We keep the instances stable
  const [queryClient] = React.useState(() => new QueryClient());
  const [config] = React.useState(() => getDefaultConfig({
    appName: 'ZKGate',
    projectId: 'YOUR_PROJECT_ID',
    chains: [hashkeyTestnet, mainnet],
    transports: {
      [hashkeyTestnet.id]: http(),
      [mainnet.id]: http(),
    },
    ssr: true,
  }));

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; 
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
