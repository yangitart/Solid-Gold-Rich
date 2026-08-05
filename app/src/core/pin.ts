export function hashPin(pin: string) {
  let hash = 2166136261;
  for (let index = 0; index < pin.length; index += 1) {
    hash ^= pin.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
