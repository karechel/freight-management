import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Principal } from './auth.decorators.js';
import { LoginThrottle } from './login-throttle.js';
import { hashPassword, verifyPassword } from './password.js';

export const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: Principal;
}

@Injectable()
export class AuthService {
  private readonly throttle = new LoginThrottle();
  // Compared against when the email is unknown, so timing does not reveal which emails exist.
  private readonly decoyHash = hashPassword('decoy password, never valid');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
    ip: string | undefined,
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const throttleKey = `${normalizedEmail}|${ip ?? 'unknown'}`;
    if (this.throttle.isBlocked(throttleKey)) {
      throw new HttpException(
        'Too many failed sign-in attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const users = this.prisma.client.orm.public.User;
    const user = await users.where({ email: normalizedEmail }).first();
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.decoyHash),
    );
    if (!user?.passwordHash || !passwordMatches || user.status !== 'active') {
      this.throttle.recordFailure(throttleKey);
      throw new UnauthorizedException('Invalid email or password.');
    }
    this.throttle.recordSuccess(throttleKey);

    await users.where({ id: user.id }).update({ lastLoginAt: new Date() });
    const principal = await this.loadPrincipal(user.id);
    if (!principal) throw new UnauthorizedException();
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      expiresIn: SESSION_LIFETIME_SECONDS,
      user: principal,
    };
  }

  /** The active user with their roles and permissions, or null when they may not sign in. */
  async loadPrincipal(userId: number): Promise<Principal | null> {
    const { orm } = this.prisma.client;
    const user = await orm.public.User.where({ id: userId }).first();
    if (!user || user.status !== 'active') return null;

    const links = await orm.public.UserRole.where({ userId }).all();
    const roleIds = links.map((link) => link.roleId);
    const principal: Principal = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: [],
      permissions: [],
    };
    if (roleIds.length === 0) return principal;

    const roles = await orm.public.Role.where((r) => r.id.in(roleIds)).all();
    const grants = await orm.public.RolePermission.where((g) =>
      g.roleId.in(roleIds),
    )
      .include('permission')
      .all();
    principal.roles = roles.map((role) => role.code).sort();
    principal.permissions = [
      ...new Set(grants.map((grant) => grant.permission.code)),
    ].sort();
    return principal;
  }
}
