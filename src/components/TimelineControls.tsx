import type { Component } from 'solid-js'
import { onMount, onCleanup } from 'solid-js'
import { globalTimeline } from '../stores/global-timeline.ts'
import { DeepTime } from '../deep-time.ts'

export const TimelineControls: Component = () => {
  let mounted = false

  const setupControlHandlers = () => {
    // Zoom In button
    const zoomInBtn = document.getElementById('zoom-in')
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', handleZoomIn)
    }

    // Zoom Out button
    const zoomOutBtn = document.getElementById('zoom-out')
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', handleZoomOut)
    }

    // Reset View button
    const resetViewBtn = document.getElementById('reset-view')
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', handleResetView)
    }

    // Preset buttons
    const presetButtons = document.querySelectorAll('.preset-button')
    presetButtons.forEach((button) => {
      button.addEventListener('click', handlePresetClick)
    })
  }

  const cleanupControlHandlers = () => {
    const zoomInBtn = document.getElementById('zoom-in')
    if (zoomInBtn) {
      zoomInBtn.removeEventListener('click', handleZoomIn)
    }

    const zoomOutBtn = document.getElementById('zoom-out')
    if (zoomOutBtn) {
      zoomOutBtn.removeEventListener('click', handleZoomOut)
    }

    const resetViewBtn = document.getElementById('reset-view')
    if (resetViewBtn) {
      resetViewBtn.removeEventListener('click', handleResetView)
    }

    const presetButtons = document.querySelectorAll('.preset-button')
    presetButtons.forEach((button) => {
      button.removeEventListener('click', handlePresetClick)
    })
  }

  const handleZoomIn = () => {
    const timeline = globalTimeline()
    if (timeline) {
      timeline.zoomAroundPixel(1.5, timeline.pixelWidth / 2)
    }
  }

  const handleZoomOut = () => {
    const timeline = globalTimeline()
    if (timeline) {
      timeline.zoomAroundPixel(1 / 1.5, timeline.pixelWidth / 2)
    }
  }

  const handleResetView = () => {
    const timeline = globalTimeline()
    if (timeline) {
      // Reset to a reasonable default range (100,000 years ago to now)
      timeline.setEndpoints(new DeepTime({ yearsAgo: 100000 }), new DeepTime())
    }
  }

  const handlePresetClick = (event: Event) => {
    const button = event.target as HTMLButtonElement
    const yearsStr = button.getAttribute('data-years')
    if (!yearsStr) return

    const years = parseInt(yearsStr, 10)
    const timeline = globalTimeline()
    if (timeline) {
      timeline.setEndpoints(new DeepTime({ yearsAgo: years }), new DeepTime())
    }
  }

  onMount(() => {
    mounted = true

    // Wait for timeline instance before setting up handlers
    const checkAndSetup = () => {
      if (globalTimeline()) {
        setupControlHandlers()
      } else {
        // Retry after a short delay if timeline isn't ready
        setTimeout(checkAndSetup, 50)
      }
    }

    checkAndSetup()
  })

  onCleanup(() => {
    mounted = false
    cleanupControlHandlers()
  })

  // This component is invisible - it just manages event handlers
  return null
}
