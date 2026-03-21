import { Injectable, NotImplementedException } from '@nestjs/common';
import type { LoginResponse } from '@syncode/contracts';

@Injectable()
export class AuthService {
  async register(_email: string, _password: string): Promise<{ accessToken: string }> {
    // TODO: Implement user registration
    throw new NotImplementedException();
  }

  async login(_identifier: string, _password: string): Promise<LoginResponse> {
    // TODO: Implement user login
    throw new NotImplementedException();
  }

  async refreshToken(_refreshToken: string): Promise<{ accessToken: string }> {
    // TODO: Implement token refresh
    throw new NotImplementedException();
  }
}
