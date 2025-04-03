import { ONE_YEAR } from "@frontend/ui-shared";
import { IconType } from "react-icons";
import { FaRegCalendar, FaRegClock } from "react-icons/fa6";
import { RadioGroup, RadioGroupItem } from "@frontend/shadcn";
import React from "react";
import { cn } from "@frontend/shadcn";

export type AllowedDurations = "7d" | "1m" | "3m" | "6m" | "12m";

interface Duration {
  value: AllowedDurations;
  label: string;
  sublabel: string;
  days: number;
  icon: IconType;
}

interface DurationSelectorProps {
  onDurationChange: (days: number) => void;
  disabled?: boolean;
  selectedDuration?: number;
  disabledDurations: AllowedDurations[];
}

const durations: Duration[] = [
  {
    value: "7d",
    label: "7 Days",
    sublabel: "7 days",
    days: 7,
    icon: FaRegClock,
  },
  {
    value: "1m",
    label: "1 Month",
    sublabel: "30 days",
    days: 30,
    icon: FaRegCalendar,
  },
  {
    value: "3m",
    label: "3 Months",
    sublabel: "90 days",
    days: 90,
    icon: FaRegCalendar,
  },
  {
    value: "6m",
    label: "6 Months",
    sublabel: "180 days",
    days: 180,
    icon: FaRegCalendar,
  },
  {
    value: "12m",
    label: "12 Months",
    sublabel: `${ONE_YEAR} days`,
    days: ONE_YEAR,
    icon: FaRegCalendar,
  },
] as const;

const SingleDurationSelector: React.FC<DurationSelectorProps> = ({
  onDurationChange,
  disabled = false,
  selectedDuration,
  disabledDurations,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <RadioGroup
        value={selectedDuration?.toString()}
        onValueChange={(value) => onDurationChange(parseInt(value))}
        disabled={disabled}
        className="grid grid-cols-5 gap-2"
      >
        {durations.map(({ value, label, days, sublabel, icon: Icon }) => {
          const itemDisabled = disabled || disabledDurations.includes(value);
          return (
            <div key={value} className="relative">
              <RadioGroupItem
                value={days.toString()}
                id={`duration-${value}`}
                className="sr-only peer"
                disabled={itemDisabled}
              />
              <label
                htmlFor={`duration-${value}`}
                className={cn(
                  "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-28",
                  itemDisabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <div className="flex flex-col items-center text-center h-full justify-center">
                  <Icon className="mb-2 h-6 w-6" />
                  <div className="text-sm font-medium whitespace-nowrap">
                    {label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {sublabel}
                  </div>
                </div>
              </label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
};

export default SingleDurationSelector;
