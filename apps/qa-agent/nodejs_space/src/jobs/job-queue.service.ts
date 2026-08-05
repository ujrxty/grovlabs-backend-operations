import { Injectable, Logger } from '@nestjs/common';

export interface Job<T = any> {
  id: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);
  private processing = false;
  private queue: Job[] = [];
  private handlers: Map<string, (data: any) => Promise<void>> = new Map();

  registerHandler(name: string, handler: (data: any) => Promise<void>) {
    this.handlers.set(name, handler);
    this.logger.log(`Job handler registered: ${name}`);
  }

  async addJob(name: string, data: any, maxAttempts = 3): Promise<string> {
    const job: Job = {
      id: `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      data: { ...data, _handlerName: name },
      attempts: 0,
      maxAttempts,
      status: 'pending',
      createdAt: new Date(),
    };

    this.queue.push(job);
    this.logger.log(`Job added: ${job.id} (queue size: ${this.queue.length})`);

    // Process async without blocking
    this.processNext();

    return job.id;
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;

    const job = this.queue.find((j) => j.status === 'pending');
    if (!job) return;

    this.processing = true;
    job.status = 'processing';
    job.attempts++;

    const handlerName = job.data._handlerName;
    const handler = this.handlers.get(handlerName);

    if (!handler) {
      this.logger.error(`No handler found for job: ${handlerName}`);
      job.status = 'failed';
      job.error = `No handler found: ${handlerName}`;
      this.processing = false;
      this.processNext();
      return;
    }

    try {
      this.logger.log(`Processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      await handler(job.data);
      job.status = 'completed';
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error: any) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      job.error = error.message;

      if (job.attempts < job.maxAttempts) {
        job.status = 'pending';
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000);
        this.logger.log(`Retrying job ${job.id} in ${delay}ms`);
        setTimeout(() => {
          this.processNext();
        }, delay);
      } else {
        job.status = 'failed';
        this.logger.error(`Job ${job.id} failed permanently after ${job.maxAttempts} attempts`);
      }
    } finally {
      this.processing = false;
      // Remove completed/failed jobs older than 1 hour to prevent memory leak
      const oneHourAgo = new Date(Date.now() - 3600000);
      this.queue = this.queue.filter(
        (j) => j.status === 'pending' || j.createdAt > oneHourAgo,
      );
      // Process next pending job
      if (this.queue.some((j) => j.status === 'pending')) {
        this.processNext();
      }
    }
  }

  getQueueStats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter((j) => j.status === 'pending').length,
      processing: this.queue.filter((j) => j.status === 'processing').length,
      completed: this.queue.filter((j) => j.status === 'completed').length,
      failed: this.queue.filter((j) => j.status === 'failed').length,
    };
  }
}
