import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  applyThemeMode,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  ThemeMode
} from '../utils/theme'

interface ThemeContextType {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(readStoredTheme()))

  const setTheme = useCallback((mode: ThemeMode) => {
    storeTheme(mode)
    setThemeState(mode)
    setResolvedTheme(applyThemeMode(mode))
  }, [])

  useEffect(() => {
    setResolvedTheme(applyThemeMode(theme))
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setResolvedTheme(applyThemeMode('system'))
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
