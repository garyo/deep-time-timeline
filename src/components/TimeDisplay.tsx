import type { Component, Accessor } from 'solid-js'
import { DeepTime } from '../deep-time.ts'
import styles from './TimeDisplay.module.css'

interface TimeDisplayProps {
  timeSignal: Accessor<DeepTime | undefined>
  position: 'left' | 'right'
  onRightClick?: () => void
}

export const TimeDisplay: Component<TimeDisplayProps> = (props) => {
  const getDisplayText = () => {
    const time = props.timeSignal()
    if (!time) return 'Loading...'
    return time.toRelativeString()
  }

  const handleClick = () => {
    if (props.position === 'right' && props.onRightClick) {
      props.onRightClick()
    }
  }

  return (
    <div
      class={`${styles.timeDisplay} ${styles[props.position]}`}
      onClick={handleClick}
      title={
        props.position === 'right'
          ? 'Click to reset to current time'
          : undefined
      }
    >
      {getDisplayText()}
    </div>
  )
}
