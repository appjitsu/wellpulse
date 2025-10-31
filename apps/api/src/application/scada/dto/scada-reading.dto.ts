/**
 * SCADA Reading DTO
 *
 * Data Transfer Object for SCADA reading responses.
 * Represents time-series data from SCADA systems.
 */

import {
  ScadaReading,
  ReadingQuality,
  ReadingDataType,
} from '../../../domain/scada/scada-reading.entity';

export class ScadaReadingDto {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly wellId: string;
  public readonly scadaConnectionId: string;
  public readonly tagName: string;
  public readonly value: number | string | boolean;
  public readonly dataType: ReadingDataType;
  public readonly quality: ReadingQuality;
  public readonly timestamp: string;
  public readonly unit?: string;
  public readonly minValue?: number;
  public readonly maxValue?: number;
  public readonly metadata?: Record<string, unknown>;

  private constructor(props: {
    id: string;
    tenantId: string;
    wellId: string;
    scadaConnectionId: string;
    tagName: string;
    value: number | string | boolean;
    dataType: ReadingDataType;
    quality: ReadingQuality;
    timestamp: string;
    unit?: string;
    minValue?: number;
    maxValue?: number;
    metadata?: Record<string, unknown>;
  }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.wellId = props.wellId;
    this.scadaConnectionId = props.scadaConnectionId;
    this.tagName = props.tagName;
    this.value = props.value;
    this.dataType = props.dataType;
    this.quality = props.quality;
    this.timestamp = props.timestamp;
    this.unit = props.unit;
    this.minValue = props.minValue;
    this.maxValue = props.maxValue;
    this.metadata = props.metadata;
  }

  /**
   * Create DTO from domain entity
   */
  static fromDomain(reading: ScadaReading): ScadaReadingDto {
    return new ScadaReadingDto({
      id: reading.id,
      tenantId: reading.tenantId,
      wellId: reading.wellId,
      scadaConnectionId: reading.scadaConnectionId,
      tagName: reading.tagName,
      value: reading.value,
      dataType: reading.dataType,
      quality: reading.quality,
      timestamp: reading.timestamp.toISOString(),
      unit: reading.unit,
      minValue: reading.minValue,
      maxValue: reading.maxValue,
      metadata: reading.metadata,
    });
  }
}
