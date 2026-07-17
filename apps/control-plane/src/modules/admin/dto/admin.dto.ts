import {
  adminBanUserSchema,
  adminUserSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class AdminUsersQueryDto extends createZodDto(adminUsersQuerySchema) {}

export class AdminUserDto extends createZodDto(adminUserSchema) {}

export class AdminUsersResponseDto extends createZodDto(adminUsersResponseSchema) {}

export class AdminBanUserDto extends createZodDto(adminBanUserSchema) {}
