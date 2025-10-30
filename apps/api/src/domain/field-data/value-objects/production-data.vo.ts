export interface ProductionDataProps {
  oilVolume: number; // barrels
  gasVolume: number; // MCF (thousand cubic feet)
  waterVolume: number; // barrels
  runHours?: number; // hours well was producing
  casingPressure?: number; // PSI
  tubingPressure?: number; // PSI
  chokeSize?: number; // 1/64 inch
}

export class ProductionData {
  private constructor(
    private readonly _oilVolume: number,
    private readonly _gasVolume: number,
    private readonly _waterVolume: number,
    private readonly _runHours?: number,
    private readonly _casingPressure?: number,
    private readonly _tubingPressure?: number,
    private readonly _chokeSize?: number,
  ) {}

  static create(props: ProductionDataProps): ProductionData {
    // Validate volumes
    if (props.oilVolume < 0) {
      throw new Error('Oil volume cannot be negative');
    }

    if (props.gasVolume < 0) {
      throw new Error('Gas volume cannot be negative');
    }

    if (props.waterVolume < 0) {
      throw new Error('Water volume cannot be negative');
    }

    if (
      props.runHours !== undefined &&
      (props.runHours < 0 || props.runHours > 24)
    ) {
      throw new Error('Run hours must be between 0 and 24');
    }

    if (props.casingPressure !== undefined && props.casingPressure < 0) {
      throw new Error('Casing pressure cannot be negative');
    }

    if (props.tubingPressure !== undefined && props.tubingPressure < 0) {
      throw new Error('Tubing pressure cannot be negative');
    }

    if (props.chokeSize !== undefined && props.chokeSize < 0) {
      throw new Error('Choke size cannot be negative');
    }

    // Oil & gas industry validation: warn if values seem unrealistic
    if (props.oilVolume > 10000) {
      console.warn('Oil volume exceeds typical daily production (10,000 bbls)');
    }

    if (props.gasVolume > 100000) {
      console.warn('Gas volume exceeds typical daily production (100,000 MCF)');
    }

    if (props.waterVolume > 50000) {
      console.warn(
        'Water volume exceeds typical daily production (50,000 bbls)',
      );
    }

    return new ProductionData(
      props.oilVolume,
      props.gasVolume,
      props.waterVolume,
      props.runHours,
      props.casingPressure,
      props.tubingPressure,
      props.chokeSize,
    );
  }

  get oilVolume(): number {
    return this._oilVolume;
  }

  get gasVolume(): number {
    return this._gasVolume;
  }

  get waterVolume(): number {
    return this._waterVolume;
  }

  get runHours(): number | undefined {
    return this._runHours;
  }

  get casingPressure(): number | undefined {
    return this._casingPressure;
  }

  get tubingPressure(): number | undefined {
    return this._tubingPressure;
  }

  get chokeSize(): number | undefined {
    return this._chokeSize;
  }

  get totalFluidVolume(): number {
    return this._oilVolume + this._waterVolume;
  }

  get waterCut(): number {
    const totalFluid = this.totalFluidVolume;
    return totalFluid > 0 ? (this._waterVolume / totalFluid) * 100 : 0;
  }

  get gasOilRatio(): number {
    return this._oilVolume > 0 ? this._gasVolume / this._oilVolume : 0;
  }
}
