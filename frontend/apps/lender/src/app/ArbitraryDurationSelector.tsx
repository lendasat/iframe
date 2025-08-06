import { ONE_YEAR } from "@frontend/ui-shared";
import { useState } from "react";
import { Input } from "@frontend/shadcn";
import { MdOutlineSwapCalls } from "react-icons/md";

interface ArbitraryDurationSelectorProps {
  onRangeChange: (start: number, end: number) => void;
  initialMin?: number;
  initialMax?: number;
}

const ArbitraryDurationSelector = ({
  onRangeChange,
  initialMin = 7,
  initialMax = 180,
}: ArbitraryDurationSelectorProps) => {
  const [minDays, setMinDays] = useState<number>(initialMin);
  const [maxDays, setMaxDays] = useState<number>(initialMax);

  // Only call onRangeChange when the user actually changes values, not on mount
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === "") {
      setMinDays(0);
      onRangeChange(0, maxDays);
    } else {
      const value = Number(inputValue);
      if (!Number.isNaN(value) && value >= 0) {
        setMinDays(value);
        onRangeChange(value, maxDays);
      }
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === "") {
      setMaxDays(0);
      onRangeChange(minDays, 0);
    } else {
      const value = Number(inputValue);
      if (!Number.isNaN(value) && value >= 0) {
        setMaxDays(value);
        onRangeChange(minDays, value);
      }
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <Input
          type="number"
          placeholder="Min Days"
          min={7}
          max={4 * ONE_YEAR}
          value={minDays === 0 ? "" : minDays}
          onChange={handleMinChange}
          className="flex-1"
        />
        <MdOutlineSwapCalls className="text-muted-foreground" />
        <Input
          type="number"
          placeholder="Max Days"
          min={7}
          max={4 * ONE_YEAR}
          value={maxDays === 0 ? "" : maxDays}
          onChange={handleMaxChange}
          className="flex-1"
        />
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Minimum duration: 7 days • Maximum duration: 4 years ({4 * ONE_YEAR}{" "}
        days) • 1 Month = 30 days
      </p>
    </div>
  );
};

export default ArbitraryDurationSelector;
