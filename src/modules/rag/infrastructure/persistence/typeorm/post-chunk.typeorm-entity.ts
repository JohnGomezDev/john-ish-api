import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostTypeOrmEntity } from '../../../../blog/infrastructure/persistence/typeorm/post.typeorm-entity';

@Entity('posts_chunks')
@Index('idx_chunks_post_id', ['postId'])
@Index('idx_chunks_post_chunk_index', ['postId', 'chunkIndex'], {
  unique: true,
})
export class PostChunkTypeOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @Column({ name: 'chunk_index', type: 'integer' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column('vector', { length: 384 })
  embedding: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => PostTypeOrmEntity, (post) => post.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post: PostTypeOrmEntity;
}
