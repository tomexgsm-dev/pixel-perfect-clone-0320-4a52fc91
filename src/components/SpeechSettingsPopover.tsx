import { useSpeechSettings } from "@/hooks/use-speech-settings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export function SpeechSettingsPopover() {
  const { voices, voiceURI, setVoiceURI, rate, setRate } = useSpeechSettings();

  const polishVoices = voices.filter((v) => v.lang.startsWith("pl"));
  const allVoices = polishVoices.length > 0 ? polishVoices : voices;

  const testVoice = () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Cześć, to jest test głosu.");
    u.lang = "pl-PL";
    u.rate = rate;
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Ustawienia głosu"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4" side="top" align="start">
        <h4 className="font-semibold text-sm">Ustawienia głosu</h4>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Głos</label>
          <select
            value={voiceURI}
            onChange={(e) => setVoiceURI(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Domyślny</option>
            {allVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Prędkość</label>
            <span className="text-xs font-mono text-muted-foreground">{rate.toFixed(1)}x</span>
          </div>
          <Slider
            value={[rate]}
            onValueChange={([v]) => setRate(v)}
            min={0.5}
            max={2}
            step={0.1}
            className="w-full"
          />
        </div>

        <button
          onClick={testVoice}
          className="w-full text-xs py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          🔊 Test głosu
        </button>
      </PopoverContent>
    </Popover>
  );
}
