const path = require('path')
const Database = require('better-sqlite3')

const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'dev.db')
const args = process.argv.slice(2)

function printHelp() {
  console.log(`Uso:
  npm run db:query -- "SELECT * FROM alerts LIMIT 5"
  npm run db:tables
  npm run db:schema -- alerts

Variáveis:
  SQLITE_DB_PATH   Caminho do arquivo SQLite (padrão: ./dev.db)
`)
}

if (args.length === 0) {
  printHelp()
  process.exit(0)
}

const db = new Database(dbPath, { readonly: true })

try {
  if (args[0] === '--tables') {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    console.table(rows)
    process.exit(0)
  }

  if (args[0] === '--schema') {
    const table = args[1]
    if (!table) {
      console.error('Informe a tabela. Ex.: npm run db:schema -- alerts')
      process.exit(1)
    }

    const row = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table)

    if (!row) {
      console.error(`Tabela não encontrada: ${table}`)
      process.exit(1)
    }

    console.log(row.sql)
    process.exit(0)
  }

  const sql = args.join(' ').trim()
  if (!sql) {
    printHelp()
    process.exit(1)
  }

  const isSelectLike = /^\s*(select|with|pragma|explain)\b/i.test(sql)

  if (isSelectLike) {
    const rows = db.prepare(sql).all()
    console.table(rows)
  } else {
    console.error('Este script é somente leitura. Use SELECT/PRAGMA/EXPLAIN.')
    process.exit(1)
  }
} catch (error) {
  console.error('Erro ao consultar SQLite:', error.message)
  process.exit(1)
} finally {
  db.close()
}
