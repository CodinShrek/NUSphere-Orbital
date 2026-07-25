export function Avatar({
  initials,
  large = false,
  src,
}: {
  initials: string;
  large?: boolean;
  src?: string;
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#e5eaff] font-black text-nusPurple ${large ? "h-20 w-20 border-2 border-white/25 text-2xl" : "h-16 w-16 text-2xl"}`}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}
