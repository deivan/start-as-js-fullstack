// wallet.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  Patch,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { Prisma } from '../../prisma/generated/prisma/client';
import { WalletService } from './wallet.service';
import { TransactionService } from './transaction.service';

// DTOs (Data Transfer Objects) для валідації вхідних даних
class CreateWalletDto {
  userId: number;
  currency?: string;
}

class WithdrawDto {
  amount: number;
  idempotencyKey: string;
}

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWallet(@Body() dto: CreateWalletDto) {
    return this.walletService.createWallet(dto.userId, dto.currency);
  }

  @Get(':id/balance')
  async getBalance(@Param('id') id: string) {
    return this.walletService.getBalance(id);
  }

  @Post('deposit')
  async deposit(@Body() dto: { id: string; amount: number }) {
    return this.walletService.deposit(dto);
  }

  @Patch(':id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.walletService.toggleWalletStatus(id, isActive);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawDto,
  ) {
    // Конвертуємо число з DTO у формат Decimal для точної роботи в Prisma
    const amountDecimal = new Prisma.Decimal(dto.amount);
    
    return this.transactionService.processWithdrawal(
      id, 
      amountDecimal, 
      dto.idempotencyKey
    );
  }

  @Get(':id/history')
  async getHistory(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.transactionService.getHistory(
      id, 
      Number(page), 
      Number(limit)
    );
  }

  // POST /api/v1/wallets/transactions/:txId/refund
  // Маршрут винесено семантично ближче до транзакцій
  @Post('transactions/:txId/refund')
  @HttpCode(HttpStatus.OK)
  async refundTransaction(@Param('txId') txId: string) {
    return this.transactionService.processRefund(txId);
  }
}