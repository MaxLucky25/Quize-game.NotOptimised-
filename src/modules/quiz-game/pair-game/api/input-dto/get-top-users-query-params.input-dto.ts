import {
  BaseQueryParams,
  SortDirection,
} from '../../../../../core/dto/base.query-params.input-dto';
import {
  ArrayNotEmpty,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Массив допустимых полей для сортировки в таблице лидеров
// as const делает массив readonly и позволяет TypeScript вывести точные типы строк
export const leaderboardSortableFields = [
  'avgScores', // средний балл
  'sumScore', // сумма баллов
  'winsCount', // количество побед
  'lossesCount', // количество поражений
  'gamesCount', // количество игр
  'drawsCount', // количество ничьих
] as const;

const buildDefaultSortCriteria = (): LeaderboardSortCriterionDto[] => [
  LeaderboardSortCriterionDto.parse('avgScores desc')!,
  LeaderboardSortCriterionDto.parse('sumScore desc')!,
];

// Создает union-тип из всех значений массива
// Результат: 'avgScores' | 'sumScore' | 'winsCount' | 'lossesCount' | 'gamesCount' | 'drawsCount'
export type LeaderboardSortField = (typeof leaderboardSortableFields)[number];

// Класс, описывающий один критерий сортировки
export class LeaderboardSortCriterionDto {
  // Поле, по которому сортируем (должно быть одним из допустимых полей)
  @IsIn(leaderboardSortableFields)
  field: LeaderboardSortField;

  // Направление сортировки: по возрастанию (asc) или убыванию (desc)
  @IsIn([SortDirection.Asc, SortDirection.Desc])
  direction: SortDirection;

  // Статический метод для парсинга строки в объект критерия сортировки
  // Принимает строку типа "avgScores desc" и разбирает её на поле и направление
  static parse(raw: unknown): LeaderboardSortCriterionDto | null {
    // Проверяем, что передана непустая строка
    if (!raw || typeof raw !== 'string') return null;

    // Разбиваем строку по пробелам: "avgScores desc" -> ["avgScores", "desc"]
    const [field, direction] = raw.trim().split(/\s+/);

    // Если не удалось получить оба значения, возвращаем null
    if (!field || !direction) return null;

    // Создаем новый объект DTO и заполняем его
    const dto = new LeaderboardSortCriterionDto();
    dto.field = field as LeaderboardSortField;
    dto.direction = direction.toLowerCase() as SortDirection;
    return dto;
  }
}

// Класс параметров запроса для получения списка лучших игроков
export class GetTopUsersQueryParams extends BaseQueryParams {
  // Поле необязательное (можно не передавать в запросе)
  @IsOptional()

  // Трансформация входных данных перед валидацией
  @Transform(({ value }) => {
    if (!value) {
      return buildDefaultSortCriteria();
    }

    // Если передано значение, преобразуем его в массив (если это не массив)
    // Это позволяет обрабатывать как одиночные значения, так и массивы
    const values = Array.isArray(value) ? value : [value];

    // Парсим каждую строку в объект LeaderboardSortCriterionDto
    // Фильтруем невалидные значения (где parse вернул null)
    return values
      .map((item) => LeaderboardSortCriterionDto.parse(item))
      .filter((item): item is LeaderboardSortCriterionDto => item !== null);
  })

  // Валидируем каждый элемент массива как вложенный объект
  @ValidateNested({ each: true })

  // Указываем тип для преобразования элементов массива
  @Type(() => LeaderboardSortCriterionDto)

  // Массив не должен быть пустым (должен быть хотя бы один критерий сортировки)
  @ArrayNotEmpty()
  sort: LeaderboardSortCriterionDto[] = buildDefaultSortCriteria();
}
