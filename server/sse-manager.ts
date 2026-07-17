// SSE (Server-Sent Events) connection manager
// Maintains a pool of active SSE connections keyed by unionId

export type SSEConnection = {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  unionId: string;
  connectedAt: number;
};

const connections = new Map<string, Set<SSEConnection>>();

export function addConnection(unionId: string, conn: SSEConnection) {
  let set = connections.get(unionId);
  if (!set) {
    set = new Set();
    connections.set(unionId, set);
  }
  set.add(conn);
  console.log(`[SSE] ${unionId} connected, total=${set.size}`);
}

export function removeConnection(unionId: string, conn: SSEConnection) {
  const set = connections.get(unionId);
  if (set) {
    set.delete(conn);
    if (set.size === 0) connections.delete(unionId);
  }
  console.log(`[SSE] ${unionId} disconnected`);
}

export function getConnections(unionId: string): Set<SSEConnection> | undefined {
  return connections.get(unionId);
}

// Push a notification to all active connections for a user
export async function pushNotification(unionId: string, data: any) {
  const conns = connections.get(unionId);
  if (!conns || conns.size === 0) return;
  const encoder = new TextEncoder();
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const bytes = encoder.encode(payload);
  const deadConns: SSEConnection[] = [];
  for (const conn of conns) {
    try {
      await conn.writer.write(bytes);
    } catch {
      deadConns.push(conn);
    }
  }
  // Clean up dead connections
  for (const dead of deadConns) {
    conns.delete(dead);
    try { dead.writer.close(); } catch { /* ignore */ }
  }
  if (conns.size === 0) connections.delete(unionId);
}

// Push to multiple users (e.g., all admins)
export async function pushToUsers(unionIds: string[], data: any) {
  await Promise.all(unionIds.map(id => pushNotification(id, data)));
}
