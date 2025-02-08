import { ONE_YEAR } from "@frontend-monorepo/ui-shared";
import { Card, Grid } from "@radix-ui/themes";
import { Text } from "@radix-ui/themes";
import { useState } from "react";
import { IconType } from "react-icons";
import { FaRegCalendar, FaRegClock } from "react-icons/fa6";

type AllowedDurations = "7d" | "1m" | "3m" | "6m" | "12m";

interface Duration {
  value: AllowedDurations;
  label: string;
  sublabel: string;
  days: number;
  icon: IconType;
}

interface DurationSelectorProps {
  onDurationChange: (days: number) => void;
  disabled: boolean;
  selectedDuration: number | undefined;
}

const durations: Duration[] = [
  { value: "7d", label: "7 Days", sublabel: "7 days", days: 7, icon: FaRegClock },
  { value: "1m", label: "1 Month", sublabel: "30 days", days: 30, icon: FaRegCalendar },
  { value: "3m", label: "3 Months", sublabel: "90 days", days: 90, icon: FaRegCalendar },
  { value: "6m", label: "6 Months", sublabel: "180 days", days: 180, icon: FaRegCalendar },
  { value: "12m", label: "12 Months", sublabel: `${ONE_YEAR} days`, days: ONE_YEAR, icon: FaRegCalendar },
] as const;

const SingleDurationSelector: React.FC<DurationSelectorProps> = ({ onDurationChange, disabled, selectedDuration }) => {
  const handleDurationClick = (value: AllowedDurations) => {
    const days = durations.find(d => d.value === value)?.days ?? 0;
    onDurationChange(days);
  };

  const getCardStyle = (value: AllowedDurations): string => {
    const days = durations.find(d => d.value === value)?.days ?? 0;
    if (days === selectedDuration) {
      return "ring-2 ring-purple-400 bg-purple-100 dark:bg-gray-300";
    }
    return "hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-300";
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Grid columns={{ initial: "5" }} gap="4">
        {durations.map(({ value, label, sublabel, icon: Icon }) => (
          <Card
            key={value}
            className={`p-4 transition-all duration-200
            ${disabled ? "" : "cursor-pointer " + getCardStyle(value)} `}
            onClick={disabled
              ? undefined
              : () => handleDurationClick(value)}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <div>
                <Text size={"2"} className="font-text dark:font-text-dark">{sublabel}</Text>
              </div>
            </div>
          </Card>
        ))}
      </Grid>
    </div>
  );
};

export default SingleDurationSelector;
