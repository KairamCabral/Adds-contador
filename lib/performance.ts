// Performance utilities para monitoramento e otimização

/**
 * Medir tempo de execução de uma função
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Debounce para otimizar chamadas frequentes
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle para limitar taxa de execução
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Cache simples em memória com TTL
 */
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  
  constructor(private ttl: number = 60000) {} // Default 1 minuto
  
  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl,
    });
  }
  
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return item.value;
  }
  
  clear(): void {
    this.cache.clear();
  }
}
