import Database from 'better-sqlite3'
import path from 'path'
import { randomUUID } from 'crypto'

const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'dev.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    level INTEGER NOT NULL DEFAULT 0,
    agent_name TEXT NOT NULL DEFAULT 'unknown',
    rule_name TEXT NOT NULL DEFAULT '',
    rule_id TEXT NOT NULL DEFAULT '',
    source TEXT,
    destination TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS alert_annotations (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    assigned_to TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(alert_id) REFERENCES alerts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    annotation_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(annotation_id) REFERENCES alert_annotations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    last_sync TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    alerts_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
  CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
  CREATE INDEX IF NOT EXISTS idx_alerts_agent_name ON alerts(agent_name);
  CREATE INDEX IF NOT EXISTS idx_alert_annotations_alert_id ON alert_annotations(alert_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_annotation_id ON attachments(annotation_id);
  CREATE INDEX IF NOT EXISTS idx_sync_logs_last_sync ON sync_logs(last_sync DESC);
`)

const upsertAlertStmt = db.prepare(`
  INSERT INTO alerts (
    id, timestamp, description, level, agent_name, rule_name, rule_id, source, destination, updated_at
  )
  VALUES (
    @id, @timestamp, @description, @level, @agentName, @ruleName, @ruleId, @source, @destination, @updatedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    timestamp = excluded.timestamp,
    description = excluded.description,
    level = excluded.level,
    agent_name = excluded.agent_name,
    rule_name = excluded.rule_name,
    rule_id = excluded.rule_id,
    source = excluded.source,
    destination = excluded.destination,
    updated_at = excluded.updated_at
`)

const insertSyncLogStmt = db.prepare(`
  INSERT INTO sync_logs (id, last_sync, alerts_count, status, error)
  VALUES (?, ?, ?, ?, ?)
`)

const getAnnotationByAlertStmt = db.prepare(`
  SELECT id, alert_id, status, notes, assigned_to, created_at, updated_at
  FROM alert_annotations
  WHERE alert_id = ?
`)

const getAttachmentsByAnnotationStmt = db.prepare(`
  SELECT id, annotation_id, file_name, file_type, file_size, file_data, created_at
  FROM attachments
  WHERE annotation_id = ?
`)

const upsertAnnotationStmt = db.prepare(`
  INSERT INTO alert_annotations (id, alert_id, status, notes, assigned_to, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(alert_id) DO UPDATE SET
    status = excluded.status,
    notes = excluded.notes,
    assigned_to = excluded.assigned_to,
    updated_at = excluded.updated_at
`)

const insertAttachmentStmt = db.prepare(`
  INSERT INTO attachments (id, annotation_id, file_name, file_type, file_size, file_data)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const deleteAttachmentStmt = db.prepare(`
  DELETE FROM attachments WHERE id = ?
`)

function toIsoTimestamp(value: string | Date | undefined) {
  if (!value) return new Date().toISOString()
  return new Date(value).toISOString()
}

function mapAlertRow(row: any, annotation: any) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    description: row.description,
    level: row.level,
    agentName: row.agent_name,
    ruleName: row.rule_name,
    ruleId: row.rule_id,
    source: row.source,
    destination: row.destination,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    annotation,
  }
}

/**
 * Sincroniza alertas do Elasticsearch para o banco de dados SQLite
 */
export async function syncAlertsFromES(alerts: any[]) {
  try {
    const nowIso = new Date().toISOString()

    const upsertMany = db.transaction((items: any[]) => {
      for (const alert of items) {
        const source = alert?._source || alert

        upsertAlertStmt.run({
          id: String(alert._id),
          timestamp: toIsoTimestamp(source['@timestamp'] || source.timestamp),
          description: String(source.rule?.description || ''),
          level: Number(source.rule?.level ?? 0),
          agentName: String(source.agent?.name || 'unknown'),
          ruleName: String(source.rule?.name || ''),
          ruleId: String(source.rule?.id || ''),
          source: source.source_ip || null,
          destination: source.destination_ip || null,
          updatedAt: nowIso,
        })
      }
    })

    upsertMany(alerts)

    insertSyncLogStmt.run(randomUUID(), nowIso, alerts.length, 'success', null)

    return { success: true, count: alerts.length }
  } catch (error: any) {
    console.error('[DB Sync Error]', error)

    try {
      insertSyncLogStmt.run(
        randomUUID(),
        new Date().toISOString(),
        0,
        'error',
        error?.message || 'Unknown error'
      )
    } catch (e) {
      console.error('[DB Sync Log Error]', e)
    }

    throw error
  }
}

/**
 * Busca alertas do banco de dados com filtros opcionais
 */
export async function getAlertsFromDB(
  limit: number = 50,
  offset: number = 0,
  filters?: {
    level?: number
    agentName?: string
    startDate?: Date
    endDate?: Date
    search?: string
  }
) {
  const whereClauses: string[] = []
  const params: any[] = []

  if (filters?.level !== undefined) {
    whereClauses.push('level = ?')
    params.push(filters.level)
  }

  if (filters?.agentName) {
    whereClauses.push('LOWER(agent_name) LIKE ?')
    params.push(`%${filters.agentName.toLowerCase()}%`)
  }

  if (filters?.search) {
    whereClauses.push('LOWER(description) LIKE ?')
    params.push(`%${filters.search.toLowerCase()}%`)
  }

  if (filters?.startDate) {
    whereClauses.push('timestamp >= ?')
    params.push(filters.startDate.toISOString())
  }

  if (filters?.endDate) {
    whereClauses.push('timestamp <= ?')
    params.push(filters.endDate.toISOString())
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const totalRow = db
    .prepare(`SELECT COUNT(1) as total FROM alerts ${whereSql}`)
    .get(...params) as { total: number }

  const alertRows = db
    .prepare(
      `SELECT id, timestamp, description, level, agent_name, rule_name, rule_id, source, destination, created_at, updated_at
       FROM alerts
       ${whereSql}
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)

  const alerts = alertRows.map((row: any) => {
    const annotationRow = getAnnotationByAlertStmt.get(row.id) as any
    let annotation: any = null

    if (annotationRow) {
      const attachmentRows = getAttachmentsByAnnotationStmt.all(annotationRow.id) as any[]
      annotation = {
        id: annotationRow.id,
        alertId: annotationRow.alert_id,
        status: annotationRow.status,
        notes: annotationRow.notes,
        assignedTo: annotationRow.assigned_to,
        createdAt: annotationRow.created_at,
        updatedAt: annotationRow.updated_at,
        attachments: attachmentRows.map((item) => ({
          id: item.id,
          annotationId: item.annotation_id,
          fileName: item.file_name,
          fileType: item.file_type,
          fileSize: item.file_size,
          fileData: item.file_data,
          createdAt: item.created_at,
        })),
      }
    }

    return mapAlertRow(row, annotation)
  })

  return { alerts, total: totalRow?.total || 0 }
}

/**
 * Obtém estatísticas de alertas
 */
export async function getAlertStats() {
  const total = (db.prepare('SELECT COUNT(1) as value FROM alerts').get() as any)?.value || 0

  const countByStatus = (status: string) => {
    const row = db
      .prepare('SELECT COUNT(1) as value FROM alert_annotations WHERE status = ?')
      .get(status) as any
    return row?.value || 0
  }

  const closed = countByStatus('fechado')
  const inProgress = countByStatus('em atendimento')
  const scheduled = countByStatus('agendado')
  const falsePositive = countByStatus('falso-positivo')
  const canceled = countByStatus('cancelado')
  const inHomologation = countByStatus('em homologação')

  const newAlerts = total - (closed + inProgress + scheduled + falsePositive + canceled + inHomologation)

  return {
    total,
    closed,
    inProgress,
    scheduled,
    falsePositive,
    canceled,
    inHomologation,
    newAlerts,
  }
}

/**
 * Atualiza anotação de um alerta
 */
export async function updateAlertAnnotation(
  alertId: string,
  status: string,
  notes?: string,
  assignedTo?: string
) {
  const nowIso = new Date().toISOString()
  const existing = getAnnotationByAlertStmt.get(alertId) as any
  const annotationId = existing?.id || randomUUID()

  upsertAnnotationStmt.run(
    annotationId,
    alertId,
    status,
    notes || '',
    assignedTo || '',
    nowIso
  )

  const row = getAnnotationByAlertStmt.get(alertId) as any
  return {
    id: row.id,
    alertId: row.alert_id,
    status: row.status,
    notes: row.notes,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Adiciona anexo a um alerta
 */
export async function addAttachment(
  alertId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  fileData: string
) {
  const nowIso = new Date().toISOString()
  const existing = getAnnotationByAlertStmt.get(alertId) as any
  const annotationId = existing?.id || randomUUID()

  upsertAnnotationStmt.run(annotationId, alertId, existing?.status || '', existing?.notes || '', existing?.assigned_to || '', nowIso)

  const attachmentId = randomUUID()
  insertAttachmentStmt.run(attachmentId, annotationId, fileName, fileType, fileSize, fileData)

  return {
    id: attachmentId,
    annotationId,
    fileName,
    fileType,
    fileSize,
    fileData,
    createdAt: nowIso,
  }
}

/**
 * Remove anexo de um alerta
 */
export async function deleteAttachment(attachmentId: string) {
  const existing = db.prepare('SELECT id FROM attachments WHERE id = ?').get(attachmentId) as any
  if (!existing) {
    throw new Error('Attachment not found')
  }

  deleteAttachmentStmt.run(attachmentId)
  return { id: attachmentId }
}

/**
 * Obtém último registro de sincronização
 */
export async function getLastSyncLog() {
  const row = db
    .prepare(
      `SELECT id, last_sync, alerts_count, status, error
       FROM sync_logs
       ORDER BY last_sync DESC
       LIMIT 1`
    )
    .get() as any

  if (!row) return null

  return {
    id: row.id,
    lastSync: row.last_sync,
    alertsCount: row.alerts_count,
    status: row.status,
    error: row.error,
  }
}
