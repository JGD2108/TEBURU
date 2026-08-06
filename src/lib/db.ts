import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be configured before starting the application.');
}

const isSupabase = connectionString.includes('supabase.co');

const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', {
        text: text.trim().substring(0, 80),
        duration: Date.now() - start,
        rows: result.rowCount,
      });
    }
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function getPoolClient(): Promise<PoolClient> {
  return pool.connect();
}

export default pool;
