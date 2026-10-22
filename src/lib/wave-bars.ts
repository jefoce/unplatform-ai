/** Deterministic waveform heights from the file name. */
export function waveBars(name: string, count: number): number[] {
  let seed = 0

  for (let index = 0; index < name.length; index += 1) {
    seed = (seed * 31 + name.charCodeAt(index)) | 0
  }

  return Array.from({ length: count }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff

    return 20 + (seed % 80)
  })
}
