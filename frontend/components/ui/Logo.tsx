export function Logo({ centered = false }: { centered?: boolean }) {
  return (
    <h1
      className={`brand-serif text-3xl font-black ${centered ? "text-center" : ""}`}
    >
      <span className="text-nusPurple">NUS</span>
      <span className="text-nusOrange">phere</span>
    </h1>
  );
}
