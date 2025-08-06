import { ONE_YEAR } from "@frontend/ui-shared";
import { useState } from "react";
import { Input } from "@frontend/shadcn";

interface SimpleDurationInputProps {
  onDurationChange: (days: number) => void;
  selectedDuration?: number;
}

const SimpleDurationInput = ({
  onDurationChange,
  selectedDuration,
}: SimpleDurationInputProps) => {
  const [durationDays, setDurationDays] = useState<number>(
    selectedDuration || 0,
  );

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === "") {
      setDurationDays(0);
      onDurationChange(0);
    } else {
      const value = Number(inputValue);
      if (!Number.isNaN(value) && value >= 0) {
        setDurationDays(value);
        onDurationChange(value);
      }
    }
  };

  return (
    <div className="w-full">
      <Input
        type="number"
        placeholder="Days"
        min={7}
        max={4 * ONE_YEAR}
        value={durationDays === 0 ? "" : durationDays}
        onChange={handleDurationChange}
        className="w-full"
      />
      <p className="text-muted-foreground mt-1 text-xs">
        Minimum: 7 days • Maximum: 4 years ({4 * ONE_YEAR} days) • 1 Month = 30
        days
      </p>
    </div>
  );
};

export default SimpleDurationInput;
