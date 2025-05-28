// Ekspor semua kelas setup untuk memudahkan penggunaan
export { TestSetup } from './TestSetup';
export { UnitTestSetup } from './UnitTestSetup';
export { E2ETestSetup } from './E2ETestSetup';
export { IntegrationTestSetup } from './IntegrationTestSetup';
export { MockDataFactory } from './MockDataFactory';

// Ekspor instans default untuk penggunaan cepat
import { UnitTestSetup } from './UnitTestSetup';
import { E2ETestSetup } from './E2ETestSetup';
import { IntegrationTestSetup } from './IntegrationTestSetup';
import { MockDataFactory } from './MockDataFactory';

export const unitTestSetup = UnitTestSetup.getInstance();
export const e2eTestSetup = E2ETestSetup.getInstance();
export const integrationTestSetup = IntegrationTestSetup.getInstance();
export const mockDataFactory = MockDataFactory.getInstance(); 