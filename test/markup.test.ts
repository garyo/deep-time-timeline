import { describe, it, expect } from 'vitest'
import { parseBasicMarkup } from '../src/utils/markup'

describe('parseBasicMarkup', () => {
  it('should parse plain text', () => {
    const result = parseBasicMarkup('Hello world')
    expect(result).toEqual([{ text: 'Hello world' }])
  })

  it('should parse bold text with **', () => {
    const result = parseBasicMarkup('Hello **world**')
    expect(result).toEqual([{ text: 'Hello ' }, { text: 'world', bold: true }])
  })

  it('should parse bold text with __', () => {
    const result = parseBasicMarkup('Hello __world__')
    expect(result).toEqual([{ text: 'Hello ' }, { text: 'world', bold: true }])
  })

  it('should parse italic text with *', () => {
    const result = parseBasicMarkup('Hello *world*')
    expect(result).toEqual([
      { text: 'Hello ' },
      { text: 'world', italic: true }
    ])
  })

  it('should parse italic text with _', () => {
    const result = parseBasicMarkup('Hello _world_')
    expect(result).toEqual([
      { text: 'Hello ' },
      { text: 'world', italic: true }
    ])
  })

  it('should handle multiple formatted sections', () => {
    const result = parseBasicMarkup(
      'The **Battle of Hastings** and _Norman conquest_'
    )
    expect(result).toEqual([
      { text: 'The ' },
      { text: 'Battle of Hastings', bold: true },
      { text: ' and ' },
      { text: 'Norman conquest', italic: true }
    ])
  })

  it('should handle book titles', () => {
    const result = parseBasicMarkup('Darwin publishes _Origin of Species_')
    expect(result).toEqual([
      { text: 'Darwin publishes ' },
      { text: 'Origin of Species', italic: true }
    ])
  })

  it('should handle epic titles', () => {
    const result = parseBasicMarkup('_Mahabharata_ begun')
    expect(result).toEqual([
      { text: 'Mahabharata', italic: true },
      { text: ' begun' }
    ])
  })

  it('should handle empty input', () => {
    const result = parseBasicMarkup('')
    expect(result).toEqual([{ text: '' }])
  })
})
