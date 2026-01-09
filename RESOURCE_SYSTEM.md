# Sistema de Gerenciamento de Recursos - Documentação

## 📋 Visão Geral

Sistema centralizado para gerenciamento de recursos (pessoas), suas alocações em tarefas, e eventos pessoais. Implementa uma arquitetura de **Single Source of Truth** com React Context, hooks especializados, e serviços centralizados.

## 🎯 Objetivos

- ✅ **Fonte Única de Dados**: Um único ponto de carregamento para recursos, alocações e eventos
- ✅ **Performance**: Cache em memória com carregamento único
- ✅ **Consistência**: Mesmos dados em todos os componentes
- ✅ **Validação**: Detecção automática de conflitos ao alocar
- ✅ **Manutenibilidade**: Lógica centralizada e reutilizável

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    React App                        │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         ResourceProvider (Context)            │ │
│  │  - Carrega dados uma vez                      │ │
│  │  - Mantém cache em memória                    │ │
│  │  - Fornece funções de acesso                  │ │
│  └─────────────────┬───────────────────────────── │
│                    │                               │
│  ┌─────────────────▼───────────────────────────┐ │
│  │  Hooks Especializados (useResources, etc.)  │ │
│  │  - useResources()                            │ │
│  │  - useAllocations()                          │ │
│  │  - usePersonalEvents()                       │ │
│  │  - useResourceAvailability()                 │ │
│  └─────────────────┬───────────────────────────── │
│                    │                               │
│  ┌─────────────────▼───────────────────────────┐ │
│  │        Componentes                           │ │
│  │  - Dashboard                                 │ │
│  │  - ResourceManager                           │ │
│  │  - AllocationModal                           │ │
│  │  - Calendario                                │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│         resource-service.ts (Serviço)              │
│  - Validação de conflitos                          │
│  - Operações CRUD com Supabase                     │
│  - Detecção de disponibilidade                     │
└─────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│              Supabase Database                      │
│  - resources                                        │
│  - allocations                                      │
│  - personal_events                                  │
└─────────────────────────────────────────────────────┘
```

---

## 📂 Estrutura de Arquivos

```
src/
├── contexts/
│   └── ResourceContext.tsx        # Context global com Provider
├── hooks/
│   └── useResources.ts            # Hooks especializados
├── lib/
│   └── resource-service.ts        # Serviço de recursos
├── types/
│   ├── database.types.ts          # Resource type
│   ├── allocation.types.ts        # Allocation type
│   └── personal-events.types.ts   # PersonalEvent type
└── app/
    └── layout.tsx                 # ResourceProvider wrapping app

supabase/migrations/
├── 003_add_personal_events.sql    # Migration de personal_events
└── 004_update_allocations_schema.sql  # Migration de allocations
```

---

## 🔌 Como Usar

### 1. Setup (já feito no layout.tsx)

O `ResourceProvider` já está configurado no root layout:

```tsx
// src/app/layout.tsx
import { ResourceProvider } from '@/contexts/ResourceContext'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          <ResourceProvider>
            {children}
          </ResourceProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

### 2. Usando Hooks em Componentes

#### Obter todos os recursos

```tsx
import { useResources } from '@/hooks/useResources'

function MyComponent() {
  const { resources, isLoading, error, refresh } = useResources()

  if (isLoading) return <Loading />
  if (error) return <Error message={error.message} />

  return (
    <div>
      {resources.map(r => <div key={r.id}>{r.name}</div>)}
    </div>
  )
}
```

#### Obter recursos ativos

```tsx
import { useActiveResources } from '@/hooks/useResources'

function SelectResource() {
  const { resources, isLoading } = useActiveResources()

  return (
    <select>
      {resources.map(r => (
        <option key={r.id} value={r.id}>{r.name}</option>
      ))}
    </select>
  )
}
```

#### Obter um recurso específico

```tsx
import { useResource } from '@/hooks/useResources'

function ResourceCard({ resourceId }: { resourceId: string }) {
  const { resource, isLoading } = useResource(resourceId)

  if (!resource) return <NotFound />

  return <div>{resource.name} - {resource.role}</div>
}
```

#### Obter recursos por role

```tsx
import { useResourcesByRole, useLeaders } from '@/hooks/useResources'

function AssignLeader() {
  // Apenas líderes (gerente + lider)
  const { leaders } = useLeaders()

  // Ou filtrar por role específico
  const { resources: operators } = useResourcesByRole('operador')

  return (
    <select>
      {leaders.map(l => <option key={l.id}>{l.name}</option>)}
    </select>
  )
}
```

#### Obter alocações de um recurso

```tsx
import { useResourceAllocations } from '@/hooks/useResources'

function ResourceWorkload({ resourceId }: { resourceId: string }) {
  const { allocations, isLoading } = useResourceAllocations(resourceId)

  return (
    <div>
      <h3>Alocações</h3>
      {allocations.map(a => (
        <div key={a.id}>
          {a.task.name} - {a.priority}
        </div>
      ))}
    </div>
  )
}
```

#### Obter eventos pessoais de um recurso

```tsx
import { useResourcePersonalEvents } from '@/hooks/useResources'

function PersonalEventsCalendar({ resourceId }: { resourceId: string }) {
  const { events, refresh } = useResourcePersonalEvents(resourceId)

  return (
    <div>
      {events.map(e => (
        <div key={e.id}>
          {e.title} ({e.event_type}): {e.start_date} a {e.end_date}
        </div>
      ))}
    </div>
  )
}
```

#### Obter dados completos de um recurso

```tsx
import { useResourceData } from '@/hooks/useResources'

function ResourceDetailPage({ resourceId }: { resourceId: string }) {
  const {
    resource,
    allocations,
    personalEvents,
    isLoading
  } = useResourceData(resourceId)

  return (
    <div>
      <h2>{resource?.name}</h2>
      <h3>Alocações: {allocations.length}</h3>
      <h3>Eventos: {personalEvents.length}</h3>
    </div>
  )
}
```

### 3. Usando o Serviço de Recursos

#### Verificar disponibilidade antes de alocar

```tsx
import { checkResourceAvailability } from '@/lib/resource-service'

async function handleAllocate(resourceId: string, taskId: string) {
  // Verificar disponibilidade
  const availability = await checkResourceAvailability(
    resourceId,
    '2025-01-10',
    '2025-01-20'
  )

  if (!availability.isAvailable) {
    // Mostrar conflitos ao usuário
    alert(`Conflitos encontrados:\n${
      availability.conflicts.map(c => `- ${c.message}`).join('\n')
    }`)
    return
  }

  // Continuar com alocação...
}
```

#### Criar alocação com validação automática

```tsx
import { createAllocationWithValidation } from '@/lib/resource-service'
import { showErrorAlert, showSuccessAlert, ErrorContext } from '@/utils/errorHandler'

async function allocateResource(taskId: string, resourceId: string) {
  try {
    const result = await createAllocationWithValidation(
      taskId,
      resourceId,
      'media', // priority
      {
        // skipConflictCheck: false (default - valida conflitos)
      }
    )

    if (!result.success) {
      // Tem conflitos
      const messages = result.conflicts!.map(c => c.message).join('\n')
      showErrorAlert(
        new Error(messages),
        'Não foi possível alocar recurso'
      )
      return
    }

    showSuccessAlert('Recurso alocado com sucesso!')

    // Refresh context para atualizar UI
    refreshAll()
  } catch (error) {
    showErrorAlert(error, ErrorContext.ALLOCATION_CREATE)
  }
}
```

#### Criar evento pessoal

```tsx
import { createPersonalEvent } from '@/lib/resource-service'

async function handleCreateEvent(resourceId: string) {
  const event = await createPersonalEvent({
    resource_id: resourceId,
    title: 'Férias',
    event_type: 'ferias',
    start_date: '2025-02-01',
    end_date: '2025-02-15',
    is_all_day: true,
    blocks_work: true,
    notes: 'Viagem para praia'
  })

  console.log('Evento criado:', event.id)

  // Refresh events
  refreshPersonalEvents()
}
```

---

## 🔍 Funções de Validação

### checkResourceAvailability()

Verifica se um recurso está disponível em um período.

**Retorna:**
```typescript
{
  isAvailable: boolean,
  conflicts: ResourceConflict[],
  warnings: string[]
}
```

**Detecta:**
- ✅ Alocações sobrepostas
- ✅ Eventos pessoais que bloqueiam trabalho
- ✅ Sobrecarga (múltiplas alocações)

### createAllocationWithValidation()

Cria alocação COM validação automática de conflitos.

**Opções:**
- `skipConflictCheck: boolean` - Pular validação (padrão: false)
- `startDate?: string` - Data de início customizada
- `endDate?: string` - Data de fim customizada

---

## 🗄️ Schema do Banco

### Tabela: resources

```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role VARCHAR(20) NOT NULL, -- 'gerente' | 'lider' | 'operador'
  leader_id UUID REFERENCES resources(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Tabela: allocations

```sql
CREATE TABLE allocations (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id),
  priority VARCHAR(10) DEFAULT 'media', -- 'alta' | 'media' | 'baixa'
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(resource_id, task_id) -- Previne duplicatas
);
```

### Tabela: personal_events

```sql
CREATE TABLE personal_events (
  id UUID PRIMARY KEY,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'medico' | 'ferias' | etc
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_all_day BOOLEAN DEFAULT true,
  blocks_work BOOLEAN DEFAULT true, -- Se bloqueia alocações
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE,

  CHECK (end_date >= start_date)
);
```

---

## 🚀 Migrations

Rode as migrations para atualizar o banco:

```bash
# Se usar Supabase CLI
supabase db push

# Ou rode manualmente no SQL Editor do Supabase:
# 1. supabase/migrations/003_add_personal_events.sql
# 2. supabase/migrations/004_update_allocations_schema.sql
```

---

## 🔄 Fluxo de Dados

### Carregamento Inicial

1. App inicia
2. `ResourceProvider` carrega automaticamente:
   - Todos os recursos
   - Todas as alocações (com joins)
   - Todos os eventos pessoais
3. Dados ficam em cache no Context
4. Componentes consomem via hooks

### Atualização de Dados

```tsx
// Em qualquer componente:
const { refreshAll } = useResourceContext()

// Após criar/editar/deletar:
await createAllocation(...)
refreshAll() // Recarrega tudo
```

Ou refresh específico:

```tsx
const { refreshAllocations } = useResourceContext()
await createAllocation(...)
refreshAllocations() // Só recarrega alocações
```

---

## ⚠️ Boas Práticas

### ✅ DO

```tsx
// Use hooks para acessar dados
const { resources } = useResources()

// Valide conflitos antes de alocar
const availability = await checkResourceAvailability(...)
if (!availability.isAvailable) {
  // Avise o usuário
}

// Refresh após mutações
await createAllocation(...)
refreshAll()
```

### ❌ DON'T

```tsx
// NÃO faça query direta no componente
const { data } = await supabase.from('resources').select()  // ❌

// NÃO aloque sem validar
await supabase.from('allocations').insert(...)  // ❌

// Use o serviço:
await createAllocationWithValidation(...)  // ✅
```

---

## 📊 Tipos TypeScript

### Resource

```typescript
interface Resource {
  id: string
  name: string
  email: string | null
  role: 'gerente' | 'lider' | 'operador'
  leader_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
```

### Allocation

```typescript
interface Allocation {
  id: string
  task_id: string
  resource_id: string
  priority: 'alta' | 'media' | 'baixa'
  start_date?: string | null
  end_date?: string | null
  created_at?: string
  updated_at?: string
}
```

### PersonalEvent

```typescript
interface PersonalEvent {
  id: string
  resource_id: string
  title: string
  event_type: 'medico' | 'ferias' | 'treinamento' | 'licenca' | 'feriado' | 'outro'
  start_date: string
  end_date: string
  is_all_day: boolean
  blocks_work: boolean
  notes?: string
  created_at: string
  updated_at: string
}
```

---

## 🎓 Próximos Passos

- [ ] Migrar Dashboard para usar hooks
- [ ] Migrar ResourceManager para usar hooks
- [ ] Migrar AllocationModal para usar hooks + validação
- [ ] Migrar Calendario para usar hooks
- [ ] Adicionar real-time com Supabase subscriptions
- [ ] Adicionar testes unitários

---

## 🐛 Troubleshooting

### "useResourceContext must be used within a ResourceProvider"

**Solução:** Certifique-se que o componente está dentro do `<ResourceProvider>` no layout.

### Dados não atualizam após mutação

**Solução:** Chame `refreshAll()` ou `refresh()` específico após criar/editar/deletar.

### Performance lenta

**Solução:** Os dados são carregados uma vez e ficam em cache. Se muito lento, verifique:
- Número de alocações (muitos joins)
- Network do Supabase

---

## 📝 Changelog

### v1.0.0 (2025-01-07)

- ✅ Criado ResourceContext global
- ✅ Criado hooks especializados
- ✅ Criado resource-service com validação
- ✅ Migrations para personal_events e allocations.priority
- ✅ Integrado no layout.tsx
- ✅ Documentação completa
