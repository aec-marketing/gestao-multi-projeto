# Regras Oficiais de Cálculo - Sistema de Gestão de Projetos

## 📋 Regras Fundamentais

### 1. Duração de Tarefas

**Regra:** `DURAÇÃO = MAX(durações dos recursos)`

A duração de uma tarefa é determinada pelo recurso que **leva mais tempo** para completá-la.

#### Exemplos:

**Exemplo 1: Recursos com mesma capacidade**
```
Tarefa: Desenvolver módulo (540 minutos = 1 dia útil)
- Dev A (9h/dia) → 540min ÷ 540min/dia = 1.0 dia
- Dev B (9h/dia) → 540min ÷ 540min/dia = 1.0 dia

DURAÇÃO FINAL = MAX(1.0, 1.0) = 1.0 dia
```

**Exemplo 2: Recursos com capacidades diferentes**
```
Tarefa: Revisar código (540 minutos)
- Dev Senior (9h/dia) → 540min ÷ 540min/dia = 1.0 dia
- Dev Junior (6h/dia) → 540min ÷ 360min/dia = 1.5 dias

DURAÇÃO FINAL = MAX(1.0, 1.5) = 1.5 dias
```

**Exemplo 3: Múltiplos recursos, capacidades variadas**
```
Tarefa: Construir parede (1080 minutos = 2 dias úteis em 9h/dia)
- Pedreiro A (9h/dia) → 1080min ÷ 540min/dia = 2.0 dias
- Pedreiro B (6h/dia) → 1080min ÷ 360min/dia = 3.0 dias
- Ajudante (4h/dia) → 1080min ÷ 240min/dia = 4.5 dias

DURAÇÃO FINAL = MAX(2.0, 3.0, 4.5) = 4.5 dias
```

---

### 2. Custo de Tarefas

**Regra:** `CUSTO = SOMA(custos individuais de cada recurso)`

O custo total é a **soma** dos custos de todos os recursos alocados.

#### Fórmula Base:
```
Custo Individual = (Minutos Alocados ÷ 60) × Custo/Hora do Recurso
Custo Total = Σ Custos Individuais
```

#### Exemplos:

**Exemplo 1: Dois recursos com mesmo tempo**
```
Tarefa: 540 minutos
- Dev A: R$100/h × (540min ÷ 60) = R$100 × 9h = R$900
- Dev B: R$80/h × (540min ÷ 60) = R$80 × 9h = R$720

CUSTO TOTAL = R$900 + R$720 = R$1.620
```

**Exemplo 2: Recursos com tempos diferentes**
```
Tarefa: 1080 minutos (2 dias em 9h/dia)
- Senior (R$150/h, 9h/dia): 1080min ÷ 60 = 18h → R$150 × 18 = R$2.700
- Junior (R$60/h, 6h/dia): 1080min ÷ 60 = 18h → R$60 × 18 = R$1.080

CUSTO TOTAL = R$2.700 + R$1.080 = R$3.780
DURAÇÃO = MAX(18h ÷ 9h/dia, 18h ÷ 6h/dia) = MAX(2 dias, 3 dias) = 3 dias
```

---

### 3. Capacidade Diária de Recursos

**Regra:** A capacidade diária é **individual por recurso** e define quantos minutos de trabalho ele pode executar por dia.

#### Valores Padrão:
- **540 minutos** (9 horas/dia) - Jornada padrão
- Pode ser ajustado por recurso (ex: 360min = 6h, 480min = 8h)

#### Como Funciona:

**Cenário 1: Recurso de 9h/dia**
```
Recurso A: daily_capacity_minutes = 540
Tarefa: 1080 minutos

Dia 1: Aloca 540 minutos (restam 540)
Dia 2: Aloca 540 minutos (completa)

DURAÇÃO = 2 dias úteis
```

**Cenário 2: Recurso de 6h/dia**
```
Recurso B: daily_capacity_minutes = 360
Tarefa: 1080 minutos

Dia 1: Aloca 360 minutos (restam 720)
Dia 2: Aloca 360 minutos (restam 360)
Dia 3: Aloca 360 minutos (completa)

DURAÇÃO = 3 dias úteis
```

**Cenário 3: Múltiplos recursos na mesma tarefa**
```
Tarefa: 540 minutos
- Recurso A (9h/dia): 540 ÷ 540 = 1.0 dia
- Recurso B (6h/dia): 540 ÷ 360 = 1.5 dias
- Recurso C (4h/dia): 540 ÷ 240 = 2.25 dias

DURAÇÃO DA TAREFA = MAX(1.0, 1.5, 2.25) = 2.25 dias = 2 dias + 2 horas
```

---

### 4. Tipos de Tarefas

#### 4.1 **WORK (Produção)**
- Duração em **dias úteis** (exclui fins de semana)
- Consome capacidade do recurso
- Respeita `daily_capacity_minutes`
- Cálculo: `dias_necessários = duration_minutes ÷ daily_capacity_minutes`

**Exemplo:**
```
Tarefa WORK: 1080 minutos
Recurso: 9h/dia (540min)

Cálculo: 1080 ÷ 540 = 2 dias úteis
Início: Segunda 01/01
Fim: Terça 02/01 (pula sábado/domingo)
```

#### 4.2 **WAIT (Dependência/Espera)**
- Duração em **dias corridos** (inclui fins de semana)
- **NÃO** consome capacidade do recurso
- **NÃO** respeita jornada de trabalho
- Entrada: Dias corridos (não minutos)
- Conversão: `duration_minutes = dias_corridos × 1440`

**Exemplo:**
```
Tarefa WAIT: 7 dias corridos
Conversão: 7 × 1440 = 10080 minutos

Início: Segunda 01/01
Fim: Segunda 08/01 (conta sábado e domingo)
```

**Casos de Uso:**
- Aguardar fornecedor (5 dias corridos)
- Cura de concreto (28 dias corridos)
- Transporte internacional (15 dias corridos)
- Aprovação externa (3 dias corridos)

#### 4.3 **MILESTONE (Checkpoint)**
- Duração = **0 minutos**
- Marca eventos importantes
- Não consome capacidade
- Data início = Data fim

**Exemplos:**
- Início do projeto
- Entrega de fase
- Aprovação de cliente
- Conclusão

---

### 5. Cálculo de Data Final

#### 5.1 Para Tarefas WORK

**Algoritmo:**
```
1. remaining = duration_minutes
2. current_date = start_date
3. Enquanto remaining > 0:
   a. Se current_date é fim de semana → pular para próximo dia útil
   b. available = daily_capacity_minutes do recurso
   c. allocated = MIN(remaining, available)
   d. remaining -= allocated
   e. Se remaining > 0 → current_date += 1 dia
4. Retornar current_date
```

**Exemplo Prático:**
```
Tarefa: 1620 minutos
Recurso: 540 min/dia (9h)
Início: Sexta 05/01

Sexta 05/01: Aloca 540min (restam 1080)
Sábado 06/01: PULA (fim de semana)
Domingo 07/01: PULA (fim de semana)
Segunda 08/01: Aloca 540min (restam 540)
Terça 09/01: Aloca 540min (completa)

FIM = Terça 09/01
DURAÇÃO ÚTIL = 3 dias (sexta, segunda, terça)
```

#### 5.2 Para Tarefas WAIT

**Algoritmo:**
```
end_date = start_date + dias_corridos
(não pula fins de semana)
```

**Exemplo:**
```
Início: Sexta 05/01
Duração: 7 dias corridos

Contagem:
05/01 (Sexta) → Dia 1
06/01 (Sábado) → Dia 2
07/01 (Domingo) → Dia 3
08/01 (Segunda) → Dia 4
09/01 (Terça) → Dia 5
10/01 (Quarta) → Dia 6
11/01 (Quinta) → Dia 7

FIM = Quinta 11/01
```

---

### 6. Alocação de Recursos (Preparação Futura)

#### 6.1 Campos Atuais
```sql
allocations:
  - resource_id (qual recurso)
  - task_id (qual tarefa)
  - percentage (% de dedicação) ← ATUAL
```

#### 6.2 Campos Preparatórios (ONDA 3)
```sql
allocations:
  + allocated_minutes (minutos específicos)
  + overtime_minutes (hora extra)

tasks:
  + overtime_allowed (permite HE?)
  + actual_cost (custo real após execução)
```

#### 6.3 Lógica Futura de Alocação

**Caso 1: Alocação 100% (padrão atual)**
```
Tarefa: 540 minutos
Recurso: 9h/dia
Alocação: 100%

allocated_minutes = NULL (usa 100% da task)
Duração = 1 dia
```

**Caso 2: Alocação Parcial (futuro)**
```
Tarefa: 540 minutos
Recurso A: 50% → 270 minutos alocados
Recurso B: 50% → 270 minutos alocados

A (9h/dia): 270 ÷ 540 = 0.5 dia
B (6h/dia): 270 ÷ 360 = 0.75 dia

DURAÇÃO = MAX(0.5, 0.75) = 0.75 dia
```

**Caso 3: Hora Extra (futuro)**
```
Tarefa urgente: 810 minutos
Recurso: 9h/dia (540min normal)
overtime_allowed = true

Dia 1: 540 min normais + 270 min HE = 810 min
Custo normal: 540 ÷ 60 × R$100 = R$900
Custo HE: 270 ÷ 60 × R$100 × 1.5 = R$675
CUSTO TOTAL = R$1.575

DURAÇÃO = 1 dia (em vez de 1.5)
```

---

## 🎯 Regras de Negócio Resumidas

| Aspecto | Regra | Exceções |
|---------|-------|----------|
| **Duração** | MAX(recursos) | Milestone = 0 |
| **Custo** | SOMA(recursos) | - |
| **Capacidade** | Individual por recurso | Padrão = 540min |
| **Work** | Dias úteis | Pula fins de semana |
| **Wait** | Dias corridos | Inclui fins de semana |
| **Milestone** | Duração zero | - |
| **Fim de Semana** | Não conta para Work | Conta para Wait |

---

## 📊 Exemplos Completos

### Exemplo 1: Tarefa Simples com 1 Recurso
```
Tarefa: "Desenvolver API"
- Tipo: WORK
- Duração: 1620 minutos (3 dias em 9h/dia)
- Recurso: Dev Senior (R$150/h, 9h/dia = 540min/dia)
- Início: Segunda 08/01

Cálculo Duração:
  Segunda 08/01: 540min (restam 1080)
  Terça 09/01: 540min (restam 540)
  Quarta 10/01: 540min (completa)

Resultado:
  - Duração: 3 dias úteis
  - Fim: Quarta 10/01
  - Custo: (1620 ÷ 60) × R$150 = 27h × R$150 = R$4.050
```

### Exemplo 2: Tarefa com Múltiplos Recursos
```
Tarefa: "Construir fundação"
- Tipo: WORK
- Duração: 2160 minutos (4 dias em 9h/dia)
- Recursos:
  * Engenheiro (R$200/h, 9h/dia)
  * Pedreiro A (R$80/h, 9h/dia)
  * Pedreiro B (R$80/h, 6h/dia)
- Início: Segunda 08/01

Cálculo Individual:
  Engenheiro: 2160 ÷ 540 = 4.0 dias
  Pedreiro A: 2160 ÷ 540 = 4.0 dias
  Pedreiro B: 2160 ÷ 360 = 6.0 dias

Duração da Tarefa: MAX(4.0, 4.0, 6.0) = 6.0 dias

Datas:
  Início: Segunda 08/01
  Fim: Segunda 15/01 (pula sábado/domingo)

Custo:
  Engenheiro: (2160 ÷ 60) × R$200 = R$7.200
  Pedreiro A: (2160 ÷ 60) × R$80 = R$2.880
  Pedreiro B: (2160 ÷ 60) × R$80 = R$2.880
  TOTAL = R$12.960
```

### Exemplo 3: Tarefa WAIT
```
Tarefa: "Aguardar fornecedor"
- Tipo: WAIT
- Duração: 10 dias corridos
- Minutos: 10 × 1440 = 14400 minutos
- Início: Sexta 12/01

Cálculo:
  12/01 + 10 dias corridos = 22/01
  (inclui 2 fins de semana)

Resultado:
  - Fim: Segunda 22/01
  - Custo: R$0 (não consome recurso)
```

---

## 🔮 Preparação para Ondas Futuras

### ONDA 3: Calendário por Recurso
- Capacidade variável por dia (feriados, férias)
- Alocação parcial de recursos
- Controle de hora extra

### ONDA 4: Otimização Avançada
- Nivelamento de recursos
- Caminho crítico com múltiplos recursos
- Análise de sobrecarga

---

## ✅ Validação das Regras

Para validar se o sistema está correto, verifique:

1. **Duração:**
   - ✅ Tarefa com 1 recurso 9h/dia e 540min = 1 dia
   - ✅ Tarefa com 1 recurso 6h/dia e 540min = 1.5 dias
   - ✅ Tarefa com 2 recursos (9h e 6h) = duração do mais lento

2. **Custo:**
   - ✅ Soma de todos os recursos
   - ✅ Custo individual = (minutos ÷ 60) × custo/hora

3. **Tipos:**
   - ✅ WORK pula fins de semana
   - ✅ WAIT inclui fins de semana
   - ✅ MILESTONE tem duração zero

4. **Capacidade:**
   - ✅ Cada recurso tem sua própria capacidade diária
   - ✅ Padrão = 540 minutos (9h)

---

**Última atualização:** 2026-01-21
**Versão:** 1.0 - Jornadas Variáveis
