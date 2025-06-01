export function rescale(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number
): number {
  return ((x - x0) / (x1 - x0)) * (y1 - y0) + y0
}

export function clamp(x: number, minval: number, maxval: number): number {
  const actualMin = Math.min(minval, maxval)
  const actualMax = Math.max(minval, maxval)
  return Math.min(actualMax, Math.max(actualMin, x))
}

export function rescaleClamp(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number
): number {
  return clamp(((x - x0) / (x1 - x0)) * (y1 - y0) + y0, y0, y1)
}
