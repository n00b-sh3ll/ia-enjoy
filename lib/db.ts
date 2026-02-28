import { prisma } from './prisma'

/**
 * Sincroniza alertas do Elasticsearch para o banco de dados SQLite
 */
export async function syncAlertsFromES(alerts: any[]) {
  try {
    // Preparar dados para inserção/atualização
    const upsertPromises = alerts.map((alert) =>
      prisma.alert.upsert({
        where: { id: alert._id },
        update: {
          timestamp: new Date(alert['@timestamp'] || alert.timestamp),
          description: alert.rule?.description || '',
          level: Number(alert.rule?.level ?? 0),
          agentName: alert.agent?.name || 'unknown',
          ruleName: alert.rule?.name || '',
          ruleId: alert.rule?.id || '',
          source: alert.source_ip || null,
          destination: alert.destination_ip || null,
          updatedAt: new Date(),
        },
        create: {
          id: alert._id,
          timestamp: new Date(alert['@timestamp'] || alert.timestamp),
          description: alert.rule?.description || '',
          level: Number(alert.rule?.level ?? 0),
          agentName: alert.agent?.name || 'unknown',
          ruleName: alert.rule?.name || '',
          ruleId: alert.rule?.id || '',
          source: alert.source_ip || null,
          destination: alert.destination_ip || null,
        },
      })
    )

    const upsertedAlerts = await Promise.all(upsertPromises)

    // Registrar sincronização
    await prisma.syncLog.create({
      data: {
        alertsCount: upsertedAlerts.length,
        status: 'success',
      },
    })

    return { success: true, count: upsertedAlerts.length }
  } catch (error: any) {
    console.error('[DB Sync Error]', error)

    // Registrar erro de sincronização
    await prisma.syncLog.create({
      data: {
        alertsCount: 0,
        status: 'error',
        error: error?.message || 'Unknown error',
      },
    })

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
  const where: any = {}

  if (filters?.level !== undefined) {
    where.level = filters.level
  }

  if (filters?.agentName) {
    where.agentName = {
      contains: filters.agentName,
      mode: 'insensitive',
    }
  }

  if (filters?.search) {
    where.description = {
      contains: filters.search,
      mode: 'insensitive',
    }
  }

  if (filters?.startDate || filters?.endDate) {
    where.timestamp = {}
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate
    }
    if (filters.endDate) {
      where.timestamp.lte = filters.endDate
    }
  }

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: {
        annotation: {
          include: {
            attachments: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.alert.count({ where }),
  ])

  return { alerts, total }
}

/**
 * Obtém estatísticas de alertas
 */
export async function getAlertStats() {
  const [total, closed, inProgress, scheduled, falsePositive, canceled, inHomologation] = await Promise.all([
    prisma.alert.count(),
    prisma.alert.count({
      where: {
        annotation: {
          status: 'fechado',
        },
      },
    }),
    prisma.alert.count({
      where: {
        annotation: {
          status: 'em atendimento',
        },
      },
    }),
    prisma.alert.count({
      where: {
        annotation: {
          status: 'agendado',
        },
      },
    }),
    prisma.alert.count({
      where: {
        annotation: {
          status: 'falso-positivo',
        },
      },
    }),
    prisma.alert.count({
      where: {
        annotation: {
          status: 'cancelado',
        },
      },
    }),
    prisma.alert.count({
      where: {
        annotation: {
          status: 'em homologação',
        },
      },
    }),
  ])

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
  return prisma.alertAnnotation.upsert({
    where: { alertId },
    update: {
      status,
      notes: notes || undefined,
      assignedTo: assignedTo || undefined,
      updatedAt: new Date(),
    },
    create: {
      alertId,
      status,
      notes: notes || '',
      assignedTo: assignedTo || '',
    },
  })
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
  const annotation = await prisma.alertAnnotation.upsert({
    where: { alertId },
    update: {},
    create: { alertId },
  })

  return prisma.attachment.create({
    data: {
      annotationId: annotation.id,
      fileName,
      fileType,
      fileSize,
      fileData,
    },
  })
}

/**
 * Deleta anexo
 */
export async function deleteAttachment(attachmentId: string) {
  return prisma.attachment.delete({
    where: { id: attachmentId },
  })
}

/**
 * Busca última sincronização
 */
export async function getLastSyncLog() {
  return prisma.syncLog.findFirst({
    orderBy: { lastSync: 'desc' },
  })
}
