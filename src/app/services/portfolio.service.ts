import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StockApiService } from './stock-api.service';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

export interface StockItem {
  id: string;
  ticker: string;
  empresa: string;
  dataCompra: string;
  quantidade: number;
  precoCompra: number;
  // Valores calculados (vindos das cotações, não guardados na BD)
  cotacaoDia?: number;
  total?: number;
  valor?: number;
  variacao?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private readonly API = '/api/portfolio';

  // Estado principal: lista de ativos
  private readonly _stocks = signal<StockItem[]>([]);

  // Estado de carregamento
  isLoading = signal<boolean>(false);

  // Timestamp da última atualização de cotações
  lastUpdated = signal<Date | null>(null);

  // Erro de backend (para mostrar aviso na UI se a API falhar)
  backendError = signal<boolean>(false);

  // Exposição read-only da lista
  stocks = computed(() => this._stocks());

  // Totais calculados reativamente
  totals = computed(() => {
    const list = this._stocks();
    let totalInvestido = 0;
    let valorAtual = 0;

    list.forEach(item => {
      totalInvestido += item.quantidade * item.precoCompra;
      valorAtual += item.quantidade * (item.cotacaoDia ?? item.precoCompra);
    });

    const variacaoTotal = totalInvestido > 0
      ? ((valorAtual - totalInvestido) / totalInvestido) * 100
      : 0;

    return { totalInvestido, valorAtual, variacaoTotal };
  });

  constructor(
    private http: HttpClient,
    private stockApi: StockApiService
  ) {
    this.loadFromApi();
  }

  // ─────────────────────────────────────────────────────
  // Carrega a carteira completa da API REST (base de dados)
  // ─────────────────────────────────────────────────────
  loadFromApi() {
    this.isLoading.set(true);
    this.backendError.set(false);

    this.http.get<StockItem[]>(this.API).pipe(
      catchError(err => {
        console.error('⚠️ Backend indisponível, a usar localStorage como fallback:', err);
        this.backendError.set(true);
        // Fallback: localStorage → dados padrão
        const stored = localStorage.getItem('portfolio_stocks');
        const fallback: StockItem[] = stored ? JSON.parse(stored) : this.getDefaultStocks();
        return of(fallback);
      })
    ).subscribe(stocks => {
      if (stocks.length === 0 && !this.backendError()) {
        // BD vazia e backend disponível → semear dados padrão
        this.seedDefaultsToBackend();
      } else {
        this._stocks.set(stocks);
        this.isLoading.set(false);
        this.refreshQuotes();
      }
    });
  }

  // ─────────────────────────────────────────────────────
  // Semeia os ativos padrão na base de dados (BD vazia)
  // ─────────────────────────────────────────────────────
  private seedDefaultsToBackend() {
    const defaults = [
      { ticker: 'MSFT', empresa: 'Microsoft', dataCompra: '2026-03-01', quantidade: 20, precoCompra: 320.00 },
      { ticker: 'TSLA', empresa: 'TESLA',     dataCompra: '2026-03-20', quantidade: 50, precoCompra: 220.00 }
    ];

    this.http.post<{ message: string; data: StockItem[] }>(`${this.API}/import`, defaults).subscribe({
      next: result => {
        this._stocks.set(result.data);
        this.isLoading.set(false);
        this.refreshQuotes();
        console.log('✅ Dados padrão semeados na base de dados SQLite.');
      },
      error: err => {
        console.error('Erro ao semear dados padrão:', err);
        this._stocks.set(this.getDefaultStocks());
        this.isLoading.set(false);
        this.refreshQuotes();
      }
    });
  }

  // ─────────────────────────────────────────────────────
  // Atualiza cotações para todos os ativos
  // ─────────────────────────────────────────────────────
  refreshQuotes() {
    const currentList = this._stocks();
    if (currentList.length === 0) {
      this.lastUpdated.set(new Date());
      return;
    }

    this.isLoading.set(true);

    const requests = currentList.map(item =>
      this.stockApi.getQuote(item.ticker, item.precoCompra).pipe(
        catchError(() => of(item.precoCompra))
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
          return { ...item, cotacaoDia, total, valor, variacao };
        });
        this._stocks.set(updated);
        this.lastUpdated.set(new Date());
        this.isLoading.set(false);

        // Guardar também em localStorage como cache/fallback
        this.saveToLocalStorage(updated);
      },
      error: (err) => {
        console.error('Erro ao atualizar cotações:', err);
        this.isLoading.set(false);
      }
    });
  }

  // ─────────────────────────────────────────────────────
  // Adicionar novo ativo (POST → base de dados)
  // ─────────────────────────────────────────────────────
  addStock(stock: Omit<StockItem, 'id' | 'cotacaoDia' | 'total' | 'valor' | 'variacao'>): Promise<void> {
    const payload = {
      ...stock,
      ticker: stock.ticker.trim().toUpperCase()
    };

    return new Promise((resolve, reject) => {
      this.http.post<StockItem>(this.API, payload).pipe(
        catchError(err => {
          // Fallback: adicionar localmente se o backend estiver em baixo
          console.warn('Backend em baixo — a guardar localmente:', err);
          const local: StockItem = {
            ...payload,
            id: crypto.randomUUID()
          };
          this._stocks.update(prev => [...prev, local]);
          this.saveToLocalStorage(this._stocks());
          this.refreshQuotes();
          resolve();
          return of(null);
        }),
        switchMap(created => {
          if (created) {
            this._stocks.update(prev => [...prev, created]);
            this.saveToLocalStorage(this._stocks());
            this.refreshQuotes();
            resolve();
          }
          return of(null);
        })
      ).subscribe({ error: reject });
    });
  }

  // ─────────────────────────────────────────────────────
  // Atualizar ativo existente (PUT → base de dados)
  // ─────────────────────────────────────────────────────
  updateStock(id: string, updatedFields: Partial<Omit<StockItem, 'id'>>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.put<StockItem>(`${this.API}/${id}`, updatedFields).pipe(
        catchError(err => {
          // Fallback local
          console.warn('Backend em baixo — a atualizar localmente:', err);
          this._stocks.update(prev =>
            prev.map(item => item.id === id ? { ...item, ...updatedFields } : item)
          );
          this.saveToLocalStorage(this._stocks());
          this.refreshQuotes();
          resolve();
          return of(null);
        }),
        switchMap(updated => {
          if (updated) {
            this._stocks.update(prev =>
              prev.map(item => item.id === id ? { ...item, ...updated } : item)
            );
            this.saveToLocalStorage(this._stocks());
            this.refreshQuotes();
            resolve();
          }
          return of(null);
        })
      ).subscribe({ error: reject });
    });
  }

  // ─────────────────────────────────────────────────────
  // Remover ativo (DELETE → base de dados)
  // ─────────────────────────────────────────────────────
  deleteStock(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.delete(`${this.API}/${id}`).pipe(
        catchError(err => {
          // Fallback local
          console.warn('Backend em baixo — a remover localmente:', err);
          this._stocks.update(prev => prev.filter(item => item.id !== id));
          this.saveToLocalStorage(this._stocks());
          resolve();
          return of(null);
        })
      ).subscribe({
        next: () => {
          this._stocks.update(prev => prev.filter(item => item.id !== id));
          this.saveToLocalStorage(this._stocks());
          resolve();
        },
        error: reject
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Importar carteira a partir de ficheiro JSON
  // ─────────────────────────────────────────────────────
  async loadFromJsonFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);

          if (!Array.isArray(parsed)) {
            throw new Error('O ficheiro JSON deve conter um array de ativos.');
          }

          const mapped = parsed.map((item: any, index: number) => {
            if (!item.ticker || item.quantidade == null || item.precoCompra == null) {
              throw new Error(`Item na posição ${index + 1} tem campos obrigatórios em falta.`);
            }
            return {
              ticker: String(item.ticker).trim().toUpperCase(),
              empresa: String(item.empresa || item.ticker).trim(),
              dataCompra: item.dataCompra || new Date().toISOString().split('T')[0],
              quantidade: Number(item.quantidade),
              precoCompra: Number(item.precoCompra)
            };
          });

          // Enviar para o backend (endpoint de importação em massa)
          this.http.post<{ message: string; data: StockItem[] }>(`${this.API}/import`, mapped).pipe(
            catchError(err => {
              // Fallback local
              console.warn('Backend em baixo — importação local:', err);
              const localStocks: StockItem[] = mapped.map((s: any) => ({
                ...s,
                id: crypto.randomUUID()
              }));
              this._stocks.set(localStocks);
              this.saveToLocalStorage(localStocks);
              this.refreshQuotes();
              resolve();
              return of(null);
            })
          ).subscribe({
            next: (result) => {
              if (result) {
                this._stocks.set(result.data);
                this.saveToLocalStorage(result.data);
                this.refreshQuotes();
                resolve();
              }
            },
            error: reject
          });
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o ficheiro.'));
      reader.readAsText(file);
    });
  }

  // ─────────────────────────────────────────────────────
  // Exportar carteira para ficheiro JSON
  // ─────────────────────────────────────────────────────
  exportToJson() {
    const list = this._stocks().map(({ ticker, empresa, dataCompra, quantidade, precoCompra }) => ({
      ticker, empresa, dataCompra, quantidade, precoCompra
    }));

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(list, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'portfolio.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ─────────────────────────────────────────────────────
  // Helpers privados
  // ─────────────────────────────────────────────────────
  private saveToLocalStorage(stocks: StockItem[]) {
    const clean = stocks.map(({ id, ticker, empresa, dataCompra, quantidade, precoCompra }) => ({
      id, ticker, empresa, dataCompra, quantidade, precoCompra
    }));
    localStorage.setItem('portfolio_stocks', JSON.stringify(clean));
  }

  private getDefaultStocks(): StockItem[] {
    return [
      {
        id: crypto.randomUUID(),
        ticker: 'MSFT',
        empresa: 'Microsoft',
        dataCompra: '2026-03-01',
        quantidade: 20,
        precoCompra: 320.00
      },
      {
        id: crypto.randomUUID(),
        ticker: 'TSLA',
        empresa: 'TESLA',
        dataCompra: '2026-03-20',
        quantidade: 50,
        precoCompra: 220.00
      }
    ];
  }
}
