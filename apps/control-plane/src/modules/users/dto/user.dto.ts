import {
  publicUserProfileResponseSchema,
  updateUserSchema,
  userProfileResponseSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
export class UserProfileResponseDto extends createZodDto(userProfileResponseSchema) {}
export class PublicUserProfileResponseDto extends createZodDto(publicUserProfileResponseSchema) {}
