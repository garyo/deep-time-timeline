import type { Component } from 'solid-js'
import { TimeDisplay } from './TimeDisplay.tsx'
import { globalTimeline, timelineState } from '../stores/global-timeline.ts'

export const TimeDisplays: Component = () => {
  return (
    <>
      {/* Time displays read directly from timeline state for reactivity */}
      <TimeDisplay
        timeSignal={() =>
          globalTimeline() ? timelineState.leftmostTime : undefined
        }
        position="left"
      />
      <TimeDisplay
        timeSignal={() =>
          globalTimeline() ? timelineState.rightmostTime : undefined
        }
        position="right"
        onRightClick={() => (window as any).handleRightTimeReset?.()}
      />
    </>
  )
}
