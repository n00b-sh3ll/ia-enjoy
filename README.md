# IA-Enjoy Wazuh Dashboard

Dashboard completo para visualização e gerenciamento de alertas do Wazuh com interface moderna e funcionalidades avançadas.

## 🚀 Funcionalidades

### Dashboard Principal
- **8 Cards de Status**: Total, Novos, Em Atendimento, Fechados, Agendados, Falso-Positivo, Cancelados e Em Homologação
- **Filtros Avançados**: 
  - Busca textual case-insensitive por descrição
  - Filtro por nível de alerta (rule.level)
  - Filtro por período (data inicial e final)
  - Ordenação por timestamp, nível, status e ID
- **Operações em Lote**: Seleção múltipla de alertas para alteração de status
- **Refresh Manual**: Botão para atualizar alertas com animação de loading
- **Contadores Reais**: Exibe o total real de alertas do Elasticsearch (não limitado ao localStorage)

### Página de Detalhes (Analytics)
- **Gráfico de Barras**: Top 15 descrições de alertas mais gerados (Recharts)
- **Filtros Específicos**:
  - Nível de alerta (0-10+)
  - Agente (agent.name)
  - Período de datas

### Gerenciamento de Alertas
- **Anotações**: Adicione notas e atribua responsáveis
- **Status Personalizados**: Em Atendimento, Agendado, Fechado, Falso-Positivo, Cancelado, Em Homologação
- **Anexos**: Upload de arquivos (.zip, .xlsx, .docx, .txt) com validação e download
- **Histórico**: Registro completo de alertas processados

### Interface
- **Tema Escuro/Claro**: Toggle entre temas com persistência
- **Design Responsivo**: Layout em grid otimizado para diferentes resoluções
- **Navegação Intuitiva**: Header com links para Dashboard e Detalhes

## 🛠️ Tecnologias

- **Next.js 13+** - App Router com TypeScript
- **React 18** - Hooks (useState, useEffect, useCallback)
- **Tailwind CSS 3.4.7** - Tema customizado (slate palette)
- **Recharts** - Visualização de dados
- **Elasticsearch** - Armazenamento de alertas Wazuh
- **SSH Connection** - Acesso ao servidor remoto via Python

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Editar .env.local com:
# SSH_USER=usuario
# SSH_HOST=192.168.150.210

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

## 🔧 Configuração

### Variáveis de Ambiente (.env.local)

```env
SSH_USER=usuario
SSH_HOST=192.168.150.210
```

### Elasticsearch

O sistema conecta via SSH ao servidor Elasticsearch configurado em `192.168.150.210`:
- **Porta**: 9200
- **Índices**: wazuh-alerts-*
- **Autenticação**: Basic Auth (admin)
- **Protocolo**: HTTPS com certificado auto-assinado

## 📁 Estrutura do Projeto

```
ia-enjoy/
├── app/
│   ├── api/
│   │   └── alerts/
│   │       └── route.ts          # API SSH -> Elasticsearch
│   ├── dashboard/
│   │   └── page.tsx              # Dashboard principal
│   ├── detalhes/
│   │   └── page.tsx              # Página de analytics
│   └── page.tsx                  # Redirect para dashboard
├── components/
│   ├── AlertList.tsx             # Tabela de alertas com bulk ops
│   ├── AlertModal.tsx            # Modal de detalhes e anexos
│   ├── AlertRegistry.tsx         # Componente de histórico
│   ├── Header.tsx                # Navegação e toggle de tema
│   └── Pagination.tsx            # Controle de paginação
├── lib/
│   └── storage.ts                # Wrapper seguro para localStorage
└── styles/
    └── globals.css               # Estilos globais e tema
```

## 🎨 Temas

### Tema Escuro (Padrão)
- Background: slate-950/900
- Cards: slate-900/800
- Textos: slate-100/200/300

### Tema Claro
- Background: white/gray-50
- Cards: white com borders
- Textos: gray-900/800/700

## 🔍 API Routes

### GET /api/alerts

Busca alertas do Elasticsearch via SSH.

**Query Parameters:**
- `limit` - Número de alertas (default: 50)
- `offset` - Offset para paginação (default: 0)
- `level` - Filtro por nível específico (opcional)

**Response:**
```json
{
  "hits": {
    "hits": [...],
    "total": {
      "value": 12345
    }
  }
}
```

## 💾 Armazenamento Local

O sistema utiliza localStorage para:
- `alertAnnotations` - Notas, status e anexos dos alertas
- `alertRegistry` - IDs sequenciais dos alertas processados
- `theme` - Preferência de tema do usuário

### Safe Storage Wrapper

Implementado em `lib/storage.ts` para prevenir crashes por JSON corrompido:
- Try/catch automático
- Remoção de dados corrompidos
- Fallback para valores padrão
- Tipagem TypeScript

## 📊 Funcionalidades de Filtro

### Dashboard
1. **Buscar** - Case-insensitive, busca na descrição do alerta
2. **Ordenar** - Timestamp (asc/desc), Nível (asc/desc), Status, ID
3. **Nível** - Filtra por rule.level específico
4. **De/Até** - Período de datas (valida fim do dia 23:59:59)
5. **Por página** - 10, 25, 50, 100 alertas

### Detalhes (Analytics)
1. **Nível** - Dropdown com valores 0-10+
2. **Agente** - Lista dinâmica de agent.name
3. **Período** - Data inicial e final

## 🔒 Segurança

- Validação de arquivos anexados (tipos permitidos)
- Sanitização de inputs
- Timeout em requisições SSH (30s)
- Tratamento de erros robusto
- Escape de caracteres especiais em comandos shell

## 📝 Notas de Desenvolvimento

- Elasticsearch retorna `data.hits.total.value` para contagem total
- Filtros de data/busca processados no cliente (500 alertas)
- Bulk operations preservam estrutura de annotations
- Python heredoc evita problemas de escape em SSH
- Grid layout (4 colunas) previne overflow de filtros

## 🤝 Contribuição

Este é um projeto interno para gerenciamento de alertas Wazuh.

## 📄 Licença

Propriedade da organização.
