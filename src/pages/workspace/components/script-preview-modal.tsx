/**
 * 脚本预览弹窗
 */
import React from 'react';
import type { ScriptData } from '@/types';
import { X } from 'lucide-react';
import { COMMENTARY_STYLES } from '../shared/script-config';
import styles from './../edit-step/script-writing.module.less';

interface ScriptPreviewModalProps {
  script: ScriptData;
  wordCount: number;
  estimatedDuration: number;
  style: string;
  commentaryStyle: string;
  onClose: () => void;
}

const ScriptPreviewModal: React.FC<ScriptPreviewModalProps> = ({
  script,
  wordCount,
  estimatedDuration,
  commentaryStyle,
  style,
  onClose,
}) => {
  return (
    <div className={styles.scriptPreviewModal} onClick={onClose}>
      <div className={styles.scriptPreviewContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.scriptPreviewHeader}>
          <h3>脚本预览</h3>
          <button className={styles.scriptPreviewClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.scriptPreviewBody}>
          <div className={styles.scriptMeta}>
            <span>
              风格:{' '}
              {COMMENTARY_STYLES.find((s) => s.value === commentaryStyle)?.label || style}
            </span>
            <span>字数: {wordCount}</span>
            <span>预计: ~{estimatedDuration}秒</span>
          </div>
          <pre className={styles.scriptPreviewText}>{script.content}</pre>
        </div>
      </div>
    </div>
  );
};

export default ScriptPreviewModal;
