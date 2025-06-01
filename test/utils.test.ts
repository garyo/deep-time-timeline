import { describe, it, expect } from 'vitest'
import { rescale, clamp, rescaleClamp } from '../src/utils'

describe('Unit tests for rescale function', () => {
  it('should rescale correctly from range [0, 10] to [0, 100]', () => {
    expect(rescale(5, 0, 10, 0, 100)).toBe(50)
  })

  it('should rescale minimum value', () => {
    expect(rescale(0, 0, 10, 0, 100)).toBe(0)
  })

  it('should rescale maximum value', () => {
    expect(rescale(10, 0, 10, 0, 100)).toBe(100)
  })

  it('should handle negative domain', () => {
    expect(rescale(-5, -10, 0, 0, 100)).toBe(50)
  })
  it('should handle negative range', () => {
    expect(rescale(1, 0, 10, 100, 0)).toBe(90)
  })
})

describe('Unit tests for clamp function', () => {
  it('should clamp value within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('should clamp below minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('should clamp above maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('should handle inverted bounds', () => {
    expect(clamp(5, 10, 0)).toBe(5)
    expect(clamp(15, 10, 0)).toBe(10)
    expect(clamp(-5, 10, 0)).toBe(0)
  })
})

describe('Unit tests for rescaleClamp function', () => {
  it('should rescale and clamp within new bounds', () => {
    expect(rescaleClamp(5, 0, 10, 0, 100)).toBe(50)
  })

  it('should clamp output to minimum new bound', () => {
    expect(rescaleClamp(0, 0, 10, 10, 100)).toBe(10)
  })

  it('should clamp output to maximum new bound', () => {
    expect(rescaleClamp(10, 0, 10, 0, 100)).toBe(100)
  })

  it('should handle negative values and clamp', () => {
    expect(rescaleClamp(-5, -10, 0, 0, 100)).toBe(50)
    expect(rescaleClamp(-15, -10, 0, 0, 100)).toBe(0)
    expect(rescaleClamp(5, -10, 0, 0, 100)).toBe(100)
  })
  it('should handle backwards range', () => {
    expect(rescaleClamp(-5, 0, 10, 100, 0)).toBe(100)
  })
})
