export default function Logo(){
  return (
    <div className="flex items-center gap-2">
      <img
        src="/qalvero-mark.png"
        alt="Qalvero"
        className="h-10 w-10 rounded-xl object-contain shadow-[0_0_28px_rgba(34,211,238,.28)]"
      />
      <div className="leading-tight">
        <p className="font-bold tracking-tight">Qalvero</p>
        <p className="text-[11px] text-slate-400">QLO 1.2</p>
      </div>
    </div>
  );
}
