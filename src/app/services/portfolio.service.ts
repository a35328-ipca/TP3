import { Injectable, signal, computed } from '@angular/core';
import { StockApiService } from './stock-api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface StockItem {
  id: string;
  ticker: string;
  empresa: string;
  dataCompra: string;
  quantidade: number;
  precoCompra: number;
  // Calculated values (nullable until loaded/calculated)
  cotacaoDia?: number;
  total?: number;
  valor?: number;
  variacao?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  // Main state: array of stocks
  private readonly _stocks = signal<StockItem[]>([]);
  
  // Loading status signal
  isLoading = signal<boolean>(false);
  
  // Last update timestamp
  lastUpdated = signal<Date | null>(null);

  // Expose read-only stocks signal
  stocks = computed(() => this._stocks());

  // Calculated totals for the entire portfolio
  totals = computed(() => {
    const list = this._stocks();
    let totalInvestido = 0;
    let valorAtual = 0;

    list.forEach(item => {
      const itemTotal = item.quantidade * item.precoCompra;
      const itemValor = item.quantidade * (item.cotacaoDia ?? item.precoCompra);
      totalInvestido += itemTotal;
      valorAtual += itemValor;
    });

    const variacaoTotal = totalInvestido > 0 
      ? ((valorAtual - totalInvestido) / totalInvestido) * 100 
      : 0;

    return {
      totalInvestido,
      valorAtual,
      variacaoTotal
    };
  });

  constructor(private stockApi: StockApiService) {
    this.loadInitialData();
  }

  /**
   * Loads initial data: checks localStorage, and if empty, loads from public/portfolio.json or uses default values.
   */
  private async loadInitialData() {
    const stored = localStorage.getItem('portfolio_stocks');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StockItem[];
        this._stocks.set(parsed);
        this.refreshQuotes();
        return;
      } catch (e) {
        console.error('Failed to parse portfolio from localStorage, resetting...', e);
      }
    }

    // Default fallback (similar to the JSON we wrote in public/portfolio.json)
    const defaultStocks: StockItem[] = [
      {
        id: '1',
        ticker: 'MSFT',
        empresa: 'Microsoft',
        dataCompra: '2026-03-01',
        quantidade: 20,
        precoCompra: 320.00
      },
      {
        id: '2',
        ticker: 'TSLA',
        empresa: 'TESLA',
        dataCompra: '2026-03-20',
        quantidade: 50,
        precoCompra: 220.00
      }
    ];

    this._stocks.set(defaultStocks);
    this.saveToLocalStorage();
    this.refreshQuotes();
  }

  saveToLocalStorage() {
    // Save only core fields to local storage, quotes are fetched dynamically
    const cleanList = this._stocks().map(({ id, ticker, empresa, dataCompra, quantidade, precoCompra }) => ({
      id, ticker, empresa, dataCompra, quantidade, precoCompra
    }));
    localStorage.setItem('portfolio_stocks', JSON.stringify(cleanList));
  }

  /**
   * Refreshes current quotes for all stocks from the StockApiService
   */
  refreshQuotes() {
    const currentList = this._stocks();
    if (currentList.length === 0) {
      this.lastUpdated.set(new Date());
      return;
    }

    this.isLoading.set(true);

    const requests = currentList.map(item => 
      this.stockApi.getQuote(item.ticker, item.precoCompra).pipe(
        catchError(() => of(item.precoCompra)) // fallback to purchase price on failure
      )
    );

    forkJoin(requests).subscribe({
      next: (quotes) => {
        const updated = currentList.map((item, idx) => {
          const cotacaoDia = quotes[idx];
          const total = item.quantidade * item.precoCompra;
          const valor = item.quantidade * cotacaoDia;
          const variacao = item.precoCompra > 0 
            ? ((cotacaoDia - item.precoCompra) / item.precoCompra) * 100 
            : 0;

          return {
            ...item,
            cotacaoDia,
            total,
            valor,
            variacao
          };
        });

        this._stocks.set(updated);
        this.lastUpdated.set(new Date());
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to refresh portfolio quotes:', err);
        this.isLoading.set(false);
      }
    });
  }

  addStock(stock: Omit<StockItem, 'id' | 'cotacaoDia' | 'total' | 'valor' | 'variacao'>) {
    const newStock: StockItem = {
      ...stock,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      ticker: stock.ticker.trim().toUpperCase()
    };

    this._stocks.update(prev => [...prev, newStock]);
    this.saveToLocalStorage();
    this.refreshQuotes();
  }

  updateStock(id: string, updatedFields: Partial<Omit<StockItem, 'id'>>) {
    this._stocks.update(prev => 
      prev.map(item => item.id === id ? { ...item, ...updatedFields } : item)
    );
    this.saveToLocalStorage();
    this.refreshQuotes();
  }

  deleteStock(id: string) {
    this._stocks.update(prev => prev.filter(item => item.id !== id));
    this.saveToLocalStorage();
    // No need to refresh API quotes since we only removed a row, but let's update values
    this.saveToLocalStorage();
  }

  /**
   * Imports portfolio from a JSON file.
   */
  async loadFromJsonFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          
          if (!Array.isArray(parsed)) {
            throw new Error('JSON format is invalid. Must be an array of stocks.');
          }

          // Validate and map elements
          const mapped: StockItem[] = parsed.map((item: any, index: number) => {
            if (!item.ticker || !item.quantidade || !item.precoCompra) {
              throw new Error(`Item at position ${index + 1} is missing required fields (ticker, quantidade, precoCompra).`);
            }
            
            return {
              id: item.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
              ticker: String(item.ticker).trim().toUpperCase(),
              empresa: String(item.empresa || item.ticker).trim(),
              dataCompra: item.dataCompra || new Date().toISOString().split('T')[0],
              quantidade: Number(item.quantidade),
              precoCompra: Number(item.precoCompra)
            };
          });

          this._stocks.set(mapped);
          this.saveToLocalStorage();
          this.refreshQuotes();
          resolve();
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsText(file);
    });
  }

  /**
   * Exports the current portfolio to a JSON file.
   */
  exportToJson() {
    const list = this._stocks().map(({ ticker, empresa, dataCompra, quantidade, precoCompra }) => ({
      ticker, empresa, dataCompra, quantidade, precoCompra
    }));
    
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(list, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'portfolio.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  }
}
