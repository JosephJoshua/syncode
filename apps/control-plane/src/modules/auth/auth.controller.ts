import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { AuthService } from './auth.service';
import {
  AccessTokenResponseDto,
  AuthTokensResponseDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/auth.dto';

/**
 * TODO: Implement authentication endpoints:
 * - POST /auth/register: Create new user account
 * - POST /auth/login: Authenticate and get tokens
 * - POST /auth/refresh: Refresh access token
 * - POST /auth/logout: Invalidate refresh token
 */
@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(CONTROL_API.AUTH.REGISTER.route)
  @ApiOperation({ summary: 'Register a new user (TODO)' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    type: AccessTokenResponseDto,
    description: 'User registered successfully',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Email already registered' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async register(@Body() body: RegisterDto): Promise<AccessTokenResponseDto> {
    return this.authService.register(body.email, body.password);
  }

  @Post(CONTROL_API.AUTH.LOGIN.route)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and get tokens (TODO)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto, description: 'Login successful' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Invalid credentials' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async login(@Body() body: LoginDto): Promise<AuthTokensResponseDto> {
    return this.authService.login(body.email, body.password);
  }

  @Post(CONTROL_API.AUTH.REFRESH.route)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (TODO)' })
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
}
