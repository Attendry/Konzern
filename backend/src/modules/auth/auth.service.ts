import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'auditor' | 'preparer' | 'viewer';
  department?: string;
  phone?: string;
  avatarUrl?: string;
  preferences?: Record<string, any>;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  profile?: UserProfile;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  displayName?: string;
  role?: string;
}

@Injectable()
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Register a new user
   */
  async register(credentials: RegisterCredentials): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          full_name: credentials.displayName,
          role: credentials.role || 'viewer',
        },
      },
    });

    if (error) {
      throw new BadRequestException(`Registrierung fehlgeschlagen: ${error.message}`);
    }

    if (!data.user) {
      throw new BadRequestException('Benutzer konnte nicht erstellt werden');
    }

    return {
      id: data.user.id,
      email: data.user.email || '',
    };
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new UnauthorizedException(`Anmeldung fehlgeschlagen: ${error.message}`);
    }

    if (!data.user || !data.session) {
      throw new UnauthorizedException('Anmeldung fehlgeschlagen');
    }

    // Update last login
    await this.updateLastLogin(data.user.id);

    // Get profile
    const profile = await this.getProfile(data.user.id);

    return {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        profile,
      },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw new BadRequestException(`Abmeldung fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<AuthUser> {
    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Ungültiger Token');
    }

    const profile = await this.getProfile(user.id);

    return {
      id: user.id,
      email: user.email || '',
      profile,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Token konnte nicht erneuert werden');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return undefined;
    }

    return {
      id: data.id,
      email: data.email || '',
      displayName: data.display_name,
      role: data.role,
      department: data.department,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      preferences: data.preferences,
      lastLoginAt: data.last_login_at ? new Date(data.last_login_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
    if (updates.preferences !== undefined) updateData.preferences = updates.preferences;

    const { data, error } = await this.supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Profil konnte nicht aktualisiert werden: ${error.message}`);
    }

    return this.mapProfile(data);
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: UserProfile['role']): Promise<UserProfile> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Rolle konnte nicht aktualisiert werden: ${error.message}`);
    }

    return this.mapProfile(data);
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<UserProfile[]> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Benutzer konnten nicht geladen werden: ${error.message}`);
    }

    return (data || []).map(this.mapProfile);
  }

  /**
   * Check if user has required role
   */
  async hasRole(userId: string, requiredRoles: UserProfile['role'][]): Promise<boolean> {
    const profile = await this.getProfile(userId);
    if (!profile) return false;
    return requiredRoles.includes(profile.role);
  }

  /**
   * Update last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    await this.supabase
      .from('user_profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);
  }

  /**
   * Map database record to UserProfile
   */
  private mapProfile(data: any): UserProfile {
    return {
      id: data.id,
      email: data.email || '',
      displayName: data.display_name,
      role: data.role,
      department: data.department,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      preferences: data.preferences,
      lastLoginAt: data.last_login_at ? new Date(data.last_login_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
