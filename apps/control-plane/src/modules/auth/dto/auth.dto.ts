import {
  accessTokenResponseSchema,
  loginResponseSchema,
  loginSchema,
  registerSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class LoginResponseDto extends createZodDto(loginResponseSchema) {}
export class AccessTokenResponseDto extends createZodDto(accessTokenResponseSchema) {}
