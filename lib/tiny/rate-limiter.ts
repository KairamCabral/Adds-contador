/**
 * Rate Limiter inteligente para API do Tiny ERP
 * 
 * Características:
 * - Concorrência limitada (1-2 requests simultâneos)
 * - Intervalo mínimo entre requests (configurável)
 * - Respeita Retry-After do 429
 * - Backoff exponencial com teto
 * - Limite de tentativas
 */

interface RateLimiterConfig {
  /** Intervalo mínimo entre requests em ms (padrão: 1000ms) */
  minInterval: number;
  /** Número máximo de requests simultâneos (padrão: 1) */
  concurrency: number;
  /** Número máximo de tentativas em caso de 429 (padrão: 2) */
  maxRetries: number;
  /** Backoff inicial em ms (padrão: 2000ms) */
  initialBackoff: number;
  /** Backoff máximo em ms (padrão: 20000ms) */
  maxBackoff: number;
}

type QueueItem = {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

export class TinyRateLimiter {
  private config: RateLimiterConfig;
  private queue: QueueItem[] = [];
  private activeRequests = 0;
  private lastRequestTime = 0;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = {
      minInterval: parseInt(process.env.TINY_MIN_INTERVAL || "1000", 10),
      concurrency: parseInt(process.env.TINY_CONCURRENCY || "1", 10),
      maxRetries: parseInt(process.env.TINY_MAX_RETRIES || "2", 10),
      initialBackoff: parseInt(process.env.TINY_INITIAL_BACKOFF || "2000", 10),
      maxBackoff: parseInt(process.env.TINY_MAX_BACKOFF || "20000", 10),
      ...config,
    };
  }

  /**
   * Executa uma função com rate limiting e retry inteligente
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: () => fn() as Promise<unknown>,
        resolve: (value: unknown) => resolve(value as T),
        reject: (reason: unknown) => reject(reason),
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    // Se já atingiu o limite de concorrência ou não há itens na fila
    if (this.activeRequests >= this.config.concurrency || this.queue.length === 0) {
      return;
    }

    // Aguardar intervalo mínimo desde o último request
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.minInterval) {
      const delay = this.config.minInterval - timeSinceLastRequest;
      setTimeout(() => this.processQueue(), delay);
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeRequests++;
    this.lastRequestTime = Date.now();

    try {
      const result = await this.executeWithRetry(item.fn);
      item.resolve(result);
    } catch (error: unknown) {
      item.reject(error);
    } finally {
      this.activeRequests--;
      // Processar próximo item da fila
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), this.config.minInterval);
      }
    }
  }

  private async executeWithRetry(fn: () => Promise<unknown>): Promise<unknown> {
    let lastError: unknown = null;
    let backoff = this.config.initialBackoff;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;

        // Se não for 429, não tentar novamente
        const errorObj = error as { status?: number; statusCode?: number; retryAfter?: number | string };
        if (errorObj.status !== 429 && errorObj.statusCode !== 429) {
          throw error;
        }

        // Se for a última tentativa, lançar erro
        if (attempt === this.config.maxRetries) {
          console.warn(
            `[RateLimiter] Limite de tentativas atingido após ${attempt + 1} tentativas (429)`
          );
          throw error;
        }

        // Calcular delay: usar Retry-After se disponível, senão backoff exponencial
        let delay = backoff;
        
        if (errorObj.retryAfter) {
          // Retry-After pode ser em segundos ou uma data
          if (typeof errorObj.retryAfter === "number") {
            delay = errorObj.retryAfter * 1000;
          } else {
            const retryDate = new Date(errorObj.retryAfter);
            delay = Math.max(0, retryDate.getTime() - Date.now());
          }
        }

        // Aplicar teto ao delay
        delay = Math.min(delay, this.config.maxBackoff);

        console.log(
          `[RateLimiter] 429 recebido, aguardando ${delay}ms antes da tentativa ${attempt + 2}/${this.config.maxRetries + 1}`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));

        // Backoff exponencial para próxima tentativa
        backoff = Math.min(backoff * 2, this.config.maxBackoff);
      }
    }

    throw lastError || new Error("Falha desconhecida no rate limiter");
  }

  /**
   * Retorna estatísticas do rate limiter
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      activeRequests: this.activeRequests,
      config: this.config,
    };
  }
}

// Singleton global para reusar entre requests
let globalLimiter: TinyRateLimiter | null = null;

export function getTinyRateLimiter(): TinyRateLimiter {
  if (!globalLimiter) {
    globalLimiter = new TinyRateLimiter();
  }
  return globalLimiter;
}
