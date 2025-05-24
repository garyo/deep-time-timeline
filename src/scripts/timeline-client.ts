import * as d3 from 'd3'
import { LogTimeline, DeepTime } from '../log-timeline'
import { loadEventsFromFile, loadEventsFromAPI, EventUpdater } from './events'
import type { ProcessedEvent } from './events'

export function initializeTimeline(
  container: HTMLElement,
  initialYearsAgo: number,
  apiUrl: string = 'https://example.com/api/significant-events',
  autoUpdateInterval: number = 5000 // Auto-update every 5 seconds by default
) {
  // Get container dimensions
  const svg = d3.select('#timeline-svg')
  const width = container.clientWidth
  const height = 200
  const axis_position = (height * 2) / 3 // vertical position of the axis, down from top

  // Set SVG dimensions
  svg.attr('width', width).attr('height', height)

  // Create timeline
  let timeline = new LogTimeline(
    width,
    { yearsAgo: initialYearsAgo },
    { yearsAgo: 0 } // 0 years ago = now
  )
  const appStartTime = new DeepTime()

  // Create main group
  const g = svg.append('g')

  // Add background rect - this will capture mouse events
  const backgroundRect = g
    .append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#1a1a1a')
    .style('cursor', 'grab')

  // Draw timeline axis
  const axisGroup = g
    .append('g')
    .attr('transform', `translate(0, ${axis_position})`)

  // Main timeline line
  axisGroup
    .append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', width)
    .attr('y2', 0)
    .attr('stroke', '#4a9eff')
    .attr('stroke-width', 2)

  // Add hover line (initially hidden)
  const hoverLine = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', '#ff4a4a')
    .attr('stroke-width', 1)
    .attr('opacity', 0)
    .style('pointer-events', 'none') // Don't block mouse events

  // Store current events
  let baseEvents: ProcessedEvent[] = []
  let additionalEvents: ProcessedEvent[] = []
  let allEvents: ProcessedEvent[] = []

  // Function to update time labels
  function updateTimeLabels() {
    const leftTime = timeline.leftmost
    const rightTime = timeline.rightmost

    document.getElementById('left-time')!.textContent =
      leftTime.toRelativeString()
    document.getElementById('right-time')!.textContent =
      rightTime.toRelativeString()
  }

  // Function to draw time ticks
  function drawTicks() {
    // Remove existing ticks
    axisGroup.selectAll('.tick-group').remove()

    const ticks = timeline.generateLogTicks(50)

    // Draw ticks
    const tickGroups = axisGroup
      .selectAll('.tick-group')
      .data(ticks)
      .enter()
      .append('g')
      .attr('class', 'tick-group')
      .attr('transform', (d) => `translate(${d.pos}, 0)`)

    // Tick lines
    tickGroups
      .append('line')
      .attr('y1', -10)
      .attr('y2', 10)
      .attr('stroke', '#666')
      .attr('stroke-width', 1)

    // Tick labels
    tickGroups
      .append('text')
      .attr('y', 15)
      .attr('text-anchor', 'start')
      .attr('fill', '#b0b0b0')
      .attr('font-size', '12px')
      .attr('transform', 'rotate(25)') // Slant down and right
      .style('pointer-events', 'none') // Don't block mouse events
      .text((d) => d.label)
  }

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

  function getSignificanceThreshold(nVisibleEvents: number): number {
    const density = nVisibleEvents / timeline.pixelWidth
    const maxDensity = 0.08 // more than this gets visually crowded
    return remap(density, 0, maxDensity, 0, 9)
  }

  // Draw events if they're in range
  function drawEvents() {
    // Remove existing events
    g.selectAll('.event-marker').remove()

    // Count visible events
    let nVisibleEvents = 0
    allEvents.forEach((event) => {
      if (timeline.isTimeInRange(event.date)) {
        nVisibleEvents++
      }
    })
    const significanceThreshold = getSignificanceThreshold(nVisibleEvents)

    // Draw in significance order, highest last so they show up on top
    const events = allEvents.sort((a, b) => {
      return a.significance - b.significance
    })

    events.forEach((event) => {
      if (timeline.isTimeInRange(event.date)) {
        const x = timeline.getPixelPosition(event.date)

        const eventGroup = g
          .append('g')
          .attr('class', 'event-marker')
          .attr('transform', `translate(${x}, ${axis_position})`)
          .style('pointer-events', 'none') // Don't block mouse events

        // Calculate opacity based on significance (1-10 scale)
        // Higher significance = more opaque
        const opacity = getOpacity(event.significance, significanceThreshold)

        // Event marker
        eventGroup
          .append('circle')
          .attr('r', 4)
          .attr('fill', '#ff9f1a')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .attr('opacity', opacity)

        // Event label -- duplicated with black drop shadow first
        const textOffsetX = 5 // Start 5px to the right of the dot
        const textOffsetY = -5 // Start 5px above the dot (Y is + down)
        const slant = `rotate(-35)` // Slant up and right
        const textGroup = eventGroup.append('g').attr('class', 'text-pair')
        // shadow
        textGroup
          .append('text')
          .attr('x', textOffsetX + 1)
          .attr('y', textOffsetY + 1)
          .attr('text-anchor', 'start')
          .attr('fill', 'black')
          .attr('font-size', '11px')
          .attr('transform', slant)
          .attr('opacity', opacity)
          .text(event.name)
        textGroup
          .append('text')
          .attr('x', textOffsetX - 1)
          .attr('y', textOffsetY - 1)
          .attr('text-anchor', 'start')
          .attr('fill', 'black')
          .attr('font-size', '11px')
          .attr('transform', slant)
          .attr('opacity', opacity)
          .text(event.name)
        // main text
        textGroup
          .append('text')
          .attr('x', textOffsetX)
          .attr('y', textOffsetY)
          .attr('text-anchor', 'start')
          .attr('fill', '#e0e0e0')
          .attr('font-size', '11px')
          .attr('transform', slant)
          .attr('opacity', opacity)
          .text(event.name)
      }
    })
  }

  // Function to handle full redraw (used for zoom, pan, and auto-update)
  function redrawTimeline() {
    updateTimeLabels()
    drawTicks()
    drawEvents()
  }

  // Function to handle event updates
  function handleEventUpdate() {
    allEvents = [...baseEvents, ...additionalEvents]
    allEvents.push({
      name: 'Started this app',
      date: appStartTime,
      significance: 10
    })
    drawEvents() // Redraw events with new data
    console.log(
      `Updated timeline with ${allEvents.length} events (${baseEvents.length} base + ${additionalEvents.length} additional)`
    )
  }

  // Function to handle additional events from API
  function handleAdditionalEvents(newAdditionalEvents: ProcessedEvent[]) {
    console.log(
      `Received ${newAdditionalEvents.length} additional events from API`
    )
    additionalEvents = newAdditionalEvents
    handleEventUpdate()
  }

  // Auto-update functionality
  let autoUpdateIntervalId: number | null = null

  function startAutoUpdate() {
    if (autoUpdateInterval > 0) {
      autoUpdateIntervalId = window.setInterval(() => {
        const now = new DeepTime()
        // Update the right edge, if it's now (= reftime)
        if (timeline.reftime.equals(timeline.rightmost))
          timeline.setEndpoints(timeline.leftmost, now)
        timeline.reftime = now
        redrawTimeline()
      }, autoUpdateInterval)
      console.log(`Started auto-update every ${autoUpdateInterval}ms`)
    }
  }

  function stopAutoUpdate() {
    if (autoUpdateIntervalId) {
      clearInterval(autoUpdateIntervalId)
      autoUpdateIntervalId = null
      console.log('Stopped auto-update')
    }
  }

  // Initial draw
  updateTimeLabels()
  drawTicks()

  // Start auto-update
  startAutoUpdate()

  // Load base events immediately
  loadEventsFromFile()
    .then((loadedBaseEvents) => {
      console.log(
        `Timeline initialized with ${loadedBaseEvents.length} base events`
      )
      baseEvents = loadedBaseEvents
      handleEventUpdate()

      // Now try to load additional events from API asynchronously
      loadEventsFromAPI(apiUrl)
        .then((loadedAdditionalEvents) => {
          console.log(
            `Loaded ${loadedAdditionalEvents.length} additional events from API`
          )
          handleAdditionalEvents(loadedAdditionalEvents)

          // Set up periodic API updates (every 5 minutes)
          const eventUpdater = new EventUpdater(
            apiUrl,
            handleAdditionalEvents,
            300000 // 5 minutes
          )
          eventUpdater.start()

          // Clean up on page unload
          window.addEventListener('beforeunload', () => {
            eventUpdater.stop()
            stopAutoUpdate()
          })
        })
        .catch((error) => {
          console.warn('No additional events available from API:', error)
          // Continue with just base events - no fallback needed
        })
    })
    .catch((error) => {
      console.error('Failed to load base events:', error)
      // This shouldn't happen since loadEventsFromFile has fallbacks
    })

  // Mouse and touch event handling
  let isPanning = false
  let startX = 0
  let startTime: DeepTime | null = null
  let lastTouchDistance = 0
  let touchStartTime: DeepTime | null = null

  // Attach mouse events to the background rect
  backgroundRect
    .on('mouseenter', function () {
      hoverLine.attr('opacity', 0.5)
    })
    .on('mousemove', function (event) {
      const [x, y] = d3.pointer(event)

      // Update hover line position
      hoverLine.attr('x1', x).attr('x2', x)

      // Update hover info
      const time = timeline.getTimeAtPixel(x)
      const hoverInfo = document.getElementById('hover-info')
      if (hoverInfo) {
        if (time.year > -1e5)
          hoverInfo.textContent = `Position: ${time.toRelativeString()} (${time.toLocaleString(
            undefined,
            { era: 'short' }
          )})`
        else hoverInfo.textContent = `Position: ${time.toRelativeString()}`
      }

      // Handle panning
      if (isPanning && startTime) {
        // We want the time that was originally at startX to follow the mouse to x
        timeline.panToPosition(startTime, x)
        redrawTimeline()
      }
    })
    .on('mouseleave', function () {
      hoverLine.attr('opacity', 0)
      const hoverInfo = document.getElementById('hover-info')
      if (hoverInfo) {
        hoverInfo.textContent = ''
      }
      isPanning = false
      startTime = null
      backgroundRect.style('cursor', 'grab')
    })
    .on('mousedown', function (event) {
      isPanning = true
      const [x] = d3.pointer(event)
      startX = x
      startTime = timeline.getTimeAtPixel(x)
      backgroundRect.style('cursor', 'grabbing')
    })
    .on('mouseup', function () {
      isPanning = false
      startTime = null
      backgroundRect.style('cursor', 'grab')
    })

  // Add mouse wheel zoom functionality
  backgroundRect.on('wheel', function (event) {
    event.preventDefault()

    const [x, y] = d3.pointer(event)
    const deltaX = event.deltaX
    const deltaY = event.deltaY
    const isZoom = Math.abs(deltaY) > Math.abs(deltaX)

    if (isZoom) {
      // Calculate zoom factor
      // Negative deltaY = scroll up = zoom in
      // Positive deltaY = scroll down = zoom out
      const zoomSpeed = 0.002
      const factor = Math.exp(-deltaY * zoomSpeed)

      // Zoom around the mouse position
      timeline.zoomAroundPixel(factor, x)
    } else {
      // pan
      const t = timeline.getTimeAtPixel(x - deltaX)
      timeline.panToPosition(t, x)
    }
    // Update display
    redrawTimeline()
  })

  // Touch event handling
  function getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function getTouchCenter(touches: TouchList): [number, number] {
    if (touches.length === 1) {
      const rect = (backgroundRect.node() as Element).getBoundingClientRect()
      return [touches[0].clientX - rect.left, touches[0].clientY - rect.top]
    }
    const touch1 = touches[0]
    const touch2 = touches[1]
    const rect = (backgroundRect.node() as Element).getBoundingClientRect()
    return [
      (touch1.clientX + touch2.clientX) / 2 - rect.left,
      (touch1.clientY + touch2.clientY) / 2 - rect.top
    ]
  }

  // Add touch events to the background rect
  backgroundRect
    .on('touchstart', function (event) {
      event.preventDefault()
      const touches = event.touches
      
      if (touches.length === 1) {
        // Single touch - start panning
        isPanning = true
        const [x] = getTouchCenter(touches)
        startX = x
        startTime = timeline.getTimeAtPixel(x)
        touchStartTime = timeline.getTimeAtPixel(x)
        backgroundRect.style('cursor', 'grabbing')
        
        // Show hover line
        hoverLine.attr('opacity', 0.5).attr('x1', x).attr('x2', x)
      } else if (touches.length === 2) {
        // Two touches - prepare for zoom
        isPanning = false
        lastTouchDistance = getTouchDistance(touches)
        const [x] = getTouchCenter(touches)
        touchStartTime = timeline.getTimeAtPixel(x)
      }
    })
    .on('touchmove', function (event) {
      event.preventDefault()
      const touches = event.touches
      
      if (touches.length === 1 && isPanning && startTime) {
        // Single touch - pan
        const [x] = getTouchCenter(touches)
        
        // Update hover line
        hoverLine.attr('x1', x).attr('x2', x)
        
        // Update hover info
        const time = timeline.getTimeAtPixel(x)
        const hoverInfo = document.getElementById('hover-info')
        if (hoverInfo) {
          if (time.year > -1e5)
            hoverInfo.textContent = `Position: ${time.toRelativeString()} (${time.toLocaleString(
              undefined,
              { era: 'short' }
            )})`
          else hoverInfo.textContent = `Position: ${time.toRelativeString()}`
        }
        
        // Pan to follow touch
        timeline.panToPosition(startTime, x)
        redrawTimeline()
      } else if (touches.length === 2) {
        // Two touches - zoom
        const currentDistance = getTouchDistance(touches)
        const [x] = getTouchCenter(touches)
        
        if (lastTouchDistance > 0) {
          const factor = currentDistance / lastTouchDistance
          timeline.zoomAroundPixel(factor, x)
          redrawTimeline()
        }
        
        lastTouchDistance = currentDistance
      }
    })
    .on('touchend touchcancel', function (event) {
      event.preventDefault()
      const touches = event.touches
      
      if (touches.length === 0) {
        // All touches ended
        isPanning = false
        startTime = null
        touchStartTime = null
        lastTouchDistance = 0
        backgroundRect.style('cursor', 'grab')
        
        // Hide hover line and info
        hoverLine.attr('opacity', 0)
        const hoverInfo = document.getElementById('hover-info')
        if (hoverInfo) {
          hoverInfo.textContent = ''
        }
      } else if (touches.length === 1 && lastTouchDistance > 0) {
        // Went from two touches to one - restart single touch mode
        isPanning = true
        const [x] = getTouchCenter(touches)
        startX = x
        startTime = timeline.getTimeAtPixel(x)
        lastTouchDistance = 0
        
        // Show hover line
        hoverLine.attr('opacity', 0.5).attr('x1', x).attr('x2', x)
      }
    })

  // Handle window resize
  window.addEventListener('resize', () => {
    const newWidth = container.clientWidth
    svg.attr('width', newWidth)

    // Create new timeline with same time span
    const leftTime = timeline.leftmost
    const rightTime = timeline.rightmost
    timeline = new LogTimeline(newWidth, leftTime, rightTime)

    // Update dimensions
    backgroundRect.attr('width', newWidth)
    axisGroup.select('line').attr('x2', newWidth)

    // Redraw
    redrawTimeline()
  })

  // Connect navigation buttons
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    timeline.zoomAroundPixel(1.2, width / 2)
    redrawTimeline()
  })

  document.getElementById('zoom-out')?.addEventListener('click', () => {
    timeline.zoomAroundPixel(0.8, width / 2)
    redrawTimeline()
  })

  document.getElementById('reset-view')?.addEventListener('click', () => {
    timeline.setEndpoints({ yearsAgo: initialYearsAgo }, { yearsAgo: 0 })
    redrawTimeline()
  })

  // Connect preset buttons
  document.querySelectorAll('.preset-button').forEach((button) => {
    button.addEventListener('click', () => {
      const years = parseInt((button as HTMLElement).dataset.years!)
      timeline.setEndpoints({ yearsAgo: years }, { yearsAgo: 0 })
      redrawTimeline()
    })
  })
}
