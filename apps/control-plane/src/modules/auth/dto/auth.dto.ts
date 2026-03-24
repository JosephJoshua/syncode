import {
  accessTokenResponseSchema,
  loginResponseSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
export class LoginResponseDto extends createZodDto(loginResponseSchema) {}
export class AccessTokenResponseDto extends createZodDto(accessTokenResponseSchema) {}
