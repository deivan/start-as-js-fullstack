## Тема: Використання Guards (Охоронців)

### Призначення та сфера використання Guards

У NestJS **Guards (Охоронці)** мають одну-єдину, але критично важливу мету: вони визначають, чи буде даний запит оброблений маршрутизатором (контролером), чи його буде відхилено. Вони повертають логічне значення (`true` або `false`).

На відміну від Middleware, які просто передають запит далі (викликаючи `next()`) і не знають, який саме метод буде виконуватися, Guards мають доступ до об'єкта `ExecutionContext`. Вони точно знають, який контролер і який метод буде викликано, що робить їх ідеальним інструментом для комплексної перевірки прав доступу.

**Основні сфери використання:**
1.  **Аутентифікація (Authentication):** Перевірка, чи є користувач авторизованим у системі (наприклад, чи передав він валідний JWT токен у заголовку).
2.  **Авторизація та Рольова модель (Authorization / RBAC):** Перевірка, чи має авторизований користувач відповідні права або роль для виконання конкретної дії (наприклад, чи є він `ADMIN`, щоб видалити користувача).
3.  **Перевірка API ключів:** Захист певних ендпоінтів від несанкціонованого доступу з боку сторонніх сервісів.

### Кроки створення кастомного Guard

Створення Guard складається з реалізації інтерфейсу `CanActivate`, який вимагає наявності методу `canActivate()`.

#### Крок 1. Базова структура класу

Згенерувати базовий файл можна через CLI (`nest g guard auth`), або створити власноруч. Клас має бути позначений декоратором `@Injectable()`.

```ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Логіка перевірки буде тут
    return true; 
  }
}
```

#### Крок 2. Отримання даних із запиту (ExecutionContext)

`ExecutionContext` містить всю інформацію про поточний запит. Щоб отримати об'єкт HTTP-запиту (якщо ми працюємо з REST API), ми використовуємо метод `switchToHttp()`.

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Отримуємо об'єкт HTTP запиту
    const request = context.switchToHttp().getRequest();
    
    // Витягуємо певний заголовок, наприклад 'x-api-key'
    const apiKey = request.headers['x-api-key'];

    // Крок 3. Логіка перевірки
    // Перевіряємо, чи збігається ключ із секретним (для прикладу захардкоджений)
    if (apiKey !== 'secret-key-123') {
      // Якщо ні — викидаємо помилку (NestJS автоматично поверне 403 Forbidden або 401)
      throw new UnauthorizedException('Доступ заборонено: недійсний API ключ');
    }

    // Якщо все добре, дозволяємо доступ до маршруту
    return true;
  }
}
```

### Застосування Guard на практиці

Як і пайпи, Guards можуть бути застосовані на трьох рівнях: глобально, на рівні контролера та на рівні конкретного методу. Для застосування використовується декоратор `@UseGuards()`.

#### 1. Рівень методу (маршруту)

Захищає лише один конкретний ендпоінт.

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

@Controller('data')
export class DataController {
  
  @Get('public')
  getPublicData() {
    return 'Це публічні дані, доступні всім';
  }

  @UseGuards(ApiKeyGuard) // Застосовуємо Guard
  @Get('private')
  getPrivateData() {
    return 'Це секретні дані, доступні лише з валідним API ключем';
  }
}
```

#### 2. Рівень контролера

Захищає всі маршрути всередині контролера.

```ts
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

@UseGuards(ApiKeyGuard) // Всі методи нижче захищені
@Controller('admin')
export class AdminController {
  
  @Get('dashboard')
  getDashboard() { /* ... */ }

  @Post('settings')
  updateSettings() { /* ... */ }
}
```

#### 3. Глобальний рівень

Застосовується до абсолютно всіх маршрутів у додатку. Реєструється у файлі `main.ts`.

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiKeyGuard } from './api-key.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Глобальне застосування Guard
  // Увага: у такому випадку Guard не може використовувати Dependency Injection
  app.useGlobalGuards(new ApiKeyGuard()); 
  
  await app.listen(3000);
}
bootstrap();
```

*Примітка: Якщо глобальний Guard потребує ін'єкції залежностей (наприклад, звернення до бази даних через сервіс), його слід реєструвати через кастомний провайдер у масиві `providers` головного модуля `AppModule` за допомогою токена `APP_GUARD`.*