jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { Post } from '../../../../blog/domain/entities/post.entity';
import {
  POST_REPOSITORY,
  type IPostRepository,
} from '../../../../blog/domain/repositories/post.repository.interface';
import {
  POST_CHUNK_REPOSITORY,
  type IPostChunkRepository,
} from '../../../domain/repositories/post-chunk.repository.interface';
import { EmbeddingService } from '../../../infrastructure/embedding/embedding.service';
import { IndexPostUseCase } from './index-post.use-case';

describe('IndexPostUseCase', () => {
  let useCase: IndexPostUseCase;
  let postRepository: jest.Mocked<Pick<IPostRepository, 'findById'>>;
  let chunkRepository: jest.Mocked<
    Pick<IPostChunkRepository, 'replaceForPost'>
  >;
  let embeddingService: { embedDocument: jest.Mock };

  const postId = '11111111-1111-1111-1111-111111111111';
  const adminId = '22222222-2222-2222-2222-222222222222';
  const categoryId = '33333333-3333-3333-3333-333333333333';
  const fixedNow = new Date('2026-01-15T10:00:00.000Z');

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IndexPostUseCase,
        {
          provide: POST_REPOSITORY,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: POST_CHUNK_REPOSITORY,
          useValue: {
            replaceForPost: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embedDocument: jest
              .fn()
              .mockResolvedValue(new Array(384).fill(0.1)),
          },
        },
      ],
    }).compile();

    useCase = module.get(IndexPostUseCase);
    postRepository = module.get(POST_REPOSITORY);
    chunkRepository = module.get(POST_CHUNK_REPOSITORY);
    embeddingService = module.get(EmbeddingService);
  });

  function buildPost(content: string): Post {
    return new Post(
      postId,
      'Título de prueba',
      'titulo-de-prueba',
      content,
      'excerpt',
      null,
      null,
      null,
      true,
      fixedNow,
      fixedNow,
      fixedNow,
      adminId,
      categoryId,
    );
  }

  // Happy path: strip, chunk, embed, and persist chunks for a post
  it('should chunk, embed, and persist chunks for a post', async () => {
    postRepository.findById.mockResolvedValue(
      buildPost(
        '# Título\n\nPárrafo uno con suficiente contenido para ser un chunk válido.\n\nPárrafo dos también suficientemente largo.',
      ),
    );

    await useCase.execute(postId);

    expect(embeddingService.embedDocument).toHaveBeenCalled();
    expect(chunkRepository.replaceForPost).toHaveBeenCalledWith(
      postId,
      expect.arrayContaining([
        expect.objectContaining({
          postId,
          embedding: expect.any(Array) as number[],
        }),
      ]),
    );
  });

  // Markdown must be stripped before any embedding call
  it('should strip Markdown before embedding', async () => {
    postRepository.findById.mockResolvedValue(
      buildPost(
        '# Heading\n\n**Bold text** and [link](http://example.com) with ![img](http://img.png)',
      ),
    );

    await useCase.execute(postId);

    const embeddedTexts = (
      embeddingService.embedDocument.mock.calls as [string][]
    ).map((call) => call[0]);

    for (const text of embeddedTexts) {
      expect(text).not.toMatch(/#|\*\*|\[|!\[/);
    }
  });

  // Very short posts should produce a single chunk
  it('should create exactly one chunk for very short content', async () => {
    postRepository.findById.mockResolvedValue(buildPost('Contenido corto'));

    await useCase.execute(postId);

    expect(chunkRepository.replaceForPost).toHaveBeenCalledWith(
      postId,
      expect.any(Array),
    );
    const [, chunks] = chunkRepository.replaceForPost.mock.calls[0];
    expect(chunks).toHaveLength(1);
  });

  // Missing posts should be logged and skipped without throwing
  it('should log and return without error if post is not found', async () => {
    postRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(postId)).resolves.toBeUndefined();
    expect(chunkRepository.replaceForPost).not.toHaveBeenCalled();
  });

  // Repository failures must propagate to the caller
  it('should rethrow errors from the chunk repository', async () => {
    postRepository.findById.mockResolvedValue(buildPost('Contenido corto'));
    chunkRepository.replaceForPost.mockRejectedValue(new Error('db error'));

    await expect(useCase.execute(postId)).rejects.toThrow('db error');
  });
});
