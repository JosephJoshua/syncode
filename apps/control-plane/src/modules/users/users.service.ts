import { Injectable, NotImplementedException } from '@nestjs/common';

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
}

@Injectable()
export class UsersService {
  async findById(_id: string): Promise<UserProfile> {
    // TODO: Implement user lookup by ID
    throw new NotImplementedException();
  }

  async findByEmail(_email: string): Promise<UserProfile | null> {
    // TODO: Implement user lookup by email
    throw new NotImplementedException();
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
