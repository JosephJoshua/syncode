import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  async register(_email: string, _password: string): Promise<{ accessToken: string }> {
    // TODO: Implement user registration
    throw new NotImplementedException();
  }

  async login(
    _email: string,
    _password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // TODO: Implement user login
    throw new NotImplementedException();
  }

  async refreshToken(_refreshToken: string): Promise<{ accessToken: string }> {
    // TODO: Implement token refresh
    throw new NotImplementedException();
  }
}
