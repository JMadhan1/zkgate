'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Prevent wagmi/RainbowKit from ever running on the server.
// localStorage, indexedDB, etc. don't exist in Node — this is the only
// reliable fix when connector packages access them at init time.
const Providers = dynamic(
  () => import('./Providers').then((m) => ({ default: m.Providers })),
  { ssr: false, loading: () => null }
);

export function Web3Providers({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
