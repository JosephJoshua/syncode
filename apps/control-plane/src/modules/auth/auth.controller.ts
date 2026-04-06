import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CONTROL_API } from '@syncode/contracts';
import type { Response } from 'express';
import { Cookies } from '@/common/decorators/cookies.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import type { EnvConfig } from '@/config/env.config.js';
import { AuthService } from './auth.service.js';
import {
  AccessTokenResponseDto,
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  RegisterResponseDto,
} from './dto/auth.dto.js';

/**
 * Provides authentication endpoints for registration, login, logout, and token refresh.
 */
@ApiTags('auth')
@Controller()
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<EnvConfig>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private static readonly AUTH_THROTTLE = {
    default: {
      limit: 5,
      ttl: 60 * 1_000,
    },
  } as const;
  private static readonly REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
  private static readonly REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
  private static readonly REFRESH_TOKEN_COOKIE_PATH = '/auth';

  @Post(CONTROL_API.AUTH.REGISTER.route)
  @Throttle(AuthController.AUTH_THROTTLE)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    type: RegisterResponseDto,
    description: 'Account created',
    headers: {
      'Set-Cookie': {
        description: 'Refresh token cookie (refreshToken=...; Path=/auth)',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Email or username already registered',
  })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegisterResponseDto> {
    const registerResult = await this.authService.register(
      body.username,
      body.email,
      body.password,
    );

    this.setRefreshTokenCookie(response, registerResult.refreshToken);

    return {
      accessToken: registerResult.accessToken,
      user: registerResult.user,
    };
  }

  @Post(CONTROL_API.AUTH.LOGIN.route)
  @Throttle(AuthController.AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and get tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    type: LoginResponseDto,
    description: 'Authentication successful',
    headers: {
      'Set-Cookie': {
        description: 'Refresh token cookie (refreshToken=...; Path=/auth)',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Invalid credentials' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const loginResult = await this.authService.login(body.identifier, body.password);

    this.setRefreshTokenCookie(response, loginResult.refreshToken);

    return {
      accessToken: loginResult.accessToken,
      user: loginResult.user,
    };
  }

  @Post(CONTROL_API.AUTH.REFRESH.route)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token (no request body, refresh token is read from HTTP-only cookie)',
  })
  @ApiResponse({
    status: 200,
    type: AccessTokenResponseDto,
    description: 'Token refreshed',
    headers: {
      'Set-Cookie': {
        description: 'Rotated refresh token cookie (refreshToken=...; Path=/auth)',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async refresh(
    @Cookies(AuthController.REFRESH_TOKEN_COOKIE_NAME) refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponseDto> {
    this.assertRefreshTokenCookie(refreshToken);
    const refreshResult = await this.authService.refreshToken(refreshToken);

    this.setRefreshTokenCookie(response, refreshResult.refreshToken);

    return {
      accessToken: refreshResult.accessToken,
    };
  }

  @Post(CONTROL_API.AUTH.LOGOUT.route)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout and invalidate refresh token (no request body, reads cookie)',
  })
  @ApiResponse({
    status: 204,
    description: 'Logged out successfully',
    headers: {
      'Set-Cookie': {
        description: 'Clears refresh token cookie',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async logout(
    @Cookies(AuthController.REFRESH_TOKEN_COOKIE_NAME) refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertRefreshTokenCookie(refreshToken);
    await this.authService.logout(refreshToken);

    this.clearRefreshTokenCookie(response);
  }

  private assertRefreshTokenCookie(
    refreshToken: string | undefined,
  ): asserts refreshToken is string {
    if (!refreshToken) {
      throw new UnauthorizedException('Unauthorized');
    }
  }

  private get cookieBaseOptions() {
    return {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'strict' as const,
      path: AuthController.REFRESH_TOKEN_COOKIE_PATH,
    };
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie(AuthController.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      ...this.cookieBaseOptions,
      maxAge: AuthController.REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshTokenCookie(response: Response): void {
    response.cookie(AuthController.REFRESH_TOKEN_COOKIE_NAME, '', {
      ...this.cookieBaseOptions,
      maxAge: 0,
    });
  }
}
