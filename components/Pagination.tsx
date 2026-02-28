"use client"

export default function Pagination({ page, pageSize, itemsCount, onPageChange }: { page: number; pageSize: number; itemsCount: number; onPageChange: (p: number) => void }) {
  const isFirst = page <= 1
  const isLast = itemsCount < pageSize

  return (
    <div className="flex items-center justify-end gap-2">
      <button className="px-3 py-1 border border-slate-700 rounded bg-slate-900 text-slate-100 hover:bg-slate-800 disabled:opacity-50" onClick={() => !isFirst && onPageChange(page - 1)} disabled={isFirst}>
        Anterior
      </button>
      <div className="text-sm text-slate-300">Página {page}</div>
      <button className="px-3 py-1 border border-slate-700 rounded bg-slate-900 text-slate-100 hover:bg-slate-800 disabled:opacity-50" onClick={() => !isLast && onPageChange(page + 1)} disabled={isLast}>
        Próxima
      </button>
    </div>
  )
}
