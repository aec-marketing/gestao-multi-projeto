# Guia de Testes - Validação de Conflitos de Recursos

## Objetivo
Testar a nova funcionalidade de detecção automática de conflitos ao alocar recursos em tarefas.

## Preparação Inicial

### 1. Iniciar o Ambiente de Desenvolvimento
```bash
npm run dev
```

### 2. Acessar o Dashboard
Abra o navegador em: `http://localhost:3000`

---

## Cenários de Teste

### ✅ Teste 1: Alocação Normal (SEM Conflito)

**Objetivo:** Verificar que alocações válidas funcionam normalmente

**Passos:**
1. No Dashboard, clique em um projeto existente
2. Encontre uma tarefa qualquer (ex: "Instalação Elétrica")
3. Clique no botão "👥 Alocar" da tarefa
4. Selecione um líder/operador que **não está alocado em outras tarefas**
5. Escolha uma prioridade
6. Clique em "✓ Alocar Pessoa"

**Resultado Esperado:**
- ✅ Mensagem de sucesso: "Recurso alocado com sucesso!"
- ✅ Modal fecha automaticamente
- ✅ Recurso aparece na lista de pessoas alocadas
- ❌ **NÃO deve** aparecer mensagem de conflito

---

### ⚠️ Teste 2: Conflito - Alocação Sobreposta

**Objetivo:** Detectar quando um recurso já está alocado em outra tarefa no mesmo período

**Preparação:**
1. Crie ou use um projeto com **2 tarefas com datas sobrepostas**
   - Tarefa A: 10/01/2025 a 20/01/2025
   - Tarefa B: 15/01/2025 a 25/01/2025

**Passos:**
1. Aloque um recurso (ex: "João Silva") na **Tarefa A**
2. Tente alocar o **mesmo recurso** na **Tarefa B**
3. Observe a resposta do sistema

**Resultado Esperado:**
- ⚠️ Aparecer caixa vermelha de conflito
- 📊 Mensagem: "Já alocado em outra tarefa"
- 📝 Detalhes: "Recurso já alocado na tarefa [Nome da Tarefa A] de 10/01/2025 a 20/01/2025"
- 🔴 Botão "Escolher outro recurso"
- ❌ Alocação **NÃO deve ser criada**

**Verificação:**
- Vá até o banco Supabase → Tabela `allocations`
- Confirme que há apenas 1 alocação (da Tarefa A)

---

### 🚫 Teste 3: Conflito - Evento Pessoal Bloqueante

**Objetivo:** Detectar quando um recurso tem férias/licença médica/treinamento no período

**Preparação:**
1. Abra o Dashboard
2. Clique em "👥 Recursos"
3. Selecione um recurso (ex: "Maria Costa")
4. Clique em "📅 Eventos Pessoais"
5. Adicione um evento bloqueante:
   - **Tipo:** Férias
   - **Data Início:** 10/01/2025
   - **Data Fim:** 15/01/2025
   - **Bloqueia trabalho:** ✅ SIM

**Passos:**
1. Tente alocar "Maria Costa" em uma tarefa que vai de 12/01/2025 a 20/01/2025
2. Observe a resposta

**Resultado Esperado:**
- ⚠️ Caixa vermelha de conflito
- 🚫 Mensagem: "Evento pessoal bloqueante"
- 📝 Detalhes: "Recurso indisponível: Férias de 10/01/2025 a 15/01/2025"
- ❌ Alocação **NÃO deve ser criada**

---

### 🔄 Teste 4: Múltiplos Conflitos

**Objetivo:** Verificar que o sistema detecta vários conflitos ao mesmo tempo

**Preparação:**
1. Use um recurso que já está alocado em uma tarefa (Conflito 1)
2. Adicione um evento pessoal bloqueante para o mesmo recurso (Conflito 2)

**Passos:**
1. Tente alocar este recurso em uma nova tarefa que sobrepõe ambos

**Resultado Esperado:**
- ⚠️ **Dois** blocos de conflito aparecem:
  - 📊 Alocação sobreposta
  - 🚫 Evento pessoal bloqueante
- Lista completa de todos os conflitos
- ❌ Alocação bloqueada

---

### ✅ Teste 5: Tarefas Sem Sobreposição (Deve Permitir)

**Objetivo:** Garantir que o mesmo recurso pode ser alocado em tarefas em períodos diferentes

**Preparação:**
1. Tarefa A: 01/01/2025 a 10/01/2025
2. Tarefa B: 15/01/2025 a 25/01/2025 (sem sobreposição)

**Passos:**
1. Aloque "Pedro Santos" na Tarefa A
2. Aloque "Pedro Santos" na Tarefa B

**Resultado Esperado:**
- ✅ Ambas as alocações devem funcionar
- ❌ **NÃO deve** aparecer conflito
- Recurso aparece alocado em ambas as tarefas

---

### 📅 Teste 6: Evento Pessoal NÃO Bloqueante

**Objetivo:** Verificar que eventos que não bloqueiam trabalho não impedem alocações

**Preparação:**
1. Crie um evento pessoal com **"Bloqueia trabalho: NÃO"**
   - Tipo: Treinamento opcional
   - Data: 10/01/2025 a 15/01/2025
   - **Bloqueia trabalho:** ❌ NÃO

**Passos:**
1. Tente alocar o recurso em uma tarefa de 12/01/2025 a 20/01/2025

**Resultado Esperado:**
- ✅ Alocação deve funcionar normalmente
- ❌ **NÃO deve** aparecer conflito
- Eventos não-bloqueantes são ignorados

---

### 🔄 Teste 7: Atualização Global (Context)

**Objetivo:** Verificar que dados são compartilhados globalmente

**Passos:**
1. Abra o Dashboard em uma aba
2. Aloque um recurso em uma tarefa
3. Observe os cards de estatísticas no topo
4. Vá até "👥 Recursos" sem recarregar a página

**Resultado Esperado:**
- ✅ Estatísticas atualizam automaticamente
- ✅ Recursos Manager mostra alocações atualizadas
- ✅ Sem necessidade de refresh manual

---

### 🗑️ Teste 8: Remover Alocação e Realocar

**Objetivo:** Verificar que remover alocação libera o recurso

**Passos:**
1. Aloque "Ana Silva" em uma tarefa
2. Tente alocar "Ana Silva" em outra tarefa sobreposta → deve dar conflito
3. Remova a primeira alocação (botão "Remover")
4. Tente alocar novamente na segunda tarefa

**Resultado Esperado:**
- ⚠️ Passo 2: Conflito detectado
- ✅ Passo 4: Alocação funciona (conflito resolvido)

---

## Verificações no Banco de Dados

### Consultas Úteis no Supabase SQL Editor:

**1. Ver todas as alocações:**
```sql
SELECT
  a.id,
  r.name as recurso,
  t.name as tarefa,
  a.start_date,
  a.end_date,
  a.priority
FROM allocations a
JOIN resources r ON a.resource_id = r.id
JOIN tasks t ON a.task_id = t.id
ORDER BY a.start_date;
```

**2. Ver eventos pessoais bloqueantes:**
```sql
SELECT
  r.name as recurso,
  pe.title,
  pe.event_type,
  pe.start_date,
  pe.end_date,
  pe.blocks_work
FROM personal_events pe
JOIN resources r ON pe.resource_id = r.id
WHERE pe.blocks_work = true
ORDER BY pe.start_date;
```

**3. Verificar conflitos manualmente:**
```sql
-- Alocações do mesmo recurso com datas sobrepostas
SELECT
  r.name,
  t1.name as tarefa1,
  a1.start_date as inicio1,
  a1.end_date as fim1,
  t2.name as tarefa2,
  a2.start_date as inicio2,
  a2.end_date as fim2
FROM allocations a1
JOIN allocations a2 ON a1.resource_id = a2.resource_id AND a1.id < a2.id
JOIN resources r ON a1.resource_id = r.id
JOIN tasks t1 ON a1.task_id = t1.id
JOIN tasks t2 ON a2.task_id = t2.id
WHERE (a1.start_date, a1.end_date) OVERLAPS (a2.start_date, a2.end_date);
```

---

## Checklist Final

- [ ] Teste 1: Alocação normal sem conflitos
- [ ] Teste 2: Conflito de alocação sobreposta
- [ ] Teste 3: Conflito de evento pessoal bloqueante
- [ ] Teste 4: Múltiplos conflitos simultâneos
- [ ] Teste 5: Tarefas sem sobreposição (deve permitir)
- [ ] Teste 6: Evento não-bloqueante (deve permitir)
- [ ] Teste 7: Atualização global do contexto
- [ ] Teste 8: Remover e realocar recurso
- [ ] Build sem erros (`npm run build`)
- [ ] Console do navegador sem erros

---

## Ferramentas de Debug

### Console do Navegador (F12)
Procure por logs do tipo:
- ✅ `[ResourceContext] Loaded X allocations`
- ⚠️ `[resource-service] Allocation has conflicts`
- ✅ `[resource-service] Allocation created successfully`

### React DevTools
- Verifique o `ResourceContext.Provider` no componente tree
- Inspecione state de `conflicts`, `showConflictWarning` no AllocationModal

---

## Resultado Final Esperado

✅ **Sistema deve:**
- Detectar conflitos automaticamente
- Mostrar mensagens claras e específicas
- Bloquear alocações inválidas
- Permitir alocações válidas normalmente
- Manter dados sincronizados globalmente

❌ **Sistema NÃO deve:**
- Criar alocações quando há conflitos
- Permitir dupla alocação no mesmo período
- Alocar durante férias/licenças
- Requerer refresh manual após mudanças
