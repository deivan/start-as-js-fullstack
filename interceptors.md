## Тема: Використання Interceptors (Перехоплювачів)

### Призначення та сфера використання Interceptors

**Interceptors (Перехоплювачі)** у NestJS — це потужний механізм, натхненний парадигмою аспектно-орієнтованого програмування (AOP). Їхня унікальна особливість полягає в тому, що вони можуть втручатися в життєвий цикл запиту **як до** виклику обробника маршруту (контролера), **так і після** того, як контролер повернув результат.

Оскільки NestJS під капотом активно використовує бібліотеку RxJS для роботи з перехоплювачами, вони оперують потоками даних (`Observables`).

**Основні сфери використання:**
1.  **Трансформація відповідей:** Зміна формату або структури даних, які повертає контролер, перед тим, як відправити їх клієнту (наприклад, загортання всіх відповідей у стандартизований об'єкт `{ data: ... }`).
2.  **Глобальна обробка помилок:** Перехоплення винятків та зміна їхнього формату або логування перед тим, як вони дійдуть до користувача.
3.  **Розширення базової поведінки маршрутів:** Наприклад, кешування відповідей (якщо дані вже є в кеші, інтерцептор може повернути їх негайно, навіть не викликаючи контролер).
4.  **Вимірювання продуктивності (Логування):** Замір часу виконання конкретного запиту від початку до кінця.

### Кроки створення кастомного Interceptor

Створення інтерцептора зводиться до реалізації інтерфейсу `NestInterceptor`, який вимагає наявності методу `intercept()`.

#### Крок 1. Базова структура класу

Генеруємо клас (можна через CLI: `nest g interceptor name`) та додаємо декоратор `@Injectable()`. Метод `intercept` приймає `ExecutionContext` (контекст запиту) та `CallHandler` (обробник виклику, який дозволяє продовжити виконання потоку).

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class CustomInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Логіка ДО виконання контролера
    return next.handle(); // Виклик контролера
  }
}
```

#### Крок 2. Приклад 1: Інтерцептор для вимірювання часу виконання (Performance Logger)

Цей перехоплювач фіксує час до того, як запит потрапить у контролер, і за допомогою оператора `tap` з `rxjs` логує загальний час після завершення обробки.

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next
      .handle()
      .pipe(
        tap(() => this.logger.log(`[${method}] ${url} - Виконано за ${Date.now() - now}ms`)),
      );
  }
}
```

#### Крок 3. Приклад 2: Інтерцептор для стандартизації відповідей (Response Transform)

Цей перехоплювач бере дані, які успішно повернув контролер (наприклад, масив користувачів), і автоматично обгортає їх у стандартизований JSON-формат за допомогою оператора `map`.

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  statusCode: number;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>> {
    const response = context.switchToHttp().getResponse();
    const status = response.statusCode;

    // next.handle() повертає Observable з даними від контролера
    return next.handle().pipe(
      map(data => ({
        statusCode: status,
        data: data, // Обгортаємо сирі дані у властивість 'data'
      })),
    );
  }
}
```

### Застосування Interceptors на практиці

Так само як і Guards чи Pipes, перехоплювачі можна застосовувати на трьох рівнях за допомогою декоратора `@UseInterceptors()`.

**1. На рівні методу (найчастіше):**
```ts
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';

@Controller('users')
export class UsersController {
  
  @Get()
  @UseInterceptors(TransformInterceptor) // Застосовано лише до цього маршруту
  getUsers() {
    return [{ id: 1, name: 'Ivan' }]; 
    // Клієнт отримає: { statusCode: 200, data: [{ id: 1, name: 'Ivan' }] }
  }
}
```

**2. На рівні контролера:**

```ts
@UseInterceptors(LoggingInterceptor) // Застосовано до всіх маршрутів контролера
@Controller('products')
export class ProductsController {
  // ...
}
```

**3. На глобальному рівні (у `main.ts`):**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Застосовується до всіх запитів у додатку
  app.useGlobalInterceptors(new LoggingInterceptor());
  
  await app.listen(3000);
}
bootstrap();
```