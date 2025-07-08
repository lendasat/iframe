import { Switch } from "@frontend/shadcn";
import { getPreferredTheme, useTheme } from "@frontend/ui-shared";

export const ThemeSwitch = () => {
  const { toggleTheme } = useTheme();

  const checked = getPreferredTheme() === "dark";

  return (
    <div className="flex items-center space-x-2 px-2 py-1">
      <Switch
        className="h-2.5 w-4"
        thumbClassName="h-1.5 w-1.5 ml-0.5 data-[state=checked]:translate-x-[calc(100%)] data-[state=unchecked]:translate-x-0"
        id="dark-mode"
        checked={checked}
        onCheckedChange={toggleTheme}
      />
      <span className="text-sm">Dark mode (beta)</span>
    </div>
  );
};
