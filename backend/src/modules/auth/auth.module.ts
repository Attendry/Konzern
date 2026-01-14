import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseAuthGuard],
  exports: [AuthService, SupabaseAuthGuard],
})
export class AuthModule {}
