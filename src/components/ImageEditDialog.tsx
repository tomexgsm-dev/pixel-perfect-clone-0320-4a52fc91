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

export default function ImageEditDialog({
  open,
  onOpenChange,
  imageUrl,
  imageName,
}: ImageEditDialogProps) {
  const [edit, setEdit] = useState<EditState>({ ...DEFAULT_STATE });
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (open) setEdit({ ...DEFAULT_STATE });
  }, [open]);

  const filterString = `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturate}%) blur(${edit.blur}px) grayscale(${edit.grayscale}%) sepia(${edit.sepia}%) hue-rotate(${edit.hueRotate}deg)`;

  const transformString = `rotate(${edit.rotation}deg) scaleX(${edit.flipH ? -1 : 1}) scaleY(${edit.flipV ? -1 : 1})`;

  const update = <K extends keyof EditState>(key: K, val: EditState[K]) =>
    setEdit((prev) => ({ ...prev, [key]: val }));

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
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
  }, [imageUrl, edit, filterString, imageName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            ✏️ Image Editor
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Preview */}
          <div className="flex items-center justify-center rounded-xl border border-border bg-muted/30 min-h-[300px] overflow-hidden p-4">
            <img
              src={imageUrl}
              alt="Editing"
              className="max-h-[400px] max-w-full object-contain transition-all duration-200"
              style={{ filter: filterString, transform: transformString }}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4 text-xs">
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
                  className={`flex flex-col items-center gap-0.5 h-auto py-2 text-[10px] ${edit.flipH ? "bg-violet-600 text-white border-violet-500" : ""}`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  Flip H
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => update("flipV", !edit.flipV)}
                  className={`flex flex-col items-center gap-0.5 h-auto py-2 text-[10px] ${edit.flipV ? "bg-violet-600 text-white border-violet-500" : ""}`}
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
                onClick={() => setEdit({ ...DEFAULT_STATE })}
                className="flex-1 gap-1.5 text-[11px]"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 gap-1.5 text-[11px] bg-violet-600 hover:bg-violet-500"
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
