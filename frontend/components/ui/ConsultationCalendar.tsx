import { consultationHourRows, weekDays } from "@/data/profile-options";

export function ConsultationCalendar({
  selectedSlots,
  onToggle,
}: {
  selectedSlots: string[];
  onToggle: (slot: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-[#3f4659]">Consultation hours</p>
          <p className="mt-1 text-sm font-medium text-[#737b8f]">
            Click the hourly slots when you are generally open for consultation.
          </p>
        </div>
        <span className="chip bg-white text-nusPurple">
          {selectedSlots.length} selected
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[72px_repeat(7,1fr)] gap-1">
            <div />
            {weekDays.map((day) => (
              <div
                key={day}
                className="rounded-lg bg-[#ede8ff] py-2 text-center text-sm font-black text-nusPurple"
              >
                {day}
              </div>
            ))}
            {consultationHourRows.map((hour) => (
              <div className="contents" key={hour}>
                <div className="py-2 text-sm font-bold text-[#737b8f]">
                  {hour}
                </div>
                {weekDays.map((day) => {
                  const slot = `${day} ${hour}`;
                  const active = selectedSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      aria-label={slot}
                      className={`h-9 rounded-lg border text-xs font-bold transition ${active ? "border-nusPurple bg-nusPurple text-white" : "border-[#d4dae8] bg-white text-[#9aa1b3] hover:border-nusPurple hover:text-nusPurple"}`}
                      onClick={() => onToggle(slot)}
                    >
                      {active ? "Open" : ""}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
