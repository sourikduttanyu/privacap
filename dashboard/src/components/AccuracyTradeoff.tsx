import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const EXPERIMENT_DATA = [
  { epsilon: 0.1, mae: 18.4 },
  { epsilon: 0.5, mae: 11.2 },
  { epsilon: 1.0, mae: 6.8  },
  { epsilon: 2.0, mae: 4.1  },
  { epsilon: 5.0, mae: 2.3  },
];

const PRIVACY_LABELS: Record<number, string> = {
  0.1: "Maximum privacy",
  0.5: "High privacy",
  1.0: "Balanced",
  2.0: "High accuracy",
  5.0: "Maximum accuracy",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const mae = payload[0].value as number;
  const desc = PRIVACY_LABELS[label] || "";
  return (
    <div className="bg-[#16161f] border border-[#2e2e42] rounded-lg px-3 py-2.5 text-xs shadow-xl">
      <div className="font-semibold text-[#e2e2e8] mb-1">ε = {label} — {desc}</div>
      <div className="text-[#f87171]">~{mae}% scramble on ad counts</div>
      <div className="text-[#9ca3af] mt-1 leading-relaxed max-w-44">
        {mae > 10
          ? "Heavy scrambling — advertisers can barely track your patterns."
          : mae > 4
          ? "Moderate scrambling — good balance for most people."
          : "Light scrambling — ad systems get fairly accurate counts."}
      </div>
    </div>
  );
}

function makeDot(sel: number) {
  return (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.epsilon === sel) {
      return <circle key={`dot-${payload.epsilon}`} cx={cx} cy={cy} r={7} fill="#b0b0ff" stroke="#6060ff" strokeWidth={2} />;
    }
    return <circle key={`dot-${payload.epsilon}`} cx={cx} cy={cy} r={3} fill="#7c7cff" strokeWidth={0} />;
  };
}

export function AccuracyTradeoff({ selectedEpsilon }: { selectedEpsilon: number }) {
  const selected = EXPERIMENT_DATA.find(d => d.epsilon === selectedEpsilon);

  return (
    <div>
      <div className="flex justify-between text-xs text-[#6b7280] mb-2 px-1">
        <span>← Max privacy · ads see almost nothing</span>
        <span>More ad visibility · less scrambling →</span>
      </div>
      <ResponsiveContainer width="100%" height={185}>
        <LineChart data={EXPERIMENT_DATA} margin={{ top: 4, right: 16, bottom: 28, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2a" />
          <XAxis
            dataKey="epsilon"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            label={{ value: "Privacy setting (ε)", position: "insideBottom", offset: -12, fill: "#9ca3af", fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            tickFormatter={(v) => `${v}%`}
            label={{ value: "Count error", angle: -90, position: "insideLeft", offset: 14, fill: "#9ca3af", fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={3}
            stroke="#4ade8033"
            strokeDasharray="5 4"
            label={{ value: "3% target", fill: "#4ade8088", fontSize: 10, position: "right" }}
          />
          {selectedEpsilon && (
            <ReferenceLine
              x={selectedEpsilon}
              stroke="#7c7cff55"
              strokeDasharray="4 3"
              label={{ value: "your setting", fill: "#9090dd", fontSize: 9, position: "top" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="mae"
            stroke="#7c7cff"
            strokeWidth={2}
            dot={makeDot(selectedEpsilon)}
            activeDot={{ r: 6, fill: "#a0a0ff" }}
          />
        </LineChart>
      </ResponsiveContainer>
      {selected && (
        <div className="mt-1 text-center text-sm text-[#9ca3af]">
          At ε={selectedEpsilon}: <span className="text-[#e2e2e8]">~{selected.mae}% scramble</span>
          {" · "}{PRIVACY_LABELS[selectedEpsilon]}
        </div>
      )}
      <p className="text-xs text-[#6b7280] text-center mt-1">
        Hover each point · 100k simulated browsing sessions
      </p>
    </div>
  );
}
