import type { Component } from 'solid-js'
import { theme, themeActions, nextTheme } from '../stores/theme-store.ts'

export const ThemeToggle: Component = () => {
  return (
    <button
      class="theme-toggle"
      onClick={themeActions.toggleTheme}
      title={`Switch to ${nextTheme(theme())} mode`}
      aria-label={`Switch to ${nextTheme(theme())} mode`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        {theme() === 'light' ? (
          // Sun icon for light mode
          <>
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </>
        ) : theme() === 'dark' ? (
          // Moon icon for dark mode
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          // Monitor icon for 'system' mode
          <>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </>
        )}
      </svg>
    </button>
  )
}
