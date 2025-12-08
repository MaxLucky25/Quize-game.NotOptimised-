import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, SelectQueryBuilder } from 'typeorm';
import { UserStatistic } from '../domain/entities/user-statistic.entity';
import { LeaderboardSortCriterionDto } from '../api/input-dto/get-top-users-query-params.input-dto';

@Injectable()
export class UserStatisticRepository {
  constructor(
    @InjectRepository(UserStatistic)
    private readonly repository: Repository<UserStatistic>,
  ) {}

  /**
   * Получить статистику пользователя по userId
   *
   * @usedIn GetUserStatisticUseCase - получение статистики для API
   */
  async findByUserId(userId: string): Promise<UserStatistic | null> {
    return await this.repository.findOne({
      where: { userId },
    });
  }

  /**
   * Получить статистику пользователя или создать пустую если её нет
   * Используется для API когда нужно всегда вернуть статистику
   *
   * @usedIn GetUserStatisticUseCase - получение статистики для API ответа
   */
  async getOrCreateEmptyStatistic(userId: string): Promise<UserStatistic> {
    const statistic = await this.findByUserId(userId);

    if (!statistic) {
      // Создаем временный объект с дефолтными значениями (НЕ сохраняем в БД)
      return UserStatistic.create(userId);
    }

    return statistic;
  }

  /**
   * Обновить статистику после завершения игры
   * Использует upsert логику - создает новую статистику если её нет
   *
   * @usedIn AnswerSubmissionService.checkAndFinishGame - обновление статистики после игры
   */
  async updateStatisticAfterGame(
    userId: string,
    playerScore: number,
    opponentScore: number,
    manager: EntityManager,
  ): Promise<void> {
    // Ищем существующую статистику в рамках транзакции
    let statistic = await manager.findOne(UserStatistic, {
      where: { userId },
    });

    // Если статистики нет - создаем новую
    if (!statistic) {
      statistic = UserStatistic.create(userId);
    }

    // Обновляем статистику с результатами игры
    statistic.updateAfterGame(playerScore, opponentScore);

    // Сохраняем в рамках транзакции
    await manager.save(UserStatistic, statistic);
  }

  /**
   * Получить список топовых пользователей с сортировкой и пагинацией.
   *
   * @usedIn GetTopUsersUseCase - новый leaderboard endpoint.
   */
  async findTopUsers(
    pageSize: number,
    skip: number,
    sort: LeaderboardSortCriterionDto[],
  ): Promise<[UserStatistic[], number]> {
    const queryBuilder = this.repository
      .createQueryBuilder('stat')
      .leftJoinAndSelect('stat.user', 'user')
      .take(pageSize)
      .skip(skip);

    this.applySorting(queryBuilder, sort);

    return await queryBuilder.getManyAndCount();
  }

  /**
   * Применяет множественную сортировку к query builder
   */
  private applySorting(
    qb: SelectQueryBuilder<UserStatistic>,
    sort: LeaderboardSortCriterionDto[],
  ): void {
    sort.forEach((criterion, index) => {
      // Преобразуем направление в верхний регистр для SQL ('asc' -> 'ASC')
      const direction = criterion.direction.toUpperCase() as 'ASC' | 'DESC';

      // Определяем колонку для сортировки
      const column = `stat.${criterion.field}`;

      // Первый критерий добавляем через orderBy
      if (index === 0) {
        qb.orderBy(column, direction);
      } else {
        // Последующие критерии добавляем через addOrderBy
        qb.addOrderBy(column, direction);
      }
    });
  }
}
