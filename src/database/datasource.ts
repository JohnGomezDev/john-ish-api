import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { SeederOptions } from 'typeorm-extension';

config({ quiet: true });

const configService = new ConfigService();

export const dataSourceOptions: DataSourceOptions & SeederOptions = {
  type: 'postgres',
  host: configService.getOrThrow<string>('DB_HOST'),
  port: Number(configService.getOrThrow<string>('DB_PORT')),
  username: configService.getOrThrow<string>('DB_USER'),
  password: configService.getOrThrow<string>('DB_PASSWORD'),
  database: configService.getOrThrow<string>('DB_NAME'),
  entities: [join(__dirname, '../modules/**/*.typeorm-entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/**/*{.js,.ts}')],
  migrationsTableName: 'migrations',
  synchronize: false,
  migrationsRun: false,
  logging: false,
  seeds: [join(__dirname, 'seeds/**/*{.ts,.js}')],
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
