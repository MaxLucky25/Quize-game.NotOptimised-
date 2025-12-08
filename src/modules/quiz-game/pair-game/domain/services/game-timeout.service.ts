import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { PairGame } from '../entities/pair-game.entity';
import { Player } from '../entities/player.entity';
import { GameAnswer } from '../entities/game-answer.entity';
import { GameQuestion } from '../entities/game-question.entity';
import { GameStatus } from '../dto/game-status.enum';
import { GAME_CONSTANTS } from '../dto/game.constants';
import { PairGameRepository } from '../../infrastructure/pair-game.repository';
import { PlayerRepository } from '../../infrastructure/player.repository';
import { UserStatisticRepository } from '../../infrastructure/user-statistic.repository';

@Injectable()
export class GameTimeoutService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly pairGameRepository: PairGameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly userStatisticRepository: UserStatisticRepository,
  ) {}

  /**
   * Проверяет игры на таймаут каждые 2 секунды
   * Находит игры, где один игрок закончил, второй нет, и прошло >10 секунд
   */
  @Cron('*/2 * * * * *')
  async checkAndFinishTimedOutGames(): Promise<void> {
    // Оптимизированный запрос: загружаем только игроков (без questions и answers)
    // EXISTS подзапросы эффективны с индексами на players.finished_at
    // Используем Date объект для надежного сравнения времени
    const timeoutDate = new Date(Date.now() - GAME_CONSTANTS.TIMEOUT_MS);

    const games = await this.dataSource
      .createQueryBuilder(PairGame, 'game')
      .leftJoinAndSelect('game.players', 'players')
      .where('game.status = :status', { status: GameStatus.ACTIVE })
      .andWhere('game.anyPlayerFinishedAt IS NOT NULL')
      .andWhere('game.anyPlayerFinishedAt < :timeoutDate', { timeoutDate })
      .andWhere(
        `EXISTS (
          SELECT 1 FROM players p1 
          WHERE p1.game_id = game.id 
          AND p1.finished_at IS NOT NULL
        ) AND EXISTS (
          SELECT 1 FROM players p2 
          WHERE p2.game_id = game.id 
          AND p2.finished_at IS NULL
        )`,
      )
      .getMany();

    for (const game of games) {
      // SQL запрос уже фильтрует игры с одним закончившим и одним незакончившим игроком
      // Находим незакончившего игрока
      const unfinishedPlayer = game.players.find((p) => !p.hasFinished());

      if (unfinishedPlayer) {
        // Завершаем игру по таймауту
        await this.finishGameByTimeout(game, unfinishedPlayer);
      }
    }
  }

  /**
   * Завершает игру по таймауту
   * Создает неотвеченные ответы как неправильные для незавершившего игрока
   */
  private async finishGameByTimeout(
    game: PairGame,
    unfinishedPlayer: Player,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Загружаем вопросы игры
      const gameQuestions = await manager.find(GameQuestion, {
        where: { gameId: game.id },
        order: { order: 'ASC' },
      });

      // Находим неотвеченные вопросы
      const answeredQuestionIds = new Set(
        (unfinishedPlayer.answers || []).map((a) => a.gameQuestionId),
      );

      const unansweredQuestions = gameQuestions.filter(
        (gq) => !answeredQuestionIds.has(gq.id),
      );

      // Создаем неправильные ответы для неотвеченных вопросов
      const missingAnswers = unansweredQuestions.map((gq) =>
        GameAnswer.create({
          gameQuestionId: gq.id,
          playerId: unfinishedPlayer.id,
          answer: '', // Пустой ответ для неотвеченных вопросов
          isCorrect: false,
        }),
      );

      if (missingAnswers.length > 0) {
        await manager.save(GameAnswer, missingAnswers);
      }

      // Обновляем счет игрока (учитываем только правильные ответы)
      // Счет уже должен быть правильным, так как он обновлялся при каждом ответе
      // Но нужно установить finishedAt
      if (!unfinishedPlayer.finishedAt) {
        unfinishedPlayer.finish();
        await manager.update(
          Player,
          { id: unfinishedPlayer.id },
          {
            finishedAt: unfinishedPlayer.finishedAt,
          },
        );
      }

      // Перезагружаем игроков с обновленными данными (включая новые ответы)
      const reloadedPlayers = await manager.find(Player, {
        where: { gameId: game.id },
        relations: ['answers'],
      });

      const firstPlayer = reloadedPlayers.find((p) => p.isFirstPlayer());
      const secondPlayer = reloadedPlayers.find((p) => p.isSecondPlayer());

      if (firstPlayer && secondPlayer) {
        // Используем общий метод для завершения игры
        await this.finishGameWithPlayers(
          game,
          firstPlayer,
          secondPlayer,
          manager,
        );
      }
    });
  }

  /**
   * Общий метод для завершения игры с вычислением бонусов и обновлением статистики
   * Используется как при обычном завершении (оба игрока закончили),
   * так и при завершении по таймауту
   *
   * @usedIn finishGameByTimeout, AnswerSubmissionService.checkAndFinishGame
   */
  async finishGameWithPlayers(
    game: PairGame,
    firstPlayer: Player,
    secondPlayer: Player,
    manager: EntityManager,
  ): Promise<void> {
    // Вычисляем бонусы (только если оба закончили)
    if (firstPlayer.finishedAt && secondPlayer.finishedAt) {
      const fasterPlayer =
        firstPlayer.finishedAt < secondPlayer.finishedAt
          ? firstPlayer
          : secondPlayer;

      if (fasterPlayer.score > 0) {
        fasterPlayer.awardBonus();
      }

      await this.playerRepository.savePlayers(
        [firstPlayer, secondPlayer],
        manager,
      );
    }

    // Завершаем игру
    await this.pairGameRepository.finishGame(game, manager);

    // Обновляем статистику
    const firstPlayerScore =
      (firstPlayer.score || 0) + (firstPlayer.bonus || 0);
    const secondPlayerScore =
      (secondPlayer.score || 0) + (secondPlayer.bonus || 0);

    await this.userStatisticRepository.updateStatisticAfterGame(
      firstPlayer.userId,
      firstPlayerScore,
      secondPlayerScore,
      manager,
    );

    await this.userStatisticRepository.updateStatisticAfterGame(
      secondPlayer.userId,
      secondPlayerScore,
      firstPlayerScore,
      manager,
    );
  }
}
