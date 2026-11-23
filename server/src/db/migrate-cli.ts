import { runMigrations } from './migrate.js';
import { closePool } from './pool.js';

// A small command-line wrapper so you can run: npm run db:migrate --workspace server
async function main(): Promise<void> {
  const applied = await runMigrations();
  if (applied.length === 0) {
    console.log('Database is up to date. Nothing to apply.');
  } else {
    console.log(`Applied ${applied.length} migration(s):`);
    applied.forEach((name) => console.log(`  - ${name}`));
  }
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
