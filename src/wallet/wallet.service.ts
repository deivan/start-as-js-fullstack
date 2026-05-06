// wallet.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../prisma/generated/prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  // Create: Створення гаманця для нового користувача
  async createWallet(userId: number, currency: string = 'UAH') {
    return this.prisma.wallet.create({
      data: {
        userId,
        currency,
      },
    });
  }

  // Read: Отримання балансу
  async getBalance(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { balance: true, currency: true, isActive: true },
    });

    if (!wallet) throw new NotFoundException('Гаманець не знайдено');
    return wallet;
  }

  async deposit(dto: { id: string; amount: number }) {
    const amountBalance = new Prisma.Decimal(dto.amount);
    if (amountBalance.lte(0)) {
      throw new BadRequestException('Сума депозиту повинна бути більшою за 0');
    }
    return this.prisma.wallet.update({
      where: { id: dto.id },
      data: { balance: { increment: amountBalance } },
    });
  }

  // Update/Delete (Soft): Зміна статусу гаманця (блокування)
  async toggleWalletStatus(walletId: string, isActive: boolean) {
    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { isActive },
    });
  }
}