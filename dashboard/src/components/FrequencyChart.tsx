import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Bucket } from "../api";

export function FrequencyChart({ data }: { data: Bucket[] }) {
  if (!data.length) return <Empty label="No impression data yet" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 28, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
        <XAxis
          dataKey="count"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          label={{ value: "Times this ad appeared (scrambled for privacy)", position: "insideBottom", offset: -12, fill: "#9ca3af", fontSize: 11 }}
        />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
        <Tooltip
          contentStyle={{ background: "#16161f", border: "1px solid #2e2e42", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#c8c8d8" }}
          formatter={(v: any) => [`${((v as number) * 100).toFixed(1)}%`, "of all exposures"]}
          labelFormatter={(label) => `Appeared ${label} time${label !== 1 ? "s" : ""}`}
        />
        <Bar dataKey="frequency" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 15}, 65%, 62%)`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ label: _label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <div className="text-[#6b7280] text-sm">No ad exposures tracked yet</div>
      <div className="text-xs text-[#4b5563] text-center max-w-48 leading-relaxed">
        Browse with the extension active and privacap will map how often each ad tried to reach you.
      </div>
    </div>
  );
}
