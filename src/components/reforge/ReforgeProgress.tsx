'use client';

import React from 'react';

export type ReforgeStage =
  | { type: 'layer'; slotName: string; index: number }
  | { type: 'image_upload' }
  | { type: 'metadata_update' }
  | { type: 'complete' };

export type ReforgeStageStatus = 'pending' | 'active' | 'completed';

export interface ReforgeProgressStage {
  stage: ReforgeStage;
  status: ReforgeStageStatus;
  label: string;
}

interface ReforgeProgressProps {
  stages: ReforgeProgressStage[];
  accentColor?: string;
}

export function ReforgeProgress({ stages, accentColor = '#00BFFF' }: ReforgeProgressProps) {
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalCount = stages.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div
        className="relative w-full h-2 rounded-full overflow-hidden mb-3"
        style={{ background: 'rgba(255, 255, 255, 0.08)' }}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPercent}%`,
            background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})`,
            boxShadow: `0 0 10px ${accentColor}60`,
          }}
        />
      </div>

      {/* Stage indicators */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
        {stages.map((stageItem, idx) => (
          <StageIndicator
            key={idx}
            stage={stageItem}
            accentColor={accentColor}
            isLast={idx === stages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function StageIndicator({
  stage,
  accentColor,
  isLast,
}: {
  stage: ReforgeProgressStage;
  accentColor: string;
  isLast: boolean;
}) {
  const { status, label } = stage;

  const dotSize = status === 'active' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  return (
    <div className="flex flex-col items-center min-w-0 flex-1">
      {/* Dot indicator */}
      <div
        className={`${dotSize} rounded-full transition-all duration-300 mb-1 flex-shrink-0`}
        style={{
          background:
            status === 'completed'
              ? accentColor
              : status === 'active'
              ? accentColor
              : 'rgba(255, 255, 255, 0.15)',
          boxShadow:
            status === 'active'
              ? `0 0 8px ${accentColor}, 0 0 16px ${accentColor}50`
              : status === 'completed'
              ? `0 0 4px ${accentColor}60`
              : 'none',
          animation: status === 'active' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />

      {/* Label */}
      <span
        className="text-[10px] leading-tight text-center truncate w-full px-0.5"
        style={{
          color:
            status === 'completed'
              ? accentColor
              : status === 'active'
              ? '#fff'
              : 'rgba(255, 255, 255, 0.35)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** Helper to build stages array from selected traits */
export function buildReforgeStages(
  slotNames: string[],
  currentStageIndex: number
): ReforgeProgressStage[] {
  const stages: ReforgeProgressStage[] = [];

  // Layer stages
  slotNames.forEach((slotName, idx) => {
    const stageIndex = idx;
    stages.push({
      stage: { type: 'layer', slotName, index: idx },
      status:
        stageIndex < currentStageIndex
          ? 'completed'
          : stageIndex === currentStageIndex
          ? 'active'
          : 'pending',
      label: slotName,
    });
  });

  // Image upload stage
  const imageUploadIndex = slotNames.length;
  stages.push({
    stage: { type: 'image_upload' },
    status:
      imageUploadIndex < currentStageIndex
        ? 'completed'
        : imageUploadIndex === currentStageIndex
        ? 'active'
        : 'pending',
    label: 'Upload',
  });

  // Metadata update stage
  const metadataIndex = slotNames.length + 1;
  stages.push({
    stage: { type: 'metadata_update' },
    status:
      metadataIndex < currentStageIndex
        ? 'completed'
        : metadataIndex === currentStageIndex
        ? 'active'
        : 'pending',
    label: 'Metadata',
  });

  // Complete stage
  const completeIndex = slotNames.length + 2;
  stages.push({
    stage: { type: 'complete' },
    status:
      completeIndex < currentStageIndex
        ? 'completed'
        : completeIndex === currentStageIndex
        ? 'active'
        : 'pending',
    label: 'Complete',
  });

  return stages;
}
