import { useRef, useState } from "react";
import { Upload } from "lucide-react";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadZone({ onFiles, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (list && list.length > 0) onFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={`upload-zone${dragging ? " drag" : ""}${disabled ? " disabled" : ""}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".gif,image/gif"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Upload size={22} aria-hidden />
      <div className="upload-title">拖入 GIF 文件</div>
      <div className="upload-hint">或点击选择，可一次添加多个</div>
    </div>
  );
}
