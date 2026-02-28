export function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  const rawValue = localStorage.getItem(key)
  if (!rawValue) return fallback

  try {
    const parsed = JSON.parse(rawValue)
    return (parsed ?? fallback) as T
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}
