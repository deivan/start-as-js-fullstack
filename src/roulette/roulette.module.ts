import { Module } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { RouletteController } from './roulette.controller';

import { WalletService } from 'src/wallet/wallet.service';

import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [RouletteController],
  providers: [RouletteService, PrismaService, WalletService],
})
export class RouletteModule {}
