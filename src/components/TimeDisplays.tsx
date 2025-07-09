import type { Component } from 'solid-js'
import { createMemo } from 'solid-js'
import { TimeDisplay } from './TimeDisplay.tsx'
import {
  timelineState,
  timelineReady,
  globalTimeline
} from '../stores/global-timeline.ts'

export const TimeDisplays: Component = () => {
  // Use memos to ensure stable reactive connections
  const leftTime = createMemo(() => {
    // Multiple conditions to ensure we have valid state
    const ready = timelineReady()
    const timeline = globalTimeline()
    const leftmostTime = timelineState.leftmostTime

    // Only return time if all conditions are met and we have a valid time
    if (ready && timeline && leftmostTime) {
      return leftmostTime
    }
    return undefined
  })

  const rightTime = createMemo(() => {
    // Multiple conditions to ensure we have valid state
    const ready = timelineReady()
    const timeline = globalTimeline()
    const rightmostTime = timelineState.rightmostTime

    // Only return time if all conditions are met and we have a valid time
    if (ready && timeline && rightmostTime) {
      return rightmostTime
    }
    return undefined
  })

  return (
    <>
      <TimeDisplay timeSignal={leftTime} position="left" />
      <TimeDisplay
        timeSignal={rightTime}
        position="right"
        onRightClick={() => (window as any).handleRightTimeReset?.()}
      />
    </>
  )
}
