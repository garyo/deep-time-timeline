import type { Component } from 'solid-js'
import { createMemo, For } from 'solid-js'
import { LogTimeline, DeepTime } from '../log-timeline.ts'
import { timelineState } from '../stores/global-timeline.ts'

interface Tick {
  t: DeepTime
  pos: number
  label: string
}

interface TimelineTicksProps {
  timeline: LogTimeline
}

export const TimelineTicks: Component<TimelineTicksProps> = (props) => {
  const ticks = createMemo((): Tick[] => {
    // Force reactivity by accessing timelineState
    const _ = timelineState.width
    return props.timeline.generateLogTicks(50) as Tick[]
  })

  return (
    <g class="ticks-container">
      <For each={ticks()}>
        {(tick) => (
          <g class="tick-group" transform={`translate(${tick.pos}, 0)`}>
            <line class="tick-line" y1="-10" y2="10" stroke-width="1" />
            <text
              class="tick-text"
              y="15"
              text-anchor="start"
              font-size="12px"
              transform="rotate(25)"
              style={{ 'pointer-events': 'none' }}
            >
              {tick.label}
            </text>
          </g>
        )}
      </For>
    </g>
  )
}
