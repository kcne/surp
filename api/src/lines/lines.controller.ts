import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
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
import { CreateLineDto } from './dto/create-line.dto';
import { LineResponseDto, PaginatedLinesResponseDto } from './dto/line.response.dto';
import { ReplaceLineStopsDto } from './dto/line-stop.dto';
import { ListLinesQueryDto } from './dto/list-lines.query.dto';
import { UpdateLineDto } from './dto/update-line.dto';
import { LinesService } from './lines.service';

@ApiTags('Lines')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('lines')
export class LinesController {
  constructor(private readonly linesService: LinesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a line in the current tenant.' })
  @ApiOkResponse({ type: LineResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route integrity violation.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(@Req() request: RequestWithAuth, @Body() dto: CreateLineDto): Promise<LineResponseDto> {
    return this.linesService.create(request.auth!, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'List lines in the current tenant.' })
  @ApiOkResponse({ type: PaginatedLinesResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListLinesQueryDto
  ): Promise<PaginatedLinesResponseDto> {
    return this.linesService.list(request.auth!, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a line detail by id in the current tenant.' })
  @ApiOkResponse({ type: LineResponseDto })
  @ApiNotFoundResponse({ description: 'Line not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<LineResponseDto> {
    return this.linesService.getById(request.auth!, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update line fields in the current tenant.' })
  @ApiOkResponse({ type: LineResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route integrity violation.' })
  @ApiNotFoundResponse({ description: 'Line not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateLineDto
  ): Promise<LineResponseDto> {
    return this.linesService.update(request.auth!, id, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Replace line fields in the current tenant.' })
  @ApiOkResponse({ type: LineResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route integrity violation.' })
  @ApiNotFoundResponse({ description: 'Line not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  replace(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateLineDto
  ): Promise<LineResponseDto> {
    return this.linesService.update(request.auth!, id, dto);
  }

  @Put(':id/stops')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Replace ordered intermediate stops for a line in the current tenant.' })
  @ApiOkResponse({ type: LineResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route integrity violation.' })
  @ApiNotFoundResponse({ description: 'Line not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  replaceStops(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ReplaceLineStopsDto
  ): Promise<LineResponseDto> {
    return this.linesService.replaceStops(request.auth!, id, dto.intermediateStops);
  }

  @Post(':id/reverse')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a reverse line from an existing line route in the current tenant.' })
  @ApiOkResponse({ type: LineResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or route integrity violation.' })
  @ApiNotFoundResponse({ description: 'Line not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  createReverse(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<LineResponseDto> {
    return this.linesService.createReverse(request.auth!, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a line in the current tenant.' })
  @ApiOkResponse({ type: LineResponseDto })
  @ApiNotFoundResponse({ description: 'Line not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  remove(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<LineResponseDto> {
    return this.linesService.remove(request.auth!, id);
  }
}
