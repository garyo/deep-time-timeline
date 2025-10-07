import type { Component } from 'solid-js'
import { createMemo, For } from 'solid-js'
import { eventsState } from '../stores/events-store.ts'
import { interactionState } from '../stores/interaction-store.ts'
import { timelineState } from '../stores/global-timeline.ts'
import { LogTimeline } from '../log-timeline.ts'
import { RangeQueryableEvents } from '../scripts/events.ts'
import type { VisibleEvent } from '../scripts/events.ts'
import { rescaleClamp } from '../utils.ts'
import { FormattedText } from './FormattedText.tsx'
import { textSize, textSizeScale } from '../stores/text-size-store.ts'

function remap(
  x: number,
  oldMin: number,
  oldMax: number,
  newMin: number,
  newMax: number
): number {
  const remapped =
    ((x - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin
  return Math.max(newMin, Math.min(newMax, remapped))
}

function getOpacity(significance: number, threshold: number) {
  threshold = Math.min(threshold, 9.9) // prevent div-by-0
  const minOpacity = 0.05
  return Math.pow(remap(significance, threshold, 10, minOpacity, 1), 0.8)
}

function getLocalSignificanceThreshold(
  x: number,
  allVisibleEvents: VisibleEvent[]
): number {
  const windowSize = 50
  const halfWindow = windowSize / 2
  const eventsInWindow = allVisibleEvents.filter(
    (event) => Math.abs(event.x - x) <= halfWindow
  )
  const localDensity = eventsInWindow.length / windowSize
  const maxDensity = 0.15
  return remap(localDensity, 0, maxDensity, 0, 10)
}

function pushClustersForVisibility(
  eventStore: RangeQueryableEvents,
  textSizeScale: number = 1
) {
  const clusterMaxLength = 4
  const baseEventXSize = 16 // in pixels
  const eventXSize = baseEventXSize * textSizeScale
  const clusterXSize = eventXSize * 2
  const basePushYAmount = 8
  const pushYAmount = basePushYAmount * textSizeScale
  const clusterLeftMargin = eventXSize * 1.75

  let cluster: Readonly<VisibleEvent>[] = []

  for (let i = 0; i < eventStore.events.length; i++) {
    const event = eventStore.events[i]
    eventStore.queryRangeInto(
      event.x - clusterXSize / 2,
      event.x + clusterXSize / 2,
      cluster
    )

    // Extend cluster to the right
    while (true) {
      const clusterEndX = cluster[cluster.length - 1].x
      const i = eventStore.findIndex(cluster[cluster.length - 1])
      if (
        i &&
        i < eventStore.events.length - 1 &&
        eventStore.events[i + 1].x - clusterEndX < eventXSize
      ) {
        cluster.push(eventStore.events[i + 1])
      } else {
        break
      }
    }

    // Extend cluster to the left
    while (true) {
      const clusterStartX = cluster[0].x
      const i = eventStore.findIndex(cluster[0])
      if (i > 0 && clusterStartX - eventStore.events[i - 1].x < eventXSize) {
        cluster.unshift(eventStore.events[i - 1])
      } else {
        break
      }
    }

    if (cluster.length > clusterMaxLength || cluster.length <= 1) {
      continue
    }

    const leftmostIndex = eventStore.findIndex(cluster[0])
    const hasLeftMarginFree =
      leftmostIndex == 0 ||
      eventStore.events[leftmostIndex! - 1].x + clusterLeftMargin < cluster[0].x

    if (!hasLeftMarginFree) {
      continue
    }

    const clusterIndex = cluster.findIndex((v) => v === event)
    let minDist = Infinity
    for (let i = 1; i < cluster.length; i++) {
      minDist = Math.min(minDist, cluster[i].x - cluster[i - 1].x)
    }

    if (clusterIndex >= 0) {
      if (clusterIndex < cluster.length - 1) {
        const n = cluster.length - 1 - clusterIndex
        const yScale = rescaleClamp(minDist, eventXSize / 2, eventXSize, 1, 0)
        event.y = yScale * (n * pushYAmount)
      }
    }
  }
}

interface TimelineEventsProps {
  timeline: LogTimeline
}

export const TimelineEvents: Component<TimelineEventsProps> = (props) => {
  const visibleEvents = createMemo(() => {
    // Access timeline state for reactivity, use timeline for methods
    const timeline = props.timeline
    // Force reactivity by accessing timelineState and textSize
    const _ = timelineState.width // This makes the memo reactive to state changes
    const currentTextSize = textSize() // Make reactive to text size changes
    const scale = textSizeScale() // Get current text size scale factor

    // Calculate visible events
    let events: VisibleEvent[] = []
    eventsState.allEvents.forEach((event) => {
      if (
        timeline.isTimeInRange(event.date) &&
        event.categories.some((cat) => eventsState.selectedCategories.has(cat))
      ) {
        const x = timeline.getPixelPosition(event.date)
        events.push({ x, y: 0, event })
      }
    })

    // Apply clustering with text size scale
    const eventStore = new RangeQueryableEvents()
    eventStore.addAll(events)
    pushClustersForVisibility(eventStore, scale)

    // Sort by significance (lowest first so highest renders on top)
    return events.sort((a, b) => a.event.significance - b.event.significance)
  })

  return (
    <g class="events-container">
      <For each={visibleEvents()}>
        {(visibleEvent) => {
          const localThreshold = getLocalSignificanceThreshold(
            visibleEvent.x,
            visibleEvents()
          )
          const opacity = getOpacity(
            visibleEvent.event.significance,
            localThreshold
          )
          const textOffsetX = 5
          const textOffsetY = -5
          const slant = 'rotate(-35)'

          return (
            <g
              class="event-marker"
              transform={`translate(${visibleEvent.x}, 0)`}
              style={{ 'pointer-events': 'none' }}
            >
              {/* Event marker circle */}
              <circle
                class="event-marker-circle"
                r="4"
                stroke-width="1"
                opacity={opacity}
              />

              {/* Text group with clustering offset */}
              <g
                class="text-pair"
                transform={`translate(0, ${-visibleEvent.y})`}
              >
                {/* Drop shadow for high opacity text */}
                {opacity > 0.2 && (
                  <FormattedText
                    text={visibleEvent.event.name}
                    x={textOffsetX + 1}
                    y={textOffsetY + 1}
                    class="event-text-shadow"
                    transform={slant}
                    opacity={opacity}
                  />
                )}

                {/* Additional shadow for very high opacity */}
                {opacity > 0.7 && (
                  <FormattedText
                    text={visibleEvent.event.name}
                    x={textOffsetX - 1}
                    y={textOffsetY - 1}
                    class="event-text-shadow"
                    transform={slant}
                    opacity={opacity}
                  />
                )}

                {/* Main text */}
                <FormattedText
                  text={visibleEvent.event.name}
                  x={textOffsetX}
                  y={textOffsetY}
                  class="event-text"
                  transform={slant}
                  opacity={opacity}
                />

                {/* Vertical line for clustered events */}
                {visibleEvent.y > 0 && (
                  <line
                    class="event-cluster-line"
                    x1="0"
                    y1="-5.5"
                    x2="0"
                    y2={-5.5 + visibleEvent.y}
                    opacity={opacity}
                    stroke-width="1"
                  />
                )}
              </g>
            </g>
          )
        }}
      </For>
    </g>
  )
}
