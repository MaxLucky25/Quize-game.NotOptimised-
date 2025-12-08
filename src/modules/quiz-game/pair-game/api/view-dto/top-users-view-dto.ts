import { UserStatistic } from '../../domain/entities/user-statistic.entity';

export class TopUsersViewDto {
  sumScore: number;
  avgScores: number;
  gamesCount: number;
  winsCount: number;
  lossesCount: number;
  drawsCount: number;
  player: {
    id: string;
    login: string;
  };

  static mapToView(stat: UserStatistic): TopUsersViewDto {
    return {
      sumScore: stat.sumScore,
      avgScores: stat.avgScores,
      gamesCount: stat.gamesCount,
      winsCount: stat.winsCount,
      lossesCount: stat.lossesCount,
      drawsCount: stat.drawsCount,
      player: {
        id: stat.userId,
        login: stat.user.login,
      },
    };
  }
}
