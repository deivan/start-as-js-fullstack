# Кілька рекомендацій щодо інтеграції:

**Типи фінансових полів** (`totalBets`, `totalWins`): Якщо у вашому існуючому сервісі гаманця (`WalletService`) баланс зберігається у вигляді дробових чисел, тип `Float` або `Decimal` підійде ідеально. Якщо ж баланс розраховується в мінімальних грошових одиницях (наприклад, у копійках чи центах як `Int`), змініть тип цих полів на `Int`.

**Зв'язок з користувачем**: Якщо ви розкоментуєте рядок `@relation`, не забудьте додати зворотний зв'язок у саму модель `User` (наприклад, `videoSlotHistories VideoSlotHistory[]`).

**Міграція**: Після додавання моделі до схеми виконайте команду в терміналі для створення та застосування міграції до вашої бази даних:

```bash
npx prisma migrate dev --name add_video_slot_history
```

## Схема `VideoSlotHistory`:

```prisma
model VideoSlotHistory {
  id         String   @id @default(uuid())
  gameId     String   @unique             // Унікальний ідентифікатор ігрової сесії з Redis
  userId     String                       // ID користувача (змініть на Int, якщо у вас цілочисельні ID)
  mode       Int                          // Режим гри: 1 - GAME, 0 - TEST
  totalSpins Int                          // Загальна кількість спінів за сесію
  totalBets  Float                        // Загальна сума ставок (можна замінити на Decimal для точних фінансових розрахунків)
  totalWins  Float                        // Загальна сума виграшів (можна замінити на Decimal)
  rtp        Float                        // Статистичний Return to Player сесії у відсотках
  createdAt  DateTime @default(now())     // Дата та час завершення сесії

  // Якщо у вашій схемі вже є модель User, розкоментуйте рядок нижче для створення зв'язку:
  // user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("video_slot_history") // Забезпечує створення таблиці у форматі snake_case в базі даних
}
```
