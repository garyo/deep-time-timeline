import { createStore } from 'solid-js/store'
import type { Event, VisibleEvent } from '../scripts/events.ts'

export interface EventsState {
  baseEvents: Event[]
  additionalEvents: Event[]
  allEvents: Event[]
  visibleEvents: VisibleEvent[]
  categoryGroups: Record<string, string[]>
  selectedCategories: Set<string>
}

const initialEventsState: EventsState = {
  baseEvents: [],
  additionalEvents: [],
  allEvents: [],
  visibleEvents: [],
  categoryGroups: {},
  selectedCategories: new Set()
}

export const [eventsState, setEventsState] = createStore(initialEventsState)

export const eventsActions = {
  updateBaseEvents: (events: Event[]) => {
    setEventsState('baseEvents', events)
  },

  updateAdditionalEvents: (events: Event[]) => {
    setEventsState('additionalEvents', events)
  },

  updateAllEvents: (events: Event[]) => {
    setEventsState('allEvents', events)
  },

  updateVisibleEvents: (events: VisibleEvent[]) => {
    setEventsState('visibleEvents', events)
  },

  updateCategoryGroups: (groups: Record<string, string[]>) => {
    setEventsState('categoryGroups', groups)
  },

  updateSelectedCategories: (categories: Set<string>) => {
    setEventsState('selectedCategories', categories)
  },

  selectCategoriesByGroups: (
    groups: Record<string, string[]>,
    groupNames?: string[]
  ) => {
    const selectedCategories = new Set<string>()
    Object.entries(groups).forEach(([groupName, categories]) => {
      if (groupNames === undefined || groupNames.includes(groupName)) {
        categories.forEach((category) => {
          selectedCategories.add(category)
        })
      }
    })
    setEventsState('selectedCategories', selectedCategories)
    return selectedCategories
  }
}
