"use client"

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export default function DetalhesPage() {
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])
  const [agentChartData, setAgentChartData] = useState<any[]>([])
  const [totalAlerts, setTotalAlerts] = useState(0)
  const [levelFilter, setLevelFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [availableAgents, setAvailableAgents] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const formatInputDate = (value: string) => {
    if (!value) return '...'
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Buscar todos os alertas em lotes para evitar truncamento em 500
        const batchSize = 500
        // Elasticsearch geralmente limita paginação por from/size em 10k (max_result_window)
        const maxAlerts = 10000
        let offset = 0
        let alerts: any[] = []
        let totalFromApi: number | null = null

        while (offset < maxAlerts) {
          const params = new URLSearchParams()
          params.set('limit', String(batchSize))
          params.set('offset', String(offset))
          if (levelFilter) params.set('level', levelFilter)

          const res = await fetch(`/api/alerts?${params.toString()}`)
          if (!res.ok) {
            // Mantém os lotes já coletados em vez de zerar tudo se algum lote falhar
            break
          }

          const data = await res.json()
          const hits = Array.isArray(data?.hits?.hits) ? data.hits.hits : []

          if (totalFromApi === null) {
            totalFromApi = data?.hits?.total?.value ?? data?.hits?.total ?? null
          }

          if (hits.length === 0) break

          alerts = alerts.concat(hits.map((hit: any) => hit._source))
          offset += hits.length

          if (hits.length < batchSize) break
          if (totalFromApi !== null && offset >= totalFromApi) break
        }

        // Extrair agentes únicos
        const agentSet = new Set<string>()
        alerts.forEach(alert => {
          const agentName = alert.agent?.name
          if (agentName) agentSet.add(agentName)
        })
        setAvailableAgents(Array.from(agentSet).sort())

        // Filtrar por agente se necessário
        let filteredAlerts = alerts
        if (agentFilter) {
          filteredAlerts = filteredAlerts.filter(alert => alert.agent?.name === agentFilter)
        }

        // Filtrar por período se necessário
        if (startDate || endDate) {
          const startBoundary = startDate
            ? new Date(parseLocalDate(startDate).setHours(0, 0, 0, 0))
            : null
          const endBoundary = endDate
            ? new Date(parseLocalDate(endDate).setHours(23, 59, 59, 999))
            : null

          filteredAlerts = filteredAlerts.filter(alert => {
            const alertDate = new Date(alert['@timestamp'] || alert.timestamp)

            if (startBoundary && alertDate < startBoundary) return false
            if (endBoundary && alertDate > endBoundary) return false
            return true
          })
        }

        setTotalAlerts(filteredAlerts.length)

        // Contar descrições de alertas
        const descriptionCount: Record<string, number> = {}
        
        filteredAlerts.forEach(alert => {
          const description = alert.rule?.description || 'Sem descrição'
          descriptionCount[description] = (descriptionCount[description] || 0) + 1
        })

        // Converter para array e ordenar por quantidade
        const sortedData = Object.entries(descriptionCount)
          .map(([description, count]) => ({
            description: description.length > 60 ? description.substring(0, 60) + '...' : description,
            fullDescription: description,
            count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15) // Top 15

        // Contar alertas por agente
        const agentCount: Record<string, number> = {}

        filteredAlerts.forEach(alert => {
          const agentName = alert.agent?.name || 'Agente desconhecido'
          agentCount[agentName] = (agentCount[agentName] || 0) + 1
        })

        const sortedAgentData = Object.entries(agentCount)
          .map(([agentName, count]) => ({
            agentName,
            count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15) // Top 15

        setChartData(sortedData)
        setAgentChartData(sortedAgentData)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [levelFilter, agentFilter, startDate, endDate])

  const COLORS = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1',
    '#84cc16', '#f43f5e', '#22c55e', '#a855f7', '#0ea5e9'
  ]

  return (
    <div>
      <Header />
      <main className="container py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Análise Detalhada de Alertas</h2>
          <p className="text-slate-400">
            Visualização das descrições de alertas mais frequentes no sistema
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6 bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">🔍 Filtros</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Nível:</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
              >
                <option value="">Todos</option>
                <option value="0">Nível 0</option>
                <option value="1">Nível 1</option>
                <option value="2">Nível 2</option>
                <option value="3">Nível 3</option>
                <option value="4">Nível 4</option>
                <option value="5">Nível 5</option>
                <option value="6">Nível 6</option>
                <option value="7">Nível 7</option>
                <option value="8">Nível 8</option>
                <option value="9">Nível 9</option>
                <option value="10">Nível 10+</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Agente:</label>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
              >
                <option value="">Todos os Agentes</option>
                {availableAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">De:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300 font-medium min-w-[60px]">Até:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
              />
            </div>
          </div>
        </div>

        {/* Indicador de filtro ativo */}
        {(levelFilter || agentFilter || startDate || endDate) && (
          <div className="mb-4 px-4 py-2 bg-blue-900/30 border border-blue-500 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-blue-200 text-sm">
                📊 Mostrando alertas
                {levelFilter && <strong className="ml-1">Nível {levelFilter}</strong>}
                {(levelFilter && (agentFilter || startDate || endDate)) && <span className="mx-1">•</span>}
                {agentFilter && <strong>Agente: {agentFilter}</strong>}
                {(agentFilter && (startDate || endDate)) && <span className="mx-1">•</span>}
                {(startDate || endDate) && (
                  <strong>
                    Período: {formatInputDate(startDate)} até {formatInputDate(endDate)}
                  </strong>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {levelFilter && (
                <button
                  onClick={() => setLevelFilter('')}
                  className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
                >
                  ✕ Nível
                </button>
              )}
              {agentFilter && (
                <button
                  onClick={() => setAgentFilter('')}
                  className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
                >
                  ✕ Agente
                </button>
              )}
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate('') }}
                  className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
                >
                  ✕ Período
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cards de Resumo */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-blue-300 mb-2">Total de Alertas</div>
            <div className="text-3xl font-bold text-blue-100">{totalAlerts.toLocaleString()}</div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-green-300 mb-2">Tipos Únicos</div>
            <div className="text-3xl font-bold text-green-100">{chartData.length}</div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-orange-300 mb-2">Agentes Ativos</div>
            <div className="text-3xl font-bold text-orange-100">{availableAgents.length}</div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-purple-300 mb-2">Mais Frequente</div>
            <div className="text-lg font-bold text-purple-100">
              {chartData[0]?.count.toLocaleString() || 0} ocorrências
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-slate-100 mb-6">
            Top 15 Descrições de Alertas Mais Gerados
            {(levelFilter || agentFilter || startDate || endDate) && (
              <span className="text-blue-400 text-base ml-2">
                ({[levelFilter && `Nível ${levelFilter}`, agentFilter, (startDate || endDate) && 'Período'].filter(Boolean).join(' • ')})
              </span>
            )}
          </h3>
          
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-slate-400">Carregando dados...</div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-slate-400">Nenhum dado disponível</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="description" 
                  angle={-45} 
                  textAnchor="end" 
                  height={150}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#e2e8f0'
                  }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value} ocorrências`,
                    props.payload.fullDescription
                  ]}
                />
                <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                <Bar dataKey="count" name="Quantidade de Alertas">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico - Top 15 por Agente */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mt-8">
          <h3 className="text-xl font-semibold text-slate-100 mb-6">
            Top 15 Agentes com Mais Alertas Gerados
            {(levelFilter || agentFilter || startDate || endDate) && (
              <span className="text-blue-400 text-base ml-2">
                ({[levelFilter && `Nível ${levelFilter}`, agentFilter, (startDate || endDate) && 'Período'].filter(Boolean).join(' • ')})
              </span>
            )}
          </h3>

          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-slate-400">Carregando dados...</div>
            </div>
          ) : agentChartData.length === 0 ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-slate-400">Nenhum dado disponível</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <BarChart
                data={agentChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="agentName"
                  angle={-45}
                  textAnchor="end"
                  height={150}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#e2e8f0'
                  }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value} ocorrências`,
                    props.payload.agentName
                  ]}
                />
                <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                <Bar dataKey="count" name="Quantidade por Agente">
                  {agentChartData.map((entry, index) => (
                    <Cell key={`agent-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela com Detalhes */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg mt-8 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-slate-100">Detalhamento</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left p-3 text-slate-200 w-12">#</th>
                  <th className="text-left p-3 text-slate-200">Descrição do Alerta</th>
                  <th className="text-center p-3 text-slate-200 w-32">Quantidade</th>
                  <th className="text-center p-3 text-slate-200 w-32">Percentual</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((item, index) => {
                  const percentage = totalAlerts > 0 ? ((item.count / totalAlerts) * 100).toFixed(2) : 0
                  return (
                    <tr key={index} className="border-t border-slate-800 hover:bg-slate-800">
                      <td className="p-3 text-slate-300 font-semibold text-center">{index + 1}</td>
                      <td className="p-3 text-slate-200">{item.fullDescription}</td>
                      <td className="p-3 text-slate-200 text-center font-semibold">{item.count.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className="px-3 py-1 rounded text-sm font-semibold" style={{ backgroundColor: COLORS[index % COLORS.length], color: '#fff' }}>
                          {percentage}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
