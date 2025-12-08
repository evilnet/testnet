import { describe, it, expect, afterEach } from 'vitest';
import { TestIRCClient, createTestClient } from './helpers/index.js';

describe('IRC Connection', () => {
  const clients: TestIRCClient[] = [];

  // Helper to track clients for cleanup
  const trackClient = (client: TestIRCClient): TestIRCClient => {
    clients.push(client);
    return client;
  };

  afterEach(() => {
    // Clean up all clients after each test
    for (const client of clients) {
      client.quit('Test cleanup');
    }
    clients.length = 0;
  });

  it('can connect to the IRC server', async () => {
    const client = trackClient(await createTestClient({ nick: 'testuser1' }));

    // If we get here, connection succeeded
    expect(client).toBeDefined();
  });

  it('receives welcome message on connect', async () => {
    const client = trackClient(await createTestClient({ nick: 'testuser2' }));

    // Check for 001 (RPL_WELCOME) in raw buffer
    const hasWelcome = client.rawMessages.some((msg) =>
      msg.includes('001')
    );
    expect(hasWelcome).toBe(true);
  });

  it('can join a channel', async () => {
    const client = trackClient(await createTestClient({ nick: 'testuser3' }));

    client.join('#test');

    // Wait for JOIN confirmation
    const joinMsg = await client.waitForRaw(/JOIN.*#test/i);
    expect(joinMsg).toContain('#test');
  });

  it('can send and receive messages in a channel', async () => {
    // Create two clients
    const client1 = trackClient(await createTestClient({ nick: 'sender1' }));
    const client2 = trackClient(await createTestClient({ nick: 'receiver1' }));

    // Both join the same channel
    client1.join('#msgtest');
    client2.join('#msgtest');

    // Wait for both to join
    await client1.waitForRaw(/JOIN.*#msgtest/i);
    await client2.waitForRaw(/JOIN.*#msgtest/i);

    // Small delay to ensure channel state is synced
    await new Promise((r) => setTimeout(r, 500));

    // Client 1 sends a message
    const testMessage = `Hello from test ${Date.now()}`;
    client1.say('#msgtest', testMessage);

    // Client 2 should receive it
    const received = await client2.waitForRaw(new RegExp(testMessage));
    expect(received).toContain(testMessage);
  });

  it('can change nickname', async () => {
    const client = trackClient(await createTestClient({ nick: 'oldnick1' }));

    client.nick('newnick1');

    // Wait for NICK confirmation
    const nickMsg = await client.waitForRaw(/NICK.*newnick1/i);
    expect(nickMsg).toContain('newnick1');
  });
});
