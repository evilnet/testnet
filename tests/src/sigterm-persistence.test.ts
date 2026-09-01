import { describe, it, expect, afterEach } from 'vitest';
import {
  TestIRCClient,
  createTestClient,
  stopContainer,
  startContainer,
  waitForX3Ready,
} from './helpers/index.js';

describe('X3 SIGTERM Database Persistence', () => {
  const clients: TestIRCClient[] = [];

  const trackClient = (client: TestIRCClient): TestIRCClient => {
    clients.push(client);
    return client;
  };

  afterEach(() => {
    for (const client of clients) {
      try {
        client.quit('Test cleanup');
      } catch {
        // Ignore cleanup errors
      }
    }
    clients.length = 0;
  });

  it('persists AuthServ accounts after SIGTERM', async () => {
    // Generate unique account name for this test run (max 15 chars per X3 config)
    const uniqueId = Date.now() % 100000;
    const accountName = `sigt_${uniqueId}`;
    const password = `testpass${uniqueId}`;

    // 1. Register a unique account via AuthServ
    const regClient = trackClient(await createTestClient({ nick: accountName }));

    // Need to be an IRC operator to register the first account
    regClient.raw('OPER oper shmoo');
    await regClient.waitForRaw(/MODE.*\+o/i, 5000);

    regClient.say('AuthServ', `REGISTER ${accountName} ${password}`);

    // Wait for registration confirmation
    // X3 responds with NOTICE containing "registered" on success
    const regResponse = await regClient.waitForRaw(/AuthServ.*NOTICE.*registered/i, 10000);
    expect(regResponse).toContain('registered');

    // Disconnect the registration client before stopping X3
    regClient.quit('Registration complete');
    clients.length = 0;

    // Give X3 a moment to process the quit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Stop X3 container gracefully (sends SIGTERM)
    // This should trigger X3's atexit handler to save the database
    await stopContainer('x3', 10);

    // 3. Start X3 container again
    await startContainer('x3');

    // 4. Wait for X3 to reconnect to Nefarious and become ready
    await waitForX3Ready(30000);

    // 5. Verify the account still exists by authenticating with it
    const authClient = trackClient(await createTestClient({ nick: `chk_${uniqueId}` }));

    authClient.say('AuthServ', `AUTH ${accountName} ${password}`);

    // Wait for successful auth response
    // X3 responds with NOTICE containing "I recognize you" on success
    const authResponse = await authClient.waitForRaw(/AuthServ.*NOTICE.*(recognize|authenticated)/i, 10000);
    expect(authResponse).toBeDefined();
    expect(authResponse).toMatch(/recognize|authenticated/i);
  }, 120000); // 2 minute timeout for this test
});
