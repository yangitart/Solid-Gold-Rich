function searchKey(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function descriptionSuggestions(history: readonly string[], query: string, limit = 5) {
  return prepareDescriptionSuggestions(history)(query, limit);
}

export function prepareDescriptionSuggestions(history: readonly string[]) {
  const seen = new Set<string>();
  const indexed: { text: string; normalized: string }[] = [];
  for (const value of history) {
    const text = value.trim();
    const normalized = searchKey(text);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    indexed.push({ text, normalized });
  }
  return (query: string, limit = 5) => {
    const key = searchKey(query);
    if (!key || limit <= 0) return [];
    const prefixes: string[] = [];
    const contains: string[] = [];
    for (const item of indexed) {
      if (item.normalized === key) continue;
      if (item.normalized.startsWith(key)) prefixes.push(item.text);
      else if (item.normalized.includes(key)) contains.push(item.text);
    }
    return [...prefixes, ...contains].slice(0, limit);
  };
}
