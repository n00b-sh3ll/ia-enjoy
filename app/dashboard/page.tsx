"use client"

import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'
import AlertList from '@/components/AlertList'
import AlertModal from '@/components/AlertModal'
import AlertRegistry from '@/components/AlertRegistry'
import { readStorageJson } from '@/lib/storage'

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null)
  const [totalAlerts, setTotalAlerts] = useState(0)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [levelFilter, setLevelFilter] = useState('')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('timestamp-desc')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const offset = (p - 1) * pageSize
      const params = new URLSearchParams()
      // Buscar mais alertas se houver filtro de data ou busca textual (filtraremos no cliente)
      const fetchLimit = (startDate || endDate || query) ? 500 : pageSize
      params.set('limit', String(fetchLimit))
      params.set('offset', String(offset))
      if (levelFilter) params.set('level', levelFilter)

      const res = await fetch(`/api/alerts?${params.toString()}`)
      const contentType = res.headers.get('content-type') || ''

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Falha ao buscar alertas (${res.status}). ${errorText.slice(0, 180)}`)
      }

      if (!contentType.includes('application/json')) {
        const bodyPreview = await res.text()
        throw new Error(`Resposta inválida da API (esperado JSON). Recebido: ${bodyPreview.slice(0, 120)}`)
      }

      const data = await res.json()
      // Elasticsearch retorna em data.hits.hits; mapear _source para formato legível
      let list: any[] = []
      if (data.hits?.hits && Array.isArray(data.hits.hits)) {
        list = data.hits.hits.map((hit: any) => ({
          ...hit._source,
          _id: hit._id,
          _index: hit._index
        }))
        // Capturar total de alertas do Elasticsearch
        const total = data.hits?.total?.value ?? data.hits?.total ?? 0
        setTotalAlerts(total)
      } else if (data.alerts || data.data) {
        list = data.alerts || data.data
      }

      // Filtrar por período se necessário
      if (startDate || endDate) {
        list = list.filter(alert => {
          const alertDate = new Date(alert['@timestamp'] || alert.timestamp)
          const start = startDate ? new Date(startDate) : null
          const end = endDate ? new Date(endDate) : null
          
          if (start && alertDate < start) return false
          if (end) {
            // Adicionar 23:59:59 ao final do dia
            const endOfDay = new Date(end)
            endOfDay.setHours(23, 59, 59, 999)
            if (alertDate > endOfDay) return false
          }
          return true
        })
      }

      // Filtrar por query (case-insensitive)
      if (query && query.trim()) {
        const searchTerm = query.trim().toLowerCase()
        list = list.filter(alert => {
          const description = (alert.rule?.description || '').toLowerCase()
          return description.includes(searchTerm)
        })
      }

      setAlerts(Array.isArray(list) ? list : [])
    } catch (err: any) {
      setError(err?.message || String(err))
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [pageSize, levelFilter, query, startDate, endDate])

  const handleAlertClick = (alert: any) => {
    // Passar apenas o alerta - o modal carregará as anotações do localStorage
    setSelectedAlert(alert)
  }

  useEffect(() => {
    fetchPage(page)
  }, [page, pageSize, levelFilter, query, fetchPage])

  // Calcular estatísticas dos alertas
  const getAlertStats = () => {
    const alertAnnotations = readStorageJson<Record<string, any>>('alertAnnotations', {})

    const closed = Object.values(alertAnnotations).filter((a: any) => a.status === 'fechado').length
    const inProgress = Object.values(alertAnnotations).filter((a: any) => a.status === 'em atendimento').length
    const scheduled = Object.values(alertAnnotations).filter((a: any) => a.status === 'agendado').length
    const falsePositive = Object.values(alertAnnotations).filter((a: any) => a.status === 'falso-positivo').length
    const canceled = Object.values(alertAnnotations).filter((a: any) => a.status === 'cancelado').length
    const inHomologation = Object.values(alertAnnotations).filter((a: any) => a.status === 'em homologação').length
    const annotated = Object.keys(alertAnnotations).length
    const newAlerts = totalAlerts - annotated

    return { total: totalAlerts, closed, inProgress, scheduled, falsePositive, canceled, inHomologation, newAlerts }
  }

  const stats = getAlertStats()

  return (
    <div>
      <Header />
      <main className="container py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div 
            onClick={() => setStatusFilter(statusFilter === 'all' ? '' : 'all')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'all' 
                ? 'bg-blue-900/40 border-2 border-blue-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-blue-300">Total de Alertas</div>
            <div className="text-3xl font-bold text-blue-100 mt-2">{stats.total}</div>
            <div className="text-xs text-blue-400 mt-1">no sistema</div>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'novo alerta' ? '' : 'novo alerta')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'novo alerta' 
                ? 'bg-red-900/40 border-2 border-red-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-red-300">Novos</div>
            <div className="text-3xl font-bold text-red-100 mt-2">{stats.newAlerts}</div>
            <div className="text-xs text-red-400 mt-1">não atendidos</div>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'em atendimento' ? '' : 'em atendimento')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'em atendimento' 
                ? 'bg-yellow-900/40 border-2 border-yellow-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-yellow-300">Em Atendimento</div>
            <div className="text-3xl font-bold text-yellow-100 mt-2">{stats.inProgress}</div>
            <div className="text-xs text-yellow-400 mt-1">em processamento</div>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'fechado' ? '' : 'fechado')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'fechado' 
                ? 'bg-green-900/40 border-2 border-green-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-green-300">Fechados</div>
            <div className="text-3xl font-bold text-green-100 mt-2">{stats.closed}</div>
            <div className="text-xs text-green-400 mt-1">resolvidos</div>
          </div>
        </div>

        {/* Segunda linha de status */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div 
            onClick={() => setStatusFilter(statusFilter === 'agendado' ? '' : 'agendado')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'agendado' 
                ? 'bg-blue-900/40 border-2 border-blue-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-blue-300">Agendados</div>
            <div className="text-3xl font-bold text-blue-100 mt-2">{stats.scheduled}</div>
            <div className="text-xs text-blue-400 mt-1">para análise futura</div>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'falso-positivo' ? '' : 'falso-positivo')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'falso-positivo' 
                ? 'bg-orange-900/40 border-2 border-orange-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-orange-300">Falso-Positivo</div>
            <div className="text-3xl font-bold text-orange-100 mt-2">{stats.falsePositive}</div>
            <div className="text-xs text-orange-400 mt-1">sem ação necessária</div>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'cancelado' ? '' : 'cancelado')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'cancelado' 
                ? 'bg-gray-900/40 border-2 border-gray-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-gray-300">Cancelados</div>
            <div className="text-3xl font-bold text-gray-100 mt-2">{stats.canceled}</div>
            <div className="text-xs text-gray-400 mt-1">descartados</div>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'em homologação' ? '' : 'em homologação')}
            className={`rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'em homologação' 
                ? 'bg-purple-900/40 border-2 border-purple-500 shadow-md' 
                : 'bg-slate-900 border border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold text-purple-300">Em Homologação</div>
            <div className="text-3xl font-bold text-purple-100 mt-2">{stats.inHomologation}</div>
            <div className="text-xs text-purple-400 mt-1">em teste</div>
          </div>
        </div>

        {/* Indicador de filtro por período */}
        {(startDate || endDate) && (
          <div className="mb-4 px-4 py-2 bg-blue-900/30 border border-blue-500 rounded-md flex items-center justify-between">
            <span className="text-blue-200 text-sm">
              📅 Filtrando por período: {startDate ? new Date(startDate).toLocaleDateString('pt-BR') : '...'} até {endDate ? new Date(endDate).toLocaleDateString('pt-BR') : '...'}
            </span>
            <button
              onClick={() => { setStartDate(''); setEndDate('') }}
              className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
            >
              ✕ Limpar período
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-100">Alertas</h2>
            <button
              onClick={() => fetchPage(page)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Atualizar alertas"
            >
              <svg 
                className={`w-5 h-5 text-slate-300 ${loading ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {statusFilter && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/40 border border-blue-500 rounded-md">
                <span className="text-sm text-blue-200 font-medium">
                  Filtro: {
                    statusFilter === 'all' ? 'Todos' :
                    statusFilter === 'novo alerta' ? 'Novos' :
                    statusFilter === 'em atendimento' ? 'Em Atendimento' :
                    statusFilter === 'fechado' ? 'Fechados' :
                    statusFilter === 'agendado' ? 'Agendados' :
                    statusFilter === 'falso-positivo' ? 'Falso-Positivo' :
                    statusFilter === 'cancelado' ? 'Cancelados' :
                    statusFilter === 'em homologação' ? 'Em Homologação' :
                    statusFilter
                  }
                </span>
                <button 
                  onClick={() => setStatusFilter('')}
                  className="text-blue-300 hover:text-blue-100 font-bold"
                  title="Limpar filtro"
                >
                  ×
                </button>
              </div>
            )}
            <AlertRegistry />
          </div>
        </div>

        {/* Painel de Filtros */}
        <div className="mb-6 bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Ordenar:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-2 py-1 text-sm flex-1"
              >
                <option value="timestamp-desc">Mais recentes</option>
                <option value="timestamp-asc">Mais antigos</option>
                <option value="level-desc">Nível ↓</option>
                <option value="level-asc">Nível ↑</option>
                <option value="status-new">Novos primeiro</option>
                <option value="id-asc">ID ↑</option>
                <option value="id-desc">ID ↓</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Nível:</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-2 py-1 text-sm flex-1"
              >
                <option value="">Todos</option>
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">De:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-2 py-1 text-sm flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Até:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-2 py-1 text-sm flex-1"
              />
            </div>

            <div className="flex items-center gap-2 col-span-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Buscar:</label>
              <input
                placeholder="Buscar por descrição..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-400 rounded px-2 py-1 text-sm flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Por página:</label>
              <select 
                value={pageSize} 
                onChange={(e) => setPageSize(Number(e.target.value))} 
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-2 py-1 text-sm flex-1"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
            </div>
          </div>
        </div>

        <AlertList
          alerts={alerts}
          loading={loading}
          error={error}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onAlertClick={handleAlertClick}
          sortBy={sortBy}
          statusFilter={statusFilter}
        />

        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onSave={(updated) => setSelectedAlert(updated)}
        />
      </main>
    </div>
  )
}
