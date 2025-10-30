/**
 * Conflict Resolution Utilities
 * Implements strategies for resolving offline edit conflicts during sync
 */

import { FieldEntry } from '../db/schema';

export type ResolutionStrategy = 'last-write-wins' | 'safety-bias' | 'user-choice';

export interface ConflictInfo {
  entryId: string;
  localVersion: FieldEntry;
  serverVersion: Partial<FieldEntry>;
  conflictFields: string[];
}

/**
 * Detect conflicts between local and server versions
 * Returns list of conflicting field names
 */
export function detectConflicts(local: FieldEntry, server: Partial<FieldEntry>): string[] {
  const conflicts: string[] = [];

  // Check each field for conflicts
  const fieldsToCheck: Array<keyof FieldEntry> = [
    'productionVolume',
    'gasVolume',
    'pressure',
    'temperature',
    'waterCut',
    'notes',
    'wellName',
  ];

  for (const field of fieldsToCheck) {
    const localValue = local[field];
    const serverValue = server[field];

    // Only check if server has a value for this field
    if (serverValue !== undefined && localValue !== serverValue) {
      conflicts.push(field);
    }
  }

  // Check checklist object
  if (server.checklist && local.checklist) {
    const checklistKeys: Array<keyof typeof local.checklist> = [
      'pumpOperating',
      'noLeaks',
      'gaugesWorking',
      'safetyEquipment',
    ];

    for (const key of checklistKeys) {
      if (server.checklist[key] !== undefined && local.checklist[key] !== server.checklist[key]) {
        conflicts.push(`checklist.${key}`);
      }
    }
  }

  // Check location
  if (server.location && local.location) {
    if (
      server.location.latitude !== local.location.latitude ||
      server.location.longitude !== local.location.longitude
    ) {
      conflicts.push('location');
    }
  }

  return conflicts;
}

/**
 * Last-Write-Wins Strategy
 * Compares timestamps and keeps the most recent version
 */
export function resolveLastWriteWins(
  local: FieldEntry,
  server: Partial<FieldEntry> & { updatedAt: string },
): FieldEntry {
  const localTime = new Date(local.updatedAt).getTime();
  const serverTime = new Date(server.updatedAt).getTime();

  if (serverTime > localTime) {
    // Server is newer - merge server changes into local
    return {
      ...local,
      ...server,
      id: local.id, // Keep local ID
      syncStatus: 'synced' as const,
      serverVersion: server.updatedAt,
      conflictData: undefined, // Clear conflict data
    };
  }

  // Local is newer - keep local version
  return {
    ...local,
    syncStatus: 'pending' as const, // Need to re-sync with local version
    serverVersion: server.updatedAt,
  };
}

/**
 * Safety-Bias Strategy
 * For safety-critical oil & gas operations:
 * - Prefer readings indicating potential problems (high pressure, leaks detected)
 * - Prefer more conservative values
 * - Prefer checklist items marked as issues
 */
export function resolveSafetyBias(
  local: FieldEntry,
  server: Partial<FieldEntry> & { updatedAt: string },
): FieldEntry {
  const resolved = { ...local };

  // Pressure: Prefer higher value (potential safety issue)
  if (server.pressure && local.pressure) {
    const localPsi = parseFloat(local.pressure);
    const serverPsi = parseFloat(server.pressure);
    if (!isNaN(localPsi) && !isNaN(serverPsi)) {
      resolved.pressure = serverPsi > localPsi ? server.pressure : local.pressure;
    }
  }

  // Temperature: Prefer higher value (potential overheating)
  if (server.temperature && local.temperature) {
    const localTemp = parseFloat(local.temperature);
    const serverTemp = parseFloat(server.temperature);
    if (!isNaN(localTemp) && !isNaN(serverTemp)) {
      resolved.temperature = serverTemp > localTemp ? server.temperature : local.temperature;
    }
  }

  // Production Volume: Prefer lower value (conservative estimate)
  if (server.productionVolume) {
    const localVol = parseFloat(local.productionVolume);
    const serverVol = parseFloat(server.productionVolume);
    if (!isNaN(localVol) && !isNaN(serverVol)) {
      resolved.productionVolume =
        serverVol < localVol ? server.productionVolume : local.productionVolume;
    }
  }

  // Gas Volume: Prefer lower value (conservative estimate)
  if (server.gasVolume && local.gasVolume) {
    const localGas = parseFloat(local.gasVolume);
    const serverGas = parseFloat(server.gasVolume);
    if (!isNaN(localGas) && !isNaN(serverGas)) {
      resolved.gasVolume = serverGas < localGas ? server.gasVolume : local.gasVolume;
    }
  }

  // Water Cut: Prefer higher value (indicates more water, potential problem)
  if (server.waterCut && local.waterCut) {
    const localWater = parseFloat(local.waterCut);
    const serverWater = parseFloat(server.waterCut);
    if (!isNaN(localWater) && !isNaN(serverWater)) {
      resolved.waterCut = serverWater > localWater ? server.waterCut : local.waterCut;
    }
  }

  // Checklist: Prefer "false" (indicates issue detected)
  if (server.checklist) {
    resolved.checklist = {
      pumpOperating:
        server.checklist.pumpOperating !== undefined
          ? local.checklist.pumpOperating && server.checklist.pumpOperating
          : local.checklist.pumpOperating,
      noLeaks:
        server.checklist.noLeaks !== undefined
          ? local.checklist.noLeaks && server.checklist.noLeaks
          : local.checklist.noLeaks,
      gaugesWorking:
        server.checklist.gaugesWorking !== undefined
          ? local.checklist.gaugesWorking && server.checklist.gaugesWorking
          : local.checklist.gaugesWorking,
      safetyEquipment:
        server.checklist.safetyEquipment !== undefined
          ? local.checklist.safetyEquipment && server.checklist.safetyEquipment
          : local.checklist.safetyEquipment,
      tankLevelsChecked:
        server.checklist.tankLevelsChecked !== undefined
          ? local.checklist.tankLevelsChecked && server.checklist.tankLevelsChecked
          : local.checklist.tankLevelsChecked,
      separatorOperating:
        server.checklist.separatorOperating !== undefined
          ? local.checklist.separatorOperating && server.checklist.separatorOperating
          : local.checklist.separatorOperating,
      noAbnormalSounds:
        server.checklist.noAbnormalSounds !== undefined
          ? local.checklist.noAbnormalSounds && server.checklist.noAbnormalSounds
          : local.checklist.noAbnormalSounds,
      valvePositionsCorrect:
        server.checklist.valvePositionsCorrect !== undefined
          ? local.checklist.valvePositionsCorrect && server.checklist.valvePositionsCorrect
          : local.checklist.valvePositionsCorrect,
      heaterTreaterOperating:
        server.checklist.heaterTreaterOperating !== undefined
          ? local.checklist.heaterTreaterOperating && server.checklist.heaterTreaterOperating
          : local.checklist.heaterTreaterOperating,
      noVisibleCorrosion:
        server.checklist.noVisibleCorrosion !== undefined
          ? local.checklist.noVisibleCorrosion && server.checklist.noVisibleCorrosion
          : local.checklist.noVisibleCorrosion,
      ventLinesClear:
        server.checklist.ventLinesClear !== undefined
          ? local.checklist.ventLinesClear && server.checklist.ventLinesClear
          : local.checklist.ventLinesClear,
      chemicalInjectionWorking:
        server.checklist.chemicalInjectionWorking !== undefined
          ? local.checklist.chemicalInjectionWorking && server.checklist.chemicalInjectionWorking
          : local.checklist.chemicalInjectionWorking,
      secondaryContainmentOk:
        server.checklist.secondaryContainmentOk !== undefined
          ? local.checklist.secondaryContainmentOk && server.checklist.secondaryContainmentOk
          : local.checklist.secondaryContainmentOk,
      wellSiteSecure:
        server.checklist.wellSiteSecure !== undefined
          ? local.checklist.wellSiteSecure && server.checklist.wellSiteSecure
          : local.checklist.wellSiteSecure,
      spillKitsAvailable:
        server.checklist.spillKitsAvailable !== undefined
          ? local.checklist.spillKitsAvailable && server.checklist.spillKitsAvailable
          : local.checklist.spillKitsAvailable,
    };
  }

  // Notes: Merge both (append server notes if different)
  if (server.notes && local.notes && server.notes !== local.notes) {
    resolved.notes = `${local.notes}\n\n[Server Note]: ${server.notes}`;
  } else if (server.notes) {
    resolved.notes = server.notes;
  }

  // Well name: Keep local (shouldn't change)
  resolved.wellName = local.wellName;

  // Photos: Merge arrays (union of both)
  if (server.photos && server.photos.length > 0) {
    const mergedPhotos = [...new Set([...local.photos, ...server.photos])];
    resolved.photos = mergedPhotos;
  }

  // Location: Prefer more accurate location
  if (server.location && local.location) {
    const localAccuracy = local.location.accuracy || 999999;
    const serverAccuracy = server.location.accuracy || 999999;
    resolved.location = serverAccuracy < localAccuracy ? server.location : local.location;
  }

  // Update timestamps
  resolved.updatedAt = new Date().toISOString(); // Mark as updated now
  resolved.syncStatus = 'synced';
  resolved.serverVersion = server.updatedAt;
  resolved.conflictData = undefined;

  return resolved;
}

/**
 * Prepare conflict data for user review
 * Returns a structured object for UI display
 */
export function prepareConflictForUI(local: FieldEntry, server: Partial<FieldEntry>): ConflictInfo {
  const conflictFields = detectConflicts(local, server);

  return {
    entryId: local.id,
    localVersion: local,
    serverVersion: server,
    conflictFields,
  };
}

/**
 * Apply user's resolution choice
 */
export function applyUserChoice(
  local: FieldEntry,
  server: Partial<FieldEntry> & { updatedAt: string },
  choice: 'local' | 'server' | 'merge',
): FieldEntry {
  switch (choice) {
    case 'local':
      // Keep all local values, but mark as re-sync needed
      return {
        ...local,
        updatedAt: new Date().toISOString(), // Update timestamp
        syncStatus: 'pending',
        serverVersion: server.updatedAt,
        conflictData: undefined,
      };

    case 'server':
      // Accept all server values
      return {
        ...local,
        ...server,
        id: local.id, // Preserve local ID
        updatedAt: server.updatedAt, // Use server's timestamp
        syncStatus: 'synced',
        serverVersion: server.updatedAt,
        conflictData: undefined,
      };

    case 'merge':
      // Use safety-bias merge strategy
      return resolveSafetyBias(local, server);

    default:
      return local;
  }
}

/**
 * Automatically resolve conflict based on strategy
 */
export function autoResolveConflict(
  local: FieldEntry,
  server: Partial<FieldEntry> & { updatedAt: string },
  strategy: ResolutionStrategy = 'safety-bias',
): FieldEntry {
  switch (strategy) {
    case 'last-write-wins':
      return resolveLastWriteWins(local, server);

    case 'safety-bias':
      return resolveSafetyBias(local, server);

    case 'user-choice':
      // Mark as conflict for user resolution
      return {
        ...local,
        syncStatus: 'conflict',
        serverVersion: server.updatedAt,
        conflictData: server,
      };

    default:
      return resolveSafetyBias(local, server); // Default to safety-bias
  }
}
