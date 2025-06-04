import type { Component } from 'solid-js'
import { TimeDisplay } from './TimeDisplay.tsx'
import { globalTimeline } from '../stores/global-timeline.ts'

export const TimeDisplays: Component = () => {
  return (
    <>
      {/* Time displays read from global timeline */}
      <TimeDisplay
        timeSignal={() => globalTimeline()?.leftmost}
        position="left"
      />
      <TimeDisplay
        timeSignal={() => globalTimeline()?.rightmost}
        position="right"
        onRightClick={() => (window as any).handleRightTimeReset?.()}
      />
    </>
  )
}
