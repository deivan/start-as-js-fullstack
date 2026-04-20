## Робота з ORM Prisma у Nest.js

### 1. Несумісність зі структурою TypeORM (Schema-First vs Code-First)

На відміну від TypeORM, який використовує підхід Code-First (де ми описуємо таблиці за допомогою TypeScript-класів та декораторів `@Entity`, `@Column`), Prisma використовує підхід **Schema-First**. 

Це означає фундаментальну архітектурну відмінність: у Prisma ви не розкидаєте моделі бази даних по різних файлах `.entity.ts` у кожному модулі. Натомість **уся структура бази даних централізовано описується в одному спеціальному файлі — `schema.prisma`**. Prisma самостійно генерує TypeScript-типи на основі цього файлу, що забезпечує ідеальну строгу типізацію без дублювання коду.

### 2. Інсталяція, ініціалізація та плагін для VS Code

Для початку роботи необхідно встановити саму Prisma (як інструмент розробки) та клієнт для роботи з нею в коді:

```bash
npm install prisma --save-dev
npm install @prisma/client
```

Далі ініціалізуємо Prisma в проєкті:
```bash
npx prisma init
```
Ця команда створює папку `prisma` з файлом `schema.prisma` та додає файл `.env` для збереження URL-адреси бази даних.

**💡 Важлива рекомендація:** Обов'язково встановіть офіційний плагін **Prisma** для редактора **VS Code**. Оскільки файл `.prisma` має власний синтаксис, плагін забезпечить підсвічування коду, автодоповнення (IntelliSense), автоматичне форматування (при збереженні) та перевірку помилок, що критично важливо для правильної побудови зв'язків.

### 3. Опис файлу schema.prisma

Файл `schema.prisma` складається з трьох основних частин:
1.  **Генератор (`generator`)**: Вказує, якою мовою генерувати клієнт (зазвичай це `prisma-client-js`).
2.  **Джерело даних (`datasource`)**: Вказує тип бази даних (PostgreSQL, MySQL, SQLite) та посилання на неї.
3.  **Моделі (`model`)**: Опис самих таблиць.

Приклад базового файлу:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // Береться з файлу .env
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?  // Значення може бути null
  createdAt DateTime @default(now())
}
```

### 4. Інтеграція до Nest.js (Створення Prisma Module/Service)

Щоб використовувати `PrismaClient` у NestJS, його потрібно загорнути у сервіс та зробити доступним для ін'єкції. Ви можете згенерувати ресурс або модуль/сервіс вручну, або за допомогою Nest CLI:

```bash
nest g module prisma
nest g service prisma
```
*(Примітка: команда `nest g res prisma` створить повний CRUD-ресурс, але для базового підключення достатньо модуля та сервісу, який ми зробимо глобальним).*

**Приклад `prisma.service.ts`:**
```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect(); // Підключення до БД при старті додатку
  }

  async onModuleDestroy() {
    await this.$disconnect(); // Відключення при зупинці
  }
}
```
Після цього `PrismaService` експортується з `PrismaModule` (бажано зробити його `@Global()`), і ви можете інжектувати його в будь-який інший сервіс (наприклад, `UsersService`).

### 5. Команда `prisma db push` та її важливість

На етапі активної розробки та прототипування постійно створювати файли міграцій незручно. Для швидкої синхронізації схеми з реальною базою даних використовується команда:

```bash
npx prisma db push
```
**Що вона робить:**
1. Аналізує ваш `schema.prisma`.
2. Напряму змінює структуру бази даних (створює таблиці, додає колонки), щоб вона відповідала схемі.
3. Автоматично генерує (оновлює) TypeScript-клієнт `PrismaClient` (під капотом запускає `prisma generate`).
*Важливо: На продакшені (production) слід використовувати повноцінні міграції (`npx prisma migrate dev` / `deploy`), але для локальної розробки `db push` — це найшвидший інструмент.*

### 6. Опціональний інструмент Prisma Studio

Prisma має вбудований графічний інтерфейс (GUI) для перегляду та редагування даних у вашій базі — **Prisma Studio**.
Запуск:
```bash
npx prisma studio
```
Вона відкриється у браузері (зазвичай на `localhost:5555`) і дозволить зручно додавати, видаляти, фільтрувати дані та переходити по зв'язках між таблицями без необхідності писати SQL-запити або використовувати сторонні програми (як DBeaver чи pgAdmin).

### 7. Побудова зв'язків між таблицями (Relations)

Prisma робить створення зв'язків надзвичайно простим. Плагін для VS Code може навіть дописувати частину коду за вас, щойно ви зберігаєте файл.

**1. Один до одного (One-to-One)**
Наприклад, Користувач має один Профіль.
```prisma
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  profile Profile? // Зв'язок
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  userId Int    @unique // Ключове поле для 1:1
  user   User   @relation(fields: [userId], references: [id]) // Опис зв'язку
}
```

**2. Один до багатьох (One-to-Many)**
Наприклад, Користувач може мати багато Постів.
```prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[] // Зв'язок (масив постів)
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int    // Зовнішній ключ
  author   User   @relation(fields: [authorId], references: [id])
}
```

**3. Багато до багатьох (Many-to-Many)**
Наприклад, Пости та Категорії. Prisma підтримує "неявні" (implicit) зв'язки багато-до-багатьох, де вона самостійно створює проміжну таблицю в БД під капотом!
```prisma
model Post {
  id         Int        @id @default(autoincrement())
  title      String
  categories Category[] // Просто вказуємо масив
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[] // Просто вказуємо масив
}
```

### 8. Робота з індексами (Одиночні та Складені)

Індекси необхідні для прискорення пошуку даних у базі.

**Одиночні індекси:**
Застосовуються до одного поля. Можуть бути унікальними (`@unique`) або звичайними (`@@index`).
```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique // Створює унікальний індекс для швидкого пошуку по email
  name  String

  // Звичайний одиночний індекс (для швидкого пошуку/сортування за іменем)
  @@index([name]) 
}
```

**Складені індекси (Composite Indexes):**
Застосовуються, коли ми часто робимо пошук одразу за двома або більше полями разом. Також можуть бути унікальними (комбінація полів має бути унікальною).
```prisma
model Article {
  id        Int    @id @default(autoincrement())
  title     String
  authorId  Int
  status    String

  // Складений унікальний індекс (автор не може мати дві статті з однаковою назвою)
  @@unique([authorId, title])

  // Звичайний складений індекс (прискорює пошук за автором ТА статусом одночасно)
  @@index([authorId, status])
}
```

### 9. Специфіка роботи з Prisma за офіційною документацією Nest.js (Recipes)

Офіційна документація Nest.js у розділі "Recipes" (рецепти) пропонує конкретний архітектурний патерн для роботи з Prisma. Головна ідея цього підходу полягає у **максимальному використанні автозгенерованих типів Prisma** для забезпечення строгої типізації на рівні сервісів.

#### Використання простору імен `Prisma`

Коли ви виконуєте `prisma generate`, створюються не лише типи моделей (як-от `User`), а й глибоко типізовані інтерфейси для аргументів методів: `Prisma.UserCreateInput`, `Prisma.UserWhereUniqueInput`, `Prisma.UserUpdateInput` тощо. Документація рекомендує використовувати саме їх у сервісах замість ручного створення дублюючих інтерфейсів.

#### Ізольовані сервіси для моделей (Приклад UserService)

Замість того, щоб викликати методи `PrismaService` напряму з контролерів, створюються окремі сервіси-обгортки для кожної моделі бази даних. Вони інкапсулюють CRUD-логіку.

**Приклад створення `user.service.ts` (згідно з рецептом Nest.js):**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Отримання одного користувача за унікальним полем (наприклад, id або email)
  async user(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: userWhereUniqueInput,
    });
  }

  // Отримання списку користувачів з підтримкою фільтрації, сортування та пагінації
  async users(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  // Створення нового запису
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  // Оновлення запису (вимагає вказати КОГО оновлюємо і ЯКІ ДАНІ записуємо)
  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
    });
  }

  // Видалення запису
  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
      where,
    });
  }
}
```

#### Використання в Контролері

Після налаштування такого сервісу, контролер стає дуже "тонким". Він просто приймає HTTP-запит (використовуючи DTO для валідації) і передає дані у відповідний метод сервісу.

**Приклад використання у `app.controller.ts`:**

```ts
import { Controller, Get, Param, Post, Body, Put, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { User as UserModel } from '@prisma/client';

@Controller('users')
export class AppController {
  constructor(private readonly userService: UserService) {}

  // Створення користувача
  @Post()
  async signupUser(
    // В реальному проєкті тут має бути CreateUserDto з валідацією
    @Body() userData: { name?: string; email: string },
  ): Promise<UserModel> {
    return this.userService.createUser(userData);
  }

  // Отримання користувача за ID
  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<UserModel> {
    // Важливо: перетворюємо рядок з URL у число (або використовуємо ParseIntPipe)
    return this.userService.user({ id: Number(id) });
  }

  // Отримання списку (приклад з простим фільтром)
  @Get('search/:searchString')
  async getFilteredUsers(
    @Param('searchString') searchString: string,
  ): Promise<UserModel[]> {
    return this.userService.users({
      where: {
        OR: [
          { name: { contains: searchString } },
          { email: { contains: searchString } },
        ],
      },
    });
  }
}
```
**Чому цей підхід ефективний:** Завдяки імпорту типів `Prisma.UserWhereInput` тощо, TypeScript автоматично підкаже вам усі доступні поля та оператори (`contains`, `OR`, `AND`) прямо під час написання коду в контролері чи сервісі.

### 10. Робота з міграціями в Prisma ORM (`Prisma Migrate`)

На етапі прототипування команди `prisma db push` зазвичай достатньо. Однак, для стабільних проєктів (production) та командної розробки необхідно використовувати систему міграцій. **Prisma Migrate** автоматично генерує SQL-файли (історію змін) на основі ваших дій у файлі `schema.prisma`. 

Основна команда для локального створення міграції:
```bash
npx prisma migrate dev --name <опис_міграції>
```
*Для застосування міграцій на production сервері використовується команда `npx prisma migrate deploy` (вона лише виконує готові SQL-файли, не змінюючи код клієнта).*

Розглянемо специфіку роботи на конкретних прикладах:

#### Приклад 1: Додавання нового стовпця

Якщо ви додаєте нове поле до таблиці, де вже є дані, це поле має бути або **необов'язковим** (з `?`), або мати **значення за замовчуванням** (з `@default`), інакше база даних не знатиме, що записати в існуючі рядки, і міграція впаде з помилкою.

*Зміна у `schema.prisma`:*
```prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String
  
  // ДОДАЄМО НОВІ ПОЛЯ:
  phoneNumber String?           // Необов'язкове поле (дозволяє NULL)
  isActive    Boolean @default(true) // Обов'язкове, але має значення за замовчуванням
}
```
*Виконання:* Запускаємо `npx prisma migrate dev --name add_phone_and_status`. Prisma згенерує папку з файлом `migration.sql`, який міститиме команди `ALTER TABLE "User" ADD COLUMN...`, застосує їх до БД та оновить TypeScript клієнт.

#### Приклад 2: Видалення стовпця

Видалення поля — це деструктивна операція. Prisma розумна і попередить вас про можливу втрату даних перед тим, як виконати міграцію.

*Зміна у `schema.prisma`:*
Ми просто видаляємо рядок `phoneNumber String?` з моделі `User`.

*Виконання:*
Запускаємо `npx prisma migrate dev --name remove_phone_number`. 
У терміналі Prisma видасть попередження (Warning): 
`⚠️ We found changes that cannot be executed: You are about to drop the column 'phoneNumber' on the 'User' table, which still contains x non-null values.`
Вам потрібно буде підтвердити операцію, натиснувши `y` (yes). Після цього Prisma виконає `ALTER TABLE "User" DROP COLUMN "phoneNumber";`.

#### Приклад 3: Зміна формату даних (Типу колонки)

Зміна типу даних є найскладнішою операцією, оскільки база даних повинна "сконвертувати" існуючі дані.

Припустимо, ми маємо поле `status String` (де зберігали "ACTIVE", "BANNED") і хочемо перевести його на більш суворий формат — `Enum`.

*Крок 1. Створюємо Enum та змінюємо тип у `schema.prisma`:*
```prisma
// Було:
// status String

// Стало:
enum UserStatus {
  ACTIVE
  BANNED
}

model User {
  id     Int        @id @default(autoincrement())
  email  String     @unique
  status UserStatus @default(ACTIVE) // Змінили тип на Enum
}
```

*Крок 2. Виконання та кастомна SQL-міграція:*
Якщо ви запустите `npx prisma migrate dev --name change_status_to_enum`, база даних PostgreSQL може відмовитися автоматично конвертувати тип `text` у новий тип `enum`. Prisma попередить, що стовпець `status` буде видалено і створено заново (що призведе до втрати статусів у існуючих користувачів).

Щоб зберегти дані, ми можемо перехопити міграцію до її виконання:
1. Запускаємо команду з прапорцем `--create-only` (створити міграцію, але не застосовувати її):
   `npx prisma migrate dev --name change_status_to_enum --create-only`
2. Prisma створить файл `migration.sql`. Ми відкриваємо його і вручну дописуємо SQL-команду для конвертації (кастинг типів):
   ```sql
   -- Створюємо тип Enum
   CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED');
   
   -- Змінюємо тип колонки із застосуванням конвертації існуючих даних
   ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus" USING ("status"::text::"UserStatus");
   ```
3. Зберігаємо файл і застосовуємо міграцію:
   `npx prisma migrate dev`
   