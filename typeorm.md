## Тема: Використання TypeORM в Nest.js

### 1. Важливість проектування моделей

Проектування бази даних (БД) — це фундамент будь-якого бекенд-додатку. Від того, наскільки правильно побудовані моделі (сутності), залежить продуктивність, масштабованість та зручність підтримки коду. Помилки на етапі проектування (наприклад, неправильно обрані типи зв'язків або відсутність індексів) виправляти найважче, оскільки це вимагає складних міграцій та зміни бізнес-логіки. TypeORM використовує підхід Code-First: ми спочатку описуємо класи (моделі) в TypeScript, а TypeORM самостійно будує відповідні таблиці в базі даних.

### 2. Використання контейнеру Docker для роботи з базою PostgreSQL

Для локальної розробки найкращою практикою є використання Docker. Це дозволяє не засмічувати операційну систему встановленням самої БД і гарантує, що у всіх розробників у команді база працюватиме однаково.

Створюємо файл `docker-compose.yml` у корені проєкту:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: nest_postgres
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nest_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```
*Запуск бази виконується командою:* `docker-compose up -d`.

### 3. Інтеграція TypeORM до Nest.js та створення конфігурації

Спочатку необхідно встановити пакети:
```bash
npm install @nestjs/typeorm typeorm pg
```

Далі, у кореневому модулі (`AppModule`) підключаємо базу даних за допомогою `TypeOrmModule.forRoot()`.

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'root',
      password: 'password',
      database: 'nest_db',
      autoLoadEntities: true, // Автоматично завантажує сутності
      synchronize: true, // УВАГА: Тільки для розробки! Автоматично створює таблиці.
    }),
    ProductsModule,
  ],
})
export class AppModule {}
```

### 3.1. Domain-Driven (Feature-based) структура

NestJS наполегливо рекомендує відмовитися від класичної структури за типами файлів (коли всі контролери додатку лежать в одній папці `controllers`, всі моделі — в `models` тощо). Натомість використовується **модульна структура за предметною областю (Feature-based)**.

Це означає, що весь код, який стосується однієї бізнес-сутності (наприклад, `Users` або `Products`), повинен знаходитися у власній ізольованій папці. TypeORM сутності (Entities) ідеально вписуються в цей підхід.

### 3.1.1. Структура папки сутності (Feature Folder)

Усередині папки конкретного модуля (наприклад, `src/users/`) файли групуються так, щоб забезпечити максимальну ізоляцію:

* **`users.module.ts`**: Головний файл модуля. Тут ми імпортуємо TypeORM репозиторій через `TypeOrmModule.forFeature([User])`.
* **`users.controller.ts`**: Обробка HTTP-запитів. Жодного прямого звернення до бази даних тут не повинно бути.
* **`users.service.ts`**: Бізнес-логіка. Саме сюди інжектується TypeORM `Repository<User>` і тут пишуться запити до бази.
* **`user.entity.ts`**: Файл TypeORM моделі (опис таблиці). Називається в однині, оскільки описує один запис у базі.
* **`dto/`**: Окрема папка для Data Transfer Objects.
    * **Важливе правило:** Ніколи не використовуйте TypeORM Entity напряму для отримання даних від клієнта (в `@Body()`). Entity призначена лише для зв'язку з базою, а DTO — для валідації HTTP-запитів.

### 3.2. Структура для конфігурації бази та міграцій
Код, що відповідає за підключення до бази даних та міграції, зазвичай виноситься в окрему папку `database` або `config` на рівні `src/`.

* **`data-source.ts`** (для TypeORM v0.3+): Спеціальний файл конфігурації, який використовується CLI TypeORM для генерації та запуску міграцій.
* **`migrations/`**: Папка, куди TypeORM буде автоматично генерувати SQL-файли міграцій.

### 3.2.1. Наочний приклад ідеального дерева директорій

```text
src/
├── app.module.ts            # Кореневий модуль (тут TypeOrmModule.forRoot)
├── main.ts                  # Точка входу
│
├── config/                  # Глобальні налаштування
│   └── database.config.ts   # Конфігурація підключення (з .env)
│
├── database/                # Все, що стосується структури БД
│   ├── data-source.ts       # Конфіг TypeORM для роботи з міграціями
│   └── migrations/          # Згенеровані файли міграцій
│       ├── 1691234567-CreateUsersTable.ts
│       └── 1691234589-AddRoleColumnToUsers.ts
│
├── users/                   # Модуль користувачів (Feature)
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── user.entity.ts       # Опис таблиці 'users'
│   ├── enums/
│   │   └── user-role.enum.ts# Переліки, що використовуються в Entity
│   └── dto/
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
│
└── products/                # Модуль продуктів (Feature)
    ├── products.module.ts
    ├── products.controller.ts
    ├── products.service.ts
    ├── product.entity.ts    # Опис таблиці 'products'
    └── dto/
        └── create-product.dto.ts
```

### 3.3. Ключові архітектурні правила:

1.  **Розділення відповідальності (Separation of Concerns):** DTO захищають вхідні дані, Контролер обробляє маршрутизацію, Сервіс містить логіку, Entity описує базу даних. Не змішуйте їхні ролі.
2.  **Ізоляція зв'язків (Relations):** Якщо `Product` має зв'язок `ManyToOne` з `User`, ви імпортуєте `user.entity.ts` у `product.entity.ts`. Але якщо вам потрібно виконати складний запит, що зачіпає обидві таблиці, ви імпортуєте `UsersModule` у `ProductsModule` і використовуєте `UsersService`, замість того, щоб напряму смикати репозиторій користувачів із сервісу продуктів.
3.  **Зберігання міграцій:** Папка `migrations` має бути частиною системи контролю версій (Git). Усі розробники команди повиннІ мати однакову історію мíграцíй для консистентностІ бази даних.


### 4. Декоратори таблиць, колонок та створення зв'язків (Relations)

TypeORM використовує декоратори для того, щоб перетворити звичайні TypeScript-класи на таблиці бази даних, а їхні властивості — на колонки з відповідними типами даних та обмеженнями.

#### 4.1. Декоратор таблиці: `@Entity()`

Вказує TypeORM, що цей клас є сутністю бази даних.
* За замовчуванням TypeORM створить таблицю з іменем класу (наприклад, `user`).
* Найкращою практикою є явне задання імені таблиці в множині (наприклад, `users`), передавши його рядком у декоратор: `@Entity('users')`.

#### 4.2. Декоратори первинного ключа (Primary Key)

Кожна таблиця зобов'язана мати первинний ключ.
* `@PrimaryGeneratedColumn()` — створює автоінкрементний ідентифікатор (1, 2, 3...).
* `@PrimaryGeneratedColumn('uuid')` — створює унікальний рядок (UUID v4), що є набагато безпечнішим та масштабованішим рішенням для сучасних систем.

#### 4.3. Основний декоратор колонок: `@Column()`

Найбільш гнучкий декоратор, який приймає об'єкт налаштувань.
Основні параметри:
* `type`: Тип даних у БД (`'varchar'`, `'text'`, `'int'`, `'boolean'`, `'decimal'`, `'jsonb'` тощо).
* `length`: Максимальна довжина рядка (наприклад, `length: 100`).
* `nullable`: Якщо `true`, дозволяє колонці мати значення `NULL` (за замовчуванням `false`).
* `default`: Значення за замовчуванням (наприклад, `default: false` або `default: 'user'`).
* `unique`: Якщо `true`, гарантує, що значення в цій колонці не повторюватиметься в інших записах бази (ідеально для `email`).
* `select`: Якщо `false`, TypeORM не буде повертати це поле при звичайних запитах `find` (ідеально для приховування паролів).
* `name`: Дозволяє назвати колонку в базі інакше, ніж властивість у класі (наприклад, властивість `firstName`, а в базі `first_name`).

#### 4.4. Декоратори дати (Спеціальні колонки)

* `@CreateDateColumn()` — автоматично записує точний час створення запису.
* `@UpdateDateColumn()` — автоматично оновлюється при кожній зміні (оновленні) запису.

#### 💡 Комплексний приклад сутності User:
```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  firstName: string;

  @Column({ type: 'varchar', length: 50, nullable: true }) // Прізвище не є обов'язковим
  lastName: string;

  @Column({ type: 'varchar', unique: true }) // Email має бути унікальним
  email: string;

  @Column({ type: 'varchar', select: false }) // Пароль ніколи не повертається автоматично
  passwordHash: string;

  @Column({ type: 'boolean', default: false }) // Користувач не активний після реєстрації
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  loginAttempts: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
```

---

Робота з даними в TypeORM відбувається через патерн **Repository (Репозиторій)**. Ми інжектуємо репозиторій конкретної сутності в наш сервіс.

#### 4.5. Створення даних (Create & Save)

Процес додавання нового запису до бази завжди складається з двох етапів:
1.  **`create(dto)`**: Створює екземпляр сутності (об'єкт TypeScript) у пам'яті. На цьому етапі **НЕ** відбувається запит до бази даних. Це дозволяє TypeORM застосувати значення за замовчуванням та підготувати об'єкт.
2.  **`save(entity)`**: Бере створений об'єкт і виконує SQL-запит `INSERT` до бази даних. Повертає збережений об'єкт вже зі згенерованим `id` та датами.

**Приклад створення:**
```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: any): Promise<User> {
    // 1. Створюємо інстанс сутності (запит до БД не йде)
    const newUser = this.userRepository.create({
      firstName: createUserDto.firstName,
      email: createUserDto.email,
      passwordHash: createUserDto.password, // У реальному проєкті пароль вже має бути захешованим
    });

    // 2. Зберігаємо в базу (виконується INSERT)
    return await this.userRepository.save(newUser);
  }
}
```

#### 4.6. Отримання даних: Метод `find()`

Використовується для отримання масиву записів. Приймає об'єкт опцій для фільтрації, вибору певних колонок або сортування.

**Приклад отримання списку з фільтрацією:**
```ts
async getActiveUsers(): Promise<User[]> {
  return await this.userRepository.find({
    // Умова пошуку
    where: { isActive: true }, 
    
    // Вказуємо, які саме колонки хочемо отримати (оптимізація запиту)
    select: ['id', 'firstName', 'email', 'createdAt'], 
    
    // Сортування (DESC - за спаданням, ASC - за зростанням)
    order: { createdAt: 'DESC' }, 
  });
}
```

*Примітка: Якщо в `where` передати масив об'єктів, TypeORM сприйме це як логічне **АБО (OR)**. Наприклад: `where: [{ firstName: 'Ivan' }, { isActive: true }]` знайде всіх Іванів АБО всіх активних користувачів.*

#### 4.7. Отримання одного запису: Метод `findOne()`

Використовується, коли ми очікуємо знайти лише один конкретний запис (найчастіше за `id` або `email`).

**Приклад пошуку та обробки помилки:**
```ts
import { NotFoundException } from '@nestjs/common';

async getUserById(id: string): Promise<User> {
  const user = await this.userRepository.findOne({
    where: { id: id }
  });

  // TypeORM повертає null, якщо запис не знайдено. 
  // У NestJS ми маємо викинути відповідну помилку.
  if (!user) {
    throw new NotFoundException(`Користувача з ID ${id} не знайдено`);
  }

  return user;
}
```

**Отримання запису разом із прихованим полем (наприклад, для логіну):**
Оскільки ми використали `@Column({ select: false })` для поля `passwordHash`, звичайний `findOne` його не поверне. Щоб отримати пароль (наприклад, під час авторизації для перевірки хешу), ми маємо явно вказати це в `select`.

```ts
async getUserByEmailForLogin(email: string): Promise<User> {
  return await this.userRepository.findOne({
    where: { email: email },
    // Явно вказуємо, що нам потрібен пароль та інші ключові поля
    select: ['id', 'email', 'passwordHash', 'isActive'] 
  });
}
```

Для демонстрації створимо зв'язок **"Один до Багатьох" (One-To-Many)** між таблицею `Category` (одна категорія) та `Product` (багато продуктів).

**Сутність Category (Категорія):**
```ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Product } from './product.entity';

@Entity('categories') // Назва таблиці в базі
export class Category {
  @PrimaryGeneratedColumn('uuid') // Генерація унікального ідентифікатора
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  title: string;

  // Зв'язок: Одна категорія має багато продуктів
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
```

**Сутність Product (Продукт):**
```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Category } from './category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column() // За замовчуванням varchar(255)
  title: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'text', nullable: true }) // Поле може бути порожнім
  description: string;

  @CreateDateColumn() // Автоматично записує дату створення
  createdAt: Date;

  // Зв'язок: Багато продуктів належать до однієї категорії
  @ManyToOne(() => Category, (category) => category.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' }) // Вказує назву колонки зовнішнього ключа
  category: Category;
}
```

### 5. Створення та отримання даних (Сортування та Пагінація)

Щоб працювати з БД, необхідно інжектувати `Repository` у сервіс. У модулі (`ProductsModule`) попередньо треба імпортувати сутність: `TypeOrmModule.forFeature([Product])`.

Приклад реалізації в `ProductsService`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  // 1. Створення даних
  async create(productData: any, categoryId: string): Promise<Product> {
    const newProduct = this.productRepository.create({
      ...productData,
      category: { id: categoryId } // Прив'язуємо до існуючої категорії
    });
    return await this.productRepository.save(newProduct);
  }

  // 2. Отримання даних з ПАГІНАЦІЄЮ, СОРТУВАННЯМ та ЗВ'ЯЗКАМИ
  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit; // Розрахунок зсуву для пагінації

    const [items, total] = await this.productRepository.findAndCount({
      relations: ['category'], // Підтягуємо дані з таблиці категорій
      skip: skip,              // Скільки записів пропустити
      take: limit,             // Скільки записів взяти (ліміт)
      order: {
        createdAt: 'DESC',     // Сортування за датою (від найновіших)
        price: 'ASC'           // Вторинне сортування за ціною
      },
    });

    return {
      data: items,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 3. Отримання одного запису
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category']
    });

    if (!product) throw new NotFoundException('Продукт не знайдено');
    return product;
  }
}
```

### 6. Міграції в TypeORM

Параметр `synchronize: true` у конфігурації автоматично змінює таблиці в базі при зміні коду моделей. Це зручно, але **суворо заборонено використовувати на продакшені (production)**, оскільки це може призвести до незворотної втрати даних (наприклад, перейменування колонки може видалити всі старі дані).

Для контролю версій бази даних використовуються **Міграції**. Це файли з SQL-кодом, які описують, що саме потрібно змінити в базі (додати таблицю, змінити тип колонки тощо).

**Базовий алгоритм роботи з міграціями:**

1.  **Налаштування:** Створюється окремий файл конфігурації `ormconfig.ts` спеціально для міграцій, де вказується шлях до сутностей та папки з міграціями, а `synchronize` встановлюється в `false`.
2.  **Генерація (Generate):** TypeORM аналізує ваші поточні моделі, порівнює їх з поточним станом бази даних і самостійно пише код міграції.
    *Команда:* `npm run typeorm migration:generate -- -n MigrationName`
3.  **Виконання (Run):** Застосування створеної міграції до бази даних.
    *Команда:* `npm run typeorm migration:run`
4.  **Відкат (Revert):** Якщо щось пішло не так, можна скасувати останню застосовану міграцію.
    *Команда:* `npm run typeorm migration:revert`