import { describe, it, expect } from 'vitest'
import { render } from '@solidjs/testing-library'
import { FormattedText } from '../src/components/FormattedText'
import { textSizeActions } from '../src/stores/text-size-store'

describe('FormattedText', () => {
  describe('with explicit fontSize prop', () => {
    it('should render plain text with numeric fontSize', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Hello world" fontSize={14} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement).toBeTruthy()
      expect(textElement?.getAttribute('font-size')).toBe('14px')
      expect(textElement?.textContent).toBe('Hello world')
    })

    it('should render plain text with string fontSize', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Hello world" fontSize="16px" />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('font-size')).toBe('16px')
    })

    it('should render bold text markup', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Hello **world**" fontSize={12} />
        </svg>
      ))

      const tspans = container.querySelectorAll('tspan')
      expect(tspans).toHaveLength(2)
      expect(tspans[0].textContent).toBe('Hello ')
      expect(tspans[0].getAttribute('font-weight')).toBe('normal')
      expect(tspans[1].textContent).toBe('world')
      expect(tspans[1].getAttribute('font-weight')).toBe('bold')
    })

    it('should render italic text markup', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Hello _world_" fontSize={12} />
        </svg>
      ))

      const tspans = container.querySelectorAll('tspan')
      expect(tspans).toHaveLength(2)
      expect(tspans[1].getAttribute('font-style')).toBe('italic')
    })

    it('should respect position props', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Test" x={100} y={200} fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('x')).toBe('100')
      expect(textElement?.getAttribute('y')).toBe('200')
    })

    it('should respect text-anchor prop', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Test" textAnchor="middle" fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('text-anchor')).toBe('middle')
    })

    it('should apply opacity', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Test" opacity={0.5} fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('opacity')).toBe('0.5')
    })

    it('should apply CSS class', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Test" class="event-text" fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('class')).toBe('event-text')
    })

    it('should apply transform', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Test" transform="rotate(45)" fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('transform')).toBe('rotate(45)')
    })
  })

  describe('with text size store (no fontSize prop)', () => {
    it('should use default small size from store', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Hello" />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('font-size')).toBe('11px')
    })

    it('should react to text size changes', async () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Hello" />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('font-size')).toBe('11px')

      // Change to medium
      textSizeActions.setTextSize('medium')
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(textElement?.getAttribute('font-size')).toBe('14px')

      // Change to large
      textSizeActions.setTextSize('large')
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(textElement?.getAttribute('font-size')).toBe('18px')

      // Reset to small for other tests
      textSizeActions.setTextSize('small')
    })
  })

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="" fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement).toBeTruthy()
      expect(textElement?.textContent).toBe('')
    })

    it('should handle default position (0, 0)', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Test" fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('x')).toBe('0')
      expect(textElement?.getAttribute('y')).toBe('0')
    })

    it('should handle default text-anchor (start)', () => {
      const { container } = render(() => (
        <svg>
          <FormattedText text="Test" fontSize={12} />
        </svg>
      ))

      const textElement = container.querySelector('text')
      expect(textElement?.getAttribute('text-anchor')).toBe('start')
    })
  })
})
