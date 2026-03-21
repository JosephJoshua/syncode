import {
  accessTokenResponseSchema,
  authTokensResponseSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerResponseSchema,
  registerSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
export class RegisterResponseDto extends createZodDto(registerResponseSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
export class LogoutDto extends createZodDto(logoutSchema) {}
export class AuthTokensResponseDto extends createZodDto(authTokensResponseSchema) {}
export class AccessTokenResponseDto extends createZodDto(accessTokenResponseSchema) {}
