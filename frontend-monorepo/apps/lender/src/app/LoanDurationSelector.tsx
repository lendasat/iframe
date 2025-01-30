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
  onRangeChange: (start: number, end: number) => void;
}

const durations: Duration[] = [
  { value: "7d", label: "7 Days", sublabel: "Short term", days: 7, icon: FaRegClock },
  { value: "1m", label: "1 Month", sublabel: "30 days", days: 30, icon: FaRegCalendar },
  { value: "3m", label: "3 Months", sublabel: "90 days", days: 90, icon: FaRegCalendar },
  { value: "6m", label: "6 Months", sublabel: "180 days", days: 180, icon: FaRegCalendar },
  { value: "12m", label: "12 Months", sublabel: `${ONE_YEAR} days`, days: ONE_YEAR, icon: FaRegCalendar },
] as const;

const DurationSelector: React.FC<DurationSelectorProps> = ({ onRangeChange }) => {
  const [startDuration, setStartDuration] = useState<AllowedDurations | undefined>("7d");
  const [endDuration, setEndDuration] = useState<AllowedDurations | undefined>("6m");

  const handleDurationClick = (value: AllowedDurations) => {
    const clickedDurationIndex = durations.findIndex(d => d.value === value);

    if (!startDuration || (startDuration && endDuration)) {
      setStartDuration(value);
      setEndDuration(undefined);

      // Call parent callback with only start duration
      const startDays = durations.find(d => d.value === value)?.days ?? 0;
      onRangeChange(startDays, startDays);
    } else {
      const startIndex = durations.findIndex(d => d.value === startDuration);
      if (clickedDurationIndex < startIndex) {
        setStartDuration(value);
        setEndDuration(startDuration);
        const newStartDays = durations.find(d => d.value === value)?.days ?? 0;
        const newEndDays = durations.find(d => d.value === startDuration)?.days ?? 0;
        onRangeChange(newStartDays, newEndDays);
      } else {
        setEndDuration(value);
        const startDays = durations.find(d => d.value === startDuration)?.days ?? 0;
        const endDays = durations.find(d => d.value === value)?.days ?? 0;
        onRangeChange(startDays, endDays);
      }
    }
  };

  const isInRange = (value: AllowedDurations): boolean => {
    if (!startDuration || !endDuration) return false;
    const currentIndex = durations.findIndex(d => d.value === value);
    const startIndex = durations.findIndex(d => d.value === startDuration);
    const endIndex = durations.findIndex(d => d.value === endDuration);
    return currentIndex >= startIndex && currentIndex <= endIndex;
  };

  const getCardStyle = (value: AllowedDurations): string => {
    if (value === startDuration) {
      return "ring-2 ring-purple-400 bg-purple-100 dark:bg-bg-gray-700";
    }
    if (value === endDuration) {
      return "ring-2 ring-purple-400 bg-purple-100 dark:bg-bg-gray-900";
    }
    if (isInRange(value)) {
      return "ring-1 ring-purple-300 bg-purple-50 dark:bg-gray-400";
    }
    return "hover:bg-gray-50 dark:bg-gray-600";
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Text size="1" color="gray" mb="4">
        {!startDuration
          ? (
            "Select starting duration"
          )
          : !endDuration
          ? (
            "Now select ending duration"
          )
          : (
            `Selected: ${durations.find(d => d.value === startDuration)?.label} to ${
              durations.find(d => d.value === endDuration)?.label
            }`
          )}
      </Text>
      <Grid columns={{ initial: "1", sm: "2", lg: "5" }} gap="4">
        {durations.map(({ value, label, sublabel, icon: Icon }) => (
          <Card
            key={value}
            className={`p-4 cursor-pointer transition-all duration-200 ${getCardStyle(value)}`}
            onClick={() => handleDurationClick(value)}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <Icon
                className={`w-6 h-6 ${
                  value === startDuration || value === endDuration
                    ? "text-blue-400"
                    : isInRange(value)
                    ? "text-blue-300"
                    : "text-gray-200"
                }`}
              />
              <div>
                <div className="font-medium">{label}</div>
                <div className="text-sm text-gray-500">{sublabel}</div>
              </div>
            </div>
          </Card>
        ))}
      </Grid>
    </div>
  );
};

export default DurationSelector;
