// videoslot.module.ts
import { Module } from '@nestjs/common';
import { VideoSlotController } from './videoslot.controller';
import { VideoSlotService } from './videoslot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, RedisModule, WalletModule],
  controllers: [VideoSlotController],
  providers: [VideoSlotService],
  exports: [VideoSlotService],
})
export class VideoSlotModule {}
