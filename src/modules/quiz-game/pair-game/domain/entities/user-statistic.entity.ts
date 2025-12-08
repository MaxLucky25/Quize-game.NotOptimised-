import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../../auth-manage/user-accounts/domain/entities/user.entity';

@Entity('user_statistics')
@Index(['userId'], { unique: true }) // один пользователь = одна статистика
export class UserStatistic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'sum_score', default: 0 })
  sumScore: number;

  @Column({ name: 'games_count', default: 0 })
  gamesCount: number;

  @Column({ name: 'wins_count', default: 0 })
  winsCount: number;

  @Column({ name: 'losses_count', default: 0 })
  lossesCount: number;

  @Column({ name: 'draws_count', default: 0 })
  drawsCount: number;

  @Column({
    name: 'avg_score',
    type: 'double precision',
    default: 0,
  })
  avgScores: number;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
  })
  updatedAt: Date;

  /**
   * Статический метод для создания новой статистики
   */
  static create(userId: string): UserStatistic {
    const statistic = new UserStatistic();
    statistic.userId = userId;
    // Явная инициализация для избежания NaN
    statistic.avgScores = 0;
    statistic.sumScore = 0;
    statistic.gamesCount = 0;
    statistic.winsCount = 0;
    statistic.lossesCount = 0;
    statistic.drawsCount = 0;
    return statistic;
  }

  /**
   * Обновить статистику после завершения игры
   *
   * @param playerScore - счет текущего игрока (score + bonus)
   * @param opponentScore - счет противника (score + bonus)
   */
  updateAfterGame(playerScore: number, opponentScore: number): void {
    this.sumScore += playerScore;
    this.gamesCount += 1;

    if (playerScore > opponentScore) {
      this.winsCount += 1;
    } else if (playerScore < opponentScore) {
      this.lossesCount += 1;
    } else {
      this.drawsCount += 1;
    }

    this.recalculateAvgScore();
  }

  recalculateAvgScore(): void {
    if (this.gamesCount === 0) {
      this.avgScores = 0;
      return;
    }

    const rawAvg = this.sumScore / this.gamesCount;
    this.avgScores = Number.isInteger(rawAvg)
      ? rawAvg
      : Math.round(rawAvg * 100) / 100;
  }
}
