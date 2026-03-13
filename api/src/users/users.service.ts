import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AccessTokenPayload } from '../auth/auth.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { PaginatedUsersResponseDto, UserResponseDto } from './dto/user.response.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type SafeUserSelect = {
  id: true;
  tenantId: true;
  username: true;
  email: true;
  role: true;
  isActive: true;
  createdAt: true;
  updatedAt: true;
};

@Injectable()
export class UsersService {
  private readonly safeUserSelect: SafeUserSelect = {
    id: true,
    tenantId: true,
    username: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true
  };

  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateUserDto): Promise<UserResponseDto> {
    this.assertCreateRoleAllowed(dto.role);

    const normalizedUsername = dto.username.trim();
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      return await this.prisma.user.create({
        data: {
          tenantId: auth.tenantId,
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash: await hash(dto.password, 10),
          role: dto.role,
          isActive: true
        },
        select: this.safeUserSelect
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  async list(auth: AccessTokenPayload, query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);

    const where = {
      tenantId: auth.tenantId,
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: this.safeUserSelect
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items,
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async update(auth: AccessTokenPayload, id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    if (id === auth.sub && dto.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    if (id === auth.sub && dto.role && dto.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You cannot demote your own role');
    }

    if (dto.role) {
      this.assertCreateRoleAllowed(dto.role);
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId: auth.tenantId
      },
      select: {
        id: true
      }
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const data: {
      username?: string;
      email?: string;
      role?: UserRole;
      isActive?: boolean;
    } = {};

    if (typeof dto.username === 'string') {
      data.username = dto.username.trim();
    }

    if (typeof dto.email === 'string') {
      data.email = dto.email.trim().toLowerCase();
    }

    if (dto.role) {
      data.role = dto.role;
    }

    if (typeof dto.isActive === 'boolean') {
      data.isActive = dto.isActive;
    }

    try {
      return await this.prisma.user.update({
        where: {
          id
        },
        data,
        select: this.safeUserSelect
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  private assertCreateRoleAllowed(role: UserRole): void {
    if (role === UserRole.ADMIN) {
      throw new ForbiddenException('Assigning ADMIN role is not allowed in this endpoint');
    }
  }

  private throwIfUniqueConstraint(error: unknown): void {
    const prismaError = error as {
      code?: string;
      meta?: {
        target?: string[];
      };
    };

    if (prismaError?.code !== 'P2002') {
      return;
    }

    const targets = prismaError.meta?.target ?? [];
    if (targets.includes('username') || targets.includes('tenantId') || targets.includes('tenantId_username')) {
      throw new ConflictException('Username already exists in this tenant');
    }

    if (targets.includes('email') || targets.includes('tenantId_email')) {
      throw new ConflictException('Email already exists in this tenant');
    }

    throw new ConflictException('User unique constraint violated in this tenant');
  }
}
