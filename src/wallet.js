// wallet.js — Reown AppKit setup for multi-wallet Solana connect
import { createAppKit } from "@reown/appkit";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { solana } from "@reown/appkit/networks";

// Your Reown project ID (from dashboard.reown.com)
const PROJECT_ID = "88a2e287bdef768ed8f0cec815dfc349";

// RPC endpoint. Using Solana's public RPC for now (safe to expose, rate-limited).
// When you go live, replace with your Helius URL AFTER restricting it to your
// domain in the Helius dashboard (so it can't be abused even though it's public-facing).
export const HELIUS_RPC = "https://api.mainnet-beta.solana.com";

// Your SOL wallet — fees are sent here (public address, safe to expose)
export const FEE_WALLET = "7N7FaLy9hrC1SUC7G8f4X7M7iSq16HRfMkTh7zeZnyqe";

let appkit = null;

export function initWallet() {
  if (appkit) return appkit;

  const solanaAdapter = new SolanaAdapter();

  appkit = createAppKit({
    adapters: [solanaAdapter],
    networks: [solana],
    projectId: PROJECT_ID,
    metadata: {
      name: "CrypticStake",
      description: "Non-custodial Solana staking",
      url: window.location.origin,
      icons: ["https://cryptologos.cc/logos/solana-sol-logo.png"],
    },
    features: { analytics: false, email: false, socials: [] },
  });

  return appkit;
}

// Open the wallet selection modal
export function openWalletModal() {
  if (!appkit) initWallet();
  appkit.open();
}

// Subscribe to connection state; callback gets { address, isConnected }
export function onWalletChange(cb) {
  if (!appkit) initWallet();
  appkit.subscribeAccount((acct) => {
    cb({ address: acct?.address || null, isConnected: !!acct?.isConnected });
  });
}

export function disconnectWallet() {
  if (appkit) appkit.disconnect();
}

// Get the connected wallet provider for signing transactions
export function getWalletProvider() {
  if (!appkit) return null;
  return appkit.getWalletProvider();
}
