"use client"

import React, { useState, useEffect } from 'react'
import { readStorageJson } from '@/lib/storage'

type AlertModalProps = {
  alert: any | null
  onClose: () => void
  onSave?: (updatedAlert: any) => void
}

const ASSIGNED_USERS = ['cristiano', 'administrator', 'operador']
const ALERT_STATUS = ['em atendimento', 'agendado', 'fechado', 'cancelado', 'falso-positivo', 'em homologação']
const ALLOWED_ATTACHMENT_EXTENSIONS = ['zip', 'xlsx', 'docx', 'txt']

type AlertNote = {
  text: string
  timestamp: string
  author?: string
}

type AlertAttachment = {
  name: string
  size: number
  type: string
  dataUrl: string
}

type AlertData = {
  notes: AlertNote[]
  assignedTo: string
  status: string
  attachment?: AlertAttachment | null
}

export default function AlertModal({ alert, onClose, onSave }: AlertModalProps) {
  const [newNote, setNewNote] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [status, setStatus] = useState('')
  const [noteHistory, setNoteHistory] = useState<AlertNote[]>([])
  const [selectedAttachment, setSelectedAttachment] = useState<AlertAttachment | null>(null)
  const [currentAttachment, setCurrentAttachment] = useState<AlertAttachment | null>(null)
  const [attachmentError, setAttachmentError] = useState('')

  useEffect(() => {
    if (alert) {
      const storedAnnotations = readStorageJson<Record<string, AlertData>>('alertAnnotations', {})
      const alertData: AlertData = storedAnnotations[alert._id] || { notes: [], assignedTo: '', status: '' }
      
      // Garantir que notes é sempre um array
      const notes = Array.isArray(alertData.notes) ? alertData.notes : []
      
      setNoteHistory(notes)
      setAssignedTo(alertData.assignedTo || '')
      setStatus(alertData.status || '')
      setCurrentAttachment(alertData.attachment || null)
      setSelectedAttachment(null)
      setAttachmentError('')
      setNewNote('')
    }
  }, [alert])

  if (!alert) return null

  const handleDownloadAttachment = (attachment: AlertAttachment) => {
    if (!attachment?.dataUrl) {
      setAttachmentError('Não foi possível baixar este anexo. Reenvie o arquivo neste alerta.')
      return
    }

    const link = document.createElement('a')
    link.href = attachment.dataUrl
    link.download = attachment.name || 'anexo'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedAttachment(null)
      setAttachmentError('')
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      const errorMessage = 'Formato inválido. Permitidos apenas: .zip, .xlsx, .docx, .txt'
      setAttachmentError(errorMessage)
      setSelectedAttachment(null)
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) {
        setAttachmentError('Falha ao processar o anexo. Tente novamente.')
        setSelectedAttachment(null)
        return
      }

      setAttachmentError('')
      setSelectedAttachment({
        name: file.name,
        size: file.size,
        type: file.type || extension,
        dataUrl
      })
    }
    reader.onerror = () => {
      setAttachmentError('Falha ao ler o arquivo selecionado.')
      setSelectedAttachment(null)
    }

    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!alert?._id) {
      console.error('Erro: Alerta sem ID')
      return
    }
    
    // Adicionar nova anotação ao histórico se não estiver vazia
    let updatedHistory = [...noteHistory]
    if (newNote.trim()) {
      updatedHistory.push({
        text: newNote.trim(),
        timestamp: new Date().toISOString(),
        author: assignedTo || 'anonimo'
      })
    }

    const alertData: AlertData = {
      notes: updatedHistory,
      assignedTo: assignedTo,
      status: status,
      attachment: selectedAttachment || currentAttachment || null
    }
    
    // Salvar em localStorage
    const storedAlerts = readStorageJson<Record<string, AlertData>>('alertAnnotations', {})
    storedAlerts[alert._id] = alertData
    localStorage.setItem('alertAnnotations', JSON.stringify(storedAlerts))
    
    onSave?.(alertData)
    onClose()
  }

  const formatTimestamp = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('pt-BR')
    } catch (e) {
      return isoString || '—'
    }
  }

  const description = alert?.rule?.description ?? alert?.full_log ?? '—'
  const timestamp = alert?.['@timestamp'] ?? alert?.timestamp ?? '—'
  const agentName = alert?.agent?.name ?? '—'
  const agentIp = alert?.agent?.ip ?? '—'
  const level = alert?.rule?.level ?? '—'
  const ruleId = alert?.rule?.id ?? '—'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-slate-900 rounded-lg border border-slate-700 shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 border-b p-4 flex justify-between items-center text-white shadow-md">
          <h2 className="text-lg font-bold">Detalhes do Alerta</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-slate-200 text-3xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Alert Details */}
          <div className="space-y-3 bg-slate-800 p-3 rounded border border-slate-700">
            <div>
              <span className="font-semibold text-slate-300 text-sm">Descrição:</span>
              <p className="text-slate-100 mt-1 text-xs line-clamp-2">{description}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="font-semibold text-slate-300 text-sm">Agent:</span>
                <p className="text-slate-100 text-sm mt-1">{agentName}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-300 text-sm">IP:</span>
                <p className="text-slate-100 text-sm mt-1">{agentIp}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-300 text-sm">Nível:</span>
                <p className="text-slate-100 font-mono font-bold mt-1">{level}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="font-semibold text-slate-300 text-sm">Rule ID:</span>
                <p className="text-slate-100 font-mono text-xs mt-1">{ruleId}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-300 text-sm">Data/Hora:</span>
                <p className="text-slate-100 text-xs mt-1">{timestamp === '—' ? timestamp : formatTimestamp(timestamp)}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-300 text-sm">Index:</span>
                <p className="text-slate-100 font-mono text-xs mt-1 break-all">{alert?.['_index'] || '—'}</p>
              </div>
            </div>
          </div>

          {/* Assigned User & Status */}
          <div className="grid grid-cols-2 gap-3">
            {/* Assigned User */}
            <div>
              <label className="block font-semibold text-slate-300 mb-2 text-sm">
                Atribuído a:
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Não atribuído</option>
                {ASSIGNED_USERS.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
              {assignedTo && (
                <p className="text-xs text-green-400 mt-1 font-semibold">
                  ✓ {assignedTo}
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block font-semibold text-slate-300 mb-2 text-sm">
                Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Selecione um status</option>
                {ALERT_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {status && (
                <p className="text-xs text-blue-400 mt-1 font-semibold">
                  ✓ {status}
                </p>
              )}
            </div>
          </div>

          {/* Notes History */}
          <div>
            <label className="block font-semibold text-slate-300 mb-2 text-sm">
              Anotações:
            </label>
            {noteHistory.length > 0 ? (
              <div className="bg-slate-800 rounded p-3 mb-2 space-y-2 max-h-48 overflow-y-auto border border-slate-700">
                {noteHistory.map((note, idx) => (
                  <div key={idx} className="bg-slate-900 p-2 rounded border-l-4 border-blue-500">
                    <p className="text-xs text-slate-100">{note?.text || '—'}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {note?.timestamp ? formatTimestamp(note.timestamp) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic mb-2">Nenhuma anotação</p>
            )}
          </div>

          {/* Attachment */}
          <div>
            <label className="block font-semibold text-slate-300 mb-2 text-sm">
              Anexo:
            </label>
            <input
              type="file"
              accept=".zip,.xlsx,.docx,.txt"
              onChange={handleAttachmentChange}
              className="w-full border border-slate-700 bg-slate-900 text-slate-100 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 rounded px-2 py-1 text-xs"
            />
            <p className="text-xs text-slate-400 mt-1">
              Formatos permitidos: .zip, .xlsx, .docx, .txt
            </p>
            {attachmentError && (
              <p className="text-xs text-red-400 mt-1 font-semibold">✗ {attachmentError}</p>
            )}
            {!attachmentError && selectedAttachment && (
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-xs text-green-400 font-semibold">
                  ✓ {selectedAttachment.name}
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(selectedAttachment)}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  ↓
                </button>
              </div>
            )}
            {!attachmentError && !selectedAttachment && currentAttachment && (
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-xs text-blue-400 font-semibold">
                  {currentAttachment.name}
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(currentAttachment)}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  ↓
                </button>
              </div>
            )}
          </div>

          {/* New Note Input */}
          <div>
            <label className="block font-semibold text-slate-300 mb-2 text-sm">
              Anotação:
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Digite uma anotação..."
              className="w-full border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-400 rounded px-2 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              Usuário: <span className="font-semibold">{assignedTo || 'anônimo'}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-3 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-600 text-slate-100 rounded hover:bg-slate-700 font-semibold text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
