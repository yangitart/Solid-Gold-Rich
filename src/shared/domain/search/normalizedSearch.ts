export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

const entitySearchCache = new WeakMap<object, { parts: readonly string[]; normalized: string }>();

export function normalizeEntitySearchText(entity: object, value: string) {
  return normalizeEntitySearchParts(entity, value);
}

export function normalizeEntitySearchParts(entity: object, ...parts: string[]) {
  const cached = entitySearchCache.get(entity);
  if (
    cached?.parts.length === parts.length &&
    parts.every((part, index) => cached.parts[index] === part)
  )
    return cached.normalized;
  const normalized = normalizeSearchText(parts.join(' '));
  entitySearchCache.set(entity, { parts: [...parts], normalized });
  return normalized;
}
