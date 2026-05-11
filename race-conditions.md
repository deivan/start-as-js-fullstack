# 1. Верифікація сигнатури вхідного callback запиту (Webhook Signature)

Платіжні системи (Stripe, LiqPay, Monobank тощо) надсилають webhooks. Зловмисник може надіслати фейковий POST-запит на ваш endpoint. Щоб цього уникнути, платіжка підписує запит секретним ключем, а ви маєте перевірити цю сигнатуру.

**Практика в NestJS:**

Найкраще реалізувати це через NestJS Guard.
Важливий нюанс: для правильної перевірки підпису вам потрібен "сирий" (raw) buffer тіла запиту, а не спарсений JSON.

Приклад коду:

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class PaymentSignatureGuard implements CanActivate {
  private readonly secret = process.env.PAYMENT_WEBHOOK_SECRET;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-payment-signature'] as string;
    
    if (!signature) {
      throw new UnauthorizedException('Missing signature');
    }

    // Зверніть увагу: request.rawBody має бути налаштований в main.ts 
    // через app.useBodyParser('json', { limit: '10mb' }) або raw-body middleware
    const payload = request['rawBody']; 

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid payment signature');
    }

    return true;
  }
}
```

**Використання в контролері:**

```typescript
import { Controller, Post, UseGuards, Req } from '@nestjs/common';

@Controller('webhooks/payments')
export class PaymentWebhookController {
  
  @Post()
  @UseGuards(PaymentSignatureGuard)
  async handlePayment(@Req() req: Request) {
    // Якщо код дійшов сюди — запит 100% від реальної платіжної системи
    return this.paymentService.processCallback(req.body);
  }
}
```

# 2. Чому increment не рятує від Race Condition і як це вирішити 

Звичайний Prisma increment (наприклад, balance: { increment: 50 }) не гарантує правильного результату, якщо проблема лежить у дублюванні запитів або у Read-Modify-Write патерні.

Якщо платіжна система через мережевий збій надішле два однакових callback-запити про поповнення на 50$ одночасно, ваш бекенд обробить обидва, і база зробить increment двічі. Баланс стане +100$ замість +50$.

**Практичне рішення (Ідемпотентність):**
Замість сліпого інкременту, кожна транзакція повинна мати унікальний ідентифікатор від платіжки (providerTransactionId), який зберігається в базі з обмеженням UNIQUE.

Приклад коду (NestJS Service + Prisma):

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  async processPayment(userId: string, amount: number, transactionId: string) {
    try {
      // Використовуємо транзакцію для гарантії цілісності
      await this.prisma.$transaction(async (tx) => {
        
        // 1. Створюємо запис про транзакцію. 
        // Якщо transactionId вже є в базі, БД викине помилку (Unique Constraint)
        await tx.transactionHistory.create({
          data: {
            id: transactionId,
            userId,
            amount,
            status: 'SUCCESS'
          }
        });

        // 2. Тільки якщо транзакція успішно збереглась (вона унікальна),
        // оновлюємо баланс користувача.
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: { increment: amount }
          }
        });
      });

      return { success: true };
    } catch (error) {
      // Перехоплюємо помилку Prisma про порушення унікальності (P2002)
      if (error.code === 'P2002') {
        // Це не помилка системи, це просто дубль вебхука — ігноруємо його
        console.warn(`Transaction ${transactionId} already processed.`);
        return { success: true }; 
      }
      throw error;
    }
  }
}
```
У цьому коді ми спочатку намагаємося створити запис про транзакцію з унікальним transactionId. Якщо цей ID вже існує (тобто ми отримали дубль запиту), Prisma викине помилку P2002, яку ми ловимо і просто ігноруємо, не роблячи інкремент балансу вдруге. Таким чином, навіть якщо платіжка надішле кілька однакових запитів, баланс користувача буде оновлено лише один раз.

Але... це не працює, коли в нас є декілька окремих інстансів :)

# 3. Механізми блокування: Redis Redlock та FOR UPDATE у БД

Коли логіка стає складнішою (наприклад, треба перевірити баланс перед списанням грошей за товар, який теж може закінчитись), інкремент чи ідемпотентність не допоможуть. Потрібно заблокувати рядок користувача, щоб інші процеси чекали.

## 3.1 Блокування на рівні БД (SELECT ... FOR UPDATE)

Prisma ORM на даний момент не має вбудованого методу forUpdate() у своєму Query Builder. Тому для песимістичного блокування використовується $queryRaw.

```typescript
@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async buyItem(userId: string, itemId: string, price: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Блокуємо рядок юзера на рівні БД!
      // Інші транзакції, що спробують зробити те саме для цього юзера, "зависнуть" в очікуванні
      const users = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "User" 
        WHERE id = ${userId} 
        FOR UPDATE
      `;
      const user = users[0];

      if (user.balance < price) {
        throw new Error('Недостатньо коштів');
      }

      // 2. Списуємо кошти безпечно
      await tx.$queryRaw`
        UPDATE "User" 
        SET balance = balance - ${price} 
        WHERE id = ${userId}
      `;
      
      // 3. Видаємо товар...
    });
  }
}
```

## 3.2 Розподілене блокування через Redis (Redlock)

Якщо у вас мікросервіси, запущено кілька інстансів NestJS або є процеси, які не можуть бути об'єднані в одну SQL-транзакцію, використовують Redis.

Для NestJS підійде бібліотека redlock (працює поверх ioredis).

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import Redlock from 'redlock';

@Injectable()
export class WalletService {
  private redlock: Redlock;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.redlock = new Redlock([this.redis], {
      driftFactor: 0.01, // час на синхронізацію
      retryCount: 10,    // скільки разів намагатись захопити лок
      retryDelay: 200,   // пауза між спробами (мс)
    });
  }

  async transferMoney(fromUserId: string, toUserId: string, amount: number) {
    const resource = `locks:wallet:transfer:${fromUserId}`;
    const ttl = 5000; // лок на 5 секунд

    // Намагаємось захопити блокування у Redis
    const lock = await this.redlock.acquire([resource], ttl);
    
    try {
      // Критична секція: тут виконується логіка переказу.
      // Жоден інший запит з таким самим fromUserId сюди не зайде, 
      // поки ми не відпустимо lock.
      
      await this.processTransfer(fromUserId, toUserId, amount);

    } finally {
      // Обов'язково знімаємо блокування, навіть якщо сталась помилка
      await lock.release();
    }
  }

  private async processTransfer(from: string, to: string, amount: number) {
    // Внутрішня логіка списання/нарахування...
  }
}
```
