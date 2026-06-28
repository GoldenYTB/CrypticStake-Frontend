// staking.js — real Solana native staking + fee in ONE signed transaction
import {
  Connection, PublicKey, Transaction, SystemProgram,
  StakeProgram, Authorized, Lockup, LAMPORTS_PER_SOL, Keypair,
} from "@solana/web3.js";
import { getWalletProvider, FEE_WALLET } from "./wallet.js";

// ── NETWORK: start on devnet (free/safe). Switch to "mainnet-beta" when tested.
export const NETWORK = "devnet"; // "devnet" | "mainnet-beta"

const RPC = NETWORK === "mainnet-beta"
  ? "https://mainnet.helius-rpc.com/?api-key=d99ce001-e648-416e-97af-18ae2769d730"
  : "https://api.devnet.solana.com";

// Validator vote account to delegate to.
// Replace the mainnet one with your chosen validator when going live.
const VALIDATOR_VOTE = NETWORK === "mainnet-beta"
  ? "REPLACE_WITH_YOUR_MAINNET_VALIDATOR_VOTE_ACCOUNT"
  : "5MMCR4NbTZqjthjLGywmeT66iwE9J9f7kjtxzJjwfUx2"; // example devnet vote account

export function getConnection() {
  return new Connection(RPC, "confirmed");
}

// Native stake + optional fee, combined so the USER SIGNS ONCE.
export async function stakeSol({ ownerAddress, amountSol, feePct }) {
  const provider = getWalletProvider();
  if (!provider) throw new Error("Wallet not connected");

  const connection = getConnection();
  const user = new PublicKey(ownerAddress);

  const feeSol = feePct > 0 ? (amountSol * feePct) / 100 : 0;
  const stakeSolAmount = amountSol - feeSol;
  if (stakeSolAmount <= 0) throw new Error("Amount too small after fee");

  const feeLamports = Math.round(feeSol * LAMPORTS_PER_SOL);
  const stakeLamports = Math.round(stakeSolAmount * LAMPORTS_PER_SOL);

  const stakeAccount = Keypair.generate();
  const tx = new Transaction();

  // 1) fee transfer to owner (if any)
  if (feeLamports > 0) {
    tx.add(SystemProgram.transfer({
      fromPubkey: user,
      toPubkey: new PublicKey(FEE_WALLET),
      lamports: feeLamports,
    }));
  }

  // 2) create stake account
  const rentExempt = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
  tx.add(SystemProgram.createAccount({
    fromPubkey: user,
    newAccountPubkey: stakeAccount.publicKey,
    lamports: stakeLamports + rentExempt,
    space: StakeProgram.space,
    programId: StakeProgram.programId,
  }));

  // 3) initialize (user is authority)
  tx.add(StakeProgram.initialize({
    stakePubkey: stakeAccount.publicKey,
    authorized: new Authorized(user, user),
    lockup: new Lockup(0, 0, user),
  }));

  // 4) delegate to validator
  tx.add(StakeProgram.delegate({
    stakePubkey: stakeAccount.publicKey,
    authorizedPubkey: user,
    votePubkey: new PublicKey(VALIDATOR_VOTE),
  }));

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = user;

  // stake account keypair partially signs (for its own creation)
  tx.partialSign(stakeAccount);

  // user approves everything in ONE wallet popup
  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, "confirmed");

  return {
    signature: sig,
    stakeAccount: stakeAccount.publicKey.toString(),
    staked: stakeSolAmount,
    fee: feeSol,
  };
}
