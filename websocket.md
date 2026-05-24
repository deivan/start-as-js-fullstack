# Використання технології WebSocket у бекенд аплікаціях на Node.js та Nest.js

## 1. Особливості реалізації інтерактивного обміну даних з боку протоколу HTTP

Протокол HTTP від початку створювався як `stateless` (без збереження стану) та працює за принципом «**запит-відповідь**» (Request-Response). Ініціатором завжди є клієнт. Сервер не може самостійно відправити дані клієнту, поки той не запитає.

Для реалізації інтерактивності (чати, біржові графіки, сповіщення) історично використовували такі "милиці" 🩼:

- **Short Polling (Коротке опитування)**: Клієнт відправляє запити кожні N секунд (наприклад, `setInterval`).
    Мінус: Величезне навантаження на сервер, марний трафік (більшість відповідей — "нових даних немає").
- **Long Polling (Довге опитування)**: Клієнт відправляє запит, але сервер не відповідає одразу, а "тримає" з'єднання відкритим до появи нових даних. Віддавши дані, з'єднання закривається, і клієнт одразу відкриває нове.
    Мінус: Затримки при перепідключенні, складнощі з балансуванням навантаження.
- **Server-Sent Events (SSE)**: Односпрямований потік даних від сервера до клієнта через HTTP.
    Мінус: Не підходить для двостороннього активного обміну (наприклад, ігор чи двосторонніх чатів).

**Рішення — WebSocket (WS):**

WebSocket — це протокол, що забезпечує повноцінний двоспрямований (full-duplex) зв'язок поверх єдиного TCP-з'єднання.

Він починається як звичайний HTTP-запит з заголовком `Upgrade: websocket`. Якщо сервер підтримує WS, він відповідає статусом `101 Switching Protocols`, після чого HTTP-з'єднання перетворюється на чистий TCP-канал для обміну фреймами.

## 2. Створення WS серверу на "базових" модулях Node.js

Реалізовувати специфікацію WebSocket (парсинг фреймів, маскування даних) з нуля на чистому модулі net чи http недоцільно у реальних проєктах. Тому стандартом де-факто для "базової" реалізації є бібліотека ws, яка працює максимально близько до нативних модулів Node.js.

У цьому прикладі ми створюємо базовий HTTP-сервер Node.js і "навішуємо" на нього WebSocket-сервер.

```javascript
// npm install ws
const http = require('http');
const WebSocket = require('ws');

// 1. Створюємо стандартний HTTP сервер
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('HTTP server is running\n');
});

// 2. Створюємо WebSocket сервер, прив'язаний до HTTP сервера
const wss = new WebSocket.Server({ server });

// 3. Обробка подій підключення
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Клієнт підключився: ${clientIp}`);

  // Відправка повідомлення новому клієнту
  ws.send(JSON.stringify({ message: 'Вітаємо на WS сервері!' }));

  // Обробка вхідних повідомлень
  ws.on('message', (message) => {
    console.log(`Отримано: ${message}`);
    
    // Ехо-відповідь
    ws.send(`Сервер отримав: ${message}`);
  });

  ws.on('close', () => {
    console.log('Клієнт відключився');
  });
});

server.listen(3400, () => {
  console.log('Сервер працює на http://localhost:3400 та ws://localhost:3400');
});
```

Цей приклад є примитивним, тому що не зберігає контекст кожного клієнта, що підключився. Бібліотека ws є низькорівневою, тому вона не надає вбудованих механізмів для ідентифікації конкретних клієнтів. Кожне нове підключення — це просто об'єкт з'єднання. Щоб реалізувати відправку повідомлення від Клієнта А до Клієнта Б, сервер повинен взяти на себе відповідальність за маршрутизацію: згенерувати унікальний ідентифікатор для кожного сокета, зберегти його у глобальному словнику, а при отриманні повідомлення — знайти сокет отримувача за цим ідентифікатором.

```javascript
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto'); // Вбудований модуль для генерації V4 UUID

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Глобальне сховище для активних з'єднань.
// Використовуємо Map, де ключ - це ID клієнта, а значення - об'єкт з'єднання WebSocket.
const clients = new Map();

wss.on('connection', (ws) => {
  // 1. Генеруємо стандартний випадковий V4 UUID при підключенні
  const clientId = crypto.randomUUID();
  
  // 2. Зберігаємо з'єднання у пам'яті
  clients.set(clientId, ws);
  console.log(`[+] Клієнт підключився: ${clientId}. Всього онлайн: ${clients.size}`);

  // Відправляємо клієнту його власний ідентифікатор
  ws.send(JSON.stringify({ type: 'system', action: 'welcome', yourId: clientId }));

  // 3. Обробка вхідних повідомлень
  ws.on('message', (rawMessage) => {
    try {
      const parsed = JSON.parse(rawMessage);

      // Очікуваний формат для приватного повідомлення:
      // { "type": "private", "targetId": "uuid-отримувача", "text": "Привіт!" }
      if (parsed.type === 'private' && parsed.targetId) {
        
        // Дістаємо з'єднання отримувача з нашого сховища у пам'яті
        const targetClient = clients.get(parsed.targetId);

        // Перевіряємо, чи існує клієнт і чи відкрите його з'єднання
        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
          
          targetClient.send(JSON.stringify({
            type: 'privateMessage',
            fromId: clientId,
            text: parsed.text
          }));
          
          console.log(`[->] Повідомлення від ${clientId} доставлено до ${parsed.targetId}`);
        } else {
          // Якщо отримувача немає у Map або він відключився
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Одержувач з ID ${parsed.targetId} не знайдений або офлайн.` 
          }));
        }
      }
    } catch (error) {
      console.error('Помилка парсингу повідомлення:', error.message);
    }
  });

  // 4. Очищення пам'яті при відключенні
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`[-] Клієнт відключився: ${clientId}. Всього онлайн: ${clients.size}`);
  });
});

server.listen(3400, () => {
  console.log('WS сервер з адресною маршрутизацією працює на порту 3400');
});
```

У цьому прикладі ми створили просту систему приватних повідомлень між клієнтами, використовуючи WebSocket. Кожен клієнт отримує унікальний ідентифікатор при підключенні, який він може використовувати для відправки повідомлень іншим клієнтам. Сервер відповідає за маршрутизацію повідомлень та підтримку актуального списку підключених клієнтів.

## 3. Створення WS серверу на основі бібліотеки Socket.io

`ws` — це чистий протокол. Але в реальному житті розробникам потрібні кімнати, бродкасти (розсилка всім), автоматичне перепідключення та фолбеки. Для цього існує надбудова — **Socket.io**.
Важливо розуміти: Socket.io — це не чистий WebSocket. Він використовує WS під капотом, але має власний протокол. Клієнт на Socket.io не зможе підключитися до чистого `ws` сервера, і навпаки.

```javascript
// npm install socket.io
const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer();
// Ініціалізація Socket.io з налаштуванням CORS
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log(`Socket підключено: ${socket.id}`);

  socket.on('customEvent', (data) => {
    console.log('Дані від клієнта:', data);
    
    // Відправити повідомлення всім підключеним клієнтам (Broadcasting)
    io.emit('broadcastEvent', { info: 'Нова подія для всіх!' });
    
    // Відправити повідомлення всім, ОКРІМ відправника
    socket.broadcast.emit('userAction', { user: socket.id, action: 'зробив дію' });
  });
});

server.listen(3400, () => console.log('Socket.io сервер працює на порту 3400'));
```

Чистий протокол WebSocket (`ws`) забезпечує лише базовий транспортний шар. Використання Socket.io у бекенд-розробці обґрунтовано наявністю готових високорівневих механізмів для вирішення типових завдань інтерактивності.

### 3.1. Мультиплексування: Простори імен (Namespaces) та Кімнати (Rooms)

У чистому WebSocket для розділення логіки (наприклад, окремо чати, окремо системні сповіщення) довелося б або відкривати кілька TCP-з'єднань, або вручну парсити складні JSON-структури всередині одного сеансу.
Socket.io дозволяє розділити застосунок на Namespaces (окремі канали в межах одного сокет-з'єднання) та Rooms (динамічні підканали всередині простору імен).

```javascript
const { Server } = require('socket.io');
const io = new Server(3400);

// Ізольований простір імен для модулю підтримки
const supportNamespace = io.of('/support');

supportNamespace.on('connection', (socket) => {
  // Користувач приєднується до конкретної кімнати (кімнати тикета)
  socket.on('join_ticket', (ticketId) => {
    socket.join(`ticket:${ticketId}`);
  });

  // Надсилання повідомлення виключно всередину кімнати тикета
  socket.on('send_message', (data) => {
    supportNamespace.to(`ticket:${data.ticketId}`).emit('new_message', {
      senderId: socket.id,
      text: data.text
    });
  });
});
```

### 3.2. Гарантія доставки повідомлень та відповіді (Acknowledgements)

Замість класичної схеми "відправив і забув", Socket.io реалізує механізм підтвердження отримання (RPC-подібний виклик). Бекенд може передати колбек-функцію як останній аргумент, яку клієнт виконає після успішної обробки події.

```javascript
io.on('connection', (socket) => {
  socket.on('create_post', (postData, callback) => {
    try {
      // Імітація збереження в базу даних
      const newPost = { id: Date.now(), ...postData };
      
      // Виклик колбеку на стороні клієнта для підтвердження успіху
      callback({
        status: 'ok',
        data: newPost
      });
    } catch (error) {
      callback({
        status: 'error',
        message: 'Не вдалося зберегти пост'
      });
    }
  });
});
``` 

### 3.3. Автоматичне відновлення з'єднання та HTTP Long-Polling Fallback

Якщо у клієнта нестабільна мережа або корпоративний фаєрвол блокує протокол WS, Socket.io автоматично переключається на HTTP Long-Polling для збереження працездатності інтерактиву. Крім того, бібліотека підтримує вбудований механізм черги повідомлень на час короткочасного дисконнекту.

```javascript
const secureIo = new Server(3002, {
  // Налаштування таймаутів для детекції "мертвих" з'єднань
  pingTimeout: 60000,
  pingInterval: 25000,
  // Дозволяємо спочатку HTTP-опитування, яке потім плавно апгрейдиться до WebSocket
  transports: ['polling', 'websocket'] 
});

secureIo.on('connection', (socket) => {
  // Детекція реального розриву та автоматичне очищення ресурсів
  socket.on('disconnect', (reason) => {
    console.log(`Клієнт ${socket.id} відключився. Причина: ${reason}`);
    // Якщо reason === "ping timeout", сервер розуміє, що зник зв'язок
  });
});
```

## 4. Створення WS серверу на базі фреймворку Nest.js

Nest.js має вбудовану підтримку WebSocket через модуль `@nestjs/websockets`, який надає абстрактний шар над різними бібліотеками (ws, Socket.io, uWebSockets). Це дозволяє легко інтегрувати WS у структуру Nest.js з використанням декораторів та інжекції залежностей.

При цьому, є рекомендуєма структура для організації WS-логіки в окремих шлюзах (Gateways), які відповідають за обробку подій та взаємодію з іншими частинами застосунку.

```plain
src/
├── common/
│   └── adapters/
│       └── redis-io.adapter.ts    # Адаптер для масштабування (Redis)
├── websocket/
│   ├── interfaces/
│   │   └── ws-payload.interface.ts # Типізація даних
│   ├── websocket.service.ts       # Бізнес-логіка
│   ├── websocket.gateway.ts       # Транспортний шар (контролер подій)
│   └── websocket.module.ts        # Ізольований модуль
├── app.module.ts                  # Кореневий модуль
└── main.ts                        # Точка входу
```

### 4.1. Типізація даних (`src/websocket/interfaces/ws-payload.interface.ts`)

Використання інтерфейсів гарантує надійність контракту між клієнтом та сервером.

```typescript
export interface JoinRoomPayload {
  room: string;
}

export interface SendMessagePayload {
  room: string;
  message: string;
}

export interface BroadcastMessage {
  senderId: string;
  message: string;
  timestamp: string;
}
```

### 4.2. Сервіс з бізнес-логікою (`src/websocket/websocket.service.ts`)

Тут міститься уся логіка обробки даних. Сервіс не повинен нічого знати про сокети (`socket.io`), він лише працює з даними. Це робить його придатним для тестування.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BroadcastMessage } from './interfaces/ws-payload.interface';

@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);

  // Імітація збереження повідомлення в БД або перевірки на спам
  processNewMessage(clientId: string, message: string): BroadcastMessage {
    this.logger.log(`Обробка повідомлення від ${clientId}`);
    
    // Тут могла б бути логіка валідації або збереження в PostgreSQL
    
    return {
      senderId: clientId,
      message: message,
      timestamp: new Date().toISOString(),
    };
  }

  generateSystemNotice(action: string, clientId: string): string {
    return `Користувач ${clientId} ${action}.`;
  }
}
```

### 4.3. Шлюз / Gateway (`src/websocket/websocket.gateway.ts`)

Шлюз відповідає тільки за підключення/відключення клієнтів та маршрутизацію подій. Усі дані він передає у впроваджений (injected) `WebsocketService`.

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebsocketService } from './websocket.service';
import { JoinRoomPayload, SendMessagePayload } from './interfaces/ws-payload.interface';

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: '*' },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Ін'єкція залежності сервісу
  constructor(private readonly wsService: WebsocketService) {}

  handleConnection(client: Socket) {
    console.log(`[WS] Підключення встановлено: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] З'єднання розірвано: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    client.join(payload.room);
    
    // Використовуємо сервіс для формування системного повідомлення
    const notice = this.wsService.generateSystemNotice('приєднався до кімнати', client.id);
    
    client.to(payload.room).emit('roomMessage', {
      senderId: 'System',
      message: notice,
      timestamp: new Date().toISOString(),
    });

    return { status: 'success', joinedRoom: payload.room };
  }

  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    // Делегуємо бізнес-логіку обробки повідомлення у сервіс
    const processedMessage = this.wsService.processNewMessage(client.id, payload.message);
    
    // Розсилаємо результат усім учасникам кімнати
    this.server.to(payload.room).emit('roomMessage', processedMessage);
  }
}
```

### 4.4. Ізольований Модуль (`src/websocket/websocket.module.ts`)

Модуль об'єднує шлюз та сервіс. Тепер ми можемо легко імпортувати його в будь-яку частину нашої Nest.js аплікації.

```typescript
import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';

@Module({
  providers: [WebsocketGateway, WebsocketService],
  // Експортуємо сервіс, якщо іншим модулям знадобиться відправляти повідомлення
  exports: [WebsocketService], 
})
export class WebsocketModule {}
```

### 4.5. Інтеграція в кореневий модуль (`src/app.module.ts`)

Корневий модуль застосунку просто імпортує наш готовий `WebsocketModule`.

```typescript
import { Module } from '@nestjs/common';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

### 4.6. Налаштування Адаптера та Точка входу (`src/common/adapters/redis-io.adapter.ts та src/main.ts`)

**Адаптер:**
Оскільки адаптер працює на рівні ініціалізації сервера (до повного запуску DI контейнера), він створюється окремо.

```typescript
// src/common/adapters/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

**Головний файл main.ts**: Тут ми підключаємо наш адаптер до екземпляра застосунку.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors(); // Налаштування політики CORS

  // Ініціалізація та підключення Redis Адаптера
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(3000);
  console.log(`Nest.js сервер з підтримкою WebSockets запущено.`);
}
bootstrap();
```

