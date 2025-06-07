#!/usr/bin/env bun
/**
 * Robust demo gesture server - handles EventSource reconnections gracefully
 * TypeScript version for Bun runtime
 *
 * Run with: bun demo-gesture-server-robust.ts
 */

import type { Server, ServerWebSocket } from 'bun'

interface GestureData {
  type: 'pan' | 'zoom' | 'idle'
  deltaX?: number
  scaleFactor?: number
  confidence: number
  timestamp: number
}

interface ClientInfo {
  id: number
  remoteAddress: string
  intervalId?: Timer
  writer?: WritableStreamDefaultWriter
  controller?: AbortController
  isActive: boolean
  isClosed: boolean
}

class GestureGenerator {
  private currentGesture: 'pan' | 'zoom' | null = null
  private gestureDuration = 0
  private remainingDuration = 0
  private lastUpdate = Date.now()

  private panDirection = 1
  private panSpeed = 5
  private zoomDirection = 1
  private zoomIntensity = 0.05
  // Overall scale for generated events
  private panScale = 0.1
  private zoomScale = 0.1

  getNextGesture(): GestureData {
    const now = Date.now()
    const dt = (now - this.lastUpdate) / 1000
    this.lastUpdate = now

    this.remainingDuration -= dt

    if (this.remainingDuration <= 0) {
      if (Math.random() < 0.7) {
        this.startNewGesture()
      } else {
        // idle sometimes
        this.currentGesture = null
        this.remainingDuration = 1 + Math.random() * 2
      }
    }

    if (this.currentGesture === null) {
      return this.createGestureData('idle')
    } else if (this.currentGesture === 'pan') {
      return this.generatePanGesture()
    } else if (this.currentGesture === 'zoom') {
      return this.generateZoomGesture()
    } else {
      return this.createGestureData('idle')
    }
  }

  private startNewGesture(): void {
    if (Math.random() < 0.7) {
      this.currentGesture = 'pan'
      this.gestureDuration = 2 + Math.random() * 3
      this.panDirection = Math.random() < 0.5 ? -1 : 1
      this.panSpeed = 3 + Math.random() * 9
    } else {
      this.currentGesture = 'zoom'
      this.gestureDuration = 1.5 + Math.random() * 1.5
      this.zoomDirection = Math.random() < 0.5 ? -1 : 1
      this.zoomIntensity = 0.02 + Math.random() * 0.06
    }

    this.remainingDuration = this.gestureDuration
  }

  private generatePanGesture(): GestureData {
    const speedVariation = 0.7 + Math.random() * 0.6
    let deltaX = this.panDirection * this.panSpeed * speedVariation
    deltaX += (Math.random() - 0.5) * 2 * this.panScale

    return this.createGestureData('pan', {
      deltaX,
      confidence: 0.75 + Math.random() * 0.2
    })
  }

  private generateZoomGesture(): GestureData {
    const progress = 1 - this.remainingDuration / this.gestureDuration
    const intensityCurve = 4 * progress * (1 - progress)

    const zoomAmount = this.zoomDirection * this.zoomIntensity * intensityCurve
    let scaleFactor = 1.0 + zoomAmount
    scaleFactor += (Math.random() - 0.5) * 0.02
    scaleFactor = (scaleFactor - 1) * this.zoomScale + 1

    return this.createGestureData('zoom', {
      scaleFactor,
      confidence: 0.8 + Math.random() * 0.15
    })
  }

  private createGestureData(
    type: 'pan' | 'zoom' | 'idle',
    extra: Partial<GestureData> = {}
  ): GestureData {
    return {
      type,
      confidence: extra.confidence || 0.8 + Math.random() * 0.15,
      timestamp: Date.now(),
      ...extra
    }
  }
}

class RobustGestureServer {
  private port: number
  private gestureGenerator: GestureGenerator
  private clients = new Map<number, ClientInfo>()
  private clientCounter = 0
  private server?: Server
  private isShuttingDown = false
  private eventsPerSec = 30

  constructor(port = 8080) {
    this.port = port
    this.gestureGenerator = new GestureGenerator()
  }

  start(): void {
    this.server = Bun.serve({
      port: this.port,
      fetch: (req) => this.handleRequest(req)
    })

    console.log('🖐️  Robust Demo Gesture Server Started (TypeScript + Bun)')
    console.log(`📡 Server: http://localhost:${this.port}`)
    console.log(
      `🎯 Gesture stream: http://localhost:${this.port}/gestures/stream`
    )
    console.log(`🌐 Web test: http://localhost:${this.port}`)
    console.log()
    console.log('🔧 This version handles EventSource reconnections gracefully')
    console.log('📝 TypeScript types provide better development experience')
    console.log()
    console.log('Press Ctrl+C to stop')
    console.log('-'.repeat(50))

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...')
      this.stop()
      process.exit(0)
    })

    // Periodic cleanup of dead connections
    setInterval(() => {
      this.cleanupDeadConnections()
    }, 10000) // Every 10 seconds
  }

  private stop(): void {
    this.isShuttingDown = true

    // Clear all client intervals and close connections
    for (const client of this.clients.values()) {
      this.cleanupClient(client.id)
    }
    this.clients.clear()

    if (this.server) {
      this.server.stop()
    }
  }

  private cleanupClient(clientId: number): void {
    const client = this.clients.get(clientId)
    if (!client) {
      // Client already cleaned up
      return
    }

    // Prevent double cleanup
    if (client.isClosed) {
      return
    }

    console.log(`🧹 Cleaning up client #${clientId}`)

    // Mark as inactive and closed FIRST to prevent race conditions
    client.isActive = false
    client.isClosed = true

    // Clear interval
    if (client.intervalId) {
      clearInterval(client.intervalId)
      client.intervalId = undefined
    }

    // Close writer safely - check if it's already closed
    if (client.writer) {
      try {
        // Check writer state before attempting to close
        const writer = client.writer
        client.writer = undefined // Clear reference first

        // Only close if it's not already closed
        if (writer.desiredSize !== null) {
          writer.close()
        }
      } catch (error) {
        // Ignore errors when closing already-closed writers
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.log(`   Writer close error (expected): ${errorMsg}`)
      }
    }

    // Abort controller
    if (client.controller) {
      try {
        const controller = client.controller
        client.controller = undefined // Clear reference first

        // Only abort if not already aborted
        if (!controller.signal.aborted) {
          controller.abort()
        }
      } catch (error) {
        // Ignore errors when aborting already-aborted controllers
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.log(`   Controller abort error (expected): ${errorMsg}`)
      }
    }

    // Remove from map
    this.clients.delete(clientId)
  }

  private cleanupDeadConnections(): void {
    const deadClients: number[] = []

    for (const [clientId, client] of this.clients.entries()) {
      if (!client.isActive || client.isClosed) {
        deadClients.push(clientId)
      }
    }

    if (deadClients.length > 0) {
      console.log(`🧹 Cleaning up ${deadClients.length} dead connections`)
      deadClients.forEach((clientId) => this.cleanupClient(clientId))
    }
  }

  private async handleRequest(req: Request): Promise<Response> {
    if (this.isShuttingDown) {
      return new Response('Server is shutting down', { status: 503 })
    }

    const url = new URL(req.url)
    const path = url.pathname

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders })
    }

    if (path === '/gestures/stream') {
      return this.handleGestureStream(req)
    } else if (path === '/gestures/status') {
      return this.handleStatus()
    } else if (path === '/') {
      return this.handleIndex()
    } else {
      return new Response('Not Found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }
  }

  private handleGestureStream(req: Request): Response {
    const clientId = ++this.clientCounter
    const controller = new AbortController()

    const clientInfo: ClientInfo = {
      id: clientId,
      remoteAddress:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        'unknown',
      controller,
      isActive: true,
      isClosed: false
    }

    console.log(
      `🖐️  Client #${clientId} connected (${clientInfo.remoteAddress})`
    )

    // Create SSE response with proper error handling
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    clientInfo.writer = writer

    // Handle client disconnection detection
    controller.signal.addEventListener('abort', () => {
      console.log(`📱 Client #${clientId} connection aborted`)
      clientInfo.isClosed = true
      this.cleanupClient(clientId)
    })

    // Send initial event with error handling
    this.sendSSE(
      writer,
      {
        type: 'idle',
        confidence: 1.0,
        timestamp: Date.now()
      },
      clientInfo
    ).catch(() => {
      // Client already disconnected
      clientInfo.isClosed = true
      this.cleanupClient(clientId)
    })

    // Set up streaming interval with proper error handling
    const streamInterval = setInterval(async () => {
      // Check if client is still active and not closed
      if (!clientInfo.isActive || clientInfo.isClosed || this.isShuttingDown) {
        this.cleanupClient(clientId)
        return
      }

      try {
        const gesture = this.gestureGenerator.getNextGesture()
        await this.sendSSE(writer, gesture, clientInfo)

        const verbose = false
        if (verbose) {
          // Log significant gestures only
          if (
            gesture.type === 'pan' &&
            gesture.deltaX &&
            Math.abs(gesture.deltaX) > 5
          ) {
            const direction = gesture.deltaX < 0 ? 'LEFT' : 'RIGHT'
            console.log(
              `📱 #${clientId} Pan ${direction}: ${gesture.deltaX.toFixed(1)} px/s`
            )
          } else if (
            gesture.type === 'zoom' &&
            gesture.scaleFactor &&
            Math.abs(gesture.scaleFactor - 1.0) > 0.02
          ) {
            const direction = gesture.scaleFactor > 1.0 ? 'IN' : 'OUT'
            console.log(
              `🔍 #${clientId} Zoom ${direction}: ${gesture.scaleFactor.toFixed(3)}x`
            )
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.log(
          `📱 Client #${clientId} disconnected during write: ${errorMsg}`
        )
        clientInfo.isClosed = true
        this.cleanupClient(clientId)
      }
    }, 1000 / this.eventsPerSec) // delay in msec

    // Track this client
    clientInfo.intervalId = streamInterval
    this.clients.set(clientId, clientInfo)

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Keep-Alive': 'timeout=60', // Shorter timeout to detect dead connections
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }

  private async sendSSE(
    writer: WritableStreamDefaultWriter,
    data: GestureData,
    clientInfo: ClientInfo
  ): Promise<void> {
    // Double-check if client is still active before writing
    if (clientInfo.isClosed || !clientInfo.isActive) {
      throw new Error('Client connection is closed')
    }

    try {
      const eventData = `data: ${JSON.stringify(data)}\n\n`
      await writer.write(new TextEncoder().encode(eventData))
    } catch (error) {
      // Mark client as closed and re-throw
      clientInfo.isClosed = true
      throw error
    }
  }

  private handleStatus(): Response {
    // Filter to only truly active clients
    const activeClients = Array.from(this.clients.values()).filter(
      (client) => client.isActive && !client.isClosed
    )

    const status = {
      status: 'running',
      gesture_server: 'robust-demo-typescript',
      version: '2.2',
      runtime: 'bun',
      active_clients: activeClients.length,
      total_clients_in_map: this.clients.size, // For debugging
      total_connections: this.clientCounter,
      is_shutting_down: this.isShuttingDown,
      client_details: activeClients.map((client) => ({
        id: client.id,
        remote_address: client.remoteAddress,
        is_active: client.isActive,
        is_closed: client.isClosed,
        has_interval: !!client.intervalId,
        has_writer: !!client.writer
      })),
      endpoints: {
        stream: '/gestures/stream',
        status: '/gestures/status'
      }
    }

    return new Response(JSON.stringify(status, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  private handleIndex(): Response {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Robust Gesture Server (TypeScript + Bun)</title>
    <style>
        body { font-family: monospace; max-width: 800px; margin: 40px auto; padding: 20px; background: #1a1a1a; color: #eee; }
        .status { background: #0a4; color: white; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .live-data { background: #000; color: #0f0; padding: 15px; border-radius: 4px; font-size: 12px; height: 200px; overflow-y: scroll; border: 1px solid #333; }
        .endpoint { background: #333; padding: 10px; margin: 10px 0; border-radius: 4px; }
        h1, h2 { color: #fff; }
        .tech-stack { background: #2a2a2a; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .client-info { background: #1a2a3a; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>🖐️ Robust Gesture Server</h1>
    <div class="tech-stack">⚡ TypeScript + Bun Runtime v2.2</div>
    <div class="status">✅ Server running with ${Array.from(this.clients.values()).filter((c) => c.isActive && !c.isClosed).length} active connections</div>
    <h2>Live Gesture Stream:</h2>
    <div class="live-data" id="liveData">Connecting...</div>
    <h2>Server Status:</h2>
    <div class="client-info">
        <strong>Active Clients:</strong> ${Array.from(this.clients.values()).filter((c) => c.isActive && !c.isClosed).length}<br>
        <strong>Total in Map:</strong> ${this.clients.size} (includes cleanup pending)<br>
        <strong>Total Connections:</strong> ${this.clientCounter}<br>
        <strong>Server State:</strong> ${this.isShuttingDown ? 'Shutting Down' : 'Running'}
    </div>

    <h2>Connection Info:</h2>
    <div class="endpoint">
        <strong>Stream URL:</strong> /gestures/stream<br>
        <strong>Protocol:</strong> Server-Sent Events (SSE)<br>
        <strong>Rate:</strong> ${this.eventsPerSec} events/sec<br>
        <strong>Auto-reconnect:</strong> Yes (EventSource handles this)<br>
        <strong>Runtime:</strong> Bun ${Bun.version}<br>
        <strong>Connection Timeout:</strong> 60 seconds<br>
        <strong>Cleanup Interval:</strong> 10 seconds
    </div>

    <p><strong>Timeline Usage:</strong> Set <code>gestureEnabled={true}</code> in your Timeline component</p>

    <script>
        const liveData = document.getElementById('liveData');
        let eventSource;
        let eventCount = 0;
        let reconnectCount = 0;
        let lastEventTime = Date.now();

        function connect() {
            eventSource = new EventSource('/gestures/stream');

            eventSource.onopen = function() {
                liveData.innerHTML += \`[CONNECTED] Stream \${reconnectCount ? 'reconnected' : 'started'} (Bun ${Bun.version})\\n\`;
                liveData.scrollTop = liveData.scrollHeight;
            };

            eventSource.onmessage = function(event) {
                eventCount++;
                lastEventTime = Date.now();
                const gesture = JSON.parse(event.data);
                const timestamp = new Date().toLocaleTimeString();

                let line = \`[\${timestamp}] \${gesture.type.toUpperCase()}\`;

                if (gesture.type === 'pan') {
                    const direction = gesture.deltaX < 0 ? 'LEFT' : 'RIGHT';
                    line += \` \${direction} (\${gesture.deltaX.toFixed(1)}px/s)\`;
                } else if (gesture.type === 'zoom') {
                    const direction = gesture.scaleFactor > 1.0 ? 'IN' : 'OUT';
                    line += \` \${direction} (\${gesture.scaleFactor.toFixed(3)}x)\`;
                }

                if (gesture.type !== 'idle') {
                    liveData.innerHTML += line + '\\n';
                    liveData.scrollTop = liveData.scrollHeight;

                    // Keep only last 20 lines
                    const lines = liveData.innerHTML.split('\\n');
                    if (lines.length > 25) {
                        liveData.innerHTML = lines.slice(-20).join('\\n');
                    }
                }
            };

            eventSource.onerror = function(event) {
                console.log('EventSource error, will auto-reconnect:', event);
                liveData.innerHTML += \`[ERROR] Connection lost at \${new Date().toLocaleTimeString()}, reconnecting...\\n\`;
                reconnectCount++;
            };
        }

        connect();

        // Monitor connection health
        setInterval(() => {
            const timeSinceLastEvent = Date.now() - lastEventTime;
            if (timeSinceLastEvent > 5000) { // No events for 5 seconds
                liveData.innerHTML += \`[WARNING] No events received for \${Math.round(timeSinceLastEvent/1000)}s\\n\`;
            }
        }, 10000);

        // Update title with event count
        setInterval(() => {
            document.title = \`Gesture Server (TS+Bun) (\${eventCount} events)\`;
        }, 1000);
    </script>
</body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// Start the server
const server = new RobustGestureServer(8080)
server.start()
