import { createContext, useContext } from "react";
import useLocalStorage from "./hooks/useLocalStorage";

interface ThemeContextType {
  colorMode: string;
  setColorMode: (value: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  colorMode: "light",
  setColorMode: () => {},
});

import { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorMode] = useLocalStorage("color-theme", "light");

  return (
    <ThemeContext.Provider value={{ colorMode, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
