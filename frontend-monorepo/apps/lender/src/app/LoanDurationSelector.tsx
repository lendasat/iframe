import { ONE_YEAR } from "@frontend/ui-shared";
import { useState } from "react";
import { IconType } from "react-icons";
import { FaRegCalendar, FaRegClock } from "react-icons/fa6";
import { cn } from "@frontend/shadcn";
import { Card, CardContent } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";

type AllowedDurations = "7d" | "1m" | "3m" | "6m" | "12m";

interface Duration {
  value: AllowedDurations;
  label: string;
  sublabel: string;
  days: number;
  icon: IconType;
}

interface DurationSelectorProps {
  onRangeChange: (start: number, end: number) => void;
}

const durations: Duration[] = [
  {
    value: "7d",
    label: "7 Days",
    sublabel: "Short term",
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

const DurationSelector = ({ onRangeChange }: DurationSelectorProps) => {
  const [startDuration, setStartDuration] = useState<
    AllowedDurations | undefined
  >("7d");
  const [endDuration, setEndDuration] = useState<AllowedDurations | undefined>(
    "6m",
  );

  const handleDurationClick = (value: AllowedDurations) => {
    const clickedDurationIndex = durations.findIndex((d) => d.value === value);

    if (!startDuration || (startDuration && endDuration)) {
      setStartDuration(value);
      setEndDuration(undefined);

      // Call parent callback with only start duration
      const startDays = durations.find((d) => d.value === value)?.days ?? 0;
      onRangeChange(startDays, startDays);
    } else {
      const startIndex = durations.findIndex((d) => d.value === startDuration);
      if (clickedDurationIndex < startIndex) {
        setStartDuration(value);
        setEndDuration(startDuration);
        const newStartDays =
          durations.find((d) => d.value === value)?.days ?? 0;
        const newEndDays =
          durations.find((d) => d.value === startDuration)?.days ?? 0;
        onRangeChange(newStartDays, newEndDays);
      } else {
        setEndDuration(value);
        const startDays =
          durations.find((d) => d.value === startDuration)?.days ?? 0;
        const endDays = durations.find((d) => d.value === value)?.days ?? 0;
        onRangeChange(startDays, endDays);
      }
    }
  };

  const isInRange = (value: AllowedDurations): boolean => {
    if (!startDuration || !endDuration) return false;
    const currentIndex = durations.findIndex((d) => d.value === value);
    const startIndex = durations.findIndex((d) => d.value === startDuration);
    const endIndex = durations.findIndex((d) => d.value === endDuration);
    return currentIndex >= startIndex && currentIndex <= endIndex;
  };

  const getSelectionStatusText = () => {
    if (!startDuration) {
      return "Select starting duration";
    } else if (!endDuration) {
      return "Now select ending duration";
    } else {
      return `Selected: ${
        durations.find((d) => d.value === startDuration)?.label
      } to ${durations.find((d) => d.value === endDuration)?.label}`;
    }
  };

  return (
    <div className="w-full">
      <p className="mb-4 text-xs text-muted-foreground">
        {getSelectionStatusText()}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {durations.map(({ value, label, sublabel, icon: Icon }) => (
          <Card
            key={value}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:bg-accent/50",
              value === startDuration && "ring-2 ring-primary bg-primary/10",
              value === endDuration && "ring-2 ring-primary bg-primary/10",
              isInRange(value) &&
                value !== startDuration &&
                value !== endDuration &&
                "ring-1 ring-primary/30 bg-primary/5",
            )}
            onClick={() => handleDurationClick(value)}
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-center space-y-2 text-center">
                <Icon
                  className={cn(
                    "h-6 w-6",
                    value === startDuration || value === endDuration
                      ? "text-primary"
                      : isInRange(value)
                        ? "text-primary/60"
                        : "text-muted-foreground/30",
                  )}
                />
                <div>
                  <Label className="font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{sublabel}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DurationSelector;
