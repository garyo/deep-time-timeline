import { createStore } from 'solid-js/store'
import { createSignal } from 'solid-js'
import { LogTimeline } from '../log-timeline.ts'
import { DeepTime } from '../deep-time.ts'

export interface TimelineState {
  leftmostTime: DeepTime
  rightmostTime: DeepTime
  refTime: DeepTime
  width: number
}

// Global timeline state - the single source of truth
const [timelineState, setTimelineState] = createStore<TimelineState>({
  leftmostTime: new DeepTime({ yearsAgo: 10000 }),
  rightmostTime: new DeepTime(),
  refTime: new DeepTime(),
  width: 800
})

// Global timeline instance
const [globalTimeline, setGlobalTimeline] = createSignal<
  LogTimeline | undefined
>(undefined)

// Timeline ready state - true when timeline has been initialized
// Explicitly initialized to false to ensure proper initial state
const [timelineReady, setTimelineReady] = createSignal<boolean>(false)

export {
  timelineState,
  setTimelineState,
  globalTimeline,
  setGlobalTimeline,
  timelineReady,
  setTimelineReady
}
