// stores/gesture-store.ts - Solid.js integration for gesture control
import { createSignal, createEffect, onCleanup } from 'solid-js'
import { GestureController, type GestureConfig } from '../gesture-interface.ts'
import type { LogTimeline } from '../log-timeline.ts'

// Global gesture state
const [gestureController, setGestureController] =
  createSignal<GestureController | null>(null)
const [gestureEnabled, setGestureEnabled] = createSignal(false)
const [connectionState, setConnectionState] =
  createSignal<string>('disconnected')

// Create reactive store for gesture control
export const gestureStore = {
  // Getters
  get controller() {
    return gestureController()
  },
  get enabled() {
    return gestureEnabled()
  },
  get connectionState() {
    return connectionState()
  },
  get isConnected() {
    return gestureController()?.isConnected() ?? false
  },

  // Actions
  enable: () => setGestureEnabled(true),
  disable: () => setGestureEnabled(false),
  toggle: () => setGestureEnabled(!gestureEnabled())
}

// Hook to use gesture control in components
export function useGestureControl(
  timeline: () => LogTimeline | null,
  enabled: () => boolean = gestureEnabled,
  config?: Partial<GestureConfig>
) {
  let controller: GestureController | null = null

  createEffect(() => {
    const timelineInstance = timeline()
    const isEnabled = enabled()

    if (timelineInstance && isEnabled && !controller) {
      // Create and start gesture controller
      console.log('Creating gesture controller with config:', config)
      controller = new GestureController(timelineInstance, config)
      controller.start()
      setGestureController(controller)

      // Update connection state periodically
      const statusInterval = setInterval(() => {
        if (controller) {
          const newState = controller.getConnectionState()
          setConnectionState(newState)
          // console.log('📊 Gesture status update:', {
          //   connectionState: newState,
          //   isConnected: controller.isConnected(),
          //   fullStatus: controller.getStatus()
          // })
        }
      }, 2000) // Every 2 seconds

      onCleanup(() => {
        clearInterval(statusInterval)
      })
    } else if ((!timelineInstance || !isEnabled) && controller) {
      // Stop and cleanup gesture controller
      console.log('Stopping gesture controller')
      controller.stop()
      controller = null
      setGestureController(null)
      setConnectionState('disconnected')
    }
  })

  // Cleanup on component unmount
  onCleanup(() => {
    if (controller) {
      controller.stop()
      controller = null
      setGestureController(null)
    }
  })

  return {
    controller: gestureController,
    connectionState,
    isConnected: () => gestureController()?.isConnected() ?? false,
    status: () => gestureController()?.getStatus() ?? null
  }
}

// Optional: Museum mode configuration
export const museumModeConfig: Partial<GestureConfig> = {
  sseUrl: 'http://localhost:8080/gestures/stream',
  sensitivity: {
    pan: 0.15, // Slightly more sensitive for museum use
    zoom: 0.08 // Gentler zoom for public use
  },
  deadZones: {
    pan: 0.3, // Lower dead zone for responsiveness
    zoom: 0.03 // Lower dead zone for zoom
  },
  smoothing: {
    bufferSize: 7, // More smoothing for stability
    confidenceThreshold: 0.8 // Higher confidence for public use
  },
  reconnect: {
    enabled: true,
    maxAttempts: 10, // More persistent for museum reliability
    baseDelay: 2000 // Longer delays for stability
  }
}
