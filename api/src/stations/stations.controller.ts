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
import { CreateStationDto } from './dto/create-station.dto';
import { ListStationsQueryDto } from './dto/list-stations.query.dto';
import { PaginatedStationsResponseDto, StationResponseDto } from './dto/station.response.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { StationsService } from './stations.service';

@ApiTags('Stations')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a station in the current tenant.' })
  @ApiOkResponse({ type: StationResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateStationDto
  ): Promise<StationResponseDto> {
    return this.stationsService.create(request.auth!, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'List stations inside the current tenant.' })
  @ApiOkResponse({ type: PaginatedStationsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListStationsQueryDto
  ): Promise<PaginatedStationsResponseDto> {
    return this.stationsService.list(request.auth!, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a station detail by id in the current tenant.' })
  @ApiOkResponse({ type: StationResponseDto })
  @ApiNotFoundResponse({ description: 'Station not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<StationResponseDto> {
    return this.stationsService.getById(request.auth!, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update station fields in the current tenant.' })
  @ApiOkResponse({ type: StationResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Station not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateStationDto
  ): Promise<StationResponseDto> {
    return this.stationsService.update(request.auth!, id, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Replace station fields in the current tenant.' })
  @ApiOkResponse({ type: StationResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Station not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  replace(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateStationDto
  ): Promise<StationResponseDto> {
    return this.stationsService.update(request.auth!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a station in the current tenant if no references exist.' })
  @ApiOkResponse({ type: StationResponseDto })
  @ApiNotFoundResponse({ description: 'Station not found in current tenant.' })
  @ApiConflictResponse({ description: 'Station is referenced by lines or reservations.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  remove(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<StationResponseDto> {
    return this.stationsService.remove(request.auth!, id);
  }
}
