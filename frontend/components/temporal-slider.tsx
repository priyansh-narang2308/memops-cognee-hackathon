import React from "react";
import { Clock } from "lucide-react";

interface TemporalSliderProps {
  minDate: Date;
  maxDate: Date;
  currentDate: Date;
  onChange: (date: Date) => void;
}

export default function TemporalSlider({
  minDate,
  maxDate,
  currentDate,
  onChange,
}: TemporalSliderProps) {
  const minTime = minDate.getTime();
  const maxTime = maxDate.getTime();
  const currentTime = currentDate.getTime();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(new Date(parseInt(e.target.value, 10)));
  };

  const formattedCurrent = currentDate.toLocaleString();

  return (
    <div className="flex items-center gap-4 bg-[#faf9f5] border border-[#e6dfd8] p-3 rounded-lg shadow-sm">
      <Clock className="w-4 h-4 text-[#cc785c]" />
      <div className="flex-1">
        <input
          type="range"
          min={minTime}
          max={maxTime}
          value={currentTime}
          onChange={handleChange}
          className="w-full accent-[#cc785c]"
        />
        <div className="flex justify-between mt-1 text-[10px] font-mono text-[#6c6a64]">
          <span>{minDate.toLocaleDateString()}</span>
          <span className="font-bold text-[#141413]">{formattedCurrent}</span>
          <span>{maxDate.toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
