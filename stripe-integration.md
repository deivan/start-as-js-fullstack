Для інтеграції зі Stripe логіка перевірки сигнатури трохи відрізняється від ручного хешування. Stripe надає власну бібліотеку (stripe в npm), яка має готовий метод stripe.webhooks.constructEvent(). Цей метод робить дві речі одночасно: перевіряє сигнатуру та повертає типізований об'єкт події (Stripe.Event).

Головна складність роботи зі Stripe у NestJS полягає в тому, що для перевірки сигнатури Stripe вимагає абсолютно сире тіло запиту (Raw Buffer), а NestJS за замовчуванням парсить усе в JSON.

# Крок 1: Увімкнення доступу до Raw Body у main.ts

Щоб мати доступ до сирого буфера, потрібно додати опцію rawBody: true при створенні екземпляра додатка.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // ВАЖЛИВО: Дозволяє використовувати req.rawBody у контролерах
  });
  
  await app.listen(3000);
}
bootstrap();
```

## Крок 2: Створення сервісу Stripe

Створимо сервіс, який буде ініціалізувати SDK та виконувати перевірку.

```typescript
// src/stripe/stripe.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  // Секрет вебхука (починається з whsec_...) з дашборду Stripe
  private endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; 

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16', // Вкажіть вашу версію API Stripe
    });
  }

  verifyWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      // Цей метод автоматично перевіряє криптографічний підпис.
      // Якщо підпис не співпадає, він викине помилку.
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.endpointSecret,
      );
    } catch (err) {
      // Перехоплюємо помилку Stripe і кидаємо зрозумілу 400 помилку клієнту
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }
  }
}
```

## Крок 3: Контролер вебхуків

Тепер створимо контролер, який отримує запит, дістає потрібний заголовок stripe-signature, сире тіло запиту та передає їх у сервіс.

```typescript
// src/stripe/stripe-webhook.controller.ts
import { 
  Controller, 
  Post, 
  Req, 
  Headers, 
  RawBodyRequest, 
  BadRequestException 
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly stripeService: StripeService) {}

  @Post()
  async handleStripeWebhook(
    // Використовуємо RawBodyRequest для правильної типізації req.rawBody
    @Req() req: RawBodyRequest<Request>, 
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Перевіряємо підпис та отримуємо валідовану подію
    const event = this.stripeService.verifyWebhookEvent(req.rawBody, signature);

    // Тепер можна безпечно обробляти типізовану подію
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`Оплата успішна для суми: ${paymentIntent.amount}`);
        
        // Тут ви викликаєте вашу логіку з Кейсу №2 (Транзакція Prisma з перевіркою унікальності)
        // await this.paymentService.processPayment(userId, amount, paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object;
        console.log(`Помилка оплати: ${failedIntent.last_payment_error?.message}`);
        break;

      default:
        console.log(`Необроблюваний тип події: ${event.type}`);
    }

    // Stripe вимагає швидко повернути 200 OK, інакше він буде повторювати запит
    return { received: true };
  }
}
```

## Чому цей підхід кращий для Stripe:

1. **Безпека від Stripe**: Використовується офіційний криптографічний механізм SDK, який враховує навіть timestamp запиту (захист від replay-атак).

2. **Типізація**: Замість "сліпого" req.body, ви отримуєте об'єкт Stripe.Event, де TypeScript буде підказувати вам всі доступні поля для кожної події (наприклад, event.data.object.amount).

3. **Обхід парсера NestJS**: Використання @Req() req: RawBodyRequest<Request> гарантує, що Node.js не спотворить буфер перед перевіркою підпису.


## Крок 4: Додаткові поради

- **Логування**: Рекомендується логувати всі отримані події та результати перевірки для подальшого аудиту та налагодження.
- **Тестування**: Stripe надає інструмент stripe-cli, який дозволяє локально тестувати вебхуки, імітуючи реальні запити від Stripe з правильними підписами.
- **Обробка помилок**: Якщо підпис не співпадає, важливо повернути 400 Bad Request, щоб Stripe не повторював запит. Якщо ж обробка події викликає внутрішню помилку, можна повернути 500 Internal Server Error, і Stripe спробує повторити запит пізніше.

