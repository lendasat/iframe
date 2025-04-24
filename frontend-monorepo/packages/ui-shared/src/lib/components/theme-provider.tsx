import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const getPreferredSystemTheme = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

// Order of theme preferences.
// 1. What the user has selected in the app.
// 2. Set in the system settings.
// 3. Default light mode.
export const getPreferredTheme = () => {
  return localStorage.getItem("theme") || getPreferredSystemTheme() || "light";
};

interface Theme {
  theme: string;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<Theme>({
  theme: "light",
  toggleTheme: () => {
    // noop
  },
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    const savedTheme = getPreferredTheme();
    applyTheme(savedTheme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    // we only store the new theme into the local storage on toggle, as this is an in-app setting.
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const applyTheme = (newTheme: string) => {
    setTheme(newTheme);
    // remove both light and dark classes so that only the saved theme is really used.
    document.documentElement.classList.remove("light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
