import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
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
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateReservationsBatchDto } from './dto/create-reservations-batch.dto';
import { ListReservationCountsQueryDto } from './dto/reservation-counts.query.dto';
import { ListReservationsQueryDto } from './dto/list-reservations.query.dto';
import {
  PaginatedReservationsResponseDto,
  ReservationCountsResponseDto,
  ReservationResponseDto
} from './dto/reservation.response.dto';
import { BatchReservationsResponseDto } from './dto/reservations-batch.response.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservations')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a single reservation in the current tenant.' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route path violation.' })
  @ApiConflictResponse({ description: 'Seat is already booked for overlapping route segment.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateReservationDto
  ): Promise<ReservationResponseDto> {
    return this.reservationsService.create(request.auth!, dto);
  }

  @Post('batch')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create multiple reservations in the current tenant.' })
  @ApiOkResponse({ type: BatchReservationsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route path violation.' })
  @ApiConflictResponse({ description: 'Seat overlap or route segment capacity exhaustion.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  createBatch(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateReservationsBatchDto
  ): Promise<BatchReservationsResponseDto> {
    return this.reservationsService.createBatch(request.auth!, dto);
  }

  @Get()
  @Throttle({ default: { limit: 1000, ttl: 60000 } })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'List reservations in the current tenant.' })
  @ApiOkResponse({ type: PaginatedReservationsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListReservationsQueryDto
  ): Promise<PaginatedReservationsResponseDto> {
    return this.reservationsService.list(request.auth!, query);
  }

  // Declared before `:id` so the literal segment is not swallowed by the param route.
  @Get('counts')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Count active reservations per ride instance over a travel-date window.'
  })
  @ApiOkResponse({ type: ReservationCountsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  counts(
    @Req() request: RequestWithAuth,
    @Query() query: ListReservationCountsQueryDto
  ): Promise<ReservationCountsResponseDto> {
    return this.reservationsService.countsByRideInstance(request.auth!, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get reservation detail by id in the current tenant.' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiNotFoundResponse({ description: 'Reservation not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<ReservationResponseDto> {
    return this.reservationsService.getById(request.auth!, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Update reservation in the current tenant.' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route path violation.' })
  @ApiConflictResponse({ description: 'Seat is already booked for overlapping route segment.' })
  @ApiNotFoundResponse({ description: 'Reservation not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto
  ): Promise<ReservationResponseDto> {
    return this.reservationsService.update(request.auth!, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Cancel reservation in the current tenant.' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiBadRequestResponse({ description: 'Reservation is already cancelled.' })
  @ApiNotFoundResponse({ description: 'Reservation not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  cancel(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<ReservationResponseDto> {
    return this.reservationsService.cancel(request.auth!, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Soft delete reservation in the current tenant.' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiNotFoundResponse({ description: 'Reservation not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  remove(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<ReservationResponseDto> {
    return this.reservationsService.softDelete(request.auth!, id);
  }
}
