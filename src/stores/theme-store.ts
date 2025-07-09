import { createSignal, createEffect } from 'solid-js'

export type Theme = 'dark' | 'light' | 'system'

// Create reactive theme signal
const [theme, setTheme] = createSignal<Theme>('dark')

// Theme persistence in localStorage
const THEME_KEY = 'deep-timeline-theme'

// Apply theme to document root
function applyTheme(newTheme: Theme) {
  if (typeof document === 'undefined') return
  if (typeof window === 'undefined') return

  if (newTheme === 'system') {
    const darkModeQuery = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches
    newTheme = darkModeQuery ? 'dark' : 'light'
    // console.log(`Applying system theme; system prefers dark = ${darkModeQuery}, so using ${newTheme}`)
  }

  const root = document.documentElement
  // Temporarily disable transitions
  root.classList.add('no-theme-transition')
  root.setAttribute('data-theme', newTheme)

  // Also set a class for easier CSS targeting
  root.classList.remove('theme-dark', 'theme-light')
  root.classList.add(`theme-${newTheme}`)

  // Re-enable transitions after a short delay
  requestAnimationFrame(() => {
    // Two frames later to be safe
    requestAnimationFrame(() => {
      root.classList.remove('no-theme-transition')
    })
  })
}

// Return current system theme, dark or light,
// and set up event listener to respond to changes.
function setupSystemTheme() {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')

  darkModeQuery.addEventListener('change', (event) => {
    if (event.matches) {
      // System switched to dark mode
      if (theme() === 'system') applyTheme('dark')
    } else {
      // System switched to light mode
      if (theme() === 'system') applyTheme('light')
    }
  })
}

// Load theme from localStorage on startup
function loadTheme(): Theme {
  if (typeof window === 'undefined') return 'system'

  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error)
  }

  // Default to dark mode
  return 'dark'
}

// Save theme to localStorage
function saveTheme(newTheme: Theme) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(THEME_KEY, newTheme)
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error)
  }
}

// Create effect to apply theme changes
createEffect(() => {
  setupSystemTheme()
  // note: because we default to dark mode, we ignore the current system theme here.
  // If the user explicitly switches to `system` then we use it.
  const currentTheme = theme()
  applyTheme(currentTheme)
  saveTheme(currentTheme)
})

// Initialize theme from localStorage
if (typeof window !== 'undefined') {
  const initialTheme = loadTheme()
  setTheme(initialTheme)
}

export function nextTheme(theme: Theme): Theme {
  if (theme === 'dark') return 'light'
  if (theme === 'light') return 'system'
  return 'dark'
}

// Actions
export const themeActions = {
  setTheme,
  toggleTheme: () => {
    setTheme((current) => {
      return nextTheme(current)
    })
  }
}

// Exports
export { theme }
