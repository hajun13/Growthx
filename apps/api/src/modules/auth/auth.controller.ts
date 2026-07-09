import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, SsoDto } from './dto/login.dto';
import {
  AuthSessionDto,
  AuthTokensDto,
  LogoutResultDto,
} from './dto/auth-response.dto';
import { UserDto } from '../users/dto/user-response.dto';
import {
  ApiOkEnvelope,
} from '../../common/swagger/api-envelope.decorator';
import { Public } from '../../common/decorators/public';
import { AllowDuringPasswordChange } from '../../common/decorators/allow-password-change';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOkEnvelope(AuthSessionDto)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @ApiOkEnvelope(AuthTokensDto)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /** Keycloak access token → GrowthX 세션. AUTH_MODE=password 면 404. */
  @Public()
  @Post('sso')
  @ApiOkEnvelope(AuthSessionDto)
  sso(@Body() dto: SsoDto) {
    return this.authService.ssoLogin(dto.kcAccessToken);
  }

  @Get('me')
  @AllowDuringPasswordChange()
  @ApiOkEnvelope(UserDto)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  /** M3 Item1: 초기/일반 비밀번호 변경. 성공 시 새 토큰 + mustChangePassword=false. */
  @Post('change-password')
  @AllowDuringPasswordChange()
  @ApiOkEnvelope(AuthSessionDto)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  /** 클라이언트 로컬 토큰 폐기용. 서버 무상태 — 항상 200. */
  @Post('logout')
  @AllowDuringPasswordChange()
  @ApiOkEnvelope(LogoutResultDto)
  logout() {
    return { ok: true };
  }
}
