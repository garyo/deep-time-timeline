// gesture-interface.ts - Touchless gesture control via Server-Sent Events
import type { LogTimeline } from './log-timeline.ts'

export interface GestureData {
  type: 'pan' | 'zoom' | 'idle'
  // Pan gesture
  deltaX?: number // pixels/second horizontal movement
  deltaY?: number // pixels/second vertical movement (ignored for now)
  // Zoom gesture
  scaleFactor?: number // 1.0 = no change, >1.0 = zoom in, <1.0 = zoom out
  // Metadata
  confidence: number // 0-1, how confident the recognizer is
  timestamp: number
}

export interface GestureConfig {
  sseUrl: string
  sensitivity: {
    pan: number
    zoom: number
  }
  deadZones: {
    pan: number // minimum velocity to register
    zoom: number // minimum scale change to register
  }
  smoothing: {
    bufferSize: number
    confidenceThreshold: number
  }
  reconnect: {
    enabled: boolean
    maxAttempts: number
    baseDelay: number // ms
  }
}

const defaultGestureConfig: GestureConfig = {
  sseUrl: 'http://localhost:8080/gestures/stream',
  sensitivity: { pan: 1, zoom: 10.0 }, // Much more sensitive for testing
  deadZones: { pan: 0.01, zoom: 0.001 }, // Much lower dead zones for testing
  smoothing: { bufferSize: 3, confidenceThreshold: 0.5 }, // Less smoothing, lower confidence threshold
  reconnect: { enabled: true, maxAttempts: 5, baseDelay: 1000 }
}

export class GestureController {
  private eventSource?: EventSource
  private timeline: LogTimeline
  private config: GestureConfig
  private isActive = false

  // Connection state
  private connectionState:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'error' = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimeoutId?: number

  // Smoothing buffers
  private panBuffer: number[] = []
  private zoomBuffer: number[] = []

  // State tracking for gesture continuation
  private lastPanTime = 0
  private lastZoomTime = 0
  private idleTimeout = 2000 // ms before considering gesture stopped

  constructor(timeline: LogTimeline, config: Partial<GestureConfig> = {}) {
    this.timeline = timeline
    this.config = { ...defaultGestureConfig, ...config }
  }

  async start(): Promise<void> {
    if (this.isActive) {
      return
    }
    this.isActive = true

    const connectionId = Math.random().toString(36).substr(2, 6)
    console.log(`Starting gesture interface [${connectionId}]...`)
    // console.log('🔧 Gesture config:', this.config)
    this.connect()
  }

  stop(): void {
    if (!this.isActive) return
    this.isActive = false

    this.disconnect()
    this.clearReconnectTimeout()
  }

  getConnectionState(): string {
    return this.connectionState
  }

  isConnected(): boolean {
    return this.connectionState === 'connected'
  }

  private connect(): void {
    if (!this.isActive) return

    this.connectionState = 'connecting'
    console.log('Gesture: attempting to connect to:', this.config.sseUrl)

    try {
      // Create EventSource connection
      this.eventSource = new EventSource(this.config.sseUrl)

      this.eventSource.onopen = () => {
        console.log('✅ Gesture stream connected successfully!')
        this.connectionState = 'connected'
        this.reconnectAttempts = 0
        this.clearReconnectTimeout()
      }

      this.eventSource.onmessage = (event) => {
        // console.log('📦 Raw SSE message received:', event.data)
        try {
          const gesture: GestureData = JSON.parse(event.data)
          //console.log('📋 Parsed gesture successfully:', gesture)
          this.processGesture(gesture)
        } catch (error) {
          console.warn(
            '❌ Failed to parse gesture data:',
            error,
            'Raw data:',
            event.data
          )
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('🚨 Gesture stream error details:', {
          error,
          readyState: this.eventSource?.readyState,
          url: this.config.sseUrl,
          eventSourceStates: {
            CONNECTING: 0,
            OPEN: 1,
            CLOSED: 2
          },
          currentState:
            this.eventSource?.readyState === 0
              ? 'CONNECTING'
              : this.eventSource?.readyState === 1
                ? 'OPEN'
                : this.eventSource?.readyState === 2
                  ? 'CLOSED'
                  : 'UNKNOWN'
        })
        this.connectionState = 'error'

        // EventSource will try to reconnect automatically, but we want
        // to handle our own reconnection logic with backoff
        this.disconnect()

        if (this.isActive && this.config.reconnect.enabled) {
          this.scheduleReconnect()
        }
      }
    } catch (error) {
      console.error('❌ Failed to create gesture EventSource:', error)
      this.connectionState = 'error'

      if (this.isActive && this.config.reconnect.enabled) {
        this.scheduleReconnect()
      }
    }
  }

  private disconnect(): void {
    if (this.eventSource) {
      console.log(
        '🔌 Disconnecting EventSource (readyState:',
        this.eventSource.readyState,
        ')'
      )
      this.eventSource.close()
      this.eventSource = undefined
    }
    this.connectionState = 'disconnected'
  }

  private scheduleReconnect(): void {
    if (
      !this.config.reconnect.enabled ||
      this.reconnectAttempts >= this.config.reconnect.maxAttempts
    ) {
      console.warn(
        `Gesture reconnection disabled or max attempts (${this.config.reconnect.maxAttempts}) reached`
      )
      return
    }

    this.reconnectAttempts++

    // Exponential backoff
    const delay =
      this.config.reconnect.baseDelay * Math.pow(2, this.reconnectAttempts - 1)

    // console.log(
    //   `Reconnecting gesture stream in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.reconnect.maxAttempts})`
    // )

    this.reconnectTimeoutId = window.setTimeout(() => {
      if (this.isActive) {
        this.connect()
      }
    }, delay)
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = undefined
    }
  }

  private processGesture(gesture: GestureData): void {
    const now = Date.now()

    // Debug: Log all received gestures
    if (gesture.type != 'idle') {
      console.log('🎯 Received gesture:', {
        type: gesture.type,
        deltaX: gesture.deltaX,
        scaleFactor: gesture.scaleFactor,
        confidence: gesture.confidence.toFixed(3)
      })
    }

    // Filter out low-confidence gestures
    if (gesture.confidence < this.config.smoothing.confidenceThreshold) {
      console.log(
        '❌ Gesture rejected: low confidence',
        gesture.confidence,
        '<',
        this.config.smoothing.confidenceThreshold
      )
      return
    }

    switch (gesture.type) {
      case 'pan':
        this.handlePan(gesture, now)
        break
      case 'zoom':
        this.handleZoom(gesture, now)
        break
      case 'idle':
        // Maybe show UI feedback in the future
        break
    }
  }

  private handlePan(gesture: GestureData, now: number): void {
    if (gesture.deltaX === undefined) return

    // Smooth the pan gestures using a rolling buffer
    this.panBuffer.push(gesture.deltaX)
    if (this.panBuffer.length > this.config.smoothing.bufferSize) {
      this.panBuffer.shift()
    }

    const smoothedPan =
      this.panBuffer.reduce((a, b) => a + b, 0) / this.panBuffer.length

    // Convert gesture to timeline movement
    // Negative deltaX = hand moving left = pan timeline right (go back in time)?
    const scaledPan = -smoothedPan * this.config.sensitivity.pan

    console.log('📱 Pan processing:', {
      rawDeltaX: gesture.deltaX.toFixed(2),
      smoothed: smoothedPan.toFixed(2),
      scaled: scaledPan.toFixed(2),
      deadZone: this.config.deadZones.pan,
      willPan: Math.abs(scaledPan) > this.config.deadZones.pan
    })

    // Apply dead zone to prevent jitter
    if (Math.abs(scaledPan) > this.config.deadZones.pan) {
      // For now, we'll implement this as a direct pan rather than velocity
      // You might want to add a panByVelocity method to LogTimeline
      const pixelDelta = scaledPan
      this.timeline.shiftPixels(pixelDelta)
      this.lastPanTime = now
      console.log(
        `✅ PANNING timeline by ${pixelDelta.toFixed(2)} pixels; now rightmost=${this.timeline.rightmost.toString()}`
      )
    } else {
      console.log('🚫 Pan blocked by dead zone')
    }
  }

  private handleZoom(gesture: GestureData, now: number): void {
    if (gesture.scaleFactor === undefined) return

    // Smooth the zoom factor using a rolling buffer
    this.zoomBuffer.push(gesture.scaleFactor)
    if (this.zoomBuffer.length > this.config.smoothing.bufferSize) {
      this.zoomBuffer.shift()
    }

    const smoothedScale =
      this.zoomBuffer.reduce((a, b) => a + b, 0) / this.zoomBuffer.length

    // Convert to zoom amount (dead zone around 1.0)
    const zoomDelta = smoothedScale - 1.0

    console.log('🔍 Zoom processing:', {
      rawScaleFactor: gesture.scaleFactor.toFixed(3),
      smoothedScale: smoothedScale.toFixed(3),
      zoomDelta: zoomDelta.toFixed(3),
      deadZone: this.config.deadZones.zoom,
      willZoom: Math.abs(zoomDelta) > this.config.deadZones.zoom
    })

    // Apply dead zone
    if (Math.abs(zoomDelta) > this.config.deadZones.zoom) {
      // Zoom around center of screen
      const centerTime = this.timeline.getTimeAtPixel(
        this.timeline.pixelWidth / 2
      )
      const zoomFactor = 1 + zoomDelta * this.config.sensitivity.zoom
      console.log(
        `✅ ZOOMING timeline by factor ${zoomFactor.toFixed(3)}, around ${centerTime}`
      )
      this.timeline.zoomAroundTime(zoomFactor, centerTime)
      this.lastZoomTime = now
    } else {
      console.log('🚫 Zoom blocked by dead zone')
    }
  }

  // Public method to update configuration
  updateConfig(newConfig: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Public method to get current status
  getStatus() {
    return {
      isActive: this.isActive,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      isConnected: this.isConnected(),
      config: this.config
    }
  }
}
