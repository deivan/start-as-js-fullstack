## Тема: Робота з декоратором Controller

### Розширені можливості декоратора @Controller

Зазвичай декоратор `@Controller()` приймає простий рядок, який визначає базовий префікс маршруту (наприклад, `@Controller('users')`). Однак він також може приймати об'єкт конфігурації (інтерфейс `ControllerOptions`), який надає додаткові розширені можливості маршрутизації:

**1. Маршрутизація за хостом (Sub-Domain Routing)**

Параметр `host` дозволяє обмежити доступ до контролера певним хостом (наприклад, піддоменом). Якщо запит надходить на інший хост, контролер його проігнорує.

```ts
import { Controller, Get } from '@nestjs/common';

// Цей контролер оброблятиме запити лише з піддомену admin
@Controller({ host: 'admin.example.com', path: 'dashboard' })
export class AdminDashboardController {
  @Get()
  getAdminData() {
    return 'This is strictly for admin subdomain';
  }
}
```

**2. Версіонування API (API Versioning)**

Параметр `version` дозволяє вказати версію API безпосередньо для всього контролера (наприклад, `/v1/users` або `/v2/users`). *Важливо: для роботи цієї функції необхідно попередньо увімкнути версіонування глобально у файлі `main.ts` через `app.enableVersioning()`.*

```ts
import { Controller, Get, Version } from '@nestjs/common';

@Controller({ path: 'products', version: '1' })
export class ProductsControllerV1 {
  @Get()
  getProducts() {
    return 'Products from API v1';
  }
}
```

### Додаткові декоратори для параметрів запиту

NestJS надає абстракцію над базовою платформою (Express або Fastify), дозволяючи отримувати дані з HTTP-запиту за допомогою зручних декораторів. Окрім стандартних `@Body()`, `@Param()` та `@Query()`, існують специфічні декоратори для детального доступу до метаданих запиту.

Приклад використання додаткових декораторів:

```ts
import { Controller, Get, Req, Res, Ip, Headers, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('info')
export class InfoController {
  
  @Get('client')
  getClientInfo(
    @Ip() userIp: string,
    @Headers('user-agent') userAgent: string,
    @Headers() allHeaders: any,
  ) {
    return {
      ip: userIp,
      browser: userAgent,
      headers: allHeaders
    };
  }

  @Get('native')
  getNativeRequestParams(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    // Взаємодія безпосередньо з об'єктом Express
    const url = request.originalUrl;
    
    // Ручне формування відповіді
    response.status(HttpStatus.OK).json({
      message: 'Native response handling',
      path: url
    });
  }
}
```

#### Детальний опис декораторів:

*   **`@Ip()`**
    Витягує IP-адресу клієнта, який надіслав запит. Це вкрай корисно для реалізації механізмів логування, аналітики або обмеження кількості запитів (Rate Limiting), щоб захистити сервер від DDoS-атак.

*   **`@Headers(property?: string)`**
    Дозволяє отримати доступ до HTTP-заголовків. 
    * Якщо викликати без аргументів (`@Headers()`), поверне об'єкт з усіма переданими заголовками.
    * Якщо передати рядок (наприклад, `@Headers('authorization')`), поверне значення лише одного конкретного заголовка.

*   **`@Req()` (або `@Request()`)**
    Надає прямий доступ до оригінального об'єкта запиту базової платформи (наприклад, `Request` з Express). Використовується, коли необхідно отримати специфічні дані або методи, які не покриваються стандартними декораторами NestJS. 
    * *Застереження:* Використання `@Req()` прив'язує ваш код до конкретної платформи (Express), що робить його менш гнучким, якщо ви вирішите перейти на Fastify, а також ускладнює написання юніт-тестів.

*   **`@Res()` (або `@Response()`)**
    Надає доступ до оригінального об'єкта відповіді (`Response` з Express). Дозволяє вручну керувати відповіддю, наприклад, встановлювати специфічні заголовки, статуси або відправляти файли (`res.download()`).
    * *Критичне застереження:* Щойно ви інжектуєте `@Res()` у метод, NestJS перемикається в режим "ручного керування" для цього маршруту. Це означає, що стандартний механізм повернення (`return value`) перестане працювати, і ви будете зобов'язані самостійно завершити цикл запиту (наприклад, викликавши `res.send()`). Щоб зберегти можливості NestJS (наприклад, інтерцептори), але при цьому мати доступ до об'єкта `Response`, необхідно використовувати параметр `passthrough`: `@Res({ passthrough: true })`.
    