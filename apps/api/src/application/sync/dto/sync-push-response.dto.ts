export class ConflictDto {
  entryId: string;
  wellId: string;
  recordedAt: string;
  reason: string;
  resolution: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGED';
}

export class SyncPushResponseDto {
  succeeded: number;
  failed: number;
  conflicts: ConflictDto[];
  errors: Array<{
    wellId: string;
    error: string;
  }>;
  syncedAt: string;
}
