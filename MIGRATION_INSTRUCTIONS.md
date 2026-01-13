# Instruções de Migration - lag_days

## O que é?

Este documento contém instruções para aplicar a migration que adiciona o campo `lag_days` à tabela `tasks`.

## O que faz?

O campo `lag_days` permite adicionar dias de "folga" ou "buffer" a uma tarefa sem alterar suas datas de início e fim. Isso é útil quando você quer aumentar a duração estimada de uma tarefa, mas manter o cronograma inalterado.

Exemplo:
- Tarefa: 01/01 até 05/01 (5 dias)
- Aumentar duração para 6 dias
- Escolher "Definir como Lag/Buffer"
- Resultado: 01/01 até 05/01 **+1 dia de folga**

## Como aplicar?

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Cole o SQL abaixo e clique em **Run**

```sql
-- Add lag_days column to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS lag_days INTEGER DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN tasks.lag_days IS 'Buffer days that can be used if needed without affecting the schedule. Shown as +N badge on end date.';
```

### Opção 2: Via CLI (Se tiver Supabase CLI instalado)

```bash
# Na pasta raiz do projeto
npx supabase db push
```

Isso aplicará automaticamente todas as migrations pendentes.

## Verificar se funcionou

Execute esta query para verificar se o campo foi adicionado:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
AND column_name = 'lag_days';
```

Deve retornar:
```
column_name | data_type | column_default
------------|-----------|----------------
lag_days    | integer   | 0
```

## Rollback (se necessário)

Se precisar reverter a migration:

```sql
ALTER TABLE tasks DROP COLUMN IF EXISTS lag_days;
```

**⚠️ ATENÇÃO:** Isso apagará todos os dados de lag_days existentes.

## Próximos passos

Após aplicar a migration, a funcionalidade de ajuste de duração já estará disponível no TableViewTab:

1. Edite o campo "Duração (dias)" de uma tarefa
2. Um modal aparecerá com 3 opções:
   - **Acrescentar dias**: Estende a data final
   - **Adiantar início**: Move a data inicial para trás
   - **Definir como Lag/Buffer**: Adiciona folga sem alterar datas
3. Se escolher a opção de lag, um badge verde "+N" aparecerá ao lado da data de fim
