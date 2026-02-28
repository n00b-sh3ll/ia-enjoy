# Prisma + SQLite Integration

Este projeto utiliza **Prisma ORM** com **SQLite** para sincronizar e gerenciar alertas do Elasticsearch.

## 📊 Arquitetura

```
Elasticsearch (Source)
        ↓ (SSH Python Query)
/api/sync-alerts (Sincronização manual/periódica)
        ↓ (Upsert)
SQLite (Cache de alertas + anotações)
        ↓
/api/alerts (Busca do banco de dados)
        ↓
Dashboard/Detalhes (UI)
```

## 📁 Estrutura Prisma

```
prisma/
├── schema.prisma       # Definição dos modelos
├── migrations/         # Histórico de mudanças no schema
└── dev.db             # Arquivo SQLite local
```

## 🗄️ Modelos de Dados

### Alert
Armazena informações dos alertas sincronizados do Elasticsearch:
- `id` - ID único do alerta (vindo do ES)
- `timestamp` - Data e hora do alerta
- `description` - Descrição da regra
- `level` - Nível de severidade (0-15)
- `agentName` - Nome do agente/host
- `ruleName` - Nome da regra de detecção
- `ruleId` - ID da regra
- `source`, `destination` - IPs de origem/destino
- Índices em: timestamp, level, agentName

### AlertAnnotation
Anotações, status e informações do usuário sobre os alertas:
- `id` - ID único (CUID)
- `alertId` - Referência ao Alert
- `status` - Status atual (em atendimento, fechado, etc)
- `notes` - Notas do analista
- `assignedTo` - Responsável atribuído
- Relacionamento 1:1 com Alert

### Attachment
Arquivos anexados aos alertas:
- `id` - ID único (CUID)
- `annotationId` - Referência à anotação
- `fileName`, `fileType`, `fileSize`
- `fileData` - Dados em Base64
- Índice em: annotationId

### SyncLog
Log de sincronizações para auditoria:
- `id` - ID único (CUID)
- `lastSync` - Timestamp da última sincronização
- `alertsCount` - Quantidade de alertas sincronizados
- `status` - Resultado (success/error)
- `error` - Mensagem de erro se houver

## 🔄 Sincronização

### Manual (Via Dashboard)
Botão "Sincronizar Alertas" na página principal:
```
POST /api/sync-alerts
Body: { limit: 500 }
```

### Automática (Futuro)
Adicionar cron job ou scheduler para sincronização periódica:
```typescript
// Exemplo com node-cron
import cron from 'node-cron'
cron.schedule('*/5 * * * *', async () => {
  await syncAlertsFromES(...)
})
```

## 📚 Funções Disponíveis

### Imports
```typescript
import {
  syncAlertsFromES,      // Sincronizar do ES
  getAlertsFromDB,       // Buscar com filtros
  getAlertStats,         // Estatísticas
  updateAlertAnnotation, // Atualizar status/notas
  addAttachment,         // Adicionar arquivo
  deleteAttachment,      // Remover arquivo
  getLastSyncLog,        // Última sincronização
} from '@/lib/db'
```

### Exemplos

**Sincronizar alertas:**
```typescript
const result = await syncAlertsFromES(alertsFromES)
// { success: true, count: 250 }
```

**Buscar com filtros:**
```typescript
const { alerts, total } = await getAlertsFromDB(50, 0, {
  level: 7,
  agentName: 'web-server',
  search: 'autenticação',
  startDate: new Date('2026-02-01'),
  endDate: new Date('2026-02-28'),
})
```

**Atualizar anotação:**
```typescript
await updateAlertAnnotation(alertId, 'em atendimento', 'Investigando...', 'analista@example.com')
```

**Adicionar anexo:**
```typescript
await addAttachment(alertId, 'report.pdf', 'application/pdf', 15000, base64Data)
```

## 🚀 Operações Comuns

### Resetar banco de dados
```bash
rm prisma/dev.db
npx prisma migrate dev --name init
```

### Ver estado do banco
```bash
npx prisma studio
```

### Gerar Prisma Client após mudanças
```bash
npx prisma generate
```

### Criar nova migração
```bash
npx prisma migrate dev --name descricao_mudanca
```

## ⚙️ Configuração

### DATABASE_URL (.env)
```env
DATABASE_URL="file:./dev.db"
```

Para PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/wazuh"
```

## 📊 Performance

### Índices Criados
- `Alert.timestamp` - Buscas por data
- `Alert.level` - Filtros de severidade
- `Alert.agentName` - Filtros por agente
- `Alert.timestamp + level` - Composite index
- `Attachment.annotationId` - Lookups de anexos

### Recomendações
- Sincronizar 500 alertas por vez (ajustar conforme memória)
- Limpar alertas antigos periodicamente:
  ```typescript
  await prisma.alert.deleteMany({
    where: {
      timestamp: {
        lt: new Date(Date.now() - 90*24*60*60*1000) // 90 dias
      }
    }
  })
  ```

## 🔐 Segurança

- Validação de entrada nos endpoints
- Queries parametrizadas (automático com Prisma)
- Attachments: validação de tipo e tamanho
- Logs de sincronização para auditoria

## 🐛 Troubleshooting

**Erro: "database is locked"**
- SQLite é single-writer; não executar múltiplas migrações simultaneamente
- Solução: `rm prisma/dev.db-journal`

**Erro: "Foreign key constraint failed"**
- Tentar deletar Alert com Annotation existente
- Solução: Usar `onDelete: Cascade` (já configurado)

**Desempenho lento em buscas**
- Adicionar mais índices se necessário
- Considerar migrar para PostgreSQL para grande volume

## 📖 Documentação Oficial

- [Prisma Docs](https://www.prisma.io/docs/)
- [SQLite Adapter](https://www.prisma.io/docs/orm/overview/databases/sqlite)
- [Query API](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
