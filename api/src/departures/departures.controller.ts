import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { WouldBreakReservationsDto } from '../rides/dto/would-break-reservations.dto';
import { DepartureListResponseDto, DepartureResponseDto } from './dto/departure.response.dto';
import {
  CancelDepartureDto,
  CreateExtraDepartureDto,
  UpdateExtraDepartureDto
} from './dto/departure-operations.dto';
import { ListDeparturesQueryDto } from './dto/list-departures.query.dto';
import { DepartureOperationRefusalDto } from './dto/departure-operation-refusal.dto';
import { DeparturesService } from './departures.service';

@ApiTags('Departures')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('departures')
export class DeparturesController {
  constructor(private readonly departuresService: DeparturesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DRIVER)
  @ApiOperation({
    summary:
      'List stored departures (one bus on one date) in the current tenant between two service dates. ' +
      'Past, cancelled, dropped and LEGACY departures are included.'
  })
  @ApiOkResponse({ type: DepartureListResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failure, a date that does not exist, to before from, or a range over 62 days.'
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListDeparturesQueryDto
  ): Promise<DepartureListResponseDto> {
    return this.departuresService.list(request.auth!, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DRIVER)
  @ApiOperation({ summary: 'Get one stored departure by id in the current tenant.' })
  @ApiOkResponse({ type: DepartureResponseDto })
  @ApiNotFoundResponse({ description: 'Departure not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<DepartureResponseDto> {
    return this.departuresService.getById(request.auth!, id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Add an extra bus to a ride on one service date. It follows the ride\'s line and stops; its times and capacity are its own. ' +
      'It may leave at the same time as another bus of the ride that day. Until PR 6 it also writes the ride\'s ADDITIONAL exception.'
  })
  @ApiCreatedResponse({ type: DepartureResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failure, a date that does not exist or lies outside the agency\'s today to 365 days ahead, or equal departure and arrival times.'
  })
  @ApiNotFoundResponse({ description: 'Ride not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  createExtra(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateExtraDepartureDto
  ): Promise<DepartureResponseDto> {
    return this.departuresService.createExtra(request.auth!, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Cancel a departure. Its passengers stay ACTIVE on it. A booked departure is refused with WOULD_BREAK_RESERVATIONS until its confirmationToken is sent back. ' +
      'Until PR 6 a timetable departure also gets its date\'s SKIP exception, and an extra bus loses its ADDITIONAL.'
  })
  @ApiOkResponse({ type: DepartureResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failure, or a service date outside the agency\'s today to 365 days ahead.'
  })
  @ApiNotFoundResponse({ description: 'Departure not found in current tenant.' })
  @ApiExtraModels(WouldBreakReservationsDto, DepartureOperationRefusalDto)
  @ApiConflictResponse({
    description:
      'Either WOULD_BREAK_RESERVATIONS, confirmable, listing the passengers left on a cancelled bus; or a departure that is already cancelled or LEGACY.',
    schema: { oneOf: [
      { $ref: getSchemaPath(WouldBreakReservationsDto) },
      { $ref: getSchemaPath(DepartureOperationRefusalDto) }
    ] }
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  cancel(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: CancelDepartureDto
  ): Promise<DepartureResponseDto> {
    return this.departuresService.cancel(request.auth!, id, dto);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Bring a cancelled departure back. Until PR 6 a timetable departure loses its date\'s SKIP exception, and an extra bus gets an ADDITIONAL again.'
  })
  @ApiOkResponse({ type: DepartureResponseDto })
  @ApiBadRequestResponse({
    description: 'A service date outside the agency\'s today to 365 days ahead.'
  })
  @ApiNotFoundResponse({ description: 'Departure not found in current tenant.' })
  @ApiConflictResponse({
    type: DepartureOperationRefusalDto,
    description: 'A departure that is not cancelled, or is LEGACY.'
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  restore(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<DepartureResponseDto> {
    return this.departuresService.restore(request.auth!, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Change the times or capacity of an extra bus. Its stops, its reservations\' time copies and its ADDITIONAL follow the new times. ' +
      'Moving a booked bus, or cutting its seats under a booked seat or a full stretch, is refused with WOULD_BREAK_RESERVATIONS until confirmed.'
  })
  @ApiOkResponse({ type: DepartureResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failure, nothing to change, equal departure and arrival times, or a service date outside the agency\'s today to 365 days ahead.'
  })
  @ApiNotFoundResponse({ description: 'Departure not found in current tenant.' })
  @ApiExtraModels(WouldBreakReservationsDto, DepartureOperationRefusalDto)
  @ApiConflictResponse({
    description: 'WOULD_BREAK_RESERVATIONS, confirmable; or a departure that is not an extra bus, which is not.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(WouldBreakReservationsDto) },
        { $ref: getSchemaPath(DepartureOperationRefusalDto) }
      ]
    }
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  updateExtra(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateExtraDepartureDto
  ): Promise<DepartureResponseDto> {
    return this.departuresService.updateExtra(request.auth!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Delete an extra bus nobody was ever booked on, with its ADDITIONAL exception. Answers with the departure as it was.'
  })
  @ApiOkResponse({ type: DepartureResponseDto })
  @ApiBadRequestResponse({
    description: 'A service date outside the agency\'s today to 365 days ahead.'
  })
  @ApiNotFoundResponse({ description: 'Departure not found in current tenant.' })
  @ApiConflictResponse({
    type: DepartureOperationRefusalDto,
    description:
      'DEPARTURE_HAS_RESERVATIONS: a reservation references the bus, a cancelled one included; cancel it instead. Also a departure that is not an extra bus.'
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  deleteExtra(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<DepartureResponseDto> {
    return this.departuresService.deleteExtra(request.auth!, id);
  }
}
