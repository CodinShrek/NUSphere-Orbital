export function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toggleSlot(current: string[], slot: string) {
  return current.includes(slot)
    ? current.filter((item) => item !== slot)
    : [...current, slot].sort();
}

export function formatConsultationSlots(slots: string[]) {
  return slots.length ? slots.join(", ") : "By appointment";
}
