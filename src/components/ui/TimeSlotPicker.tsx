type TimeSlotPickerProps = {
  value: string;
  onChange: (value: string) => void;
  minTime?: string;
  label: string;
};

const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function TimeSlotPicker({ value, onChange, minTime, label }: TimeSlotPickerProps) {
  const filteredSlots = minTime
    ? TIME_SLOTS.filter((slot) => slot > minTime)
    : TIME_SLOTS;

  return (
    <select
      className="timeSlotPicker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      <option value="">{label}</option>
      {filteredSlots.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </select>
  );
}

export default TimeSlotPicker;
