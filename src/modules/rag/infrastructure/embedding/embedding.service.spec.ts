jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
  env: { cacheDir: '' },
}));

import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { env, pipeline } from '@xenova/transformers';
import {
  E5_DOCUMENT_PREFIX,
  E5_QUERY_PREFIX,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
} from '../../application/constants/embedding.constants';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let configService: { get: jest.Mock };
  let mockPipelineInstance: jest.Mock;

  beforeEach(async () => {
    env.cacheDir = '';
    mockPipelineInstance = jest.fn();
    (pipeline as jest.Mock).mockResolvedValue(mockPipelineInstance);
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // A configured cache directory is applied before pipeline() so local weights are reused
  it('should load the model from the configured cache directory', async () => {
    const cacheDir = '/var/cache/johnish-api/embeddings';
    configService.get.mockReturnValue(cacheDir);
    let cacheDirWhenLoaded: string | undefined;
    (pipeline as jest.Mock).mockImplementation(() => {
      cacheDirWhenLoaded = env.cacheDir as string;
      return Promise.resolve(mockPipelineInstance);
    });

    await service.onModuleInit();

    expect(configService.get).toHaveBeenCalledWith('EMBEDDINGS_CACHE_DIR');
    expect(cacheDirWhenLoaded).toBe(cacheDir);
    expect(pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline).toHaveBeenCalledWith('feature-extraction', EMBEDDING_MODEL);
  });

  // Pipeline should load the multilingual-e5-small feature-extraction model on init
  it('should call pipeline with correct model on init', async () => {
    await service.onModuleInit();

    expect(pipeline).toHaveBeenCalledWith('feature-extraction', EMBEDDING_MODEL);
  });

  // Document embeddings must include the E5 passage prefix
  it('should embed a document with E5 passage prefix', async () => {
    await service.onModuleInit();
    mockPipelineInstance.mockResolvedValue({
      data: new Float32Array(EMBEDDING_DIMENSION),
    });

    const result = await service.embedDocument('texto');

    expect(mockPipelineInstance).toHaveBeenCalledWith(
      `${E5_DOCUMENT_PREFIX}texto`,
      {
        pooling: 'mean',
        normalize: true,
      },
    );
    expect(result).toHaveLength(EMBEDDING_DIMENSION);
    expect(result.every((value) => typeof value === 'number')).toBe(true);
  });

  // Query embeddings must include the E5 query prefix
  it('should embed a query with E5 query prefix', async () => {
    await service.onModuleInit();
    mockPipelineInstance.mockResolvedValue({
      data: new Float32Array(EMBEDDING_DIMENSION),
    });

    await service.embedQuery('mi pregunta');

    expect(mockPipelineInstance).toHaveBeenCalledWith(
      `${E5_QUERY_PREFIX}mi pregunta`,
      {
        pooling: 'mean',
        normalize: true,
      },
    );
    const [embeddedQuery] = mockPipelineInstance.mock.calls[0] as [string];
    expect(embeddedQuery).toMatch(/^query: /);
  });

  // Uninitialized pipeline should surface as ServiceUnavailableException
  it('should throw ServiceUnavailableException if pipeline is not initialized', async () => {
    await expect(service.embedDocument('x')).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.embedDocument('x')).rejects.toThrow(
      'El servicio de embeddings no está disponible',
    );
  });
});
