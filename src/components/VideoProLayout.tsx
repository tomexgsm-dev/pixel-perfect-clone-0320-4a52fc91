export default function VideoProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050509] text-white flex flex-col">
      <header className="p-4 border-b border-[#262637] bg-[#0b0b12]">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          🎬 VideoPro
        </h1>
      </header>

      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
