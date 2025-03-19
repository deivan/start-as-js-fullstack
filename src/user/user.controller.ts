import { Controller, Get, Post, Body } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

  @Get()
  root() {
    return { message: 'Just a thumb for clear GET /user route' };
  }

  @Post()
  login(@Body() signInDto: Record<string, any>) {
    return this.userService.login(signInDto.username, signInDto.password);
  }
}
