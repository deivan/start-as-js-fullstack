import { Injectable } from '@nestjs/common';
import { CreateRouletteDto } from './dto/create-roulette.dto';
import { UpdateRouletteDto } from './dto/update-roulette.dto';

import * as crypto from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { GameSession, Prisma } from '../../prisma/generated/prisma/client';

import { WalletService } from '../wallet/wallet.service';

const GameRoom = '295d2985-2d44-4feb-8fa0-5e0c01ffd9f3';

const generateResult = (serverSeed: string, clientSeed: string, nonce: number) => {
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}`);

    const hash = hmac.digest('hex');
    const partialHash = hash.substring(0, 8);
    const intValue = parseInt(partialHash, 16);

    return intValue % 37;
}

@Injectable()
export class RouletteService {
  constructor(private prisma: PrismaService, private walletService: WalletService) {}
  
  async create() {
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const gameRoom = await this.prisma.gameSession.create({
      data: {
        serverSeed,
        serverHash,
        clientSeed: '12345', // Replace with actual client seed
        userId: 6
      }
    });
    // GameRoom = gameRoom.id;
    return { success: true, gameRoom };
  }

  findAll() {
    const gameSessions = this.prisma.gameSession.findMany();
    return gameSessions;
  }

  async spinOne(GameRoom: string, bet: number, betAmount: number) {
    const gameSession = await this.prisma.gameSession.findUnique({
      where: { id: GameRoom }
    });
    if (!gameSession) {
      return { success: false, message: 'Game session not found' };
    }
    const result = generateResult(gameSession.serverSeed, gameSession.clientSeed, gameSession.nonce);

    await this.prisma.gameSession.update({
      where: { id: GameRoom },
      data: { nonce: gameSession.nonce + 1 }
    });
    try {
      const isWin = result === bet; // Replace with actual win condition
      await this.prisma.rouletteBet.create({
        data: {
          gameId: GameRoom,
          nonce: gameSession.nonce,
          winningNumber: result,
          bet: bet,
          isWin: isWin, // Replace with actual win condition
          userId: 6, // Replace with actual user ID
          betAmount : betAmount // Replace with actual bet amount
        }
      });
      const balanceAction = isWin ? { increment: betAmount * 36 } : { decrement: betAmount };

      await this.prisma.wallet.update({
        where: { userId: 6 }, // Replace with actual user ID
        data: { balance: balanceAction }
      });

    } catch (error) {
      console.error('Error creating bet:', error);
      throw error; // Rethrow the error after logging
    }

    return { success: true, result };
  }

  update(id: number, updateRouletteDto: UpdateRouletteDto) {
    return `This action updates a #${id} roulette`;
  }

  remove(id: number) {
    return `This action removes a #${id} roulette`;
  }
}
