# StockFolio - Monitorização de Carteira de Ações

Uma aplicação web moderna e reativa desenvolvida em **Angular** e **TypeScript** para monitorização e gestão em tempo real de uma carteira de investimentos em ações.

## 🚀 Como Executar o Projeto

Certifique-se de que tem o **Node.js** instalado no seu computador.

### 1. Iniciar o Servidor de Desenvolvimento
Abra o terminal na pasta do projeto (`c:\Users\gabic\Documents\TP3`) e execute:
```powershell
npm start
```

### 2. Aceder no Navegador
Abra o navegador de internet no endereço:
[http://localhost:4200/](http://localhost:4200/)

---

## ✨ Requisitos Cumpridos

- **Dados Calculados a Azul**: As colunas `Total`, `Valor` e `Variação (%)` são calculadas automaticamente e destacadas visualmente.
- **Linha de Totais a Verde**: O rodapé consolida os valores totais de aquisição, valor atual da carteira e variação global, destacado a verde.
- **Variação Colorida**:
  - Variação positiva: Texto a **verde** com prefixo `+`.
  - Variação negativa: Texto a **vermelho** com prefixo `-`.
  - Variação nula (0%): Texto a **preto/cinza**.
- **REST API & Simulação**: Suporte a chamadas API em tempo real para a **Finnhub** ou simulação local com os dados estáticos do PDF (MSFT = 330, TSLA = 224).
- **Importação/Exportação JSON**: Carregamento da carteira a partir de ficheiros JSON e exportação com um clique.
- **Operações CRUD**: Adicione, edite ou remova ativos da sua carteira.

---

## 🛠️ Detalhes de Arquitetura

O projeto foi construído utilizando **Angular 19** com:
- Componentes Standalone (sem NgModules).
- Angular Signals (`signal`, `computed`) para reatividade e cálculo de totais.
- Persistência dos ativos e chave de API no `localStorage`.
