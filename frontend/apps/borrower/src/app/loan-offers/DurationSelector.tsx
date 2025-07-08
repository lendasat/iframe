import { ONE_YEAR } from "@frontend/ui-shared";
import { RadioGroup, RadioGroupItem, Label } from "@frontend/shadcn";
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
  selectedDuration: number | undefined;
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
  selectedDuration,
}) => {
  const handleDurationClick = (value: string) => {
    onDurationChange(parseInt(value));
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <RadioGroup
        value={selectedDuration?.toString()}
        onValueChange={handleDurationClick}
        className="grid grid-cols-5 gap-2"
      >
        {durations.map(({ value, days, sublabel }) => (
          <div key={value.toString()} className="relative">
            <RadioGroupItem
              value={days.toString()}
              id={days.toString()}
              className="peer sr-only"
            />
            <Label
              htmlFor={days.toString()}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-center"
            >
              <span className="text-sm text-foreground shrink-0">
                {sublabel}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default SingleDurationSelector;
