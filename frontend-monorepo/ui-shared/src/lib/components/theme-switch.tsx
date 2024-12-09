import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { type FC, useEffect, useState } from "react";

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
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
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
