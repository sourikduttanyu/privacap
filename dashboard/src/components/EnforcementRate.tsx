export function EnforcementRate({ served, suppressed }: { served: number; suppressed: number }) {
  const total = served + suppressed;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <div className="text-[#6b7280] text-base">No ads blocked yet</div>
        <div className="text-sm text-[#4b5563] text-center max-w-52 leading-relaxed">
          Browse with Veil active — privacap will track how many ads it stopped vs. let through.
        </div>
      </div>
    );
  }

  const blockedPct = Math.round((suppressed / total) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0a160a] border border-[#1a341a] rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-[#4ade80]">{served.toLocaleString()}</div>
          <div className="text-sm text-[#6b7280] mt-1">shown to you</div>
        </div>
        <div className="bg-[#160a0a] border border-[#341a1a] rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-[#f87171]">{suppressed.toLocaleString()}</div>
          <div className="text-sm text-[#6b7280] mt-1">blocked by Veil</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm text-[#9ca3af] mb-1.5">
          <span>Protection rate</span>
          <span className="font-semibold text-[#e2e2e8]">{blockedPct}% blocked</span>
        </div>
        <div className="h-2 bg-[#1e1e2a] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#f87171] rounded-full transition-all duration-700"
            style={{ width: `${blockedPct}%` }}
          />
        </div>
        <div className="text-[10px] text-[#4b5563] mt-1.5 text-center">
          {total.toLocaleString()} total ad decisions · Veil blocked {blockedPct}%
        </div>
      </div>
    </div>
  );
}
