import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import type { GridConfig } from "../types";

interface SettingsPanelProps {
  config: GridConfig;
  outputSize: { width: number; height: number };
  autoOutputSize: { width: number; height: number };
  onOutputSizeChange: (size: { width: number; height: number }) => void;
  onOutputSizeReset: () => void;
  rotation: number;
  speed: number;
  speedMode: "single" | "all";
  onSpeedModeChange: (mode: "single" | "all") => void;
  onRotationChange: (degrees: number) => void;
  onSpeedChange: (speed: number) => void;
  onChange: (patch: Partial<GridConfig>) => void;
  disabled?: boolean;
}

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

function SpeedField({
  value,
  mode,
  onModeChange,
  onChange,
  disabled,
}: {
  value: number;
  mode: "single" | "all";
  onModeChange: (mode: "single" | "all") => void;
  onChange: (speed: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

  const handleChange = (raw: string) => {
    setText(raw);
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(clamp(n));
  };

  const handleBlur = () => {
    const n = Number(text);
    const next = Number.isFinite(n) ? clamp(n) : value;
    setText(String(next));
    if (Number.isFinite(n)) onChange(next);
  };

  return (
    <div className="field">
      <label htmlFor="speed">倍速</label>
      <div className="speed-mode-row">
        <button
          type="button"
          className={`speed-mode-btn${mode === "single" ? " active" : ""}`}
          disabled={disabled}
          onClick={() => onModeChange("single")}
        >
          作用单个GIF
        </button>
        <button
          type="button"
          className={`speed-mode-btn${mode === "all" ? " active" : ""}`}
          disabled={disabled}
          onClick={() => onModeChange("all")}
        >
          作用所有GIF
        </button>
      </div>
      <input
        id="speed"
        className="number-input"
        type="number"
        min={1}
        max={5}
        step={1}
        value={text}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
      <p className="field-hint">默认1倍速，最高5倍速</p>
    </div>
  );
}

function OutputSizeField({
  value,
  autoSize,
  onSizeChange,
  onReset,
  disabled,
}: {
  value: { width: number; height: number };
  autoSize: { width: number; height: number };
  onSizeChange: (size: { width: number; height: number }) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const [locked, setLocked] = useState(true);
  const [widthText, setWidthText] = useState(String(value.width));
  const [heightText, setHeightText] = useState(String(value.height));

  useEffect(() => {
    setWidthText(String(value.width));
    setHeightText(String(value.height));
  }, [value.width, value.height]);

  const ratio =
    value.width > 0 && value.height > 0
      ? value.width / value.height
      : autoSize.width / Math.max(1, autoSize.height);
  const clamp = (n: number) => Math.max(1, Math.round(n));

  const applyWidth = (raw: string) => {
    setWidthText(raw);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const width = clamp(n);
    const height = locked
      ? Math.max(1, Math.round(width / ratio))
      : value.height;
    onSizeChange({ width, height });
  };

  const applyHeight = (raw: string) => {
    setHeightText(raw);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const height = clamp(n);
    const width = locked
      ? Math.max(1, Math.round(height * ratio))
      : value.width;
    onSizeChange({ width, height });
  };

  return (
    <div className="field">
      <label htmlFor="outputWidth">
        输出大小{" "}
        <span className="value">
          {value.width}×{value.height}
        </span>
      </label>
      <div className="output-size-row">
        <label htmlFor="outputWidth">宽</label>
        <input
          id="outputWidth"
          className="number-input"
          type="number"
          min={1}
          step={1}
          value={widthText}
          disabled={disabled}
          onChange={(e) => applyWidth(e.target.value)}
          onBlur={() => setWidthText(String(value.width))}
        />
        <label htmlFor="outputHeight">高</label>
        <input
          id="outputHeight"
          className="number-input"
          type="number"
          min={1}
          step={1}
          value={heightText}
          disabled={disabled}
          onChange={(e) => applyHeight(e.target.value)}
          onBlur={() => setHeightText(String(value.height))}
        />
        <button
          type="button"
          className={`lock-btn${locked ? " active" : ""}`}
          title={locked ? "锁定比例" : "解锁比例"}
          disabled={disabled}
          onClick={() => setLocked((prev) => !prev)}
        >
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>
      <button
        type="button"
        className="ghost-btn output-reset-btn"
        disabled={disabled}
        onClick={onReset}
      >
        重置为原大小
      </button>
      <p className="field-hint">
        小于 1024×1024 保持原尺寸，超过自动压缩到 1024×1024
      </p>
    </div>
  );
}

export function SettingsPanel({
  config,
  outputSize,
  autoOutputSize,
  onOutputSizeChange,
  onOutputSizeReset,
  rotation,
  speed,
  speedMode,
  onSpeedModeChange,
  onRotationChange,
  onSpeedChange,
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
        max={10}
        hint="1-10"
        disabled={disabled}
        onChange={(columns) => onChange({ columns })}
      />

      <GridNumberField
        id="rows"
        label="行数"
        value={config.rows}
        min={0}
        max={10}
        hint="0 表示自动，最多 10 行"
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

      <SpeedField
        value={speed}
        mode={speedMode}
        onModeChange={onSpeedModeChange}
        onChange={onSpeedChange}
        disabled={disabled}
      />

      <OutputSizeField
        value={outputSize}
        autoSize={autoOutputSize}
        onSizeChange={onOutputSizeChange}
        onReset={onOutputSizeReset}
        disabled={disabled}
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
        <label htmlFor="ssimThreshold">
          画质 SSIM{" "}
          <span className="value">{config.ssimThreshold.toFixed(2)}</span>
        </label>
        <input
          id="ssimThreshold"
          type="range"
          min={0.9}
          max={0.99}
          step={0.01}
          value={config.ssimThreshold}
          disabled={disabled}
          onChange={(e) => onChange({ ssimThreshold: Number(e.target.value) })}
        />
        <p className="field-hint">（数值越大精度越高）</p>
      </div>
    </section>
  );
}
