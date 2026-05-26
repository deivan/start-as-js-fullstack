// videoslot.controller.ts
import { Controller, Get, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { VideoSlotService } from './videoslot.service';
import { PlayVideoSlotDto } from './videoslot.dto';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('videoslot')
// @UseGuards(JwtAuthGuard)
export class VideoSlotController {
  constructor(private readonly videoSlotService: VideoSlotService) {}

  @Get()
  async createGame(@Req() req) {
    const userId = req.user.id;
    // За замовчуванням стартуємо в режимі GAME (1). Можна передавати через query параметр.
    return this.videoSlotService.initializeGameSession(userId, 1);
  }

  @Post()
  async playSpin(@Req() req, @Body() dto: PlayVideoSlotDto) {
    const userId = req.user.id;
    return this.videoSlotService.play(userId, dto);
  }

  @Delete()
  async endGame(@Req() req, @Body('id') gameId: string) {
    const userId = req.user.id;
    return this.videoSlotService.endGame(userId, gameId);
  }
}
