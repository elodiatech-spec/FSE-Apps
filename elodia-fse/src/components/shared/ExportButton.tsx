import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'

interface Props {
  onExcel: () => void
  onCsv: () => void
  disabled?: boolean
  label?: string
}

export function ExportButton({ onExcel, onCsv, disabled, label = 'Exporter' }: Props) {
  const [open, setOpen] = useState(false)

  function handle(fn: () => void) {
    setOpen(false)
    fn()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
            <button
              onClick={() => handle(onExcel)}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Excel</p>
                <p className="text-xs text-slate-400">.xlsx</p>
              </div>
            </button>
            <div className="h-px bg-slate-100" />
            <button
              onClick={() => handle(onCsv)}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">CSV</p>
                <p className="text-xs text-slate-400">.csv (compatible Excel FR)</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
