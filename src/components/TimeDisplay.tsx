// This component displays a time at either end of the timeline.
// The time string is surrounded by a rounded rect with a triangle
// "pointer" pointing down to the corresponding timeline end.
// Uses <text> in SVG and getBBox() for layout, which
// avoids manual canvas text-box measuring. Surprisingly complicated.

import type { Component, Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { DeepTime } from '../deep-time.ts'
import styles from './TimeDisplay.module.css'

interface TimeDisplayProps {
  timeSignal: Accessor<DeepTime | undefined>
  position: 'left' | 'right'
  onRightClick?: () => void
}

export const TimeDisplay: Component<TimeDisplayProps> = (props) => {
  const displayText = createMemo(() => {
    const time = props.timeSignal()
    return time ? time.toRelativeString() : 'Loading...'
  })

  const handleClick = () => {
    if (props.position !== 'right') return
    props.onRightClick?.()
  }

  // Width measured from SVG <text> element
  const [textBoxWidth, setTextBoxWidth] = createSignal<number>(80)
  let textRef: SVGTextElement | undefined

  const PADDING = 20 // horizontal padding added to text width
  const HEIGHT = 44

  // Update width reactively when display text changes
  createEffect(() => {
    displayText()
    if (textRef) {
      const bbox = textRef.getBBox()
      setTextBoxWidth(Math.ceil(bbox.width + PADDING))
    }
  })

  // Build seamless path including triangle and rounded corners
  const pathD = createMemo(() => {
    const width = textBoxWidth()
    if (props.position === 'left') {
      return `M 0 6
              L 0 ${HEIGHT}
              L 10 32
              L ${width - 6} 32
              Q ${width} 32 ${width} 26
              L ${width} 6
              Q ${width} 0 ${width - 6} 0
              L 6 0
              Q 0 0 0 6 Z`
    } else {
      return `M 6 0
              L ${width - 10} 0
              Q ${width} 0 ${width} 6
              L ${width} ${HEIGHT}
              L ${width - 10} 32
              L 6 32
              Q 0 32 0 26
              L 0 6
              Q 0 0 6 0 Z`
    }
  })

  return (
    <div
      class={`${styles.timeDisplayContainer} ${styles[props.position]}`}
      title={
        props.position === 'right'
          ? 'Click to reset to current time'
          : undefined
      }
    >
      <svg
        class={styles.timeDisplaySvg}
        viewBox={`0 0 ${textBoxWidth()} ${HEIGHT}`}
        height={HEIGHT}
        style="overflow: visible"
        onClick={handleClick}
      >
        <defs>
          <filter
            id={`shadow-${props.position}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2"
              flood-color="var(--shadow-light)"
              flood-opacity="1"
            />
          </filter>
        </defs>

        <path
          d={pathD()}
          fill="var(--surface)"
          stroke="var(--border-light)"
          stroke-width="1"
          filter={`url(#shadow-${props.position})`}
        />

        <text
          ref={(el) => (textRef = el)}
          x={textBoxWidth() / 2}
          y="18"
          font-family="sans-serif"
          font-size="13"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="currentColor"
        >
          {displayText()}
        </text>
      </svg>
    </div>
  )
}
