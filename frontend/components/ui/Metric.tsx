export function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/10 px-6 py-4">
      <p className="brand-serif text-3xl font-black">{value}</p>
      <p className="text-sm font-semibold text-white/80">{label}</p>
    </div>
  );
}
