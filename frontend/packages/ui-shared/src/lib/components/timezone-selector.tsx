import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import { FormEvent, useState } from "react";
import { LuCheck, LuPencil } from "react-icons/lu";

interface TimezoneSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export const TimezoneSelect = ({
  value,
  onValueChange,
}: TimezoneSelectProps) => {
  // @ts-expect-error: My IDE is complaining but it is supported by all major browsers:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf#browser_compatibility
  const timezones: string[] = Intl.supportedValuesOf("timeZone");

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a timezone" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup className="overflow-y-auto max-h-[10rem]">
          {timezones.map((timezone) => (
            <SelectItem value={timezone} key={timezone}>
              {timezone}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

type EditableFieldProps = {
  initialValue?: string;
  onSave: (value: string) => void;
};

export const EditableTimezoneField = ({
  initialValue,
  onSave,
}: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue || "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(value);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {isEditing ? (
        <form
          onSubmit={handleSubmit}
          className="flex items-center justify-between"
        >
          <TimezoneSelect onValueChange={setValue} value={value} />
          <Button type="submit" variant="ghost" size="icon">
            <LuCheck className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <div className={"flex items-center justify-between"}>
          <span className="text-sm font-medium">
            {value || <span className="italic">Not Configured</span>}
          </span>
          <Button
            onClick={() => setIsEditing(true)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <LuPencil className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
