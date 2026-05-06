import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '../../prisma/generated/prisma/client';

import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private walletService: WalletService) {}

  async create(data: CreateUserDto): Promise<User> {
    let user;
    try {
      user = await this.prisma.user.create({ data });
      await this.walletService.createWallet(user.id);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error; // Rethrow the error after logging
    }
    return user;
  }

  async confirmEmail(id: number) {
    await this.prisma.user.update({
      where: { id },
      data: { role: 1 },
    });
    return { success: true, message: 'Email was confirmed' };
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
