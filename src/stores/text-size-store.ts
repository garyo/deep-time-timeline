import { createSignal, createEffect } from 'solid-js'

export type TextSize = 'small' | 'medium' | 'large'

// Font size mappings for event text (in pixels)
export const TEXT_SIZE_MAP: Record<TextSize, number> = {
  small: 11,
  medium: 14,
  large: 18
}

// Convert text size to CSS string
export function getTextSizePx(size: TextSize): string {
  return `${TEXT_SIZE_MAP[size]}px`
}

// Base font size for scale calculations
const BASE_FONT_SIZE = TEXT_SIZE_MAP.small

// Text size persistence in localStorage
const TEXT_SIZE_KEY = 'deep-timeline-text-size'

// Load text size from localStorage on startup
function loadTextSize(): TextSize {
  if (typeof window === 'undefined') return 'small'

  try {
    const saved = localStorage.getItem(TEXT_SIZE_KEY)
    if (saved === 'small' || saved === 'medium' || saved === 'large') {
      return saved
    }
  } catch (error) {
    console.warn('Failed to load text size from localStorage:', error)
  }

  // Default to medium on mobile, small on desktop
  const isMobile = window.innerWidth <= 768
  return isMobile ? 'medium' : 'small'
}

// Initialize text size from localStorage BEFORE creating signal
const initialTextSize = typeof window !== 'undefined' ? loadTextSize() : 'small'

// Create reactive text size signal with loaded value
const [textSize, setTextSize] = createSignal<TextSize>(initialTextSize)

// Derived signal for text size scale factor
export const textSizeScale = () => TEXT_SIZE_MAP[textSize()] / BASE_FONT_SIZE

// Save text size to localStorage
function saveTextSize(newSize: TextSize) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(TEXT_SIZE_KEY, newSize)
  } catch (error) {
    console.warn('Failed to save text size to localStorage:', error)
  }
}

// Create effect to save text size changes
createEffect(() => {
  const currentSize = textSize()
  saveTextSize(currentSize)
})

// Actions
export const textSizeActions = {
  setTextSize
}

// Exports
export { textSize }
