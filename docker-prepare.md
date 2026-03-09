# Створення базового Docker-середовища для навчання Node.js (Express/Nest.js) з PostgreSQL та Redis

## Крок 1: Підготовка Windows 11

Впевніться, що у вас увімкнено WSL 2 (Windows Subsystem for Linux). Це забезпечує найкращу продуктивність Docker на Windows.

Встановіть Docker Desktop (якщо ще не встановлено) і в його налаштуваннях переконайтеся, що використовується інтеграція з WSL 2.

## Крок 2: Структура проєкту

Створіть окрему папку для навчального середовища, наприклад, node-study-env. У ній створіть таку структуру:

```text
node-study-env/
├── app/                  # Тут будуть знаходитись файли коду (Express/Nest)
├── Dockerfile            # Інструкція для контейнера з Node.js
└── docker-compose.yml    # Конфігурація всієї інфраструктури
```

## Крок 3: Налаштування Dockerfile для Node.js

Створіть файл Dockerfile. Він описує середовище розробки, куди ми одразу додамо інструменти, необхідні для роботи з Nest.js та Prisma.

```dockerfile
Dockerfile
FROM node:20-alpine

# Створюємо робочу директорію
WORKDIR /usr/src/app

# Встановлюємо глобальні пакети, які знадобляться для навчання
RUN npm install -g @nestjs/cli prisma nodemon

# Відкриваємо порти для додатку (наприклад, 3000) та WebSocket (наприклад, 3001)
EXPOSE 3000
EXPOSE 3001

# Команда за замовчуванням (утримує контейнер активним)
CMD ["tail", "-f", "/dev/null"]
```

## Крок 4: Налаштування docker-compose.yml

Цей файл підніме бази даних та Node.js. Щоб уникнути конфліктів з вашими локальними Postgres та Redis, ми "прокинемо" їх назовні на інші порти (наприклад, 5433 та 6380), хоча всередині Docker-мережі вони працюватимуть на стандартних.

Створіть docker-compose.yml:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: study_node_app
    volumes:
      - ./app:/usr/src/app  # Синхронізація вашого коду з контейнером
    ports:
      - "3000:3000"         # Порт для API
      - "3001:3001"         # Порт для WebSockets
    depends_on:
      - postgres
      - redis
    environment:
      # Зверніть увагу: хост бази даних - це ім'я сервісу "postgres", а не localhost
      - DATABASE_URL=postgresql://student:study_password@postgres:5432/study_db
      - REDIS_HOST=redis
      - REDIS_PORT=6379

  postgres:
    image: postgres:15-alpine
    container_name: study_postgres
    restart: always
    environment:
      POSTGRES_USER: student
      POSTGRES_PASSWORD: study_password
      POSTGRES_DB: study_db
    ports:
      - "5433:5432" # 5433 на вашому ПК, 5432 всередині контейнера
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: study_redis
    restart: always
    ports:
      - "6380:6379" # 6380 на вашому ПК, 6379 всередині контейнера
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
  ```

## Крок 5: Запуск середовища

Відкрийте термінал у папці node-study-env.

Виконайте команду для збірки та запуску у фоновому режимі:

```bash
docker-compose up -d --build
```

Тепер у вас працюють три контейнери. Ви можете редагувати код у папці app через ваш улюблений редактор (наприклад, VS Code), і ці зміни миттєво відображатимуться у контейнері завдяки volumes.

## Крок 6: Робота всередині контейнера

Оскільки сам Node.js працює всередині ізольованого контейнера, всі команди (встановлення пакетів, генерація Prisma клієнта, запуск скриптів) потрібно виконувати там.

Щоб увійти в термінал контейнера app, виконайте:

```bash
docker exec -it study_node_app sh
```

Перебуваючи всередині, ви можете створити новий проєкт:

```bash
# Для Express
npm init -y
npm i express
# Або для Nest
nest new my-nest-project
```

Важливе правило для студентів щодо підключень

Під час написання коду для підключення до баз даних студенти повинні використовувати внутрішні імена сервісів Docker.

Підключення до БД для Prisma: postgresql://student:study_password@postgres:5432/study_db (зверніть увагу на хост postgres).

Підключення до Redis: хост redis, порт 6379.

Але якщо ви захочете підключитися до цієї БД через програму-клієнт з вашого Windows (наприклад, DBeaver або pgAdmin), ви будете використовувати localhost і порт 5433.

# Створення для роботи з ORM Prisma

Щоб усе запрацювало, ми виконаємо кроки безпосередньо всередині вашого контейнера app. Це імітуватиме реальний процес розробки для студентів.

## Крок 1: Ініціалізація проєкту та встановлення пакетів

Увійдіть у термінал вашого Node.js контейнера, виконавши в командному рядку вашої основної системи (Windows):

```bash
docker exec -it study_node_app sh
```

Перебуваючи в контейнері (у директорії /usr/src/app), ініціалізуйте проєкт та встановіть необхідні бібліотеки:

```bash
# Створюємо package.json
npm init -y

# Встановлюємо клієнт Prisma та бібліотеку для Redis
npm install @prisma/client redis

# Встановлюємо Prisma CLI як dev-залежність
npm install prisma --save-dev

# Ініціалізуємо Prisma у проєкті
npx prisma init
```

## Крок 2: Налаштування змінних оточення та схеми Prisma

Після ініціалізації Prisma у вашій папці app з'явиться файл .env та папка prisma з файлом schema.prisma.

Відкрийте файл .env і замініть його вміст на цей рядок. Зверніть увагу, що хостом виступає postgres (ім'я сервісу з Docker Compose):

```
DATABASE_URL="postgresql://student:study_password@postgres:5432/study_db?schema=public"
```

Відкрийте файл prisma/schema.prisma та додайте просту модель Student для тестування:

```
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Тестова модель для перевірки роботи бази даних
model Student {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
}
```

## Крок 3: Синхронізація схеми з базою даних
Щоб створити таблицю в PostgreSQL на основі нашої схеми, виконайте в терміналі контейнера команду:

```bash
npx prisma db push
```

Ця команда ідеально підходить для етапу швидкого прототипування та навчання, оскільки вона миттєво синхронізує структуру без створення зайвих файлів міграцій.

## Крок 4: Створення скрипта перевірки

Створіть у корені вашої папки app файл index.js і вставте в нього наступний код. Цей скрипт одночасно перевірить запис/читання в Redis та створення/отримання даних через Prisma.

```javascript
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('redis');

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Починаємо перевірку підключень...\n');

    // --- 1. ПЕРЕВІРКА REDIS ---
    // Використовуємо внутрішнє ім'я контейнера 'redis' як хост
    const redisClient = createClient({
        url: 'redis://redis:6379'
    });

    redisClient.on('error', (err) => console.log('❌ Помилка Redis:', err));

    await redisClient.connect();
    console.log('✅ Успішно підключено до Redis!');

    // Записуємо та читаємо тестове значення
    await redisClient.set('course_topic', 'Node.js & Docker Integration');
    const redisValue = await redisClient.get('course_topic');
    console.log(`📦 Отримано з Redis: ${redisValue}\n`);


    // --- 2. ПЕРЕВІРКА POSTGRES (PRISMA) ---
    console.log('⏳ Підключення до бази даних Postgres через Prisma...');
    
    // Створюємо новий тестовий запис
    const newStudent = await prisma.student.create({
        data: {
            name: `Студент ${Math.floor(Math.random() * 1000)}`,
        },
    });
    console.log('✅ Створено запис у Postgres:', newStudent);

    // Зчитуємо всі існуючі записи
    const allStudents = await prisma.student.findMany();
    console.log(`📊 Всього записів у базі: ${allStudents.length}`);
    console.log(allStudents);


    // --- 3. ЗАВЕРШЕННЯ ---
    await redisClient.quit();
    await prisma.$disconnect();
    console.log('\n🏁 Перевірку успішно завершено!');
}

main().catch((e) => {
    console.error('Сталася критична помилка:', e);
    process.exit(1);
});
```

## Крок 5: Запуск тесту
Все ще перебуваючи в терміналі контейнера, запустіть створений файл:

```bash
node index.js
```

Ви повинні побачити в консолі успішні повідомлення про підключення, збереження даних у Redis та генерацію нового студента в базі PostgreSQL. Запускаючи скрипт кілька разів, ви побачите, як збільшується кількість записів у масиві студентів.