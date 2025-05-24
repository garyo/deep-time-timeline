import { readFileSync, writeFileSync } from 'fs'
import { DeepTime } from './deep-time'

const srcFile = 'public/data/events.json'
const dstFile = 'public/data/sorted-events.json'

interface Event {
  title: string
  date: string // assuming date will be in string format
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

  // Optionally, save the sorted events back to a file
  writeFileSync(dstFile, JSON.stringify(events, null, 2))

  return events
}

// Execute the function
const sortedEvents = sortEvents()
console.log(`Events sorted into ${dstFile}`)
