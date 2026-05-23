import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioService, StockItem } from './services/portfolio.service';
import { StockApiService } from './services/stock-api.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  // Services Injection
  protected readonly portfolioService = inject(PortfolioService);
  protected readonly stockApi = inject(StockApiService);

  // Search and Sort State
  protected readonly searchQuery = signal<string>('');
  protected readonly sortField = signal<string>('ticker');
  protected readonly sortAsc = signal<boolean>(true);

  // Modals Visibility
  protected readonly showAddModal = signal<boolean>(false);
  protected readonly showEditModal = signal<boolean>(false);
  protected readonly showSettingsModal = signal<boolean>(false);

  // Theme State
  protected readonly isLightTheme = signal<boolean>(false);

  // Form States (Add)
  protected newTicker = '';
  protected newEmpresa = '';
  protected newDataCompra = '';
  protected newQuantidade: number | null = null;
  protected newPrecoCompra: number | null = null;

  // Form States (Edit)
  protected editingId = '';
  protected editTicker = '';
  protected editEmpresa = '';
  protected editDataCompra = '';
  protected editQuantidade: number | null = null;
  protected editPrecoCompra: number | null = null;

  // Form States (Settings)
  protected configApiKey = '';
  protected configIsDemo = true;

  // Notifications
  protected notification = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // Calculated reactive list of filtered and sorted stocks
  protected readonly filteredAndSortedStocks = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    let list = [...this.portfolioService.stocks()];

    // 1. Filter
    if (query) {
      list = list.filter(item => 
        item.ticker.toLowerCase().includes(query) || 
        item.empresa.toLowerCase().includes(query)
      );
    }

    // 2. Sort
    const field = this.sortField();
    const asc = this.sortAsc();

    list.sort((a, b) => {
      let valA: any = a[field as keyof StockItem];
      let valB: any = b[field as keyof StockItem];

      // Handle fallback default values for sorting empty values
      if (valA === undefined) valA = 0;
      if (valB === undefined) valB = 0;

      // Type-specific comparison
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });

    return list;
  });

  // Calculate Asset Allocation percentages for dynamic SVG donut chart visualization
  protected readonly chartAllocation = computed(() => {
    const list = this.portfolioService.stocks();
    const totals = this.portfolioService.totals();
    if (list.length === 0 || totals.valorAtual === 0) return [];

    // Group value by ticker
    const groups: Record<string, { ticker: string; empresa: string; value: number }> = {};
    list.forEach(item => {
      const val = item.quantidade * (item.cotacaoDia ?? item.precoCompra);
      if (groups[item.ticker]) {
        groups[item.ticker].value += val;
      } else {
        groups[item.ticker] = {
          ticker: item.ticker,
          empresa: item.empresa,
          value: val
        };
      }
    });

    // Color list for donut slices
    const colors = [
      '#6366f1', // Indigo
      '#0ea5e9', // Sky Blue
      '#10b981', // Emerald Green
      '#f59e0b', // Amber
      '#ec4899', // Pink
      '#8b5cf6', // Purple
      '#14b8a6', // Teal
      '#f43f5e'  // Rose
    ];

    let cumPercent = 0;
    return Object.values(groups)
      .map((g, index) => {
        const pct = (g.value / totals.valorAtual) * 100;
        const color = colors[index % colors.length];
        const item = {
          ...g,
          percentage: pct,
          color,
          cumPercent
        };
        cumPercent += pct;
        return item;
      })
      .sort((a, b) => b.value - a.value);
  });

  ngOnInit() {
    // Synchronize initial settings state
    this.configApiKey = this.stockApi.apiKey();
    this.configIsDemo = this.stockApi.isDemoMode();
    this.newDataCompra = new Date().toISOString().split('T')[0];

    // Load initial theme from localStorage if set
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      this.toggleTheme();
    }
  }

  // --- ACTIONS ---

  protected toggleTheme() {
    this.isLightTheme.update(val => {
      const newVal = !val;
      const body = document.body;
      if (newVal) {
        body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      } else {
        body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      }
      return newVal;
    });
  }

  protected changeSort(field: string) {
    if (this.sortField() === field) {
      this.sortAsc.update(val => !val);
    } else {
      this.sortField.set(field);
      this.sortAsc.set(true);
    }
  }

  protected showToast(message: string, type: 'success' | 'error' = 'success') {
    this.notification.set({ message, type });
    setTimeout(() => {
      this.notification.set(null);
    }, 4000);
  }

  protected triggerRefresh() {
    this.portfolioService.refreshQuotes();
    this.showToast('Preços e cotações atualizados com sucesso!');
  }

  // --- CRUD ACTIONS ---

  protected openAddModal() {
    this.newTicker = '';
    this.newEmpresa = '';
    this.newDataCompra = new Date().toISOString().split('T')[0];
    this.newQuantidade = null;
    this.newPrecoCompra = null;
    this.showAddModal.set(true);
  }

  protected closeAddModal() {
    this.showAddModal.set(false);
  }

  protected handleAddStock() {
    if (!this.newTicker || !this.newEmpresa || !this.newDataCompra || this.newQuantidade === null || this.newPrecoCompra === null) {
      this.showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (this.newQuantidade <= 0 || this.newPrecoCompra <= 0) {
      this.showToast('Quantidade e Preço de Compra devem ser valores positivos.', 'error');
      return;
    }

    this.portfolioService.addStock({
      ticker: this.newTicker,
      empresa: this.newEmpresa,
      dataCompra: this.newDataCompra,
      quantidade: this.newQuantidade,
      precoCompra: this.newPrecoCompra
    });

    this.closeAddModal();
    this.showToast(`Ação ${this.newTicker.toUpperCase()} adicionada com sucesso!`);
  }

  protected openEditModal(stock: StockItem) {
    this.editingId = stock.id;
    this.editTicker = stock.ticker;
    this.editEmpresa = stock.empresa;
    this.editDataCompra = stock.dataCompra;
    this.editQuantidade = stock.quantidade;
    this.editPrecoCompra = stock.precoCompra;
    this.showEditModal.set(true);
  }

  protected closeEditModal() {
    this.showEditModal.set(false);
  }

  protected handleEditStock() {
    if (!this.editTicker || !this.editEmpresa || !this.editDataCompra || this.editQuantidade === null || this.editPrecoCompra === null) {
      this.showToast('Por favor, preencha todos os campos.', 'error');
      return;
    }

    if (this.editQuantidade <= 0 || this.editPrecoCompra <= 0) {
      this.showToast('Quantidade e Preço devem ser positivos.', 'error');
      return;
    }

    this.portfolioService.updateStock(this.editingId, {
      ticker: this.editTicker,
      empresa: this.editEmpresa,
      dataCompra: this.editDataCompra,
      quantidade: this.editQuantidade,
      precoCompra: this.editPrecoCompra
    });

    this.closeEditModal();
    this.showToast(`Ação ${this.editTicker.toUpperCase()} atualizada com sucesso!`);
  }

  protected handleDeleteStock(stock: StockItem) {
    if (confirm(`Tem a certeza que deseja remover ${stock.ticker} (${stock.empresa}) da sua carteira?`)) {
      this.portfolioService.deleteStock(stock.id);
      this.showToast(`Ação ${stock.ticker} removida com sucesso!`);
    }
  }

  // --- SETTINGS ---

  protected openSettingsModal() {
    this.configApiKey = this.stockApi.apiKey();
    this.configIsDemo = this.stockApi.isDemoMode();
    this.showSettingsModal.set(true);
  }

  protected closeSettingsModal() {
    this.showSettingsModal.set(false);
  }

  protected handleSaveSettings() {
    this.stockApi.setApiKey(this.configApiKey);
    this.stockApi.setDemoMode(this.configIsDemo);
    this.portfolioService.refreshQuotes();
    this.closeSettingsModal();
    this.showToast('Configurações gravadas e atualizadas com sucesso!');
  }

  // --- FILE MANAGEMENT ---

  protected onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.portfolioService.loadFromJsonFile(file)
        .then(() => {
          this.showToast('Carteira importada com sucesso a partir do ficheiro JSON!');
          input.value = ''; // Reset input element
        })
        .catch(err => {
          this.showToast(`Erro ao importar ficheiro JSON: ${err.message || err}`, 'error');
          input.value = ''; // Reset input element
        });
    }
  }

  protected handleExport() {
    this.portfolioService.exportToJson();
    this.showToast('Carteira exportada para portfolio.json com sucesso!');
  }
}
