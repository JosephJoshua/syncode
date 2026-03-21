import { Inject, Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import type { Database } from '@syncode/db';
import { DB_CLIENT } from '@/modules/db/db.module';

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async findById(id: string): Promise<UserProfile> {
    const user = await this.db.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
      where: (table, { and, eq, isNull }) => and(eq(table.id, id), isNull(table.deletedAt)),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? undefined,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.db.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
      where: (table, { and, eq, isNull }) =>
        and(eq(table.email, normalizedEmail), isNull(table.deletedAt)),
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? undefined,
      createdAt: user.createdAt.toISOString(),
    };
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
}
