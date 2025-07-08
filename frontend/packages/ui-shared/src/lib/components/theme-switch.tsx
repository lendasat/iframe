import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { type FC } from "react";
import { getPreferredTheme, useTheme } from "./theme-provider";

interface ThemeSwitchProps {
  className?: string;
}

/*
A switch which allows you to switch between light and dark mode.
Note, you will have to set `darkMode: 'class'` in `tailwind.config.js` for this to work.
 */
const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={className}
      aria-label="Toggle theme"
    >
      {getPreferredTheme() === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
};

export default ThemeSwitch;
