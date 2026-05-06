import { Module } from '@nestjs/common';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { WalletService } from 'src/wallet/wallet.service';

import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [],
  controllers: [UsersController],
  providers: [UsersService, PrismaService, WalletService],
})
export class UsersModule {}
