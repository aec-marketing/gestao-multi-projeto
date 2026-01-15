# Guia de Testes - Predecessores e Caminho Crítico

## 🎯 Mudanças Implementadas

Foram resolvidos os 3 problemas críticos identificados no sistema de predecessores:

### ✅ 1. CPM (Critical Path Method) Adequado
- **Antes**: Algoritmo simplista que só verificava gaps de 1 dia
- **Agora**: Implementação completa do CPM com forward/backward pass
- **Arquivo**: `src/utils/criticalPath.ts`

### ✅ 2. Timezone Handling Corrigido
- **Antes**: Parsing manual de datas em múltiplos lugares
- **Agora**: Funções centralizadas `parseLocalDate()` e `formatLocalDate()`
- **Arquivo**: `src/utils/taskDateSync.ts`

### ✅ 3. Tipo SF Documentado
- **Antes**: Código referenciava SF mas não estava implementado
- **Agora**: Comentário explicativo no código
- **Arquivo**: `src/components/gantt/PredecessorLines.tsx`

### ✅ 4. Visualização do Caminho Crítico
- **Novo**: Hook `useCriticalPath` para calcular automaticamente
- **Novo**: Componente `CriticalPathIndicator` para mostrar estatísticas
- **Arquivos**: `src/hooks/useCriticalPath.ts`, `src/components/gantt/CriticalPathIndicator.tsx`

---

## 📋 Como Testar

### Preparação

1. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

2. **Abra um projeto existente** que tenha:
   - Pelo menos 5 tarefas
   - Alguns relacionamentos de predecessor
   - Datas definidas

---

## 🧪 Teste 1: Calcular Caminho Crítico

### Objetivo
Verificar se o algoritmo CPM calcula corretamente o caminho crítico.

### Passos

1. **Crie um projeto de teste simples**:
   ```
   Tarefa A: 01/01 - 05/01 (5 dias) - Sem predecessores
   Tarefa B: 06/01 - 10/01 (5 dias) - Predecessor: A (FS)
   Tarefa C: 06/01 - 08/01 (3 dias) - Predecessor: A (FS)
   Tarefa D: 11/01 - 15/01 (5 dias) - Predecessor: B (FS)
   ```

2. **Analise o resultado esperado**:
   - **Caminho Crítico**: A → B → D (15 dias)
   - **Slack**: Tarefa C tem 2 dias de slack (pode atrasar 2 dias sem impactar o projeto)

3. **Abra o console do navegador (F12)**

4. **Execute o cálculo manualmente** (cole no console):
```javascript
// Importar funções necessárias
const { calculateCriticalPath } = await import('/src/utils/criticalPath.ts')

// Buscar tarefas e predecessores do projeto
const projectId = 'SEU_PROJECT_ID_AQUI'

const { data: tasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', projectId)

const { data: predecessors } = await supabase
  .from('predecessors')
  .select('*')

// Calcular CPM
const result = calculateCriticalPath(tasks, predecessors)

// Mostrar resultados
console.log('=== RESULTADO DO CPM ===')
console.log('Duração do Projeto:', result.projectDuration, 'dias')
console.log('Término Projetado:', result.projectEarlyFinish.toLocaleDateString('pt-BR'))
console.log('\n=== CAMINHO CRÍTICO ===')
console.log('Total de tarefas críticas:', result.criticalPath.length)

// Mostrar detalhes de cada tarefa
for (const [taskId, cpmTask] of result.tasks.entries()) {
  const task = tasks.find(t => t.id === taskId)
  console.log('\n---', task.name, '---')
  console.log('  Early Start:', cpmTask.earlyStart.toLocaleDateString('pt-BR'))
  console.log('  Early Finish:', cpmTask.earlyFinish.toLocaleDateString('pt-BR'))
  console.log('  Late Start:', cpmTask.lateStart.toLocaleDateString('pt-BR'))
  console.log('  Late Finish:', cpmTask.lateFinish.toLocaleDateString('pt-BR'))
  console.log('  Total Slack:', cpmTask.totalSlack, 'dias')
  console.log('  Free Slack:', cpmTask.freeSlack, 'dias')
  console.log('  É Crítica?', cpmTask.isCritical ? 'SIM ⚡' : 'NÃO')
}
```

### ✅ Resultado Esperado

- Tarefas A, B e D devem aparecer como **críticas** (slack = 0)
- Tarefa C deve ter **slack > 0** (não crítica)
- Duração do projeto deve ser **15 dias**
- Campo `is_critical_path` deve ser atualizado no banco de dados

---

## 🧪 Teste 2: Timezone Handling

### Objetivo
Verificar se as datas são parseadas corretamente sem problemas de timezone.

### Passos

1. **Crie uma tarefa com data específica**: `2025-03-15`

2. **Execute no console**:
```javascript
const { parseLocalDate, formatLocalDate } = await import('/src/utils/taskDateSync.ts')

// Testar parse
const date1 = parseLocalDate('2025-03-15')
console.log('Data parseada:', date1)
console.log('Dia:', date1.getDate()) // Deve ser 15
console.log('Mês:', date1.getMonth() + 1) // Deve ser 3
console.log('Ano:', date1.getFullYear()) // Deve ser 2025

// Testar format
const formatted = formatLocalDate(date1)
console.log('Data formatada:', formatted) // Deve ser '2025-03-15'

// Testar com timezone diferente
const date2 = parseLocalDate('2025-12-31')
console.log('Último dia do ano:', date2.getDate()) // Deve ser 31 (não 30 ou 1)
```

### ✅ Resultado Esperado

- Todas as datas devem ser exatamente como especificadas
- Não deve haver off-by-one errors
- A hora deve sempre ser `00:00:00` (meia-noite local)

---

## 🧪 Teste 3: Visualização do Caminho Crítico

### Objetivo
Verificar se o componente visual mostra corretamente as estatísticas.

### Passos (Futuro - quando integrado no Gantt)

1. **Abra um projeto** na visualização Gantt

2. **Procure pelo banner do caminho crítico** no topo da página

3. **Verifique as informações**:
   - Número de tarefas críticas
   - Percentual do projeto
   - Duração total
   - Botão "Recalcular"

4. **Clique em "Recalcular"**
   - Deve mostrar "Calculando..."
   - Deve atualizar os números

5. **Modifique uma tarefa crítica**:
   - Aumente a duração de uma tarefa no caminho crítico
   - O indicador deve atualizar automaticamente (após 500ms)
   - A duração do projeto deve aumentar

### ✅ Resultado Esperado

- Estatísticas precisas
- Atualização automática após mudanças
- Visual claro e informativo

---

## 🧪 Teste 4: Recálculo em Cascata

### Objetivo
Verificar se o recálculo continua funcionando corretamente com o novo timezone handling.

### Passos

1. **Crie uma cadeia de predecessores**:
   ```
   A → B → C → D
   (cada tarefa com FS = Finish-to-Start)
   ```

2. **Mude a data de início da Tarefa A**:
   - Exemplo: De 01/01 para 05/01 (4 dias de atraso)

3. **Vá para a aba "Predecessores e Dependências"**

4. **Clique em "Detectar Conflitos"**

5. **Verifique o resultado**:
   - Deve detectar que B, C e D precisam ser movidas
   - Deve calcular as novas datas corretamente
   - Deve oferecer aplicar as correções

6. **Aplique as correções**

7. **Verifique no banco**:
```sql
SELECT name, start_date, end_date FROM tasks WHERE project_id = 'SEU_PROJECT_ID' ORDER BY start_date;
```

### ✅ Resultado Esperado

- Todas as datas devem ser movidas corretamente
- Nenhuma data com off-by-one error
- Caminho crítico deve ser recalculado automaticamente

---

## 🧪 Teste 5: Performance com Projetos Grandes

### Objetivo
Verificar se o CPM não degrada performance em projetos grandes.

### Passos

1. **Crie um projeto com 50+ tarefas** (pode usar import de MS Project)

2. **Adicione relacionamentos de predecessores complexos**

3. **Abra o console e meça o tempo**:
```javascript
const { calculateCriticalPath } = await import('/src/utils/criticalPath.ts')

const { data: tasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', 'SEU_PROJECT_ID')

const { data: predecessors } = await supabase
  .from('predecessors')
  .select('*')

console.time('CPM Calculation')
const result = calculateCriticalPath(tasks, predecessors)
console.timeEnd('CPM Calculation')

console.log('Tarefas processadas:', result.tasks.size)
console.log('Caminho crítico:', result.criticalPath.length)
```

### ✅ Resultado Esperado

- Cálculo deve levar **< 1 segundo** para 50-100 tarefas
- Cálculo deve levar **< 5 segundos** para 200-500 tarefas
- Sem travamentos ou lentidão perceptível

---

## 🧪 Teste 6: Edge Cases

### Objetivo
Testar cenários extremos e edge cases.

### Cenários

#### 6.1: Projeto sem predecessores
- **Setup**: Projeto com 5 tarefas, nenhum predecessor
- **Esperado**: Todas as tarefas são "críticas" (caminho crítico = todas as tarefas em paralelo)

#### 6.2: Ciclo de predecessores
- **Setup**: A → B → C → A (ciclo)
- **Esperado**: Sistema deve detectar ciclo e não calcular CPM (ou ignorar)

#### 6.3: Predecessor com lag negativo (lead time)
- **Setup**: A → B com lag_time = -2 (B começa 2 dias antes de A terminar)
- **Esperado**: B deve começar 2 dias antes do esperado

#### 6.4: Tarefa sem datas
- **Setup**: Tarefa A tem datas, B não tem
- **Esperado**: CPM deve ignorar B ou calcular data baseada em A

#### 6.5: Múltiplos predecessores
- **Setup**: C tem predecessores A e B (FS)
- **Esperado**: C deve começar após o ÚLTIMO predecessor terminar

---

## 📊 Relatório de Testes

Após executar todos os testes, preencha:

| Teste | Status | Observações |
|-------|--------|-------------|
| 1. Calcular Caminho Crítico | ⬜ | |
| 2. Timezone Handling | ⬜ | |
| 3. Visualização (Futuro) | ⬜ | |
| 4. Recálculo em Cascata | ⬜ | |
| 5. Performance | ⬜ | |
| 6.1 Sem Predecessores | ⬜ | |
| 6.2 Ciclo | ⬜ | |
| 6.3 Lag Negativo | ⬜ | |
| 6.4 Sem Datas | ⬜ | |
| 6.5 Múltiplos Predecessores | ⬜ | |

Legenda: ✅ Passou | ❌ Falhou | ⚠️ Parcial | ⬜ Não testado

---

## 🐛 Problemas Conhecidos

Se encontrar bugs, documente:

1. **Descrição do problema**
2. **Passos para reproduzir**
3. **Resultado esperado vs. obtido**
4. **Console errors** (se houver)

---

## 💡 Próximos Passos

Após validar essas mudanças críticas, podemos implementar:

1. **Integração completa no Gantt** - Adicionar `CriticalPathIndicator` e `useCriticalPath` no GanttViewTab
2. **Destacar tarefas críticas** - Barra vermelha para tarefas do caminho crítico
3. **Tooltip com slack** - Mostrar informações de float ao passar mouse
4. **Alertas de impacto** - Avisar quando mudanças afetam o caminho crítico
5. **Otimização de performance** - Memoização e lazy loading para projetos > 500 tarefas

---

## 📚 Referências Técnicas

### Arquivos Criados/Modificados:
- ✨ `src/utils/criticalPath.ts` - Implementação completa do CPM
- ✨ `src/hooks/useCriticalPath.ts` - Hook React para gerenciar cálculo
- ✨ `src/components/gantt/CriticalPathIndicator.tsx` - Componente visual
- 🔧 `src/utils/taskDateSync.ts` - Melhorias em parseLocalDate e formatLocalDate
- 🔧 `src/utils/predecessorCalculations.ts` - Uso das funções centralizadas de data
- 🔧 `src/components/gantt/PredecessorLines.tsx` - Documentação sobre SF
- 🔧 `src/components/GanttPresentationPage.tsx` - Fix de tipos

### Algoritmo CPM:
O algoritmo implementado segue o método clássico:
1. **Forward Pass**: Early Start/Finish usando ordenação topológica
2. **Backward Pass**: Late Start/Finish em ordem reversa
3. **Slack**: Total Slack = Late Start - Early Start
4. **Critical Path**: Tarefas com Total Slack ≤ 0

### Complexidade:
- **Tempo**: O(V + E) onde V = tarefas, E = predecessores
- **Espaço**: O(V) para armazenar resultados
- **Otimizado**: Usa BFS/ordenação topológica (não força bruta)
