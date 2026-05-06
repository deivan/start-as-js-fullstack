// transaction.service.ts
import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, TransactionStatus, Prisma } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async processWithdrawal(walletId: string, amount: Prisma.Decimal, idempotencyKey: string) {
    // 1. Перевірка ідемпотентності
    const existingTx = await this.prisma.transaction.findUnique({
      where: { idempotencyKey },
    });
    if (existingTx) {
      return existingTx; // Повертаємо вже оброблену транзакцію
    }

    // 2. Інтерактивна транзакція бази даних
    return this.prisma.$transaction(async (tx) => {
      // Перевіряємо баланс з блокуванням рядка (Pessimistic lock) 
      // У Prisma для цього можна використати $queryRaw, але для простоти
      // ми використаємо перевірку + атомарне оновлення, яке впаде, якщо баланс піде в мінус
      // (потребує відповідного CHECK constraint в базі Postgres: CHECK (balance >= 0))
      
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet || !wallet.isActive) {
        throw new BadRequestException('Гаманець недоступний');
      }

      if (Number(wallet.balance) < Number(amount)) {
         throw new BadRequestException('Недостатньо коштів');
      }

      // Створюємо запис про транзакцію
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
          amount,
          idempotencyKey,
          description: 'Списання коштів',
        },
      });

      // Атомарно оновлюємо баланс
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      return transaction;
    });
  }

  async getHistory(walletId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' }, // Найновіші перші
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { walletId } }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  // transaction.service.ts
  async processRefund(originalTransactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Знаходимо оригінальну транзакцію
      const originalTx = await tx.transaction.findUnique({
        where: { id: originalTransactionId },
      });

      if (!originalTx) throw new NotFoundException('Транзакцію не знайдено');
      if (originalTx.type !== TransactionType.WITHDRAWAL) {
        throw new BadRequestException('Повернення можливе лише для списань');
      }

      // 2. Перевіряємо, чи не було вже рефанду для цієї транзакції
      const existingRefund = await tx.transaction.findFirst({
        where: { 
          referenceId: originalTransactionId,
          type: TransactionType.REFUND
        }
      });

      if (existingRefund) {
        throw new ConflictException('Кошти за цю транзакцію вже повернено');
      }

      // 3. Створюємо транзакцію повернення
      const refundTx = await tx.transaction.create({
        data: {
          walletId: originalTx.walletId,
          type: TransactionType.REFUND,
          status: TransactionStatus.COMPLETED,
          amount: originalTx.amount, // Повертаємо ту саму суму
          referenceId: originalTx.id,
          description: `Повернення коштів за транзакцією ${originalTx.id}`,
        },
      });

      // 4. Повертаємо кошти на баланс (атомарний інкремент)
      await tx.wallet.update({
        where: { id: originalTx.walletId },
        data: {
          balance: {
            increment: originalTx.amount,
          },
        },
      });

      return refundTx;
    });
  }

  // Оскарження транзакції (Dispute)
  async markAsDisputed(transactionId: string) {
     // Зміна статусу транзакції для привернення уваги адміністрації.
     // Реальні гроші не рухаються на цьому етапі, лише заморожуються або підсвічуються.
     return this.prisma.transaction.update({
       where: { id: transactionId },
       data: { status: TransactionStatus.DISPUTED }
     });
  }
}