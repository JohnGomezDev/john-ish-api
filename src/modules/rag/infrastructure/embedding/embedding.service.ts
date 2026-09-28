import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from '@xenova/transformers';
import {
  E5_DOCUMENT_PREFIX,
  E5_QUERY_PREFIX,
  EMBEDDING_MODEL,
} from '../../application/constants/embedding.constants';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private pipelineInstance: FeatureExtractionPipeline | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const cacheDir = this.configService.get<string>('EMBEDDINGS_CACHE_DIR');
    if (cacheDir) {
      env.cacheDir = cacheDir;
    }

    try {
      this.pipelineInstance = await pipeline(
        'feature-extraction',
        EMBEDDING_MODEL,
      );
      this.logger.log(`Modelo ${EMBEDDING_MODEL} cargado correctamente`);
    } catch (error) {
      this.logger.error(
        'No se pudo inicializar el modelo de embeddings',
        error,
      );
      this.pipelineInstance = null;
    }
  }

  async embedDocument(text: string): Promise<number[]> {
    return this.embed(E5_DOCUMENT_PREFIX + text);
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.embed(E5_QUERY_PREFIX + query);
  }

  private async embed(text: string): Promise<number[]> {
    if (!this.pipelineInstance) {
      throw new ServiceUnavailableException(
        'El servicio de embeddings no está disponible',
      );
    }

    const output = await this.pipelineInstance(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data as ArrayLike<number>);
  }
}
