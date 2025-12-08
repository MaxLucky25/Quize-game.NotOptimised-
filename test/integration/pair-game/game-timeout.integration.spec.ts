/* eslint-disable */
import { TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { IntegrationTestHelper } from '../../helpers/integration-test-helper';
import { SubmitAnswerUseCase } from '../../../src/modules/quiz-game/pair-game/application/usecase/submit-answer.usecase';
import { SubmitAnswerCommand } from '../../../src/modules/quiz-game/pair-game/application/usecase/submit-answer.usecase';
import { ConnectToGameUseCase } from '../../../src/modules/quiz-game/pair-game/application/usecase/connect-to-game.usecase';
import { ConnectToGameCommand } from '../../../src/modules/quiz-game/pair-game/application/usecase/connect-to-game.usecase';
import { GetCurrentGameUseCase } from '../../../src/modules/quiz-game/pair-game/application/query-usecase/get-current-game.usecase';
import { GetCurrentGameQuery } from '../../../src/modules/quiz-game/pair-game/application/query-usecase/get-current-game.usecase';
import { PairGame } from '../../../src/modules/quiz-game/pair-game/domain/entities/pair-game.entity';
import { Player } from '../../../src/modules/quiz-game/pair-game/domain/entities/player.entity';
import { Question } from '../../../src/modules/quiz-game/questions/domain/entities/question.entity';
import { GameQuestion } from '../../../src/modules/quiz-game/pair-game/domain/entities/game-question.entity';
import { GameAnswer } from '../../../src/modules/quiz-game/pair-game/domain/entities/game-answer.entity';
import { GameStatus } from '../../../src/modules/quiz-game/pair-game/domain/dto/game-status.enum';
import { TestingService } from '../../../src/modules/testing/testing.service';
import { User } from '../../../src/modules/auth-manage/user-accounts/domain/entities/user.entity';
import { GameTimeoutService } from '../../../src/modules/quiz-game/pair-game/domain/services/game-timeout.service';
import { GAME_CONSTANTS } from '../../../src/modules/quiz-game/pair-game/domain/dto/game.constants';

describe('GameTimeoutService Integration', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let gameTimeoutService: GameTimeoutService;
  let submitAnswerUseCase: SubmitAnswerUseCase;
  let connectToGameUseCase: ConnectToGameUseCase;
  let getCurrentGameUseCase: GetCurrentGameUseCase;
  let pairGameRepository: Repository<PairGame>;
  let playerRepository: Repository<Player>;
  let questionRepository: Repository<Question>;
  let gameQuestionRepository: Repository<GameQuestion>;
  let gameAnswerRepository: Repository<GameAnswer>;
  let userRepository: Repository<User>;
  let testingService: TestingService;

  // Тестовые данные - ID пользователей (будут созданы в beforeEach)
  let userId1: string;
  let userId2: string;
  let gameId: string;
  let gameQuestions: GameQuestion[] = [];

  const questionData = [
    {
      body: 'What is 2+2?',
      correctAnswers: ['4', 'four'],
    },
    {
      body: 'What is the capital of France?',
      correctAnswers: ['Paris'],
    },
    {
      body: 'What is 5*3?',
      correctAnswers: ['15', 'fifteen'],
    },
    {
      body: 'What is the largest planet?',
      correctAnswers: ['Jupiter'],
    },
    {
      body: 'What is 10/2?',
      correctAnswers: ['5', 'five'],
    },
  ];

  beforeAll(async () => {
    const testSetup = await IntegrationTestHelper.createTestingModule();
    module = testSetup.module;
    dataSource = testSetup.dataSource;

    gameTimeoutService = module.get(GameTimeoutService);
    submitAnswerUseCase = module.get(SubmitAnswerUseCase);
    connectToGameUseCase = module.get(ConnectToGameUseCase);
    getCurrentGameUseCase = module.get(GetCurrentGameUseCase);
    pairGameRepository = dataSource.getRepository(PairGame);
    playerRepository = dataSource.getRepository(Player);
    questionRepository = dataSource.getRepository(Question);
    gameQuestionRepository = dataSource.getRepository(GameQuestion);
    gameAnswerRepository = dataSource.getRepository(GameAnswer);
    userRepository = dataSource.getRepository(User);
    testingService = module.get(TestingService);
  });

  afterAll(async () => {
    await IntegrationTestHelper.cleanup(module);
  });

  // Хелпер для создания активной игры
  async function createActiveGame(): Promise<void> {
    await connectToGameUseCase.execute(new ConnectToGameCommand(userId1));
    const game = await connectToGameUseCase.execute(
      new ConnectToGameCommand(userId2),
    );
    gameId = game.id;

    // Сохраняем вопросы игры для использования в тестах
    gameQuestions = await gameQuestionRepository.find({
      where: { gameId },
      relations: ['question'],
      order: { order: 'ASC' },
    });
  }

  // Хелпер для очистки только данных игры
  async function clearGameData(): Promise<void> {
    await Promise.all([
      gameAnswerRepository.createQueryBuilder().delete().execute(),
      gameQuestionRepository.createQueryBuilder().delete().execute(),
      playerRepository.createQueryBuilder().delete().execute(),
      pairGameRepository.createQueryBuilder().delete().execute(),
    ]);
  }

  // Флаг для отслеживания, были ли созданы пользователи и вопросы
  let usersAndQuestionsCreated = false;

  beforeEach(async () => {
    // Создаем пользователей и вопросы только один раз
    if (!usersAndQuestionsCreated) {
      await testingService.clearAllTables();
      const user1 = User.create({
        login: 'test-user-1',
        email: 'test1@test.com',
        passwordHash: 'hashedPassword1',
        emailConfirmationExpirationMinutes: 10,
      });
      user1.confirmEmail();

      const user2 = User.create({
        login: 'test-user-2',
        email: 'test2@test.com',
        passwordHash: 'hashedPassword2',
        emailConfirmationExpirationMinutes: 10,
      });
      user2.confirmEmail();

      const [savedUser1, savedUser2] = await Promise.all([
        userRepository.save(user1),
        userRepository.save(user2),
      ]);
      userId1 = savedUser1.id;
      userId2 = savedUser2.id;

      // Создаем вопросы параллельно
      const questionPromises = questionData.map((qData) => {
        const question = Question.create({
          body: qData.body,
          correctAnswers: qData.correctAnswers,
        });
        question.publish();
        return questionRepository.save(question);
      });
      await Promise.all(questionPromises);

      usersAndQuestionsCreated = true;
    } else {
      await clearGameData();
    }
  });

  describe('Game timeout after one player finishes', () => {
    beforeEach(async () => {
      await createActiveGame();
    });

    it('should set anyPlayerFinishedAt when first player finishes all questions', async () => {
      // Arrange
      const correctAnswers = gameQuestions.map(
        (gq) => gq.question.correctAnswers[0],
      );

      // Act - User1 отвечает на все вопросы
      for (const answer of correctAnswers) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId1, { answer }),
        );
      }

      // Assert - проверяем, что anyPlayerFinishedAt установлен
      const gameInDb = await pairGameRepository.findOne({
        where: { id: gameId },
      });

      expect(gameInDb!.anyPlayerFinishedAt).not.toBeNull();
      expect(gameInDb!.status).toBe(GameStatus.ACTIVE);
    });

    it('should finish game automatically after timeout when one player finished', async () => {
      // Arrange - User1 отвечает на все вопросы
      const correctAnswers = gameQuestions.map(
        (gq) => gq.question.correctAnswers[0],
      );

      for (const answer of correctAnswers) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId1, { answer }),
        );
      }

      // Проверяем, что anyPlayerFinishedAt установлен
      const gameBeforeTimeout = await pairGameRepository.findOne({
        where: { id: gameId },
      });
      expect(gameBeforeTimeout!.anyPlayerFinishedAt).not.toBeNull();

      // Устанавливаем anyPlayerFinishedAt в прошлое (11 секунд назад) для симуляции таймаута
      const timeoutDate = new Date(
        Date.now() - GAME_CONSTANTS.TIMEOUT_MS - 1000,
      );
      await pairGameRepository.update(
        { id: gameId },
        { anyPlayerFinishedAt: timeoutDate },
      );

      // Act - вызываем метод проверки таймаута напрямую
      await gameTimeoutService.checkAndFinishTimedOutGames();

      // Assert - проверяем, что игра завершена
      const gameInDb = await pairGameRepository.findOne({
        where: { id: gameId },
        relations: ['players', 'players.answers'],
      });

      expect(gameInDb!.status).toBe(GameStatus.FINISHED);
      expect(gameInDb!.finishGameDate).not.toBeNull();

      // Проверяем, что для второго игрока созданы ответы на все вопросы
      const secondPlayer = gameInDb!.players.find((p) => p.userId === userId2);
      expect(secondPlayer).not.toBeNull();
      expect(secondPlayer!.finishedAt).not.toBeNull();

      // Проверяем, что созданы ответы на все неотвеченные вопросы
      const secondPlayerAnswers = await gameAnswerRepository.find({
        where: { playerId: secondPlayer!.id },
        relations: ['gameQuestion'],
      });

      expect(secondPlayerAnswers.length).toBe(5);
      // Все созданные ответы должны быть неправильными
      secondPlayerAnswers.forEach((answer) => {
        expect(answer.isCorrect).toBe(false);
        expect(answer.answer).toBe(''); // Пустой ответ
      });

      // Проверяем, что активной игры больше нет
      await expect(
        getCurrentGameUseCase.execute(new GetCurrentGameQuery(userId1)),
      ).rejects.toThrow('No active pair for current user');

      await expect(
        getCurrentGameUseCase.execute(new GetCurrentGameQuery(userId2)),
      ).rejects.toThrow('No active pair for current user');
    });

    it('should create incorrect answers only for unanswered questions', async () => {
      // Arrange - User1 отвечает на все вопросы, User2 отвечает на 2 вопроса
      const correctAnswers = gameQuestions.map(
        (gq) => gq.question.correctAnswers[0],
      );

      // User1 отвечает на все вопросы
      for (const answer of correctAnswers) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId1, { answer }),
        );
      }

      // User2 отвечает только на первые 2 вопроса
      for (let i = 0; i < 2; i++) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId2, { answer: correctAnswers[i] }),
        );
      }

      // Устанавливаем anyPlayerFinishedAt в прошлое для симуляции таймаута
      const timeoutDate = new Date(
        Date.now() - GAME_CONSTANTS.TIMEOUT_MS - 1000,
      );
      await pairGameRepository.update(
        { id: gameId },
        { anyPlayerFinishedAt: timeoutDate },
      );

      // Act - вызываем метод проверки таймаута
      await gameTimeoutService.checkAndFinishTimedOutGames();

      // Assert - проверяем ответы второго игрока
      const secondPlayer = await playerRepository.findOne({
        where: { userId: userId2, gameId },
        relations: ['answers'],
      });

      expect(secondPlayer!.answers.length).toBe(5); // Все 5 вопросов

      // Первые 2 ответа должны быть правильными (отвечены до таймаута)
      const answeredQuestions = secondPlayer!.answers
        .filter((a) => a.answer !== '')
        .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
      expect(answeredQuestions.length).toBe(2);
      answeredQuestions.forEach((answer) => {
        expect(answer.isCorrect).toBe(true);
      });

      // Последние 3 ответа должны быть неправильными (созданы по таймауту)
      const timeoutAnswers = secondPlayer!.answers
        .filter((a) => a.answer === '')
        .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
      expect(timeoutAnswers.length).toBe(3);
      timeoutAnswers.forEach((answer) => {
        expect(answer.isCorrect).toBe(false);
      });

      // Проверяем счет второго игрока (только правильные ответы)
      expect(secondPlayer!.score).toBe(2);
    });

    it('should not finish game if timeout has not passed yet', async () => {
      // Arrange - User1 отвечает на все вопросы
      const correctAnswers = gameQuestions.map(
        (gq) => gq.question.correctAnswers[0],
      );

      for (const answer of correctAnswers) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId1, { answer }),
        );
      }

      // Устанавливаем anyPlayerFinishedAt в недавнее прошлое (5 секунд назад, меньше таймаута)
      const recentDate = new Date(Date.now() - 5000);
      await pairGameRepository.update(
        { id: gameId },
        { anyPlayerFinishedAt: recentDate },
      );

      // Act - вызываем метод проверки таймаута
      await gameTimeoutService.checkAndFinishTimedOutGames();

      // Assert - игра должна остаться активной
      const gameInDb = await pairGameRepository.findOne({
        where: { id: gameId },
      });

      expect(gameInDb!.status).toBe(GameStatus.ACTIVE);
      expect(gameInDb!.finishGameDate).toBeNull();
    });

    it('should not finish game if both players finished', async () => {
      // Arrange - оба игрока отвечают на все вопросы
      const correctAnswers = gameQuestions.map(
        (gq) => gq.question.correctAnswers[0],
      );

      // User1 отвечает на все вопросы
      for (const answer of correctAnswers) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId1, { answer }),
        );
      }

      // User2 отвечает на все вопросы (до таймаута)
      for (const answer of correctAnswers) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId2, { answer }),
        );
      }

      // Assert - игра должна быть завершена обычным способом (не по таймауту)
      const gameInDb = await pairGameRepository.findOne({
        where: { id: gameId },
      });

      expect(gameInDb!.status).toBe(GameStatus.FINISHED);
      expect(gameInDb!.finishGameDate).not.toBeNull();

      // Проверяем, что для второго игрока НЕ созданы пустые ответы
      const secondPlayer = await playerRepository.findOne({
        where: { userId: userId2, gameId },
        relations: ['answers'],
      });

      const emptyAnswers = secondPlayer!.answers.filter((a) => a.answer === '');
      expect(emptyAnswers.length).toBe(0); // Не должно быть пустых ответов
    });

    it('should calculate correct scores after timeout', async () => {
      // Arrange - User1 отвечает на все вопросы правильно
      // User2 отвечает на 2 вопроса правильно, остальные не отвечает
      const correctAnswers = gameQuestions.map(
        (gq) => gq.question.correctAnswers[0],
      );

      // User1 отвечает на все вопросы правильно
      for (const answer of correctAnswers) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId1, { answer }),
        );
      }

      // User2 отвечает на первые 2 вопроса правильно
      for (let i = 0; i < 2; i++) {
        await submitAnswerUseCase.execute(
          new SubmitAnswerCommand(userId2, { answer: correctAnswers[i] }),
        );
      }

      // Устанавливаем anyPlayerFinishedAt в прошлое для симуляции таймаута
      const timeoutDate = new Date(
        Date.now() - GAME_CONSTANTS.TIMEOUT_MS - 1000,
      );
      await pairGameRepository.update(
        { id: gameId },
        { anyPlayerFinishedAt: timeoutDate },
      );

      // Act - вызываем метод проверки таймаута
      await gameTimeoutService.checkAndFinishTimedOutGames();

      // Assert - проверяем счета игроков
      const players = await playerRepository.find({
        where: { gameId },
        relations: ['answers'],
      });

      const firstPlayer = players.find((p) => p.userId === userId1);
      const secondPlayer = players.find((p) => p.userId === userId2);

      expect(firstPlayer).not.toBeNull();
      expect(secondPlayer).not.toBeNull();

      // Первый игрок: 5 правильных ответов + 1 бонус (закончил первым)
      expect(firstPlayer!.score).toBe(5);
      expect(firstPlayer!.bonus).toBe(1); // Бонус дается игроку, который закончил первым
      expect(firstPlayer!.score + firstPlayer!.bonus).toBe(6);

      // Второй игрок: 2 правильных ответа, остальные неправильные (созданы по таймауту)
      expect(secondPlayer!.score).toBe(2);
      expect(secondPlayer!.bonus).toBe(0);
      expect(secondPlayer!.score + secondPlayer!.bonus).toBe(2);
    });
  });
});
