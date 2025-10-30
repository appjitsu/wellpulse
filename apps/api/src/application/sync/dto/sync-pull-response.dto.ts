export class WellSyncDto {
  id: string;
  name: string;
  apiNumber: string;
  latitude: number;
  longitude: number;
  status: string;
  lease: string | null;
  field: string | null;
  operator: string | null;
}

export class UserSyncDto {
  id: string;
  email: string;
  name: string;
  role: string;
}

export class SyncPullResponseDto {
  wells: WellSyncDto[];
  users: UserSyncDto[];
  lastSyncTimestamp: string;
  tenantId: string;
}
