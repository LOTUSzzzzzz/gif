import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { GifAsset } from "../types";
import { formatBytes, formatMs } from "../lib/format";

interface AssetListProps {
  assets: GifAsset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onClear: () => void;
}

export function AssetList({
  assets,
  selectedId,
  onSelect,
  onRemove,
  onReorder,
  onClear,
}: AssetListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>素材（{assets.length}）</h2>
        {assets.length > 0 && (
          <button type="button" className="link-btn" onClick={onClear}>
            清空
          </button>
        )}
      </div>
      {assets.length === 0 ? (
        <p className="empty-hint">尚未添加 GIF</p>
      ) : (
        <ul className="asset-list">
          {assets.map((asset, index) => (
            <li
              key={asset.id}
              className={`asset-card${dragIndex === index ? " dragging" : ""}${
                selectedId === asset.id ? " selected" : ""
              }`}
              draggable
              onClick={() => onSelect(asset.id)}
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== index) {
                  onReorder(dragIndex, index);
                }
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <GripVertical className="drag-icon" size={15} aria-hidden />
              {asset.previewUrl ? (
                <img src={asset.previewUrl} alt="" />
              ) : (
                <div className="thumb-fallback" />
              )}
              <div className="asset-info">
                <div className="asset-name" title={asset.name}>
                  {asset.name}
                </div>
                <div className="asset-meta">
                  {asset.meta
                    ? `${asset.meta.width}×${asset.meta.height} · ${asset.meta.frameCount} 帧 · ${formatMs(asset.meta.durationMs)} · ${formatBytes(asset.meta.sizeBytes)}`
                    : "解析中…"}
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                title="移除"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(asset.id);
                }}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
