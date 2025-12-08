import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/base.paginated.view-dto';
import { GetTopUsersQueryParams } from '../../api/input-dto/get-top-users-query-params.input-dto';
import { TopUsersViewDto } from '../../api/view-dto/top-users-view-dto';
import { UserStatisticRepository } from '../../infrastructure/user-statistic.repository';

export class GetTopUsersQuery {
  constructor(public readonly queryParams: GetTopUsersQueryParams) {}
}

@QueryHandler(GetTopUsersQuery)
export class GetTopUsersUseCase
  implements
    IQueryHandler<GetTopUsersQuery, PaginatedViewDto<TopUsersViewDto[]>>
{
  constructor(
    private readonly userStatisticRepository: UserStatisticRepository,
  ) {}

  async execute(
    query: GetTopUsersQuery,
  ): Promise<PaginatedViewDto<TopUsersViewDto[]>> {
    const { queryParams } = query;
    const [stats, totalCount] = await this.userStatisticRepository.findTopUsers(
      queryParams.pageSize,
      queryParams.calculateSkip(),
      queryParams.sort,
    );

    const items = stats.map((stat) => TopUsersViewDto.mapToView(stat));

    return PaginatedViewDto.mapToView({
      items,
      totalCount,
      page: queryParams.pageNumber,
      size: queryParams.pageSize,
    });
  }
}
