import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { PaginatedUsersResponseDto, UserResponseDto } from './dto/user.response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a tenant-scoped user.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiConflictResponse({ description: 'Username or email already exists in tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.create(request.auth!, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List users inside the current tenant.' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListUsersQueryDto
  ): Promise<PaginatedUsersResponseDto> {
    return this.usersService.list(request.auth!, query);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user role, status, or profile fields in current tenant.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'User not found in current tenant.' })
  @ApiConflictResponse({ description: 'Username or email already exists in tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.update(request.auth!, id, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Replace user role, status, and profile fields in current tenant.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'User not found in current tenant.' })
  @ApiConflictResponse({ description: 'Username or email already exists in tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  replace(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.update(request.auth!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete a user in current tenant by deactivating the account.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  remove(
    @Req() request: RequestWithAuth,
    @Param('id') id: string
  ): Promise<UserResponseDto> {
    return this.usersService.softDelete(request.auth!, id);
  }
}
