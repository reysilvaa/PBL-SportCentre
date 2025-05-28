/**
 * Setup Global untuk Jest
 * File ini dijalankan sebelum semua pengujian
 */
import { jest, beforeAll } from '@jest/globals';
import { TestSetup, UnitTestSetup, E2ETestSetup, IntegrationTestSetup, MockDataFactory } from './core';

// Meningkatkan batas waktu pengujian menjadi 30 detik
jest.setTimeout(30000);

// Menyembunyikan output konsol selama pengujian
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});

// Memastikan semua instance singleton dibuat
const testSetup = TestSetup.getInstance();
// Variabel berikut digunakan untuk memastikan instance singleton dibuat
const _unitTestSetup = UnitTestSetup.getInstance();
const _e2eTestSetup = E2ETestSetup.getInstance();
const _integrationTestSetup = IntegrationTestSetup.getInstance();
const _mockDataFactory = MockDataFactory.getInstance();

// Setup semua mock dasar
testSetup.setupAllMocks();

// Membersihkan database sebelum semua pengujian
beforeAll(async () => {
  await testSetup.cleanupDatabase();
}); 