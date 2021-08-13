import http from 'http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import ioClient from 'socket.io-client';
import type { Socket } from 'socket.io-client';

describe('basic pattern', () => {
  let ioServer: Server;
  let url: string;
  let host: string;
  let port: number;
  let socket: Socket;
  let connectedCount = 0;

  beforeEach(async () => {
    [ioServer, url, host, port] = await startServer();
    socket = ioClient(url, { transports: ['websocket'] });
    const doneOfReconnection = new Promise<void>((resolve) => {
      socket.on('connect', () => {
        connectedCount++;

        if (connectedCount > 1) {
          resolve();
        }
      });
    });

    await waitUntilConnected(socket);

    await new Promise((resolve) => ioServer.close(resolve));
    ioServer = await restartServer(port, host);

    await doneOfReconnection;
  });
  afterEach(() => {
    ioServer?.close();
    socket?.close();
  });

  it('connected normally', () => {
    expect(socket.connected).toBe(true);
  });
});

async function startServer(middleware?: Middleware) {
  const httpServer = http.createServer();
  const io = new Server(httpServer);
  if (middleware) {
    io.use(middleware);
  }

  const [url, host, port] = await new Promise((resolve) => {
    httpServer.listen(() => {
      const addr = httpServer.address() as AddressInfo;
      const port = addr.port;
      switch (addr.family) {
        case 'IPv6':
          return resolve([`http://[::]:${port}`, addr.address, port]);
        case 'IPv4':
          return resolve([`http://127.0.0.1:${port}`, addr.address, port]);
        default:
          throw new Error(`unknown family: ${addr.family}`);
      }
    });
  });
  return [io, url, host, port];
}
type Middleware = (...args: any) => void;

async function restartServer(port: number, host: string, middleware?: Middleware) {
  const httpServer = http.createServer();
  const io = new Server(httpServer);
  if (middleware) {
    io.use(middleware);
  }

  return new Promise<Server>((resolve) => {
    httpServer.listen(port, host, () => {
      resolve(io);
    });
  });
}

async function waitUntilConnected(socket: Socket) {
  return new Promise<void>((resolve) => {
    socket.once('connect', () => {
      resolve();
    });
  });
}
