import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { parseBasicMarkup } from '../utils/markup.ts'
import { getTextSizePx, textSize } from '../stores/text-size-store.ts'

interface FormattedTextProps {
  text: string
  x?: number
  y?: number
  fill?: string
  /** Font size as number (px) or CSS string. If not provided, uses reactive text size store. */
  fontSize?: number | string
  opacity?: number
  transform?: string
  textAnchor?: 'start' | 'middle' | 'end'
  class?: string
}

export const FormattedText: Component<FormattedTextProps> = (props) => {
  const segments = () => parseBasicMarkup(props.text)

  // Compute font size: use prop if provided (for testing/isolation), otherwise use store
  const computedFontSize = () => {
    if (props.fontSize !== undefined) {
      return typeof props.fontSize === 'number'
        ? `${props.fontSize}px`
        : props.fontSize
    }
    return getTextSizePx(textSize())
  }

  return (
    <text
      x={props.x ?? 0}
      y={props.y ?? 0}
      text-anchor={props.textAnchor ?? 'start'}
      fill={props.fill}
      font-size={computedFontSize()}
      transform={props.transform}
      opacity={props.opacity}
      class={props.class}
    >
      <For each={segments()}>
        {(segment) => (
          <tspan
            font-weight={segment.bold ? 'bold' : 'normal'}
            font-style={segment.italic ? 'italic' : 'normal'}
          >
            {segment.text}
          </tspan>
        )}
      </For>
    </text>
  )
}
