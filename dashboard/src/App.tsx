import { useEffect, useState } from "react";
import { TopAdsChart } from "./components/TopAdsChart";
import { BudgetGauge } from "./components/BudgetGauge";
import { EnforcementRate } from "./components/EnforcementRate";
import { AccuracyTradeoff } from "./components/AccuracyTradeoff";
import {
  fetchDistribution,
  fetchBudgets,
  fetchEnforcementSummary,
  fetchTopAds,
  type Bucket,
  type BudgetRow,
  type AdStats,
} from "./api";

const DEFAULT_CAMPAIGN = import.meta.env.VITE_DEFAULT_CAMPAIGN || "camp_001";
const DEFAULT_COHORT = import.meta.env.VITE_DEFAULT_COHORT || "us-unknown-desktop";
const POLL_MS = 5000;

const EPSILON_OPTIONS: { value: number; label: string; desc: string; recommended?: boolean }[] = [
  { value: 0.1, label: "Max Privacy", desc: "Ads nearly blind" },
  { value: 1.0, label: "Balanced", desc: "Recommended", recommended: true },
  { value: 5.0, label: "Precision", desc: "More accurate" },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Detect", body: "Veil spots ad slots that got past your ad blocker — YouTube, social feeds, news sites" },
  { step: "2", title: "Count", body: "Tracks how many times each ad has tried to reach you. Count stays on your device only." },
  { step: "3", title: "Scramble", body: "Before any data leaves your device, Veil adds mathematical noise — the server sees a blurred number, not your real count" },
  { step: "4", title: "Block", body: "Once an ad crosses your limit, Veil blocks it automatically. Works even when your ad blocker is off." },
];

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="w-4 h-4 rounded-full border border-[#3a3a50] text-[#9ca3af] text-[10px] font-bold leading-none flex items-center justify-center hover:border-[#6060a0] hover:text-[#c0c0e0] transition-colors"
        aria-label="More information"
      >
        i
      </button>
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#16161f] border border-[#2e2e42] rounded-lg px-3 py-2.5 text-xs text-[#c8c8d8] leading-relaxed shadow-xl pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2e2e42]" />
        </div>
      )}
    </span>
  );
}

interface CardProps {
  title: string;
  subtitle: string;
  tooltip: string;
  children: React.ReactNode;
}

function Card({ title, subtitle, tooltip, children }: CardProps) {
  return (
    <div className="bg-[#0e0e14] border border-[#20202e] rounded-xl p-6">
      <div className="mb-5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-[#e8e8f2] tracking-tight">{title}</h2>
          <InfoTooltip text={tooltip} />
        </div>
        <p className="text-sm text-[#9ca3af] mt-1 leading-relaxed">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const [_distribution, setDistribution] = useState<Bucket[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [served, setServed] = useState(0);
  const [suppressed, setSuppressed] = useState(0);
  const [topAds, setTopAds] = useState<AdStats[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [campaign, setCampaign] = useState(DEFAULT_CAMPAIGN);
  const [cohort, setCohort] = useState(DEFAULT_COHORT);
  const [epsilon, setEpsilon] = useState<number>(1.0);
  const [showHow, setShowHow] = useState(false);

  async function poll() {
    try {
      const [dist, budg, enf, ads] = await Promise.allSettled([
        fetchDistribution(campaign),
        fetchBudgets(cohort),
        fetchEnforcementSummary(campaign),
        fetchTopAds(cohort),
      ]);
      if (dist.status === "fulfilled") setDistribution(dist.value);
      if (budg.status === "fulfilled") setBudgets(budg.value as BudgetRow[]);
      if (enf.status === "fulfilled") {
        setServed(enf.value.served);
        setSuppressed(enf.value.suppressed);
      }
      if (ads.status === "fulfilled") setTopAds(ads.value);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {}
  }

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [campaign, cohort]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <header className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Veil</h1>
          <p className="text-sm text-[#9ca3af] mt-0.5">Stop ads from stalking you — without giving up your data</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Epsilon selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Privacy Level</span>
            <div className="flex items-center bg-[#141420] border border-[#2a2a3e] rounded-lg p-0.5 gap-0.5">
              {EPSILON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEpsilon(opt.value)}
                  title={opt.desc}
                  className={`relative px-2.5 py-1 rounded text-xs transition-all ${
                    epsilon === opt.value
                      ? "bg-[#4040a0] text-white font-medium"
                      : "text-[#9ca3af] hover:text-[#c0c0e0]"
                  }`}
                >
                  {opt.label}
                  {opt.recommended && epsilon !== opt.value && (
                    <span className="absolute -top-1.5 -right-1 text-[7px] bg-[#4ade80] text-black rounded-full px-1 leading-tight font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Campaign</span>
            <input
              className="bg-[#141420] border border-[#2a2a3e] text-xs text-[#e0e0f0] px-2.5 py-1.5 rounded-md w-28 focus:outline-none focus:border-[#5050a0]"
              value={campaign}
              onChange={e => setCampaign(e.target.value)}
              placeholder="camp_001"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">User Group</span>
            <input
              className="bg-[#141420] border border-[#2a2a3e] text-xs text-[#e0e0f0] px-2.5 py-1.5 rounded-md w-36 focus:outline-none focus:border-[#5050a0]"
              value={cohort}
              onChange={e => setCohort(e.target.value)}
              placeholder="us-unknown-desktop"
            />
          </label>
          {lastUpdated && (
            <span className="text-[10px] text-[#6b7280] self-end pb-1.5">Live · {lastUpdated}</span>
          )}
        </div>
      </header>

      {/* Hero banner */}
      <div className="mb-4 mt-3 px-4 py-2.5 bg-[#0e0e18] border border-[#22224a] rounded-lg flex items-center justify-between gap-4">
        <p className="text-sm text-[#a0a0c8]">
          <span className="font-semibold text-[#b0b0e0]">Works on top of your ad blocker — or without one.</span>{" "}
          Ad blockers miss YouTube ads, social media, and any site that fights them. Veil runs as a second layer: for every ad that gets through, it enforces a frequency cap using math. Same ad too many times → blocked. Your real counts never leave your device.
        </p>
        <button
          onClick={() => setShowHow(v => !v)}
          className="text-[10px] text-[#7070cc] hover:text-[#a0a0e8] transition-colors whitespace-nowrap border border-[#2a2a4a] rounded px-2 py-1"
        >
          {showHow ? "Hide" : "How it works ↓"}
        </button>
      </div>

      {/* How Veil Works — collapsible */}
      {showHow && (
        <div className="mb-5 grid grid-cols-4 gap-3">
          {HOW_IT_WORKS.map(s => (
            <div key={s.step} className="bg-[#0e0e14] border border-[#20202e] rounded-lg p-3">
              <div className="text-[#7c7cff] font-bold text-xs mb-1 uppercase tracking-wider">Step {s.step}</div>
              <div className="text-[#e8e8f2] text-sm font-semibold mb-1">{s.title}</div>
              <div className="text-[#6b7280] text-xs leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card
          title="Ads that tried to reach you"
          subtitle="Which ads appeared and how many times — and how many Veil stopped. Names are shortened from ad slot IDs."
          tooltip="Each row is a real ad that your browser encountered. Green = how many times it was shown. Red = how many times Veil blocked it because you'd hit your limit. The actual counts are scrambled with noise before leaving your device — so advertisers can't tie this back to you."
        >
          <TopAdsChart data={topAds} />
        </Card>

        <Card
          title="Your privacy shield"
          subtitle="Think of this as your privacy credit. Every data query spends a little. When it's gone, the system locks down to protect you."
          tooltip="This 'privacy budget' (called epsilon) limits how many times your data can be analyzed in a given window. Once it's spent, Veil blocks further queries automatically — even if advertisers want more. It's a hard limit built into the math, not a policy someone can override."
        >
          <BudgetGauge rows={budgets} />
        </Card>

        <Card
          title="Ads blocked vs. shown"
          subtitle="How many ad appearances Veil stopped vs. let through in total. Higher blocked% = stronger protection."
          tooltip="Veil counts every ad decision: 'show' means the ad was under your frequency limit and got through. 'Block' means it crossed your limit and Veil suppressed it. No ad network knows which you are — the blocking happens locally on your device."
        >
          <EnforcementRate served={served} suppressed={suppressed} />
        </Card>

        <Card
          title="Privacy strength vs. ad accuracy"
          subtitle="Your selected level (highlighted) shows the tradeoff: more privacy = more scrambled counts. Less privacy = more precise."
          tooltip="The ε setting controls how much noise is added. Far left (ε=0.1) = maximum scrambling, ads are nearly blind to your patterns but may miscount by ~18%. Far right (ε=5.0) = near-accurate counts but more of your signal gets through. Change your level above."
        >
          <AccuracyTradeoff selectedEpsilon={epsilon} />
        </Card>
      </div>

      <footer className="mt-6 flex items-center justify-between text-xs text-[#6b7280]">
        <span>Your real ad data never leaves your device. Ever.</span>
        <a
          href="https://github.com/sourikduttanyu/privacap"
          className="hover:text-[#9ca3af] transition-colors"
          target="_blank"
          rel="noreferrer"
        >
          github.com/sourikduttanyu/veil · GPL v3
        </a>
      </footer>
    </div>
  );
}
