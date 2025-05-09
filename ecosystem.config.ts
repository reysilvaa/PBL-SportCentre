/**
 * Konfigurasi PM2 untuk aplikasi Sport Center API
 */

interface AppEnvironment {
  NODE_ENV: string;
  PORT: number;
  FORCE_HTTPS: string;
}

interface AppConfig {
  name: string;
  script: string;
  instances: string | number;
  exec_mode: 'cluster' | 'fork';
  watch: boolean;
  max_memory_restart: string;
  min_uptime: string;
  max_restarts: number;
  env: AppEnvironment;
  env_production: AppEnvironment;
  merge_logs: boolean;
  log_date_format: string;
  error_file: string;
  out_file: string;
  time: boolean;
  listen_timeout: number;
  kill_timeout: number;
  wait_ready: boolean;
  min_instances: number;
  max_instances: number;
  autorestart: boolean;
  exp_backoff_restart_delay: number;
  node_args: string[];
}

interface PM2Config {
  apps: AppConfig[];
}

const config: PM2Config = {
  apps: [
    {
      name: 'sport-center-api',
      script: 'dist/app.js',
      instances: 'auto',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '200M',
      min_uptime: '5s',
      max_restarts: 5,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        FORCE_HTTPS: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        FORCE_HTTPS: 'true',
      },
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      time: true,
      listen_timeout: 5000,
      kill_timeout: 2000,
      wait_ready: true,
      min_instances: 1,
      max_instances: 2,
      autorestart: true,
      exp_backoff_restart_delay: 50,
      node_args: [
        '--max-old-space-size=200',
        '--optimize-for-size',
        '--gc-interval=50',
        '--max-semi-space-size=64',
        '--max-old-space-size=200',
        '--expose-gc',
        '--no-warnings',
        '--no-deprecation',
        '--trace-warnings',
        '--trace-uncaught',
        '--trace-sync-io',
      ],
    },
  ],
};

module.exports = config;
