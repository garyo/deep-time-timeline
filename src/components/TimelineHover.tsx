import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { interactionState } from '../stores/interaction-store.ts'

export const TimelineHover: Component = () => {
  return (
    <Show when={interactionState.hoverPosition}>
      <line
        class="hover-line"
        x1={interactionState.hoverPosition![0]}
        y1="0"
        x2={interactionState.hoverPosition![0]}
        y2={interactionState.dimensions.height}
        stroke-width="1"
        style={{ 'pointer-events': 'none' }}
      />
    </Show>
  )
}
