import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('text-size-store localStorage persistence', () => {
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
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('should load text size from localStorage on initialization', async () => {
    // Set a value in localStorage before importing
    localStorageMock['deep-timeline-text-size'] = 'large'

    // Import the store (this runs initialization code)
    const { textSize } = await import('../src/stores/text-size-store.ts')

    // Should have loaded 'large' from localStorage
    expect(textSize()).toBe('large')
  })

  it('should default to medium on mobile when no saved value', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 400
    })

    const { textSize } = await import('../src/stores/text-size-store.ts')

    expect(textSize()).toBe('medium')
  })

  it('should default to small on desktop when no saved value', async () => {
    // Mock desktop viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    })

    const { textSize } = await import('../src/stores/text-size-store.ts')

    expect(textSize()).toBe('small')
  })

  it('should save changes to localStorage', async () => {
    const { textSizeActions } = await import('../src/stores/text-size-store.ts')

    textSizeActions.setTextSize('medium')

    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'deep-timeline-text-size',
      'medium'
    )
  })
})
