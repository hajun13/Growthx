import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQuery } from './dto/search.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // 인증된 전 역할 — 결과는 서비스에서 visibilityScope 로 축소.
  // 응답: { data: { users: [...], departments: [...] } }
  @Get()
  search(@CurrentUser() user: AuthUser, @Query() query: SearchQuery) {
    return this.searchService.search(user, query.q, query.limit);
  }
}
