import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type Principal,
  RequirePermission,
} from '../auth/auth.decorators.js';
import { ParseIdPipe } from '../common/parse-id.pipe.js';
import {
  AddContainerDto,
  ChangeStatusDto,
  CreateIssueDto,
  CreateShipmentDto,
  IssueActionDto,
  ListShipmentsQueryDto,
  UpdateIssueDto,
  UpdateMilestoneDto,
  UpdateShipmentDto,
} from './shipments.dto.js';
import {
  SHIPMENTS_MANAGE,
  SHIPMENTS_VIEW,
  ShipmentsService,
} from './shipments.service.js';

// Phase 3 (shipments and tracking). Seeded permissions, unchanged: `shipments.view` (every staff
// role) and `shipments.manage` (operations and admin).

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @RequirePermission(SHIPMENTS_VIEW)
  @Get()
  list(@Query() query: ListShipmentsQueryDto) {
    return this.shipments.list(query);
  }

  /** Staff who can be assigned to a shipment or a follow-up. Declared before `:reference`. */
  @RequirePermission(SHIPMENTS_VIEW)
  @Get('options/staff')
  staff() {
    return this.shipments.staff();
  }

  @RequirePermission(SHIPMENTS_VIEW)
  @Get(':reference')
  getOne(@Param('reference') reference: string) {
    return this.shipments.getOne(reference);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Post()
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: Principal) {
    return this.shipments.create(dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Patch(':reference')
  update(
    @Param('reference') reference: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.update(reference, dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Post(':reference/status')
  @HttpCode(200)
  changeStatus(
    @Param('reference') reference: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.changeStatus(reference, dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Patch(':reference/milestones/:id')
  updateMilestone(
    @Param('reference') reference: string,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.updateMilestone(reference, id, dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Post(':reference/issues')
  createIssue(
    @Param('reference') reference: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.createIssue(reference, dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Patch(':reference/issues/:id')
  updateIssue(
    @Param('reference') reference: string,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.updateIssue(reference, id, dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Post(':reference/issues/:id/actions')
  addIssueAction(
    @Param('reference') reference: string,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: IssueActionDto,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.addIssueAction(reference, id, dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Post(':reference/containers')
  addContainer(
    @Param('reference') reference: string,
    @Body() dto: AddContainerDto,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.addContainer(reference, dto, user);
  }

  @RequirePermission(SHIPMENTS_MANAGE)
  @Delete(':reference/containers/:id')
  removeContainer(
    @Param('reference') reference: string,
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: Principal,
  ) {
    return this.shipments.removeContainer(reference, id, user);
  }
}
