import * as Switch from "@radix-ui/react-switch";
import { type FC, useEffect, useState } from "react";
/*
A switch which allows you to switch between light and dark mode. This is very convenient to test dark mode theme topics.
Note, you will have to update the tailwind.config.js to use darkMode: 'class'.
 */
const ThemeSwitch: FC = () => {
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
    <div className="flex items-center space-x-3">
      <Switch.Root
        className="w-12 h-6 bg-gray-300 bg-white-700 rounded-full relative flex items-center"
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
      >
        <Switch.Thumb
          className={`w-6 h-6 bg-white bg-gray-900 rounded-full transform transition-transform ${
            theme === "dark" ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </Switch.Root>
    </div>
  );
};

export default ThemeSwitch;
