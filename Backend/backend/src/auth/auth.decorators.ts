import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions';

/** The signed-in user, loaded from the database on every request. */
export interface Principal {
  id: number;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  ip?: string;
  user?: Principal;
}

/** Opens an endpoint to anonymous callers. Everything else requires a valid session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires the signed-in user to hold all the given permission codes. */
export const RequirePermission = (...codes: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, codes);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user!;
  },
);
