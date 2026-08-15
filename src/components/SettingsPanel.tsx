import { useEffect, useState } from "react";
import type { GridConfig } from "../types";

interface SettingsPanelProps {
  config: GridConfig;
  selectedAssetName: string | null;
  rotation: number;
  onRotationChange: (degrees: number) => void;
  onChange: (patch: Partial<GridConfig>) => void;
  disabled?: boolean;
}

const SCALES = [0.25, 0.5, 0.75, 1];
const DURATIONS = [5, 10, 20, 30, 60, 120];
const INTERVALS = [20, 50, 100];

interface GridNumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  normalize?: (value: number) => number;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function GridNumberField({
  id,
  label,
  value,
  min,
  max,
  normalize,
  hint,
  disabled,
  onChange,
}: GridNumberFieldProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) =>
    Math.max(min, Math.min(max, Math.round(n)));

  const handleChange = (raw: string) => {
    setText(raw);
    const n = Number(raw);
    if (Number.isFinite(n)) {
      onChange(normalize ? normalize(n) : clamp(n));
    }
  };

  const handleBlur = () => {
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const next = normalize ? normalize(n) : clamp(n);
    setText(String(next));
    onChange(next);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="number-input"
        type="number"
        min={min}
        max={max}
        step={1}
        value={text}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function SettingsPanel({
  config,
  selectedAssetName,
  rotation,
  onRotationChange,
  onChange,
  disabled,
}: SettingsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>网格与导出</h2>
      </div>

      <GridNumberField
        id="columns"
        label="列数"
        value={config.columns}
        min={1}
        max={50}
        hint="1-50"
        disabled={disabled}
        onChange={(columns) => onChange({ columns })}
      />

      <GridNumberField
        id="rows"
        label="行数"
        value={config.rows}
        min={0}
        max={50}
        hint="0 表示自动，最多 50 行"
        disabled={disabled}
        onChange={(rows) => onChange({ rows })}
      />

      <GridNumberField
        id="rotation"
        label="旋转角度"
        value={rotation}
        min={0}
        max={360}
        hint={
          selectedAssetName
            ? `作用于「${selectedAssetName}」`
            : "先在素材列表中点击选择一个 GIF"
        }
        normalize={(n) => ((Math.round(n) % 360) + 360) % 360}
        disabled={disabled}
        onChange={onRotationChange}
      />

      <div className="field">
        <label htmlFor="gap">
          格子间距 <span className="value">{config.gap}px</span>
        </label>
        <input
          id="gap"
          type="range"
          min={0}
          max={40}
          step={2}
          value={config.gap}
          disabled={disabled}
          onChange={(e) => onChange({ gap: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="background">背景色</label>
        <div className="color-row">
          <input
            id="background"
            type="color"
            value={config.backgroundColor}
            disabled={disabled}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
          />
          <code>{config.backgroundColor}</code>
        </div>
      </div>

      <div className="field">
        <label>输出大小</label>
        <div className="segmented">
          {SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              className={config.scale === scale ? "active" : ""}
              disabled={disabled}
              onClick={() => onChange({ scale })}
            >
              {Math.round(scale * 100)}%
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="maxDuration">时长上限</label>
        <select
          id="maxDuration"
          value={config.maxDurationSec}
          disabled={disabled}
          onChange={(e) => onChange({ maxDurationSec: Number(e.target.value) })}
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} 秒
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="interval">采样间隔</label>
        <select
          id="interval"
          value={config.sampleIntervalMs}
          disabled={disabled}
          onChange={(e) =>
            onChange({ sampleIntervalMs: Number(e.target.value) })
          }
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>
              {i}ms
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="threshold">
          画质阈值 <span className="value">{config.ssimThreshold.toFixed(2)}</span>
        </label>
        <input
          id="threshold"
          type="range"
          min={0.9}
          max={0.99}
          step={0.01}
          value={config.ssimThreshold}
          disabled={disabled}
          onChange={(e) => onChange({ ssimThreshold: Number(e.target.value) })}
        />
        <p className="field-hint">高于阈值的压缩档才会被选中，越高越接近原画</p>
      </div>
    </section>
  );
}
