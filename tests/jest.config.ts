import type { Config } from '@jest/types';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '..');

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  rootDir,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/types/**',
    '!<rootDir>/src/**/*.interface.ts',
    '!<rootDir>/src/config/swagger/**',
    '!<rootDir>/src/config/server/server.ts',
    '!<rootDir>/src/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  verbose: true,
  testTimeout: 30000,
};

export default config; 