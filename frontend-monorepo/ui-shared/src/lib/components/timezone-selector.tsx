import { Box, Button, Flex, Select } from "@radix-ui/themes";
import { FormEvent, useState } from "react";
import { LuCheck, LuPencil } from "react-icons/lu";

interface TimezoneSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export const TimezoneSelect = ({ value, onValueChange }: TimezoneSelectProps) => {
  // @ts-expect-error: My IDE is complaining but it is supported by all major browsers:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf#browser_compatibility
  const timezones: string[] = Intl.supportedValuesOf("timeZone");

  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger placeholder="Pick a timezone" />
      <Select.Content>
        <Select.Group>
          {timezones.map((timezone) => (
            <Select.Item key={timezone} value={timezone}>
              {timezone}
            </Select.Item>
          ))}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  );
};

type EditableFieldProps = {
  initialValue?: string;
  onSave: (value: string) => void;
};

export const EditableTimezoneField = ({ initialValue, onSave }: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue || "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(value);
    setIsEditing(false);
  };

  return (
    <Box className="w-full">
      <Flex className="flex flex-col gap-1">
        <Flex className="flex items-center justify-between">
          {isEditing
            ? (
              <form onSubmit={handleSubmit} className="flex items-center w-full">
                <TimezoneSelect onValueChange={setValue} value={value} />
                <Button
                  type="submit"
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 bg-transparent"
                >
                  <LuCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                </Button>
              </form>
            )
            : (
              <>
                <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {value || <i>Not Configured</i>}
                </span>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 bg-transparent"
                >
                  <LuPencil className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </Button>
              </>
            )}
        </Flex>
      </Flex>
    </Box>
  );
};
