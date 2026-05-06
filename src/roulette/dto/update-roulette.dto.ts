import { PartialType } from '@nestjs/mapped-types';
import { CreateRouletteDto } from './create-roulette.dto';

export class UpdateRouletteDto extends PartialType(CreateRouletteDto) {}
