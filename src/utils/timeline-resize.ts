/**
 * Utility for updating timeline width based on current DOM dimensions
 */

import { batch } from 'solid-js'
import { globalTimeline } from '../stores/global-timeline.ts'
import { interactionActions } from '../stores/interaction-store.ts'

/**
 * Measures the current width of the timeline container and updates the timeline instance.
 * Setting pixelWidth will cause an immediate reactive redraw of the timeline.
 */
export function updateTimelineWidth(): void {
  const container = document.querySelector('.timeline-container') as HTMLElement
  const svgContainer = container?.querySelector('.svg-container') as HTMLElement

  if (!svgContainer) return

  const containerRect = svgContainer.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(svgContainer)
  const paddingLeft = parseInt(computedStyle.paddingLeft || '0', 10)
  const paddingRight = parseInt(computedStyle.paddingRight || '0', 10)
  const paddingTop = parseInt(computedStyle.paddingTop || '0', 10)
  const paddingBottom = parseInt(computedStyle.paddingBottom || '0', 10)

  const newWidth = containerRect.width - paddingLeft - paddingRight
  const newHeight = containerRect.height - paddingTop - paddingBottom

  // Access and update timeline through the store
  const currentTimeline = globalTimeline()
  if (currentTimeline && newWidth > 0) {
    batch(() => {
      currentTimeline.pixelWidth = newWidth
      interactionActions.setDimensions(newWidth, newHeight)
    })
  }
}
