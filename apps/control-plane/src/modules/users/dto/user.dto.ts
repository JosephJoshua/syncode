import {
  avatarUploadUrlResponseSchema,
  publicUserProfileResponseSchema,
  updateUserSchema,
  userProfileResponseSchema,
  userQuotasResponseSchema,
  userWeaknessesResponseSchema,
  userWeaknessSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
export class UserProfileResponseDto extends createZodDto(userProfileResponseSchema) {}
export class PublicUserProfileResponseDto extends createZodDto(publicUserProfileResponseSchema) {}
export class UserQuotasResponseDto extends createZodDto(userQuotasResponseSchema) {}
export class UserWeaknessDto extends createZodDto(userWeaknessSchema) {}
export class UserWeaknessesResponseDto extends createZodDto(userWeaknessesResponseSchema) {}
export class AvatarUploadUrlResponseDto extends createZodDto(avatarUploadUrlResponseSchema) {}
