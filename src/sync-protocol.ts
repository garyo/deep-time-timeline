import { DeepTime } from './deep-time.ts'
import type { Theme } from './stores/theme-store.ts'
import type { TextSize } from './stores/text-size-store.ts'
import type { SyncRole } from './stores/sync-store.ts'

// Protocol version for compatibility checking
export const PROTOCOL_VERSION = 1

export type SyncMessageType =
  | 'state'
  | 'pointer'
  | 'request-state'
  | 'ping'
  | 'pong'

export interface SyncMessage {
  version: number
  type: SyncMessageType
  payload: {
    viewport?: {
      leftTime: number // Minutes since 1970
      rightTime: number // Minutes since 1970
      refTime: number // Minutes since 1970
    }
    categories?: Record<string, boolean> // Category name -> enabled
    theme?: Theme
    textSize?: TextSize
    pointer?: {
      x: number // SVG coordinate
      y: number // SVG coordinate
      time: number // DeepTime minutes since 1970
    } | null
    uiMode?: SyncRole
  }
  timestamp: number
}

// Serialize current state into a sync message
export function serializeState(
  leftmostTime: DeepTime,
  rightmostTime: DeepTime,
  refTime: DeepTime,
  categories: Set<string>,
  theme: Theme,
  textSize: TextSize,
  hoverTime: DeepTime | null,
  hoverPosition: [number, number] | null,
  uiMode: SyncRole
): SyncMessage {
  return {
    version: PROTOCOL_VERSION,
    type: 'state',
    payload: {
      viewport: {
        leftTime: leftmostTime.minutesSince1970,
        rightTime: rightmostTime.minutesSince1970,
        refTime: refTime.minutesSince1970
      },
      categories: categorySetToRecord(categories),
      theme,
      textSize,
      pointer:
        hoverTime && hoverPosition
          ? {
              x: hoverPosition[0],
              y: hoverPosition[1],
              time: hoverTime.minutesSince1970
            }
          : null,
      uiMode
    },
    timestamp: Date.now()
  }
}

// Convert Set<string> to Record<string, boolean> for serialization
function categorySetToRecord(categories: Set<string>): Record<string, boolean> {
  const record: Record<string, boolean> = {}
  categories.forEach((cat) => {
    record[cat] = true
  })
  return record
}

// Convert Record<string, boolean> back to Set<string>
export function categoryRecordToSet(
  record: Record<string, boolean>
): Set<string> {
  const set = new Set<string>()
  Object.entries(record).forEach(([cat, enabled]) => {
    if (enabled) {
      set.add(cat)
    }
  })
  return set
}

// Create a pointer-only message (lightweight, high-frequency)
export function serializePointer(
  hoverTime: DeepTime | null,
  hoverPosition: [number, number] | null
): SyncMessage {
  return {
    version: PROTOCOL_VERSION,
    type: 'pointer',
    payload: {
      pointer:
        hoverTime && hoverPosition
          ? {
              x: hoverPosition[0],
              y: hoverPosition[1],
              time: hoverTime.minutesSince1970
            }
          : null
    },
    timestamp: Date.now()
  }
}

// Validate incoming message
export function validateMessage(message: any): message is SyncMessage {
  if (!message || typeof message !== 'object') return false
  if (typeof message.version !== 'number') return false
  if (typeof message.type !== 'string') return false
  if (
    !['state', 'pointer', 'request-state', 'ping', 'pong'].includes(
      message.type
    )
  )
    return false
  if (typeof message.timestamp !== 'number') return false
  if (!message.payload || typeof message.payload !== 'object') return false

  return true
}

// Create a request-state message
export function createRequestStateMessage(): SyncMessage {
  return {
    version: PROTOCOL_VERSION,
    type: 'request-state',
    payload: {},
    timestamp: Date.now()
  }
}

// Create a ping message
export function createPingMessage(): SyncMessage {
  return {
    version: PROTOCOL_VERSION,
    type: 'ping',
    payload: {},
    timestamp: Date.now()
  }
}

// Create a pong message
export function createPongMessage(): SyncMessage {
  return {
    version: PROTOCOL_VERSION,
    type: 'pong',
    payload: {},
    timestamp: Date.now()
  }
}

// Rate limiting helper for pointer updates
export class RateLimiter {
  private lastSendTime = 0
  private minInterval: number

  constructor(updatesPerSecond: number = 30) {
    this.minInterval = 1000 / updatesPerSecond
  }

  shouldSend(): boolean {
    const now = Date.now()
    if (now - this.lastSendTime >= this.minInterval) {
      this.lastSendTime = now
      return true
    }
    return false
  }
}
