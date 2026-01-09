# Gantt Chart Components

Esta pasta contém os componentes, utilidades e tipos relacionados à visualização Gantt do projeto.

## 📁 Estrutura

```
gantt/
├── types/
│   └── gantt.types.ts          # Tipos TypeScript para Gantt
├── utils/
│   ├── ganttCalculations.ts    # Funções de cálculo (datas, hierarquia)
│   └── ganttColors.ts          # Cores e estilos CSS
├── BufferBar.tsx               # Barra de buffer do projeto
├── BufferConfiguration.tsx     # Configuração de buffer
└── PredecessorLines.tsx        # Linhas de dependência
```

## 🔄 Componente Principal

O componente principal `GanttViewTab.tsx` está localizado em:
`src/components/project-views/GanttViewTab.tsx`

**Backup original:** `GanttViewTab.original.backup.tsx`

## 📦 Utilitários Extraídos

### `types/gantt.types.ts`
- `TaskWithDates` - Tarefa com datas calculadas
- `TaskWithAllocations` - Tarefa com alocações de recursos
- `ResizeState` - Estado de redimensionamento de tarefa
- `ZoomLevel` - Níveis de zoom (day/week/month)

### `utils/ganttCalculations.ts`
Funções puras de cálculo:
- `calculateTaskDates()` - Calcula datas das tarefas
- `organizeTasksHierarchy()` - Organiza hierarquia pai/filho
- `getAllDescendants()` - Pega todos os descendentes
- `calculateDateRange()` - Range de datas do timeline
- `generateTimelineColumns()` - Gera colunas do timeline
- `getColumnWidth()` - Largura da coluna por zoom
- `isSubtaskDelayed()` - Verifica se subtarefa está atrasada
- `getTaskBarStyle()` - Estilo de posicionamento da barra

### `utils/ganttColors.ts`
- `getTaskColor()` - Cor da barra por tipo de tarefa
- `ganttStyles` - CSS-in-JS para animações e estilos

## 🎯 Funcionalidades do Gantt

1. **Visualização Timeline**
   - Zoom: Dia, Semana, Mês
   - Arrastar e redimensionar tarefas
   - Cores por tipo de tarefa

2. **Hierarquia de Tarefas**
   - Tarefas principais e subtarefas
   - Expansão/colapso de hierarquia
   - Indentação visual

3. **Dependências (Predecessores)**
   - Tipos: Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF)
   - Linhas visuais de conexão
   - Recálculo automático em cascata
   - Detecção de ciclos

4. **Alocação de Recursos**
   - Visualização de pessoas alocadas
   - Modal de gerenciamento
   - Conflitos de alocação

5. **Buffer de Projeto (CCPM)**
   - Cálculo automático
   - Visualização de consumo
   - Configuração personalizada

6. **Drag & Drop**
   - Reordenar tarefas
   - Atualização de sort_order
   - Validações de hierarquia

7. **Resize de Tarefas**
   - Alças esquerda e direita
   - Atualização de duração
   - Recálculo de dependentes

8. **Filtros**
   - Por tipo de tarefa
   - Por pessoa alocada
   - Por progresso (não iniciado, em andamento, concluído)

## 🔧 Próximas Melhorias

1. Extrair componentes de UI:
   - `GanttTaskRow` - Linha de tarefa recursiva
   - `GanttTaskBar` - Barra visual no timeline
   - `GanttTimeline` - Grid de datas
   - `GanttFilters` - Barra de filtros

2. Extrair hooks customizados:
   - `useGanttResize` - Lógica de resize
   - `useGanttDragDrop` - Lógica de drag & drop
   - `useGanttPredecessors` - Lógica de predecessores

3. Separar lógica de negócio do componente UI

## 📝 Notas Técnicas

- O componente usa React hooks extensivamente
- Estado complexo com múltiplos `useState`
- Manipulação de DOM para drag & drop
- Cálculos de datas baseados em predecessores
- Integração com Supabase para persistência
