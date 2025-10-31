-- Seed test data for SCADA ingestion service testing
-- Database: wellpulse_internal

DO $$
DECLARE
    tenant_id uuid := '68b88aec-2dce-41c2-b67c-d2ce131c7288';
    well_1_id uuid;
    well_2_id uuid;
    conn_1_id uuid;
    conn_2_id uuid;
BEGIN
    -- Create test wells
    INSERT INTO wells (
        name,
        api_number,
        operator,
        field,
        county,
        state,
        status,
        latitude,
        longitude,
        created_by,
        updated_by
    ) VALUES
    (
        'Test Well 1 - Permian Basin',
        '42-123-45678',
        'WellPulse Energy',
        'Wolfcamp Field',
        'Midland',
        'TX',
        'PRODUCING',
        31.9973,
        -102.0779,
        tenant_id,
        tenant_id
    ),
    (
        'Test Well 2 - Delaware Basin',
        '42-123-45679',
        'WellPulse Energy',
        'Bone Spring Field',
        'Reeves',
        'TX',
        'PRODUCING',
        31.7946,
        -103.6473,
        tenant_id,
        tenant_id
    );

    -- Get the well IDs we just created
    SELECT id INTO well_1_id FROM wells WHERE api_number = '42-123-45678';
    SELECT id INTO well_2_id FROM wells WHERE api_number = '42-123-45679';

    -- Create test SCADA connections
    INSERT INTO scada_connections (
        tenant_id,
        well_id,
        name,
        description,
        endpoint_url,
        security_mode,
        security_policy,
        poll_interval_seconds,
        is_enabled,
        created_by,
        updated_by
    ) VALUES
    (
        tenant_id,
        well_1_id,
        'Test Well 1 - RTU Connection',
        'Mock OPC-UA server for Test Well 1',
        'opc.tcp://localhost:4840/test-well-1',
        'None',
        'None',
        5,
        true,
        tenant_id,
        tenant_id
    ),
    (
        tenant_id,
        well_2_id,
        'Test Well 2 - PLC Connection',
        'Mock OPC-UA server for Test Well 2',
        'opc.tcp://localhost:4841/test-well-2',
        'None',
        'None',
        10,
        true,
        tenant_id,
        tenant_id
    );

    -- Get the connection IDs
    SELECT id INTO conn_1_id FROM scada_connections WHERE well_id = well_1_id;
    SELECT id INTO conn_2_id FROM scada_connections WHERE well_id = well_2_id;

    -- Create tag mappings for Well 1
    INSERT INTO tag_mappings (
        tenant_id,
        connection_id,
        tag_name,
        opc_node_id,
        well_id,
        data_type,
        unit,
        created_by,
        updated_by
    ) VALUES
    (tenant_id, conn_1_id, 'CASING_PRESSURE', 'ns=2;s=Well1.CasingPressure', well_1_id, 'DOUBLE', 'PSI', tenant_id, tenant_id),
    (tenant_id, conn_1_id, 'TUBING_PRESSURE', 'ns=2;s=Well1.TubingPressure', well_1_id, 'DOUBLE', 'PSI', tenant_id, tenant_id),
    (tenant_id, conn_1_id, 'OIL_FLOW_RATE', 'ns=2;s=Well1.OilFlowRate', well_1_id, 'DOUBLE', 'BBL/D', tenant_id, tenant_id),
    (tenant_id, conn_1_id, 'GAS_FLOW_RATE', 'ns=2;s=Well1.GasFlowRate', well_1_id, 'DOUBLE', 'MCF/D', tenant_id, tenant_id),
    (tenant_id, conn_1_id, 'WATER_FLOW_RATE', 'ns=2;s=Well1.WaterFlowRate', well_1_id, 'DOUBLE', 'BBL/D', tenant_id, tenant_id);

    -- Create tag mappings for Well 2
    INSERT INTO tag_mappings (
        tenant_id,
        connection_id,
        tag_name,
        opc_node_id,
        well_id,
        data_type,
        unit,
        created_by,
        updated_by
    ) VALUES
    (tenant_id, conn_2_id, 'CASING_PRESSURE', 'ns=2;s=Well2.CasingPressure', well_2_id, 'DOUBLE', 'PSI', tenant_id, tenant_id),
    (tenant_id, conn_2_id, 'TUBING_PRESSURE', 'ns=2;s=Well2.TubingPressure', well_2_id, 'DOUBLE', 'PSI', tenant_id, tenant_id),
    (tenant_id, conn_2_id, 'WELLHEAD_TEMP', 'ns=2;s=Well2.WellheadTemp', well_2_id, 'DOUBLE', 'F', tenant_id, tenant_id),
    (tenant_id, conn_2_id, 'MOTOR_AMPS', 'ns=2;s=Well2.MotorAmps', well_2_id, 'DOUBLE', 'A', tenant_id, tenant_id),
    (tenant_id, conn_2_id, 'CHOKE_POSITION', 'ns=2;s=Well2.ChokePosition', well_2_id, 'DOUBLE', '%', tenant_id, tenant_id);

    RAISE NOTICE 'Test data created successfully!';
    RAISE NOTICE 'Well 1 ID: %', well_1_id;
    RAISE NOTICE 'Well 2 ID: %', well_2_id;
    RAISE NOTICE 'Connection 1 ID: %', conn_1_id;
    RAISE NOTICE 'Connection 2 ID: %', conn_2_id;
END $$;

-- Verify the data
SELECT
    sc.name as connection_name,
    w.name as well_name,
    COUNT(tm.id) as tag_count
FROM scada_connections sc
JOIN wells w ON w.id = sc.well_id
LEFT JOIN tag_mappings tm ON tm.connection_id = sc.id
WHERE sc.deleted_at IS NULL
GROUP BY sc.name, w.name;
