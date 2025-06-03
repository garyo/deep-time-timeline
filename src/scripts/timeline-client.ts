import * as d3 from 'd3'
import { LogTimeline, DeepTime } from '../log-timeline'
import { rescale, rescaleClamp } from '../utils'
import {
  loadEventsFromFile,
  loadEventsFromAPI,
  EventUpdater,
  EventFileWatcher,
  RangeQueryableEvents
} from './events'
import type { Event, VisibleEvent } from './events'

// Helper function to get container dimensions accounting for padding
function getContainerDimensions(container: HTMLElement): {
  width: number
  height: number
  axis_position: number
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  paddingBottom: number
} {
  // Get the SVG container dimensions
  const svgContainer = container.querySelector('.svg-container') as HTMLElement
  const containerRect = svgContainer.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(svgContainer)
  const paddingLeft = parseInt(computedStyle.paddingLeft || '0', 10)
  const paddingRight = parseInt(computedStyle.paddingRight || '0', 10)
  const paddingTop = parseInt(computedStyle.paddingTop || '0', 10)
  const paddingBottom = parseInt(computedStyle.paddingBottom || '0', 10)

  // Calculate available width and height
  const width = containerRect.width - paddingLeft - paddingRight
  const height = containerRect.height - paddingTop - paddingBottom
  const axis_position = height * 0.6 // vertical position of the axis, down from top

  return {
    width,
    height,
    axis_position,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom
  }
}

export async function initializeTimeline(
  container: HTMLElement,
  initialYearsAgo: number,
  apiUrl: string = 'https://timeline-events-api.garyo.workers.dev',
  autoUpdateInterval: number = 10 * 1000 // Auto-update every 5 seconds by default
) {
  const appStartTime = new DeepTime()

  // Get container dimensions
  const svg = d3.select('#timeline-svg')

  // Get the actual available space accounting for padding
  const {
    width: initWidth,
    height: initHeight,
    axis_position: initAxisPosition,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom
  } = getContainerDimensions(container)

  let width = initWidth
  let height = initHeight
  let axis_position = initAxisPosition

  //  console.log(`Setting up timeline: container rect ${containerRect.width} x ${containerRect.height}, padding L:${paddingLeft} R:${paddingRight} T:${paddingTop} B:${paddingBottom}, setting SVG dims ${currentWidth} x ${currentHeight}, axis at ${current_axis_position} (from top)`)

  // Set SVG dimensions
  svg.attr('width', width).attr('height', height)

  // Clear any existing content
  svg.selectAll('*').remove()

  // Create timeline
  let timeline = new LogTimeline(
    width,
    { yearsAgo: initialYearsAgo },
    { yearsAgo: 0 } // 0 years ago = now
  )

  function selectCategoriesByGroups(
    groups: Record<string, string[]>,
    groupNames?: string[]
  ) {
    selectedCategories = new Set<string>()
    Object.entries(groups).forEach(([groupName, categories]) => {
      if (groupNames === undefined || groupNames.includes(groupName)) {
        categories.forEach((category) => {
          selectedCategories.add(category)
        })
      }
    })
    return selectedCategories
  }

  // Get category groups from server-side data and select all by default
  let categoryGroups: Record<string, string[]> = {}
  let selectedCategories = new Set<string>()

  try {
    const categoryGroupsData = container.dataset.categoryGroups
    if (categoryGroupsData) {
      categoryGroups = JSON.parse(categoryGroupsData)
      selectedCategories = selectCategoriesByGroups(categoryGroups)

      // Wire up event handlers for server-generated checkboxes
      setupCategoryCheckboxHandlers()

      // Set initial master toggle state
      updateAllToggleState()
    }
  } catch (error) {
    console.error('Failed to parse category groups data:', error)
  }

  // Function to set up event handlers for server-generated checkboxes
  function setupCategoryCheckboxHandlers() {
    // Add event listeners to all group checkboxes
    Object.keys(categoryGroups).forEach((groupName) => {
      const checkbox = document.getElementById(
        `category-${groupName}`
      ) as HTMLInputElement
      if (checkbox) {
        checkbox.addEventListener('change', updateSelectedCategoriesForEvent)
      }
    })

    // Add event listener to the master toggle checkbox
    const allToggle = document.getElementById(
      'category-all-toggle'
    ) as HTMLInputElement
    if (allToggle) {
      allToggle.addEventListener('change', handleAllToggleChange)
    }
  }

  // Update selected categories based on checked checkboxes
  function updateSelectedCategories(updateToggle: boolean = true) {
    const checkedGroups: string[] = []

    // Get all checked group names
    Object.keys(categoryGroups).forEach((groupName) => {
      const checkbox = document.getElementById(
        `category-${groupName}`
      ) as HTMLInputElement
      if (checkbox && checkbox.checked) {
        checkedGroups.push(groupName)
      }
    })

    // Update selected categories and redraw
    selectCategoriesByGroups(categoryGroups, checkedGroups)
    drawEvents(eventsContainer, axis_position)

    // Update the master toggle state (avoid infinite loop)
    if (updateToggle) {
      updateAllToggleState()
    }
  }
  function updateSelectedCategoriesForEvent() {
    return updateSelectedCategories(true)
  }

  // Handle master toggle checkbox changes
  function handleAllToggleChange() {
    const allToggle = document.getElementById(
      'category-all-toggle'
    ) as HTMLInputElement
    if (!allToggle) return

    // When the toggle is clicked:
    // - If it was checked (all on), uncheck everything
    // - If it was unchecked or indeterminate, check everything
    const shouldCheckAll = allToggle.checked

    // Set all group checkboxes to the same state
    Object.keys(categoryGroups).forEach((groupName) => {
      const checkbox = document.getElementById(
        `category-${groupName}`
      ) as HTMLInputElement
      if (checkbox) {
        checkbox.checked = shouldCheckAll
      }
    })

    // Clear indeterminate state
    allToggle.indeterminate = false

    // Update selected categories (don't update toggle state to avoid loop)
    updateSelectedCategories(false)
  }

  // Update the master toggle state based on individual checkboxes
  function updateAllToggleState() {
    const allToggle = document.getElementById(
      'category-all-toggle'
    ) as HTMLInputElement
    if (!allToggle) return

    const groupNames = Object.keys(categoryGroups)
    const checkedCount = groupNames.filter((groupName) => {
      const checkbox = document.getElementById(
        `category-${groupName}`
      ) as HTMLInputElement
      return checkbox && checkbox.checked
    }).length

    if (checkedCount === 0) {
      // None checked
      allToggle.checked = false
      allToggle.indeterminate = false
    } else if (checkedCount === groupNames.length) {
      // All checked
      allToggle.checked = true
      allToggle.indeterminate = false
    } else {
      // Some checked
      allToggle.checked = false
      allToggle.indeterminate = true
    }
  }

  // Create main group
  const g = svg.append('g')

  // Draw timeline axis
  const axisGroup = g
    .append('g')
    .attr('class', 'axis-group')
    .attr('transform', `translate(0, ${axis_position})`)

  // Create persistent containers for ticks and events
  const ticksContainer = axisGroup.append('g').attr('class', 'ticks-container')
  const eventsContainer = g.append('g').attr('class', 'events-container')

  // Main timeline line
  axisGroup
    .append('line')
    .attr('class', 'main-axis-line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', width)
    .attr('y2', 0)
    .attr('stroke', '#4a9eff')
    .attr('stroke-width', 2)
    .style('pointer-events', 'none') // Don't block mouse events

  // Add hover line (initially hidden)
  const hoverLine = g
    .append('line')
    .attr('class', 'hover-line')
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', '#ff4a4a')
    .attr('stroke-width', 1)
    .attr('opacity', 0)
    .style('pointer-events', 'none') // Don't block mouse events

  // Store current events
  let baseEvents: Event[] = []
  let additionalEvents: Event[] = []
  let allEvents: Event[] = []

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
  function drawTicks(container = ticksContainer) {
    container.node()!.innerHTML = '' // clear existing ticks
    const ticks = timeline.generateLogTicks(50)

    // Draw ticks
    const tickGroups = container
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

  function getLocalSignificanceThreshold(
    x: number,
    allVisibleEvents: VisibleEvent[]
  ): number {
    // Define a window around this position to calculate local density
    const windowSize = 50 // pixels - adjust this to control how "local" the threshold is
    const halfWindow = windowSize / 2

    // Count events within the window
    const eventsInWindow = allVisibleEvents.filter(
      (event) => Math.abs(event.x - x) <= halfWindow
    )

    // Calculate local density
    const localDensity = eventsInWindow.length / windowSize
    const maxDensity = 0.15 // raise to allow more; at this density the threshold will be maxed out

    // Get threshold (0-10) from local density
    return remap(localDensity, 0, maxDensity, 0, 10)
  }

  // Push up (in Y) events when 2 or 3 are close, with no others nearby on the left.
  function pushClustersForVisibility(eventStore: RangeQueryableEvents) {
    const clusterMaxLength = 4
    const eventXSize = 16
    const clusterXSize = eventXSize * 2
    const pushYAmount = 8
    const clusterLeftMargin = eventXSize * 1.75
    const clusterVerbose: number | false = false // set to a number to log at that event (zero-based from oldest)
    if (clusterVerbose)
      console.log(`pushY: checking ${eventStore.events.length} events`)

    // preallocate to avoid repeated allocations
    let cluster: Readonly<VisibleEvent>[] = []

    for (let i = 0; i < eventStore.events.length; i++) {
      const event = eventStore.events[i]
      eventStore.queryRangeInto(
        event.x - clusterXSize / 2,
        event.x + clusterXSize / 2,
        cluster
      )
      // keep adding events to the right, if within eventXSize. This
      // prevents thinking the left event is in a cluster but the
      // right ones not.
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
      // Same to the left
      while (true) {
        const clusterStartX = cluster[0].x
        const i = eventStore.findIndex(cluster[0])
        if (i > 0 && clusterStartX - eventStore.events[i - 1].x < eventXSize) {
          cluster.unshift(eventStore.events[i - 1]) // add at start
        } else {
          break
        }
      }

      if (cluster.length > clusterMaxLength || cluster.length <= 1) {
        // cluster is too big to push some up, or only one
        if (clusterVerbose && clusterVerbose == i)
          if (clusterVerbose == i)
            console.log(
              `pushY: ${i} is in cluster of ${cluster.length}, too big or too small`
            )
        continue
      }
      const leftmostIndex = eventStore.findIndex(cluster[0])
      const hasLeftMarginFree =
        leftmostIndex == 0 ||
        eventStore.events[leftmostIndex! - 1].x + clusterLeftMargin <
          cluster[0].x
      if (!hasLeftMarginFree) {
        if (clusterVerbose && clusterVerbose == i)
          console.log(
            `pushY: ${i} has no free left margin (cluster left=${cluster[0].x}, prev=${eventStore.events[leftmostIndex! - 1].x}), skipping`
          )
        continue
      }
      // We're in a pushable cluster
      const clusterIndex = cluster.findIndex((v) => v === event) // which one are we (0..clusterMaxLength-1)
      // Scale y by min dist for all cluster elements
      let minDist = Infinity
      for (let i = 1; i < cluster.length; i++) {
        minDist = Math.min(minDist, cluster[i].x - cluster[i - 1].x)
      }

      if (clusterIndex >= 0) {
        if (clusterIndex < cluster.length - 1) {
          const n = cluster.length - 1 - clusterIndex
          // const dx = cluster[clusterIndex+1].x - event.x
          const yScale = rescaleClamp(minDist, eventXSize / 2, eventXSize, 1, 0)
          if (clusterVerbose && clusterVerbose == i)
            console.log(
              `pushY: ${i} in cluster! clusterIndex ${clusterIndex} of ${cluster.length}, yScale=${yScale.toFixed(3)} from dist ${minDist.toFixed(3)} (evt: ${event.event.name.substring(0, 30)})`
            )
          event.y = yScale * (n * pushYAmount)
        } else {
          if (clusterVerbose && clusterVerbose == i)
            console.log(
              `pushY: ${i} is last in cluster! clusterIndex ${clusterIndex} of ${cluster.length} (evt: ${event.event.name.substring(0, 30)})`
            )
        }
      }
    }
  }

  // Draw events if they're in range
  function drawEvents(
    container = eventsContainer,
    currentAxisPosition = axis_position
  ) {
    container.node()!.innerHTML = '' // clear (this is quick)

    // First pass: collect all selected visible events with their positions
    let visibleEvents: VisibleEvent[] = []
    allEvents.forEach((event) => {
      if (
        timeline.isTimeInRange(event.date) &&
        event.categories.some((cat) => selectedCategories.has(cat))
      ) {
        const x = timeline.getPixelPosition(event.date)
        visibleEvents.push({ x, y: 0, event })
      }
    })

    const eventStore = new RangeQueryableEvents()
    eventStore.addAll(visibleEvents)

    pushClustersForVisibility(eventStore)

    // Draw in significance order, highest last so they show up on top
    const sortedVisibleEvents = visibleEvents.sort((a, b) => {
      return a.event.significance - b.event.significance
    })

    sortedVisibleEvents.forEach(({ x, y, event }) => {
      const eventGroup = container
        .append('g')
        .attr('class', 'event-marker')
        .attr('transform', `translate(${x}, ${currentAxisPosition})`)
        .style('pointer-events', 'none') // Don't block mouse events

      // Calculate local opacity based on local significance threshold
      const localThreshold = getLocalSignificanceThreshold(x, visibleEvents)
      const opacity = getOpacity(event.significance, localThreshold)
      // console.log(`Event at ${x.toFixed(0)}: ${event.name.substring(0, 20)}, sig ${event.significance}: threshold ${localThreshold.toFixed(1)}, opacity ${opacity.toFixed(2)}`)

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
      const textGroup = eventGroup
        .append('g')
        .attr('class', 'text-pair')
        .attr('transform', `translate(0, ${-y})`)
      // shadow
      if (opacity > 0.2) {
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
      }
      if (opacity > 0.7) {
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
      }
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
      // vline for pushed events
      if (y > 0) {
        textGroup
          .append('line')
          .attr('x1', 0)
          .attr('y1', -5.5)
          .attr('x2', 0)
          .attr('y2', -5.5 + y)
          .attr('stroke', '#fff')
          .attr('opacity', opacity)
          .attr('stroke-width', 1)
      }
    })
  }

  // Function to handle full redraw (used for zoom, pan, and auto-update)
  function redrawTimeline() {
    updateTimeLabels()
    drawTicks(ticksContainer)
    drawEvents(eventsContainer, axis_position)
  }

  // Animation function for smooth panning
  function animatePanTo(
    targetTime: DeepTime,
    targetPixel: number,
    duration: number = 200
  ) {
    // Cancel any existing animation
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    const startTimestamp = performance.now()
    const initialLeftTime = timeline.leftmost
    const initialRightTime = timeline.rightmost

    // Calculate what the final timeline state should be
    const tempTimeline = new LogTimeline(
      timeline.pixelWidth,
      initialLeftTime,
      initialRightTime
    )
    tempTimeline.panToPosition(targetTime, targetPixel)
    const finalLeftTime = tempTimeline.leftmost
    const finalRightTime = tempTimeline.rightmost

    function animate() {
      const currentTime = performance.now()
      const elapsed = currentTime - startTimestamp
      const progress = Math.min(elapsed / duration, 1)

      // Ease out for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3)

      // Interpolate between initial and final timeline states
      const leftMinutes =
        initialLeftTime.minutesSince1970 +
        (finalLeftTime.minutesSince1970 - initialLeftTime.minutesSince1970) *
          eased
      const rightMinutes =
        initialRightTime.minutesSince1970 +
        (finalRightTime.minutesSince1970 - initialRightTime.minutesSince1970) *
          eased

      timeline.setEndpoints(
        { minutesSinceEpoch: leftMinutes },
        { minutesSinceEpoch: rightMinutes }
      )
      redrawTimeline()

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        animationId = null
      }
    }

    animationId = requestAnimationFrame(animate)
  }

  // Function to handle event updates
  function handleEventUpdate() {
    allEvents = [...baseEvents, ...additionalEvents]
    allEvents.push({
      name: 'You started this app',
      date: appStartTime,
      categories: ['personal', 'news'],
      significance: 10
    })
    // Clear events and redraw
    drawEvents(eventsContainer) // Redraw events with new data
    console.log(
      `Updated timeline with ${allEvents.length} events (${baseEvents.length} base + ${additionalEvents.length} additional)`
    )
  }

  // Function to handle base events update
  function handleBaseEventsUpdate(newBaseEvents: Event[]) {
    console.log(
      `File watcher detected change: ${newBaseEvents.length} base events`
    )
    baseEvents = newBaseEvents
    handleEventUpdate()
  }

  // Function to handle additional events from API
  function handleAdditionalEvents(newAdditionalEvents: Event[]) {
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
        // Update the right edge, if it's close to now
        if (
          Math.abs(
            timeline.reftime.minutesSince1970 -
              timeline.rightmost.minutesSince1970
          ) < 2
        )
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
  drawTicks(ticksContainer)

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

          // Set up periodic API updates (every 15 minutes)
          // This will go past my free account limit quickly if this gets popular
          // This does one update immediately
          const eventUpdater = new EventUpdater(
            apiUrl,
            handleAdditionalEvents,
            15 * 60 * 1000 // in msec
          )
          eventUpdater.start()

          // Set up file watcher for events.json
          const fileWatcher = new EventFileWatcher(
            handleBaseEventsUpdate,
            1 * 60 * 1000 // check every minute. Don't overload the server.
          )
          fileWatcher.start()

          // Clean up on page unload
          window.addEventListener('beforeunload', () => {
            eventUpdater.stop()
            fileWatcher.stop()
            stopAutoUpdate()
            // Clean up event listeners
            window.removeEventListener('resize', resizeHandler)
            document.removeEventListener('keydown', keydownHandler)
          })

          // Don't update while hidden
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              eventUpdater.stop()
              fileWatcher.stop()
            } else {
              eventUpdater.start()
              fileWatcher.start()
            }
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
  let startTime: DeepTime | null = null
  let lastTouchDistance = 0
  let animationId: number | null = null

  function setHoverInfoTime(hoverInfo: HTMLElement | null, time: DeepTime) {
    if (hoverInfo) {
      const posText = width > 400 ? 'Position: ' : ''
      if (time.year > -1e5)
        hoverInfo.textContent =
          `${posText}${time.toRelativeString()} ` +
          `(${time
            .toLocaleString()
            .replace(/AD/, 'CE')
            .replace(/BC(?!E)/, 'BCE')})`
      else hoverInfo.textContent = `${posText}${time.toRelativeString()}`
    }
  }

  // Update hover info text and guide line
  function updateHoverInfo(x: number | null) {
    if (x === null) {
      hoverLine.attr('opacity', 0) // hide hover line
      const hoverInfo = document.getElementById('hover-info')
      if (hoverInfo) hoverInfo.textContent = ''
    } else {
      // Update hover line position
      const lineElement = hoverLine.node() as SVGLineElement
      const xpos = x.toString()
      const currentOpacity = lineElement.getAttribute('opacity')
      if (currentOpacity != '0.5') lineElement.setAttribute('opacity', '0.5')
      lineElement.setAttribute('x1', xpos)
      lineElement.setAttribute('x2', xpos)
      // hoverLine.attr('opacity', 0.5).attr('x1', x).attr('x2', x)

      // Update hover info
      const time = timeline.getTimeAtPixel(x)
      const hoverInfo = document.getElementById('hover-info')
      setHoverInfoTime(hoverInfo, time)
    }
  }

  // Attach all event handlers
  function attachEventHandlers() {
    // Attach mouse events to the svg
    const parent = svg
    parent
      .on('mouseenter', function (event) {
        const [x, y] = d3.pointer(event)
        updateHoverInfo(x)
      })
      .on('mousemove', function (event) {
        const [x, y] = d3.pointer(event)
        updateHoverInfo(x)
        // Handle panning
        if (isPanning && startTime) {
          // We want the time startTime to follow the mouse to x
          timeline.panToPosition(startTime, x)
          redrawTimeline()
        }
      })
      .on('mouseleave', function () {
        updateHoverInfo(null)
        const hoverInfo = document.getElementById('hover-info')
        if (hoverInfo) {
          hoverInfo.textContent = ''
        }
        isPanning = false
        startTime = null
        parent.style('cursor', 'grab')
      })
      .on('mousedown', function (event) {
        isPanning = true
        const [x] = d3.pointer(event)
        updateHoverInfo(x)
        startTime = timeline.getTimeAtPixel(x)
        parent.style('cursor', 'grabbing')
      })
      .on('mouseup', function () {
        isPanning = false
        startTime = null
        parent.style('cursor', 'grab')
      })

    // Add mouse wheel zoom functionality
    parent.on('wheel', function (event) {
      event.preventDefault()

      const [x, y] = d3.pointer(event)
      const deltaX = event.deltaX
      const deltaY = event.deltaY
      const isZoom = Math.abs(deltaY) > Math.abs(deltaX)

      if (isZoom) {
        // Cancel any existing pan animation for zoom
        if (animationId) {
          cancelAnimationFrame(animationId)
          animationId = null
        }

        // Calculate zoom factor
        // Negative deltaY = scroll up = zoom in
        // Positive deltaY = scroll down = zoom out
        const zoomSpeed = 0.002
        const factor = Math.exp(-deltaY * zoomSpeed)

        // Zoom around the mouse position
        timeline.zoomAroundPixel(factor, x)
        redrawTimeline()
        updateHoverInfo(null)
      } else {
        // Pan - check if we should animate
        const targetTime = timeline.getTimeAtPixel(x - deltaX)
        const currentTime = timeline.getTimeAtPixel(x)

        // Calculate pan distance in pixels
        const panDistance = Math.abs(deltaX)
        const animationThreshold = 50 // pixels - animate pans larger than this

        if (panDistance > animationThreshold) {
          // Large pan - animate it
          animatePanTo(targetTime, x, 100) // 150ms duration for responsiveness
        } else {
          // Small pan - immediate
          if (animationId) {
            cancelAnimationFrame(animationId)
            animationId = null
          }
          timeline.panToPosition(targetTime, x)
          redrawTimeline()
        }
      }
    })

    // Add touch events to the svg
    parent
      .on('touchstart', function (event) {
        event.preventDefault()
        const touches = event.touches

        if (touches.length === 1) {
          // Single touch - start panning
          isPanning = true
          const [x] = getTouchCenter(touches)
          startTime = timeline.getTimeAtPixel(x)
          parent.style('cursor', 'grabbing')
          updateHoverInfo(x)
        } else if (touches.length === 2) {
          // Two touches - prepare for zoom
          isPanning = false
          lastTouchDistance = getTouchDistance(touches)
          const [x] = getTouchCenter(touches)
          updateHoverInfo(null)
        }
      })
      .on('touchmove', function (event) {
        event.preventDefault()
        const touches = event.touches

        if (touches.length === 1 && isPanning && startTime) {
          // Single touch - pan
          const [x] = getTouchCenter(touches)
          updateHoverInfo(x)

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
            updateHoverInfo(null)
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
          lastTouchDistance = 0
          parent.style('cursor', 'grab')
        } else if (touches.length === 1 && lastTouchDistance > 0) {
          // Went from two touches to one - restart single touch mode
          isPanning = true
          const [x] = getTouchCenter(touches)
          startTime = timeline.getTimeAtPixel(x)
          lastTouchDistance = 0

          // Show hover line
          updateHoverInfo(x)
        }
      })
  }

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
      const rect = (svg.node() as Element).getBoundingClientRect()
      return [touches[0].clientX - rect.left, touches[0].clientY - rect.top]
    }
    const touch1 = touches[0]
    const touch2 = touches[1]
    const rect = (svg.node() as Element).getBoundingClientRect()
    return [
      (touch1.clientX + touch2.clientX) / 2 - rect.left,
      (touch1.clientY + touch2.clientY) / 2 - rect.top
    ]
  }

  // Attach all event handlers initially
  attachEventHandlers()

  // Key navigation -- global
  const KEY_PAN_DX = 10
  const KEY_ZOOM_DZ = 1.05
  function keydownHandler(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      const x = timeline.pixelWidth / 2
      const t = timeline.getTimeAtPixel(x)
      timeline.panToPosition(t, x + KEY_PAN_DX)
      redrawTimeline()
    }
    if (e.key === 'ArrowRight') {
      const x = timeline.pixelWidth / 2
      const t = timeline.getTimeAtPixel(x)
      timeline.panToPosition(t, x - KEY_PAN_DX)
      redrawTimeline()
    }
    if (e.key === 'ArrowUp') {
      timeline.zoomAroundPixel(KEY_ZOOM_DZ, width / 2)
      redrawTimeline()
    }
    if (e.key === 'ArrowDown') {
      timeline.zoomAroundPixel(1 / KEY_ZOOM_DZ, width / 2)
      redrawTimeline()
    }
  }

  document.addEventListener('keydown', keydownHandler)

  // Handle window resize with debounce
  let resizeTimeout: number | null = null
  function resizeHandler() {
    // Clear any existing timeout
    if (resizeTimeout) {
      window.clearTimeout(resizeTimeout)
    }

    // Resize after letting things settle
    resizeTimeout = window.setTimeout(() => {
      // Get the actual available space accounting for padding
      const {
        width: newWidth,
        height: newHeight,
        axis_position: newAxisPosition,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom
      } = getContainerDimensions(container)

      const containerRect = container.getBoundingClientRect()

      // Update SVG dimensions, timeline width, other elements
      svg.attr('width', newWidth).attr('height', newHeight)
      timeline.pixelWidth = newWidth
      axisGroup.attr('transform', `translate(0, ${newAxisPosition})`)
      axisGroup.select('line.main-axis-line').attr('x2', newWidth)
      hoverLine.attr('y2', newHeight)

      width = newWidth
      height = newHeight
      axis_position = newAxisPosition

      // Redraw with the new dimensions
      redrawTimeline()

      resizeTimeout = null
    }, 50) // delay to ensure DOM has updated
  }

  window.addEventListener('resize', resizeHandler)

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
      updateHoverInfo(null)
    })
  })

  // Add click handler for right time indicator to reset to now
  const rightTimeIndicator = document.getElementById('right-time')
  if (rightTimeIndicator) {
    rightTimeIndicator.addEventListener('click', () => {
      if (timeline.resetRightmostToNow()) {
        redrawTimeline()
        updateHoverInfo(null)
      }
    })
  }
}
