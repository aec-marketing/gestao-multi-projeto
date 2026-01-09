# Utilities Documentation

## Logger (`logger.ts`)

Sistema centralizado de logging com diferentes níveis e controle por ambiente.

### Características

- ✅ **Níveis de Log**: DEBUG, INFO, WARN, ERROR
- ✅ **Environment-Aware**: Ajusta automaticamente o nível de log baseado no ambiente
- ✅ **Histórico**: Mantém os últimos 100 logs na memória
- ✅ **Performance Tracking**: Mede tempo de execução de funções
- ✅ **Agrupamento**: Agrupa logs relacionados

### Níveis de Log

```typescript
enum LogLevel {
  DEBUG = 0,  // Apenas em desenvolvimento
  INFO = 1,   // Informações gerais
  WARN = 2,   // Avisos
  ERROR = 3,  // Erros
  NONE = 4    // Desabilita todos os logs
}
```

### Uso Básico

```typescript
import { log } from '@/utils/logger'

// Debug (apenas em desenvolvimento)
log.debug('Carregando dados do usuário', 'UserService', { userId: '123' })

// Info
log.info('Usuário autenticado com sucesso', 'Auth')

// Warning
log.warn('Cache expirado, recarregando...', 'CacheService')

// Error
log.error('Falha ao salvar no banco', 'Database', error)
```

### Recursos Avançados

#### 1. Medição de Performance

```typescript
const result = await log.time(
  'Carregar projeto',
  async () => {
    const data = await fetchProject(id)
    return data
  },
  'ProjectService'
)
// Output: "Carregar projeto completed in 245.32ms"
```

#### 2. Agrupamento de Logs

```typescript
log.group('Processamento de Importação')
log.info('Validando arquivo...', 'Import')
log.info('Processando tarefas...', 'Import')
log.info('Salvando no banco...', 'Import')
log.groupEnd()
```

#### 3. Tabelas (desenvolvimento)

```typescript
const users = [
  { id: 1, name: 'João', role: 'Admin' },
  { id: 2, name: 'Maria', role: 'User' }
]

log.table(users, 'UserList')
```

#### 4. Exportar Logs

```typescript
import { logger } from '@/utils/logger'

// Obter todos os logs
const allLogs = logger.getLogs()

// Exportar como JSON
const json = logger.exportLogs()
console.log(json)

// Limpar histórico
logger.clearLogs()
```

#### 5. Configurar Nível de Log

```typescript
import { logger, LogLevel } from '@/utils/logger'

// Mostrar apenas erros
logger.setLogLevel(LogLevel.ERROR)

// Desabilitar todos os logs
logger.setLogLevel(LogLevel.NONE)

// Mostrar tudo (development)
logger.setLogLevel(LogLevel.DEBUG)
```

### Comportamento por Ambiente

#### Development (`NODE_ENV === 'development'`)
- **Nível Padrão**: `DEBUG` (mostra tudo)
- **Output**: Console do navegador com formatação
- **Histórico**: Ativo (últimos 100 logs)

#### Production (`NODE_ENV === 'production'`)
- **Nível Padrão**: `WARN` (apenas warnings e erros)
- **Output**: Apenas erros críticos
- **Histórico**: Ativo (para debug)

### Formato de Output

```
2025-01-07T10:30:45.123Z DEBUG[UserService]: Carregando dados do usuário
2025-01-07T10:30:45.456Z INFO[Auth]: Usuário autenticado com sucesso
2025-01-07T10:30:46.789Z WARN[CacheService]: Cache expirado, recarregando...
2025-01-07T10:30:47.012Z ERROR[Database]: Falha ao salvar no banco
```

### Integração com Error Handler

O logger está integrado ao `errorHandler.ts`:

```typescript
import { showErrorAlert, logError, ErrorContext } from '@/utils/errorHandler'

try {
  await saveProject(data)
} catch (error) {
  logError(error, 'saveProject')  // Usa o logger automaticamente
  showErrorAlert(error, ErrorContext.PROJECT_CREATE)
}
```

---

## Error Handler (`errorHandler.ts`)

Sistema centralizado de tratamento de erros com mensagens amigáveis.

### Funções Principais

#### `formatErrorMessage(error: unknown): string`
Formata qualquer tipo de erro em string legível.

#### `createAppError(error: unknown, context?: string): AppError`
Cria objeto padronizado de erro.

#### `handleSupabaseError(error: unknown, operation: string): string`
Traduz erros do Supabase para mensagens em português:
- `duplicate key` → "Este registro já existe no sistema"
- `foreign key` → "Não é possível realizar esta operação devido a dependências existentes"
- `not found` → "Registro não encontrado"
- `permission` → "Você não tem permissão para realizar esta operação"

#### `showErrorAlert(error: unknown, context?: string): void`
Exibe alerta de erro ao usuário com mensagem amigável.

#### `showSuccessAlert(message: string): void`
Exibe alerta de sucesso ao usuário.

#### `logError(error: unknown, context?: string): void`
Loga erro usando o sistema de logging centralizado.

#### `withErrorHandling<T>(fn, context, options): Promise<T | null>`
Wrapper que adiciona tratamento de erro automático a funções assíncronas.

### Contextos de Erro

```typescript
ErrorContext = {
  PROJECT_CREATE: 'Erro ao criar projeto',
  PROJECT_UPDATE: 'Erro ao atualizar projeto',
  PROJECT_DELETE: 'Erro ao excluir projeto',
  PROJECT_LOAD: 'Erro ao carregar projeto',

  TASK_CREATE: 'Erro ao criar tarefa',
  TASK_UPDATE: 'Erro ao atualizar tarefa',
  TASK_DELETE: 'Erro ao excluir tarefa',
  TASK_LOAD: 'Erro ao carregar tarefas',

  // ... e mais
}
```

### Exemplo Completo

```typescript
import { showErrorAlert, showSuccessAlert, logError, ErrorContext } from '@/utils/errorHandler'

async function createTask(data: TaskData) {
  try {
    const { error } = await supabase
      .from('tasks')
      .insert(data)

    if (error) throw error

    showSuccessAlert('Tarefa criada com sucesso')
    onRefresh()
  } catch (error) {
    logError(error, 'createTask')
    showErrorAlert(error, ErrorContext.TASK_CREATE)
  }
}
```

### Com Wrapper

```typescript
import { withErrorHandling, ErrorContext } from '@/utils/errorHandler'

const result = await withErrorHandling(
  async () => {
    return await createProject(data)
  },
  ErrorContext.PROJECT_CREATE,
  {
    showAlert: true,      // Mostrar alerta ao usuário
    rethrow: false,       // Não re-lançar o erro
    onError: (appError) => {
      // Callback customizado
      analytics.trackError(appError)
    }
  }
)
```

---

## Best Practices

### ✅ DO

```typescript
// Use o logger para debug em desenvolvimento
log.debug('Estado atual:', 'MyComponent', { state })

// Use contextos específicos
showErrorAlert(error, ErrorContext.TASK_CREATE)

// Logue erros antes de mostrar ao usuário
logError(error, 'functionName')
showErrorAlert(error, ErrorContext.GENERIC)

// Use time() para medir performance
const data = await log.time('fetchData', () => loadData())
```

### ❌ DON'T

```typescript
// NÃO use console.log diretamente
console.log('debug info')  // ❌

// NÃO use alert() diretamente
alert('Erro!')  // ❌

// NÃO use try-catch sem logging
try {
  await save()
} catch (error) {
  // ❌ Erro silencioso!
}

// NÃO mostre erros técnicos ao usuário
alert(error.stack)  // ❌
```

### ✅ Padrão Recomendado

```typescript
async function handleOperation() {
  try {
    log.debug('Iniciando operação', 'MyComponent')

    const result = await performOperation()

    log.info('Operação concluída', 'MyComponent', { result })
    showSuccessAlert('Operação realizada com sucesso')

    return result
  } catch (error) {
    log.error('Operação falhou', 'MyComponent', error)
    showErrorAlert(error, ErrorContext.GENERIC)
    return null
  }
}
```
