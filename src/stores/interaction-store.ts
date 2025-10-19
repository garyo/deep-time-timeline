import { createStore } from 'solid-js/store'
import { DeepTime } from '../deep-time.ts'

export interface InteractionState {
  isPanning: boolean
  isZooming: boolean
  startTime: DeepTime | null
  lastTouchDistance: number
  hoverPosition: [number, number] | null
  hoverTime: DeepTime | null
  animationId: number | null
  dimensions: {
    width: number
    height: number
    axisPosition: number
  }
}

const initialInteractionState: InteractionState = {
  isPanning: false,
  isZooming: false,
  startTime: null,
  lastTouchDistance: 0,
  hoverPosition: null,
  hoverTime: null,
  animationId: null,
  dimensions: {
    width: 800,
    height: 600,
    axisPosition: 360
  }
}

export const [interactionState, setInteractionState] = createStore(
  initialInteractionState
)

export const interactionActions = {
  setDimensions: (width: number, height: number) => {
    setInteractionState('dimensions', {
      width,
      height,
      axisPosition: Math.min(height * 0.7, height - 80)
    })
  },

  startPanning: (startTime: DeepTime) => {
    setInteractionState('isPanning', true)
    setInteractionState('startTime', startTime)
  },

  stopPanning: () => {
    setInteractionState('isPanning', false)
    setInteractionState('startTime', null)
  },

  setHover: (x: number, y: number, time: DeepTime) => {
    setInteractionState('hoverPosition', [x, y])
    setInteractionState('hoverTime', time)
  },

  clearHover: () => {
    setInteractionState('hoverPosition', null)
    setInteractionState('hoverTime', null)
  },

  setTouchDistance: (distance: number) => {
    setInteractionState('lastTouchDistance', distance)
  },

  setAnimationId: (id: number | null) => {
    setInteractionState('animationId', id)
  }
}
