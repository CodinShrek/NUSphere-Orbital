export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  list?: string;
}) {
  return (
    <label className="block text-sm font-bold text-[#3f4659]">
      {label}
      <input
        className="field mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        list={list}
      />
    </label>
  );
}

export function TextAreaInput({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <label className="block text-sm font-bold text-[#3f4659]">
      {label}
      <textarea
        className="field mt-2 resize-y py-3"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function OptionDatalist({
  id,
  options,
}: {
  id: string;
  options: string[];
}) {
  return (
    <datalist id={id}>
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  );
}
