import 'dotenv/config';
// Validates every required env var at import; exits the process if any is bad.
import { env } from './config/env.js';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

const PORT = Number(env.PORT);

async function main() {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
