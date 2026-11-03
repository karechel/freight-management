import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
  type AuthenticatedRequest,
  CurrentUser,
  type Principal,
  Public,
} from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() request: AuthenticatedRequest) {
    return this.auth.login(dto.email, dto.password, request.ip);
  }

  @Get('me')
  me(@CurrentUser() user: Principal) {
    return user;
  }
}
