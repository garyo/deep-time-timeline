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

  // Get mouse position relative to SVG
  const getMousePosition = (event: MouseEvent): [number, number] => {
    const rect = svgRef.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  // Get touch center position
  const getTouchCenter = (touches: TouchList): [number, number] => {
    if (touches.length === 1) {
      const rect = svgRef.getBoundingClientRect()
      return [touches[0].clientX - rect.left, touches[0].clientY - rect.top]
    }
    const touch1 = touches[0]
    const touch2 = touches[1]
    const rect = svgRef.getBoundingClientRect()
    return [
      (touch1.clientX + touch2.clientX) / 2 - rect.left,
      (touch1.clientY + touch2.clientY) / 2 - rect.top
    ]
  }

  const getTouchDistance = (touches: TouchList): number => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
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

  const handleMouseEnter = (event: MouseEvent) => {
    const [x] = getMousePosition(event)
    const time = props.timeline.getTimeAtPixel(x)
    updateHoverInfo(x, time)
  }

  const handleMouseMove = (event: MouseEvent) => {
    const [x] = getMousePosition(event)
    const time = props.timeline.getTimeAtPixel(x)
    updateHoverInfo(x, time)

    // Handle panning
    if (interactionState.isPanning && interactionState.startTime) {
      props.timeline.panToPosition(interactionState.startTime, x)
    }
  }

  const handleMouseLeave = () => {
    updateHoverInfo(null, null)
    interactionActions.stopPanning()
    svgRef.style.cursor = 'grab'
  }

  const handleMouseDown = (event: MouseEvent) => {
    const [x] = getMousePosition(event)
    const time = props.timeline.getTimeAtPixel(x)
    interactionActions.startPanning(time)
    updateHoverInfo(x, time)
    svgRef.style.cursor = 'grabbing'
  }

  const handleMouseUp = () => {
    interactionActions.stopPanning()
    svgRef.style.cursor = 'grab'
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

  // Touch event handlers
  const handleTouchStart = (event: TouchEvent) => {
    event.preventDefault()
    const touches = event.touches

    if (touches.length === 1) {
      const [x] = getTouchCenter(touches)
      const time = props.timeline.getTimeAtPixel(x)
      interactionActions.startPanning(time)
      svgRef.style.cursor = 'grabbing'
      updateHoverInfo(x, time)
    } else if (touches.length === 2) {
      interactionActions.stopPanning()
      interactionActions.setTouchDistance(getTouchDistance(touches))
      updateHoverInfo(null, null)
    }
  }

  const handleTouchMove = (event: TouchEvent) => {
    event.preventDefault()
    const touches = event.touches

    if (
      touches.length === 1 &&
      interactionState.isPanning &&
      interactionState.startTime
    ) {
      const [x] = getTouchCenter(touches)
      updateHoverInfo(x, props.timeline.getTimeAtPixel(x))
      props.timeline.panToPosition(interactionState.startTime, x)
    } else if (touches.length === 2) {
      const currentDistance = getTouchDistance(touches)
      const [x] = getTouchCenter(touches)

      if (interactionState.lastTouchDistance > 0) {
        const factor = currentDistance / interactionState.lastTouchDistance
        props.timeline.zoomAroundPixel(factor, x)
        updateHoverInfo(null, null)
      }

      interactionActions.setTouchDistance(currentDistance)
    }
  }

  const handleTouchEnd = (event: TouchEvent) => {
    event.preventDefault()
    const touches = event.touches

    if (touches.length === 0) {
      interactionActions.stopPanning()
      interactionActions.setTouchDistance(0)
      svgRef.style.cursor = 'grab'
    } else if (touches.length === 1 && interactionState.lastTouchDistance > 0) {
      const [x] = getTouchCenter(touches)
      const time = props.timeline.getTimeAtPixel(x)
      interactionActions.startPanning(time)
      interactionActions.setTouchDistance(0)
      updateHoverInfo(x, time)
    }
  }

  onMount(() => {
    // Set initial dimensions
    interactionActions.setDimensions(
      timelineState.width,
      interactionState.dimensions.height
    )

    // Set cursor style
    svgRef.style.cursor = 'grab'

    // Add non-passive event listeners for preventDefault support
    svgRef.addEventListener('wheel', handleWheel, { passive: false })
    svgRef.addEventListener('touchstart', handleTouchStart, {
      passive: false,
      capture: true
    })
    svgRef.addEventListener('touchmove', handleTouchMove, {
      passive: false,
      capture: true
    })
    svgRef.addEventListener('touchend', handleTouchEnd, {
      passive: false,
      capture: true
    })
    svgRef.addEventListener('touchcancel', handleTouchEnd, {
      passive: false,
      capture: true
    })
  })

  onCleanup(() => {
    // Remove event listeners
    if (svgRef) {
      svgRef.removeEventListener('wheel', handleWheel)
      svgRef.removeEventListener('touchstart', handleTouchStart)
      svgRef.removeEventListener('touchmove', handleTouchMove)
      svgRef.removeEventListener('touchend', handleTouchEnd)
      svgRef.removeEventListener('touchcancel', handleTouchEnd)
    }
  })

  return (
    <svg
      ref={svgRef!}
      width={timelineState.width}
      height={interactionState.dimensions.height}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        '-ms-user-select': 'none',
        'touch-action': 'none'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
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
