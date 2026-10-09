/**
 * 解说风格选择器
 * 职责：解说风格选择 UI
 *
 * 重构说明：
 * - 从原 ScriptWriting.tsx (686行) 中提取解说风格选择 UI
 * - 职责单一：只负责解说风格选择
 */

import React from 'react';
import { Zap } from 'lucide-react';
import styles from './../edit-step/script-writing.module.less';
import { COMMENTARY_STYLES } from '../shared/script-config';

// ============================================
// 类型定义
// ============================================

interface CommentaryStyleSelectorProps {
  /** 当前选中的风格 */
  currentStyle: string;
  /** 风格变更回调 */
  onStyleChange: (style: string) => void;
}

// ============================================
// 解说风格选择器组件
// ============================================

export const CommentaryStyleSelector: React.FC<CommentaryStyleSelectorProps> = ({
  currentStyle,
  onStyleChange,
}) => {
  return (
    <div className={styles.commentaryStyleSection}>
      <span className={styles.commentaryStyleLabel}>
        <Zap width={12} height={12} />
        解说风格
      </span>
      <div className={styles.commentaryStyleGrid}>
        {COMMENTARY_STYLES.map((style) => (
          <div
            key={style.value}
            className={`${styles.commentaryStyleItem} ${
              currentStyle === style.value ? styles.commentaryStyleActive : ''
            }`}
            onClick={() => onStyleChange(style.value)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onStyleChange(style.value)}
            style={{ '--style-color': style.color } as React.CSSProperties}
          >
            <span className={styles.commentaryStyleIcon}>{style.icon}</span>
            <span className={styles.commentaryStyleName}>{style.label}</span>
            <span className={styles.commentaryStyleDesc}>{style.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentaryStyleSelector;
