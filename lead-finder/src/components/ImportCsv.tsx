import { useState } from 'react'
import { Upload } from 'lucide-react'
import { FIELD_LABELS, IMPORT_FIELDS, MAX_IMPORT_ROWS, guessColumns, parseCsv, rowsToLeads, type ColumnMap, type ImportedRow } from '../lib/csvImport'

type Props = {
  // Saves the rows as leads (and adds the ones with an email to outreach when asked). Returns a one-line report.
  onImport: (rows: ImportedRow[], addToOutreach: boolean) => string
}

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primary = 'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50'
const MAX_BYTES = 5 * 1024 * 1024

// Upload a CSV, check which column is which, and import it as saved leads.
export default function ImportCsv({ onImport }: Props) {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [fileName, setFileName] = useState('')
  const [map, setMap] = useState<ColumnMap | null>(null)
  const [addToOutreach, setAddToOutreach] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState('')

  async function pick(file: File | undefined) {
    setError('')
    setReport('')
    if (!file) return
    if (file.size > MAX_BYTES) return setError('That file is over 5 MB. Split it into smaller files.')
    const parsed = parseCsv(await file.text())
    if (parsed.length < 2) return setError('The file needs a header row and at least one row of leads.')
    setRows(parsed)
    setFileName(file.name)
    setMap(guessColumns(parsed[0]))
  }

  const header = rows?.[0] ?? []
  const result = rows && map ? rowsToLeads(rows, map) : null

  function run() {
    if (!result) return
    setReport(onImport(result.rows, addToOutreach))
    setRows(null)
    setMap(null)
    setFileName('')
  }

  return (
    <section aria-label="Import leads" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Import leads from a CSV</h3>
      <p className="text-xs text-slate-500">
        Bring a list from a spreadsheet, a CRM export or a lead database. Each row becomes a saved lead (up to {MAX_IMPORT_ROWS} rows at a time).
        Importing the same file again updates the same leads instead of adding copies.
      </p>
      <label className={btn + ' cursor-pointer'}>
        <Upload className="h-4 w-4" aria-hidden />
        Choose CSV file
        <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {report && <p role="status" className="text-sm text-green-700">{report}</p>}

      {rows && map && result && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{fileName}: {rows.length - 1} rows. Check which column is which:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {IMPORT_FIELDS.map((f) => (
              <label key={f} className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">{FIELD_LABELS[f]}{f === 'name' ? ' (needed)' : ''}</span>
                <select
                  value={map[f]} onChange={(e) => setMap({ ...map, [f]: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
                >
                  <option value={-1}>Not in this file</option>
                  {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          {result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Business</th><th className="p-2">Email</th><th className="p-2">Website</th><th className="p-2">Phone</th></tr></thead>
                <tbody>
                  {result.rows.slice(0, 3).map(({ lead }) => (
                    <tr key={lead.id} className="border-t border-slate-100">
                      <td className="p-2">{lead.name}</td><td className="break-all p-2">{lead.email ?? ''}</td><td className="break-all p-2">{lead.website ?? ''}</td><td className="p-2">{lead.phone ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">
            {result.rows.length} leads ready, {result.rows.filter((r) => r.lead.email).length} with an email.
            {result.skipped > 0 && ` ${result.skipped} rows have no business name and will be skipped.`}
            {' '}Websites are checked after the import, which can find more emails.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={addToOutreach} onChange={(e) => setAddToOutreach(e.target.checked)} />
            Add the ones with an email to outreach now
          </label>
          <div className="flex gap-2">
            <button type="button" className={primary} disabled={map.name < 0 || result.rows.length === 0} onClick={run}>Import {result.rows.length} leads</button>
            <button type="button" className={btn} onClick={() => { setRows(null); setMap(null); setFileName('') }}>Cancel</button>
          </div>
          {map.name < 0 && <p className="text-xs text-red-700">Pick the column with the business name.</p>}
        </div>
      )}
    </section>
  )
}
