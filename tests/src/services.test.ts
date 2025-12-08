import { describe, it, expect, afterEach } from 'vitest';
import { TestIRCClient, createTestClient } from './helpers/index.js';

describe('X3 Services', () => {
  const clients: TestIRCClient[] = [];

  const trackClient = (client: TestIRCClient): TestIRCClient => {
    clients.push(client);
    return client;
  };

  afterEach(() => {
    for (const client of clients) {
      client.quit('Test cleanup');
    }
    clients.length = 0;
  });

  it('can communicate with AuthServ', async () => {
    const client = trackClient(await createTestClient({ nick: 'authtest1' }));

    // Send a message to AuthServ
    client.say('AuthServ', 'HELP');

    // Wait for a response from AuthServ
    const response = await client.waitForRaw(/AuthServ.*NOTICE/i, 10000);
    expect(response).toBeDefined();
  });

  it('can communicate with ChanServ', async () => {
    const client = trackClient(await createTestClient({ nick: 'chantest1' }));

    // Send a message to ChanServ
    client.say('ChanServ', 'HELP');

    // Wait for a response from ChanServ
    const response = await client.waitForRaw(/ChanServ.*NOTICE/i, 10000);
    expect(response).toBeDefined();
  });

  it('can register a channel with ChanServ', async () => {
    const client = trackClient(await createTestClient({ nick: 'chanreg1' }));

    // First join the channel to become op
    const channelName = `#testchan${Date.now()}`;
    client.join(channelName);
    await client.waitForRaw(new RegExp(`JOIN.*${channelName}`, 'i'));

    // Try to register (this may fail without auth, but we test the interaction)
    client.say('ChanServ', `REGISTER ${channelName}`);

    // Wait for some response from ChanServ
    const response = await client.waitForRaw(/ChanServ/i, 10000);
    expect(response).toBeDefined();
  });
});

describe('X3 OpServ', () => {
  const clients: TestIRCClient[] = [];

  const trackClient = (client: TestIRCClient): TestIRCClient => {
    clients.push(client);
    return client;
  };

  afterEach(() => {
    for (const client of clients) {
      client.quit('Test cleanup');
    }
    clients.length = 0;
  });

  it('can query OpServ (may require oper)', async () => {
    const client = trackClient(await createTestClient({ nick: 'optest1' }));

    // Try to communicate with OpServ
    client.say('OpServ', 'HELP');

    // OpServ typically requires oper status, but should still respond
    // Wait for any response (could be help or access denied)
    const response = await client.waitForRaw(/OpServ|NOTICE/i, 10000);
    expect(response).toBeDefined();
  });
});
