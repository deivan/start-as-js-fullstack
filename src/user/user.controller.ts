import { Controller, Get, Post, Put, Body, UseGuards, Render, Session, HttpCode, Redirect } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from './user.guard';
import { Roles } from './roles.decorator';
import { Role } from './role.enum';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

  @Get()
  root() {
    return { message: 'Just a thumb for clear GET /user route' };
  }

  @Post()
  @Redirect('/user/profile', 302) 
  @HttpCode(200)
  async login(@Session() session: Record<string, any>, @Body() signInDto: Record<string, any>) {
    const User = await this.userService.login(signInDto.username, signInDto.password);
    if (User) {
      session.token = User.token;
    } else {
      return {
        url: '/', 
        statusCode: 302,
      };
    }
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  @Render('profile')
  getProfile(@Session() session: Record<string, any>) {
    // Assuming the UserService has a method to get the user profile
    return session.user;
  }


  @Put('profile')
  @UseGuards(AuthGuard)
  updateProfile(@Session() session: Record<string, any>, @Body() updateProfileDto: Record<string, any>) {
    // Assuming the UserService has a method to update the user profile
    return this.userService.updateProfile(session.user?.userId, updateProfileDto);
  }

  @Post('block')
  @UseGuards(AuthGuard)
  @Roles(Role.Admin)
  blockUser(@Body() blockUserDto: Record<string, any>) {
    // Assuming the UserService has a method to block a user
    return this.userService.blockUser(blockUserDto.userId);
  }
}
