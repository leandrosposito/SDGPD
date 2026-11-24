export function matchesSearch(text: string, cuit: string, search: string | undefined): boolean {
  if (!search || !search.trim()) return true
  const q = search.trim().toLowerCase()
  return text.toLowerCase().includes(q) || cuit.includes(q)
}
