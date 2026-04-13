## Тема: Використання Pipes() та створення кастомного пайпу

### Основне призначення Pipes (Пайпів)

У NestJS пайпи виконують дві головні функції, працюючи з аргументами, які обробляються контролером:
1.  **Трансформація (Transformation):** Перетворення вхідних даних на бажаний формат (наприклад, перетворення рядка `'10'` на число `10`).
2.  **Валідація (Validation):** Перевірка вхідних даних на відповідність певним правилам. Якщо дані некоректні, пайп викидає виняток (Exception), який автоматично зупиняє виконання запиту і повертає клієнту помилку.

NestJS має вбудовані пайпи (наприклад, `ValidationPipe`, `ParseIntPipe`, `ParseUUIDPipe`), проте часто виникає потреба створити власну (кастомну) логіку обробки.

### Кроки створення кастомного пайпу

Створення власного пайпу складається з кількох чітких етапів. Ви можете згенерувати базовий файл за допомогою Nest CLI командою `nest g pipe pipe_name`, або створити його вручну.

#### Крок 1. Створення класу та підключення інтерфейсу

Кастомний пайп — це звичайний клас TypeScript, який обов'язково має бути позначений декоратором `@Injectable()` (щоб стати частиною системи впровадження залежностей NestJS) та імплементувати інтерфейс `PipeTransform`.

```ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class CustomValidationPipe implements PipeTransform {
  // Логіка буде тут
}
```

#### Крок 2. Реалізація методу `transform`

Інтерфейс `PipeTransform` вимагає обов'язкової реалізації методу `transform()`. Цей метод приймає два параметри:
* `value`: поточне значення аргументу, яке передав клієнт (до його обробки маршрутом).
* `metadata`: об'єкт типу `ArgumentMetadata`, який містить додаткову інформацію про аргумент (тип, базований на декораторі — body, query, param тощо).

#### Крок 3. Додавання бізнес-логіки (Приклад: ParseInt з кастомною помилкою)

Напишемо логіку пайпу, який намагається перетворити значення на число, а у разі невдачі — повертає специфічне користувацьке повідомлення.

```ts
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class CustomParseIntPipe implements PipeTransform {
  
  transform(value: any, metadata: ArgumentMetadata) {
    // Спроба перетворити вхідне значення на ціле число
    const parsedValue = parseInt(value, 10);
    
    // Валідація: якщо результат не є числом (NaN)
    if (isNaN(parsedValue)) {
      // Викидаємо вбудовану помилку 400 Bad Request
      throw new BadRequestException(`Помилка валідації: значення "${value}" не є коректним числом!`);
    }
    
    // Трансформація: якщо все добре, повертаємо вже перетворене число
    return parsedValue;
  }
}
```

#### Крок 4. Застосування кастомного пайпу

Пайпи можуть бути застосовані на різних рівнях: глобально (як ми робили з `ValidationPipe`), на рівні контролера, методу або конкретного параметра.

Найчастіше кастомні пайпи застосовуються на рівні параметра (Parameter-scoped) безпосередньо в обробнику маршруту.

**Приклад використання в контролері:**
```ts
import { Controller, Get, Param } from '@nestjs/common';
import { CustomParseIntPipe } from './custom-parse-int.pipe';

@Controller('items')
export class ItemsController {
  
  // Застосовуємо наш пайп до параметра 'id'
  @Get(':id')
  getItemById(@Param('id', CustomParseIntPipe) id: number) {
    // Тут змінна 'id' гарантовано буде числом, інакше код сюди не дійде
    console.log(typeof id); // Виведе: "number"
    
    return {
      message: 'Айтем знайдено',
      itemId: id,
    };
  }
}
```

*Примітка: У декоратор `@Param` ми передаємо клас (`CustomParseIntPipe`), дозволяючи NestJS самостійно створити його екземпляр. Проте, якщо ваш пайп приймає якісь налаштування в конструктор, ви можете передати готовий об'єкт: `@Param('id', new CustomParseIntPipe({ options }))`.*