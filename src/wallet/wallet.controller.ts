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
import { Prisma } from '@prisma/client';
import { WalletService } from './wallet.service';
import { TransactionService } from './transaction.service';

// DTOs (Data Transfer Objects) для валідації вхідних даних
class CreateWalletDto {
  userId: string;
  currency?: string;
}

class WithdrawDto {
  amount: number;
  idempotencyKey: string;
}

@Controller('api/v1/wallets')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
  ) {}

  // POST /api/v1/wallets
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWallet(@Body() dto: CreateWalletDto) {
    return this.walletService.createWallet(dto.userId, dto.currency);
  }

  // GET /api/v1/wallets/:id/balance
  @Get(':id/balance')
  async getBalance(@Param('id') id: string) {
    return this.walletService.getBalance(id);
  }

  // PATCH /api/v1/wallets/:id/status
  @Patch(':id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.walletService.toggleWalletStatus(id, isActive);
  }

  // POST /api/v1/wallets/:id/withdraw
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

  // GET /api/v1/wallets/:id/history?page=1&limit=20
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