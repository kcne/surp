import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import {
  CheckPassengerDuplicatesDto,
  PassengerDuplicatesResponseDto
} from './dto/check-passenger-duplicates.dto';
import { CreatePassengerDto } from './dto/create-passenger.dto';
import { ListPassengersQueryDto } from './dto/list-passengers.query.dto';
import {
  PaginatedPassengersResponseDto,
  PassengerResponseDto
} from './dto/passenger.response.dto';
import { UpdatePassengerDto } from './dto/update-passenger.dto';
import { PassengersService } from './passengers.service';

@ApiTags('Passengers')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('passengers')
export class PassengersController {
  constructor(private readonly passengersService: PassengersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a passenger in the current tenant.' })
  @ApiOkResponse({ type: PassengerResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(
    @Req() request: RequestWithAuth,
    @Body() dto: CreatePassengerDto
  ): Promise<PassengerResponseDto> {
    return this.passengersService.create(request.auth!, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'List passengers in the current tenant.' })
  @ApiOkResponse({ type: PaginatedPassengersResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListPassengersQueryDto
  ): Promise<PaginatedPassengersResponseDto> {
    return this.passengersService.list(request.auth!, query);
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Search passengers by first name, last name, phone, or email.' })
  @ApiOkResponse({ type: PaginatedPassengersResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  search(
    @Req() request: RequestWithAuth,
    @Query() query: ListPassengersQueryDto
  ): Promise<PaginatedPassengersResponseDto> {
    return this.passengersService.search(request.auth!, query);
  }

  @Post('check-duplicates')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary:
      'Find existing passengers that match the supplied full name or phone (diacritic-insensitive).'
  })
  @ApiOkResponse({ type: PassengerDuplicatesResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  checkDuplicates(
    @Req() request: RequestWithAuth,
    @Body() dto: CheckPassengerDuplicatesDto
  ): Promise<PassengerDuplicatesResponseDto> {
    return this.passengersService.checkDuplicates(request.auth!, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get passenger detail by id in the current tenant.' })
  @ApiOkResponse({ type: PassengerResponseDto })
  @ApiNotFoundResponse({ description: 'Passenger not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<PassengerResponseDto> {
    return this.passengersService.getById(request.auth!, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Update passenger fields in the current tenant.' })
  @ApiOkResponse({ type: PassengerResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Passenger not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdatePassengerDto
  ): Promise<PassengerResponseDto> {
    return this.passengersService.update(request.auth!, id, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Replace passenger fields in the current tenant.' })
  @ApiOkResponse({ type: PassengerResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Passenger not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  replace(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdatePassengerDto
  ): Promise<PassengerResponseDto> {
    return this.passengersService.update(request.auth!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a passenger in the current tenant.' })
  @ApiOkResponse({ type: PassengerResponseDto })
  @ApiNotFoundResponse({ description: 'Passenger not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  remove(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<PassengerResponseDto> {
    return this.passengersService.remove(request.auth!, id);
  }
}
