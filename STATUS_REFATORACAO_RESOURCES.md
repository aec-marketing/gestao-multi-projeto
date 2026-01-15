# Status da Refatoração - Recursos com Função Livre

## ✅ Concluído

### 1. Migrations SQL
- ✅ Campo `role` na tabela `resources` convertido de ENUM para TEXT
- ✅ Campo `client_name` adicionado à tabela `projects`
- ✅ Campo `client_logo_url` adicionado à tabela `projects`
- ✅ Testes confirmaram conversão bem-sucedida

### 2. Tipos TypeScript
- ✅ `database.types.ts` atualizado:
  - `resources.role`: `'gerente' | 'lider' | 'operador'` → `string | null`
  - `projects.client_name`: `string | null` (novo)
  - `projects.client_logo_url`: `string | null` (novo)

## ⚠️ Problema Atual - Build Falhando

### Erro de Compilação
```
Type error: Type 'GroupedResources' is not assignable to type 'GroupedResources'
  Types of property 'gerente' are incompatible
    Type 'string | null' is not assignable to type 'string'
```

**Localização**: `src/components/calendar-v2/CalendarLayout.tsx:172`

### Causa Raiz
O sistema de calendário atual agrupa recursos por `role` usando categorias fixas:
```typescript
interface GroupedResources {
  gerente: Resource[]
  lider: Resource[]
  operador: Resource[]
}
```

Mas agora que `role` é texto livre (`string | null`), essa estrutura não funciona mais.

---

## 🔧 Solução Proposta

### Opção 1: Agrupamento Dinâmico (Recomendado)
Refatorar o calendário para agrupar recursos dinamicamente por qualquer `role`:

```typescript
interface GroupedResources {
  [role: string]: Resource[]  // Ex: { "Engenheiro": [...], "Líder": [...] }
}
```

**Vantagens**:
- ✅ Suporta qualquer função customizada
- ✅ Flexível para futuro
- ✅ Não limita o usuário

**Desvantagens**:
- ⚠️ Requer refatoração do `useCalendarData.ts` e `TimelineView.tsx`
- ⚠️ Precisa decidir ordem de exibição dos grupos

### Opção 2: Manter Grupos Padrão + "Outros" (Solução Rápida)
Manter estrutura atual mas adicionar grupo "outros":

```typescript
interface GroupedResources {
  gerente: Resource[]
  lider: Resource[]
  operador: Resource[]
  outros: Resource[]  // Qualquer role não reconhecida
}
```

**Vantagens**:
- ✅ Mudança mínima no código
- ✅ Compatível com código existente

**Desvantagens**:
- ❌ Não aproveita totalmente a flexibilidade do role livre
- ❌ Recursos com roles customizadas vão para "outros" genérico

---

## 📋 Arquivos que Precisam ser Atualizados

### Opção 1 - Agrupamento Dinâmico

1. **`src/hooks/calendar/useCalendarData.ts`**
   - Mudar lógica de agrupamento de recursos
   - Agrupar dinamicamente por `role` (ex: `groupBy(resources, 'role')`)
   - Retornar `Record<string, Resource[]>` ao invés de estrutura fixa

2. **`src/components/calendar-v2/TimelineView.tsx`**
   - Atualizar interface `GroupedResources`
   - Iterar dinamicamente sobre `Object.keys(groupedResources)`
   - Mostrar nome do role como header do grupo

3. **`src/components/calendar-v2/CalendarLayout.tsx`**
   - Atualizar lógica de `allResources` para lidar com estrutura dinâmica
   - Ex: `Object.values(groupedResources).flat()`

4. **`src/contexts/ResourceContext.tsx`**
   - Remover função `getResourcesByRole()` com tipo fixo
   - Adicionar `getResourcesByRoleText(roleText: string): Resource[]`

### Opção 2 - Manter Grupos + "Outros"

1. **`src/hooks/calendar/useCalendarData.ts`**
   - Adicionar case para role não reconhecida → vai para "outros"

2. **`src/components/calendar-v2/TimelineView.tsx`**
   - Adicionar seção "Outros" no render

---

## 🎯 Recomendação

**Opção 1 (Agrupamento Dinâmico)** é a melhor escolha a longo prazo, pois:
- O usuário pediu explicitamente "texto livre" para função
- Permite funções como "Engenheiro", "Eletricista", "Soldador", etc.
- Escalável e profissional

**Tempo estimado**: ~1-2 horas de refatoração

---

## 🚀 Próximos Passos (Após Decidir)

1. Implementar solução escolhida
2. Testar calendário com roles customizadas
3. Adicionar UI para editar `role` dos recursos (ex: no modal de edição)
4. Implementar features restantes:
   - Cliente na importação de projeto
   - Cliente/Logo na edição de projeto
   - Zoom timeline no calendário
   - Filtro por projeto
   - Fins de semana no Gantt

---

## ❓ Decisão Necessária

**Qual opção você prefere?**

A. **Agrupamento Dinâmico** - Mostra cada role customizada como um grupo separado
B. **Manter Grupos Padrão + "Outros"** - Mantém gerente/lider/operador, resto vai para "outros"

Ou quer uma **Opção 3 híbrida**?
