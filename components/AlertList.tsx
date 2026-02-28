"use client"

import React, { useState } from 'react'
import Pagination from './Pagination'
import { readStorageJson } from '@/lib/storage'

type Props = {
  alerts: any[]
  loading: boolean
  error?: string | null
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onAlertClick?: (alert: any) => void
  sortBy?: string
  statusFilter?: string
}

export default function AlertList({ alerts, loading, error, page, pageSize, onPageChange, onAlertClick, sortBy = 'timestamp-desc', statusFilter = '' }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  if (loading) return <div className="text-slate-300">Carregando alertas...</div>
  if (error) return <div className="text-red-600">Erro: {error}</div>
  if (!alerts || alerts.length === 0) return <div className="text-slate-300">Nenhum alerta encontrado.</div>

  // Carregar registros do localStorage para IDs e status
  const alertRegistry = readStorageJson<Record<string, number>>('alertRegistry', {})
  const storedAnnotations = readStorageJson<Record<string, any>>('alertAnnotations', {})

  // Filtrar alertas por status se houver filtro ativo
  const filteredAlerts = statusFilter ? alerts.filter(a => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'novo alerta') {
      const alertData = storedAnnotations[a._id]
      return !alertData || !alertData.status || alertData.status === '' || alertData.status === '—'
    }
    const alertData = storedAnnotations[a._id]
    return alertData?.status === statusFilter
  }) : alerts

  // Ordenar alertas conforme opção selecionada
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    switch (sortBy) {
      case 'timestamp-desc': {
        const timestampA = new Date(a['@timestamp'] || a.timestamp || 0).getTime()
        const timestampB = new Date(b['@timestamp'] || b.timestamp || 0).getTime()
        return timestampB - timestampA // Mais recente primeiro
      }
      case 'timestamp-asc': {
        const timestampA = new Date(a['@timestamp'] || a.timestamp || 0).getTime()
        const timestampB = new Date(b['@timestamp'] || b.timestamp || 0).getTime()
        return timestampA - timestampB // Mais antigo primeiro
      }
      case 'level-desc': {
        const levelA = Number(a.rule?.level ?? 0)
        const levelB = Number(b.rule?.level ?? 0)
        return levelB - levelA // Nível maior primeiro
      }
      case 'level-asc': {
        const levelA = Number(a.rule?.level ?? 0)
        const levelB = Number(b.rule?.level ?? 0)
        return levelA - levelB // Nível menor primeiro
      }
      case 'status-new': {
        const statusA = storedAnnotations[a._id]?.status || 'novo alerta'
        const statusB = storedAnnotations[b._id]?.status || 'novo alerta'
        const isNewA = statusA === 'novo alerta' || statusA === '—' || statusA === ''
        const isNewB = statusB === 'novo alerta' || statusB === '—' || statusB === ''
        if (isNewA && !isNewB) return -1
        if (!isNewA && isNewB) return 1
        return 0
      }
      case 'id-asc': {
        const idA = alertRegistry[a._id] || 999999
        const idB = alertRegistry[b._id] || 999999
        return idA - idB // ID crescente
      }
      case 'id-desc': {
        const idA = alertRegistry[a._id] || 0
        const idB = alertRegistry[b._id] || 0
        return idB - idA // ID decrescente
      }
      default:
        return 0
    }
  })

  const handleToggleSelect = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => 
      prev.includes(alertId) 
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    )
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(sortedAlerts.map(a => a._id))
    } else {
      setSelectedIds([])
    }
  }

  const handleBulkStatusChange = (newStatus: string) => {
    if (selectedIds.length === 0) return
    
    const statusLabel = newStatus === 'fechado' ? 'fechar' :
                       newStatus === 'em atendimento' ? 'colocar em atendimento' :
                       newStatus === 'agendado' ? 'agendar' :
                       newStatus === 'falso-positivo' ? 'marcar como falso-positivo' :
                       newStatus === 'cancelado' ? 'cancelar' :
                       newStatus === 'em homologação' ? 'colocar em homologação' :
                       'alterar status de'
    
    if (confirm(`Deseja ${statusLabel} ${selectedIds.length} alerta(s) selecionado(s)?`)) {
      const storedAnnotations = readStorageJson<Record<string, any>>('alertAnnotations', {})
      
      selectedIds.forEach(alertId => {
        const existing = storedAnnotations[alertId] || {}
        storedAnnotations[alertId] = {
          ...existing,
          status: newStatus,
          notes: existing.notes || [],
          assignedTo: existing.assignedTo || ''
        }
      })
      
      localStorage.setItem('alertAnnotations', JSON.stringify(storedAnnotations))
      setSelectedIds([])
      window.location.reload()
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 shadow rounded-md overflow-hidden">
      {selectedIds.length > 0 && (
        <div className="bg-blue-900/30 border-b border-blue-500 px-4 py-3 flex items-center justify-between">
          <span className="text-blue-200 text-sm font-medium">
            {selectedIds.length} alerta(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('em atendimento')}
              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
            >
              Em Atendimento
            </button>
            <button
              onClick={() => handleBulkStatusChange('agendado')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              Agendar
            </button>
            <button
              onClick={() => handleBulkStatusChange('falso-positivo')}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded transition-colors"
            >
              Falso-Positivo
            </button>
            <button
              onClick={() => handleBulkStatusChange('cancelado')}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleBulkStatusChange('fechado')}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      <table className="w-full">
        <thead className="bg-slate-800">
          <tr>
            <th className="text-left p-3 w-10 text-slate-200">
              <input
                type="checkbox"
                checked={selectedIds.length === sortedAlerts.length && sortedAlerts.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 cursor-pointer"
              />
            </th>
            <th className="text-left p-3 w-12 text-slate-200">Nº</th>
            <th className="text-left p-3 text-slate-200">Data/Hora</th>
            <th className="text-left p-3 flex-1 text-slate-200">Alertas</th>
            <th className="text-left p-3 text-slate-200">Level</th>
            <th className="text-left p-3 w-48 text-slate-200">Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedAlerts.map((a, idx) => {
            const description = a.rule?.description ?? a.full_log ?? '—'
            const timestamp = a['@timestamp'] ?? a.timestamp ?? '—'
            const level = a.rule?.level ?? '—'
            
            const alertData = storedAnnotations[a._id] || {}
            const status = alertData.status || '—'
            
            // Obter ID sequencial do alerta armazenado
            let alertId = alertRegistry[a._id]
            
            // Se não existe, criar novo registro
            if (!alertId && typeof window !== 'undefined') {
              const maxId = Object.values(alertRegistry).length > 0
                ? Math.max(...Object.values(alertRegistry) as number[])
                : 0
              alertId = maxId + 1
              alertRegistry[a._id] = alertId
              localStorage.setItem('alertRegistry', JSON.stringify(alertRegistry))
            }
            
            // Cores para status
            const getStatusColor = (s: string) => {
              switch (s) {
                case 'novo alerta': return 'bg-red-100 text-red-800'
                case 'em atendimento': return 'bg-yellow-100 text-yellow-800'
                case 'agendado': return 'bg-blue-100 text-blue-800'
                case 'fechado': return 'bg-green-100 text-green-800'
                case 'cancelado': return 'bg-gray-100 text-gray-800'
                case 'falso-positivo': return 'bg-orange-100 text-orange-800'
                case 'em homologação': return 'bg-purple-100 text-purple-800'
                default: return 'bg-gray-100 text-gray-800'
              }
            }
            
            // Definir status como "novo alerta" se não tiver sido definido
            const displayStatus = status === '—' || status === '' ? 'novo alerta' : status
            
            return (
              <tr
                key={a._id || idx}
                className="border-t border-slate-800 hover:bg-slate-800 transition-colors"
              >
                <td className="p-3 w-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(a._id)}
                    onChange={(e) => handleToggleSelect(a._id, e as any)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
                <td 
                  className="p-3 text-sm font-semibold text-center text-blue-600 w-12 cursor-pointer"
                  onClick={() => onAlertClick?.(a)}
                >
                  {alertId || '—'}
                </td>
                <td className="p-3 text-sm whitespace-nowrap text-slate-200 cursor-pointer" onClick={() => onAlertClick?.(a)}>{new Date(timestamp).toLocaleString()}</td>
                <td className="p-3 text-sm text-slate-200 cursor-pointer" onClick={() => onAlertClick?.(a)}>{description}</td>
                <td className="p-3 text-sm text-center text-slate-200 cursor-pointer" onClick={() => onAlertClick?.(a)}>{level}</td>
                <td className="p-3 text-sm cursor-pointer" onClick={() => onAlertClick?.(a)}>
                  <span className={`px-3 py-2 rounded text-xs font-semibold inline-block ${getStatusColor(displayStatus)}`}>
                    {displayStatus}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <Pagination page={page} pageSize={pageSize} itemsCount={alerts.length} onPageChange={onPageChange} />
      </div>
    </div>
  )
}
