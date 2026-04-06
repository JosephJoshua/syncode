import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { ERROR_CODES, type UpdateUserInput, type UserProfileResponse } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { users } from '@syncode/db';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module';
import { AuthService } from '../auth/auth.service';
import { toUserProfile } from './user-profile.mapper';

@Injectable()
export class UsersService {
  private static readonly userProfileColumns = {
    id: true,
    email: true,
    username: true,
    displayName: true,
    role: true,
    avatarUrl: true,
    bio: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly authService: AuthService,
  ) {}

  async findById(id: string): Promise<UserProfileResponse> {
    const user = await this.db.query.users.findFirst({
      columns: UsersService.userProfileColumns,
      where: (table) => and(eq(table.id, id), isNull(table.deletedAt)),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserProfile(user);
  }

  async findByEmail(email: string): Promise<UserProfileResponse | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.db.query.users.findFirst({
      columns: UsersService.userProfileColumns,
      where: (table) => and(eq(table.email, normalizedEmail), isNull(table.deletedAt)),
    });

    if (!user) {
      return null;
    }

    return toUserProfile(user);
  }

  async create(_data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<UserProfileResponse> {
    // TODO: Implement user creation
    throw new NotImplementedException();
  }

  async update(id: string, data: UpdateUserInput): Promise<UserProfileResponse> {
    const normalizedUsername = data.username?.trim();

    if (normalizedUsername) {
      const existingUser = await this.db.query.users.findFirst({
        columns: { id: true },
        where: (table) =>
          and(eq(table.username, normalizedUsername), ne(table.id, id), isNull(table.deletedAt)),
      });

      if (existingUser) {
        throw new ConflictException({
          message: 'Username already taken',
          code: ERROR_CODES.USER_USERNAME_TAKEN,
        });
      }
    }

    const updates = {
      ...(data.displayName !== undefined
        ? { displayName: this.normalizeOptionalProfileText(data.displayName) }
        : {}),
      ...(data.bio !== undefined ? { bio: this.normalizeOptionalProfileText(data.bio) } : {}),
      ...(normalizedUsername !== undefined ? { username: normalizedUsername } : {}),
      updatedAt: new Date(),
    };

    try {
      const [user] = await this.db
        .update(users)
        .set(updates)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return toUserProfile(user);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException({
          message: 'Username already taken',
          code: ERROR_CODES.USER_USERNAME_TAKEN,
        });
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const now = new Date();

    await this.db
      .update(users)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    await this.authService.revokeAllRefreshTokensForUser(id);
  }

  private normalizeOptionalProfileText(value: string): string | null {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (typeof error !== 'object' || !error || !('code' in error)) {
      return false;
    }

    const dbError = error as { code?: string };
    return dbError.code === '23505';
  }
}
