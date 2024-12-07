import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

const getPreferredTheme = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const ThemeContext = createContext({
  theme: "light",
  setTheme: (theme: string) => {
    // No-op function
  },
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<string>(getPreferredTheme);

  useEffect(() => {
    document.documentElement.classList.add(theme);
    return () => document.documentElement.classList.remove(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
