## Тема: Створення сутності роутінгу за принципом REST API

### Генерація базових файлів сутності (CLI)

Для створення нової сутності (наприклад, `products` або `users`) у NestJS найзручніше використовувати вбудований CLI. Це дозволяє швидко згенерувати модуль, контролер та сервіс.

Команди для покрокової генерації:
```ts
// Створення модуля
nest g module products

// Створення контролера
nest g controller products

// Створення сервісу
nest g service products
```
*Альтернатива:* Можна використати команду `nest g resource products`, яка автоматично згенерує повноцінний CRUD (Create, Read, Update, Delete) з усіма необхідними файлами та DTO.

### Налаштування Контролера (Controller)

Контролер відповідає за обробку вхідних запитів. Завдяки декоратору `@Controller('products')`, всі роути всередині цього класу матимуть базовий префікс `/products`.

Основні HTTP-методи реалізуються через відповідні декоратори:
* `@Get()` — отримання даних;
* `@Post()` — створення нових даних;
* `@Patch()` або `@Put()` — оновлення даних;
* `@Delete()` — видалення даних.

#### Базова структура CRUD-контролера:

```ts
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  // Ін'єкція залежностей (Dependency Injection) сервісу в контролер
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  getAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() productData: any) {
    return this.productsService.create(productData);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.productsService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
```

### Декоратори параметрів

Для отримання даних з HTTP-запиту NestJS надає спеціальні декоратори, які використовуються в аргументах методів контролера:

* `@Param('id')` — витягує динамічні параметри з URL (наприклад, `id` з `/products/123`).
* `@Body()` — витягує тіло запиту (payload), яке відправляє клієнт при POST або PATCH запитах.
* `@Query()` — використовується для отримання query-параметрів (наприклад, `/products?limit=10`).

### Data Transfer Object (DTO)

Використання типу `any` для `@Body()` є поганою практикою. Для типізації вхідних даних створюються класи DTO. Вони описують, які саме поля очікує сервер.

Створення `CreateProductDto`:

```ts
export class CreateProductDto {
  readonly title: string;
  readonly price: number;
  readonly description?: string;
}
```
Створення `UpdateProductDto`:
```ts
export class UpdateProductDto {
  readonly title?: string;
  readonly price?: number;
  readonly description?: string;
}
```
*Після створення DTO ми замінюємо `any` на відповідні класи в методах `create` та `update` контролера.*

### Налаштування Сервісу (Service)

Сервіс містить бізнес-логіку. Для демонстрації роботи REST API (до підключення реальної бази даних) використовується локальний масив в оперативній пам'яті.

Приклад реалізації сервісу:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  // Імітація бази даних
  private products = [];

  findAll() {
    return this.products;
  }

  findOne(id: string) {
    const product = this.products.find(p => p.id === id);
    if (!product) {
      // Генерація стандартної HTTP помилки 404
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  create(productDto: CreateProductDto) {
    const newProduct = {
      id: Date.now().toString(),
      ...productDto,
    };
    this.products.push(newProduct);
    return newProduct;
  }

  update(id: string, updateDto: UpdateProductDto) {
    const productIndex = this.products.findIndex(p => p.id === id);
    
    if (productIndex === -1) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const updatedProduct = {
      ...this.products[productIndex],
      ...updateDto,
    };

    this.products[productIndex] = updatedProduct;
    return updatedProduct;
  }

  remove(id: string) {
    const productIndex = this.products.findIndex(p => p.id === id);
    if (productIndex === -1) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    const removedProduct = this.products[productIndex];
    this.products = this.products.filter(p => p.id !== id);
    return removedProduct;
  }
}
```

### Обробка помилок (Exception Handling)

У методах `findOne`, `update` та `remove` реалізована перевірка на існування елемента. Якщо сутність не знайдена, використовується вбудований клас `NotFoundException`. NestJS автоматично перехоплює цю помилку та формує коректну HTTP-відповідь зі статусом `404 Not Found` та зрозумілим повідомленням для клієнта.