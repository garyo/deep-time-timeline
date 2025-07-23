import type { Component } from 'solid-js'
import { onMount, onCleanup } from 'solid-js'
import { eventsState, eventsActions } from '../stores/events-store.ts'
import {
  interactionState,
  interactionActions
} from '../stores/interaction-store.ts'
import { timelineState } from '../stores/global-timeline.ts'
import { TimelineAxis } from './TimelineAxis.tsx'
import { TimelineTicks } from './TimelineTicks.tsx'
import { TimelineEvents } from './TimelineEvents.tsx'
import { TimelineHover } from './TimelineHover.tsx'
import { LogTimeline, DeepTime } from '../log-timeline.ts'

interface TimelineSVGProps {
  timeline: LogTimeline
}

export const TimelineSVG: Component<TimelineSVGProps> = (props) => {
  let svgRef!: SVGSVGElement
  let cachedRect: DOMRect | null = null

  // Cache bounding rect to avoid layout recalculation
  const updateCachedRect = () => {
    if (svgRef) {
      cachedRect = svgRef.getBoundingClientRect()
    }
  }

  // Get pointer position relative to SVG
  const getPointerPosition = (event: PointerEvent): [number, number] => {
    if (!cachedRect) updateCachedRect()
    const rect = cachedRect!
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  // Get mouse position relative to SVG (for non-pointer events)
  const getMousePosition = (event: MouseEvent): [number, number] => {
    if (!cachedRect) updateCachedRect()
    const rect = cachedRect!
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  // Track active pointers for multi-touch gestures
  const activePointers = new Map<number, PointerEvent>()

  // Get center position of active pointers
  const getPointerCenter = (): [number, number] => {
    const pointers = Array.from(activePointers.values())
    if (pointers.length === 1) {
      return getPointerPosition(pointers[0])
    }
    const rect = svgRef.getBoundingClientRect()
    const centerX =
      pointers.reduce((sum, p) => sum + p.clientX, 0) / pointers.length -
      rect.left
    const centerY =
      pointers.reduce((sum, p) => sum + p.clientY, 0) / pointers.length -
      rect.top
    return [centerX, centerY]
  }

  const getPointerDistance = (): number => {
    const pointers = Array.from(activePointers.values())
    if (pointers.length < 2) return 0
    const p1 = pointers[0]
    const p2 = pointers[1]
    const dx = p2.clientX - p1.clientX
    const dy = p2.clientY - p1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const updateHoverInfo = (x: number | null, time: DeepTime | null) => {
    if (x === null || time === null) {
      interactionActions.clearHover()
      const hoverInfo = document.getElementById('hover-info')
      if (hoverInfo) hoverInfo.textContent = ''
    } else {
      interactionActions.setHover(x, 0, time)

      // Update hover info text
      const hoverInfo = document.getElementById('hover-info')
      if (hoverInfo) {
        const posText = props.timeline.pixelWidth > 400 ? 'Position: ' : ''
        if (time.year > -1e5) {
          hoverInfo.textContent =
            `${posText}${time.toRelativeString()} ` +
            `(${time
              .toLocaleString()
              .replace(/AD/, 'CE')
              .replace(/BC(?!E)/, 'BCE')})`
        } else {
          hoverInfo.textContent = `${posText}${time.toRelativeString()}`
        }
      }
    }
  }

  const handlePointerEnter = (event: PointerEvent) => {
    const [x] = getPointerPosition(event)
    const time = props.timeline.getTimeAtPixel(x)
    updateHoverInfo(x, time)
  }

  const handlePointerMove = (event: PointerEvent) => {
    activePointers.set(event.pointerId, event)

    if (
      activePointers.size === 1 &&
      interactionState.isPanning &&
      interactionState.startTime
    ) {
      // Single pointer panning
      const [x] = getPointerPosition(event)
      const time = props.timeline.getTimeAtPixel(x)
      updateHoverInfo(x, time)
      props.timeline.panToPosition(interactionState.startTime, x)
    } else if (activePointers.size === 2) {
      // Two pointer zooming
      const currentDistance = getPointerDistance()
      const [x] = getPointerCenter()

      if (interactionState.lastTouchDistance > 0) {
        const factor = currentDistance / interactionState.lastTouchDistance
        props.timeline.zoomAroundPixel(factor, x)
        updateHoverInfo(null, null)
      }

      interactionActions.setTouchDistance(currentDistance)
    } else if (activePointers.size === 1) {
      // Single pointer hover (not panning)
      const [x] = getPointerPosition(event)
      const time = props.timeline.getTimeAtPixel(x)
      updateHoverInfo(x, time)
    }
  }

  const handlePointerLeave = () => {
    updateHoverInfo(null, null)
    // Don't stop panning or release pointer capture here - let pointer capture handle drag continuation
    svgRef.classList.remove('grabbing')
    svgRef.classList.add('grab')
  }

  const handlePointerDown = (event: PointerEvent) => {
    activePointers.set(event.pointerId, event)

    if (activePointers.size === 1) {
      // Single pointer - start panning
      const [x] = getPointerPosition(event)
      const time = props.timeline.getTimeAtPixel(x)
      interactionActions.startPanning(time)
      updateHoverInfo(x, time)
      svgRef.classList.remove('grab')
      svgRef.classList.add('grabbing')
      svgRef.setPointerCapture(event.pointerId)
    } else if (activePointers.size === 2) {
      // Two pointers - start zooming
      interactionActions.stopPanning()
      interactionActions.setTouchDistance(getPointerDistance())
      updateHoverInfo(null, null)
    }
  }

  const handlePointerUp = (event: PointerEvent) => {
    activePointers.delete(event.pointerId)
    svgRef.releasePointerCapture(event.pointerId)

    if (activePointers.size === 0) {
      // No pointers left
      interactionActions.stopPanning()
      interactionActions.setTouchDistance(0)
      svgRef.classList.remove('grabbing')
      svgRef.classList.add('grab')
    } else if (
      activePointers.size === 1 &&
      interactionState.lastTouchDistance > 0
    ) {
      // One pointer left after zooming - start panning
      const [x] = getPointerCenter()
      const time = props.timeline.getTimeAtPixel(x)
      interactionActions.startPanning(time)
      interactionActions.setTouchDistance(0)
      updateHoverInfo(x, time)
    }
  }

  const handlePointerCancel = (event: PointerEvent) => {
    activePointers.delete(event.pointerId)
    interactionActions.stopPanning()
    interactionActions.setTouchDistance(0)
    updateHoverInfo(null, null)
    svgRef.classList.remove('grabbing')
    svgRef.classList.add('grab')
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()

    const [x] = getMousePosition(event)
    const deltaX = event.deltaX
    const deltaY = event.deltaY
    const isZoom = Math.abs(deltaY) > Math.abs(deltaX)

    if (isZoom) {
      // Cancel any existing animation
      if (interactionState.animationId) {
        cancelAnimationFrame(interactionState.animationId)
        interactionActions.setAnimationId(null)
      }

      // Calculate zoom factor
      const zoomSpeed = 0.002
      const factor = Math.exp(-deltaY * zoomSpeed)

      // Zoom around mouse position
      props.timeline.zoomAroundPixel(factor, x)
      updateHoverInfo(null, null)
    } else {
      // Pan
      const targetTime = props.timeline.getTimeAtPixel(x - deltaX)
      props.timeline.panToPosition(targetTime, x)
    }
  }

  onMount(() => {
    // Set initial dimensions
    interactionActions.setDimensions(
      timelineState.width,
      interactionState.dimensions.height
    )

    // Cache initial rect
    updateCachedRect()

    // Set initial cursor style
    svgRef.classList.add('grab')

    // Add non-passive event listeners for preventDefault support
    svgRef.addEventListener('wheel', handleWheel, { passive: false })

    // Update cached rect on resize
    const resizeObserver = new ResizeObserver(() => {
      updateCachedRect()
    })
    resizeObserver.observe(svgRef)

    // Store observer for cleanup
    ;(svgRef as any).__resizeObserver = resizeObserver
  })

  onCleanup(() => {
    // Remove event listeners
    if (svgRef) {
      svgRef.removeEventListener('wheel', handleWheel)
      // Clean up resize observer
      const observer = (svgRef as any).__resizeObserver
      if (observer) {
        observer.disconnect()
      }
    }
  })

  return (
    <svg
      ref={svgRef!}
      width={timelineState.width}
      height={interactionState.dimensions.height}
      class="timeline-svg"
      style={{
        display: 'block',
        width: '100%',
        height: '100%'
      }}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <g>
        <g
          transform={`translate(0, ${interactionState.dimensions.axisPosition})`}
        >
          <TimelineAxis timeline={props.timeline} />
          <TimelineTicks timeline={props.timeline} />
          <TimelineEvents timeline={props.timeline} />
        </g>
        <TimelineHover />
      </g>
    </svg>
  )
}
