import { passwordRequirementLabels } from "@/data/profile-options";

export function PasswordChecklist({
  requirements,
}: {
  requirements: Record<keyof typeof passwordRequirementLabels, boolean>;
}) {
  return (
    <div className="rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-4">
      <p className="text-sm font-black uppercase text-[#9aa1b3]">
        Password requirements
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(
          Object.keys(passwordRequirementLabels) as Array<
            keyof typeof passwordRequirementLabels
          >
        ).map((key) => {
          const met = requirements[key];
          return (
            <div
              key={key}
              className={`flex items-center gap-2 text-sm font-bold ${met ? "text-[#087443]" : "text-[#c02b18]"}`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-xs ${met ? "bg-[#dcfce7]" : "bg-[#fff1f0]"}`}
              >
                {met ? "✓" : "!"}
              </span>
              {passwordRequirementLabels[key]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
