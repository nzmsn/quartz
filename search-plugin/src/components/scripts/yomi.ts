export function normalizeYomi(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .toLowerCase();
}

/** Store only pages with readings and normalize each reading once. */
export class YomiIndex {
  private readonly readings = new Map<number, string[]>();

  add(id: number, value: unknown): void {
    const values = (Array.isArray(value) ? value : [value])
      .filter((v): v is string => typeof v === "string")
      .map(normalizeYomi)
      .filter(Boolean);
    if (values.length > 0) this.readings.set(id, values);
    else this.readings.delete(id);
  }

  search(query: string): number[] {
    const prefix = normalizeYomi(query);
    if (!prefix) return [];
    const ids: number[] = [];
    for (const [id, values] of this.readings) {
      if (values.some((reading) => reading.startsWith(prefix))) ids.push(id);
    }
    return ids;
  }
}
