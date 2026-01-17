import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, UserProfile } from './auth.service';

// Decorator to mark routes as public (no auth required)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Decorator to require specific roles
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserProfile['role'][]) =>
  SetMetadata(ROLES_KEY, roles);

// Decorator to get current user in controller
export const CurrentUser = () => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    // This is handled by the guard setting request.user
  };
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Kein Authentifizierungstoken gefunden');
    }

    try {
      const user = await this.authService.validateToken(token);

      // Attach user to request for use in controllers
      request.user = user;

      // Check for required roles
      const requiredRoles = this.reflector.getAllAndOverride<
        UserProfile['role'][]
      >(ROLES_KEY, [context.getHandler(), context.getClass()]);

      if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = await this.authService.hasRole(user.id, requiredRoles);
        if (!hasRole) {
          throw new UnauthorizedException('Unzureichende Berechtigungen');
        }
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}

// Request interface extension for TypeScript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        profile?: UserProfile;
      };
    }
  }
}
