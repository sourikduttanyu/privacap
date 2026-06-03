import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AdStats } from "../api";

function shortName(id: string): string {
  const s = id
    .replace(/^google_ads_iframe_/i, "")
    .replace(/_?\d+__container__$/i, "")
    .replace(/__container__$/i, "");
  const parts = s.split("/").filter(Boolean);
  const short = parts.length >= 2 ? parts.slice(-2).join("/") : s;
  return short.length > 26 ? "…" + short.slice(-23) : short || id.slice(0, 26);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const served = payload.find((p: any) => p.dataKey === "served")?.value ?? 0;
  const blocked = payload.find((p: any) => p.dataKey === "suppressed")?.value ?? 0;
  const total = served + blocked;
  return (
    <div className="bg-[#16161f] border border-[#2e2e42] rounded-lg px-3 py-2.5 text-xs shadow-xl max-w-60">
      <div className="font-semibold text-[#e2e2e8] mb-1.5 leading-tight break-all">{label}</div>
      <div className="flex gap-3">
        <span className="text-[#4ade80]">✓ {served} shown</span>
        <span className="text-[#f87171]">✗ {blocked} blocked</span>
      </div>
      {total > 0 && (
        <div className="text-[#6b7280] mt-1">{Math.round((blocked / total) * 100)}% of appearances blocked</div>
      )}
    </div>
  );
}

export function TopAdsChart({ data }: { data: AdStats[] }) {
  if (!data.length) return <Empty />;

  const chartData = data.map((d) => ({ ...d, name: shortName(d.campaign_id) }));
  const chartHeight = Math.max(180, chartData.length * 40);

  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 48, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: "#c8c8d8", fontSize: 12 }} width={140} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="served" stackId="a" fill="#4ade80" name="Shown" />
          <Bar dataKey="suppressed" stackId="a" fill="#f87171" name="Blocked" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-5 mt-2 text-xs text-[#9ca3af]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#4ade80] inline-block" />
          Shown to you
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f87171] inline-block" />
          Blocked by Veil
        </span>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <div className="text-[#6b7280] text-base">No ad exposures yet</div>
      <div className="text-sm text-[#4b5563] text-center max-w-xs leading-relaxed">
        Browse with Veil active — this will show exactly which ads tried to reach you and how many were stopped.
      </div>
    </div>
  );
}
