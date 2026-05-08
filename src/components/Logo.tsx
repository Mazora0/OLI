export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/qlo-face.jpg" alt="Qalvero logo" className="h-11 w-11 rounded-2xl object-cover ring-1 ring-cyan-300/30" />
      {!compact && (
        <div className="leading-tight">
          <div className="text-lg font-black tracking-tight">Qalvero</div>
          <div className="text-[11px] font-bold uppercase tracking-[.22em] text-cyan-300/80">QLO AI Platform</div>
        </div>
      )}
    </div>
  );
}
