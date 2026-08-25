import webSocket from '@ohos.net.webSocket';
import { CodexSnapshot, SnapshotEvent } from '../model/CodexState';

export class LanBridgeClient {
  private socket: webSocket.WebSocket | null = null;
  private connected: boolean = false;

  onConnectionChanged: (connected: boolean) => void = () => {};
  onSnapshot: (snapshot: CodexSnapshot) => void = () => {};
  onError: (message: string) => void = () => {};

  async connect(baseUrl: string, token: string): Promise<void> {
    await this.disconnect();

    const socket = webSocket.createWebSocket();
    this.socket = socket;

    socket.on('open', (err) => {
      if (err) {
        this.onError(`WebSocket open failed: ${JSON.stringify(err)}`);
        return;
      }
      this.connected = true;
      this.onConnectionChanged(true);
    });

    socket.on('message', (err, value) => {
      if (err) {
        this.onError(`WebSocket message failed: ${JSON.stringify(err)}`);
        return;
      }
      if (typeof value !== 'string') {
        return;
      }
      try {
        const message = JSON.parse(value) as SnapshotEvent;
        if (message.type === 'snapshot' && message.data !== undefined) {
          this.onSnapshot(message.data);
        }
      } catch (parseError) {
        this.onError(`Invalid bridge message: ${JSON.stringify(parseError)}`);
      }
    });

    socket.on('close', () => {
      this.connected = false;
      this.onConnectionChanged(false);
    });

    socket.on('error', (err) => {
      this.connected = false;
      this.onConnectionChanged(false);
      this.onError(`WebSocket error: ${JSON.stringify(err)}`);
    });

    const targetUrl = this.withToken(baseUrl, token);
    try {
      await socket.connect(targetUrl);
    } catch (error) {
      this.connected = false;
      this.onConnectionChanged(false);
      this.onError(`Connect failed: ${JSON.stringify(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (socket !== null) {
      try {
        await socket.close();
      } catch (_) {
        // The socket may already be closed.
      }
    }
    if (this.connected) {
      this.connected = false;
      this.onConnectionChanged(false);
    }
  }

  private withToken(baseUrl: string, token: string): string {
    const normalizedToken = token.trim();
    if (normalizedToken.length === 0) {
      return baseUrl;
    }
    const separator = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    return `${baseUrl}${separator}token=${encodeURIComponent(normalizedToken)}`;
  }
}
