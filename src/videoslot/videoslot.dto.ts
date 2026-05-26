// videoslot.dto.ts
import { IsInt, IsArray, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class PlayVideoSlotDto {
  @IsInt()
  @Min(1)
  bet!: number;

  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @Min(1, { each: true })
  @Max(15, { each: true })
  lines!: number[]; // Масив ID ліній, на які робиться ставка (від 1 до 15)
}
