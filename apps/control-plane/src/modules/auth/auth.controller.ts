import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CONTROL_API } from '@syncode/contracts';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { AuthService } from './auth.service';
import {
  AccessTokenResponseDto,
  AuthTokensResponseDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
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
  @ApiResponse({ status: 200, type: AuthTokensResponseDto, description: 'Login successful' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Invalid credentials' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async login(@Body() body: LoginDto): Promise<AuthTokensResponseDto> {
    return this.authService.login(body.identifier, body.password);
  }

  @Post(CONTROL_API.AUTH.REFRESH.route)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    type: AccessTokenResponseDto,
    description: 'Token refreshed successfully',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Invalid or expired refresh token',
  })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async refresh(@Body() body: RefreshTokenDto): Promise<AccessTokenResponseDto> {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post(CONTROL_API.AUTH.LOGOUT.route)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({ status: 200, description: 'Refresh token revoked (empty response body)' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Invalid or expired refresh token',
  })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async logout(@Body() body: LogoutDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }
}
