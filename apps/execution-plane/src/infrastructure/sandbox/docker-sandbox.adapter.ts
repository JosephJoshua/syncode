import { NotImplementedException } from '@nestjs/common';
import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from '@syncode/shared';
import type { ISandboxProvider } from '@syncode/shared/ports';

export class DockerSandboxAdapter implements ISandboxProvider {
  execute(_request: ExecutionRequest): Promise<ExecutionResult> {
    throw new NotImplementedException();
  }

  supportsLanguage(_language: string): _language is SupportedLanguage {
    throw new NotImplementedException();
  }

  healthCheck(): Promise<boolean> {
    throw new NotImplementedException();
  }

  shutdown(): Promise<void> {
    throw new NotImplementedException();
  }
}
