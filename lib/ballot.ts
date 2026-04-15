export interface BallotEntry {
  id: string
}

const KEY = 'elezzjoni_ballot_v1'

export function getBallot(): BallotEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function isStarred(id: string): boolean {
  return getBallot().some(e => e.id === id)
}

export function toggleStar(id: string): BallotEntry[] {
  const ballot = getBallot()
  const exists = ballot.find(e => e.id === id)
  const updated = exists
    ? ballot.filter(e => e.id !== id)
    : [...ballot, { id }]
  localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}

export function moveUp(id: string): BallotEntry[] {
  const ballot = getBallot()
  const idx = ballot.findIndex(e => e.id === id)
  if (idx <= 0) return ballot
  const updated = [...ballot]
  ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
  localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}

export function moveDown(id: string): BallotEntry[] {
  const ballot = getBallot()
  const idx = ballot.findIndex(e => e.id === id)
  if (idx < 0 || idx >= ballot.length - 1) return ballot
  const updated = [...ballot]
  ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
  localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}

export function clearBallot(): void {
  localStorage.removeItem(KEY)
}

// Compare pick — sessionStorage so it clears on tab close
const COMPARE_KEY = 'elezzjoni_compare_pick'

export function getComparePick(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(COMPARE_KEY)
}

export function setComparePick(id: string | null): void {
  if (id === null) sessionStorage.removeItem(COMPARE_KEY)
  else sessionStorage.setItem(COMPARE_KEY, id)
}
