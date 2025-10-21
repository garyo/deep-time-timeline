import type { Component } from 'solid-js'
import { onMount, onCleanup, createEffect, batch } from 'solid-js'
import {
  syncState,
  syncActions,
  broadcastChannel,
  type SyncRole
} from '../stores/sync-store.ts'

// Sync performance configuration
export interface SyncConfig {
  /** Debounce time for viewport updates in ms */
  viewportDebounce: number
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  viewportDebounce: 50 // Batch viewport updates
}
import {
  timelineState,
  setTimelineState,
  globalTimeline
} from '../stores/global-timeline.ts'
import { eventsState, eventsActions } from '../stores/events-store.ts'
import {
  interactionState,
  interactionActions
} from '../stores/interaction-store.ts'
import { theme, themeActions } from '../stores/theme-store.ts'
import { textSize, textSizeActions } from '../stores/text-size-store.ts'
import { DeepTime } from '../deep-time.ts'
import {
  serializeState,
  serializePointer,
  validateMessage,
  createRequestStateMessage,
  categoryRecordToSet,
  type SyncMessage
} from '../sync-protocol.ts'

interface SyncManagerProps {
  role: SyncRole
  syncMethod: 'broadcast' | 'websocket' | 'none'
  config?: Partial<SyncConfig>
}

/**
 * SyncManager orchestrates state synchronization between controller and display instances.
 * This is an invisible component (returns null) that manages the sync lifecycle.
 *
 * Controller mode: Watches stores and broadcasts changes to displays
 * Display mode: Receives messages and updates local stores
 */
export const SyncManager: Component<SyncManagerProps> = (props) => {
  let cleanupFunctions: Array<() => void> = []

  // Merge user config with defaults
  const config: SyncConfig = {
    ...DEFAULT_SYNC_CONFIG,
    ...props.config
  }

  onMount(() => {
    // Set sync role and method
    syncActions.setRole(props.role)
    syncActions.setSyncMethod(props.syncMethod)

    // Only activate sync for controller or display modes
    if (props.role === 'standalone' || props.syncMethod === 'none') {
      return
    }

    // Initialize BroadcastChannel
    if (props.syncMethod === 'broadcast') {
      const channel = syncActions.initBroadcastChannel()
      if (!channel) {
        console.error('Failed to initialize BroadcastChannel')
        return
      }

      // Set up message listener
      channel.onmessage = handleMessage

      // Display mode: request initial state from controller
      if (props.role === 'display') {
        setTimeout(() => {
          channel.postMessage(createRequestStateMessage())
        }, 100) // Small delay to ensure controller is ready
      }

      // Controller mode: set up watchers to broadcast changes
      if (props.role === 'controller') {
        setupControllerWatchers(channel)
      }

      cleanupFunctions.push(() => {
        channel.onmessage = null
        syncActions.closeBroadcastChannel()
      })
    }

    // TODO: WebSocket support for Phase 3 (dual machine setup)
  })

  // Handle incoming sync messages
  function handleMessage(event: MessageEvent) {
    const message = event.data

    if (!validateMessage(message)) {
      console.warn('Invalid sync message received:', message)
      return
    }

    syncActions.updateLastMessageTime()

    // Handle different message types
    switch (message.type) {
      case 'request-state':
        handleRequestState(message)
        break
      case 'state':
        handleStateUpdate(message)
        break
      case 'pointer':
        handlePointerUpdate(message)
        break
      case 'ping':
        handlePing(message)
        break
      case 'pong':
        handlePong(message)
        break
    }
  }

  // Controller receives request-state, responds with current state
  function handleRequestState(message: SyncMessage) {
    if (props.role !== 'controller') return
    const channel = broadcastChannel()
    if (!channel) return

    const stateMessage = serializeState(
      timelineState.leftmostTime,
      timelineState.rightmostTime,
      timelineState.refTime,
      eventsState.selectedCategories,
      theme(),
      textSize(),
      interactionState.hoverTime,
      interactionState.hoverPosition,
      props.role
    )

    channel.postMessage(stateMessage)
  }

  // Display receives state updates and applies them
  function handleStateUpdate(message: SyncMessage) {
    if (props.role !== 'display') return

    const payload = message.payload

    // Check if timeline is ready and has valid dimensions before applying updates
    const timeline = globalTimeline()
    if (!timeline || timeline.pixelWidth <= 0) {
      // Timeline not ready yet, skip this update
      // (will be synced again on next update after timeline initializes)
      return
    }

    // Batch all store updates together to prevent multiple re-renders
    batch(() => {
      // Update viewport (time coordinates only - each display uses its own width)
      if (payload.viewport) {
        setTimelineState({
          leftmostTime: new DeepTime({
            minutesSinceEpoch: payload.viewport.leftTime
          }),
          rightmostTime: new DeepTime({
            minutesSinceEpoch: payload.viewport.rightTime
          }),
          refTime: new DeepTime({ minutesSinceEpoch: payload.viewport.refTime })
        })
      }

      // Update categories
      if (payload.categories) {
        const categorySet = categoryRecordToSet(payload.categories)
        eventsActions.updateSelectedCategories(categorySet)
      }

      // Update theme
      if (payload.theme) {
        themeActions.setTheme(payload.theme)
      }

      // Update text size
      if (payload.textSize) {
        textSizeActions.setTextSize(payload.textSize)
      }

      // Update pointer position
      if (payload.pointer !== undefined) {
        if (payload.pointer === null) {
          interactionActions.clearHover()

          // Clear hover info text on display
          const hoverInfo = document.getElementById('hover-info')
          if (hoverInfo) hoverInfo.textContent = ''
        } else {
          const hoverTime = new DeepTime({
            minutesSinceEpoch: payload.pointer.time
          })

          // Convert time to pixel position using THIS display's timeline width
          // Each display calculates its own pixel position from the time coordinate
          const x = timeline.getPixelPosition(hoverTime)
          interactionActions.setHover(x, 0, hoverTime)

          // Update hover info text on display
          const hoverInfo = document.getElementById('hover-info')
          if (hoverInfo) {
            const posText = timeline.pixelWidth > 400 ? 'Position: ' : ''
            if (hoverTime.year > -1e5) {
              hoverInfo.textContent =
                `${posText}${hoverTime.toRelativeString()} ` +
                `(${hoverTime
                  .toLocaleString()
                  .replace(/AD/, 'CE')
                  .replace(/BC(?!E)/, 'BCE')})`
            } else {
              hoverInfo.textContent = `${posText}${hoverTime.toRelativeString()}`
            }
          }
        }
      }
    })
  }

  // Display receives lightweight pointer-only updates
  function handlePointerUpdate(message: SyncMessage) {
    if (props.role !== 'display') return

    const payload = message.payload
    const timeline = globalTimeline()
    if (!timeline || timeline.pixelWidth <= 0) return

    // Only update pointer position (no batch needed, single update)
    if (payload.pointer !== undefined) {
      if (payload.pointer === null) {
        interactionActions.clearHover()
        const hoverInfo = document.getElementById('hover-info')
        if (hoverInfo) hoverInfo.textContent = ''
      } else {
        const hoverTime = new DeepTime({
          minutesSinceEpoch: payload.pointer.time
        })

        const x = timeline.getPixelPosition(hoverTime)
        interactionActions.setHover(x, 0, hoverTime)

        const hoverInfo = document.getElementById('hover-info')
        if (hoverInfo) {
          const posText = timeline.pixelWidth > 400 ? 'Position: ' : ''
          if (hoverTime.year > -1e5) {
            hoverInfo.textContent =
              `${posText}${hoverTime.toRelativeString()} ` +
              `(${hoverTime
                .toLocaleString()
                .replace(/AD/, 'CE')
                .replace(/BC(?!E)/, 'BCE')})`
          } else {
            hoverInfo.textContent = `${posText}${hoverTime.toRelativeString()}`
          }
        }
      }
    }
  }

  // Ping/pong for connection health monitoring
  function handlePing(message: SyncMessage) {
    const channel = broadcastChannel()
    if (channel) {
      channel.postMessage({ type: 'pong', timestamp: Date.now() })
    }
  }

  function handlePong(message: SyncMessage) {
    // Update last message time to track connection health
    syncActions.updateLastMessageTime()
  }

  // Set up watchers for controller to broadcast state changes
  function setupControllerWatchers(channel: BroadcastChannel) {
    let debounceTimeout: number | null = null
    let lastSendTime = 0

    // Watch viewport and settings changes (throttled + debounced)
    createEffect(() => {
      const left = timelineState.leftmostTime
      const right = timelineState.rightmostTime
      const ref = timelineState.refTime
      const categories = eventsState.selectedCategories
      const currentTheme = theme()
      const currentTextSize = textSize()

      // Skip if timeline not ready
      if (!left || !right || !ref) return

      const now = Date.now()
      const timeSinceLastSend = now - lastSendTime

      // Helper to send the state message
      const sendState = () => {
        const message = serializeState(
          left,
          right,
          ref,
          categories,
          currentTheme,
          currentTextSize,
          interactionState.hoverTime,
          interactionState.hoverPosition,
          props.role
        )
        channel.postMessage(message)
        lastSendTime = Date.now()
      }

      // If enough time has passed, send immediately (throttle)
      if (timeSinceLastSend >= config.viewportDebounce) {
        if (debounceTimeout) clearTimeout(debounceTimeout)
        sendState()
      } else {
        // Otherwise, debounce to batch rapid updates
        if (debounceTimeout) clearTimeout(debounceTimeout)
        debounceTimeout = window.setTimeout(() => {
          sendState()
        }, config.viewportDebounce)
      }
    })

    // Watch pointer changes separately (lightweight pointer-only messages)
    createEffect(() => {
      const hoverTime = interactionState.hoverTime
      const hoverPosition = interactionState.hoverPosition

      // Send lightweight pointer message
      const message = serializePointer(hoverTime, hoverPosition)
      channel.postMessage(message)
    })

    // Cleanup
    cleanupFunctions.push(() => {
      if (debounceTimeout) clearTimeout(debounceTimeout)
    })
  }

  onCleanup(() => {
    cleanupFunctions.forEach((cleanup) => cleanup())
    cleanupFunctions = []
  })

  // Invisible component
  return null
}
