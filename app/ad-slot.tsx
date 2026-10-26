type AdSlotProps = {
  format?: "banner" | "rectangle";
  className?: string;
};

// Reserves the final ad dimensions so an ad provider cannot shift page content.
export function AdSlot({ format = "banner", className = "" }: AdSlotProps) {
  const height = format === "rectangle" ? "h-[250px]" : "h-[90px]";
  return (
    <aside
      aria-label="Reklam sahəsi"
      data-ad-slot={format}
      className={`flex ${height} w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 ${className}`}
    >
      Reklam sahəsi
    </aside>
  );
}
