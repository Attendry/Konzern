import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  AuthService,
  LoginCredentials,
  RegisterCredentials,
  UserProfile,
} from './auth.service';
import { Public, Roles } from './supabase-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register new user
   */
  @Public()
  @Post('register')
  async register(@Body() credentials: RegisterCredentials) {
    const user = await this.authService.register(credentials);
    return {
      success: true,
      message:
        'Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse.',
      user,
    };
  }

  /**
   * Login user
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() credentials: LoginCredentials) {
    const result = await this.authService.login(credentials);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Logout user
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    await this.authService.logout();
    return {
      success: true,
      message: 'Erfolgreich abgemeldet',
    };
  }

  /**
   * Refresh access token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    const tokens = await this.authService.refreshToken(refreshToken);
    return {
      success: true,
      ...tokens,
    };
  }

  /**
   * Get current user profile
   */
  @Get('me')
  async getMe(@Req() req: Request) {
    return {
      success: true,
      user: req.user,
    };
  }

  /**
   * Update current user profile
   */
  @Put('me')
  async updateMe(@Req() req: Request, @Body() updates: Partial<UserProfile>) {
    const profile = await this.authService.updateProfile(req.user!.id, updates);
    return {
      success: true,
      profile,
    };
  }

  /**
   * Get all users (admin only)
   */
  @Get('users')
  @Roles('admin')
  async getAllUsers() {
    const users = await this.authService.getAllUsers();
    return {
      success: true,
      users,
    };
  }

  /**
   * Update user role (admin only)
   */
  @Put('users/:userId/role')
  @Roles('admin')
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: UserProfile['role'],
  ) {
    const profile = await this.authService.updateUserRole(userId, role);
    return {
      success: true,
      profile,
    };
  }
}
