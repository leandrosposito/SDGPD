import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '../../..')
const planDir = path.join(root, 'BackEnd', 'docs', 'plan')
const tracePath = path.join(planDir, 'TRAZABILIDAD.md')
const decisionsPath = path.join(planDir, 'DECISIONES_PENDIENTES.md')
const branch = 'origin/sesion-be2-2026-10-10'
const source = {
  rf: path.join(root, 'FrontEnd/docs/historial/auditorias/backend/06_COBERTURA_RF.md'),
  endpoints: path.join(root, 'FrontEnd/docs/historial/auditorias/backend/01_ENDPOINTS.md'),
  entities: path.join(root, 'FrontEnd/docs/historial/auditorias/backend/02_MODELO_DE_DATOS.md'),
  rules: path.join(root, 'FrontEnd/docs/historial/auditorias/backend/03_REGLAS_DE_NEGOCIO.md'),
  findings: path.join(root, 'FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md'),
  pending: path.join(root, 'FrontEnd/docs/PENDIENTES.md'),
}
const specFiles = new Map([
  ['BE-02', 'BE-02-maestros.md'],
  ['BE-03', 'BE-03-productos-clientes-precios.md'],
  ['BE-04', 'BE-04-inventario.md'],
  ['BE-05', 'BE-05-pedidos.md'],
  ['BE-06', 'BE-06-entregas-remitos.md'],
  ['BE-07', 'BE-07-viajes-pod-storage.md'],
  ['BE-08', 'BE-08-compras-recepciones.md'],
  ['BE-09', 'BE-09-caja-cuenta-facturacion.md'],
  ['BE-10', 'BE-10-export-alertas-analitica.md'],
])
const errors: string[] = []
const warnings: string[] = []

function read(file: string) {
  return fs.readFileSync(file, 'utf8')
}
function lines(file: string) {
  return read(file).split(/\r?\n/)
}
function unique(values: string[]) {
  return [...new Set(values)]
}
function idsFrom(pattern: RegExp, file: string) {
  return unique(lines(file).flatMap((line) => [...line.matchAll(pattern)].map((m) => m[1])))
}
function pendingBackendIds() {
  const text = read(source.pending)
  const matches = [...text.matchAll(/^###\s+(\d+)\.(.*)$/gm)]
  const result: string[] = []
  for (const match of matches) {
    const start = match.index ?? 0
    const next = text.indexOf('\n### ', start + 1)
    const body = text.slice(start, next < 0 ? text.length : next)
    if (/CERRADO|no aplica|No reproduce/i.test(match[2] + body.slice(0, 300))) continue
    if (/backend|servidor|API|HTTP|ADR-BE|contrato|DTO|stock|inventario|producto|pedido|entrega|remito|dinero|Money/i.test(body)) {
      result.push(`P-${match[1]}`)
    }
  }
  return unique(result)
}
function universes() {
  const rf = idsFrom(/^\|\s*(RF-[A-Z]+-\d+)\s*\|/gm, source.rf)
  const endpoints = idsFrom(/^\|\s*(\d+)\s*\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|/gm, source.endpoints)
  const entities = idsFrom(/^###\s+(.+?)\s+—/gm, source.entities)
  const rules = idsFrom(/^\|\s*(?:\*\*)?(R-[A-Z]+-\d+[a-z]?)(?:\s+\(ALTO\))?(?:\*\*)?\s*\|/gm, source.rules)
  const findings = idsFrom(/^[-*]\s+\*\*((?:B|A|M|L)\d+)\*\*/gm, source.findings)
  return { rf, endpoints, entities, rules, findings, pending: pendingBackendIds() }
}
function checkUniverseCounts() {
  const u = universes()
  const expected = { rf: 83, endpoints: 91, entities: 25, rules: 72 }
  for (const [key, count] of Object.entries(expected)) {
    if (u[key as keyof typeof u].length !== count) errors.push(`universo ${key}: esperado ${count}, encontrado ${u[key as keyof typeof u].length}`)
  }
  return u
}
function normalizeId(id: string) {
  return id.replace(/^\s+|\s+$/g, '')
}
function parseTrace() {
  if (!fs.existsSync(tracePath)) return new Map<string, { dest: string; line: number; raw: string }[]>()
  const rows = new Map<string, { dest: string; line: number; raw: string }[]>()
  for (const [index, line] of lines(tracePath).entries()) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/)
    if (!match || match[1] === 'Universo' || /^-+$/.test(match[1])) continue
    const id = normalizeId(match[2])
    const row = { dest: normalizeId(match[4]), line: index + 1, raw: line }
    rows.set(id, [...(rows.get(id) ?? []), row])
  }
  return rows
}
function validDestination(dest: string) {
  return /^((hecho en )?BE-(0[a-b]|1[a-c]|0[2-9]|10)(?:\s+\((?:completo|parcial)[^)]*\))?|BE-(0[a-b]|1[a-c]|0[2-9]|10)(?:\s+\((?:completo|parcial)[^)]*\))?|se retira|fuera de plan|depende de D-\d{2})/i.test(dest)
}
function sourcePathFromCitation(value: string) {
  const cleaned = value.replace(/^[`*_[\]()]+|[`*_[\]()]+$/g, '')
  const match = cleaned.match(/^(.+?\.(?:ts|tsx|md|json|sql|mjs|txt))(?:[:#](\d+)(?:-(\d+))?)?$/)
  if (!match) return null
  const file = match[1].replace(/\\/g, '/')
  const line = match[2] ? Number(match[2]) : undefined
  const end = match[3] ? Number(match[3]) : line
  return { file, line, end }
}
function checkCitations(file: string) {
  const text = read(file)
  const tokens = [...text.matchAll(/(?:[`(\s]|^)((?:BackEnd|FrontEnd|Documentacion|packages|src|scripts|docs|origin\/)[^\s)`\],;]+\.(?:ts|tsx|md|json|sql|mjs|txt)(?::\d+(?:-\d+)?)?)/gm)]
  for (const token of tokens) {
    const citation = sourcePathFromCitation(token[1])
    if (!citation) continue
    const lineStart = text.lastIndexOf('\n', token.index ?? 0) + 1
    const lineEnd = text.indexOf('\n', token.index ?? 0)
    const containing = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd)
    const isBranch = containing.includes('[HECHO en rama]')
    if (isBranch) {
      checkBranchPath(citation.file, file, token.index ?? 0)
      continue
    }
    const candidate = path.resolve(root, citation.file)
    if (!fs.existsSync(candidate)) {
      errors.push(`${path.relative(root, file)}: ruta inexistente ${citation.file}`)
      continue
    }
    if (citation.line !== undefined) {
      const count = lines(candidate).length
      if (citation.line < 1 || (citation.end ?? citation.line) > count) errors.push(`${path.relative(root, file)}: línea fuera de rango ${citation.file}:${citation.line}`)
    }
  }
}
function checkBranchPath(file: string, doc: string, index: number) {
  try {
    execFileSync('git', ['cat-file', '-e', `${branch}:${file}`], { cwd: root, stdio: 'ignore' })
  } catch {
    errors.push(`${path.relative(root, doc)}:${index}: ruta [HECHO en rama] ausente en ${branch}: ${file}`)
  }
}
function checkLinks(file: string) {
  const text = read(file)
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1].split('#')[0]
    if (!link || /^(?:https?:|mailto:|#)/.test(link)) continue
    const target = path.resolve(path.dirname(file), link)
    if (!fs.existsSync(target)) errors.push(`${path.relative(root, file)}: link inexistente ${link}`)
  }
}
function checkAdrs(file: string) {
  const text = read(file)
  for (const match of text.matchAll(/\b(ADR-(?:BE-\d{3}|\d{3}|016))\b/g)) {
    const id = match[1]
    const roots = id.startsWith('ADR-BE-') ? ['BackEnd/docs/adr'] : ['FrontEnd/docs/adr', 'BackEnd/docs/adr']
    const found = roots.some((rootDir) => fs.readdirSync(path.join(root, rootDir)).some((name) => name.startsWith(id + '-') && name.endsWith('.md')))
    if (!found) errors.push(`${path.relative(root, file)}: ADR inexistente ${id}`)
  }
}
function checkSpecSections(file: string, expected: number) {
  const text = read(file)
  const headings = [...text.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)]
  const seen = new Set<number>()
  for (const heading of headings) {
    const number = Number(heading[1])
    seen.add(number)
    const start = heading.index! + heading[0].length
    const next = text.slice(start).search(/^##\s+\d+\.\s+/m)
    const body = text.slice(start, next < 0 ? text.length : start + next).trim()
    if (!body || /^No aplica\.?$/i.test(body)) errors.push(`${path.relative(root, file)}: sección ${number} vacía; usar No aplica con motivo`)
  }
  for (let i = 1; i <= expected; i++) if (!seen.has(i)) errors.push(`${path.relative(root, file)}: falta sección ${i}`)
}
function checkOpenDecisions(file: string) {
  const text = read(file)
  const declared = new Set([...read(decisionsPath).matchAll(/^##+\s+(D-\d{2})\b/gm)].map((m) => m[1]))
  for (const match of text.matchAll(/\[ABIERTO\s+(D-\d{2})\]/g)) if (!declared.has(match[1])) errors.push(`${path.relative(root, file)}: decisión no declarada ${match[1]}`)
  for (const forbidden of text.matchAll(/\b(TBD|TODO|por definir)\b/g)) errors.push(`${path.relative(root, file)}: marcador suelto ${forbidden[1]}`)
}
function assignedSpecContains(spec: string, id: string) {
  const text = read(path.join(planDir, spec))
  if (/^\d+$/.test(id)) {
    if (text.includes(`#${id}`) || new RegExp(`\\|\\s*${id}\\s*\\|`).test(text)) return true
    for (const match of text.matchAll(/#(\d+)\s*[–-]\s*#?(\d+)/g)) if (Number(id) >= Number(match[1]) && Number(id) <= Number(match[2])) return true
    return false
  }
  if (text.includes(id)) return true
  const short = id.replace(/\s+\(.+$/, '')
  return short !== id && text.includes(short)
}
function checkTraceability(u: ReturnType<typeof universes>) {
  const trace = parseTrace()
  const all = Object.entries(u).flatMap(([universe, ids]) => ids.map((id) => ({ universe, id })))
  for (const { universe, id } of all) {
    const rows = trace.get(id) ?? []
    if (rows.length !== 1) errors.push(`trazabilidad ${universe}/${id}: ${rows.length} filas, esperado 1`)
    else if (!validDestination(rows[0].dest)) errors.push(`trazabilidad ${universe}/${id}: destino inválido "${rows[0].dest}"`)
  }
  for (const [id, rows] of trace) if (rows.length === 1 && !all.some((entry) => entry.id === id)) errors.push(`trazabilidad: id no perteneciente a universos ${id}`)
  for (const [universe, ids] of Object.entries(u)) {
    for (const id of ids) {
      const row = trace.get(id)?.[0]
      if (!row || !/^BE-(0[2-9]|10)\b/i.test(row.dest)) continue
      const match = row.dest.match(/BE-(0[2-9]|10)/i)!
      const key = `BE-${match[1]}`
      const spec = specFiles.get(key)
      if (!spec || !assignedSpecContains(spec, id)) errors.push(`trazabilidad ${universe}/${id}: asignado a ${key} pero no aparece en ${spec ?? 'spec inexistente'}`)
    }
  }
}
function destinationFor(universe: string, id: string) {
  if (universe === 'rf') {
    if (/^RF-(ORG|IAM)-/.test(id)) return 'hecho en BE-1a'
    if (/^RF-PRO-/.test(id) || /^RF-LOG-002$/.test(id)) return 'BE-02'
    if (/^RF-(CLI|PRD|PRI)-/.test(id)) return 'BE-03'
    if (/^RF-INV-/.test(id)) return 'BE-04'
    if (/^RF-CMP-/.test(id)) return 'BE-08'
    if (/^RF-PED-/.test(id)) return 'BE-05'
    if (/^RF-PRE-/.test(id)) return 'depende de D-04'
    if (/^RF-(LOG|ENT)-/.test(id)) return /^RF-LOG-/.test(id) ? 'BE-07' : 'BE-06'
    if (/^RF-FAC-/.test(id)) return 'depende de D-01'
    if (/^RF-CCT-/.test(id) || /^RF-TES-/.test(id)) return 'BE-09'
    if (/^RF-(REP|NOT)-/.test(id)) return 'BE-10'
    return 'fuera de plan'
  }
  if (universe === 'endpoints') {
    const n = Number(id)
    if (n >= 1 && n <= 3) return 'BE-09'
    if (n >= 4 && n <= 13) return n === 10 || n === 12 ? 'BE-09' : 'BE-03'
    if (n === 14 || (n >= 58 && n <= 62)) return 'BE-10'
    if (n >= 15 && n <= 20) return 'BE-04'
    if (n >= 21 && n <= 29) return 'BE-06'
    if (n >= 30 && n <= 39) return 'BE-07'
    if (n >= 40 && n <= 45) return 'BE-05'
    if (n >= 46 && n <= 52) return 'hecho en BE-1b'
    if (n >= 53 && n <= 57) return 'BE-02'
    if (n >= 63 && n <= 68) return 'BE-08'
    if (n >= 69 && n <= 71) return 'BE-10'
    if (n >= 72 && n <= 77) return 'BE-02'
    if (n >= 78 && n <= 81) return 'BE-03'
    if (n >= 82 && n <= 86) return 'BE-04'
    if (n >= 87 && n <= 91) return 'BE-02'
    return 'fuera de plan'
  }
  if (universe === 'entities') {
    if (/Supplier|Vehicle|Driver|Motivo/.test(id)) return 'BE-02'
    if (/Client/.test(id) || /InventoryItem|Price/.test(id)) return 'BE-03'
    if (/Stock|Movement|History|Lot|Suggestion/.test(id)) return 'BE-04'
    if (/Order/.test(id)) return 'BE-05'
    if (/Delivery|Note/.test(id)) return 'BE-06'
    if (/Trip|Stop|Pod/.test(id)) return 'BE-07'
    if (/Purchase/.test(id)) return 'BE-08'
    if (/Cash/.test(id)) return 'BE-09'
    if (/Alert|Dashboard|Analytics/.test(id)) return 'BE-10'
    return 'hecho en BE-1a'
  }
  if (universe === 'rules') {
    if (/^R-(PRO|VEH|CHO)-/.test(id)) return 'BE-02'
    if (/^R-(CLI|PRD)-/.test(id)) return 'BE-03'
    if (/^R-INV-/.test(id)) return 'BE-04'
    if (/^R-PED-/.test(id)) return 'BE-05'
    if (/^R-(ENT)-/.test(id)) return 'BE-06'
    if (/^R-VIA-/.test(id)) return 'BE-07'
    if (/^R-CMP-/.test(id)) return 'BE-08'
    if (/^R-CAJ-/.test(id)) return 'BE-09'
    if (/^R-(ALE)-/.test(id)) return 'BE-10'
    if (/^R-PER-/.test(id)) return 'hecho en BE-1a'
    return 'fuera de plan'
  }
  if (universe === 'findings') {
    const n = Number(id.slice(1))
    if (id.startsWith('B')) return ['B1', 'B2', 'B4', 'B6', 'B8'].includes(id) ? 'hecho en BE-0a' : id === 'B7' ? 'BE-04' : id === 'B3' ? 'BE-10' : 'BE-05'
    if (id.startsWith('A')) {
      if ([3, 4, 5, 6, 11, 13, 14, 19, 21].includes(n)) return n === 3 ? 'BE-05' : n === 4 || n === 5 || n === 6 || n === 11 ? 'BE-06' : n === 14 ? 'BE-02' : n === 19 ? 'BE-04' : 'BE-09'
      if ([7].includes(n)) return 'BE-07'
      if ([8, 9].includes(n)) return 'BE-08'
      if ([15, 20].includes(n)) return 'BE-10'
      if ([1, 2, 12, 17, 18].includes(n)) return 'hecho en BE-0b'
      if (n === 16) return 'BE-03'
      return 'fuera de plan'
    }
    if (id.startsWith('M')) return n >= 1 && n <= 6 ? 'BE-10' : n >= 7 && n <= 9 ? 'BE-07' : n >= 10 && n <= 12 ? 'BE-03' : n === 13 ? 'BE-09' : n >= 14 && n <= 18 ? 'BE-04' : n === 19 ? 'BE-08' : n === 20 ? 'BE-10' : 'fuera de plan'
    return 'fuera de plan'
  }
  if (universe === 'pending') {
    const n = Number(id.slice(2))
    if ([9, 10, 11, 14].includes(n)) return 'BE-04'
    if ([16, 17].includes(n)) return 'BE-05'
    if (n === 18 || n === 22) return 'BE-03'
    if (n === 20) return 'BE-10'
    if (n === 21) return 'BE-03'
    if (n === 5) return 'hecho en BE-0a'
    if (n === 7) return 'BE-03'
    return 'fuera de plan'
  }
  return 'fuera de plan'
}
function initTraceability(u: ReturnType<typeof universes>) {
  const sourceByUniverse: Record<string, string> = { rf: '06_COBERTURA_RF.md', endpoints: '01_ENDPOINTS.md', entities: '02_MODELO_DE_DATOS.md', rules: '03_REGLAS_DE_NEGOCIO.md', findings: '00_RESUMEN.md', pending: 'PENDIENTES.md' }
  const rows = ['# Trazabilidad del plan backend', '', '**Verificado:** 2026-10-10 contra lean=e719e96 y las fuentes indicadas. Los ids se leen de las fuentes; no son una lista manual.', '', '| Universo | Id | Fuente | Destino | Evidencia / alcance |', '|---|---|---|---|---|']
  for (const [universe, ids] of Object.entries(u)) for (const id of ids) rows.push(`| ${universe} | ${id} | [${sourceByUniverse[universe]}](../../FrontEnd/docs/historial/auditorias/backend/${sourceByUniverse[universe]}) | ${destinationFor(universe, id)} | Ver spec, ADR o reporte citado allí. |`)
  fs.writeFileSync(tracePath, rows.join('\n') + '\n')
  console.log(`TRAZABILIDAD inicializada: ${rows.length - 6} filas`)
}
function printCounts(u: ReturnType<typeof universes>) {
  console.log(JSON.stringify({ counts: Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.length])) }, null, 2))
}
function main() {
  if (!fs.existsSync(planDir)) errors.push('falta BackEnd/docs/plan')
  const u = checkUniverseCounts()
  printCounts(u)
  if (!fs.existsSync(decisionsPath)) errors.push('falta DECISIONES_PENDIENTES.md')
  const requested = process.argv[2]
  if (requested === '--init') {
    initTraceability(u)
    return
  }
  const files = [...specFiles.entries()].filter(([key]) => !requested || requested === key).map(([, file]) => path.join(planDir, file))
  if (requested && requested !== 'U0' && files.length === 0) errors.push(`unidad desconocida ${requested}`)
  if (fs.existsSync(tracePath) && (!requested || requested === 'U0')) checkTraceability(u)
  const markdown = fs.existsSync(planDir) ? fs.readdirSync(planDir).filter((name) => name.endsWith('.md')).map((name) => path.join(planDir, name)) : []
  for (const file of markdown) {
    checkLinks(file)
    checkAdrs(file)
    checkOpenDecisions(file)
  }
  for (const file of files) if (fs.existsSync(file)) checkSpecSections(file, path.basename(file).startsWith('BE-02-') ? 17 : 16)
  if (requested && requested !== 'U0' && !fs.existsSync(path.join(planDir, 'TRAZABILIDAD.md'))) errors.push('falta TRAZABILIDAD.md')
  if (errors.length) {
    console.error(`docs:check FAIL (${errors.length})`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    if (warnings.length) for (const warning of warnings) console.warn(`- ${warning}`)
    console.log(`docs:check PASS${requested ? ` ${requested}` : ''}`)
  }
}
main()
