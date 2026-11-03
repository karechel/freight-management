import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticatedRequest,
  IS_PUBLIC_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './auth.decorators.js';
import { AuthService } from './auth.service.js';

/**
 * Registered globally: every endpoint requires a valid session unless marked @Public().
 * The user is reloaded on each request, so disabling them or changing a role applies at once.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    let userId: unknown;
    try {
      ({ sub: userId } = await this.jwt.verifyAsync<{ sub: unknown }>(token));
    } catch {
      throw new UnauthorizedException(
        'Your session is invalid or has expired.',
      );
    }
    const principal =
      typeof userId === 'number' ? await this.auth.loadPrincipal(userId) : null;
    if (!principal) {
      throw new UnauthorizedException(
        'Your session is invalid or has expired.',
      );
    }
    request.user = principal;

    const required =
      this.reflector.getAllAndOverride<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        targets,
      ) ?? [];
    if (!required.every((code) => principal.permissions.includes(code))) {
      throw new ForbiddenException('You do not have permission to do this.');
    }
    return true;
  }
}
