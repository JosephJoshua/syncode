import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CONTROL_API } from '@syncode/contracts';
import type { Response } from 'express';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { AuthService } from './auth.service';
import {
  AccessTokenResponseDto,
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  RegisterResponseDto,
} from './dto/auth.dto';

/**
 * Provides authentication endpoints for registration, login, logout, and token refresh.
 */
@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private static readonly AUTH_THROTTLE = {
    default: {
      limit: 5,
      ttl: 60 * 1_000,
    },
  } as const;
  private static readonly REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

  @Post(CONTROL_API.AUTH.REGISTER.route)
  @Throttle(AuthController.AUTH_THROTTLE)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    type: RegisterResponseDto,
    description: 'User registered successfully',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Email or username already registered',
  })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async register(@Body() body: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(body.username, body.email, body.password);
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
        description:
          'Refresh token cookie (refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800)',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Forbidden' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const loginResult = await this.authService.login(body.identifier, body.password);

    response.cookie('refreshToken', loginResult.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: AuthController.REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    });

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
        description:
          'Rotated refresh token cookie (refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800)',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async refresh(
    @Headers('cookie') cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponseDto> {
    const refreshToken = this.getRefreshTokenFromCookieHeader(cookieHeader);
    const refreshResult = await this.authService.refreshToken(refreshToken);

    response.cookie('refreshToken', refreshResult.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: AuthController.REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    });

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
        description:
          'Clears refresh token cookie (refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=0)',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async logout(
    @Headers('cookie') cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = this.getRefreshTokenFromCookieHeader(cookieHeader);
    await this.authService.logout(refreshToken);

    response.cookie('refreshToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: 0,
    });
  }

  private getRefreshTokenFromCookieHeader(cookieHeader: string | undefined): string {
    if (!cookieHeader) {
      throw new UnauthorizedException('Unauthorized');
    }

    const refreshTokenCookie = cookieHeader
      .split(';')
      .map((cookiePart) => cookiePart.trim())
      .find((cookiePart) => cookiePart.startsWith('refreshToken='));

    if (!refreshTokenCookie) {
      throw new UnauthorizedException('Unauthorized');
    }

    const encodedToken = refreshTokenCookie.slice('refreshToken='.length);
    if (!encodedToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    return decodeURIComponent(encodedToken);
  }
}
