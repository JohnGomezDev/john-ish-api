jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  POST_CHUNK_REPOSITORY,
  type IHybridSearchResult,
  type IPostChunkRepository,
} from '../../../domain/repositories/post-chunk.repository.interface';
import { EmbeddingService } from '../../../infrastructure/embedding/embedding.service';
import { GroqService } from '../../../infrastructure/llm/groq.service';
import { RAG_NO_MATCH_ANSWER } from '../../constants/ask-blog.constants';
import { AskBlogUseCase } from './ask-blog.use-case';

describe('AskBlogUseCase', () => {
  let useCase: AskBlogUseCase;
  let chunkRepository: jest.Mocked<Pick<IPostChunkRepository, 'hybridSearch'>>;
  let embeddingService: { embedQuery: jest.Mock };
  let groqService: { generateAnswer: jest.Mock };
  let configService: { get: jest.Mock };

  const query = '¿Cómo funciona JWT?';
  const queryVector = new Array(384).fill(0.1);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AskBlogUseCase,
        {
          provide: POST_CHUNK_REPOSITORY,
          useValue: {
            hybridSearch: jest.fn(),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embedQuery: jest.fn().mockResolvedValue(queryVector),
          },
        },
        {
          provide: GroqService,
          useValue: {
            generateAnswer: jest.fn().mockResolvedValue('Esta es la respuesta'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(5),
          },
        },
      ],
    }).compile();

    useCase = module.get(AskBlogUseCase);
    chunkRepository = module.get(POST_CHUNK_REPOSITORY);
    embeddingService = module.get(EmbeddingService);
    groqService = module.get(GroqService);
    configService = module.get(ConfigService);
  });

  function buildSearchResult(
    overrides: Partial<IHybridSearchResult> = {},
  ): IHybridSearchResult {
    return {
      chunkId: 'chunk-1',
      postId: 'post-1',
      content: 'Contenido del chunk',
      rrfScore: 0.02,
      postTitle: 'Título del post',
      postSlug: 'titulo-del-post',
      ...overrides,
    };
  }

  // Happy path: sources come only from [n] citations in the LLM answer
  it('should return sources derived from citations in the LLM answer', async () => {
    chunkRepository.hybridSearch.mockResolvedValue([
      buildSearchResult({
        chunkId: 'chunk-1',
        postId: 'post-1',
        postTitle: 'Auth JWT',
        postSlug: 'auth-jwt',
      }),
      buildSearchResult({
        chunkId: 'chunk-2',
        postId: 'post-2',
        postTitle: 'NestJS Tips',
        postSlug: 'nestjs-tips',
      }),
    ]);
    groqService.generateAnswer.mockResolvedValue(
      'La autenticación se describe en [1].',
    );

    const result = await useCase.execute(query);

    expect(embeddingService.embedQuery).toHaveBeenCalledWith(query);
    expect(chunkRepository.hybridSearch).toHaveBeenCalledWith(
      queryVector,
      query,
      5,
    );
    expect(configService.get).toHaveBeenCalledWith('RAG_TOP_K', 5);
    expect(groqService.generateAnswer).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      answer: 'La autenticación se describe en [1].',
      sources: [{ title: 'Auth JWT', slug: 'auth-jwt' }],
    });
  });

  // Multiple citations to the same post should yield a single source
  it('should deduplicate sources by postId when several citations map to the same post', async () => {
    chunkRepository.hybridSearch.mockResolvedValue([
      buildSearchResult({
        chunkId: 'chunk-1',
        postId: 'post-1',
        postTitle: 'Auth JWT',
        postSlug: 'auth-jwt',
      }),
      buildSearchResult({
        chunkId: 'chunk-2',
        postId: 'post-1',
        postTitle: 'Auth JWT',
        postSlug: 'auth-jwt',
      }),
    ]);
    groqService.generateAnswer.mockResolvedValue(
      'Ver [1] y también [2] del mismo post.',
    );

    const result = await useCase.execute(query);

    expect(result.sources).toEqual([{ title: 'Auth JWT', slug: 'auth-jwt' }]);
  });

  // No [n] citations means empty sources even if retrieval returned chunks
  it('should return empty sources when the LLM answer has no citations', async () => {
    chunkRepository.hybridSearch.mockResolvedValue([buildSearchResult()]);
    groqService.generateAnswer.mockResolvedValue(
      'No encontré esa información en el contexto.',
    );

    const result = await useCase.execute(query);

    expect(result.sources).toEqual([]);
  });

  // Out-of-range citation numbers must be ignored
  it('should ignore out-of-range citation numbers', async () => {
    chunkRepository.hybridSearch.mockResolvedValue([
      buildSearchResult({
        postTitle: 'Auth JWT',
        postSlug: 'auth-jwt',
      }),
    ]);
    groqService.generateAnswer.mockResolvedValue(
      'Según [1] y el inventado [99].',
    );

    const result = await useCase.execute(query);

    expect(result.sources).toEqual([{ title: 'Auth JWT', slug: 'auth-jwt' }]);
  });

  // Empty retrieval must return the predefined answer without calling the LLM
  it('should return predefined no-match answer and NOT call LLM when hybridSearch returns empty array', async () => {
    chunkRepository.hybridSearch.mockResolvedValue([]);

    const result = await useCase.execute(query);

    expect(groqService.generateAnswer).not.toHaveBeenCalled();
    expect(result).toEqual({
      answer: RAG_NO_MATCH_ANSWER,
      sources: [],
    });
  });

  // Groq ServiceUnavailableException must propagate unchanged
  it('should propagate ServiceUnavailableException from GroqService without wrapping it', async () => {
    const unavailable = new ServiceUnavailableException(
      'El servicio de IA no está disponible en este momento',
    );
    chunkRepository.hybridSearch.mockResolvedValue([buildSearchResult()]);
    groqService.generateAnswer.mockRejectedValue(unavailable);

    await expect(useCase.execute(query)).rejects.toThrow(unavailable);
  });
});
