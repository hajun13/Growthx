import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public';
import { AllowDuringPasswordChange } from '../../common/decorators/allow-password-change';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @AllowDuringPasswordChange()
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  /** M3 Item1: 초기/일반 비밀번호 변경. 성공 시 새 토큰 + mustChangePassword=false. */
  @Post('change-password')
  @AllowDuringPasswordChange()
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  /** 클라이언트 로컬 토큰 폐기용. 서버 무상태 — 항상 200. */
  @Post('logout')
  @AllowDuringPasswordChange()
  logout() {
    return { ok: true };
  }
}
