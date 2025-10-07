import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('theme-store localStorage persistence', () => {
  let localStorageMock: Record<string, string>

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {}
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key]
      }),
      clear: vi.fn(() => {
        localStorageMock = {}
      }),
      length: 0,
      key: vi.fn(() => null)
    } as Storage

    // Mock matchMedia for system theme detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    // Mock document for theme application
    if (!global.document) {
      global.document = {
        documentElement: {
          classList: {
            add: vi.fn(),
            remove: vi.fn()
          },
          setAttribute: vi.fn()
        }
      } as any
    }
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('should load theme from localStorage on initialization', async () => {
    // Set a value in localStorage before importing
    localStorageMock['deep-timeline-theme'] = 'light'

    // Import the store (this runs initialization code)
    const { theme } = await import('../src/stores/theme-store.ts')

    // Should have loaded 'light' from localStorage
    expect(theme()).toBe('light')
  })

  it('should default to dark when no saved value', async () => {
    // No value in localStorage

    const { theme } = await import('../src/stores/theme-store.ts')

    expect(theme()).toBe('dark')
  })

  it('should save changes to localStorage', async () => {
    const { themeActions } = await import('../src/stores/theme-store.ts')

    themeActions.setTheme('light')

    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'deep-timeline-theme',
      'light'
    )
  })

  it('should load system theme preference', async () => {
    localStorageMock['deep-timeline-theme'] = 'system'

    const { theme } = await import('../src/stores/theme-store.ts')

    expect(theme()).toBe('system')
  })

  it('should cycle through themes correctly', async () => {
    const { nextTheme } = await import('../src/stores/theme-store.ts')

    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('light')).toBe('system')
    expect(nextTheme('system')).toBe('dark')
  })

  it('should toggle through themes in order', async () => {
    const { theme, themeActions } = await import('../src/stores/theme-store.ts')

    // Initial is 'dark'
    expect(theme()).toBe('dark')

    themeActions.toggleTheme()
    expect(theme()).toBe('light')

    themeActions.toggleTheme()
    expect(theme()).toBe('system')

    themeActions.toggleTheme()
    expect(theme()).toBe('dark')
  })
})
