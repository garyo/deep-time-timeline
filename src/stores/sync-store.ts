import { createStore } from 'solid-js/store'
import { createSignal } from 'solid-js'

export type SyncRole = 'controller' | 'display' | 'standalone'
export type SyncMethod = 'broadcast' | 'websocket' | 'none'
export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface SyncState {
  connectionState: ConnectionState
  role: SyncRole
  syncMethod: SyncMethod
  lastMessageTime: number
  messageQueue: unknown[] // Queue currently unused, type as unknown[] for future use
}

const initialSyncState: SyncState = {
  connectionState: 'disconnected',
  role: 'standalone',
  syncMethod: 'none',
  lastMessageTime: 0,
  messageQueue: []
}

export const [syncState, setSyncState] = createStore(initialSyncState)

// BroadcastChannel instance (only created when needed)
export const [broadcastChannel, setBroadcastChannel] =
  createSignal<BroadcastChannel | null>(null)

// Actions
export const syncActions = {
  setConnectionState: (state: ConnectionState) => {
    setSyncState('connectionState', state)
  },

  setRole: (role: SyncRole) => {
    setSyncState('role', role)
  },

  setSyncMethod: (method: SyncMethod) => {
    setSyncState('syncMethod', method)
  },

  updateLastMessageTime: () => {
    setSyncState('lastMessageTime', Date.now())
  },

  initBroadcastChannel: (channelName: string = 'deep-timeline-sync') => {
    if (typeof window === 'undefined') return null

    try {
      const channel = new BroadcastChannel(channelName)
      setBroadcastChannel(channel)
      syncActions.setConnectionState('connected')
      return channel
    } catch (error) {
      console.error('Failed to create BroadcastChannel:', error)
      syncActions.setConnectionState('disconnected')
      return null
    }
  },

  closeBroadcastChannel: () => {
    const channel = broadcastChannel()
    if (channel) {
      channel.close()
      setBroadcastChannel(null)
      syncActions.setConnectionState('disconnected')
    }
  }
}
