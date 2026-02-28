"use client"

import React, { useState, useEffect } from 'react'
import { readStorageJson } from '@/lib/storage'

type AlertNote = {
  text: string
  timestamp: string
  author?: string
}

type AlertHistoryItem = {
  id: number
  alertId: string
  description: string
  agentName: string
  level: number
  status: string
  timestamp: string
  notes: AlertNote[]
  assignedTo: string
}

export default function AlertRegistry() {
  const [isOpen, setIsOpen] = useState(false)
  const [history, setHistory] = useState<AlertHistoryItem[]>([])

  const loadHistory = () => {
    const alertRegistry = readStorageJson<Record<string, number>>('alertRegistry', {})
    const alertAnnotations = readStorageJson<Record<string, any>>('alertAnnotations', {})

    const items: AlertHistoryItem[] = Object.entries(alertRegistry).map(([alertId, registryId]: [string, any]) => {
      const annotations = alertAnnotations[alertId] || {}
      return {
        id: registryId,
        alertId,
        description: '—',
        agentName: '—',
        level: 0,
        status: annotations.status || '—',
        timestamp: '—',
        notes: annotations.notes || [],
        assignedTo: annotations.assignedTo || '—'
      }
    })

    setHistory(items.sort((a, b) => a.id - b.id))
  }

  const handleOpen = () => {
    loadHistory()
    setIsOpen(true)
  }

  const exportToCSV = () => {
    const csvContent = [
      ['Nº', 'Status', 'Atribuído a', 'Notas', 'Data/Hora'],
      ...history.map(item => [
        item.id,
        item.status,
        item.assignedTo,
        item.notes.map(n => (typeof n === 'object' ? n.text : n) || '').join('; '),
        item.timestamp
      ])
    ]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `alertas_registro_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const clearRegistry = () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico de alertas? Esta ação não pode ser desfeita.')) {
      localStorage.removeItem('alertRegistry')
      localStorage.removeItem('alertAnnotations')
      setHistory([])
      setIsOpen(false)
      window.location.reload()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        📋 Histórico
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-100">Histórico de Alertas</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-300 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>Nenhum alerta registrado ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-800 border-b border-slate-700">
                  <tr>
                    <th className="text-left p-3 text-slate-200">Nº</th>
                    <th className="text-left p-3 text-slate-200">Status</th>
                    <th className="text-left p-3 text-slate-200">Atribuído a</th>
                    <th className="text-left p-3 text-slate-200">Últimas Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.alertId} className="border-b border-slate-800 hover:bg-slate-800">
                      <td className="p-3 font-semibold text-blue-600">{item.id}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-700 text-slate-100">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-200">{item.assignedTo}</td>
                      <td className="p-3 text-slate-400">
                        {item.notes.length > 0
                          ? (() => {
                              const lastNote = item.notes[item.notes.length - 1]
                              const noteText = typeof lastNote === 'object' ? lastNote.text : String(lastNote)
                              return `${noteText?.substring(0, 50)}...`
                            })()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-between gap-3">
          <button
            onClick={clearRegistry}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            🗑️ Limpar Histórico
          </button>
          <div className="flex gap-3">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              📥 Exportar CSV
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-slate-600 text-slate-100 rounded hover:bg-slate-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
