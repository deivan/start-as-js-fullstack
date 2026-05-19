# Робота з Redis в екосистемі Nest.js

Redis (Remote Dictionary Server) — це не просто кеш. Це високопродуктивна база даних in-memory, яка підтримує різноманітні структури даних, механізми публікації/підписки та транзакції. Завдяки однопотоковій архітектурі обробки команд (event loop), Redis гарантує атомарність операцій, що робить його ідеальним інструментом для вирішення проблем паралелізму у розподілених системах.

У цій лекції ми розглянемо сучасні підходи до інтеграції Redis у Nest.js, використовуючи асинхронну конфігурацію, Dependency Injection (впровадження залежностей) та патерни проектування, які відповідають стандартам enterprise-розробки. 


## 1. Сучасна інтеграція Redis у Nest.js

У сучасній розробці параметри середовища керуються через модуль конфігурацій (наприклад, @nestjs/config). Це дозволяє безпечно розгортати аплікацію у різних середовищах (development, staging, production).

### 1.1. Встановлення залежностей

Для початку встановимо драйвер ioredis (найбільш потужний клієнт для Node.js) та офіційний модуль конфігурацій Nest:

```bash
npm install ioredis @nestjs/config
npm install @types/ioredis -D
```

### 1.2. Створення асинхронного Redis-модуля

Створимо динамічний глобальний модуль, який буде ініціалізувати з'єднання з базою даних, зчитуючи параметри з середовища (з .env файлу).

Замість того, щоб сервіс успадковував клас Redis безпосередньо, ми створимо провайдер за допомогою фабрики (useFactory), який повертатиме екземпляр клієнта. Це гарантує, що підключення відбудеться лише тоді, коли конфігурація буде готова.

```typescript
// src/redis/redis.module.ts
import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from './redis.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    const redisProvider: Provider = {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', ''),
          // Додаткові налаштування для стабільності
          retryStrategy(times) {
            return Math.min(times * 50, 2000);
          },
        });
      },
      inject: [ConfigService],
    };

    return {
      module: RedisModule,
      providers: [redisProvider, RedisService],
      exports: [RedisService, REDIS_CLIENT],
    };
  }
}
```

Тепер створимо сам RedisService, який буде інкапсулювати логіку роботи з REDIS_CLIENT. Це дозволяє легко мокати Redis під час написання unit-тестів.

```typescript
// src/redis/redis.service.ts
import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  // Геттер для доступу до нативного клієнта ioredis
  get client(): Redis {
    return this.redisClient;
  }

  // Хук життєвого циклу для коректного закриття з'єднання
  onModuleDestroy() {
    this.redisClient.disconnect();
  }
}
```

### 1.3. Інтеграція до App Module

Тепер ми маємо правильно підключити наш динамічний модуль до кореневого модуля аплікації (app.module.ts), переконавшись, що ConfigModule завантажується першим.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
// ... інші імпорти (наприклад, RateLimiterModule, SessionModule тощо)

@Module({
  imports: [
    // Ініціалізація глобальних конфігурацій з .env
    ConfigModule.forRoot({
      isGlobal: true, 
      envFilePath: '.env',
    }),
    // Підключення нашого Redis модуля асинхронно
    RedisModule.forRootAsync(),
  ],
})
export class AppModule {}
```

### 1.4. Зміни у файлі main.ts (Graceful Shutdown)

Щоб хук onModuleDestroy() у нашому RedisService спрацював коректно при зупинці контейнера (наприклад, у Docker чи Kubernetes), необхідно ввімкнути перехоплення сигналів завершення роботи.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ВАЖЛИВО: Дозволяє Nest слухати системні сигнали (SIGINT, SIGTERM)
  // та коректно закривати з'єднання з базою (спрацює onModuleDestroy)
  app.enableShutdownHooks();

  await app.listen(3000);
}
bootstrap();
```


## 2. Типи даних та TTL у Redis

Redis оперує базовими структурами даних на низькому рівні пам'яті. Розуміння цих типів визначає ефективність обраного архітектурного рішення:
- **Strings (Рядки)**: Базовий тип (до 512 МБ). Підходить для кешування JSON-об'єктів, лічильників, токенів.
- **Lists (Списки)**: Двозв'язні списки. Додавання в початок або кінець має складність O(1). Ідеально для черг.
- **Sets (Множини)**: Невпорядковані колекції унікальних рядків. Перевірка наявності елемента — O(1).
- **Hashes (Хеші)**: Схожі на плоскі об'єкти (key-value всередині ключа). Оптимально для зберігання сутностей (наприклад, профілю сесії).
- **Sorted Sets (Сортовані множини, ZSet)**: Кожен елемент має "score" (вагу), за якою автоматично сортується. Додавання/оновлення — O(log(N)).

**TTL (Time To Live)** — механізм автоматичної експірації. Redis є однопотоковим, тому він використовує комбінований підхід (пасивне видалення при зверненні до ключа + активне фонове сканування) для видалення ключів, час життя яких минув, не блокуючи основний потік виконання.

Оскільки Redis є key-value сховищем і не має традиційної мови запитів (як SQL), правильна структура ключів визначає те, наскільки ефективно ви зможете шукати та фільтрувати дані.

### 2.1. Простори імен (Namespaces) та іменування ключів

Загальноприйнятим стандартом в екосистемі Redis є використання двокрапки (:) для розділення сутностей, ідентифікаторів та атрибутів. Це створює логічну ієрархію (своєрідні "папки"), яку легко читати та сканувати.

Шаблон: `object-type:id:attribute`

**Приклади:**

- `users:39001` — Hash або String, що зберігає основні дані про користувача з ID 39001.
- `users:39001:sessions` — Set (множина) ідентифікаторів сесій цього користувача.
- `users:39001:preferences` — Hash з налаштуваннями конкретного користувача.

Щоб отримати дані конкретного користувача, ви звертаєтесь безпосередньо до його ключа:

```typescript
// Отримання конкретного користувача з ID 39001
const userData = await this.redis.client.hgetall('users:39001');
```

## 2.2. Антипатерн KEYS та правильний пошук через SCAN

Часто виникає потреба знайти "всіх користувачів" або всі ключі за певним префіксом (наприклад, `users:*`).

Критичне правило: Ніколи не використовуйте команду `KEYS *` у production-середовищі. Вона блокує основний потік Redis до завершення пошуку, що може призвести до падіння всієї системи при мільйонах записів.

Замість цього слід використовувати команду `SCAN`. Вона працює як курсор: повертає дані порціями, не блокуючи базу даних.

```typescript
// src/users/users-search.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UsersSearchService {
  constructor(private readonly redis: RedisService) {}

  // Безпечний пошук усіх ключів, що відповідають патерну 'users:*'
  async scanAllUsers(): Promise<string[]> {
    let cursor = '0';
    const matchedKeys: string[] = [];

    do {
      // MATCH - патерн пошуку, COUNT - скільки елементів сканувати за одну ітерацію (не гарантує точну кількість у відповіді)
      const result = await this.redis.client.scan(cursor, 'MATCH', 'users:*', 'COUNT', 100);
      cursor = result[0]; // Оновлюємо курсор для наступної ітерації
      const keys = result[1]; // Знайдені ключі у поточній порції
      
      matchedKeys.push(...keys);
    } while (cursor !== '0'); // Курсор '0' означає кінець ітерації

    return matchedKeys;
  }
}
```

### 2.3. Вторинні індекси (Secondary Indexing): Фільтрація без сканування

Навіть `SCAN` не підходить для складної фільтрації (наприклад, "знайти всіх користувачів зі статусом active"). Для імітації SQL-запитів WHERE у Redis застосовується патерн Secondary Indexing за допомогою типів Sets (множини).

Замість того, щоб шукати користувачів, перебираючи ключі, ми при створенні/оновленні користувача одразу додаємо його ID до відповідної множини-індексу.

**Ситуація 1: Фільтрація за кількома атрибутами (Перетин множин)**
Уявімо, що нам потрібно обрати користувачів, які є одночасно active і мають роль admin.

1. Створення індексів:

```typescript
// Користувач 39001 є активним і адміном
await this.redis.client.sadd('users_by_status:active', '39001');
await this.redis.client.sadd('users_by_role:admin', '39001');

// Користувач 39002 є активним, але звичайним юзером
await this.redis.client.sadd('users_by_status:active', '39002');
await this.redis.client.sadd('users_by_role:user', '39002');
```

2. Отримання відфільтрованого результату (`SINTER`):

Команда `SINTER` (Set Intersection) миттєво повертає елементи, які існують у ВСІХ переданих множинах.

```typescript
// Поверне ['39001'], оскільки лише він є в обох множинах
const activeAdmins = await this.redis.client.sinter(
  'users_by_status:active', 
  'users_by_role:admin'
);
```

**Ситуація 2: Захист інфраструктури (Пошук за зв'язками)**

Розглянемо реальну ситуацію з кібербезпеки: платформа потерпає від атаки реєстраційного бота, який здатен згенерувати, скажімо, 180 фейкових акаунтів за один місяць з однієї або кількох IP-адрес. Нам потрібно швидко виявляти такі аномалії та блокувати цілий набір фейкових користувачів.

Для цього при кожній реєстрації ми створюємо вторинний індекс, що зв'язує IP-адресу з ID створених акаунтів:

```typescript
// src/security/bot-defense.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BotDefenseService {
  constructor(private readonly redis: RedisService) {}

  // Викликається при кожній реєстрації
  async trackRegistration(ipAddress: string, newUserId: string) {
    const indexKey = `registrations_by_ip:${ipAddress}`;
    
    // Додаємо ID користувача до множини під цією IP
    await this.redis.client.sadd(indexKey, newUserId);
    // Встановлюємо TTL, наприклад, на 30 днів (2592000 секунд)
    await this.redis.client.expire(indexKey, 2592000);

    // Перевіряємо кількість реєстрацій з цієї IP (scard повертає розмір множини)
    const accountsCount = await this.redis.client.scard(indexKey);

    if (accountsCount > 5) {
      console.warn(`Аномалія! З IP ${ipAddress} зареєстровано ${accountsCount} акаунтів.`);
      // Запускаємо логіку масового бану
      await this.blockFakeAccounts(indexKey);
    }
  }

  private async blockFakeAccounts(indexKey: string) {
    // Отримуємо всі ID користувачів, створених з цієї підозрілої IP
    const fakeUserIds = await this.redis.client.smembers(indexKey);
    
    for (const userId of fakeUserIds) {
      // Блокуємо кожного користувача
      await this.redis.client.hset(`users:${userId}`, { status: 'banned' });
    }
    
    console.log(`Заблоковано бот-мережу: ${fakeUserIds.length} акаунтів.`);
  }
}
```

Використовуючи простори імен та вторинні індекси (Sets), ми уникаємо важкого сканування бази даних і забезпечуємо швидкість вибірки $O(1)$ або $O(N)$ (де $N$ — розмір результуючого набору, а не всієї бази), що є критичним для високонавантажених та захищених аплікацій.


## 3. Практичні патерни застосування у Nest.js

Для використання наведених нижче прикладів передбачається, що відповідні сервіси інжектять `RedisService`, створений нами раніше.

### 3.1. Обмежувач запитів (Rate Limiter)

Для захисту API (Throttling) ми використовуємо атомарну операцію `INCR`. Якщо ми спробуємо спочатку прочитати значення, а потім записати його — ми отримаємо стан гонитви (race condition) при високому навантаженні. `INCR` вирішує цю проблему.

```typescript
// src/rate-limiter/rate-limiter.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimiterService {
  constructor(private readonly redis: RedisService) {}

  async checkLimit(ipAddress: string, endpoint: string): Promise<void> {
    const limit = 100; // Допустима кількість запитів
    const windowSec = 60; // Вікно в секундах
    const key = `ratelimit:${endpoint}:${ipAddress}`;

    // Виконуємо транзакцію (pipeline) для атомарності
    const [currentRequests] = await this.redis.client
      .multi()
      .incr(key)
      .expire(key, windowSec, 'NX') // Встановлюємо TTL лише якщо його ще немає (NX)
      .exec();

    // currentRequests[1] містить результат виконання incr
    if (currentRequests[1] > limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
```

### 3.2. Сховище сесій (Session Store)

Зберігання JWT-токенів або ідентифікаторів сесій у Redis дозволяє реалізувати механізм примусового завершення сесій (log out from all devices), що неможливо зі звичайними stateless JWT. Використаємо тип даних `Hash`.

```typescript
// src/session/session.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  async createSession(sessionId: string, userId: string, metadata: object) {
    const key = `session:${sessionId}`;
    
    await this.redis.client.hset(key, {
      userId,
      ...metadata,
      createdAt: new Date().toISOString(),
    });
    
    // Сесія живе 24 години
    await this.redis.client.expire(key, 86400);
  }

  async validateSession(sessionId: string): Promise<Record<string, string> | null> {
    const key = `session:${sessionId}`;
    const sessionExists = await this.redis.client.exists(key);
    
    if (!sessionExists) return null;
    
    // Оновлюємо TTL при кожній активності (Rolling Session)
    await this.redis.client.expire(key, 86400);
    return await this.redis.client.hgetall(key);
  }
  
  async revokeSession(sessionId: string) {
    await this.redis.client.del(`session:${sessionId}`);
  }
}
```

### 3.3. Інструмент ранжування даних (Leaderboard / ZSet)

Використання сортованих множин ідеально підходить для створення рейтингів у реальному часі.

```typescript
// src/ranking/leaderboard.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LeaderboardService {
  private readonly LEADERBOARD_KEY = 'platform_ranking';

  constructor(private readonly redis: RedisService) {}

  async updateScore(userId: string, deltaPoints: number) {
    // zincrby додає бали до існуючих (або створює запис з 0 + deltaPoints)
    await this.redis.client.zincrby(this.LEADERBOARD_KEY, deltaPoints, userId);
  }

  async getTopUsers(limit: number = 10) {
    // Отримуємо топ з найвищими балами (zrevrange - реверсивний порядок)
    // WITHSCORES повертає плоский масив: ['user1', '150', 'user2', '120']
    const rawData = await this.redis.client.zrevrange(
      this.LEADERBOARD_KEY, 
      0, 
      limit - 1, 
      'WITHSCORES'
    );
    
    const ranking = [];
    for (let i = 0; i < rawData.length; i += 2) {
      ranking.push({ 
        userId: rawData[i], 
        score: parseFloat(rawData[i + 1]) 
      });
    }
    return ranking;
  }
}
```

### 3.4. Проміжний кеш (Cache-Aside Pattern)

Це класичний патерн: додаток спочатку шукає дані у кеші (Redis). Якщо трапляється кеш-промах (cache miss), додаток запитує базу даних (PostgreSQL/MongoDB), зберігає результат у Redis із заданим TTL, і повертає відповідь.

```typescript
// src/cache/database-cache.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DatabaseCacheService {
  constructor(private readonly redis: RedisService) {}

  // Універсальний метод кешування за допомогою функції зворотного виклику
  async getOrSetCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cachedData = await this.redis.client.get(key);
    
    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }

    // Якщо даних немає - викликаємо функцію отримання (з БД або зовнішнього API)
    const freshData = await fetcher();
    
    // Зберігаємо у кеш ('EX' - встановлює TTL у секундах)
    await this.redis.client.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
    
    return freshData;
  }
}
```

### 3.5. Набір даних, що видаляється з часом (Тимчасові токени)

Найчастіше використовується для підтвердження пошти або скидання пароля. Дані повинні гарантовано зникнути з системи після спливу часу.

```typescript
// src/auth/otp.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  constructor(private readonly redis: RedisService) {}

  async generateResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const key = `reset-password:${token}`;
    
    // Зберігаємо токен. Він валіден лише 15 хвилин (900 секунд).
    // Ми зберігаємо userId як значення, щоб потім знати, чий пароль скидати
    await this.redis.client.set(key, userId, 'EX', 900);
    return token;
  }

  async validateAndConsumeToken(token: string): Promise<string | null> {
    const key = `reset-password:${token}`;
    
    // Отримуємо userId та ОДНОЧАСНО видаляємо токен, щоб його не використали двічі
    // (потребує Redis 6.2+ через команду GETDEL, або використовуємо транзакцію)
    const userId = await this.redis.client.get(key);
    if (userId) {
       await this.redis.client.del(key);
    }
    
    return userId;
  }
}
```

### 3.6. Черга завдань (Task Queue: Producer & Consumer)

У продакшн середовищі для Nest.js стандартом є бібліотека @nestjs/bull (яка побудована над Redis). Але для розуміння низькорівневої механіки, реалізуємо патерн Producer/Consumer за допомогою команд списку (LPUSH та блокуючої BRPOP).

```typescript
// src/queue/simple-queue.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SimpleQueueService implements OnModuleInit {
  private readonly QUEUE_NAME = 'email_queue';

  constructor(private readonly redis: RedisService) {}

  // Запуск воркера при старті модуля
  onModuleInit() {
    this.startWorker();
  }

  // Producer: Додає завдання зліва
  async enqueueEmailJob(emailData: object) {
    await this.redis.client.lpush(this.QUEUE_NAME, JSON.stringify(emailData));
  }

  // Consumer: Забирає завдання справа
  private async startWorker() {
    // Воркер працює у нескінченному циклі
    while (true) {
      try {
        // BRPOP блокує виконання на 0 (нескінченно), поки не з'явиться елемент
        // Повертає масив [queueName, value]
        const result = await this.redis.client.brpop(this.QUEUE_NAME, 0);
        
        if (result) {
          const [, jobPayload] = result;
          const data = JSON.parse(jobPayload);
          console.log('Воркер взяв завдання в обробку:', data);
          // Відправка email...
        }
      } catch (error) {
        console.error('Помилка обробки черги', error);
        // Додаємо затримку перед наступною спробою у разі помилки з'єднання
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }
}
```

### 3.7. Механізм публікації та підписки (Pub/Sub)

Redis Pub/Sub не зберігає повідомлення (на відміну від черг чи Redis Streams). Якщо на момент публікації підписник був офлайн — повідомлення втрачено.

Архітектурно важливо розуміти: клієнт, переведений у режим subscribe, не може виконувати інші команди. Тому нам потрібно два окремих екземпляри Redis: один для звичайних операцій (публікації), інший — виключно для прослуховування.

```typescript
// src/pubsub/pubsub.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private subscriberClient: Redis;

  constructor(
    private readonly redis: RedisService, // Publisher (стандартний клієнт)
    private readonly configService: ConfigService,
  ) {
    // Створюємо НОВИЙ ізольований клієнт для підписки
    this.subscriberClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
    });
  }

  onModuleInit() {
    // Підписуємось на канал 'system_events'
    this.subscriberClient.subscribe('system_events', (err, count) => {
      if (err) {
        console.error('Помилка підписки Pub/Sub', err);
      } else {
        console.log(`Успішно підписано. Кількість каналів: ${count}`);
      }
    });

    // Слухач подій
    this.subscriberClient.on('message', (channel, message) => {
      if (channel === 'system_events') {
        const event = JSON.parse(message);
        this.handleEvent(event);
      }
    });
  }

  // Метод, який використовує основний клієнт для публікації
  async publishEvent(eventType: string, payload: any) {
    const message = JSON.stringify({ eventType, payload, timestamp: new Date() });
    await this.redis.client.publish('system_events', message);
  }

  private handleEvent(event: any) {
    console.log('[Pub/Sub] Отримано системну подію:', event);
    // Логіка реагування (наприклад, інвалідація локального кешу на інших інстансах)
  }

  onModuleDestroy() {
    this.subscriberClient.disconnect();
  }
}
```
