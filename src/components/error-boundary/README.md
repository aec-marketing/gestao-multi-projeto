# Error Boundaries

React Error Boundaries para capturar e tratar erros de renderização graciosamente.

## 📦 Componentes

### `ErrorBoundary`
Error boundary global para capturar erros em toda a aplicação.

**Uso:**
```tsx
import { ErrorBoundary } from '@/components/error-boundary'

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Props:**
- `children` - Componentes filhos a serem protegidos
- `fallback?` - UI personalizada para mostrar quando houver erro
- `onError?` - Callback quando um erro é capturado

**Características:**
- ✅ Previne crash completo da aplicação
- ✅ Mostra UI amigável ao usuário
- ✅ Botão para recarregar a página
- ✅ Detalhes do erro em modo development
- ✅ Tela full-page com glassmorphism

### `ComponentErrorBoundary`
Error boundary para isolar erros em componentes específicos.

**Uso:**
```tsx
import { ComponentErrorBoundary } from '@/components/error-boundary'

<ComponentErrorBoundary
  componentName="Gantt View"
  onReset={handleReset}
>
  <GanttViewTab {...props} />
</ComponentErrorBoundary>
```

**Props:**
- `children` - Componente a ser protegido
- `componentName?` - Nome do componente para mensagem de erro
- `onReset?` - Callback quando usuário clica em "Tentar Novamente"

**Características:**
- ✅ Erro isolado - não afeta o resto da página
- ✅ UI inline com mensagem contextual
- ✅ Botão "Tentar Novamente" com reset
- ✅ Detalhes técnicos expansíveis em dev mode
- ✅ Continua usando outras partes do sistema

## 🎯 Onde Usar

### Global Error Boundary
✅ **Já implementado em:** `src/app/layout.tsx`

Envolve toda a aplicação para capturar erros críticos.

### Component Error Boundaries
✅ **Já implementado em:** `src/components/ProjectGanttPage.tsx`

Protege cada view do projeto:
- Gantt View
- Table View
- Timeline View
- Financial View
- Predecessors View

### Recomendado Adicionar Em:
- [ ] Dashboard principal
- [ ] ResourceManager
- [ ] Calendar views
- [ ] Import MS Project
- [ ] Modals complexos

## 🔧 Como Adicionar

### 1. Para páginas inteiras:
```tsx
import { ErrorBoundary } from '@/components/error-boundary'

export default function MyPage() {
  return (
    <ErrorBoundary>
      {/* conteúdo da página */}
    </ErrorBoundary>
  )
}
```

### 2. Para componentes específicos:
```tsx
import { ComponentErrorBoundary } from '@/components/error-boundary'

<ComponentErrorBoundary
  componentName="My Component"
  onReset={() => refetchData()}
>
  <MyComponent />
</ComponentErrorBoundary>
```

### 3. Com fallback customizado:
```tsx
<ErrorBoundary
  fallback={
    <div className="error-custom">
      <h1>Ops! Algo deu errado</h1>
      <button onClick={() => window.location.reload()}>
        Recarregar
      </button>
    </div>
  }
>
  <MyApp />
</ErrorBoundary>
```

## 🐛 Comportamento em Development vs Production

### Development Mode
- ✅ Detalhes completos do erro
- ✅ Stack trace visível
- ✅ Console.error com informações

### Production Mode
- ✅ Mensagem amigável ao usuário
- ❌ Sem detalhes técnicos expostos
- ✅ Erro silencioso no console

## 📊 Benefícios

1. **Melhor UX**
   - Usuário não vê tela branca
   - Mensagem clara sobre o problema
   - Opção de tentar novamente

2. **Isolamento de Erros**
   - Um componente quebrado não derruba toda a página
   - Outras funcionalidades continuam funcionando

3. **Debug Facilitado**
   - Stack trace disponível em dev
   - Callback `onError` para logging customizado

4. **Prevenção de Crashes**
   - Aplicação permanece responsiva
   - Usuário pode navegar para outras páginas

## ⚠️ Limitações

Error Boundaries **NÃO** capturam:
- ❌ Erros em event handlers (use try-catch)
- ❌ Erros em código assíncrono (use try-catch)
- ❌ Erros no próprio Error Boundary
- ❌ Erros em Server Components (use error.tsx do Next.js)

Para esses casos, use tratamento manual com try-catch.

## 🔗 Próximos Passos

1. Adicionar logging de erros para serviço externo (Sentry, LogRocket)
2. Implementar Error Boundaries em mais componentes
3. Criar métricas de erros
4. Adicionar retry automático para erros transitórios
