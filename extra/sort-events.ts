import { readFileSync, writeFileSync } from 'fs'
import { DeepTime } from '../src/deep-time'

const srcFile = 'public/data/events.json'
const dstFile = 'public/data/sorted-events.json'

interface Event {
  name: string
  date: string
  significance: number
  categories: string[]
}

interface FormatOptions {
  indent?: number
  maxInlineArrayLength?: number
  maxInlineArrayItems?: number
}

function formatJsonWithInlineArrays(
  obj: any,
  options: FormatOptions = {},
  currentIndent: number = 0
): string {
  const {
    indent = 2,
    maxInlineArrayLength = 5,
    maxInlineArrayItems = 80
  } = options
  const spaces = ' '.repeat(currentIndent)
  const nextIndent = currentIndent + indent
  const nextSpaces = ' '.repeat(nextIndent)

  if (obj === null) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'

    // Keep small arrays with primitive values inline
    const shouldInline =
      obj.length <= maxInlineArrayLength &&
      obj.every(
        (item) =>
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean' ||
          item === null
      ) &&
      JSON.stringify(obj).length <= maxInlineArrayItems

    if (shouldInline) {
      return JSON.stringify(obj).replace(/,/g, ', ') // one space between elements
    }

    // Format as multi-line array
    const items = obj.map(
      (item) =>
        nextSpaces + formatJsonWithInlineArrays(item, options, nextIndent)
    )
    return '[\n' + items.join(',\n') + '\n' + spaces + ']\n'
  }

  // Handle objects
  const keys = Object.keys(obj)
  if (keys.length === 0) return '{}'

  const items = keys.map((key) => {
    const value = formatJsonWithInlineArrays(obj[key], options, nextIndent)
    return `${nextSpaces}"${key}": ${value}`
  })

  return '{\n' + items.join(',\n') + '\n' + spaces + '}'
}

function generateSignificanceHistogram(events: Event[]) {
  // Count events by significance level
  const histogram: Record<number, number> = {}

  events.forEach((event) => {
    const sig = event.significance
    histogram[sig] = (histogram[sig] || 0) + 1
  })

  // Sort by significance level
  const sortedKeys = Object.keys(histogram)
    .map(Number)
    .sort((a, b) => a - b)

  console.log('\n=== Significance Histogram ===')
  console.log('Significance | Count | Percentage | Bar')
  console.log('-------------|-------|------------|' + '-'.repeat(40))

  const total = events.length
  const maxCount = Math.max(...Object.values(histogram))
  const maxBarLength = 40

  sortedKeys.forEach((sig) => {
    const count = histogram[sig]
    const percentage = ((count / total) * 100).toFixed(1)
    const barLength = Math.round((count / maxCount) * maxBarLength)
    const bar = '█'.repeat(barLength)

    console.log(
      `${sig.toString().padStart(11)} | ` +
        `${count.toString().padStart(5)} | ` +
        `${percentage.padStart(9)}% | ` +
        `${bar}`
    )
  })

  console.log(`\nTotal events: ${total}`)
  console.log(
    `Significance range: ${Math.min(...sortedKeys)} - ${Math.max(...sortedKeys)}`
  )
  console.log(
    `Average significance: ${(events.reduce((sum, e) => sum + e.significance, 0) / total).toFixed(2)}`
  )
}

function sortEvents() {
  const jsonData = readFileSync(srcFile, 'utf-8')

  // Parse the JSON data
  let events: Event[] = JSON.parse(jsonData)

  // Parse dates and sort events
  events.sort((a, b) => {
    const dateA = new DeepTime(a.date).minutesSince1970
    const dateB = new DeepTime(b.date).minutesSince1970
    return dateA - dateB
  })

  // Save the sorted events back to a file with inline arrays
  const formattedJson = formatJsonWithInlineArrays(events, {
    indent: 2,
    maxInlineArrayLength: 6,
    maxInlineArrayItems: 100
  })
  writeFileSync(dstFile, formattedJson)

  return events
}

// Execute the function
const sortedEvents = sortEvents()
console.log(`Events sorted into ${dstFile}`)

// Generate and display histogram
generateSignificanceHistogram(sortedEvents)
