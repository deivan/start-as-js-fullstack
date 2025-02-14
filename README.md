# 04. Основи мови TypeScript

## Nest.js, Typescript, Javascript 

NestJS повністю підтримує TypeScript, оскільки він побудований на основі Node.js і використовує TypeScript як основну мову. Виконання коду відбувається у середовищі Node.js, адже TypeScript спочатку компілюється у звичайний JavaScript. Оскільки будь-який валідний JavaScript-код можна використовувати в NestJS, це дозволяє поступовий перехід на TypeScript у проєкті. Завдяки статичній типізації розробники отримують кращу підтримку коду, автодоповнення та раннє виявлення помилок. При цьому TypeScript у NestJS не впливає на продуктивність, оскільки всі типи видаляються під час компіляції, а виконуваний код залишається стандартним JavaScript.

## Сувора типізація в TypeScript

TypeScript вводить сувору типізацію, що дозволяє виявляти помилки ще на етапі написання коду. На відміну від JavaScript, де змінні можуть змінювати тип динамічно, у TypeScript кожна змінна має чітко визначений тип. Наприклад, якщо змінна оголошена як number, спроба присвоїти їй string викличе помилку під час компіляції. Це забезпечує кращу передбачуваність коду та допомагає уникнути неочікуваних багів.

Окрім базових типів (number, string, boolean тощо), TypeScript підтримує складніші конструкції, такі як tuples, enums, union-типи та literal-типи. Також можна налаштовувати рівень суворості типізації через конфігурацію tsconfig.json, наприклад, активувати strict, що вмикає такі правила, як noImplicitAny, strictNullChecks і strictFunctionTypes. Завдяки цьому код стає безпечнішим і краще документованим.

## Інтерфейси в TypeScript

Інтерфейси в TypeScript дозволяють визначати структуру об'єктів, що забезпечує їхню коректність та передбачуваність. Вони описують, які поля має містити об’єкт і які типи даних у цих полях допускаються. Наприклад:

```typescript
interface User {
  id: number;
  name: string;
  isAdmin: boolean;
}
```

Об'єкт, що не відповідає цьому інтерфейсу, викличе помилку під час компіляції. Це особливо корисно при роботі з API або складними структурами даних, оскільки забезпечує їхню узгодженість у всьому коді.

Інтерфейси можна розширювати (extends), комбінувати (&), робити опціональні властивості (?), а також визначати функціональні сигнатури. У фреймворках, таких як `NestJS`, інтерфейси часто використовуються для опису `DTO` (Data Transfer Objects) та контрактів між модулями. Це покращує зручність роботи з кодом та його масштабованість.

## Композитні типи даних у TypeScript

Композитні типи даних дозволяють комбінувати та розширювати існуючі типи, створюючи гнучкі та багатофункціональні структури. Це дає змогу описувати складні моделі даних, які складаються з кількох базових або інших складених типів. У TypeScript існує кілька основних механізмів для створення композитних типів: __об'єднання__ (union types), __перехоплення__ (intersection types) та __типи__ на основі умов (conditional types).

### Об'єднання (Union Types)

Union-типи (`|`) дозволяють змінній або параметру мати кілька можливих типів. Це особливо корисно, коли значення може бути одним із кількох варіантів.

```typescript
type Status = "loading" | "success" | "error";  
let requestStatus: Status;  

requestStatus = "loading";  // ✅ Валідно  
requestStatus = "failed";   // ❌ Помилка: значення не відповідає типу  
```

Цей підхід допомагає запобігти помилкам, коли в коді використовуються передбачувані варіанти значень.

### Перехоплення (Intersection Types)
Перехоплення (`&`) об’єднує кілька типів в один, який містить усі їхні властивості. Це дозволяє створювати складні структури даних на основі вже існуючих.

```typescript
interface Person {
  name: string;
  age: number;
}

interface Employee {
  company: string;
  position: string;
}

type Worker = Person & Employee;

const worker: Worker = {
  name: "Андрій",
  age: 30,
  company: "TechCorp",
  position: "Розробник"
};
```

У цьому прикладі `Worker` містить всі поля з `Person` та `Employee`, що дає змогу комбінувати кілька сутностей у єдину структуру.

### Типи на основі умов (Conditional Types)

TypeScript дозволяє створювати динамічні типи, які визначаються залежно від інших типів. Це дає змогу будувати узагальнені та більш адаптивні рішення.

```typescript
type IsString<T> = T extends string ? "Text" : "Not Text";

type A = IsString<string>;  // "Text"
type B = IsString<number>;  // "Not Text"
```

Це особливо корисно для роботи з узагальненими (generic) типами в бібліотеках та складних структурах даних.

## Використання у NestJS

У NestJS композитні типи активно використовуються для опису DTO (Data Transfer Objects), конфігураційних об’єктів та гнучких інтерфейсів для взаємодії між модулями. Наприклад, DTO для оновлення користувача може використовувати union- або intersection-типи для поєднання обов’язкових і необов’язкових полів.

```typescript
type UpdateUserDto = Partial<User> & { id: number };
```

Завдяки композитним типам у TypeScript код стає більш виразним, гнучким та передбачуваним, що значно покращує підтримку й масштабованість проєктів.

### Дженеріки та інтерфейси

Дженеріки дозволяють створювати інтерфейси, які можуть працювати з різними типами даних. Це зручно, коли структура об’єкта є спільною, але типи полів можуть змінюватися.

```typescript
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

const userResponse: ApiResponse<{ name: string; age: number }> = {
  data: { name: "Андрій", age: 30 },
  success: true,
};
```

У цьому прикладі `ApiResponse<T>` — це узагальнений (generic) інтерфейс, який можна використовувати з будь-яким типом даних.

### Використання дженеріків у NestJS та DTO

У NestJS активно використовується підхід __Data Transfer Object (DTO)__ для обробки та валідації даних, що передаються між клієнтом і сервером. Дженеріки дозволяють створювати багаторазові DTO, які можна використовувати для різних сутностей.

Один із прикладів використання дженеріків у DTO — створення базового класу для операцій CRUD:

```typescript
export class BaseDto<T> {
  data: T;
}

export class CreateUserDto {
  name: string;
  age: number;
}

const userDto: BaseDto<CreateUserDto> = {
  data: { name: "Олексій", age: 25 }
};
```

Крім того, у NestJS дженеріки часто застосовуються для створення __узагальнених сервісів__, які можуть працювати з будь-якими моделями бази даних.

```typescript
@Injectable()
export class BaseService<T> {
  constructor(@InjectModel(T) private readonly model: Model<T>) {}

  async findAll(): Promise<T[]> {
    return this.model.find().exec();
  }
}
```

### Обробка помилок на етапі компіляції коду TypeScript у фреймворку NestJS

Однією з ключових переваг використання TypeScript у NestJS є можливість виявлення помилок ще на етапі компіляції. Завдяки суворій типізації та механізмам перевірки коду TypeScript дозволяє знизити кількість runtime-помилок, що особливо важливо для серверних застосунків.

Оскільки NestJS побудований на TypeScript, він активно використовує типізацію для контролю правильності використання сервісів, контролерів, DTO та інших компонентів. Наприклад, якщо вказати неправильний тип параметра у сервісі або DTO, компілятор відразу повідомить про помилку. Це значно покращує передбачуваність і надійність коду.

```typescript
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  getUserById(id: number): User {
    return this.userRepository.findById(id); // Якщо метод повертає не User, TypeScript повідомить про помилку
  }
}
```

Якщо розробник передасть `id` у вигляді `string`, а очікується `number`, компілятор TypeScript видасть попередження ще до запуску програми.

Ще один важливий механізм обробки помилок на етапі компіляції — це використання дженеріків та інтерфейсів для DTO. У NestJS DTO активно використовуються для валідації вхідних даних, і якщо структура DTO не відповідає вимогам, TypeScript відразу це виявить.

```typescript
export class CreateUserDto {
  name: string;
  age: number;
}

// Помилка компіляції: поле "age" має бути числом
const invalidDto: CreateUserDto = { name: "Андрій", age: "25" }; 
```

Таким чином, завдяки компіляційній перевірці помилок у TypeScript, 
NestJS забезпечує стабільність і передбачуваність коду, що зменшує ризик помилок у продакшені.

### Об'єкти та інтерфейси

TypeScript дозволяє описувати структуру об'єктів за допомогою інтерфейсів. Це корисно при роботі з API або базою даних.

```typescript
interface User {
  id: number;
  name: string;
}

const user: User = { id: 1, name: "Андрій" };
```

У NestJS інтерфейси часто застосовуються для __DTO (Data Transfer Objects)__, що допомагає описати структуру вхідних і вихідних даних.

```typescript
export class CreateUserDto {
  name: string;
  age: number;
}
```

### Класи та їх застосування у NestJS

Класи у TypeScript підтримують модифікатори доступу (public, private, protected), наслідування та імплементацію інтерфейсів. У NestJS класи є основою для сервісів, контролерів та middleware.

```typescript
class Person {
  constructor(public name: string, private age: number) {}

  getAge(): number {
    return this.age;
  }
}

const person = new Person("Марія", 28);
console.log(person.name);  // ✅ "Марія"
// console.log(person.age); // ❌ Помилка: "age" є приватним
```

У NestJS класи використовуються для створення контролерів:

```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  getUser(@Param('id') id: number): string {
    return this.userService.getUserById(id);
  }
}
```

Завдяки строгій типізації, можливості описувати структуру об’єктів та використанню класів, TypeScript робить розробку у NestJS більш надійною, гнучкою та масштабованою.

### Розширення інтерфейсів

TypeScript дозволяє створювати інтерфейси, які розширюють інші інтерфейси, додаючи або перевизначаючи властивості. Це корисно, коли потрібно створити гнучку типізацію для об'єктів.

```typescript
interface BaseUser {
  id: number;
  name: string;
}

interface AdminUser extends BaseUser {
  role: "admin";
}

const admin: AdminUser = {
  id: 1,
  name: "Олег",
  role: "admin"
};
```

У NestJS такий підхід застосовується при створенні DTO, які можуть розширювати базові структури даних:

```typescript
export class CreateUserDto {
  name: string;
  email: string;
}

export class UpdateUserDto extends CreateUserDto {
  id: number;
}
```

Це дозволяє мінімізувати дублювання коду та використовувати базові DTO у різних сценаріях.

### Успадкування класів у NestJS

Класи в TypeScript можуть успадковувати один одного, що дозволяє організовувати логіку в єдину ієрархію. У NestJS це корисно для створення базових сервісів та контролерів.

```typescript
class BaseService {
  logMessage(message: string) {
    console.log(`[LOG]: ${message}`);
  }
}

class UserService extends BaseService {
  getUserById(id: number) {
    this.logMessage(`Отримання користувача з ID ${id}`);
    return { id, name: "Андрій" };
  }
}

const userService = new UserService();
console.log(userService.getUserById(1));
```

Такий підхід можна використовувати у NestJS для створення базового CRUD-сервісу, який потім можна розширювати для роботи з різними моделями.

```typescript
@Injectable()
export class BaseService<T> {
  constructor(@InjectModel(T) private readonly model: Model<T>) {}

  async findAll(): Promise<T[]> {
    return this.model.find().exec();
  }
}

@Injectable()
export class UserService extends BaseService<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.model.findOne({ email }).exec();
  }
}
```

### Generic Object Types (Узагальнені об'єктні типи)

TypeScript дозволяє створювати узагальнені об'єктні типи, які працюють з різними типами даних. Це особливо корисно при розробці універсальних структур.

```typescript
interface ApiResponse<T> {
  data: T;
  success: boolean;
}

const userResponse: ApiResponse<{ name: string }> = {
  data: { name: "Олена" },
  success: true
};
```

У NestJS узагальнені типи допомагають створювати багаторазові DTO та сервіси:

```typescript
export class BaseDto<T> {
  data: T;
}

export class UserDto {
  name: string;
  email: string;
}

const userDto: BaseDto<UserDto> = {
  data: { name: "Максим", email: "max@example.com" }
};
```

### Висновок

Завдяки механізмам розширення, успадкування та узагальнених об'єктних типів, TypeScript дозволяє створювати багаторазові, гнучкі та типобезпечні структури. У NestJS це використовується для побудови масштабованих сервісів, DTO та моделей, що значно спрощує підтримку та розширення веб аплікації.

