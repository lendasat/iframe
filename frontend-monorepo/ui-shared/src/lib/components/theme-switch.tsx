import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { type FC, useEffect, useState } from "react";
import { getPreferredTheme } from "./theme-provider";

interface ThemeSwitchProps {
  className?: string;
}

/*
A switch which allows you to switch between light and dark mode.
Note, you will have to set `darkMode: 'class'` in `tailwind.config.js` for this to work.
 */
const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const [theme, setTheme] = useState("light");

  // Apply saved theme from localStorage on mount
  useEffect(() => {
    // Order of theme preferences.
    // 1. What the user has selected in the app.
    // 2. Set in the system settings.
    // 3. Default light mode.
    const savedTheme = localStorage.getItem("theme") || getPreferredTheme() || "light";
    setTheme(savedTheme);
    // remove both light and dark classes so that only the saved theme is really used.
    document.documentElement.classList.remove("light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.remove(theme);
    document.documentElement.classList.add(newTheme);
  };

  return (
    <button onClick={toggleTheme} className={className} aria-label="Toggle theme">
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
};

export default ThemeSwitch;
