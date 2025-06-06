#!/usr/bin/env bun

import { readFileSync } from 'fs'

// Read the merged events file and category groups
const allEvents = JSON.parse(readFileSync('public/data/events.json', 'utf8'))
const categoryGroups = JSON.parse(
  readFileSync('public/data/event-categories.json', 'utf8')
)

// Count categories
const categoryCounts: Record<string, number> = {}

allEvents.forEach((event: any) => {
  if (event.categories) {
    event.categories.forEach((category: string) => {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1
    })
  }
})

// Sort by count descending
const sortedCounts = Object.entries(categoryCounts)
  .map(([category, count]) => ({ category, count }))
  .sort((a, b) => b.count - a.count)

// Create a mapping from category to group
const categoryToGroup: Record<string, string> = {}
const allCategoriesInGroups = new Set<string>()

Object.entries(categoryGroups).forEach(([groupName, categories]) => {
  ;(categories as string[]).forEach((category) => {
    categoryToGroup[category] = groupName
    allCategoriesInGroups.add(category)
  })
})

// Count events per group
const groupCounts: Record<string, { count: number; events: any[] }> = {}

// Initialize group counts
Object.keys(categoryGroups).forEach((groupName) => {
  groupCounts[groupName] = { count: 0, events: [] }
})

// Count events for each group
allEvents.forEach((event: any) => {
  if (event.categories) {
    const groupsForThisEvent = new Set<string>()

    event.categories.forEach((category: string) => {
      const group = categoryToGroup[category]
      if (group) {
        groupsForThisEvent.add(group)
      }
    })

    // Add this event to each group it belongs to
    groupsForThisEvent.forEach((group) => {
      groupCounts[group].count++
      groupCounts[group].events.push(event)
    })
  }
})

// Find events that don't belong to any group
const eventsWithoutGroups = allEvents.filter((event: any) => {
  if (!event.categories) return true

  return !event.categories.some((category: string) =>
    allCategoriesInGroups.has(category)
  )
})

// Find categories that aren't in any group
const categoriesNotInGroups = Object.keys(categoryCounts).filter(
  (category) => !allCategoriesInGroups.has(category)
)

console.log('Category usage counts:')
console.log('=====================')
sortedCounts.forEach(({ category, count }) => {
  const group = categoryToGroup[category] || 'UNGROUPED'
  console.log(
    `${category.padEnd(20)} ${count.toString().padStart(3)} (${group})`
  )
})

console.log(`\nTotal categories: ${sortedCounts.length}`)
console.log(`Total events: ${allEvents.length}`)

// Function to check coverage
function analyzeCoverage(topN: number) {
  const topCategories = new Set(
    sortedCounts.slice(0, topN).map((item) => item.category)
  )

  const coveredEvents = allEvents.filter(
    (event: any) =>
      event.categories &&
      event.categories.some((cat: string) => topCategories.has(cat))
  )

  const uncoveredEvents = allEvents.filter(
    (event: any) =>
      !event.categories ||
      !event.categories.some((cat: string) => topCategories.has(cat))
  )

  const coveragePercent = (
    (coveredEvents.length / allEvents.length) *
    100
  ).toFixed(1)

  console.log(`\nTop ${topN} categories coverage:`)
  console.log(`================================`)
  console.log(
    `Categories: ${sortedCounts
      .slice(0, topN)
      .map((item) => item.category)
      .join(', ')}`
  )
  console.log(
    `Events covered: ${coveredEvents.length}/${allEvents.length} (${coveragePercent}%)`
  )

  if (uncoveredEvents.length > 0) {
    console.log(`\nUncovered events (${uncoveredEvents.length}):`)
    uncoveredEvents.forEach((event: any) => {
      const categories = event.categories
        ? event.categories.join(', ')
        : 'NO CATEGORIES'
      console.log(`❌${event.name}, sig ${event.significance}, (${categories})`)
    })
  } else {
    console.log('\n✅ All events are covered!')
  }
}

// Analyze coverage for top 10 and top 20
analyzeCoverage(10)
analyzeCoverage(20)

console.log('\n\nGroup Coverage:')
console.log('===============')

// Sort groups by event count
const sortedGroups = Object.entries(groupCounts).sort(
  (a, b) => b[1].count - a[1].count
)

sortedGroups.forEach(([groupName, data]) => {
  console.log(
    `${groupName.padEnd(20)} ${data.count.toString().padStart(3)} events`
  )
})

// Check for events without groups
if (eventsWithoutGroups.length > 0) {
  console.log(
    `\n⚠️  WARNING: ${eventsWithoutGroups.length} events are not covered by any group:`
  )
  eventsWithoutGroups.forEach((event: any) => {
    const categories = event.categories
      ? event.categories.join(', ')
      : 'NO CATEGORIES'
    console.log(`  - ${event.name} [${categories}]`)
  })
}

// Check for categories without groups
if (categoriesNotInGroups.length > 0) {
  console.log(
    `\n⚠️  WARNING: ${categoriesNotInGroups.length} categories are not in any group:`
  )
  categoriesNotInGroups.forEach((category) => {
    console.log(`  - ${category} (${categoryCounts[category]} events)`)
  })
}

// Final validation and exit code
let hasErrors = false

if (eventsWithoutGroups.length > 0) {
  console.error('\n❌ FAILURE: Some events are not covered by any group!')
  hasErrors = true
}

if (categoriesNotInGroups.length > 0) {
  console.error('\n❌ FAILURE: Some categories are not in any group!')
  hasErrors = true
}

if (hasErrors) {
  console.error(
    '\n💥 Validation FAILED! Some events would be invisible in the timeline.'
  )
  process.exit(1)
} else {
  console.log('\n✅ All events and categories are properly grouped!')
  console.log(
    '✅ Validation PASSED! All events will be visible in the timeline.'
  )
}
