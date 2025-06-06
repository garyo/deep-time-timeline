import type { Component } from 'solid-js'
import { LogTimeline } from '../log-timeline.ts'
import { timelineState } from '../stores/global-timeline.ts'

interface TimelineAxisProps {
  timeline: LogTimeline
}

export const TimelineAxis: Component<TimelineAxisProps> = (props) => {
  return (
    <g class="axis-group">
      <line
        class="main-axis-line"
        x1="0"
        y1="0"
        x2={timelineState.width}
        y2="0"
        stroke="#4a9eff"
        stroke-width="2"
        style={{ 'pointer-events': 'none' }}
      />
    </g>
  )
}
