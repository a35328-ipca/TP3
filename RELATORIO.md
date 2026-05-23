# Relatório Técnico – TP3: Monitorização de Carteira de Ações

**Unidade Curricular:** Programação Web II  
**Tecnologias:** Angular 19 · TypeScript · REST API (Finnhub) · CSS Vanilla  

---

## 1. Descrição do Projeto

Aplicação web para gestão e monitorização em tempo real de uma carteira de investimentos em ações. O utilizador pode consultar, adicionar, editar e remover ativos, com os valores calculados automaticamente e as cotações atualizadas via API REST.

---

## 2. Tecnologias Utilizadas

| Tecnologia | Utilização |
|---|---|
| **Angular 19** | Framework principal (Standalone Components, Signals) |
| **TypeScript** | Linguagem de programação com tipagem forte |
| **RxJS** | Chamadas HTTP assíncronas e combinação de observables |
| **Finnhub REST API** | Cotações em tempo real dos ativos |
| **CSS Vanilla** | Design construído de raiz (sem frameworks CSS) |
| **localStorage** | Persistência da carteira no browser |

---

## 3. Funcionalidades Implementadas

### 3.1 Tabela de Carteira
- Colunas de dados: **Ticker, Empresa, Data de Compra, Quantidade, Preço de Compra**
- Colunas calculadas (destacadas a **azul**):
  - **Total** = Quantidade × Preço de Compra
  - **Valor** = Quantidade × Cotação do Dia
  - **Variação (%)** = ((Cotação − Preço Compra) / Preço Compra) × 100
- Linha de **Totais no rodapé** (destacada a **verde**) com soma acumulada
- Variação **verde** se positiva, **vermelha** se negativa, **neutra** se zero

### 3.2 API REST
- Integração com a **Finnhub API** para cotações em tempo real
- Modo Simulação com valores estáticos (MSFT=330, TSLA=224) para demonstração
- Fallback automático para dados locais em caso de erro na API

### 3.3 Persistência de Dados
- Carteira guardada automaticamente no **localStorage** do browser
- Os dados persistem entre sessões (fechar/abrir o browser)
- Importação e exportação da carteira em ficheiros **JSON**

### 3.4 Operações CRUD
- **Adicionar** novo ativo via modal com formulário validado
- **Editar** ativo existente (ticker, empresa, data, quantidade, preço)
- **Remover** ativo com confirmação

---

## 4. Arquitetura

```
src/app/
├── app.ts               # Componente principal (lógica de UI, CRUD, modais)
├── app.html             # Template com tabela, modais e dashboard
├── app.css              # Estilos do componente
├── services/
│   ├── portfolio.service.ts   # Estado da carteira, cálculos, localStorage
│   └── stock-api.service.ts   # Chamadas à Finnhub REST API
```

**Padrão de estado:** Angular Signals (`signal`, `computed`) para reatividade automática dos cálculos.

---

## 5. Design

- Tema escuro por defeito com alternância para tema claro
- Glassmorphism nos cartões e barra de navegação
- Dashboard com cartões de estatísticas e gráfico de distribuição da carteira
- Micro-animações e efeitos hover
- Design totalmente responsivo

---

## 6. Como Executar

```bash
npm install
npm start
# Aceder em: http://localhost:4200
```

---

## 7. Conclusão

O projeto cumpre todos os requisitos definidos:
- ✅ Cálculos corretos linha a linha e no total
- ✅ Desenvolvido com **Angular** e **REST API**
- ✅ Carteira guardada em base de dados local (localStorage)
- ✅ Design apelativo construído de raiz
