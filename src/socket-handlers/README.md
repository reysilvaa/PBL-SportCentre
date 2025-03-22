# Socket Handlers

Direktori ini berisi semua handler untuk WebSocket yang digunakan dalam aplikasi. Socket handlers digunakan untuk menangani komunikasi real-time antara server dan klien.

## Struktur

- `index.ts` - File utama yang menginisialisasi semua socket handlers
- `branch.socket.ts` - Handler untuk operasi terkait cabang
- `field.socket.ts` - Handler untuk operasi terkait lapangan
- `payment.socket.ts` - Handler untuk operasi terkait pembayaran
- `activityLog.socket.ts` - Handler untuk operasi terkait log aktivitas

## Penggunaan

Semua socket handlers diinisialisasi saat server dimulai melalui fungsi `initializeAllSocketHandlers()` yang dipanggil dari `app.ts`.

```typescript
// app.ts
import { initializeAllSocketHandlers } from './socket-handlers';

// Initialize all Socket.IO handlers
initializeAllSocketHandlers();
```

## Menambahkan Socket Handler Baru

Untuk menambahkan socket handler baru:

1. Buat file baru di direktori `socket-handlers` dengan format `[nama].socket.ts`
2. Implementasikan fungsi-fungsi handler yang diperlukan
3. Buat fungsi `setup[Nama]SocketHandlers` untuk menginisialisasi namespace dan event handlers
4. Tambahkan fungsi setup ke `initializeAllSocketHandlers` di `index.ts`

## Contoh

```typescript
// contoh.socket.ts
import { Socket } from 'socket.io';
import {
  getIO,
  applyAuthMiddleware,
  setupNamespaceEvents,
} from '../config/socket';

export const handleExampleEvent = async (socket: Socket, data: any) => {
  // Implementasi handler
};

export const setupExampleSocketHandlers = (): void => {
  const io = getIO();
  const namespace = io.of('/example');

  // Setup namespace
  applyAuthMiddleware(namespace, false);
  setupNamespaceEvents(namespace);

  namespace.on('connection', (socket) => {
    socket.on('example:event', (data) => handleExampleEvent(socket, data));
  });

  console.log('✅ Example socket handlers initialized');
};
```

```typescript
// index.ts
import { setupExampleSocketHandlers } from './contoh.socket';

export const initializeAllSocketHandlers = (): void => {
  // ...
  setupExampleSocketHandlers();
  // ...
};
```
