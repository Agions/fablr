/**
 * 共享类型定义（精简至实际使用的导出）
 *
 * 仅保留被消费者引用的类型，其余已迁移至 @/types 或各模块自行定义。
 */

// ─── 项目 UI 类型（单一真相源重定向至 @/types/project） ───
export type {
  ProjectStatus,
  ProjectUIStatus,
  ProjectView,
  ProjectUIStats,
} from '@/types/project';
