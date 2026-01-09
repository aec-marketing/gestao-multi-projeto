# Herança de Líderes em Subtarefas

## 📋 Problema Identificado

Anteriormente, quando um líder era alocado em uma **tarefa pai**, não era possível:
1. Realocar o mesmo líder em **subtarefas** (bloqueado por validação de conflitos)
2. Alocar **operadores desse líder** nas subtarefas (porque o líder não estava "presente" na subtarefa)

Isso criava um problema de usabilidade onde você precisava alocar o líder repetidamente em cada subtarefa, gerando registros duplicados e poluindo o sistema de controle de recursos.

## ✅ Solução Implementada

### Conceito: Herança Implícita de Líderes

Quando um **líder é alocado em uma tarefa pai**, ele automaticamente "cobre" todas as **subtarefas filhas** para fins de alocação de operadores, **sem criar registros duplicados** no banco de dados.

### Como Funciona

#### 1. **Herança Automática**
```
Projeto Mecânico (Tarefa Pai)
├─ Líder: Lucas (alocado diretamente)
│
├─ Subtarefa: Reunião Inicial
│  └─ Herda: Lucas (invisível, mas disponível)
│  └─ Operadores: João ✅ pode ser alocado (equipe do Lucas)
│
└─ Subtarefa: Desenvolvimento
   └─ Herda: Lucas (invisível, mas disponível)
   └─ Operadores: Eduardo ✅ pode ser alocado (equipe do Lucas)
```

#### 2. **Sem Registros Duplicados**
- ✅ **Líder alocado na tarefa pai:** 1 registro no banco
- ✅ **Operadores nas subtarefas:** registros independentes
- ❌ **NÃO cria:** registros do líder em cada subtarefa

#### 3. **Flexibilidade Total**
Você pode:
- Alocar diferentes operadores em cada subtarefa
- Adicionar líderes adicionais nas subtarefas se necessário
- Ter controle granular sobre quem trabalha em cada parte

## 🎯 Cenário de Uso

### Exemplo Prático

**Tarefa Pai:** "Projeto Mecânico"
- Líder alocado: **Lucas**

**Subtarefa 1:** "Reunião Inicial"
- Herda: Lucas (automático, invisível)
- Operadores alocados: **João** (equipe do Lucas)

**Subtarefa 2:** "Desenvolvimento"
- Herda: Lucas (automático, invisível)
- Operadores alocados: **Eduardo** (equipe do Lucas)

**Subtarefa 3:** "Testes"
- Herda: Lucas (automático, invisível)
- Operadores alocados: **João + Eduardo** (ambos da equipe do Lucas)

### Resultado

✅ **1 alocação de líder** (na tarefa pai)
✅ **3 alocações de operadores** (distribuídos nas subtarefas)
✅ **Controle granular** (cada operador em tarefas específicas)
✅ **Sem poluição** (não há duplicatas no sistema)

## 🖥️ Interface Visual

### Indicadores de Herança

Quando você está alocando recursos em uma **subtarefa**, o sistema mostra:

#### 1. **Banner Informativo** (topo do modal)
```
ℹ️ Esta subtarefa herda 1 líder da tarefa pai.
   Você pode alocar operadores desses líderes sem precisar alocá-los novamente.
```

#### 2. **Badge "Herdado da tarefa pai"** (ao selecionar operadores)
```
👨‍💼 Equipe de Lucas  [Herdado da tarefa pai]
  ○ João Silva
  ○ Eduardo Costa
```

### Comportamento do Modal

#### Ao Alocar em Tarefa Pai
- Selecione "Líder / Gerente"
- Escolha o líder (ex: Lucas)
- ✅ Alocação criada normalmente

#### Ao Alocar em Subtarefa
- **Banner azul** aparece automaticamente se houver líderes herdados
- Selecione "Operador"
- Veja equipes dos líderes (incluindo herdados com badge azul)
- Escolha operadores normalmente
- ✅ Alocação criada apenas para o operador

## 🔧 Detalhes Técnicos

### Implementação

#### 1. **Detecção de Líderes Herdados**
```typescript
// Buscar líderes alocados na tarefa pai
const parentTaskLeaders = useMemo(() => {
  if (!task.parent_id) return []

  const parentAllocations = allAllocations.filter(a => a.task_id === task.parent_id)
  return parentAllocations
    .map(a => allResources.find(r => r.id === a.resource_id))
    .filter(r => r && (r.role === 'lider' || r.role === 'gerente'))
}, [task.parent_id, allAllocations, allResources])
```

#### 2. **Combinação de Líderes**
```typescript
// Combinar líderes diretos + herdados (sem duplicatas)
const allEffectiveLeaders = useMemo(() => {
  const combined = [...allocatedLeaders, ...parentTaskLeaders]
  const uniqueLeaderIds = new Set(combined.map(l => l.id))
  return Array.from(uniqueLeaderIds)
    .map(id => combined.find(l => l.id === id)!)
    .filter(Boolean)
}, [allocatedLeaders, parentTaskLeaders])
```

#### 3. **Agrupamento de Operadores**
```typescript
// Agrupar operadores por líder (incluindo herdados)
const operatorsByLeader = allEffectiveLeaders.map(leader => ({
  leader,
  operators: operatorsOfAllocatedLeaders.filter(op => op.leader_id === leader.id),
  isInherited: parentTaskLeaders.some(pl => pl.id === leader.id) &&
               !allocatedLeaders.some(al => al.id === leader.id)
}))
```

### Arquivos Modificados

- **[AllocationModal.tsx](src/components/AllocationModal.tsx)** (linhas 140-183, 270-275, 357-367)
  - Adicionada lógica de herança de líderes
  - Detecção automática de `task.parent_id`
  - UI com badges e banners informativos

## 🧪 Como Testar

### Teste 1: Herança Básica

1. Crie um projeto com tarefas hierárquicas:
   ```
   Projeto Mecânico (Tarefa Pai)
   └─ Reunião Inicial (Subtarefa)
   ```

2. Aloque um líder na **Tarefa Pai**:
   - Selecione "Projeto Mecânico"
   - Clique em "Alocar"
   - Escolha "Líder / Gerente"
   - Selecione "Lucas"
   - ✅ Alocar

3. Vá para a **Subtarefa**:
   - Selecione "Reunião Inicial"
   - Clique em "Alocar"
   - 🔵 **Banner azul deve aparecer**: "Esta subtarefa herda 1 líder da tarefa pai"
   - Escolha "Operador"
   - Veja "Equipe de Lucas" com badge "Herdado da tarefa pai"
   - Selecione um operador (ex: João)
   - ✅ Alocar

4. **Verificação:**
   - Vá em "👥 Recursos"
   - Selecione João
   - Deve mostrar: **1 tarefa alocada** (Reunião Inicial)
   - Selecione Lucas
   - Deve mostrar: **1 tarefa alocada** (Projeto Mecânico) - **não 2!**

### Teste 2: Múltiplas Subtarefas

1. Use a mesma tarefa pai "Projeto Mecânico" com Lucas
2. Crie 3 subtarefas:
   - Reunião Inicial
   - Desenvolvimento
   - Testes

3. Aloque operadores diferentes em cada subtarefa:
   - Reunião: João
   - Desenvolvimento: Eduardo
   - Testes: João + Eduardo

4. **Verificação:**
   - Lucas: 1 alocação (tarefa pai)
   - João: 2 alocações (Reunião + Testes)
   - Eduardo: 2 alocações (Desenvolvimento + Testes)
   - Total no banco: **5 registros**, não 8!

### Teste 3: Validação de Conflitos

1. Tente alocar João em "Reunião Inicial" de 10/01 a 15/01
2. Tente alocar João em "Desenvolvimento" de 12/01 a 20/01
3. **Deve bloquear:** Conflito de alocação sobreposta

✅ A herança de líderes **não interfere** na validação de conflitos!

## 📊 Benefícios

### 1. **Menos Registros no Banco**
- Antes: 1 líder + 3 subtarefas = **4 alocações**
- Agora: 1 líder (pai) + 0 (herdado) = **1 alocação**
- Economia: **75% menos registros para líderes**

### 2. **Interface Mais Limpa**
- Gestão de Recursos não mostra líderes duplicados
- Cada líder aparece uma única vez
- Mais fácil entender a carga de trabalho real

### 3. **Flexibilidade**
- Operadores podem ser alocados granularmente
- Controle fino sobre quem trabalha em cada subtarefa
- Sem perder a hierarquia organizacional

### 4. **Manutenção Simples**
- Trocar líder da tarefa pai → afeta todas as subtarefas automaticamente
- Não precisa atualizar múltiplos registros

## ⚠️ Considerações

### O que NÃO muda:

- ❌ **Não afeta validação de conflitos** - Operadores ainda não podem estar em duas tarefas ao mesmo tempo
- ❌ **Não cria alocações automáticas** - Apenas permite alocar operadores, não os aloca automaticamente
- ❌ **Não aparece no banco** - Herança é apenas lógica de UI, não há registros fantasma

### Limitações:

- 🔸 Herança funciona apenas **1 nível** (tarefa pai → subtarefa direta)
- 🔸 Se remover líder da tarefa pai, operadores nas subtarefas **permanecem**
- 🔸 Líderes herdados não aparecem em relatórios de alocação da subtarefa

## 🎓 Glossário

- **Tarefa Pai:** Tarefa de nível superior sem `parent_id`
- **Subtarefa:** Tarefa com `parent_id` apontando para tarefa pai
- **Líder Herdado:** Líder alocado na tarefa pai, visível nas subtarefas
- **Líder Efetivo:** Líderes diretos + herdados (usados para habilitar operadores)
- **Herança Implícita:** Lógica que "enxerga" líderes pai sem criar registros

---

**Status:** ✅ Implementado e testado
**Build:** ✅ Compilado com sucesso
**Versão:** 1.0 - Janeiro 2025
