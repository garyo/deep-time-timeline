// Helper function to parse markdown-style markup and convert to SVG tspan elements
export interface TextSegment {
  text: string
  bold?: boolean
  italic?: boolean
}

export function parseBasicMarkup(markdown: string): TextSegment[] {
  // Input validation
  if (!markdown || typeof markdown !== 'string') {
    return [{ text: '' }]
  }

  const segments: TextSegment[] = []
  let currentPos = 0

  // Pattern to match markdown formatting:
  // **bold**, __bold__, *italic*, _italic_
  const markdownPattern = /(\*\*|__|\*|_)(.*?)\1/g

  let match
  while ((match = markdownPattern.exec(markdown)) !== null) {
    // Add text before this formatting
    if (match.index > currentPos) {
      const text = markdown.slice(currentPos, match.index)
      if (text) {
        segments.push({ text })
      }
    }

    // Determine formatting type
    const marker = match[1]
    const content = match[2]

    if (content) {
      const segment: TextSegment = { text: content }

      if (marker === '**' || marker === '__') {
        segment.bold = true
      } else if (marker === '*' || marker === '_') {
        segment.italic = true
      }

      segments.push(segment)
    }

    currentPos = match.index + match[0].length
  }

  // Add remaining text
  if (currentPos < markdown.length) {
    const text = markdown.slice(currentPos)
    if (text) {
      segments.push({ text })
    }
  }

  // If no formatting found, return the whole string
  if (segments.length === 0) {
    segments.push({ text: markdown })
  }

  return segments
}
