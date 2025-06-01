import { readFileSync, writeFileSync } from 'fs'
import { DeepTime } from '../src/deep-time'

const srcFile = 'public/data/events.json'
const dstFile = 'public/data/sorted-events.json'

interface Event {
  title: string
  date: string // assuming date will be in string format
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
      return JSON.stringify(obj)
    }

    // Format as multi-line array
    const items = obj.map(
      (item) =>
        nextSpaces + formatJsonWithInlineArrays(item, options, nextIndent)
    )
    return '[\n' + items.join(',\n') + '\n' + spaces + ']'
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
