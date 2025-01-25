import { Controller, Get, Render } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  root() {
    return { message: 'Now we will start a Web Application by Server Side Rendering' };
  }

  // @Get('about')
  // @Render('about')
  // about() {
  //   return { content: 'Some text coul\'be here...' };
  // }
}
