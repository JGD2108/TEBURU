type LogFields = Record<string, unknown>;

function write(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, error?: unknown, fields?: LogFields) => write('error', event, {
    ...fields,
    error: error instanceof Error ? error.message : String(error ?? 'unknown'),
  }),
};
