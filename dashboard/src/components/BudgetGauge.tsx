import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { BudgetRow } from "../api";

export function BudgetGauge({ rows }: { rows: BudgetRow[] }) {
  if (!rows.length) return <Empty />;

  const total = rows.reduce((s, r) => s + r.max_budget, 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const pct = total > 0 ? Math.round((1 - spent / total) * 100) : 100;
  const color = pct > 40 ? "#4ade80" : pct > 15 ? "#fbbf24" : "#f87171";
  const data = [{ name: "Remaining", value: pct, fill: color }];

  const statusText =
    pct > 40
      ? "Shield strong — your data is well protected."
      : pct > 15
      ? "Shield weakening — protection will tighten soon."
      : "Shield critical — most data requests are now blocked to protect you.";

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={data}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: "#1e1e2a" }} dataKey="value" angleAxisId={0} />
          <Tooltip
            contentStyle={{ background: "#16161f", border: "1px solid #2e2e42", borderRadius: 8, fontSize: 12 }}
            formatter={(v: any) => [`${v}%`, "Budget remaining"]}
            labelFormatter={() => ""}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-3xl font-bold -mt-8" style={{ color }}>{pct}%</div>
      <div className="text-sm text-[#9ca3af] mt-1 tracking-wide">privacy shield remaining</div>
      <div className="text-sm text-[#6b7280] mt-2 text-center max-w-48 leading-relaxed">{statusText}</div>
      <div className="text-xs text-[#4b5563] mt-2">{rows.length} group{rows.length !== 1 ? "s" : ""} protected</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <div className="text-[#6b7280] text-base">Shield not activated yet</div>
      <div className="text-sm text-[#4b5563] text-center max-w-52 leading-relaxed">
        Once you browse, this shows how much of your daily privacy protection has been used. Resets every 24 hours.
      </div>
    </div>
  );
}
