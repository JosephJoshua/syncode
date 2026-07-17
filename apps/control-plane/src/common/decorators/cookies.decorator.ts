import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const Cookies = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ cookies?: Record<string, string> }>();
  const cookies = request.cookies ?? {};
  return data ? cookies[data] : cookies;
});
