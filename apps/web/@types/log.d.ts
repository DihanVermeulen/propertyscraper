export interface ILogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
  error?: string;
  result?: any;
  jobId?: string;
}