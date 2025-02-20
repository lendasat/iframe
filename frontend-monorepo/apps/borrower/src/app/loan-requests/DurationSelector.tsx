import { ONE_YEAR } from "@lendasat/ui-shared";
import { RadioCards, Text } from "@radix-ui/themes";
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
  disabled,
  selectedDuration,
}) => {
  const handleDurationClick = (value: number) => {
    onDurationChange(value);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <RadioCards.Root
        value={selectedDuration?.toString()}
        columns={{ initial: "5" }}
        onValueChange={(e) => {
          handleDurationClick(parseInt(e));
        }}
        color={"purple"}
      >
        {durations.map(({ value, label, days, sublabel, icon: Icon }) => (
          <RadioCards.Item value={days.toString()}>
            <div className="flex flex-col items-center text-center space-y-2">
              <div>
                <Text
                  size={"2"}
                  className="text-font dark:text-font-dark shrink-0"
                >
                  {sublabel}
                </Text>
              </div>
            </div>
          </RadioCards.Item>
        ))}
      </RadioCards.Root>
    </div>
  );
};

export default SingleDurationSelector;
