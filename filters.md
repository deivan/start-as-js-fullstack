## Тема: Використання Filters (Фільтри винятків)

### Призначення та сфера використання Filters

У NestJS вбудовано потужний **глобальний шар обробки винятків (Exception Layer)**. За замовчуванням він перехоплює всі необроблені помилки (винятки) у додатку і автоматично формує для клієнта зрозумілу JSON-відповідь (наприклад, стандартну помилку `404 Not Found` або `500 Internal Server Error`).

Проте часто виникає потреба вийти за межі стандартної поведінки. Саме для цього створюються кастомні **Exception Filters (Фільтри винятків)**. 

**Основні сфери використання:**
1.  **Єдиний стандарт відповідей:** Компанії часто мають власний корпоративний стандарт формату помилок (наприклад, кожна помилка повинна містити поле `timestamp`, `path` та кастомний `errorCode`).
2.  **Перехоплення специфічних помилок бази даних:** Наприклад, перехоплення помилок унікальності (Unique Constraint) від TypeORM або Prisma та перетворення їх на зрозумілі HTTP `400 Bad Request` замість `500 Internal Server Error`.
3.  **Логування:** Запис критичних помилок у файл або відправка сповіщень у Telegram/Slack перед тим, як віддати відповідь клієнту.
4.  **Приховування системних деталей:** Щоб випадково не відправити клієнту стек-трейс (stack trace) або чутливу інформацію про структуру бази даних.

### Кроки створення кастомного Filter

Для створення фільтра необхідно імплементувати інтерфейс `ExceptionFilter` і використати декоратор `@Catch()`.

#### Крок 1. Базова структура класу та використання @Catch

Декоратор `@Catch()` визначає, які саме типи винятків має перехоплювати цей фільтр. Можна вказати конкретний клас (наприклад, `HttpException`), або залишити дужки порожніми `@Catch()`, щоб перехоплювати абсолютно всі помилки (Error).

```ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

// Вказуємо, що фільтр ловить лише винятки типу HttpException та його нащадків
@Catch(HttpException)
export class CustomHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // Логіка обробки помилки
  }
}
```

#### Крок 2. Робота з ArgumentsHost (Обробка запиту та відповіді)

Метод `catch()` приймає сам об'єкт винятку (`exception`) та `ArgumentsHost`. `ArgumentsHost` — це потужний об'єкт, який дозволяє отримати доступ до нативних об'єктів запиту та відповіді (Express або Fastify), незалежно від того, в якому контексті виникла помилка.

#### Крок 3. Приклад: Створення фільтра з розширеною інформацією

Напишемо фільтр, який модифікує стандартну помилку NestJS, додаючи точний час виникнення помилки та URL-шлях, за яким до нас звернулися.

```ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>(); // Отримуємо об'єкт відповіді Express
    const request = ctx.getRequest<Request>();    // Отримуємо об'єкт запиту Express
    
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse(); // Стандартне повідомлення помилки

    // Формуємо наш власний (кастомний) формат відповіді
    response
      .status(status)
      .json({
        success: false,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        // Якщо повідомлення є об'єктом (стандартна поведінка Nest), розгортаємо його, інакше виводимо як рядок
        errorDetails: typeof exceptionResponse === 'object' ? exceptionResponse : { message: exceptionResponse },
      });
  }
}
```

### Застосування Filters на практиці

Фільтри, як і інші архітектурні елементи NestJS, можуть застосовуватися на різних рівнях за допомогою декоратора `@UseFilters()`.

#### 1. На рівні методу (маршруту)

Застосовується лише до одного конкретного ендпоінту.

```ts
import { Controller, Get, UseFilters, ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

@Controller('items')
export class ItemsController {
  
  @Get()
  @UseFilters(HttpExceptionFilter) // Застосовуємо наш фільтр
  findAll() {
    // Штучно генеруємо помилку для перевірки роботи фільтра
    throw new ForbiddenException('У вас немає доступу до цього ресурсу');
  }
}
```

#### 2. На рівні контролера

Всі маршрути всередині контролера будуть оброблятися цим фільтром.

```ts
@UseFilters(HttpExceptionFilter)
@Controller('users')
export class UsersController {
  // ...
}
```

#### 3. На глобальному рівні

Найчастіший сценарій використання. Застосовується до всіх маршрутів додатку, реєструється у `main.ts`.

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Реєструємо фільтр глобально
  app.useGlobalFilters(new HttpExceptionFilter());
  
  await app.listen(3000);
}
bootstrap();
```

*Примітка: Як і у випадку з Guards, якщо глобальний фільтр потребує ін'єкції залежностей (наприклад, сервіс для логування в базу даних), його слід реєструвати через кастомний провайдер у `AppModule` за допомогою токена `APP_FILTER`.*