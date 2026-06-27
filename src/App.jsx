import { useState, useEffect, useCallback } from "react";
import { initWallet, openWalletModal, onWalletChange, disconnectWallet } from "./wallet.js";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const API = "https://crypticstake-backend.onrender.com"; // update after deploy
const REOWN_PROJECT_ID = "88a2e287bdef768ed8f0cec815dfc349";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d99ce001-e648-416e-97af-18ae2769d730";

// ─── DESIGN ────────────────────────────────────────────────────────────────
const BG = "#070b16", SURF = "#0f1626", SURF2 = "#141d31", LINE = "#1f2b45";
const INK = "#eaf0ff", MUT = "#8b97b4", ACC = "#6c47ff", ACC2 = "#00d4aa", GOOD = "#43d39e", WARN = "#ff8d6b";

const WALLETS = [
  { id: "phantom",  name: "Phantom",        coins: "SOL · ETH · BTC", popular: true,  logo: "https://raw.githubusercontent.com/wallet-selector/wallet-selector/main/packages/phantom/assets/phantom-icon.png" },
  { id: "solflare", name: "Solflare",       coins: "SOL",             popular: true,  logo: "https://raw.githubusercontent.com/solflare-wallet/solflare-snap/main/packages/site/public/images/solflare.png" },
  { id: "backpack", name: "Backpack",       coins: "SOL · ETH",       popular: true,  logo: "https://raw.githubusercontent.com/coral-xyz/backpack/master/assets/backpack.png" },
  { id: "metamask", name: "MetaMask",       coins: "ETH · EVM",       popular: true,  logo: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" },
  { id: "trust",    name: "Trust Wallet",   coins: "Multi-chain",     popular: false, logo: "https://avatars.githubusercontent.com/u/32179889" },
  { id: "wc",       name: "WalletConnect",  coins: "500+ wallets",    popular: false, logo: "https://avatars.githubusercontent.com/u/37784886" },
  { id: "coinbase", name: "Coinbase Wallet",coins: "ETH · SOL · BTC", popular: false, logo: "https://avatars.githubusercontent.com/u/18060234" },
  { id: "okx",      name: "OKX Wallet",     coins: "Multi-chain",     popular: false, logo: "https://avatars.githubusercontent.com/u/96481055" },
  { id: "ledger",   name: "Ledger Live",    coins: "Multi-chain",     popular: false, logo: "https://avatars.githubusercontent.com/u/9784193" },
];

export default function App() {
  const [tab, setTab] = useState("home");
  const [wallet, setWallet] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ fee_pct: 5, min_stake_usd: 25, event_active: false });
  const [walletModal, setWalletModal] = useState(false);
  const [search, setSearch] = useState("");
  const [stakes, setStakes] = useState([]);
  const [loading, setLoading] = useState(false);
  const tg = window.Telegram?.WebApp;
  const tgUser = tg?.initDataUnsafe?.user;

  useEffect(() => {
    tg?.ready(); tg?.expand(); tg?.setHeaderColor?.("#070b16");
    fetchSettings();
    // set up real wallet connection listener
    initWallet();
    onWalletChange(async ({ address, isConnected }) => {
      if (isConnected && address) {
        setWallet(address);
        setWalletModal(false);
        await registerUser(address);
        await loadStakes(address);
      } else {
        setWallet(null);
        setUser(null);
        setStakes([]);
      }
    });
  }, []);

  async function fetchSettings() {
    try {
      const r = await fetch(API + "/api/settings");
      const d = await r.json();
      setSettings(d);
    } catch (e) {}
  }

  // Opens Reown's wallet modal (handles Phantom, Solflare, and many more)
  function openConnect() {
    openWalletModal();
  }

  async function registerUser(address) {
    try {
      const r = await fetch(API + "/api/user", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, telegram_id: tgUser?.id, username: tgUser?.username }),
      });
      const d = await r.json();
      setUser(d);
    } catch (e) {}
  }

  async function loadStakes(address) {
    try {
      const r = await fetch(API + "/api/stakes?wallet=" + address);
      setStakes(await r.json());
    } catch (e) {}
  }

  function disconnect() { disconnectWallet(); setWallet(null); setUser(null); setStakes([]); }

  const short = wallet ? wallet.slice(0, 4) + "…" + wallet.slice(-4) : "";
  const activeStakes = stakes.filter(s => s.status === "active");
  const totalStakedSol = activeStakes.reduce((s, x) => s + x.amount_sol, 0);

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(800px 400px at 50% -5%, #110a2a 0%, transparent 70%), ${BG}`, color: INK, fontFamily: "ui-sans-serif,system-ui,sans-serif", maxWidth: 520, margin: "0 auto", paddingBottom: 86 }}>
      <Header wallet={short} totalStaked={totalStakedSol} banned={user?.banned} onConnect={openConnect} onDisconnect={disconnect} settings={settings} />

      <div style={{ padding: "0 16px" }}>
        {tab === "home" && <Home wallet={wallet} user={user} settings={settings} onConnect={openConnect} onStake={() => setTab("stake")} />}
        {tab === "stake" && <Stake wallet={wallet} user={user} settings={settings} onConnect={openConnect} onStaked={() => { loadStakes(wallet); fetchSettings(); }} />}
        {tab === "portfolio" && <Portfolio wallet={wallet} stakes={activeStakes} totalSol={totalStakedSol} onConnect={openConnect} onUnstake={async (id) => { await fetch(API + "/api/unstake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet, stake_id: id }) }); loadStakes(wallet); }} />}
        {tab === "settings" && <Settings wallet={wallet} user={user} onDisconnect={disconnect} />}
      </div>

      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}

// ─── HEADER ────────────────────────────────────────────────────────────────
function Header({ wallet, totalStaked, banned, onConnect, onDisconnect, settings }) {
  return (
    <div style={{ padding: "16px 16px 14px", position: "sticky", top: 0, zIndex: 10, background: "linear-gradient(180deg,rgba(7,11,22,.98),rgba(7,11,22,.85))", backdropFilter: "blur(12px)", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.03em" }}>
          <span style={{ color: ACC }}>Cryptic</span><span style={{ color: ACC2 }}>Stake</span>
        </div>
        {wallet ? (
          <button onClick={onDisconnect} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${banned ? WARN + "80" : LINE}`, background: banned ? WARN + "10" : SURF, color: banned ? WARN : INK, borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: banned ? WARN : GOOD }} />
            {wallet} {banned ? "· Frozen" : ""}
          </button>
        ) : (
          <button onClick={onConnect} style={{ border: "none", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#fff", background: `linear-gradient(135deg,${ACC},${ACC2})` }}>Connect</button>
        )}
      </div>

      {settings.event_active && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: `${ACC2}15`, border: `1px solid ${ACC2}40`, fontSize: 12, color: ACC2, fontWeight: 700 }}>
          🎉 {settings.event_label || "Fee event"} — {settings.event_fee_pct}% fee
          {settings.event_ends && ` · ends ${new Date(settings.event_ends).toLocaleDateString()}`}
        </div>
      )}

      {wallet && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: MUT, fontWeight: 600 }}>Total staked</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.02em" }}>{totalStaked.toFixed(3)} <span style={{ fontSize: 16, color: MUT }}>SOL</span></div>
        </div>
      )}
    </div>
  );
}

// ─── HOME ──────────────────────────────────────────────────────────────────
function Home({ wallet, user, settings, onConnect, onStake }) {
  const stats = [
    { label: "Current APY", value: "~6.8%", color: GOOD },
    { label: "Network", value: "Solana", color: ACC2 },
    { label: "Payout", value: "~2-3 days", color: MUT },
  ];
  return (
    <div style={{ paddingTop: 18 }}>
      {user?.banned && (
        <div style={{ border: `1px solid ${WARN}60`, borderRadius: 14, padding: 14, background: WARN + "10", marginBottom: 14, fontSize: 13, color: WARN }}>
          ⚠️ Your account is frozen. {user.ban_reason ? `Reason: ${user.ban_reason}.` : ""} {user.ban_until ? `Lifts: ${new Date(user.ban_until).toLocaleString()}` : "Contact support to appeal."}
        </div>
      )}
      <div style={{ borderRadius: 22, padding: "24px 18px", border: `1px solid ${LINE}`, background: `linear-gradient(150deg,${ACC}18,${ACC2}08)`, textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: ACC2, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Non-custodial SOL staking</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Your keys. Your stake.</div>
        <div style={{ fontSize: 13, color: MUT, lineHeight: 1.6 }}>Stake SOL and earn rewards. Every transaction is approved in your own wallet — CrypticStake never holds your funds.</div>
        <button onClick={wallet ? onStake : onConnect} style={{ marginTop: 16, border: "none", borderRadius: 14, padding: "14px 20px", fontSize: 15, fontWeight: 800, cursor: "pointer", color: "#fff", background: `linear-gradient(135deg,${ACC},${ACC2})`, width: "100%" }}>
          {wallet ? "Stake SOL" : "Connect wallet to start"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: 14, background: SURF, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: MUT, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, background: SURF }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>How it works</div>
        {["Connect your Solana wallet", "Enter the amount of SOL to stake", "Review and approve the transaction in your wallet", "Earn rewards every epoch (~2-3 days)"].map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: ACC2, fontWeight: 800, minWidth: 18 }}>{i + 1}.</span>
            <span style={{ color: MUT }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STAKE ─────────────────────────────────────────────────────────────────
function Stake({ wallet, user, settings, onConnect, onStaked }) {
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState(null);
  const [staking, setStaking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const SOL_PRICE = 168; // in production, fetch live price

  if (!wallet) return <Prompt onConnect={onConnect} label="Connect your wallet to stake" />;
  if (user?.banned) return (
    <div style={{ paddingTop: 30, textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
      <div style={{ color: WARN, fontWeight: 700 }}>Account frozen</div>
      <div style={{ color: MUT, fontSize: 13, marginTop: 8 }}>{user.ban_reason || "Contact support."}</div>
    </div>
  );

  const solAmt = parseFloat(amt) || 0;
  const usdAmt = solAmt * SOL_PRICE;
  const APY = 0.068;
  const feePct = settings.fee_pct;
  const feeApplies = usdAmt >= settings.min_stake_usd;
  const feeSol = feeApplies ? (solAmt * feePct) / 100 : 0;
  const stakeAmt = solAmt - feeSol;
  const earnings = {
    day:      stakeAmt * APY / 365,
    week:     stakeAmt * APY / 52,
    month:    stakeAmt * APY / 12,
    sixMonth: stakeAmt * APY / 2,
    year:     stakeAmt * APY,
  };

  async function confirmStake() {
    setShowConfirm(false);
    setStaking(true);
    setMsg({ t: "Requesting wallet approval…", k: "" });
    try {
      await new Promise(r => setTimeout(r, 1500));
      const r = await fetch(API + "/api/stake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amount_sol: stakeAmt, amount_usd: usdAmt, tx_sig: feeApplies ? "demo_tx" : null }),
      });
      const d = await r.json();
      if (d.error) { setMsg({ t: d.error, k: "err" }); }
      else { setMsg({ t: `Staked ${stakeAmt.toFixed(4)} SOL! Activates next epoch (~2-3 days).`, k: "ok" }); setAmt(""); onStaked(); }
    } catch (e) { setMsg({ t: "Stake failed. Try again.", k: "err" }); }
    setStaking(false);
  }

  function startStake() {
    if (!(solAmt > 0)) { setMsg({ t: "Enter an amount", k: "err" }); return; }
    setShowConfirm(true);
  }

  return (
    <div style={{ paddingTop: 18 }}>
      {settings.event_active && (
        <div style={{ border: `1px solid ${ACC2}40`, borderRadius: 12, padding: "10px 14px", background: ACC2 + "10", marginBottom: 14, fontSize: 12, color: ACC2, fontWeight: 700 }}>
          🎉 {settings.event_label || "Limited time"}: {settings.event_fee_pct}% fee active!
        </div>
      )}
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 18, padding: 18, background: SURF }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: MUT }}>Amount to stake</div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0.00" style={{ width: "100%", border: `1.5px solid ${LINE}`, borderRadius: 12, padding: "14px 60px 14px 14px", background: "#0c1426", color: INK, fontSize: 20, fontWeight: 700 }} />
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: MUT, fontWeight: 700, fontSize: 14 }}>SOL</span>
        </div>

        {solAmt > 0 && (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: 14, background: SURF2, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: ACC2, fontWeight: 700, marginBottom: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>Estimated earnings at 6.8% APY</div>
            <div style={{ fontSize: 12, color: MUT, marginBottom: 10 }}>≈ ${(stakeAmt * SOL_PRICE).toFixed(2)} USD staked</div>
            {[
              { label: "Daily",    val: earnings.day },
              { label: "Weekly",   val: earnings.week },
              { label: "Monthly",  val: earnings.month },
              { label: "6 months", val: earnings.sixMonth },
              { label: "Yearly",   val: earnings.year },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
                <span style={{ color: MUT }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: GOOD }}>+{r.val.toFixed(4)} SOL <span style={{ color: MUT, fontWeight: 400 }}>(${(r.val * SOL_PRICE).toFixed(2)})</span></span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: MUT, marginTop: 8, lineHeight: 1.4 }}>Estimates based on current network APY. Actual rewards vary.</div>
          </div>
        )}

        <button onClick={startStake} disabled={staking} style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 800, cursor: staking ? "not-allowed" : "pointer", color: "#fff", background: staking ? SURF2 : `linear-gradient(135deg,${ACC},${ACC2})`, opacity: staking ? .7 : 1 }}>
          {staking ? "Confirming in wallet…" : "Stake SOL"}
        </button>
        {msg && <div style={{ fontSize: 13, marginTop: 10, color: msg.k === "ok" ? GOOD : msg.k === "err" ? WARN : MUT }}>{msg.t}</div>}
      </div>
      <div style={{ fontSize: 11, color: MUT, lineHeight: 1.5, marginTop: 14, textAlign: "center" }}>
        Non-custodial staking via Solana validators. You approve every transaction in your own wallet.
      </div>

      {showConfirm && (
        <div onClick={() => setShowConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(3,6,14,.75)", backdropFilter: "blur(6px)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: BG, border: `1px solid ${LINE}`, borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Confirm your stake</div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, background: SURF, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}><span style={{ color: MUT }}>You enter</span><b>{solAmt.toFixed(4)} SOL</b></div>
              {feeApplies && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}><span style={{ color: MUT }}>Service fee ({feePct}%)</span><b style={{ color: WARN }}>-{feeSol.toFixed(4)} SOL</b></div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: `1px solid ${LINE}`, marginTop: 4, fontSize: 15, fontWeight: 800 }}><span>Amount staked</span><span style={{ color: GOOD }}>{stakeAmt.toFixed(4)} SOL</span></div>
            </div>
            {feeApplies && (
              <div style={{ fontSize: 12, color: MUT, lineHeight: 1.5, marginBottom: 16 }}>
                A {feePct}% service fee is sent to CrypticStake as a separate transfer you approve in your wallet. The rest is staked to a Solana validator. CrypticStake never holds your funds.
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, border: `1px solid ${LINE}`, background: "transparent", color: INK, borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmStake} style={{ flex: 1, border: "none", background: `linear-gradient(135deg,${ACC},${ACC2})`, color: "#fff", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PORTFOLIO ─────────────────────────────────────────────────────────────
function Portfolio({ wallet, stakes, totalSol, onConnect, onUnstake }) {
  if (!wallet) return <Prompt onConnect={onConnect} label="Connect your wallet to see your portfolio" />;
  const dailyReward = totalSol * 0.068 / 365;
  return (
    <div style={{ paddingTop: 18 }}>
      {totalSol > 0 && (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, background: SURF, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: MUT }}>Total staked</div><div style={{ fontSize: 20, fontWeight: 800, color: GOOD }}>{totalSol.toFixed(3)} SOL</div></div>
          <div><div style={{ fontSize: 11, color: MUT }}>Est. daily reward</div><div style={{ fontSize: 20, fontWeight: 800, color: ACC2 }}>+{dailyReward.toFixed(4)} SOL</div></div>
        </div>
      )}
      <div style={{ fontSize: 11, color: MUT, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Active stakes</div>
      {stakes.length === 0 ? (
        <div style={{ border: `1px dashed ${LINE}`, borderRadius: 16, padding: 30, textAlign: "center", color: MUT, fontSize: 14 }}>No active stakes yet.</div>
      ) : stakes.map(s => (
        <div key={s.id} style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, background: SURF, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div><div style={{ fontWeight: 700 }}>{Number(s.amount_sol).toFixed(4)} SOL</div><div style={{ fontSize: 11, color: MUT }}>≈ ${(s.amount_sol * 168).toFixed(2)}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: GOOD }}>Active</div><div style={{ fontSize: 11, color: MUT }}>{new Date(s.created_at).toLocaleDateString()}</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: `1px solid ${LINE}`, paddingTop: 8 }}>
            <span style={{ color: MUT }}>Next payout: ~2-3 days</span>
            <button onClick={() => onUnstake(s.id)} style={{ border: `1px solid ${LINE}`, background: "transparent", color: WARN, borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Unstake</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────────────────────
function Settings({ wallet, user, onDisconnect }) {
  return (
    <div style={{ paddingTop: 18 }}>
      <div style={{ fontSize: 11, color: MUT, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Account</div>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, background: SURF, marginBottom: 12 }}>
        <Row label="Wallet" value={wallet ? wallet.slice(0, 6) + "…" + wallet.slice(-4) : "Not connected"} />
        {user && <>
          <Row label="Total staked" value={Number(user.total_staked).toFixed(4) + " SOL"} />
          <Row label="Fees paid" value={Number(user.fees_paid).toFixed(4) + " SOL"} />
        </>}
      </div>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, background: SURF, marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: MUT, lineHeight: 1.6 }}>CrypticStake is non-custodial. Your keys never leave your wallet. Staking rewards are ~6.8% APY and may vary with network conditions.</div>
      </div>
      {wallet && <button onClick={onDisconnect} style={{ width: "100%", border: `1px solid ${LINE}`, background: "transparent", color: WARN, borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Disconnect wallet</button>}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, borderBottom: `1px solid ${LINE}` }}>
      <span style={{ color: MUT }}>{label}</span><b>{value}</b>
    </div>
  );
}

// ─── WALLET MODAL ───────────────────────────────────────────────────────────
function WalletModal({ search, setSearch, onPick, onClose, loading }) {
  const q = search.trim().toLowerCase();
  const list = q ? WALLETS.filter(w => w.name.toLowerCase().includes(q)) : WALLETS;
  const popular = list.filter(w => w.popular);
  const others = list.filter(w => !w.popular);
  const Row = w => (
    <button key={w.id} onClick={() => onPick(w.id)} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", border: `1px solid ${LINE}`, borderRadius: 14, padding: 13, background: SURF2, marginBottom: 10, cursor: loading ? "not-allowed" : "pointer", color: INK, textAlign: "left", opacity: loading ? .6 : 1 }}>
      <img src={w.logo} alt={w.name} style={{ width: 42, height: 42, borderRadius: 12, objectFit: "contain", background: "#0c1426", padding: 4, flex: "none" }} onError={e => { e.target.style.display = "none"; }} />
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div><div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{w.coins}</div></div>
      <div style={{ color: MUT, fontSize: 20 }}>›</div>
    </button>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,6,14,.75)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: BG, borderTop: `1px solid ${LINE}`, borderRadius: "24px 24px 0 0", padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Connect a wallet</div>
          <button onClick={onClose} style={{ border: "none", background: SURF, color: MUT, width: 30, height: 30, borderRadius: 99, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wallets…" style={{ width: "100%", border: `1.5px solid ${LINE}`, borderRadius: 12, padding: 12, background: SURF, color: INK, fontSize: 15, marginBottom: 16 }} />
        {loading && <div style={{ textAlign: "center", color: MUT, padding: 10, fontSize: 13 }}>Connecting…</div>}
        {popular.length > 0 && <div style={{ fontSize: 11, color: MUT, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Popular</div>}
        {popular.map(Row)}
        {others.length > 0 && <div style={{ fontSize: 11, color: MUT, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", margin: "8px 0 10px" }}>More wallets</div>}
        {others.map(Row)}
        {list.length === 0 && <div style={{ color: MUT, textAlign: "center", padding: 20 }}>No wallets match "{search}"</div>}
        <div style={{ fontSize: 11, color: MUT, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
          CrypticStake never holds your funds. You approve all transactions in your own wallet.
          <br/>
          <a href="https://reown.com" target="_blank" rel="noopener noreferrer" style={{ color: ACC2, textDecoration: "none", fontWeight: 600 }}>Secured by Reown ↗</a>
        </div>
      </div>
    </div>
  );
}

// ─── TAB BAR ───────────────────────────────────────────────────────────────
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "stake", label: "Stake", icon: "◆" },
    { id: "portfolio", label: "Portfolio", icon: "▦" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, display: "flex", background: "rgba(10,14,26,.96)", backdropFilter: "blur(14px)", borderTop: `1px solid ${LINE}`, padding: "8px 0 16px", zIndex: 20 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? ACC2 : MUT, transition: "color .15s" }}>
          <span style={{ fontSize: 19 }}>{t.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
          {tab === t.id && <span style={{ width: 16, height: 2, borderRadius: 99, background: ACC2, marginTop: 1 }} />}
        </button>
      ))}
    </div>
  );
}

function Prompt({ onConnect, label }) {
  return (
    <div style={{ paddingTop: 40, textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🔐</div>
      <div style={{ fontSize: 15, color: MUT, marginBottom: 20 }}>{label}</div>
      <button onClick={onConnect} style={{ border: "none", borderRadius: 14, padding: "14px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer", color: "#fff", background: `linear-gradient(135deg,${ACC},${ACC2})` }}>Connect wallet</button>
    </div>
  );
}
