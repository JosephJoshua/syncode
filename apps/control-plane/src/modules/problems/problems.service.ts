import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class ProblemsService {
  async findAll(_filters?: { difficulty?: string; tags?: string[] }) {
    // TODO: Implement problem listing with filters
    throw new NotImplementedException();
  }

  async findById(_id: string) {
    // TODO: Implement problem lookup by ID
    throw new NotImplementedException();
  }

  async create(_data: {
    title: string;
    description: string;
    difficulty: string;
    testCases: unknown[];
  }) {
    // TODO: Implement problem creation
    throw new NotImplementedException();
  }

  async update(_id: string, _data: Partial<{ title: string; description: string }>) {
    // TODO: Implement problem update
    throw new NotImplementedException();
  }

  async delete(_id: string) {
    // TODO: Implement problem deletion
    throw new NotImplementedException();
  }
}
