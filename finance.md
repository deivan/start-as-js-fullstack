# Обробка фінансових операцій на бекенді

## 1. Фундаментальні принципи фінансових систем

Обробка фінансів вимагає жорстких архітектурних гарантій. Будь-яка помилка може призвести до втрати коштів або створення грошей "з повітря".

**ACID гарантії**: Усі фінансові операції (наприклад, списання з одного рахунку та зарахування на інший) повинні виконуватися в межах транзакцій бази даних. Або виконуються всі кроки, або жоден (Atomicity).

**Незмінність (Immutability)**: Фінансові записи ніколи не видаляються (ніякого фізичного DELETE) і не модифікуються (не можна змінити суму проведеної транзакції). Будь-які зміни (повернення, коригування) робляться виключно створенням нових, компенсуючих транзакцій.

**Ідемпотентність**: Запобігання подвійним списанням при повторних запитах (наприклад, через проблеми з мережею). Кожна операція повинна мати унікальний idempotencyKey.

**Зберігання сум**: Ніколи не використовуйте Float або Double. Для уникнення проблем з точністю плаваючої коми слід використовувати тип Decimal у базі даних або зберігати суми у найменших одиницях валюти (копійки, центи) як Integer чи BigInt.

### 1.1 новлена інформація щодо зберігання сум

Сучасна база даних PostgreSQL підтримує тип даних `Decimal`, який дозволяє зберігати числа з фіксованою точністю, що є ідеальним для фінансових операцій. Використання `Decimal` забезпечує точність при виконанні арифметичних операцій, що критично важливо для фінансових транзакцій. Таким чином, слід переносити фінансові операції з бекенду до функціоналу бази даних, використовуючи `Decimal` для зберігання сум, що дозволить забезпечити точність і надійність фінансових операцій.  

## 2. Проєктування бази даних (Prisma Schema)

Для реалізації базового гаманця (Wallet) нам знадобляться моделі користувача, самого гаманця та історії транзакцій.

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  wallet    Wallet?
  createdAt DateTime @default(now())
}

model Wallet {
  id        String        @id @default(uuid())
  userId    String        @unique
  user      User          @relation(fields: [userId], references: [id])
  balance   Decimal       @default(0.00) @db.Decimal(15, 2)
  currency  String        @default("UAH")
  isActive  Boolean       @default(true)
  
  transactions Transaction[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

enum TransactionType {
  DEPOSIT
  WITHDRAWAL
  REFUND
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
  DISPUTED
}

model Transaction {
  id             String            @id @default(uuid())
  walletId       String
  wallet         Wallet            @relation(fields: [walletId], references: [id])
  type           TransactionType
  status         TransactionStatus @default(PENDING)
  amount         Decimal           @db.Decimal(15, 2)
  idempotencyKey String?           @unique // Для захисту від подвійних списань
  referenceId    String?           // ID пов'язаної транзакції (напр., для рефанду)
  description    String?
  
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([walletId])
  @@index([createdAt])
}
```

У цьому дизайні:
- Кожен користувач має один гаманець.
- Гаманець зберігає баланс та валюту.
- Транзакції пов'язані з гаманцем і мають тип, статус, суму та унікальний idempotencyKey для запобігання подвійним операціям.   
- Статуси транзакцій дозволяють відстежувати їхній стан (очікує, завершено, не вдалося, оскаржено).

## 3. Модуль Wallet (Nest.js): Базовий CRUD та Ініціалізація

У цьому прикладі ми об'єднаємо роботу з `WalletService` та `TransactionService` в одному контролері для зручності управління ресурсом гаманця.

**Ключові моменти реалізації контролера:**

- *Валідація (DTO)*: Хоча у прикладі наведено спрощені класи, в реальному застосунку вони повинні бути доповнені декораторами з class-validator (наприклад, @IsUUID(), @IsNumber(), @IsNotEmpty(), @Min(0.01)).
- *Ідемпотентність у запиті*: Зверніть увагу, що idempotencyKey передається безпосередньо у тілі запиту (WithdrawDto) або може бути реалізований через зчитування спеціального заголовка (Header) на кшталт X-Idempotency-Key за допомогою @Headers().
- *Http-статуси*: За допомогою декоратора @HttpCode ми явно вказуємо очікувані коди відповідей (наприклад, 200 OK замість стандартного для POST 201 Created у випадку виконання списання чи рефанду).

```typescript
// wallet.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  Patch,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WalletService } from './wallet.service';
import { TransactionService } from './transaction.service';

// DTOs (Data Transfer Objects) для валідації вхідних даних
class CreateWalletDto {
  userId: string;
  currency?: string;
}

class WithdrawDto {
  amount: number;
  idempotencyKey: string;
}

@Controller('api/v1/wallets')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
  ) {}

  // POST /api/v1/wallets
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWallet(@Body() dto: CreateWalletDto) {
    return this.walletService.createWallet(dto.userId, dto.currency);
  }

  // GET /api/v1/wallets/:id/balance
  @Get(':id/balance')
  async getBalance(@Param('id') id: string) {
    return this.walletService.getBalance(id);
  }

  // PATCH /api/v1/wallets/:id/status
  @Patch(':id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.walletService.toggleWalletStatus(id, isActive);
  }

  // POST /api/v1/wallets/:id/withdraw
  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawDto,
  ) {
    // Конвертуємо число з DTO у формат Decimal для точної роботи в Prisma
    const amountDecimal = new Prisma.Decimal(dto.amount);
    
    return this.transactionService.processWithdrawal(
      id, 
      amountDecimal, 
      dto.idempotencyKey
    );
  }

  // GET /api/v1/wallets/:id/history?page=1&limit=20
  @Get(':id/history')
  async getHistory(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.transactionService.getHistory(
      id, 
      Number(page), 
      Number(limit)
    );
  }

  // POST /api/v1/wallets/transactions/:txId/refund
  // Маршрут винесено семантично ближче до транзакцій
  @Post('transactions/:txId/refund')
  @HttpCode(HttpStatus.OK)
  async refundTransaction(@Param('txId') txId: string) {
    return this.transactionService.processRefund(txId);
  }
}
```

### 3.1. Сервіс для обробки гаманця

Оскільки фінансові записи не повинні видалятися, CRUD для гаманця зводиться до створення, отримання балансу та блокування/розблокування (замість видалення).

```typescript
// wallet.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  // Create: Створення гаманця для нового користувача
  async createWallet(userId: string, currency: string = 'UAH') {
    return this.prisma.wallet.create({
      data: {
        userId,
        currency,
      },
    });
  }

  // Read: Отримання балансу
  async getBalance(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { balance: true, currency: true, isActive: true },
    });

    if (!wallet) throw new NotFoundException('Гаманець не знайдено');
    return wallet;
  }

  // Update/Delete (Soft): Зміна статусу гаманця (блокування)
  async toggleWalletStatus(walletId: string, isActive: boolean) {
    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { isActive },
    });
  }
}
```

## 4. Обробка фінансових операцій (Транзакції БД)

Головне правило обробки — уникнення стану "гонитви" (race conditions) при одночасних запитах. Prisma дозволяє робити атомарні оновлення балансу (increment / decrement), що значно безпечніше за класичне зчитування-зміна-запис.

```typescript
// transaction.service.ts
import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, TransactionStatus, Prisma } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async processWithdrawal(walletId: string, amount: Prisma.Decimal, idempotencyKey: string) {
    // 1. Перевірка ідемпотентності
    const existingTx = await this.prisma.transaction.findUnique({
      where: { idempotencyKey },
    });
    if (existingTx) {
      return existingTx; // Повертаємо вже оброблену транзакцію
    }

    // 2. Інтерактивна транзакція бази даних
    return this.prisma.$transaction(async (tx) => {
      // Перевіряємо баланс з блокуванням рядка (Pessimistic lock) 
      // У Prisma для цього можна використати $queryRaw, але для простоти
      // ми використаємо перевірку + атомарне оновлення, яке впаде, якщо баланс піде в мінус
      // (потребує відповідного CHECK constraint в базі Postgres: CHECK (balance >= 0))
      
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet || !wallet.isActive) {
        throw new BadRequestException('Гаманець недоступний');
      }

      if (Number(wallet.balance) < Number(amount)) {
         throw new BadRequestException('Недостатньо коштів');
      }

      // Створюємо запис про транзакцію
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
          amount,
          idempotencyKey,
          description: 'Списання коштів',
        },
      });

      // Атомарно оновлюємо баланс
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      return transaction;
    });
  }
}
```

**Важливе зауваження**: На рівні бази даних PostgreSQL вкрай рекомендується додати обмеження `ALTER TABLE "Wallet" ADD CONSTRAINT balance_check CHECK (balance >= 0);`. Це гарантує, що жодне паралельне виконання не зможе зробити баланс від'ємним.


## 5. Перегляд історії операцій

Отримання історії повинно підтримувати пагінацію та фільтрацію (за датою, типом, статусом). Великі вибірки фінансових даних можуть уповільнювати систему, тому індекси в БД є критичними (як показано в схемі вище: `@@index([walletId])`).

```typescript
// transaction.service.ts
  async getHistory(walletId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' }, // Найновіші перші
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { walletId } }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
```

## 6. Механізм рефанду (Refund) та оскарження (Dispute)

Повернення коштів не повинно змінювати статус оригінальної транзакції на "видалено". Замість цього створюється нова транзакція, яка логічно пов'язана з оригінальною через `referenceId`.

```typescript
// transaction.service.ts
  async processRefund(originalTransactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Знаходимо оригінальну транзакцію
      const originalTx = await tx.transaction.findUnique({
        where: { id: originalTransactionId },
      });

      if (!originalTx) throw new NotFoundException('Транзакцію не знайдено');
      if (originalTx.type !== TransactionType.WITHDRAWAL) {
        throw new BadRequestException('Повернення можливе лише для списань');
      }

      // 2. Перевіряємо, чи не було вже рефанду для цієї транзакції
      const existingRefund = await tx.transaction.findFirst({
        where: { 
          referenceId: originalTransactionId,
          type: TransactionType.REFUND
        }
      });

      if (existingRefund) {
        throw new ConflictException('Кошти за цю транзакцію вже повернено');
      }

      // 3. Створюємо транзакцію повернення
      const refundTx = await tx.transaction.create({
        data: {
          walletId: originalTx.walletId,
          type: TransactionType.REFUND,
          status: TransactionStatus.COMPLETED,
          amount: originalTx.amount, // Повертаємо ту саму суму
          referenceId: originalTx.id,
          description: `Повернення коштів за транзакцією ${originalTx.id}`,
        },
      });

      // 4. Повертаємо кошти на баланс (атомарний інкремент)
      await tx.wallet.update({
        where: { id: originalTx.walletId },
        data: {
          balance: {
            increment: originalTx.amount,
          },
        },
      });

      return refundTx;
    });
  }

  // Оскарження транзакції (Dispute)
  async markAsDisputed(transactionId: string) {
     // Зміна статусу транзакції для привернення уваги адміністрації.
     // Реальні гроші не рухаються на цьому етапі, лише заморожуються або підсвічуються.
     return this.prisma.transaction.update({
       where: { id: transactionId },
       data: { status: TransactionStatus.DISPUTED }
     });
  }
```

## 7. Типові проблеми фінансових транзакцій

Розробка фінансового бекенду — це постійна боротьба із законами фізики (затримки мережі) та обмеженнями апаратного забезпечення (зависання БД, відмови серверів). У таких системах ми завжди маємо виходити з презумпції "все, що може зламатися — обов'язково зламається".

### 7.1: Транспортна відмова (Network Partition) та подвійне списання

**Сценарій**: Клієнт надсилає запит на переказ 1000 грн. Сервер успішно списує гроші в БД, але під час відправки відповіді 200 OK клієнту пропадає інтернет. Клієнт бачить помилку "Time out", думає, що операція не пройшла, і натискає кнопку "Повторити" ще раз. Без належного захисту клієнт втратить 2000 грн.

**Рішення: Строга Ідемпотентність (Strict Idempotency)**

Кожен запит, що змінює стан, повинен мати унікальний ключ idempotency-key (зазвичай генерується на клієнті як UUID). Ми зберігаємо цей ключ у БД з обмеженням UNIQUE. Якщо клієнт повторює запит, БД видасть помилку унікальності, і ми просто повернемо результат попередньої операції, не списуючи кошти вдруге.

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransferService {
  constructor(private prisma: PrismaService) {}

  async processTransfer(walletId: string, amount: number, idempotencyKey: string) {
    try {
      // Спроба створити транзакцію і списати кошти в межах однієї транзакції БД
      return await this.prisma.$transaction(async (tx) => {
        
        // 1. Створюємо запис. Якщо idempotencyKey вже існує, тут виникне помилка бази
        const transaction = await tx.transaction.create({
          data: {
            walletId,
            amount,
            type: 'WITHDRAWAL',
            idempotencyKey, // В Prisma Schema має стояти @unique
          },
        });

        // 2. Оновлюємо баланс
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: amount } },
        });

        return transaction;
      });

    } catch (error) {
      // Відловлюємо помилку унікальності Prisma (P2002)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        error.meta?.target?.includes('idempotencyKey')
      ) {
        // Замість помилки, ми знаходимо вже успішно створену транзакцію
        // і повертаємо її клієнту так, ніби запит щойно успішно виконався
        const existingTx = await this.prisma.transaction.findUnique({
          where: { idempotencyKey },
        });
        return existingTx; 
      }
      
      throw error; // Кидаємо інші помилки далі
    }
  }
}
```

## 7.2 Стан гонитви (Race Condition) при паралельних запитах

**Сценарій**: Хакер або звичайний баг у фронтенді відправляє два запити на зняття останніх 100 грн мілісекунда в мілісекунду. Обидва потоки на бекенді роблять SELECT balance, бачать 100 >= 100, пропускають валідацію і роблять UPDATE balance = balance - 100. У підсумку на балансі -100, хоча кредитного ліміту немає.

**Рішення: Оптимістичне блокування (Optimistic Concurrency Control)**

Ми додаємо поле version до таблиці Wallet. При кожному оновленні балансу ми збільшуємо версію на +1. Якщо два потоки спробують оновити гаманець з однаковою версією, другий запит не знайде рядок для оновлення і відхилиться.

```prisma
model Wallet {
  id      String  @id @default(uuid())
  balance Decimal @default(0.00)
  version Int     @default(1) // Додаємо поле версіонування
}
```

```typescript
async withdrawSafe(walletId: string, amount: Prisma.Decimal) {
  const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
  
  if (wallet.balance < amount) throw new BadRequestException('Недостатньо коштів');

  // Використовуємо updateMany для можливості фільтрації по версії
  const updateResult = await this.prisma.wallet.updateMany({
    where: { 
      id: walletId,
      version: wallet.version, // Оновлюємо ТІЛЬКИ якщо версія не змінилася з моменту SELECT
    },
    data: {
      balance: { decrement: amount },
      version: { increment: 1 }, // Підвищуємо версію
    },
  });

  // Якщо count === 0, значить інший потік встиг змінити баланс (версія змінилася)
  // Операція відхиляється, система залишається в консистентному стані
  if (updateResult.count === 0) {
    throw new ConflictException('Конкурентний запит: баланс було змінено. Спробуйте ще раз.');
  }

  return { success: true };
}
```

## 7.3 Зависання бази даних (Deadlocks & Timeouts)

**Сценарій**: Під час виконання складної фінансової операції база даних починає гальмувати (наприклад, через бекап або важкий аналітичний запит). Ваша транзакція "висать" і тримає з'єднання відкритим. Якщо таких запитів багато, пул з'єднань (Connection Pool) вичерпується, і весь застосунок "лягає" (навіть ті частини, які не пов'язані з гаманцем).

**Рішення: Жорсткі тайм-аути на рівні транзакцій**
Ніколи не залишайте фінансові транзакції без тайм-аутів. Краще швидко відхилити запит (Fail Fast), ніж покласти весь сервіс.

```typescript
async processComplexPayment(userId: string) {
  try {
    // Явно вказуємо Prisma, скільки ми готові чекати
    return await this.prisma.$transaction(
      async (tx) => {
        // ... складна логіка переказів між кількома таблицями ...
      },
      {
        maxWait: 2000, // Макс. час очікування на підключення до БД (2 секунди)
        timeout: 5000, // Макс. час виконання самої транзакції (5 секунд)
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, // Рівень ізоляції для фінансів
      }
    );
  } catch (error) {
    // Якщо сталася помилка тайм-ауту або дедлок (Prisma P2020 або P2034)
    if (error.code === 'P2024' || error.code === 'P2034') {
       // Логуємо критичну проблему в систему моніторингу (Sentry, Datadog)
       this.logger.error('Транзакція не встигла виконатись через навантаження БД');
       throw new ServiceUnavailableException('Сервіс тимчасово перевантажений, спробуйте пізніше');
    }
    throw error;
  }
}
```

### 7.4 Зависання сторонніх API (Payment Gateways)

**Сценарій**: Користувач виводить кошти на банківську картку. Ми списуємо кошти в нашій БД, відправляємо API запит до банку (наприклад, Stripe/LiqPay), а банк не відповідає (Time out). Ми не знаємо: банк зарахував гроші чи ні? Якщо ми повернемо гроші користувачу (зробимо рефанд), а банк все ж таки обробив платіж — ми зазнаємо збитків.

**Рішення: Патерн Машини Станів (State Machine) та Асинхронні перевірки (Polling/Webhooks)**
Ми ніколи не чекаємо синхронної відповіді від банку як фінальної інстанції.

1. Переводимо транзакцію у статус `PROCESSING`.

2. Відправляємо запит до банку.

3. Якщо банк "відвалився", транзакція залишається в PROCESSING.

4. Окремий фоновий процес (Cron Job) шукає всі "завислі" транзакції та запитує статус у банку.

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PaymentReconciliationService {
  constructor(
    private prisma: PrismaService,
    private bankApiClient: BankApiClient, // Ваш HTTP клієнт до банку
  ) {}

  // Запускаємо крон-задачу кожні 5 хвилин
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkPendingTransactions() {
    // Знаходимо транзакції, які "зависли" більше ніж на 10 хвилин
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const stuckTransactions = await this.prisma.transaction.findMany({
      where: {
        status: 'PROCESSING',
        type: 'WITHDRAWAL_TO_CARD',
        createdAt: { lte: tenMinutesAgo },
      },
    });

    for (const tx of stuckTransactions) {
      try {
        // Звертаємося до банку, щоб дізнатися РЕАЛЬНИЙ статус за нашим tx.id
        const bankStatus = await this.bankApiClient.checkStatus(tx.id);

        if (bankStatus === 'SUCCESS') {
           await this.prisma.transaction.update({
             where: { id: tx.id },
             data: { status: 'COMPLETED' }
           });
        } else if (bankStatus === 'FAILED' || bankStatus === 'NOT_FOUND') {
           // ТІЛЬКИ якщо банк підтвердив, що гроші не пішли, ми робимо безпечне повернення
           await this.processCompensatingRefund(tx);
        }
        // Якщо банк відповів PENDING - залишаємо як є, перевіримо в наступному циклі
        
      } catch (e) {
        // Банк знову не відповів, пропускаємо, спробуємо ще раз через 5 хвилин
        console.error(`Неможливо синхронізувати транзакцію ${tx.id}`, e);
      }
    }
  }
}
```

## 8. Best Practice: Глобальний фільтр помилок

У фінансовому бекенді ніколи не можна віддавати "сирі" помилки бази даних на фронтенд (це порушення безпеки). У Nest.js для цього створюють `ExceptionFilter`.

```typescript
// prisma-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутрішня помилка сервера при обробці даних';

    switch (exception.code) {
      case 'P2002': // Унікальність
        status = HttpStatus.CONFLICT;
        message = 'Конфлікт даних: такий запис вже існує';
        break;
      case 'P2025': // Запис не знайдено при оновленні
        status = HttpStatus.NOT_FOUND;
        message = 'Запис для оновлення не знайдено';
        break;
      case 'P2034': // Deadlock
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Система тимчасово перевантажена, спробуйте ще раз';
        break;
    }

    // Логуємо сиру помилку в консоль/Sentry для розробників
    console.error('[Prisma Error]', exception);

    // Віддаємо клієнту безпечний формат
    response.status(status).json({
      statusCode: status,
      error: 'Database Error',
      message: message,
    });
  }
}
```
