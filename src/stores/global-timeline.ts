import { createSignal } from 'solid-js'
import { LogTimeline } from '../log-timeline.ts'

// Global reactive timeline - the single source of truth
const [globalTimeline, setGlobalTimeline] = createSignal<
  LogTimeline | undefined
>(undefined)

// Global timeline ready state
const [timelineReady, setTimelineReady] = createSignal(false)

export { globalTimeline, setGlobalTimeline, timelineReady, setTimelineReady }
