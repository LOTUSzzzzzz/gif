import { useEffect, useState } from "react";
import type { GridConfig } from "../types";

interface SettingsPanelProps {
  config: GridConfig;
  rotation: number;
  onRotationChange: (degrees: number) => void;
  onChange: (patch: Partial<GridConfig>) => void;
  disabled?: boolean;
}

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

  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));

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
        hint="作用于选中的 GIF，可单独设置每个素材"
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
            id="transparentBg"
            type="checkbox"
            checked={config.backgroundColor === "transparent"}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                backgroundColor: e.target.checked ? "transparent" : "#ffffff",
              })
            }
          />
          <label htmlFor="transparentBg">透明背景</label>
        </div>
        <div className="color-row">
          <input
            id="customBg"
            type="checkbox"
            checked={config.backgroundColor !== "transparent"}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                backgroundColor: e.target.checked ? "#ffffff" : "transparent",
              })
            }
          />
          <label htmlFor="customBg">自定义背景</label>
          <input
            id="background"
            type="color"
            value={
              config.backgroundColor === "transparent"
                ? "#ffffff"
                : config.backgroundColor
            }
            disabled={disabled || config.backgroundColor === "transparent"}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
          />
          <code>
            {config.backgroundColor === "transparent"
              ? ""
              : config.backgroundColor}
          </code>
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
    </section>
  );
}
