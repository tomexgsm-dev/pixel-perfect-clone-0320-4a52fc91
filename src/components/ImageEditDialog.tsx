import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sun,
  Contrast,
  Droplets,
  CircleDot,
  Undo2,
  Download,
  Loader2,
  Crop,
  Check,
  X,
} from "lucide-react";

interface ImageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageName?: string;
}

interface EditState {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
  grayscale: number;
  sepia: number;
  hueRotate: number;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_STATE: EditState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
};

const FILTERS = [
  { key: "brightness" as const, label: "Brightness", icon: Sun, min: 0, max: 200, unit: "%" },
  { key: "contrast" as const, label: "Contrast", icon: Contrast, min: 0, max: 200, unit: "%" },
  { key: "saturate" as const, label: "Saturation", icon: Droplets, min: 0, max: 200, unit: "%" },
  { key: "blur" as const, label: "Blur", icon: CircleDot, min: 0, max: 20, unit: "px" },
  { key: "grayscale" as const, label: "Grayscale", icon: Contrast, min: 0, max: 100, unit: "%" },
  { key: "sepia" as const, label: "Sepia", icon: Sun, min: 0, max: 100, unit: "%" },
  { key: "hueRotate" as const, label: "Hue Rotate", icon: RotateCw, min: 0, max: 360, unit: "°" },
];

const ASPECT_PRESETS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
  { label: "9:16", value: 9 / 16 },
];

export default function ImageEditDialog({
  open,
  onOpenChange,
  imageUrl,
  imageName,
}: ImageEditDialogProps) {
  const [edit, setEdit] = useState<EditState>({ ...DEFAULT_STATE });
  const [isExporting, setIsExporting] = useState(false);

  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setEdit({ ...DEFAULT_STATE });
      setCroppedImageUrl(null);
      setCropRect(null);
      setIsCropping(false);
    }
  }, [open]);

  const currentImageUrl = croppedImageUrl || imageUrl;

  const filterString = `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturate}%) blur(${edit.blur}px) grayscale(${edit.grayscale}%) sepia(${edit.sepia}%) hue-rotate(${edit.hueRotate}deg)`;
  const transformString = `rotate(${edit.rotation}deg) scaleX(${edit.flipH ? -1 : 1}) scaleY(${edit.flipV ? -1 : 1})`;

  const update = <K extends keyof EditState>(key: K, val: EditState[K]) =>
    setEdit((prev) => ({ ...prev, [key]: val }));

  // --- Crop handlers ---
  const getRelativePos = (e: React.MouseEvent) => {
    const container = cropContainerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!isCropping) return;
    e.preventDefault();
    const pos = getRelativePos(e);
    setDragStart(pos);
    setCropRect(null);
    setIsDragging(true);
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    e.preventDefault();
    const pos = getRelativePos(e);

    let x = Math.min(dragStart.x, pos.x);
    let y = Math.min(dragStart.y, pos.y);
    let w = Math.abs(pos.x - dragStart.x);
    let h = Math.abs(pos.y - dragStart.y);

    if (aspectRatio && w > 0.01 && h > 0.01) {
      const container = cropContainerRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        const containerAspect = cRect.width / cRect.height;
        const targetRatio = aspectRatio / containerAspect;
        if (w / h > targetRatio) {
          w = h * targetRatio;
        } else {
          h = w / targetRatio;
        }
        if (pos.x < dragStart.x) x = dragStart.x - w;
        if (pos.y < dragStart.y) y = dragStart.y - h;
      }
    }

    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.min(w, 1 - x);
    h = Math.min(h, 1 - y);

    setCropRect({ x, y, w, h });
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

  const applyCrop = useCallback(async () => {
    if (!cropRect || cropRect.w < 0.01 || cropRect.h < 0.01) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentImageUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const sx = Math.round(cropRect.x * img.width);
    const sy = Math.round(cropRect.y * img.height);
    const sw = Math.round(cropRect.w * img.width);
    const sh = Math.round(cropRect.h * img.height);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (blob) {
      if (croppedImageUrl) URL.revokeObjectURL(croppedImageUrl);
      setCroppedImageUrl(URL.createObjectURL(blob));
    }

    setCropRect(null);
    setIsCropping(false);
  }, [cropRect, currentImageUrl, croppedImageUrl]);

  const cancelCrop = () => {
    setCropRect(null);
    setIsCropping(false);
  };

  // --- Export ---
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = currentImageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const isRotated90 = edit.rotation % 180 !== 0;
      canvas.width = isRotated90 ? img.height : img.width;
      canvas.height = isRotated90 ? img.width : img.height;

      const ctx = canvas.getContext("2d")!;
      ctx.filter = filterString;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((edit.rotation * Math.PI) / 180);
      ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = imageName || "edited-image.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  }, [currentImageUrl, edit, filterString, imageName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            ✏️ Image Editor
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Preview / Crop area */}
          <div
            ref={cropContainerRef}
            className="relative flex items-center justify-center rounded-xl border border-border bg-muted/30 min-h-[300px] overflow-hidden p-4 select-none"
            onMouseDown={handleCropMouseDown}
            onMouseMove={handleCropMouseMove}
            onMouseUp={handleCropMouseUp}
            onMouseLeave={handleCropMouseUp}
            style={{ cursor: isCropping ? "crosshair" : "default" }}
          >
            <img
              src={currentImageUrl}
              alt="Editing"
              className="max-h-[400px] max-w-full object-contain transition-all duration-200"
              style={{
                filter: isCropping ? "none" : filterString,
                transform: isCropping ? "none" : transformString,
                pointerEvents: "none",
              }}
              draggable={false}
            />

            {/* Crop overlay */}
            {isCropping && cropRect && cropRect.w > 0.005 && cropRect.h > 0.005 && (
              <>
                {/* Dark overlay with hole */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Top */}
                  <div
                    className="absolute bg-black/60"
                    style={{ top: 0, left: 0, right: 0, height: `${cropRect.y * 100}%` }}
                  />
                  {/* Bottom */}
                  <div
                    className="absolute bg-black/60"
                    style={{ bottom: 0, left: 0, right: 0, height: `${(1 - cropRect.y - cropRect.h) * 100}%` }}
                  />
                  {/* Left */}
                  <div
                    className="absolute bg-black/60"
                    style={{
                      top: `${cropRect.y * 100}%`,
                      left: 0,
                      width: `${cropRect.x * 100}%`,
                      height: `${cropRect.h * 100}%`,
                    }}
                  />
                  {/* Right */}
                  <div
                    className="absolute bg-black/60"
                    style={{
                      top: `${cropRect.y * 100}%`,
                      right: 0,
                      width: `${(1 - cropRect.x - cropRect.w) * 100}%`,
                      height: `${cropRect.h * 100}%`,
                    }}
                  />
                  {/* Selection border */}
                  <div
                    className="absolute border-2 border-white shadow-lg"
                    style={{
                      left: `${cropRect.x * 100}%`,
                      top: `${cropRect.y * 100}%`,
                      width: `${cropRect.w * 100}%`,
                      height: `${cropRect.h * 100}%`,
                    }}
                  >
                    {/* Grid lines (rule of thirds) */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40" />
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-white/40" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-white/40" />
                    </div>
                    {/* Corner handles */}
                    {[
                      "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
                      "top-0 right-0 translate-x-1/2 -translate-y-1/2",
                      "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
                      "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
                    ].map((pos, i) => (
                      <div
                        key={i}
                        className={`absolute ${pos} w-3 h-3 bg-white rounded-full shadow-md border border-border`}
                      />
                    ))}
                    {/* Size label */}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                      {Math.round(cropRect.w * 100)}% × {Math.round(cropRect.h * 100)}%
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Crop mode banner */}
            {isCropping && !cropRect && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Crop className="w-3.5 h-3.5" />
                Draw a rectangle to crop
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4 text-xs">
            {/* Crop section */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Crop</p>
              {!isCropping ? (
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setIsCropping(true); setCropRect(null); setAspectRatio(null); }}
                  className="w-full gap-1.5 text-[11px]"
                >
                  <Crop className="w-3.5 h-3.5" />
                  Start Cropping
                </Button>
              ) : (
                <div className="space-y-2">
                  {/* Aspect ratio presets */}
                  <div className="flex flex-wrap gap-1">
                    {ASPECT_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => setAspectRatio(p.value)}
                        className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                          aspectRatio === p.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:border-primary/60"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline" size="sm"
                      onClick={cancelCrop}
                      className="flex-1 gap-1 text-[10px]"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={applyCrop}
                      disabled={!cropRect || cropRect.w < 0.01}
                      className="flex-1 gap-1 text-[10px] bg-primary hover:bg-primary/90"
                    >
                      <Check className="w-3 h-3" />
                      Apply Crop
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Transform buttons */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Transform</p>
              <div className="grid grid-cols-4 gap-1.5">
                <Button
                  variant="outline" size="sm"
                  onClick={() => update("rotation", edit.rotation - 90)}
                  className="flex flex-col items-center gap-0.5 h-auto py-2 text-[10px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  -90°
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => update("rotation", edit.rotation + 90)}
                  className="flex flex-col items-center gap-0.5 h-auto py-2 text-[10px]"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  +90°
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => update("flipH", !edit.flipH)}
                  className={`flex flex-col items-center gap-0.5 h-auto py-2 text-[10px] ${edit.flipH ? "bg-primary text-primary-foreground border-primary" : ""}`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  Flip H
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => update("flipV", !edit.flipV)}
                  className={`flex flex-col items-center gap-0.5 h-auto py-2 text-[10px] ${edit.flipV ? "bg-primary text-primary-foreground border-primary" : ""}`}
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                  Flip V
                </Button>
              </div>
            </div>

            {/* Filter sliders */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Filters</p>
              {FILTERS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <f.icon className="w-3 h-3" />
                      {f.label}
                    </span>
                    <span className="text-[10px] font-medium text-foreground">
                      {edit[f.key]}{f.unit}
                    </span>
                  </div>
                  <Slider
                    min={f.min}
                    max={f.max}
                    step={f.key === "blur" ? 0.5 : 1}
                    value={[edit[f.key] as number]}
                    onValueChange={([v]) => update(f.key, v)}
                  />
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  setEdit({ ...DEFAULT_STATE });
                  if (croppedImageUrl) {
                    URL.revokeObjectURL(croppedImageUrl);
                    setCroppedImageUrl(null);
                  }
                }}
                className="flex-1 gap-1.5 text-[11px]"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 gap-1.5 text-[11px] bg-primary hover:bg-primary/90"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Save & Download
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
