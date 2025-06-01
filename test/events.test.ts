import { describe, it, expect, beforeEach } from 'vitest'
import { RangeQueryableEvents } from '../src/scripts/events'
import type { VisibleEvent } from '../src/scripts/events'
import { DeepTime } from '../src/deep-time'

describe('RangeQueryableEvents', () => {
  let eventStore: RangeQueryableEvents
  let sampleEvents: VisibleEvent[]

  beforeEach(() => {
    eventStore = new RangeQueryableEvents()

    // Create sample events for testing
    sampleEvents = [
      {
        x: 10,
        y: 20,
        event: { name: 'Event 1', date: new DeepTime('2020'), significance: 5 }
      },
      {
        x: 15,
        y: 25,
        event: { name: 'Event 2', date: new DeepTime('2021'), significance: 7 }
      },
      {
        x: 30,
        y: 40,
        event: { name: 'Event 3', date: new DeepTime('2022'), significance: 8 }
      },
      {
        x: 25,
        y: 35,
        event: { name: 'Event 4', date: new DeepTime('2023'), significance: 6 }
      },
      {
        x: 5,
        y: 15,
        event: { name: 'Event 5', date: new DeepTime('2019'), significance: 4 }
      }
    ]
  })

  describe('Constructor and Basic Operations', () => {
    it('should create empty event store', () => {
      expect(eventStore.events.length).toBe(0)
    })

    it('should provide read-only access to events array', () => {
      eventStore.add(sampleEvents[0])
      const events = eventStore.events
      expect(events.length).toBe(1)
      expect(events[0]).toBe(sampleEvents[0])
    })
  })

  describe('Adding Events', () => {
    it('should add single event', () => {
      eventStore.add(sampleEvents[0])
      expect(eventStore.events.length).toBe(1)
      expect(eventStore.events[0]).toBe(sampleEvents[0])
    })

    it('should maintain sorted order when adding events individually', () => {
      // Add events in random order
      eventStore.add(sampleEvents[2]) // x=30
      eventStore.add(sampleEvents[0]) // x=10
      eventStore.add(sampleEvents[1]) // x=15
      eventStore.add(sampleEvents[4]) // x=5

      const events = eventStore.events
      expect(events.length).toBe(4)
      expect(events[0].x).toBe(5)
      expect(events[1].x).toBe(10)
      expect(events[2].x).toBe(15)
      expect(events[3].x).toBe(30)
    })

    it('should handle duplicate x coordinates', () => {
      const duplicate1 = { ...sampleEvents[0], x: 10 }
      const duplicate2 = { ...sampleEvents[1], x: 10 }

      eventStore.add(duplicate1)
      eventStore.add(duplicate2)

      expect(eventStore.events.length).toBe(2)
      expect(eventStore.events[0].x).toBe(10)
      expect(eventStore.events[1].x).toBe(10)
    })

    it('should add multiple events efficiently with addAll', () => {
      eventStore.addAll(sampleEvents)

      const events = eventStore.events
      expect(events.length).toBe(5)

      // Should be sorted by x coordinate
      const xValues = events.map((e) => e.x)
      expect(xValues).toEqual([5, 10, 15, 25, 30])
    })

    it('should handle empty array in addAll', () => {
      eventStore.addAll([])
      expect(eventStore.events.length).toBe(0)
    })
  })

  describe('Find Events', () => {
    beforeEach(() => {
      eventStore.addAll(sampleEvents)
    })
    it('should find an event', () => {
      for (let i = 0; i < eventStore.events.length; i++) {
        expect(eventStore.findIndex(eventStore.events[i])).toBe(i)
      }
    })
    it('should return null for events not in the store', () => {
      const test_ev = {
        x: 15.1, //
        y: 25,
        event: {
          name: 'A Different Event',
          date: new DeepTime('2021'),
          significance: 7
        },
        significance: 0.7
      }
      expect(eventStore.findIndex(test_ev)).toBe(-1)
      const test_ev2 = { ...eventStore.events[0] } // copy of existing event, but not the same
      expect(eventStore.findIndex(test_ev2)).toBe(-1)
    })
  })
  describe('Range Queries', () => {
    beforeEach(() => {
      eventStore.addAll(sampleEvents)
    })

    it('should find events in simple range', () => {
      const result = eventStore.queryRange(10, 20)
      expect(result.length).toBe(2)
      expect(result.map((e) => e.x)).toEqual([10, 15])
    })

    it('should find events in range that includes boundaries', () => {
      const result = eventStore.queryRange(15, 25)
      expect(result.length).toBe(2)
      expect(result.map((e) => e.x)).toEqual([15, 25])
    })

    it('should find all events when range covers everything', () => {
      const result = eventStore.queryRange(0, 100)
      expect(result.length).toBe(5)
      expect(result.map((e) => e.x)).toEqual([5, 10, 15, 25, 30])
    })

    it('should return empty array for range with no events', () => {
      const result = eventStore.queryRange(40, 50)
      expect(result).toEqual([])
    })

    it('should handle single point range', () => {
      const result = eventStore.queryRange(15, 15)
      expect(result.length).toBe(1)
      expect(result[0].x).toBe(15)
    })

    it('should return empty array for invalid range (x0 > x1)', () => {
      const result = eventStore.queryRange(20, 10)
      expect(result).toEqual([])
    })

    it('should handle range that starts before all events', () => {
      const result = eventStore.queryRange(0, 8)
      expect(result.length).toBe(1)
      expect(result[0].x).toBe(5)
    })

    it('should handle range that ends after all events', () => {
      const result = eventStore.queryRange(25, 100)
      expect(result.length).toBe(2)
      expect(result.map((e) => e.x)).toEqual([25, 30])
    })

    it('should return references to original events, not copies', () => {
      const result = eventStore.queryRange(10, 15)
      expect(result[0]).toBe(sampleEvents.find((e) => e.x === 10))
      expect(result[1]).toBe(sampleEvents.find((e) => e.x === 15))
    })
  })

  describe('Count Queries', () => {
    beforeEach(() => {
      eventStore.addAll(sampleEvents)
    })

    it('should count events in range', () => {
      expect(eventStore.countInRange(10, 20)).toBe(2)
      expect(eventStore.countInRange(15, 25)).toBe(2)
      expect(eventStore.countInRange(0, 100)).toBe(5)
    })

    it('should return 0 for empty range', () => {
      expect(eventStore.countInRange(40, 50)).toBe(0)
    })

    it('should return 0 for invalid range', () => {
      expect(eventStore.countInRange(20, 10)).toBe(0)
    })

    it('should match queryRange length', () => {
      const testRanges = [
        [0, 100],
        [10, 20],
        [15, 25],
        [40, 50],
        [5, 5],
        [15, 15]
      ]

      testRanges.forEach(([x0, x1]) => {
        const queryResult = eventStore.queryRange(x0, x1)
        const countResult = eventStore.countInRange(x0, x1)
        expect(countResult).toBe(queryResult.length)
      })
    })
  })

  describe('Event Removal', () => {
    beforeEach(() => {
      eventStore.addAll(sampleEvents)
    })

    it('should remove existing event by reference', () => {
      const eventToRemove = sampleEvents[1] // x=15
      const removed = eventStore.remove(eventToRemove)

      expect(removed).toBe(true)
      expect(eventStore.events.length).toBe(4)
      expect(eventStore.events.map((e) => e.x)).toEqual([5, 10, 25, 30])
    })

    it('should return false when removing non-existent event', () => {
      const nonExistentEvent = {
        x: 100,
        y: 100,
        event: {
          name: 'Non-existent',
          date: new DeepTime('2025'),
          significance: 1
        },
        significance: 0.1
      }

      const removed = eventStore.remove(nonExistentEvent)
      expect(removed).toBe(false)
      expect(eventStore.events.length).toBe(5)
    })

    it('should maintain sorted order after removal', () => {
      eventStore.remove(sampleEvents[1]) // Remove x=15
      eventStore.remove(sampleEvents[3]) // Remove x=25

      expect(eventStore.events.map((e) => e.x)).toEqual([5, 10, 30])
    })
  })

  describe('Clear Operation', () => {
    it('should clear all events', () => {
      eventStore.addAll(sampleEvents)
      expect(eventStore.events.length).toBe(5)

      eventStore.clear()
      expect(eventStore.events.length).toBe(0)
    })

    it('should handle clearing empty store', () => {
      eventStore.clear()
      expect(eventStore.events.length).toBe(0)
    })
  })

  describe('Iteration and Access', () => {
    beforeEach(() => {
      eventStore.addAll(sampleEvents)
    })

    it('should allow iteration over events', () => {
      const xValues: number[] = []
      for (const event of eventStore.events) {
        xValues.push(event.x)
      }
      expect(xValues).toEqual([5, 10, 15, 25, 30])
    })

    it('should allow traditional for loop iteration', () => {
      const xValues: number[] = []
      for (let i = 0; i < eventStore.events.length; i++) {
        xValues.push(eventStore.events[i].x)
      }
      expect(xValues).toEqual([5, 10, 15, 25, 30])
    })
  })

  describe('Edge Cases and Performance', () => {
    it('should handle large number of events', () => {
      const largeEventSet: VisibleEvent[] = []
      for (let i = 0; i < 1000; i++) {
        largeEventSet.push({
          x: i,
          y: i * 2,
          event: {
            name: `Event ${i}`,
            date: new DeepTime('2020'),
            significance: 5
          }
        })
      }

      eventStore.addAll(largeEventSet)
      expect(eventStore.events.length).toBe(1000)

      // Test range query on large dataset
      const result = eventStore.queryRange(100, 200)
      expect(result.length).toBe(101) // 100 to 200 inclusive
      expect(result[0].x).toBe(100)
      expect(result[100].x).toBe(200)
    })

    it('should handle events with negative x coordinates', () => {
      const negativeEvents: VisibleEvent[] = [
        {
          x: -10,
          y: 10,
          event: {
            name: 'Negative 1',
            date: new DeepTime('2020'),
            significance: 5
          }
        },
        {
          x: -5,
          y: 15,
          event: {
            name: 'Negative 2',
            date: new DeepTime('2021'),
            significance: 6
          }
        },
        {
          x: 0,
          y: 20,
          event: { name: 'Zero', date: new DeepTime('2022'), significance: 7 }
        }
      ]

      eventStore.addAll(negativeEvents)
      expect(eventStore.events.map((e) => e.x)).toEqual([-10, -5, 0])

      const result = eventStore.queryRange(-8, -2)
      expect(result.length).toBe(1)
      expect(result[0].x).toBe(-5)
    })

    it('should handle floating point x coordinates', () => {
      const floatEvents: VisibleEvent[] = [
        {
          x: 1.5,
          y: 10,
          event: {
            name: 'Float 1',
            date: new DeepTime('2020'),
            significance: 5
          }
        },
        {
          x: 2.7,
          y: 15,
          event: {
            name: 'Float 2',
            date: new DeepTime('2021'),
            significance: 6
          }
        },
        {
          x: 1.8,
          y: 20,
          event: {
            name: 'Float 3',
            date: new DeepTime('2022'),
            significance: 7
          }
        }
      ]

      eventStore.addAll(floatEvents)
      expect(eventStore.events.map((e) => e.x)).toEqual([1.5, 1.8, 2.7])

      const result = eventStore.queryRange(1.6, 2.5)
      expect(result.length).toBe(1)
      expect(result[0].x).toBe(1.8)
    })

    it('should handle events with same x coordinate', () => {
      const duplicateXEvents: VisibleEvent[] = [
        {
          x: 10,
          y: 10,
          event: {
            name: 'Duplicate 1',
            date: new DeepTime('2020'),
            significance: 5
          }
        },
        {
          x: 10,
          y: 20,
          event: {
            name: 'Duplicate 2',
            date: new DeepTime('2021'),
            significance: 6
          }
        },
        {
          x: 10,
          y: 30,
          event: {
            name: 'Duplicate 3',
            date: new DeepTime('2022'),
            significance: 7
          }
        }
      ]

      eventStore.addAll(duplicateXEvents)
      expect(eventStore.events.length).toBe(3)
      expect(eventStore.events.every((e) => e.x === 10)).toBe(true)

      const result = eventStore.queryRange(10, 10)
      expect(result.length).toBe(3)

      const count = eventStore.countInRange(9.9, 10.1)
      expect(count).toBe(3)
    })
  })
})
