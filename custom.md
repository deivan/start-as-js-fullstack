## Тема: Створення кастомних декораторів

### Призначення та найчастіша сфера використання

У NestJS вже є чудовий набір вбудованих параметричних декораторів (`@Body()`, `@Query()`, `@Param()`, `@Req()` тощо). Проте, коли виникає потреба регулярно витягувати специфічні дані з об'єкта запиту, використання стандартного `@Req()` стає незручним. Воно засмічує код і порушує типізацію.

Для вирішення цієї проблеми NestJS дозволяє створювати **кастомні параметричні декоратори**. 

**Найчастіша сфера використання:**
Найпопулярніший сценарій — це витягування об'єкта поточного авторизованого користувача. Після проходження `AuthGuard`, дані про користувача (наприклад, розшифрований JWT токен) зазвичай записуються в об'єкт запиту: `request.user`. Замість того, щоб у кожному контролері писати `req.user`, створюється зручний декоратор `@CurrentUser()` або `@User()`.

### Кроки створення кастомного параметричного декоратора

Для створення такого декоратора використовується вбудована функція `createParamDecorator`.

#### Крок 1. Імпорт та базова структура

Створюємо окремий файл (наприклад, `user.decorator.ts`). Функція `createParamDecorator` приймає колбек (factory function), який має два аргументи: `data` та `context` (той самий `ExecutionContext`, що і в Guards та Interceptors).

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // Логіка витягування даних
  },
);
```

#### Крок 2. Реалізація логіки витягування (Приклад @CurrentUser)

Реалізуємо логіку, яка дістає об'єкт запиту, бере з нього властивість `user` і повертає її. Також додамо можливість витягувати не всього користувача, а лише конкретне поле (наприклад, тільки `email` або `id`), використовуючи аргумент `data`.

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    // 1. Отримуємо об'єкт HTTP запиту
    const request = ctx.switchToHttp().getRequest();
    
    // 2. Дістаємо користувача (якого туди поклав AuthGuard або Middleware)
    const user = request.user;

    // 3. Якщо користувача немає (маршрут не захищений), повертаємо null
    if (!user) {
      return null;
    }

    // 4. Якщо в декоратор передали аргумент (наприклад, @CurrentUser('email'))
    // повертаємо лише це поле. Якщо аргументу немає — повертаємо всього користувача.
    return data ? user[data] : user;
  },
);
```

#### Крок 3. Використання кастомного декоратора в Контролері

Тепер ми можемо використовувати наш новий декоратор у будь-якому контролері, роблячи код значно чистішим і зрозумілішим (декларативним).

**Порівняння:**

*Як би це виглядало без кастомного декоратора:*
```ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';

@UseGuards(AuthGuard)
@Controller('profile')
export class ProfileController {
  
  @Get()
  getProfile(@Req() request: Request) {
    // Доводиться вручну діставати user з об'єкта request
    const user = request.user; 
    return `Вітаю, ${user.email}! Ваш ID: ${user.id}`;
  }
}
```

*Як це виглядає з нашим кастомним декоратором `@CurrentUser`:*

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './user.decorator';

@UseGuards(AuthGuard)
@Controller('profile')
export class ProfileController {
  
  // Приклад 1: Отримуємо весь об'єкт користувача
  @Get()
  getProfile(@CurrentUser() user: any) {
    return `Вітаю, ${user.email}! Ваш ID: ${user.id}`;
  }

  // Приклад 2: Отримуємо лише конкретне поле за допомогою аргументу data
  @Get('email')
  getUserEmail(@CurrentUser('email') userEmail: string) {
    return `Ваша електронна адреса: ${userEmail}`;
  }
}
```

### Інший тип кастомних декораторів: Метадані (@SetMetadata)
 
Окрім параметричних декораторів (які використовуються в аргументах методів), у NestJS часто створюють кастомні декоратори для присвоєння метаданих маршрутам. Це робиться за допомогою вбудованого декоратора `@SetMetadata`.

Найчастіший приклад — декоратор `@Roles()`, який використовується в парі з `RolesGuard` для визначення, які ролі мають доступ до конкретного ендпоінту.

```ts
import { SetMetadata } from '@nestjs/common';

// Створюємо кастомний декоратор @Roles()
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

Використання в контролері:
```ts
@Get('admin-panel')
@Roles('admin', 'super-admin') // Наш кастомний декоратор
@UseGuards(AuthGuard, RolesGuard)
getAdminData() {
  return 'Дані для адміністраторів';
}
```