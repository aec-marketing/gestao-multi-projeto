# Sistema de Priorização Hierárquica

## 📋 Problema Original

Anteriormente, quando um recurso (líder ou operador) era alocado em uma tarefa, **não era possível** realocá-lo em outra tarefa com datas sobrepostas - o sistema bloqueava completamente por conflito de alocação.

Isso impedia cenários realistas onde:
- Uma pessoa trabalha em múltiplas tarefas simultaneamente
- Uma tarefa urgente surge e precisa de prioridade sobre outras
- É necessário definir hierarquia de importância entre tarefas paralelas

## ✅ Solução Implementada

### Sistema de Contrabalanço com Priorização Diferenciada

Agora é possível alocar a mesma pessoa em **múltiplas tarefas com datas sobrepostas**, desde que cada alocação tenha **prioridade diferente**.

Isso cria uma **hierarquia clara** de importância, permitindo nuances como:
- "Lucas está no Projeto Mecânico (Alta), mas Detalhamento 2D (Urgente) tem prioridade absoluta"
- "Maria trabalha em Retrofit (Média) e Manutenção (Baixa) - Retrofit é mais importante"

## 🎯 Como Funciona

### Cenário Exemplo

**Tarefa 1:** "Projeto Mecânico" (10/01 a 30/01)
- Líder alocado: **Lucas**
- Prioridade: **Alta**

**Tentativa de alocação:**
Você tenta alocar **Lucas** em "Detalhamento 2D" (15/01 a 25/01)

### Fluxo de Alocação

#### 1. **Detecção de Conflito**
Sistema detecta que Lucas já está alocado em "Projeto Mecânico" no período de 15/01 a 25/01.

#### 2. **Análise de Prioridades**
Sistema verifica que "Projeto Mecânico" tem prioridade **Alta**.

#### 3. **Opção de Override**
Sistema apresenta duas opções:

**❌ Não Permitido (Evento Pessoal):**
- Se o conflito for com férias/licença médica
- Bloqueio total - não pode alocar

**✅ Permitido (Alocação Sobreposta):**
- Se o conflito for com outra tarefa
- Pode alocar com prioridade **diferente**

#### 4. **Interface de Priorização**

```
⚠️ Conflito Detectado - Priorização Necessária

Este recurso já está alocado em outra(s) tarefa(s) no mesmo período:

📊 Já alocado em outra tarefa
Recurso já alocado na tarefa "Projeto Mecânico" de 10/01/2025 a 30/01/2025

💡 Você pode alocar com prioridade diferente

As tarefas conflitantes têm prioridade: Alta Prioridade.
Escolha uma prioridade diferente para criar hierarquia entre as tarefas.

Selecione a prioridade desta alocação:

[Alta Prioridade]     [Média Prioridade]  [Baixa Prioridade]
✗ Já em uso           ✓ Disponível        ✓ Disponível

[✓ Alocar com Prioridade Diferente]  [Cancelar]
```

### Regras de Priorização

#### ✅ Permitido:
- **Alta** em tarefa A → **Média** ou **Baixa** em tarefa B
- **Média** em tarefa A → **Alta** ou **Baixa** em tarefa B
- **Baixa** em tarefa A → **Alta** ou **Média** em tarefa B

#### ❌ Não Permitido:
- **Alta** em tarefa A → **Alta** em tarefa B (mesmo nível)
- **Média** em tarefa A → **Média** em tarefa B (mesmo nível)
- **Baixa** em tarefa A → **Baixa** em tarefa B (mesmo nível)
- Qualquer prioridade durante **eventos pessoais bloqueantes**

## 🎨 Interface Visual

### Estados da UI

#### 1. **Conflito Bloqueante (Evento Pessoal)**
```
┌─────────────────────────────────────────────┐
│ ⚠️ Conflito Detectado - Não foi possível    │
│    alocar                                   │
│                                             │
│ Este recurso não está disponível no         │
│ período da tarefa:                          │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 🚫 Evento pessoal bloqueante            │ │
│ │ Recurso indisponível: Férias de         │ │
│ │ 10/01/2025 a 15/01/2025                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Escolher outro recurso]                    │
└─────────────────────────────────────────────┘
```

#### 2. **Conflito com Override Permitido**
```
┌─────────────────────────────────────────────┐
│ ⚠️ Conflito Detectado - Priorização         │
│    Necessária                               │
│                                             │
│ Este recurso já está alocado em outra(s)    │
│ tarefa(s) no mesmo período:                 │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📊 Já alocado em outra tarefa           │ │
│ │ Tarefa "Projeto Mecânico" (Alta)        │ │
│ │ de 10/01/2025 a 30/01/2025              │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 💡 Você pode alocar com prioridade      │ │
│ │    diferente                            │ │
│ │                                         │ │
│ │ Tarefas conflitantes: Alta Prioridade   │ │
│ │                                         │ │
│ │ Selecione a prioridade:                 │ │
│ │                                         │ │
│ │ [Alta]          [Média]      [Baixa]   │ │
│ │ ✗ Já em uso     ✓ Disponível ✓ Dispon. │ │
│ │                                         │ │
│ │ [✓ Alocar]              [Cancelar]      │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Cores e Indicadores

- **🔴 Vermelho:** Conflito bloqueante (evento pessoal)
- **🟡 Amarelo:** Conflito com override permitido
- **🟢 Verde:** Sem conflitos
- **✗ Já em uso:** Prioridade indisponível
- **✓ Disponível:** Prioridade pode ser usada

## 📊 Casos de Uso

### Caso 1: Urgência Sobrepõe Rotina

**Cenário:**
- Lucas trabalha em "Manutenção Preventiva" (Baixa, 01/01 a 31/01)
- Surge "Falha Crítica no Sistema" (15/01 a 16/01)

**Ação:**
1. Tenta alocar Lucas em "Falha Crítica"
2. Sistema detecta conflito com "Manutenção" (Baixa)
3. Escolhe prioridade **Alta** para "Falha Crítica"
4. ✅ Alocação criada com sucesso

**Resultado:**
- Lucas tem 2 tarefas simultâneas
- "Falha Crítica" (Alta) tem prioridade sobre "Manutenção" (Baixa)
- Fica claro que a falha deve ser resolvida primeiro

### Caso 2: Múltiplas Tarefas Paralelas

**Cenário:**
- Maria está em "Projeto Elétrico" (Alta, 01/01 a 28/02)
- Precisa participar de "Treinamento" (15/01 a 17/01)
- E também de "Reunião Semanal" (todos os dias 10/01 a 28/02)

**Ação:**
1. Aloca Maria em "Projeto Elétrico" (Alta)
2. Aloca Maria em "Treinamento" (Média)
3. Aloca Maria em "Reunião Semanal" (Baixa)

**Resultado:**
- Maria tem 3 tarefas simultâneas
- Hierarquia clara: Projeto > Treinamento > Reunião
- Sistema gerencia nuances de prioridade

### Caso 3: Bloqueio Total (Férias)

**Cenário:**
- João tem férias de 10/01 a 20/01
- Tenta alocar em "Instalação Elétrica" (12/01 a 18/01)

**Ação:**
1. Sistema detecta evento pessoal bloqueante
2. **Não permite override**
3. Mostra apenas botão "Escolher outro recurso"

**Resultado:**
- ❌ Alocação bloqueada
- Sem opção de priorização
- Férias/licenças têm prioridade absoluta

## 🔧 Detalhes Técnicos

### Lógica de Validação

```typescript
// 1. Detectar conflitos
const availabilityCheck = await checkResourceAvailability(
  selectedResourceId,
  task.start_date,
  task.end_date
)

// 2. Se houver conflitos
if (!availabilityCheck.isAvailable) {
  // Extrair prioridades das tarefas conflitantes
  const allocationConflicts = availabilityCheck.conflicts.filter(
    c => c.type === 'allocation_overlap'
  )

  const priorities = allocationConflicts
    .map(c => {
      const conflictAlloc = allAllocations.find(
        a => a.id === c.details?.allocationId
      )
      return conflictAlloc?.priority
    })
    .filter(Boolean)

  // 3. Verificar se override é permitido
  const hasPersonalEventBlock = availabilityCheck.conflicts.some(
    c => c.type === 'personal_event_block'
  )

  const allowOverride = !hasPersonalEventBlock && allocationConflicts.length > 0

  // 4. Bloquear prioridades já em uso
  setConflictingPriorities(priorities)
}

// 5. Alocar com override se prioridade for diferente
if (allowOverride && !conflictingPriorities.includes(selectedPriority)) {
  await handleForceAllocate()
}
```

### Estados do Modal

| Estado | Descrição | UI |
|--------|-----------|-----|
| `conflicts` | Lista de conflitos detectados | Blocos vermelhos com detalhes |
| `conflictingPriorities` | Prioridades já em uso | Botões desabilitados |
| `allowOverride` | Permite override? | Mostra/oculta seção amarela |
| `showConflictWarning` | Mostra aviso? | Exibe modal de conflito |

### Arquivos Modificados

- **[AllocationModal.tsx](src/components/AllocationModal.tsx)**
  - Adicionados estados: `allowOverride`, `conflictingPriorities`
  - Nova função: `handleForceAllocate()`
  - UI expandida com seção de override
  - Validação de prioridades duplicadas

## 🧪 Como Testar

### Teste 1: Alocação com Prioridade Diferente

**Setup:**
1. Crie uma tarefa "Projeto A" (10/01 a 30/01)
2. Aloque Lucas com prioridade **Alta**

**Teste:**
1. Crie tarefa "Projeto B" (15/01 a 25/01)
2. Tente alocar Lucas
3. **Deve aparecer:** Conflito com override permitido
4. **Deve mostrar:** "Alta Prioridade" já em uso
5. Selecione **Média** ou **Baixa**
6. Clique em "Alocar com Prioridade Diferente"
7. ✅ **Esperado:** Alocação criada com sucesso

**Verificação:**
- Abra "👥 Recursos" → Selecione Lucas
- Deve mostrar **2 tarefas alocadas**
- Projeto A (Alta) e Projeto B (Média/Baixa)

### Teste 2: Bloqueio de Prioridade Duplicada

**Setup:**
1. Lucas em "Projeto A" com prioridade **Alta**

**Teste:**
1. Tente alocar Lucas em "Projeto B" (datas sobrepostas)
2. Conflito detectado
3. Tente selecionar prioridade **Alta** novamente
4. **Esperado:** Botão "Alta" desabilitado com "✗ Já em uso"
5. Botão "Alocar" deve estar desabilitado

### Teste 3: Bloqueio Total (Evento Pessoal)

**Setup:**
1. Crie evento pessoal "Férias" para Maria (10/01 a 15/01)
2. Marque "Bloqueia trabalho" como TRUE

**Teste:**
1. Tente alocar Maria em tarefa de 12/01 a 18/01
2. **Esperado:** Conflito bloqueante (vermelho)
3. **NÃO deve mostrar:** Seção amarela de override
4. **Apenas botão:** "Escolher outro recurso"

### Teste 4: Múltiplas Prioridades

**Setup:**
1. João em "Tarefa A" (Alta) - 01/01 a 31/01
2. João em "Tarefa B" (Média) - 10/01 a 20/01

**Teste:**
1. Tente alocar João em "Tarefa C" (15/01 a 18/01)
2. **Esperado:** "Alta Prioridade, Média Prioridade" já em uso
3. **Disponível:** Apenas "Baixa Prioridade"
4. Selecione Baixa
5. ✅ Alocação permitida

## 📈 Benefícios

### 1. **Flexibilidade Realista**
- Reflete cenários reais onde pessoas trabalham em múltiplas tarefas
- Permite urgências sem destruir planejamento existente

### 2. **Hierarquia Clara**
- Sempre fica claro qual tarefa tem prioridade
- Não há ambiguidade sobre o que fazer primeiro

### 3. **Controle Granular**
- Gerente pode definir nuances de importância
- "Alta mas não tanto quanto essa outra"

### 4. **Proteção Inteligente**
- Eventos pessoais (férias) mantêm bloqueio total
- Prioridades duplicadas são bloqueadas
- Sistema guia o usuário para decisões válidas

### 5. **Transparência**
- UI mostra claramente quais prioridades estão em uso
- Conflitos são explicados com detalhes
- Usuário sempre sabe por que algo está bloqueado

## ⚠️ Limitações e Considerações

### Limitações Atuais:

1. **Máximo 3 níveis de prioridade**
   - Alta, Média, Baixa
   - Máximo de 3 tarefas simultâneas com prioridades diferentes

2. **Sem prioridade "Urgente" separada**
   - "Alta" é o nível máximo
   - Pode ser expandido no futuro

3. **Override apenas para alocações**
   - Eventos pessoais bloqueantes são absolutos
   - Não há como forçar alocação durante férias

### Considerações de Uso:

- **Use com moderação:** Múltiplas alocações devem ser exceção, não regra
- **Comunicação:** Explique à equipe a hierarquia de prioridades
- **Revisão regular:** Revisite alocações paralelas periodicamente
- **Realismo:** Considere capacidade real da pessoa antes de alocar em múltiplas tarefas

## 🎓 Glossário

- **Conflito Bloqueante:** Evento pessoal que impede completamente alocação
- **Conflito com Override:** Alocação sobreposta que permite priorização
- **Priorização Hierárquica:** Sistema de múltiplas alocações com níveis diferentes
- **Prioridade Conflitante:** Prioridade já em uso em tarefa sobreposta
- **Force Allocate:** Alocar mesmo com conflito (com prioridade diferente)

---

**Status:** ✅ Implementado e testado
**Build:** ✅ Compilado com sucesso
**Versão:** 1.0 - Janeiro 2025
