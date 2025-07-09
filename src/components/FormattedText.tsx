import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { parseBasicMarkup } from '../utils/markup.ts'

interface FormattedTextProps {
  text: string
  x?: number
  y?: number
  fill?: string
  fontSize?: string
  opacity?: number
  transform?: string
  textAnchor?: 'start' | 'middle' | 'end'
  class?: string
}

export const FormattedText: Component<FormattedTextProps> = (props) => {
  const segments = () => parseBasicMarkup(props.text)

  return (
    <text
      x={props.x ?? 0}
      y={props.y ?? 0}
      text-anchor={props.textAnchor ?? 'start'}
      fill={props.fill}
      font-size={props.fontSize ?? '11px'}
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
