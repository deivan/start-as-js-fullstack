// videoslot.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service'; // Ваш адаптер
import { RedisService } from '../redis/redis.service';   // Ваш адаптер
import { WalletService } from '../wallet/wallet.service'; // Ваш адаптер
import { PlayVideoSlotDto } from './videoslot.dto';
import { PAYLINES_CONFIG, PAYTABLE, WILD_SYMBOL } from './videoslot.constants';

interface GameSession {
  gameId: string;
  mode: number; // 1 - GAME, 0 - TEST
  totalSpins: number;
  totalBets: number;
  totalWins: number;
}

@Injectable()
export class VideoSlotService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private wallet: WalletService,
  ) {}

  // Генерація стрічок для барабанів (імітація завантаження конфігу)
  private getReels(mode: number): number[][] {
    const reels: number[][] = [];
    const length = mode === 1 ? 256 : 16; 
    
    for (let i = 0; i < 5; i++) {
      const reel = [];
      for (let j = 0; j < length; j++) {
        // У тестовому режимі даємо вужчий пул символів для частих виграшів
        const symbolPool = mode === 1 ? [1, 2, 3, 4, 5, WILD_SYMBOL] : [1, 2, WILD_SYMBOL];
        reel.push(symbolPool[Math.floor(Math.random() * symbolPool.length)]);
      }
      reels.push(reel);
    }
    return reels;
  }

  async initializeGameSession(userId: string, mode: number = 1) {
    const gameId = randomUUID();
    const session: GameSession = {
      gameId,
      mode,
      totalSpins: 0,
      totalBets: 0,
      totalWins: 0,
    };

    await this.redis.set(`slot_session:${userId}`, JSON.stringify(session));
    return { gameId, status: 'initialized', mode };
  }

  async play(userId: string, dto: PlayVideoSlotDto) {
    const sessionStr = await this.redis.get(`slot_session:${userId}`);
    if (!sessionStr) throw new NotFoundException('Game session not found. Call GET /videoslot first.');
    
    const session: GameSession = JSON.parse(sessionStr);
    const { bet, lines } = dto;
    const betPerLine = bet / lines.length;

    // 1. Списання балансу
    const hasBalance = await this.wallet.deductBalance(userId, bet);
    if (!hasBalance) throw new BadRequestException('Insufficient funds');

    // 2. Генерація зупинок барабанів (RNG)
    const reels = this.getReels(session.mode);
    const grid: number[][] = [[], [], [], [], []]; // 5 колонок по 3 рядки

    for (let reelIndex = 0; reelIndex < 5; reelIndex++) {
      const reelLength = reels[reelIndex].length;
      
      // Використання криптографічної ентропії замість Math.random
      const stopIndex = randomInt(0, reelLength); 
      
      // Формуємо 3 видимі символи для поточного барабана (кільцевий буфер)
      grid[reelIndex] = [
        reels[reelIndex][stopIndex],
        reels[reelIndex][(stopIndex + 1) % reelLength],
        reels[reelIndex][(stopIndex + 2) % reelLength],
      ];
    }

    // 3. Перевірка ліній та розрахунок виграшу
    let totalWin = 0;
    const winningLines = [];

    for (const lineId of lines) {
      const linePattern = PAYLINES_CONFIG[lineId];
      if (!linePattern) continue;

      const lineSymbols = linePattern.map((rowIndex, reelIndex) => grid[reelIndex][rowIndex]);
      
      // Логіка підрахунку збігів (зліва направо, враховуючи WILD)
      let matchCount = 1;
      let targetSymbol = lineSymbols[0] === WILD_SYMBOL ? lineSymbols[1] : lineSymbols[0];
      
      for (let i = 1; i < 5; i++) {
        if (lineSymbols[i] === targetSymbol || lineSymbols[i] === WILD_SYMBOL || targetSymbol === WILD_SYMBOL) {
          matchCount++;
          // Якщо перший був WILD, а далі звичайний, фіксуємо звичайний як таргет
          if (targetSymbol === WILD_SYMBOL && lineSymbols[i] !== WILD_SYMBOL) {
            targetSymbol = lineSymbols[i];
          }
        } else {
          break;
        }
      }

      // Перевірка таблиці виплат
      if (matchCount >= 3 && targetSymbol !== WILD_SYMBOL) {
        const multiplier = PAYTABLE[targetSymbol]?.[matchCount] || 0;
        if (multiplier > 0) {
          const winAmount = betPerLine * multiplier;
          totalWin += winAmount;
          winningLines.push({ lineId, matchCount, symbol: targetSymbol, winAmount });
        }
      }
    }

    // 4. Нарахування виграшу
    if (totalWin > 0) {
      await this.wallet.addBalance(userId, totalWin);
    }

    // 5. Оновлення сесії
    session.totalSpins += 1;
    session.totalBets += bet;
    session.totalWins += totalWin;
    await this.redis.set(`slot_session:${userId}`, JSON.stringify(session));

    // Транспонуємо грід для зручного відображення на клієнті (рядки замість колонок)
    const viewGrid = [0, 1, 2].map(row => grid.map(col => col[row]));

    return {
      grid: viewGrid,
      winningLines,
      totalWin,
      betAmount: bet,
    };
  }

  async endGame(userId: string, gameId: string) {
    const sessionStr = await this.redis.get(`slot_session:${userId}`);
    if (!sessionStr) throw new NotFoundException('Active session not found');
    
    const session: GameSession = JSON.parse(sessionStr);
    if (session.gameId !== gameId) throw new BadRequestException('Game ID mismatch');

    // Видаляємо з Redis
    await this.redis.del(`slot_session:${userId}`);

    // Зберігаємо історію в PostgreSQL через Prisma
    const historyRecord = await this.prisma.videoSlotHistory.create({
      data: {
        userId: userId, // Зв'язок з користувачем
        gameId: session.gameId,
        mode: session.mode,
        totalSpins: session.totalSpins,
        totalBets: session.totalBets,
        totalWins: session.totalWins,
        rtp: session.totalBets > 0 ? (session.totalWins / session.totalBets) * 100 : 0, // Статистичний RTP сесії
      },
    });

    return {
      message: 'Game session ended successfully',
      stats: historyRecord,
    };
  }
}
