import type { Component } from 'solid-js'
import { onMount, onCleanup, Show } from 'solid-js'
import { eventsState, eventsActions } from '../stores/events-store.ts'
import {
  interactionState,
  interactionActions
} from '../stores/interaction-store.ts'
import {
  globalTimeline,
  setGlobalTimeline,
  timelineReady,
  setTimelineReady
} from '../stores/global-timeline.ts'
import { TimelineSVG } from './TimelineSVG.tsx'
import { TimelineControls } from './TimelineControls.tsx'
import { CategoryControls } from './CategoryControls.tsx'
import { LogTimeline, DeepTime } from '../log-timeline.ts'
import type { Event } from '../scripts/events.ts'
import {
  loadEventsFromFile,
  loadEventsFromAPI,
  EventUpdater,
  EventFileWatcher
} from '../scripts/events.ts'

interface TimelineProps {
  /** Initial time range in years ago (default: 10000) */
  initialYearsAgo?: number
  /** API URL for loading additional events */
  apiUrl?: string
  /** Auto-update interval in milliseconds (0 to disable, default: 5000) */
  autoUpdateInterval?: number
  /** Category groups for event filtering */
  categoryGroups?: Record<string, string[]>
}

/**
 * Main Timeline component that orchestrates the entire deep-time visualization.
 *
 * Responsibilities:
 * - Initializes the reactive LogTimeline instance
 * - Loads and manages events from files and APIs
 * - Sets up event handlers for user interactions
 * - Manages auto-update functionality
 * - Coordinates with SolidJS stores for reactive updates
 */
export const Timeline: Component<TimelineProps> = (props) => {
  let eventUpdater: EventUpdater | null = null
  let fileWatcher: EventFileWatcher | null = null
  let autoUpdateIntervalId: number | null = null
  let resizeTimeout: number | null = null
  const appStartTime = new DeepTime()

  // Initialize timeline
  onMount(async () => {
    try {
      // Get container dimensions
      const container = document.querySelector(
        '.timeline-container'
      ) as HTMLElement
      const svgContainer = container?.querySelector(
        '.svg-container'
      ) as HTMLElement

      if (!container || !svgContainer) {
        throw new Error('Required timeline container elements not found')
      }

      const containerRect = svgContainer.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(svgContainer)
      const paddingLeft = parseInt(computedStyle.paddingLeft || '0', 10)
      const paddingRight = parseInt(computedStyle.paddingRight || '0', 10)
      const paddingTop = parseInt(computedStyle.paddingTop || '0', 10)
      const paddingBottom = parseInt(computedStyle.paddingBottom || '0', 10)

      const width = containerRect.width - paddingLeft - paddingRight
      const height = containerRect.height - paddingTop - paddingBottom

      // Create timeline
      const timelineInstance = new LogTimeline(
        width,
        { yearsAgo: props.initialYearsAgo || 10000 },
        { yearsAgo: 0 }
      )

      // Set up batched update callback
      timelineInstance.setUpdateCallback(() => {
        setGlobalTimeline(timelineInstance)
      })

      setGlobalTimeline(timelineInstance)

      // Initialize stores with interaction dimensions only
      interactionActions.setDimensions(width, height)

      // Set up category groups
      if (props.categoryGroups) {
        eventsActions.updateCategoryGroups(props.categoryGroups)
        eventsActions.selectCategoriesByGroups(props.categoryGroups)
      }

      // Load events
      try {
        const baseEvents = await loadEventsFromFile()
        eventsActions.updateBaseEvents(baseEvents)

        // Add the "app started" event
        const allEvents = [
          ...baseEvents,
          {
            name: 'You started this app',
            date: appStartTime,
            categories: ['personal', 'news'],
            significance: 10
          }
        ]
        eventsActions.updateAllEvents(allEvents)

        // Try to load additional events from API
        if (props.apiUrl) {
          try {
            const additionalEvents = await loadEventsFromAPI(props.apiUrl)
            eventsActions.updateAdditionalEvents(additionalEvents)

            const combinedEvents = [
              ...baseEvents,
              ...additionalEvents,
              {
                name: 'You started this app',
                date: appStartTime,
                categories: ['personal', 'news'],
                significance: 10
              }
            ]
            eventsActions.updateAllEvents(combinedEvents)

            // Set up periodic updates
            eventUpdater = new EventUpdater(
              props.apiUrl,
              handleAdditionalEvents,
              15 * 60 * 1000
            )
            eventUpdater.start()

            fileWatcher = new EventFileWatcher(
              handleBaseEventsUpdate,
              1 * 60 * 1000
            )
            fileWatcher.start()
          } catch (error) {
            console.warn('No additional events available from API:', error)
          }
        }
      } catch (error) {
        console.error('Failed to load base events:', error)
      }

      // Start auto-update
      startAutoUpdate()

      // Set up resize handler
      window.addEventListener('resize', handleResize)

      // Set up keyboard navigation
      document.addEventListener('keydown', handleKeyDown)

      // Make right-time reset handler available globally
      ;(window as any).handleRightTimeReset = function () {
        const currentTimeline = globalTimeline()
        if (currentTimeline) {
          currentTimeline.resetRightmostToNow()
        }
      }

      // Signal that timeline is ready (do this last)
      setTimelineReady(true)
    } catch (error) {
      console.error('Error in Timeline onMount:', error)
      // Set ready to true anyway so we don't get stuck in loading
      setTimelineReady(true)
    }
  })

  // Event handlers
  function handleAdditionalEvents(newAdditionalEvents: Event[]) {
    eventsActions.updateAdditionalEvents(newAdditionalEvents)

    const combinedEvents = [
      ...eventsState.baseEvents,
      ...newAdditionalEvents,
      {
        name: 'You started this app',
        date: appStartTime,
        categories: ['personal', 'news'],
        significance: 10
      }
    ]
    eventsActions.updateAllEvents(combinedEvents)
  }

  function handleBaseEventsUpdate(newBaseEvents: Event[]) {
    eventsActions.updateBaseEvents(newBaseEvents)

    const combinedEvents = [
      ...newBaseEvents,
      ...eventsState.additionalEvents,
      {
        name: 'You started this app',
        date: appStartTime,
        categories: ['personal', 'news'],
        significance: 10
      }
    ]
    eventsActions.updateAllEvents(combinedEvents)
  }

  function handleTimelineChange(updatedTimeline: LogTimeline) {
    // Note: batching handled by LogTimeline.setUpdateCallback
    setGlobalTimeline(updatedTimeline)
  }

  function startAutoUpdate() {
    if (props.autoUpdateInterval && props.autoUpdateInterval > 0) {
      autoUpdateIntervalId = window.setInterval(() => {
        const currentTimeline = globalTimeline()
        if (!currentTimeline) return
        const now = new DeepTime()
        // Update the right edge if it's close to now
        if (
          Math.abs(
            currentTimeline.reftime.minutesSince1970 -
              currentTimeline.rightmost.minutesSince1970
          ) < 2
        ) {
          currentTimeline.setEndpoints(currentTimeline.leftmost, now)
        }
        currentTimeline.reftime = now
      }, props.autoUpdateInterval)
    }
  }

  function handleResize() {
    if (resizeTimeout) {
      window.clearTimeout(resizeTimeout)
    }

    resizeTimeout = window.setTimeout(() => {
      const container = document.querySelector(
        '.timeline-container'
      ) as HTMLElement
      const svgContainer = container.querySelector(
        '.svg-container'
      ) as HTMLElement
      const containerRect = svgContainer.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(svgContainer)
      const paddingLeft = parseInt(computedStyle.paddingLeft || '0', 10)
      const paddingRight = parseInt(computedStyle.paddingRight || '0', 10)
      const paddingTop = parseInt(computedStyle.paddingTop || '0', 10)
      const paddingBottom = parseInt(computedStyle.paddingBottom || '0', 10)

      const newWidth = containerRect.width - paddingLeft - paddingRight
      const newHeight = containerRect.height - paddingTop - paddingBottom

      const currentTimeline = globalTimeline()
      if (currentTimeline) {
        currentTimeline.pixelWidth = newWidth
        interactionActions.setDimensions(newWidth, newHeight)
      }

      resizeTimeout = null
    }, 50)
  }

  function handleKeyDown(e: KeyboardEvent) {
    const currentTimeline = globalTimeline()
    if (!currentTimeline) return

    const KEY_PAN_DX = 10
    const KEY_ZOOM_DZ = 1.05

    if (e.key === 'ArrowLeft') {
      const x = currentTimeline.pixelWidth / 2
      const t = currentTimeline.getTimeAtPixel(x)
      currentTimeline.panToPosition(t, x + KEY_PAN_DX)
    }
    if (e.key === 'ArrowRight') {
      const x = currentTimeline.pixelWidth / 2
      const t = currentTimeline.getTimeAtPixel(x)
      currentTimeline.panToPosition(t, x - KEY_PAN_DX)
    }
    if (e.key === 'ArrowUp') {
      currentTimeline.zoomAroundPixel(
        KEY_ZOOM_DZ,
        currentTimeline.pixelWidth / 2
      )
    }
    if (e.key === 'ArrowDown') {
      currentTimeline.zoomAroundPixel(
        1 / KEY_ZOOM_DZ,
        currentTimeline.pixelWidth / 2
      )
    }
  }

  // Cleanup
  onCleanup(() => {
    if (eventUpdater) eventUpdater.stop()
    if (fileWatcher) fileWatcher.stop()
    if (autoUpdateIntervalId) clearInterval(autoUpdateIntervalId)
    if (resizeTimeout) window.clearTimeout(resizeTimeout)

    window.removeEventListener('resize', handleResize)
    document.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <Show
      when={timelineReady() && globalTimeline()}
      fallback={
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center'
          }}
        >
          Loading timeline... (ready: {String(timelineReady())}, hasTimeline:{' '}
          {String(!!globalTimeline())})
        </div>
      }
    >
      <TimelineControls />
      <CategoryControls />
      <TimelineSVG
        timeline={globalTimeline()!}
        onTimelineChange={handleTimelineChange}
      />
    </Show>
  )
}
