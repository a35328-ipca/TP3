import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface QuoteResponse {
  c: number;   // Current price
  h: number;   // High price of the day
  l: number;   // Low price of the day
  o: number;   // Open price of the day
  pc: number;  // Previous close price
  d: number;   // Change
  dp: number;  // Percent change
}

@Injectable({
  providedIn: 'root'
})
export class StockApiService {
  private readonly FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
  
  // API Key state stored in localStorage
  apiKey = signal<string>(localStorage.getItem('finnhub_api_key') || '');
  
  // Demo mode state
  isDemoMode = signal<boolean>(localStorage.getItem('use_demo_mode') !== 'false');

  // Realistic mock data matching the PDF example
  private mockPrices: Record<string, number> = {
    'MSFT': 330.00,
    'TSLA': 224.00,
    'AAPL': 175.50,
    'AMZN': 180.20,
    'GOOGL': 152.80,
    'NVDA': 920.00,
    'NFLX': 610.50,
    'META': 475.30
  };

  constructor(private http: HttpClient) {}

  setApiKey(key: string) {
    this.apiKey.set(key);
    localStorage.setItem('finnhub_api_key', key);
    if (key) {
      this.setDemoMode(false);
    }
  }

  setDemoMode(isDemo: boolean) {
    this.isDemoMode.set(isDemo);
    localStorage.setItem('use_demo_mode', String(isDemo));
  }

  /**
   * Fetches the quote for a stock.
   * If demo mode is active or key is missing, returns mock data.
   */
  getQuote(symbol: string, purchasePrice?: number): Observable<number> {
    const sym = symbol.trim().toUpperCase();
    const key = this.apiKey();

    if (this.isDemoMode() || !key) {
      // Return mock price if available, or generate a realistic change from purchase price
      let mockPrice = this.mockPrices[sym];
      if (mockPrice === undefined) {
        // Generate a stable mock price based on purchase price (e.g. +1.5% to +5% variation)
        const base = purchasePrice || 100;
        const randomPercent = 1 + (Math.sin(sym.charCodeAt(0)) * 0.05 + 0.02); // Deterministic "random" variation
        mockPrice = Math.round(base * randomPercent * 100) / 100;
      }
      return of(mockPrice);
    }

    // Call real REST API
    const url = `${this.FINNHUB_BASE_URL}/quote?symbol=${sym}&token=${key}`;
    return this.http.get<QuoteResponse>(url).pipe(
      map(response => {
        // If API returned 0 or null (e.g., rate limit or invalid symbol), fallback or throw
        if (!response || response.c === 0) {
          throw new Error('Symbol not found or API limit reached');
        }
        return response.c;
      }),
      catchError(error => {
        console.warn(`Error fetching quote for ${sym}, falling back to mock:`, error);
        // Fallback to mock data on error so UI doesn't break
        let fallbackPrice = this.mockPrices[sym];
        if (fallbackPrice === undefined) {
          fallbackPrice = purchasePrice || 100;
        }
        return of(fallbackPrice);
      })
    );
  }
}
