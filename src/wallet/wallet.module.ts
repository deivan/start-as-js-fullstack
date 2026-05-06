import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { TransactionService } from './transaction.service';
import { WalletController } from './wallet.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, TransactionService, PrismaService],
})
export class WalletModule {}
