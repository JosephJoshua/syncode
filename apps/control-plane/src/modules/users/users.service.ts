import { Inject, Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import type { Database } from '@syncode/db';
import { DB_CLIENT } from '@/modules/db/db.module';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  bio: string | null;
  stats: {
    totalSessions: number;
    totalProblems: number;
    streakDays: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface UserRecord {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async findById(id: string): Promise<UserProfile> {
    const user = await this.db.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
      where: (table, { and, eq, isNull }) => and(eq(table.id, id), isNull(table.deletedAt)),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserProfile(user);
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.db.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
      where: (table, { and, eq, isNull }) =>
        and(eq(table.email, normalizedEmail), isNull(table.deletedAt)),
    });

    if (!user) {
      return null;
    }

    return this.toUserProfile(user);
  }

  async create(_data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<UserProfile> {
    // TODO: Implement user creation
    throw new NotImplementedException();
  }

  async update(_id: string, _data: { name?: string; bio?: string }): Promise<UserProfile> {
    // TODO: Implement user profile update
    throw new NotImplementedException();
  }

  async delete(_id: string): Promise<void> {
    // TODO: Implement user soft delete
    throw new NotImplementedException();
  }

  private toUserProfile(user: UserRecord): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName ?? null,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      stats: {
        totalSessions: 0,
        totalProblems: 0,
        streakDays: 0,
      },
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
