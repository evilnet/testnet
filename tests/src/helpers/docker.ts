import Docker from 'dockerode';
import { createTestClient, TestIRCClient } from './irc-client.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Stop a container gracefully (sends SIGTERM, then SIGKILL after timeout).
 */
export async function stopContainer(name: string, timeout = 10): Promise<void> {
  const container = docker.getContainer(name);
  await container.stop({ t: timeout });
}

/**
 * Start a stopped container.
 */
export async function startContainer(name: string): Promise<void> {
  const container = docker.getContainer(name);
  await container.start();
}

/**
 * Wait for X3 to be ready by polling AuthServ until it responds.
 * X3 is ready when it has reconnected to Nefarious and can respond to commands.
 */
export async function waitForX3Ready(maxWait = 60000): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 3000; // Longer interval to avoid IRC connection throttling

  while (Date.now() - startTime < maxWait) {
    let client: TestIRCClient | null = null;
    try {
      client = await createTestClient({ nick: `prb${Date.now() % 10000}` });

      // Clear buffer and send HELP to AuthServ
      client.clearRawBuffer();
      client.say('AuthServ', 'HELP');

      // Wait for response from AuthServ (short timeout)
      await client.waitForRaw(/AuthServ.*NOTICE/i, 3000);

      // Success - X3 is responding
      client.quit('probe done');
      return;
    } catch {
      // X3 not ready yet, cleanup and retry
      if (client) {
        try {
          client.quit('probe failed');
        } catch {
          // Ignore cleanup errors
        }
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error(`X3 did not become ready within ${maxWait}ms`);
}
